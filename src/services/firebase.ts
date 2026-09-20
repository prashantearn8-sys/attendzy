import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  getDocs,
  onSnapshot,
  getDocFromServer,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  Subject,
  Timetable,
  AttendanceDayDoc,
  AttendanceClass,
  AttendanceStatus,
  UserProfile,
} from '../types/attendance';
import {
  formatDateToISO,
  getCurrentWeekRange,
  generateAttendanceFromTimetable,
  SUBJECT_COLOR_PALETTE,
} from '../utils/attendanceCalculations';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID if configured, or default
export const db = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

// Workspace OAuth Scopes for Google Sheets & Google Drive
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

// Configure standard Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});
WORKSPACE_SCOPES.forEach((scope) => googleProvider.addScope(scope));

// In-Memory cache for the Google OAuth access token (never persisted to localStorage)
let cachedGoogleAccessToken: string | null = null;

export function getCachedGoogleAccessToken(): string | null {
  return cachedGoogleAccessToken;
}

export function setCachedGoogleAccessToken(token: string | null) {
  cachedGoogleAccessToken = token;
}

export async function getOrRequestGoogleAccessToken(): Promise<string> {
  if (cachedGoogleAccessToken) {
    return cachedGoogleAccessToken;
  }
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Google Sheets permission was not granted. Please sign in and allow access.');
  }
  cachedGoogleAccessToken = credential.accessToken;
  return cachedGoogleAccessToken;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
  AUTH = 'auth',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase Firestore client appears offline, will sync when reconnected.');
    }
    return false;
  }
}
testFirestoreConnection();

/**
 * Sign in using Firebase Google Auth
 */
export async function signInWithGoogleFirebase(preferRedirect = false): Promise<UserProfile | null> {
  if (preferRedirect) {
    await signInWithRedirect(auth, googleProvider);
    return null;
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result && result.user) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedGoogleAccessToken = credential.accessToken;
      }
      return await buildAndPersistUserProfile(result.user);
    }
    return null;
  } catch (error: any) {
    const errorCode = error?.code || '';
    if (errorCode === 'auth/popup-blocked' || errorCode === 'auth/cancelled-popup-request') {
      try {
        await signInWithRedirect(auth, googleProvider);
        return null;
      } catch (redirectErr) {
        throw new Error('Sign-in popup was blocked. Please allow popups or open in a new tab.');
      }
    }
    if (errorCode === 'auth/popup-closed-by-user') {
      throw new Error('Google Sign-In was cancelled.');
    }
    console.error('[Firebase Auth] Sign In Error:', error);
    throw new Error(error?.message || 'Failed to sign in with Google.');
  }
}

/**
 * Check if the user is returning from a Google Redirect authentication flow
 */
export async function checkRedirectAuthResult(): Promise<UserProfile | null> {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedGoogleAccessToken = credential.accessToken;
      }
      return await buildAndPersistUserProfile(result.user);
    }
  } catch (err) {
    console.warn('[Firebase Auth] Redirect result error:', err);
  }
  return null;
}

/**
 * Listen to persistent Firebase authentication state
 */
export function subscribeToAuthChanges(callback: (user: UserProfile | null) => void): () => void {
  return onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
      try {
        const profile = await buildAndPersistUserProfile(fbUser);
        callback(profile);
      } catch {
        callback(null);
      }
    } else {
      cachedGoogleAccessToken = null;
      callback(null);
    }
  });
}

/**
 * Sign out from Firebase
 */
export async function signOutFirebase(): Promise<void> {
  try {
    cachedGoogleAccessToken = null;
    localStorage.removeItem('attendzy_auth_user');
    await fbSignOut(auth);
  } catch (err) {
    console.error('Sign out error:', err);
  }
}

/**
 * Build & persist UserProfile in Firestore
 */
