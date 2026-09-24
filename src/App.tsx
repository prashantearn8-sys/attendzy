import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Navbar, NavTab, TAB_ROUTES, getTabFromPath } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { CalendarView } from './components/CalendarView';
import { TimetableManagerView } from './components/TimetableManagerView';
import { SubjectsView } from './components/SubjectsView';
import { SettingsView } from './components/SettingsView';
import {
  UserProfile,
  Subject,
  Timetable,
  TimetableClass,
  AttendanceDayDoc,
  AttendanceClass,
  AttendanceStatus,
} from './types/attendance';
import {
  auth,
  signInWithGoogleFirebase,
  signOutFirebase,
  subscribeToAuthChanges,
  checkRedirectAuthResult,
  subscribeToSubjects,
  subscribeToTimetables,
  subscribeToAttendanceDocs,
  saveSubject,
  deleteSubject,
  saveTimetable,
  saveAttendanceDoc,
  batchSaveAttendanceDocs,
  markAttendance,
  markAllAttendanceForDate,
  clearAllUserData,
  updateUserProfile,
} from './services/firebase';
import {
  calculateOverallAttendance,
  getAttendanceTrend,
  generateAttendanceFromTimetable,
  recalculateAllSubjectTotals,
  matchesSubject,
  SUBJECT_COLOR_PALETTE,
  getCurrentWeekRange,
  parseISODate,
  DEFAULT_WEEKEND_DAYS,
  DEFAULT_TARGET_PERCENTAGE,
} from './utils/attendanceCalculations';

