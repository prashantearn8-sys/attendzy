export type AttendanceStatus = 'present' | 'absent' | 'late' | 'cancelled' | null;

export interface Subject {
  id: string;
  name: string;
  code: string;
  teacher: string;
  totalClasses: number;
  attendedClasses: number;
  color: string;
  createdAt?: string;
}

export interface TimetableClass {
  subjectId: string;
  subjectName: string;
  startTime: string; // "09:00"
  endTime: string;   // "10:00"
  room: string;      // "301"
  teacher?: string;
  status?: AttendanceStatus;
}

export type WeekDayName = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

export interface TimetableDays {
  monday: TimetableClass[];
  tuesday: TimetableClass[];
  wednesday: TimetableClass[];
  thursday: TimetableClass[];
  friday: TimetableClass[];
  saturday: TimetableClass[];
}

export interface Timetable {
  id: string;
  name: string;
  section?: string;
  imageUrl?: string;
  uploadedAt?: string;
  weekStart: string; // "YYYY-MM-DD"
  weekEnd: string;   // "YYYY-MM-DD"
  days: TimetableDays;
}

export interface AttendanceClass {
  subjectId: string;
  subjectName: string;
  startTime: string;
  endTime: string;
  status: AttendanceStatus;
  markedAt?: string | null;
  note?: string;
  room?: string;
}

export interface AttendanceDayDoc {
  id: string; // date YYYY-MM-DD
  date: string;
  classes: AttendanceClass[];
  isDayOff?: boolean;
  dayOffReason?: string;
  updatedAt?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: 'student' | 'teacher' | 'admin';
  weekendDays?: number[]; // [0, 6] for Sat & Sun, [0] for Sun, etc. (0 = Sunday, 6 = Saturday)
  targetPercentage?: number; // e.g. 75, 80, 85
  createdAt?: string;
}

export interface OverallAttendanceStats {
  percentage: number;
  totalClasses: number;
  totalAttended: number;
  totalAbsent: number;
}

export interface AttendanceTrendPoint {
  date: string;
  displayDate: string;
  percentage: number;
  totalClasses: number;
  attended: number;
}

export interface TimetableMergeSummary {
  added: number;
  removed: number;
  unchanged: number;
  message: string;
}