export async function buildAndPersistUserProfile(fbUser: FirebaseUser): Promise<UserProfile> {
  const profile: UserProfile = {
    id: fbUser.uid,
    name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Student',
    email: fbUser.email || '',
    avatar: fbUser.photoURL || undefined,
    role: 'student',
    createdAt: new Date().toISOString(),
  };

  try {
    const userRef = doc(db, 'users', fbUser.uid);
    const existingSnap = await getDoc(userRef);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data() as Partial<UserProfile>;
      if (existingData.createdAt) profile.createdAt = existingData.createdAt;
      if (typeof existingData.targetPercentage === 'number') profile.targetPercentage = existingData.targetPercentage;
      if (Array.isArray(existingData.weekendDays)) profile.weekendDays = existingData.weekendDays;
      if (existingData.role) profile.role = existingData.role;
      if (existingData.googleSpreadsheetId) profile.googleSpreadsheetId = existingData.googleSpreadsheetId;
      if (existingData.googleSpreadsheetUrl) profile.googleSpreadsheetUrl = existingData.googleSpreadsheetUrl;
      if (existingData.googleSpreadsheetName) profile.googleSpreadsheetName = existingData.googleSpreadsheetName;
      if (existingData.lastGoogleSheetSyncTime) profile.lastGoogleSheetSyncTime = existingData.lastGoogleSheetSyncTime;
      if (typeof existingData.autoSyncGoogleSheets === 'boolean') profile.autoSyncGoogleSheets = existingData.autoSyncGoogleSheets;
    }
    await setDoc(userRef, profile, { merge: true });
    localStorage.setItem('attendzy_auth_user', JSON.stringify(profile));
  } catch (err) {
    console.warn('User profile sync warning:', err);
  }

  return profile;
}

/**
 * Update UserProfile in Firestore and Local Storage
 */
export async function updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, updates, { merge: true });
    const cached = localStorage.getItem('attendzy_auth_user');
    if (cached) {
      const parsed = JSON.parse(cached);
      localStorage.setItem('attendzy_auth_user', JSON.stringify({ ...parsed, ...updates }));
    }
  } catch (err) {
    console.warn('Update user profile warning:', err);
  }
}

/* =========================================================================
   SUBJECTS COLLECTION: users/{userId}/subjects/{subjectId}
   ========================================================================= */

export async function fetchSubjects(userId: string): Promise<Subject[]> {
  const path = `users/${userId}/subjects`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'subjects'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Subject, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeToSubjects(
  userId: string,
  onUpdate: (subjects: Subject[]) => void
): () => void {
  const path = `users/${userId}/subjects`;
  const isRegistered = Boolean(userId && !userId.startsWith('guest_') && userId !== 'student_nishant');

  let unsubscribeSnapshot: (() => void) | null = null;
  let isCancelled = false;

  const startListening = () => {
    if (isCancelled) return;
    const colRef = collection(db, 'users', userId, 'subjects');
    unsubscribeSnapshot = onSnapshot(
      colRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Subject, 'id'>) }));
        
        // Deduplicate subjects by normalized name
        const seenNames = new Set<string>();
        const uniqueList: Subject[] = [];
        const duplicateDocIds: string[] = [];

        for (const item of list) {
          const normalized = (item.name || '').trim().toLowerCase();
          if (!normalized) continue;
          if (seenNames.has(normalized)) {
            duplicateDocIds.push(item.id);
          } else {
            seenNames.add(normalized);
            uniqueList.push(item);
          }
        }

        // Automatically clean up duplicate documents from previous seed runs
        if (duplicateDocIds.length > 0) {
          for (const dupId of duplicateDocIds) {
            deleteDoc(doc(db, 'users', userId, 'subjects', dupId)).catch(() => {});
          }
        }

        onUpdate(uniqueList);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  };

  if (isRegistered && auth.currentUser?.uid !== userId) {
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser && fbUser.uid === userId) {
        unsubAuth();
        startListening();
      } else if (!fbUser) {
        onUpdate([]);
      }
    });
    return () => {
      isCancelled = true;
      unsubAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }

  startListening();
  return () => {
    isCancelled = true;
    if (unsubscribeSnapshot) unsubscribeSnapshot();
  };
}