export default function App() {
  // Sync active view with browser URL route (e.g. /home, /calendar, /calender, /schedule, /subjects, /settings)
  const [activeTab, setActiveTabState] = useState<NavTab>(() => {
    return getTabFromPath(window.location.pathname);
  });

  const setActiveTab = useCallback((tab: NavTab, replaceHistory = false) => {
    setActiveTabState(tab);
    const targetPath = TAB_ROUTES[tab];
    const currentPath = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    const isCalendarVariant = tab === 'calendar' && (currentPath === '/calender' || currentPath === '/calendar');

    if (!isCalendarVariant && currentPath !== targetPath) {
      if (replaceHistory) {
        window.history.replaceState({ tab }, '', targetPath);
      } else {
        window.history.pushState({ tab }, '', targetPath);
      }
    }
  }, []);

  // Listen to browser Back and Forward button events
  useEffect(() => {
    const handlePopState = () => {
      const tab = getTabFromPath(window.location.pathname);
      setActiveTabState(tab);
    };

    window.addEventListener('popstate', handlePopState);

    // If initial pathname is '/' or empty, normalize to '/home' in URL history without reloading
    if (window.location.pathname === '/' || window.location.pathname === '') {
      window.history.replaceState({ tab: 'dashboard' }, '', '/home');
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Update dynamic page title matching current page route
  useEffect(() => {
    const titles: Record<NavTab, string> = {
      dashboard: 'Attendzy - Home',
      calendar: 'Attendzy - Calendar',
      timetable: 'Attendzy - Schedule',
      subjects: 'Attendzy - Subjects',
      settings: 'Attendzy - Settings',
    };
    document.title = titles[activeTab] || 'Attendzy - Student Attendance Tracker';
  }, [activeTab]);
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const cached = localStorage.getItem('attendzy_auth_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id && !parsed.id.startsWith('guest_') && parsed.id !== 'student_nishant' && parsed.email) {
          return parsed;
        }
      }
      const studentProfile = localStorage.getItem('attendease_student_profile');
      if (studentProfile) {
        const parsed = JSON.parse(studentProfile);
        if (parsed && parsed.id && !parsed.id.startsWith('guest_') && parsed.id !== 'student_nishant' && parsed.email) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse cached user:', e);
    }
    return null;
  });

  const isSignedIn = useMemo(() => {
    return Boolean(
      user &&
      user.id &&
      !user.id.startsWith('guest_') &&
      user.id !== 'student_nishant' &&
      user.email
    );
  }, [user]);

  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  // Firestore Collections State
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [attendanceDocs, setAttendanceDocs] = useState<AttendanceDayDoc[]>([]);

  // Weekend days configuration (0 = Sunday, 6 = Saturday, default [0, 6])
  const [weekendDays, setWeekendDays] = useState<number[]>(() => {
    try {
      const cached = localStorage.getItem('attendzy_weekend_days');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
      const userCached = localStorage.getItem('attendzy_auth_user');
      if (userCached) {
        const parsedUser = JSON.parse(userCached);
        if (Array.isArray(parsedUser?.weekendDays)) return parsedUser.weekendDays;
      }
    } catch (e) {
      console.warn('Failed to parse cached weekend days:', e);
    }
    return DEFAULT_WEEKEND_DAYS;
  });

  // Handler to update weekend days across session & Firestore profile
  const handleUpdateWeekendDays = (days: number[]) => {
    setWeekendDays(days);
    try {
      localStorage.setItem('attendzy_weekend_days', JSON.stringify(days));
    } catch {}

    if (user) {
      const updatedUser: UserProfile = { ...user, weekendDays: days };
      setUser(updatedUser);
      try {
        localStorage.setItem('attendzy_auth_user', JSON.stringify(updatedUser));
      } catch {}
      if (effectiveUserId) {
        updateUserProfile(effectiveUserId, { weekendDays: days }).catch((err) => {
          console.warn('Failed to persist weekend days to Firestore:', err);
        });
      }
    }
  };

  // Target attendance percentage configuration (default 75%)
  const [targetPercentage, setTargetPercentage] = useState<number>(() => {
    try {
      const cached = localStorage.getItem('attendzy_target_percentage');
      if (cached) {
        const val = Number(cached);
        if (!isNaN(val) && val >= 1 && val <= 100) return val;
      }
      const userCached = localStorage.getItem('attendzy_auth_user');
      if (userCached) {
        const parsedUser = JSON.parse(userCached);
        if (typeof parsedUser?.targetPercentage === 'number') return parsedUser.targetPercentage;
      }
    } catch (e) {
      console.warn('Failed to parse cached target percentage:', e);
    }
    return DEFAULT_TARGET_PERCENTAGE;
  });

  // Handler to update target percentage across session, localStorage & Firestore
  const handleUpdateTargetPercentage = (percentage: number) => {
    const clamped = Math.min(100, Math.max(1, Math.round(percentage)));
    setTargetPercentage(clamped);
    try {
      localStorage.setItem('attendzy_target_percentage', clamped.toString());
    } catch {}

    if (user) {
      const updatedUser: UserProfile = { ...user, targetPercentage: clamped };
      setUser(updatedUser);
      try {
        localStorage.setItem('attendzy_auth_user', JSON.stringify(updatedUser));
      } catch {}
      if (effectiveUserId) {
        updateUserProfile(effectiveUserId, { targetPercentage: clamped }).catch((err) => {
          console.warn('Failed to persist target percentage to Firestore:', err);
        });
      }
    }
  };

  // Toast feedback disabled per user request (zero pop-ups)
  const addToast = (_message: string, _type: 'success' | 'error' | 'info' = 'info') => {
    // Pop-ups removed
  };

  // Resolve Effective User ID (either Firebase Auth UID or Guest Session)
  const effectiveUserId = useMemo(() => {
    if (user?.id && !user.id.startsWith('guest_') && user.id !== 'student_nishant') {
      return user.id;
    }
    let guestId = localStorage.getItem('attendzy_guest_id');
    if (!guestId) {
      guestId = 'guest_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('attendzy_guest_id', guestId);
    }
    return guestId;
  }, [user]);

  // Firebase Auth Initialization & Listeners
  useEffect(() => {
    // Check for cached user in localStorage
    try {
      const cached = localStorage.getItem('attendzy_auth_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        setUser(parsed);
        if (Array.isArray(parsed?.weekendDays)) {
          setWeekendDays(parsed.weekendDays);
        }
      }
    } catch (e) {
      console.warn('Failed to parse cached user:', e);
    }

    // Check redirect login
    checkRedirectAuthResult().then((profile) => {
      if (profile) {
        setUser(profile);
        if (Array.isArray(profile.weekendDays)) {
          setWeekendDays(profile.weekendDays);
        }
        if (typeof profile.targetPercentage === 'number') {
          setTargetPercentage(profile.targetPercentage);
        }
        addToast(`Welcome back, ${profile.name}!`, 'success');
      }
    }).finally(() => {
      setAuthReady(true);
    });

    // Subscribe to Auth changes
    const unsubAuth = subscribeToAuthChanges((profile) => {
      setUser(profile);
      setAuthReady(true);
      if (profile) {
        if (Array.isArray(profile.weekendDays)) {
          setWeekendDays(profile.weekendDays);
        }
        if (typeof profile.targetPercentage === 'number') {
          setTargetPercentage(profile.targetPercentage);
        }
      }
    });

    return () => {
      unsubAuth();
    };
  }, []);

  // Subscribe to user Firestore subcollections
  useEffect(() => {
    // If a registered user is expected, delay subscribing until auth is confirmed
    const isRegisteredUser = Boolean(user?.id && !user.id.startsWith('guest_') && user.id !== 'student_nishant');
    if (isRegisteredUser && !authReady && auth.currentUser?.uid !== effectiveUserId) {
      return;
    }

    if (!effectiveUserId) return;
    setLoading(true);

    let isSubscribed = true;
    let initialCheckTimeout: any = null;

    const unsubSubjects = subscribeToSubjects(effectiveUserId, (data) => {
      if (isSubscribed) {
        setSubjects(data);
      }
    });

    const unsubTimetables = subscribeToTimetables(effectiveUserId, (data) => {
      if (isSubscribed) {
        setTimetables(data);
      }
    });

    const unsubAttendance = subscribeToAttendanceDocs(effectiveUserId, (data) => {
      if (isSubscribed) {
        setAttendanceDocs(data);
        setLoading(false);
      }
    });

    // Stop initial loading indicator after initial subscription ticks
    initialCheckTimeout = setTimeout(() => {
      if (isSubscribed) {
        setLoading(false);
      }
    }, 1000);

    return () => {
      isSubscribed = false;
      clearTimeout(initialCheckTimeout);
      unsubSubjects();
      unsubTimetables();
      unsubAttendance();
    };
  }, [effectiveUserId, authReady, user?.id]);

  // Metrics Calculations
  const stats = useMemo(() => {
    return calculateOverallAttendance(subjects, attendanceDocs);
  }, [subjects, attendanceDocs]);

  const trend = useMemo(() => {
    return getAttendanceTrend(attendanceDocs, subjects);
  }, [attendanceDocs, subjects]);

  // Daily Attendance Marking Handler (Feature 3)
  const handleMarkAttendance = async (
    date: string,
    classIndex: number,
    status: AttendanceStatus,
    note?: string
  ) => {
    // Look up target class and current status synchronously
    const dayDoc = attendanceDocs.find((d) => d.date === date);
    const targetClass = dayDoc?.classes?.[classIndex] || null;
    const prevStatus = targetClass?.status ?? null;

    // 1. Optimistic UI update for attendance docs
    setAttendanceDocs((prev) => {
      return prev.map((doc) => {
        if (doc.date !== date) return doc;
        const updatedClasses = [...doc.classes];
        if (updatedClasses[classIndex]) {
          updatedClasses[classIndex] = {
            ...updatedClasses[classIndex],
            status,
            markedAt: new Date().toISOString(),
            ...(note !== undefined ? { note } : {}),
          };
        }
        return { ...doc, classes: updatedClasses };
      });
    });

    // 2. Optimistic UI update for subjects counters
    if (targetClass) {
      setSubjects((prevSubjects) => {
        return prevSubjects.map((s) => {
          if (!matchesSubject(targetClass, s)) return s;
          let totalClasses = Number(s.totalClasses) || 0;
          let attendedClasses = Number(s.attendedClasses) || 0;

          // Undo previous status
          if (prevStatus === 'present' || prevStatus === 'late') {
            attendedClasses = Math.max(0, attendedClasses - 1);
          }
          if (prevStatus !== null && prevStatus !== 'cancelled') {
            totalClasses = Math.max(0, totalClasses - 1);
          }

          // Apply new status
          if (status === 'present' || status === 'late') {
            attendedClasses += 1;
          }
          if (status !== null && status !== 'cancelled') {
            totalClasses += 1;
          }

          return { ...s, totalClasses, attendedClasses };
        });
      });
    }

    try {
      await markAttendance(effectiveUserId, date, classIndex, status, note);
      addToast(
        status ? `Marked as ${status.toUpperCase()}` : 'Attendance reset',
        status === 'present' ? 'success' : status === 'absent' ? 'error' : 'info'
      );
    } catch (error: any) {
      console.error('Mark attendance failed:', error);
      addToast('Failed to save attendance mark.', 'error');
    }
  };

  // Feature: Mark all classes for a given date (Present All / Absent All)
  const handleMarkAllAttendance = async (date: string, status: AttendanceStatus) => {
    const dayDoc = attendanceDocs.find((d) => d.date === date);
    if (!dayDoc || !dayDoc.classes || dayDoc.classes.length === 0) {
      addToast('No classes scheduled for this date.', 'info');
      return;
    }

    const previousClasses = [...dayDoc.classes];
    const nowIso = new Date().toISOString();

    // 1. Optimistic attendance docs update
    setAttendanceDocs((prev) => {
      return prev.map((doc) => {
        if (doc.date !== date) return doc;
        const updatedClasses = doc.classes.map((cls) => {
          if (cls.status === 'cancelled') return cls;
          return {
            ...cls,
            status,
            markedAt: nowIso,
          };
        });
        return { ...doc, classes: updatedClasses };
      });
    });

    // 2. Optimistic subjects totals update
    setSubjects((prevSubjects) => {
      return prevSubjects.map((s) => {
        let totalClasses = Number(s.totalClasses) || 0;
        let attendedClasses = Number(s.attendedClasses) || 0;

        previousClasses.forEach((cls) => {
          if (cls.status === 'cancelled') return;
          if (!matchesSubject(cls, s)) return;
          const prevStatus = cls.status;

          // Undo previous
          if (prevStatus === 'present' || prevStatus === 'late') {
            attendedClasses = Math.max(0, attendedClasses - 1);
          }
          if (prevStatus !== null && prevStatus !== 'cancelled') {
            totalClasses = Math.max(0, totalClasses - 1);
          }

          // Apply new
          if (status === 'present' || status === 'late') {
            attendedClasses += 1;
          }
          if (status !== null && status !== 'cancelled') {
            totalClasses += 1;
          }
        });

        return { ...s, totalClasses, attendedClasses };
      });
    });

    try {
      await markAllAttendanceForDate(effectiveUserId, date, status);
      addToast(
        status === 'present'
          ? 'All classes marked as Present ✓'
          : status === 'absent'
          ? 'All classes marked as Absent'
          : 'Attendance reset for all classes',
        status === 'present' ? 'success' : 'info'
      );
    } catch (error: any) {
      console.error('Failed to mark all attendance:', error);
      addToast('Failed to update all classes.', 'error');
    }
  };

  // Timetable Save & Auto Calendar Population (Features 1, 2, 5, 8)
  const handleSaveTimetableAndPopulate = async (
    timetableData: Partial<Timetable>,
    detectedNewSubjects?: { name: string; code?: string; teacher?: string }[]
  ): Promise<{ message: string }> => {
    if (!isSignedIn) {
      handleGoogleSignIn();
      throw new Error('Please sign in with Google to save a schedule.');
    }

    // 1. Auto-create any detected subjects in Firestore if not already present
    if (detectedNewSubjects && detectedNewSubjects.length > 0) {
      for (const dSub of detectedNewSubjects) {
        const existing = subjects.find(
          (s) => s.name.toLowerCase() === dSub.name.toLowerCase()
        );
        if (!existing) {
          await saveSubject(effectiveUserId, {
            name: dSub.name,
            code: dSub.code || dSub.name.slice(0, 4).toUpperCase() + '101',
            teacher: dSub.teacher || 'Faculty',
            totalClasses: 0,
            attendedClasses: 0,
            color: SUBJECT_COLOR_PALETTE[Math.floor(Math.random() * SUBJECT_COLOR_PALETTE.length)],
          });
        }
      }
    }

    // 2. Save Timetable
    const savedId = await saveTimetable(effectiveUserId, timetableData);
    const fullTimetable: Timetable = {
      id: savedId,
      name: timetableData.name || 'Class Timetable',
      section: timetableData.section,
      weekStart: timetableData.weekStart || getCurrentWeekRange().weekStart,
      weekEnd: timetableData.weekEnd || getCurrentWeekRange().weekEnd,
      days: timetableData.days!,
      imageUrl: timetableData.imageUrl,
      uploadedAt: new Date().toISOString(),
    };

    // 3. Generate and merge attendance documents (Feature 5)
    const { updatedDocs, summary } = generateAttendanceFromTimetable(
      fullTimetable,
      attendanceDocs
    );

    // 4. Batch save to Firestore
    await batchSaveAttendanceDocs(effectiveUserId, updatedDocs);

    // 5. Recalculate all subject totals
    const updatedSubjects = recalculateAllSubjectTotals(subjects, updatedDocs);
    for (const sub of updatedSubjects) {
      await saveSubject(effectiveUserId, sub);
    }

    addToast(summary.message, 'success');
    return { message: summary.message };
  };

  // Daily Fresh Schedule Save (Features: User can upload fresh every day without copying past week)
  const handleSaveDailySchedule = async (
    date: string,
    classes: TimetableClass[],
    detectedNewSubjects?: { name: string; code?: string; teacher?: string }[]
  ): Promise<{ message: string }> => {
    if (!isSignedIn) {
      handleGoogleSignIn();
      throw new Error('Please sign in with Google to add or update your schedule.');
    }

    // 1. Auto-create any detected or new subjects in Firestore if not already present
    const subjectsToEnsure: { name: string; code?: string; teacher?: string }[] = [];
    if (detectedNewSubjects && detectedNewSubjects.length > 0) {
      subjectsToEnsure.push(...detectedNewSubjects);
    }
    for (const c of classes) {
      const trimmed = c.subjectName?.trim();
      if (trimmed && !subjectsToEnsure.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
        subjectsToEnsure.push({ name: trimmed, teacher: c.teacher });
      }
    }

    if (subjectsToEnsure.length > 0) {
      for (const dSub of subjectsToEnsure) {
        const existing = subjects.find(
          (s) => s.name.toLowerCase() === dSub.name.toLowerCase()
        );
        if (!existing) {
          const newSubData: Omit<Subject, 'id'> = {
            name: dSub.name,
            code: dSub.code || dSub.name.slice(0, 4).toUpperCase() + '101',
            teacher: dSub.teacher || 'Faculty',
            totalClasses: 0,
            attendedClasses: 0,
            color: SUBJECT_COLOR_PALETTE[Math.floor(Math.random() * SUBJECT_COLOR_PALETTE.length)],
          };
          const newId = await saveSubject(effectiveUserId, newSubData);
          setSubjects((prev) => {
            if (prev.some((s) => s.name.toLowerCase() === dSub.name.toLowerCase())) return prev;
            return [...prev, { ...newSubData, id: newId }];
          });
        }
      }
    }

    // 2. Format attendance classes for the target date
    const existingDoc = attendanceDocs.find((d) => d.date === date);
    let newAttendanceClasses: AttendanceClass[] = [];

    // Track used existing class indices so each existing class is matched at most once.
    // This guarantees that Period 1 and Period 2 of the same subject maintain separate, independent attendance states.
    const usedExistingIndices = new Set<number>();

    newAttendanceClasses = classes.map((c, idx) => {
      // 1. If the class in `classes` has an explicit status passed (including null for newly added class or existing mark),
      // preserve it directly!
      let status: AttendanceStatus = c.status !== undefined ? c.status : null;
      let markedAt: string | null = (c as any).markedAt || (status ? new Date().toISOString() : null);
      let note: string = (c as any).note || '';

      // 2. Only if status is undefined (e.g. from an external raw schedule import), match against existingDoc
      if (c.status === undefined && existingDoc && existingDoc.classes.length > 0) {
        // First check exact index match if subject matches and has not been used
        if (
          existingDoc.classes[idx] &&
          !usedExistingIndices.has(idx) &&
          existingDoc.classes[idx].subjectName.toLowerCase() === c.subjectName.toLowerCase()
        ) {
          usedExistingIndices.add(idx);
          status = existingDoc.classes[idx].status;
          markedAt = existingDoc.classes[idx].markedAt || null;
          note = existingDoc.classes[idx].note || '';
        } else {
          // Otherwise find the first unused existing class with matching subject and time
          const matchIdx = existingDoc.classes.findIndex((ec, eIdx) => {
            if (usedExistingIndices.has(eIdx)) return false;
            const sameName = ec.subjectName.toLowerCase() === c.subjectName.toLowerCase();
            if (!sameName) return false;
            if (c.startTime && ec.startTime) {
              return ec.startTime === c.startTime;
            }
            return true;
          });
          if (matchIdx !== -1) {
            usedExistingIndices.add(matchIdx);
            status = existingDoc.classes[matchIdx].status;
            markedAt = existingDoc.classes[matchIdx].markedAt || null;
            note = existingDoc.classes[matchIdx].note || '';
          }
        }
      }

      return {
        subjectId: c.subjectId,
        subjectName: c.subjectName,
        startTime: c.startTime || '',
        endTime: c.endTime || '',
        room: c.room || '',
        status,
        markedAt,
        note,
      };
    });

    const updatedDoc: AttendanceDayDoc = {
      id: date,
      date,
      classes: newAttendanceClasses,
      updatedAt: new Date().toISOString(),
    };

    // 3. Save to Firestore
    await saveAttendanceDoc(effectiveUserId, updatedDoc);

    // 4. Update local state
    setAttendanceDocs((prev) => {
      const filtered = prev.filter((d) => d.date !== date);
      return [...filtered, updatedDoc];
    });

    // 5. Recalculate subject totals
    const nextDocs = attendanceDocs.filter((d) => d.date !== date).concat(updatedDoc);
    const updatedSubjects = recalculateAllSubjectTotals(subjects, nextDocs);
    setSubjects(updatedSubjects);
    for (const sub of updatedSubjects) {
      await saveSubject(effectiveUserId, sub);
    }

    const targetDateObj = parseISODate(date);
    const displayDate = targetDateObj.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const msg = `Fresh schedule for ${displayDate} saved with ${classes.length} classes!`;
    addToast(msg, 'success');
    return { message: msg };
  };

  // Clear single day schedule
  const handleClearDaySchedule = async (date: string): Promise<void> => {
    const updatedDoc: AttendanceDayDoc = {
      id: date,
      date,
      classes: [],
      updatedAt: new Date().toISOString(),
    };
    await saveAttendanceDoc(effectiveUserId, updatedDoc);
    setAttendanceDocs((prev) => {
      const filtered = prev.filter((d) => d.date !== date);
      return [...filtered, updatedDoc];
    });
    const nextDocs = attendanceDocs.filter((d) => d.date !== date).concat(updatedDoc);
    const updatedSubjects = recalculateAllSubjectTotals(subjects, nextDocs);
    for (const sub of updatedSubjects) {
      await saveSubject(effectiveUserId, sub);
    }
    addToast(`Cleared schedule for ${date}.`, 'info');
  };

  // Toggle Day Off for a specific date (only for working days; weekends are fixed in Settings)
  const handleToggleDayOff = async (date: string, reason?: string): Promise<void> => {
    const isWeekend = weekendDays.includes(parseISODate(date).getDay());
    if (isWeekend) {
      return; // Weekends are fixed recurring off-days configured in Settings
    }
    const existingDoc = attendanceDocs.find((d) => d.date === date);
    const willBeDayOff = !existingDoc?.isDayOff;

    let updatedClasses: AttendanceClass[] = existingDoc ? [...existingDoc.classes] : [];

    if (willBeDayOff) {
      // If marking as Day Off, set status of existing scheduled classes to 'cancelled' so they don't count against quota
      updatedClasses = updatedClasses.map((c) => ({
        ...c,
        status: 'cancelled',
        note: c.note || (reason ? `Day Off: ${reason}` : 'Day Off'),
      }));
    } else {
      // If unmarking Day Off, reset cancelled classes back to unmarked (null)
      updatedClasses = updatedClasses.map((c) => ({
        ...c,
        status: c.status === 'cancelled' ? null : c.status,
      }));
    }

    const updatedDoc: AttendanceDayDoc = {
      id: date,
      date,
      classes: updatedClasses,
      isDayOff: willBeDayOff,
      dayOffReason: willBeDayOff ? (reason || 'Day Off') : undefined,
      updatedAt: new Date().toISOString(),
    };

    // Optimistically update
    setAttendanceDocs((prev) => {
      const filtered = prev.filter((d) => d.date !== date);
      return [...filtered, updatedDoc];
    });

    try {
      await saveAttendanceDoc(effectiveUserId, updatedDoc);

      // Recalculate subject totals since cancelled classes are excluded
      const nextDocs = attendanceDocs.filter((d) => d.date !== date).concat(updatedDoc);
      const updatedSubjects = recalculateAllSubjectTotals(subjects, nextDocs);
      for (const sub of updatedSubjects) {
        await saveSubject(effectiveUserId, sub);
      }

      addToast(
        willBeDayOff ? `Marked ${date} as College Day Off (No classes in college)` : `Re-opened college for ${date}`,
        willBeDayOff ? 'success' : 'info'
      );
    } catch (err: any) {
      console.error('Failed to toggle Day Off:', err);
      addToast('Failed to update Day Off status.', 'error');
    }
  };

  // Apply Weekly Template to Custom Date Range (Feature 1C)
  const handleApplyTemplateToRange = async (
    rangeStart: string,
    rangeEnd: string
  ): Promise<{ message: string }> => {
    if (!isSignedIn) {
      handleGoogleSignIn();
      throw new Error('Please sign in with Google to apply schedule templates.');
    }

    if (timetables.length === 0) {
      throw new Error('Please create or upload a timetable first before applying a template.');
    }

    const template = timetables[0];
    const targetTimetable: Timetable = {
      ...template,
      weekStart: rangeStart,
      weekEnd: rangeEnd,
    };

    const { updatedDocs, summary } = generateAttendanceFromTimetable(
      targetTimetable,
      attendanceDocs
    );

    await batchSaveAttendanceDocs(effectiveUserId, updatedDocs);

    const updatedSubjects = recalculateAllSubjectTotals(subjects, updatedDocs);
    for (const sub of updatedSubjects) {
      await saveSubject(effectiveUserId, sub);
    }

    addToast(summary.message, 'success');
    return { message: summary.message };
  };

  // Subject Save & Delete
  const handleSaveSubject = async (subjectData: Partial<Subject>) => {
    await saveSubject(effectiveUserId, subjectData);
    addToast('Subject quota updated', 'success');
  };

  const handleDeleteSubject = async (subjectId: string) => {
    await deleteSubject(effectiveUserId, subjectId);
    addToast('Subject removed', 'info');
  };

  const handleRecalculateTotals = async () => {
    const updated = recalculateAllSubjectTotals(subjects, attendanceDocs);
    for (const sub of updated) {
      await saveSubject(effectiveUserId, sub);
    }
    addToast('All subject statistics recalculated', 'success');
  };

  // Clear All Data
  const handleClearAllData = async () => {
    try {
      await clearAllUserData(effectiveUserId);
      setSubjects([]);
      setTimetables([]);
      setAttendanceDocs([]);
      addToast('All attendance, schedule, and subject records cleared', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Failed to clear data', 'error');
    }
  };

  // Google Sign-In & Sign-Out
  const handleGoogleSignIn = async () => {
    try {
      const profile = await signInWithGoogleFirebase();
      if (profile) {
        setUser(profile);
        addToast(`Signed in as ${profile.name}`, 'success');
      }
    } catch (err: any) {
      addToast(err?.message || 'Google sign in cancelled', 'error');
    }
  };

  const handleSignOut = async () => {
    await signOutFirebase();
    localStorage.removeItem('attendzy_auth_user');
    localStorage.removeItem('attendease_student_profile');
    setUser(null);
    addToast('Signed out successfully', 'info');
  };

  const handleUpdateProfile = (updated: UserProfile) => {
    setUser(updated);
    try {
      localStorage.setItem('attendease_student_profile', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save student profile:', e);
    }
    addToast('Profile updated', 'success');
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-gray-900 flex flex-col selection:bg-gray-200 selection:text-gray-900">
      {/* Top and Mobile Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        isSignedIn={isSignedIn}
        onSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 pt-4 sm:pt-6 pb-24 md:pb-12">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {activeTab === 'dashboard' && (
              <DashboardView
                subjects={subjects}
                attendanceDocs={attendanceDocs}
                stats={stats}
                trend={trend}
                loading={loading}
                weekendDays={weekendDays}
                targetPercentage={targetPercentage}
                isSignedIn={isSignedIn}
                onSignIn={handleGoogleSignIn}
                onMarkAttendance={handleMarkAttendance}
                onMarkAllAttendance={handleMarkAllAttendance}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onSaveDailySchedule={handleSaveDailySchedule}
                onClearDaySchedule={handleClearDaySchedule}
                onToggleDayOff={handleToggleDayOff}
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarView
                attendanceDocs={attendanceDocs}
                subjects={subjects}
                weekendDays={weekendDays}
                isSignedIn={isSignedIn}
                onSignIn={handleGoogleSignIn}
                onMarkAttendance={handleMarkAttendance}
                onMarkAllAttendance={handleMarkAllAttendance}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onSaveDailySchedule={handleSaveDailySchedule}
                onClearDaySchedule={handleClearDaySchedule}
                onToggleDayOff={handleToggleDayOff}
              />
            )}

            {activeTab === 'timetable' && (
              <TimetableManagerView
                timetables={timetables}
                subjects={subjects}
                attendanceDocs={attendanceDocs}
                weekendDays={weekendDays}
                isSignedIn={isSignedIn}
                onSignIn={handleGoogleSignIn}
                onSaveDailySchedule={handleSaveDailySchedule}
                onClearDaySchedule={handleClearDaySchedule}
                onToggleDayOff={handleToggleDayOff}
                onMarkAttendance={handleMarkAttendance}
                onMarkAllAttendance={handleMarkAllAttendance}
              />
            )}

            {activeTab === 'subjects' && (
              <SubjectsView
                subjects={subjects}
                targetPercentage={targetPercentage}
                onSaveSubject={handleSaveSubject}
                onDeleteSubject={handleDeleteSubject}
                onRecalculateTotals={handleRecalculateTotals}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                user={user}
                subjects={subjects}
                attendanceDocs={attendanceDocs}
                timetables={timetables}
                weekendDays={weekendDays}
                targetPercentage={targetPercentage}
                onUpdateWeekendDays={handleUpdateWeekendDays}
                onUpdateTargetPercentage={handleUpdateTargetPercentage}
                onSignIn={handleGoogleSignIn}
                onSignOut={handleSignOut}
                onClearAllData={handleClearAllData}
                onUpdateUser={handleUpdateProfile}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
