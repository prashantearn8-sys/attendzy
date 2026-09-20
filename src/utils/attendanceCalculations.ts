import {
  Subject,
  Timetable,
  TimetableClass,
  AttendanceClass,
  AttendanceDayDoc,
  OverallAttendanceStats,
  AttendanceTrendPoint,
  WeekDayName,
  TimetableMergeSummary,
} from '../types/attendance';

export const WEEKDAYS: WeekDayName[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const SUBJECT_COLOR_PALETTE = [
  '#7C5CFC', // Indigo Accent
  '#3B82F6', // Blue
  '#10B981', // Emerald Green
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#14B8A6', // Teal
];

/**
 * Returns YYYY-MM-DD for a given Date or current local date
 */
export function formatDateToISO(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses YYYY-MM-DD string into a safe Date object in local time
 */
export function parseISODate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * Get the Monday and Sunday dates for the current or given week
 */
export function getCurrentWeekRange(referenceDate: Date = new Date()): { weekStart: string; weekEnd: string } {
  const d = new Date(referenceDate);
  const dayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday, ...
  const diffToMonday = (dayOfWeek + 6) % 7; // days since Monday

  const monday = new Date(d);
  monday.setDate(d.getDate() - diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    weekStart: formatDateToISO(monday),
    weekEnd: formatDateToISO(sunday),
  };
}

/**
 * Generates an array of YYYY-MM-DD strings between start and end inclusive
 */
export function getDateRange(weekStart: string, weekEnd: string): string[] {
  const dates: string[] = [];
  const current = parseISODate(weekStart);
  const end = parseISODate(weekEnd);

  // Safety cap of 60 days
  let count = 0;
  while (current <= end && count < 60) {
    dates.push(formatDateToISO(current));
    current.setDate(current.getDate() + 1);
    count++;
  }
  return dates;
}

/**
 * Maps a date string to lowercase weekday name: 'monday', 'tuesday', etc.
 */
export function getDayName(dateStr: string): WeekDayName | null {
  const d = parseISODate(dateStr);
  const day = d.getDay();
  switch (day) {
    case 1:
      return 'monday';
    case 2:
      return 'tuesday';
    case 3:
      return 'wednesday';
    case 4:
      return 'thursday';
    case 5:
      return 'friday';
    case 6:
      return 'saturday';
    default:
      return null; // Sunday is skipped for standard weekday classes
  }
}

/**
 * Formats a weekday name for display: 'monday' -> 'Monday'
 */
export function formatDayTitle(dayName: string): string {
  return dayName.charAt(0).toUpperCase() + dayName.slice(1);
}

/**
 * Checks if a class in attendance/timetable matches a course subject
 */
export function matchesSubject(
  c: { subjectId?: string; subjectName?: string } | null | undefined,
  s: Subject | null | undefined
): boolean {
  if (!c || !s) return false;
  if (c.subjectId && s.id && c.subjectId === s.id) return true;
  if (c.subjectName && s.name && c.subjectName.trim().toLowerCase() === s.name.trim().toLowerCase()) return true;
  if (c.subjectId && s.name) {
    const slugFromId = c.subjectId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const slugFromName = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (slugFromId && slugFromId === slugFromName) return true;
  }
  if (c.subjectId && s.code && c.subjectId.toLowerCase() === s.code.toLowerCase()) return true;
  return false;
}

/**
 * Overall attendance calculation from subjects array and attendance docs
 */
export function calculateOverallAttendance(
  subjects: Subject[] = [],
  attendanceDocs: AttendanceDayDoc[] = []
): OverallAttendanceStats {
  // 1. Tally from subjects
  const subjectTotal = subjects.reduce((sum, s) => sum + (Number(s.totalClasses) || 0), 0);
  const subjectAttended = subjects.reduce((sum, s) => sum + (Number(s.attendedClasses) || 0), 0);

  // 2. Tally directly from attendance documents (marked classes)
  let docTotal = 0;
  let docAttended = 0;
  for (const doc of attendanceDocs) {
    if (doc.isDayOff) continue;
    for (const c of doc.classes || []) {
      if (c.status === 'present' || c.status === 'late') {
        docTotal++;
        docAttended++;
      } else if (c.status === 'absent') {
        docTotal++;
      }
    }
  }

  // Use the most comprehensive and up-to-date counts:
  // If subjects have higher historical baseline counts, honor them; otherwise honor doc counts
  const totalClasses = Math.max(subjectTotal, docTotal);
  const totalAttended = subjectTotal >= docTotal && subjectTotal > 0 ? subjectAttended : docAttended;
  const totalAbsent = Math.max(0, totalClasses - totalAttended);
  const percentage = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 0;

  return {
    percentage,
    totalClasses,
    totalAttended,
    totalAbsent,
  };
}

/**
 * Calculates subject-specific attendance percentage
 */
export function calculateSubjectAttendance(subject: Subject): number {
  const total = Number(subject.totalClasses) || 0;
  const attended = Number(subject.attendedClasses) || 0;
  return total > 0 ? Math.round((attended / total) * 100) : 0;
}

/**
 * Trend points for cumulative attendance line chart from day 1 to today
 */
export function getAttendanceTrend(
  attendanceDocs: AttendanceDayDoc[],
  subjects: Subject[] = []
): AttendanceTrendPoint[] {
  if (!attendanceDocs || attendanceDocs.length === 0) {
    // If no past docs yet, create an initial baseline from subjects if total > 0
    const totalClasses = subjects.reduce((sum, s) => sum + (Number(s.totalClasses) || 0), 0);
    const totalAttended = subjects.reduce((sum, s) => sum + (Number(s.attendedClasses) || 0), 0);
    if (totalClasses > 0) {
      return [
        {
          date: formatDateToISO(),
          displayDate: 'Today',
          percentage: Math.round((totalAttended / totalClasses) * 100),
          totalClasses,
          attended: totalAttended,
        },
      ];
    }
    return [];
  }

  // Sort by date ascending
  const sorted = [...attendanceDocs].sort((a, b) => a.date.localeCompare(b.date));

  let cumulativeTotal = 0;
  let cumulativeAttended = 0;
  const points: AttendanceTrendPoint[] = [];

  for (const doc of sorted) {
    let dayHadMarkedClasses = false;
    for (const c of doc.classes) {
      if (c.status !== null && c.status !== 'cancelled') {
        cumulativeTotal++;
        dayHadMarkedClasses = true;
        if (c.status === 'present' || c.status === 'late') {
          cumulativeAttended++;
        }
      }
    }

    if (dayHadMarkedClasses || points.length === 0) {
      const pct = cumulativeTotal > 0 ? Math.round((cumulativeAttended / cumulativeTotal) * 100) : 0;
      const d = parseISODate(doc.date);
      const displayDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      points.push({
        date: doc.date,
        displayDate,
        percentage: pct,
        totalClasses: cumulativeTotal,
        attended: cumulativeAttended,
      });
    }
  }

  // If there are subject totals from initial import but no individual doc marks, provide the baseline
  if (points.length === 0) {
    const totalClasses = subjects.reduce((sum, s) => sum + (Number(s.totalClasses) || 0), 0);
    const totalAttended = subjects.reduce((sum, s) => sum + (Number(s.attendedClasses) || 0), 0);
    if (totalClasses > 0) {
      points.push({
        date: formatDateToISO(),
        displayDate: 'Current',
        percentage: Math.round((totalAttended / totalClasses) * 100),
        totalClasses,
        attended: totalAttended,
      });
    }
  }

  return points;
}

/**
 * Merges newly scheduled classes into existing day's classes
 * Keeps existing marked items untouched, adds newly scheduled ones
 */
export function mergeClasses(
  existingClasses: AttendanceClass[],
  newScheduledClasses: TimetableClass[]
): AttendanceClass[] {
  const merged: AttendanceClass[] = [...existingClasses];

  for (let i = 0; i < newScheduledClasses.length; i++) {
    const newClass = newScheduledClasses[i];
    let exists = false;
    if (newClass.startTime) {
      exists = merged.some(
        (c) =>
          c.startTime === newClass.startTime &&
          (c.subjectId === newClass.subjectId || c.subjectName.toLowerCase() === newClass.subjectName.toLowerCase())
      );
    } else {
      // If no explicit startTime, count how many occurrences of this subject are already in merged vs scheduled
      const targetName = newClass.subjectName.toLowerCase();
      const countInMerged = merged.filter((c) => c.subjectName.toLowerCase() === targetName).length;
      const countInScheduledUpToHere = newScheduledClasses
        .slice(0, i + 1)
        .filter((c) => c.subjectName.toLowerCase() === targetName).length;
      exists = countInMerged >= countInScheduledUpToHere;
    }

    if (!exists) {
      merged.push({
        subjectId: newClass.subjectId,
        subjectName: newClass.subjectName,
        startTime: newClass.startTime,
        endTime: newClass.endTime,
        room: newClass.room || '',
        status: null,
        markedAt: null,
        note: '',
      });
    }
  }

  return merged;
}

/**
 * Feature 2 & 5: Generate attendance docs from a timetable, respecting past marks
 */
export function generateAttendanceFromTimetable(
  timetable: Timetable,
  existingAttendanceDocs: AttendanceDayDoc[] = []
): { updatedDocs: AttendanceDayDoc[]; summary: TimetableMergeSummary } {
  const dates = getDateRange(timetable.weekStart, timetable.weekEnd);
  const updatedDocs: AttendanceDayDoc[] = [];
  const todayStr = formatDateToISO();

  let added = 0;
  let removed = 0;
  let unchanged = 0;

  for (const date of dates) {
    const dayName = getDayName(date);
    if (!dayName) continue;

    const scheduledClasses = timetable.days[dayName] || [];
    if (scheduledClasses.length === 0) continue;

    const existing = existingAttendanceDocs.find((a) => a.date === date);

    if (existing && existing.classes && existing.classes.some((c) => c.status !== null)) {
      // Day has marked attendance: keep marked attendance, append new classes
      const originalCount = existing.classes.length;
      const merged = mergeClasses(existing.classes, scheduledClasses);
      const diff = merged.length - originalCount;
      if (diff > 0) added += diff;
      unchanged += originalCount;

      updatedDocs.push({
        id: date,
        date,
        classes: merged,
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Fresh attendance doc or future day
      const isFutureOrToday = date >= todayStr;
      if (existing) {
        if (isFutureOrToday) {
          // In the future: overwrite with new schedule
          const diff = scheduledClasses.length - existing.classes.length;
          if (diff > 0) added += diff;
          else if (diff < 0) removed += Math.abs(diff);
          else unchanged += scheduledClasses.length;
        } else {
          unchanged += existing.classes.length;
        }
      } else {
        added += scheduledClasses.length;
      }

      updatedDocs.push({
        id: date,
        date,
        classes: scheduledClasses.map((c) => ({
          subjectId: c.subjectId,
          subjectName: c.subjectName,
          startTime: c.startTime,
          endTime: c.endTime,
          room: c.room || '',
          status: null,
          markedAt: null,
          note: '',
        })),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  const summary: TimetableMergeSummary = {
    added,
    removed,
    unchanged,
    message: `${added} classes added, ${removed} removed, ${unchanged} unchanged.`,
  };

  return { updatedDocs, summary };
}

/**
 * Recalculate subject totals from all attendance documents
 */
export function recalculateAllSubjectTotals(
  subjects: Subject[],
  allAttendanceDocs: AttendanceDayDoc[]
): Subject[] {
  // Count totals per subject id
  const counts: Record<string, { total: number; attended: number }> = {};
  subjects.forEach((s) => {
    counts[s.id] = { total: 0, attended: 0 };
  });

  for (const doc of allAttendanceDocs) {
    if (doc.isDayOff) continue;
    for (const c of doc.classes || []) {
      if (c.status !== null && c.status !== 'cancelled') {
        const matched = subjects.find((s) => matchesSubject(c, s));
        const key = matched ? matched.id : c.subjectId;
        if (!counts[key]) {
          counts[key] = { total: 0, attended: 0 };
        }
        counts[key].total++;
        if (c.status === 'present' || c.status === 'late') {
          counts[key].attended++;
        }
      }
    }
  }

  return subjects.map((s) => {
    const data = counts[s.id];
    if (data !== undefined) {
      return {
        ...s,
        totalClasses: data.total,
        attendedClasses: data.attended,
      };
    }
    return s;
  });
}

/* =========================================================================
   WEEKEND CONFIGURATION HELPERS
   ========================================================================= */

export const DEFAULT_WEEKEND_DAYS: number[] = [0, 6]; // Sunday (0) & Saturday (6)

export interface DayOfWeekOption {
  dayIndex: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  label: string;
  short: string;
}

export const WEEK_DAYS_LIST: DayOfWeekOption[] = [
  { dayIndex: 1, label: 'Monday', short: 'Mon' },
  { dayIndex: 2, label: 'Tuesday', short: 'Tue' },
  { dayIndex: 3, label: 'Wednesday', short: 'Wed' },
  { dayIndex: 4, label: 'Thursday', short: 'Thu' },
  { dayIndex: 5, label: 'Friday', short: 'Fri' },
  { dayIndex: 6, label: 'Saturday', short: 'Sat' },
  { dayIndex: 0, label: 'Sunday', short: 'Sun' },
];

export function isDateWeekend(
  dateStrOrDate: string | Date,
  weekendDays: number[] = DEFAULT_WEEKEND_DAYS
): boolean {
  const d = typeof dateStrOrDate === 'string' ? parseISODate(dateStrOrDate) : dateStrOrDate;
  return weekendDays.includes(d.getDay());
}

export function formatWeekendSummary(weekendDays: number[]): string {
  if (!weekendDays || weekendDays.length === 0) return 'No weekend days (7-day week)';
  const names = WEEK_DAYS_LIST.filter((d) => weekendDays.includes(d.dayIndex)).map((d) => d.label);
  return names.join(', ');
}

/* =========================================================================
   TARGET ATTENDANCE HELPERS
   ========================================================================= */

export const DEFAULT_TARGET_PERCENTAGE = 75;

export interface AttendanceQuotaStatus {
  isSafe: boolean;
  count: number;
  message: string;
}

/**
 * Calculates how many classes a student can safely miss, or how many
 * consecutive classes they need to attend to reach their target percentage.
 */
export function calculateSafeBunksOrNeeded(
  attended: number,
  total: number,
  target: number = DEFAULT_TARGET_PERCENTAGE
): AttendanceQuotaStatus {
  if (total === 0) {
    return {
      isSafe: true,
      count: 0,
      message: 'No classes held yet',
    };
  }

  const currentPct = (attended / total) * 100;
  const targetFraction = Math.min(0.99, Math.max(0.01, target / 100));

  if (currentPct >= target) {
    // Current attendance meets or exceeds target -> calculate safe bunks
    // Formula: (attended) / (total + x) >= targetFraction => x <= (attended - targetFraction * total) / targetFraction
    const safeBunks = Math.floor((attended - targetFraction * total) / targetFraction);
    return {
      isSafe: true,
      count: Math.max(0, safeBunks),
      message:
        safeBunks > 0
          ? `Can safely miss ${safeBunks} class${safeBunks !== 1 ? 'es' : ''}`
          : 'On target — do not miss next class',
    };
  } else {
    // Current attendance is below target -> calculate classes needed to attend
    // Formula: (attended + y) / (total + y) >= targetFraction => y >= (targetFraction * total - attended) / (1 - targetFraction)
    const needed = Math.ceil((targetFraction * total - attended) / (1 - targetFraction));
    return {
      isSafe: false,
      count: Math.max(1, needed),
      message: `Attend next ${needed} class${needed !== 1 ? 'es' : ''} to reach ${target}%`,
    };
  }
}