export async function saveSubject(userId: string, subject: Partial<Subject>): Promise<string> {
  const subjectId = subject.id || doc(collection(db, 'users', userId, 'subjects')).id;
  const path = `users/${userId}/subjects/${subjectId}`;
  try {
    const subjectRef = doc(db, 'users', userId, 'subjects', subjectId);
    const data: Subject = {
      id: subjectId,
      name: subject.name || 'Untitled Subject',
      code: subject.code || 'SUB101',
      teacher: subject.teacher || 'Professor',
      totalClasses: Number(subject.totalClasses) || 0,
      attendedClasses: Number(subject.attendedClasses) || 0,
      color: subject.color || SUBJECT_COLOR_PALETTE[Math.floor(Math.random() * SUBJECT_COLOR_PALETTE.length)],
      createdAt: subject.createdAt || new Date().toISOString(),
    };
    await setDoc(subjectRef, data, { merge: true });
    return subjectId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteSubject(userId: string, subjectId: string): Promise<void> {
  const path = `users/${userId}/subjects/${subjectId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'subjects', subjectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Updates subject counters according to Feature 3 logic
 */
export async function updateSubjectCounters(
  userId: string,
  subjectId: string,
  newStatus: AttendanceStatus,
  previousStatus: AttendanceStatus,
  subjectName?: string
): Promise<void> {
  if (!subjectId && !subjectName) return;
  try {
    let subjectRef: any = null;
    let subjectSnap: any = null;

    if (subjectId && subjectId !== 'undefined') {
      const directRef = doc(db, 'users', userId, 'subjects', subjectId);
      const directSnap = await getDoc(directRef);
      if (directSnap.exists()) {
        subjectRef = directRef;
        subjectSnap = directSnap;
      }
    }

    if (!subjectSnap || !subjectSnap.exists()) {
      // Find matching subject across user's subjects collection
      const subjectsSnap = await getDocs(collection(db, 'users', userId, 'subjects'));
      const normTargetName = (subjectName || '').trim().toLowerCase();
      const slugFromId = (subjectId || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      for (const d of subjectsSnap.docs) {
        const s = d.data() as Subject;
        const normName = (s.name || '').trim().toLowerCase();
        const slugFromName = (s.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        if (
          d.id === subjectId ||
          (normTargetName && normName === normTargetName) ||
          (slugFromId && slugFromName === slugFromId) ||
          (s.code && s.code.toLowerCase() === (subjectId || '').toLowerCase())
        ) {
          subjectRef = d.ref;
          subjectSnap = d;
          break;
        }
      }
    }

    if (!subjectRef || !subjectSnap || !subjectSnap.exists()) {
      return;
    }

    const subject = subjectSnap.data() as Subject;
    let totalClasses = Number(subject.totalClasses) || 0;
    let attendedClasses = Number(subject.attendedClasses) || 0;

    // Reverse previous status if changing
    if (previousStatus === 'present' || previousStatus === 'late') {
      attendedClasses = Math.max(0, attendedClasses - 1);
    }
    if (previousStatus !== null && previousStatus !== 'cancelled') {
      totalClasses = Math.max(0, totalClasses - 1);
    }

    // Apply new status
    if (newStatus === 'present' || newStatus === 'late') {
      attendedClasses += 1;
    }
    if (newStatus !== null && newStatus !== 'cancelled') {
      totalClasses += 1;
    }

    await updateDoc(subjectRef, {
      totalClasses,
      attendedClasses,
    });
  } catch (error) {
    console.error('Failed to update subject counters:', error);
  }
}

/* =========================================================================
   TIMETABLES COLLECTION: users/{userId}/timetables/{timetableId}
   ========================================================================= */

export async function fetchTimetables(userId: string): Promise<Timetable[]> {
  const path = `users/${userId}/timetables`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'timetables'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Timetable, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeToTimetables(
  userId: string,
  onUpdate: (timetables: Timetable[]) => void
): () => void {
  const path = `users/${userId}/timetables`;
  const isRegistered = Boolean(userId && !userId.startsWith('guest_') && userId !== 'student_nishant');

  let unsubscribeSnapshot: (() => void) | null = null;
  let isCancelled = false;

  const startListening = () => {
    if (isCancelled) return;
    const colRef = collection(db, 'users', userId, 'timetables');
    unsubscribeSnapshot = onSnapshot(
      colRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Timetable, 'id'>) }));
        onUpdate(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  };

  if (isRegistered && auth.currentUser?.uid !== userId) {
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser && fbUser.uid === userId) {
        unsubAuth();
        startListening();
      } else if (!fbUser) {
        onUpdate([]);
      }
    });
    return () => {
      isCancelled = true;
      unsubAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }

  startListening();
  return () => {
    isCancelled = true;
    if (unsubscribeSnapshot) unsubscribeSnapshot();
  };
}

export async function saveTimetable(userId: string, timetable: Partial<Timetable>): Promise<string> {
  const timetableId = timetable.id || doc(collection(db, 'users', userId, 'timetables')).id;
  const path = `users/${userId}/timetables/${timetableId}`;
  try {
    const timetableRef = doc(db, 'users', userId, 'timetables', timetableId);
    const data: Timetable = {
      id: timetableId,
      name: timetable.name || 'Class Timetable',
      imageUrl: timetable.imageUrl || '',
      uploadedAt: timetable.uploadedAt || new Date().toISOString(),
      weekStart: timetable.weekStart || getCurrentWeekRange().weekStart,
      weekEnd: timetable.weekEnd || getCurrentWeekRange().weekEnd,
      days: timetable.days || {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
      },
    };
    await setDoc(timetableRef, data, { merge: true });
    return timetableId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteTimetable(userId: string, timetableId: string): Promise<void> {
  const path = `users/${userId}/timetables/${timetableId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'timetables', timetableId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/* =========================================================================
   ATTENDANCE COLLECTION: users/{userId}/attendance/{date}
   ========================================================================= */

export async function fetchAttendanceDocs(userId: string): Promise<AttendanceDayDoc[]> {
  const path = `users/${userId}/attendance`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'attendance'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceDayDoc, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeToAttendanceDocs(
  userId: string,
  onUpdate: (docs: AttendanceDayDoc[]) => void
): () => void {
  const path = `users/${userId}/attendance`;
  const isRegistered = Boolean(userId && !userId.startsWith('guest_') && userId !== 'student_nishant');

  let unsubscribeSnapshot: (() => void) | null = null;
  let isCancelled = false;

  const startListening = () => {
    if (isCancelled) return;
    const colRef = collection(db, 'users', userId, 'attendance');
    unsubscribeSnapshot = onSnapshot(
      colRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceDayDoc, 'id'>) }));
        onUpdate(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  };

  if (isRegistered && auth.currentUser?.uid !== userId) {
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser && fbUser.uid === userId) {
        unsubAuth();
        startListening();
      } else if (!fbUser) {
        onUpdate([]);
      }
    });
    return () => {
      isCancelled = true;
      unsubAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }

  startListening();
  return () => {
    isCancelled = true;
    if (unsubscribeSnapshot) unsubscribeSnapshot();
  };
}

export async function saveAttendanceDoc(userId: string, attDoc: AttendanceDayDoc): Promise<void> {
  const path = `users/${userId}/attendance/${attDoc.date}`;
  try {
    const docRef = doc(db, 'users', userId, 'attendance', attDoc.date);
    await setDoc(docRef, attDoc, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function batchSaveAttendanceDocs(userId: string, docs: AttendanceDayDoc[]): Promise<void> {
  if (!docs || docs.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const d of docs) {
      const ref = doc(db, 'users', userId, 'attendance', d.date);
      batch.set(ref, d, { merge: true });
    }
    await batch.commit();
  } catch (error) {
    console.error('Batch save attendance docs error:', error);
  }
}

/**
 * Feature 3: Daily Attendance Marking
 */
export async function markAttendance(
  userId: string,
  date: string,
  classIndex: number,
  newStatus: AttendanceStatus,
  note?: string
): Promise<void> {
  const path = `users/${userId}/attendance/${date}`;
  try {
    const docRef = doc(db, 'users', userId, 'attendance', date);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as AttendanceDayDoc;
      if (!data.classes || !data.classes[classIndex]) return;

      const previousStatus = data.classes[classIndex].status;
      data.classes[classIndex].status = newStatus;
      data.classes[classIndex].markedAt = new Date().toISOString();
      if (note !== undefined) {
        data.classes[classIndex].note = note;
      }

      // Update subject totals
      const subjectId = data.classes[classIndex].subjectId;
      const subjectName = data.classes[classIndex].subjectName;
      await updateSubjectCounters(userId, subjectId, newStatus, previousStatus, subjectName);

      await updateDoc(docRef, {
        classes: data.classes,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/* =========================================================================
   USER DATA CLEAR / RESET
   ========================================================================= */

export async function clearAllUserData(userId: string): Promise<void> {
  const path = `users/${userId}`;
  try {
    const subjectsSnap = await getDocs(collection(db, 'users', userId, 'subjects'));
    for (const d of subjectsSnap.docs) {
      await deleteDoc(d.ref);
    }
    const timetablesSnap = await getDocs(collection(db, 'users', userId, 'timetables'));
    for (const d of timetablesSnap.docs) {
      await deleteDoc(d.ref);
    }
    const attendanceSnap = await getDocs(collection(db, 'users', userId, 'attendance'));
    for (const d of attendanceSnap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/* =========================================================================
   INITIAL SEED DATA (DEPRECATED)
   ========================================================================= */

export async function seedInitialUserData(userId: string): Promise<{
  subjects: Subject[];
  timetable: Timetable;
  attendanceDocs: AttendanceDayDoc[];
}> {
  // 1. Create Default Subjects
  const initialSubjects: Omit<Subject, 'id'>[] = [
    {
      name: 'Mathematics',
      code: 'MATH101',
      teacher: 'Dr. Smith',
      totalClasses: 45,
      attendedClasses: 38,
      color: '#7C5CFC',
      createdAt: new Date().toISOString(),
    },
    {
      name: 'Physics',
      code: 'PHYS201',
      teacher: 'Prof. Miller',
      totalClasses: 40,
      attendedClasses: 34,
      color: '#3B82F6',
      createdAt: new Date().toISOString(),
    },
    {
      name: 'Data Structures',
      code: 'CS202',
      teacher: 'Dr. Sarah Jenkins',
      totalClasses: 36,
      attendedClasses: 32,
      color: '#10B981',
      createdAt: new Date().toISOString(),
    },
    {
      name: 'Computer Networks',
      code: 'CS301',
      teacher: 'Prof. David Chen',
      totalClasses: 32,
      attendedClasses: 25,
      color: '#F59E0B',
      createdAt: new Date().toISOString(),
    },
    {
      name: 'Database Systems',
      code: 'CS304',
      teacher: 'Dr. Elena Vance',
      totalClasses: 30,
      attendedClasses: 27,
      color: '#EC4899',
      createdAt: new Date().toISOString(),
    },
  ];

  const createdSubjects: Subject[] = [];
  for (const s of initialSubjects) {
    const id = await saveSubject(userId, s);
    createdSubjects.push({ id, ...s });
  }

  // 2. Create Default Weekly Timetable
  const { weekStart, weekEnd } = getCurrentWeekRange();

  const math = createdSubjects[0];
  const phys = createdSubjects[1];
  const ds = createdSubjects[2];
  const net = createdSubjects[3];
  const dbSys = createdSubjects[4];

  const defaultTimetable: Timetable = {
    id: 'default-weekly',
    name: 'Fall 2026 Semester Schedule',
    weekStart,
    weekEnd,
    uploadedAt: new Date().toISOString(),
    days: {
      monday: [
        { subjectId: math.id, subjectName: math.name, startTime: '09:00', endTime: '10:00', room: 'Hall 301' },
        { subjectId: phys.id, subjectName: phys.name, startTime: '10:15', endTime: '11:15', room: 'Lab 2' },
        { subjectId: ds.id, subjectName: ds.name, startTime: '11:30', endTime: '12:30', room: 'Room 404' },
      ],
      tuesday: [
        { subjectId: net.id, subjectName: net.name, startTime: '09:00', endTime: '10:00', room: 'Room 205' },
        { subjectId: dbSys.id, subjectName: dbSys.name, startTime: '10:15', endTime: '11:15', room: 'Lab 1' },
        { subjectId: math.id, subjectName: math.name, startTime: '13:30', endTime: '14:30', room: 'Hall 301' },
      ],
      wednesday: [
        { subjectId: ds.id, subjectName: ds.name, startTime: '09:00', endTime: '10:30', room: 'Lab 3' },
        { subjectId: phys.id, subjectName: phys.name, startTime: '11:00', endTime: '12:00', room: 'Lab 2' },
        { subjectId: net.id, subjectName: net.name, startTime: '14:00', endTime: '15:00', room: 'Room 205' },
      ],
      thursday: [
        { subjectId: math.id, subjectName: math.name, startTime: '09:00', endTime: '10:00', room: 'Hall 301' },
        { subjectId: dbSys.id, subjectName: dbSys.name, startTime: '10:15', endTime: '11:15', room: 'Room 102' },
        { subjectId: ds.id, subjectName: ds.name, startTime: '11:30', endTime: '12:30', room: 'Room 404' },
      ],
      friday: [
        { subjectId: phys.id, subjectName: phys.name, startTime: '09:00', endTime: '10:00', room: 'Hall 105' },
        { subjectId: net.id, subjectName: net.name, startTime: '10:15', endTime: '11:15', room: 'Room 205' },
        { subjectId: dbSys.id, subjectName: dbSys.name, startTime: '11:30', endTime: '12:30', room: 'Lab 1' },
      ],
      saturday: [
        { subjectId: math.id, subjectName: math.name, startTime: '10:00', endTime: '11:30', room: 'Seminar Hall' },
      ],
    },
  };

  await saveTimetable(userId, defaultTimetable);

  // 3. Generate Calendar Attendance Docs for this week
  const { updatedDocs } = generateAttendanceFromTimetable(defaultTimetable, []);
  
  // Mark past days of the week as present so dashboard has rich immediate history
  const todayStr = formatDateToISO();
  for (const doc of updatedDocs) {
    if (doc.date < todayStr) {
      doc.classes = doc.classes.map((c, i) => ({
        ...c,
        status: 'present',
        markedAt: new Date(doc.date + 'T12:00:00').toISOString(),
      }));
    }
  }

  await batchSaveAttendanceDocs(userId, updatedDocs);

  return {
    subjects: createdSubjects,
    timetable: defaultTimetable,
    attendanceDocs: updatedDocs,
  };
}
