import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Subject,
  AttendanceDayDoc,
  AttendanceClass,
  AttendanceStatus,
  OverallAttendanceStats,
  AttendanceTrendPoint,
} from '../types/attendance';
import {
  formatDateToISO,
  parseISODate,
  calculateSubjectAttendance,
  calculateSafeBunksOrNeeded,
} from '../utils/attendanceCalculations';
import {
  Check,
  CheckCheck,
  X as XIcon,
  XCircle,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Calendar,
  TrendingUp,
  Award,
  ChevronRight,
  MessageSquare,
  Sparkles,
  Plus,
  Trash2,
  Coffee,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { TimetableClass } from '../types/attendance';

interface DashboardViewProps {
  subjects: Subject[];
  attendanceDocs: AttendanceDayDoc[];
  stats: OverallAttendanceStats;
  trend: AttendanceTrendPoint[];
  loading: boolean;
  weekendDays?: number[];
  targetPercentage?: number;
  isSignedIn?: boolean;
  onSignIn?: () => void;
  onMarkAttendance: (date: string, classIndex: number, status: AttendanceStatus, note?: string) => Promise<void>;
  onMarkAllAttendance?: (date: string, status: AttendanceStatus) => Promise<void>;
  onNavigateTab: (tab: 'calendar' | 'timetable' | 'subjects') => void;
  onSaveDailySchedule?: (
    date: string,
    classes: TimetableClass[],
    detectedSubjects?: { name: string; code?: string; teacher?: string }[]
  ) => Promise<{ message: string }>;
  onClearDaySchedule?: (date: string) => Promise<void>;
  onToggleDayOff?: (date: string, reason?: string) => Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  subjects,
  attendanceDocs,
  stats,
  trend,
  loading,
  weekendDays = [0, 6],
  targetPercentage = 75,
  isSignedIn = false,
  onSignIn,
  onMarkAttendance,
  onMarkAllAttendance,
  onNavigateTab,
  onSaveDailySchedule,
  onClearDaySchedule,
  onToggleDayOff,
}) => {
  const todayStr = formatDateToISO();
  const todayDoc = attendanceDocs.find((d) => d.date === todayStr);
  const todayClasses = todayDoc?.classes || [];
  const isTodayWeekend = weekendDays.includes(new Date().getDay());
  const isTodayDayOff = !isTodayWeekend && Boolean(todayDoc?.isDayOff);

  const [activeNoteIndex, setActiveNoteIndex] = useState<number | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [markingIndex, setMarkingIndex] = useState<number | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isConfirmingClearToday, setIsConfirmingClearToday] = useState(false);

  const handleBatchMark = async (status: AttendanceStatus) => {
    if (!onMarkAllAttendance || todayClasses.length === 0) return;
    setIsMarkingAll(true);
    try {
      await onMarkAllAttendance(todayStr, status);
    } finally {
      setIsMarkingAll(false);
    }
  };

  // Filter for today's classes: default to 'remaining' so only unmarked classes are shown on home tab
  const [classFilter, setClassFilter] = useState<'remaining' | 'completed' | 'all'>('remaining');

  // Attach original array index so marking updates the exact Firestore record index
  const classesWithMeta = useMemo(() => {
    return todayClasses.map((item, originalIndex) => ({
      ...item,
      originalIndex,
    }));
  }, [todayClasses]);

  const remainingClasses = useMemo(() => {
    return classesWithMeta.filter((item) => item.status === null);
  }, [classesWithMeta]);

  const completedClasses = useMemo(() => {
    return classesWithMeta.filter((item) => item.status !== null);
  }, [classesWithMeta]);

  const displayedClasses = useMemo(() => {
    if (classFilter === 'remaining') return remainingClasses;
    if (classFilter === 'completed') return completedClasses;
    return classesWithMeta;
  }, [classFilter, remainingClasses, completedClasses, classesWithMeta]);

  const handleToggleStatus = async (originalClassIndex: number, newStatus: AttendanceStatus) => {
    const currentClass = todayClasses[originalClassIndex];
    if (!currentClass) return;
    // If clicking an already selected status in completed or all view, unmark it back to null
    const finalStatus = currentClass.status === newStatus ? null : newStatus;
    setMarkingIndex(originalClassIndex);
    try {
      await onMarkAttendance(todayStr, originalClassIndex, finalStatus);
    } finally {
      setMarkingIndex(null);
    }
  };

  const handleSaveNote = async (originalClassIndex: number) => {
    const currentClass = todayClasses[originalClassIndex];
    if (!currentClass) return;
    await onMarkAttendance(todayStr, originalClassIndex, currentClass.status, noteInput);
    setActiveNoteIndex(null);
    setNoteInput('');
  };

  const formattedToday = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  if (loading) {
    return (
      <div id="dashboard-skeleton" className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-gray-200 shadow-sm" />
          ))}
        </div>
        <div className="h-64 bg-white rounded-2xl border border-gray-200 shadow-sm" />
        <div className="h-80 bg-white rounded-2xl border border-gray-200 shadow-sm" />
      </div>
    );
  }

  return (
    <div id="dashboard-view" className="space-y-8 pb-12">
      {/* Hero Welcome Bar */}
      <div className="pb-2 border-b border-gray-100">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100/80 border border-gray-200/70 text-xs text-gray-700 font-medium shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-gray-500" />
            <span>{formattedToday}</span>
            <span className="w-1 h-1 rounded-full bg-emerald-500" />
            <span className="text-gray-500 font-normal">Active Semester</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            Attendance Overview
          </h1>
          <p className="text-xs sm:text-sm text-gray-500">
            Real-time semester attendance metrics, subject quotas, and daily class log.
          </p>
        </div>
      </div>

      {/* TOP STATS CARDS: 3 BALANCED CARDS SIDE-BY-SIDE ON ALL SCREENS */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {/* 1. Overall Percentage Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl p-2.5 sm:p-5 flex flex-col justify-between shadow-2xs hover:border-gray-300 transition-colors"
        >
          <div className="flex items-center justify-between text-gray-500 gap-1">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate">
              <span className="hidden sm:inline">Overall Rate</span>
              <span className="sm:hidden">Overall</span>
            </span>
            <span
              className={`text-[9px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full shrink-0 ${
                stats.percentage >= targetPercentage
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {stats.percentage >= targetPercentage ? 'Safe' : 'Short'}
            </span>
          </div>

          <div className="flex items-center justify-between mt-2 sm:mt-3 gap-1">
            <div className="min-w-0">
              <div className="text-lg xs:text-xl sm:text-3xl font-bold text-gray-900 font-mono-numbers leading-tight">
                {stats.percentage}%
              </div>
              <p className="text-[9px] sm:text-[11px] text-gray-500 mt-0.5 truncate">
                Goal: {targetPercentage}%
              </p>
            </div>

            {/* Circular Progress Ring */}
            <div className="relative w-8 h-8 sm:w-13 sm:h-13 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#F3F4F6"
                  strokeWidth="3.6"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={stats.percentage >= targetPercentage ? '#10B981' : '#F43F5E'}
                  strokeWidth="3.6"
                  strokeDasharray={`${Math.min(100, Math.max(0, stats.percentage))}, 100`}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Award className={`w-3 h-3 sm:w-4 sm:h-4 ${stats.percentage >= targetPercentage ? 'text-emerald-600' : 'text-rose-600'}`} />
              </div>
            </div>
          </div>
        </motion.div>

        {/* 2. Total Classes Held */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl p-2.5 sm:p-5 flex flex-col justify-between shadow-2xs hover:border-gray-300 transition-colors"
        >
          <div className="flex items-center justify-between text-gray-500 gap-1">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate">
              <span className="hidden sm:inline">Classes Held</span>
              <span className="sm:hidden">Held</span>
            </span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 shrink-0">
              <BookOpen className="w-3 h-3 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-lg xs:text-xl sm:text-3xl font-bold text-gray-900 font-mono-numbers leading-tight">
              {stats.totalClasses}
            </div>
            <p className="text-[9px] sm:text-[11px] text-gray-500 mt-0.5 truncate">
              <span className="hidden sm:inline">Total conducted</span>
              <span className="sm:hidden">Conducted</span>
            </p>
          </div>
        </motion.div>

        {/* 3. Classes Attended */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl p-2.5 sm:p-5 flex flex-col justify-between shadow-2xs hover:border-gray-300 transition-colors"
        >
          <div className="flex items-center justify-between text-gray-500 gap-1">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate">
              Attended
            </span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-lg xs:text-xl sm:text-3xl font-bold text-emerald-600 font-mono-numbers leading-tight">
              {stats.totalAttended}
            </div>
            <p className="text-[9px] sm:text-[11px] text-gray-500 mt-0.5 truncate">
              {stats.totalClasses === 0
                ? 'No classes'
                : `${stats.percentage}% rate`}
            </p>
          </div>
        </motion.div>
      </div>

      {/* TODAY'S CLASSES SECTION WITH INSTANT TOGGLE MARKING */}
      <section id="today-classes-section" className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                remainingClasses.length > 0
                  ? 'bg-emerald-600 animate-pulse'
                  : todayClasses.length > 0
                  ? 'bg-emerald-500'
                  : 'bg-gray-400'
              }`}
            />
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Today's Classes</h2>
            {todayClasses.length > 0 && (
              <span className="text-xs font-semibold text-gray-700 px-2.5 py-0.5 rounded-md bg-gray-100 border border-gray-200">
                {remainingClasses.length > 0
                  ? `${remainingClasses.length} Remaining`
                  : 'All Marked ✓'}
              </span>
            )}
            {isTodayWeekend ? (
              <span className="text-xs font-semibold text-amber-800 px-2.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-amber-600" />
                Weekend Off
              </span>
            ) : isTodayDayOff ? (
              <span className="text-xs font-bold text-amber-900 px-2.5 py-0.5 rounded-md bg-amber-100 border border-amber-300 flex items-center gap-1">
                <Coffee className="w-3 h-3 text-amber-700" />
                Day Off
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter pills: Remaining (Default) | Marked | All */}
            {todayClasses.length > 0 && !isTodayDayOff && !isTodayWeekend && (
              <div className="inline-flex items-center p-0.5 bg-gray-100/90 rounded-xl border border-gray-200 text-xs font-semibold">
                <button
                  id="tab-filter-remaining"
                  onClick={() => setClassFilter('remaining')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    classFilter === 'remaining'
                      ? 'bg-white text-gray-900 shadow-2xs font-bold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  title="Show only remaining unmarked classes"
                >
                  <span>Remaining</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      classFilter === 'remaining'
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {remainingClasses.length}
                  </span>
                </button>

                <button
                  id="tab-filter-completed"
                  onClick={() => setClassFilter('completed')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    classFilter === 'completed'
                      ? 'bg-white text-gray-900 shadow-2xs font-bold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  title="Show marked classes"
                >
                  <span>Marked</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      classFilter === 'completed'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {completedClasses.length}
                  </span>
                </button>

                <button
                  id="tab-filter-all"
                  onClick={() => setClassFilter('all')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    classFilter === 'all'
                      ? 'bg-white text-gray-900 shadow-2xs font-bold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  title="Show all scheduled classes"
                >
                  <span>All</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      classFilter === 'all'
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {todayClasses.length}
                  </span>
                </button>
              </div>
            )}

            {/* Day Off toggle is only for working days. Weekends are fixed in Settings */}
            {!isTodayWeekend && onToggleDayOff && (
              <button
                id="btn-today-day-off"
                onClick={() => onToggleDayOff(todayStr)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-[0.97] ${
                  isTodayDayOff
                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs ring-1 ring-amber-600'
                    : 'bg-white border border-gray-200 hover:bg-amber-50 text-gray-700 hover:text-amber-800'
                }`}
                title={isTodayDayOff ? "Remove Day Off (re-open classes)" : "Mark today as Day Off"}
              >
                <Coffee className="w-3.5 h-3.5 text-amber-500" />
                <span>{isTodayDayOff ? 'Day Off ✓' : 'Mark Day Off'}</span>
              </button>
            )}

            {/* When Day Off is marked (college closed), hide Upload Schedule and Add Class buttons */}
            {!isTodayDayOff && (
              <>
                <button
                  id="btn-today-upload-schedule"
                  onClick={() => {
                    if (!isSignedIn && onSignIn) {
                      onSignIn();
                    }
                    onNavigateTab('timetable');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                  title="Open Schedule to upload or manage"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Upload Schedule</span>
                </button>
                <button
                  id="btn-today-add-class"
                  onClick={() => {
                    if (!isSignedIn && onSignIn) {
                      onSignIn();
                    }
                    onNavigateTab('timetable');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Manage Schedule"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Add Class</span>
                </button>
              </>
            )}
            {todayClasses.length > 0 && onClearDaySchedule && (
              <div>
                {isConfirmingClearToday ? (
                  <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-xl">
                    <span className="text-xs text-rose-700 font-bold">Clear?</span>
                    <button
                      onClick={async () => {
                        await onClearDaySchedule(todayStr);
                        setIsConfirmingClearToday(false);
                      }}
                      className="px-2 py-0.5 rounded bg-rose-600 text-white text-xs font-bold"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setIsConfirmingClearToday(false)}
                      className="px-1.5 py-0.5 text-xs text-gray-500"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsConfirmingClearToday(true)}
                    className="p-1.5 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                    title="Clear today's classes"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Day Off Indicator Banner */}
        <AnimatePresence>
          {isTodayDayOff && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Coffee className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-950">Today is marked as Day Off</h4>
                  <p className="text-[11px] text-amber-800">
                    Classes for today are excused and will not count against your attendance target.
                  </p>
                </div>
              </div>
              {onToggleDayOff && (
                <button
                  onClick={() => onToggleDayOff(todayStr)}
                  className="px-2.5 py-1 text-xs font-semibold text-amber-900 bg-white/80 hover:bg-white rounded-lg border border-amber-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Batch Attendance Bar: Present All & Absent All */}
        {todayClasses.length > 0 && !isTodayDayOff && !isTodayWeekend && onMarkAllAttendance && (
          <div className="flex items-center justify-between gap-3 p-3 bg-gradient-to-r from-gray-50 via-white to-gray-50 border border-gray-200/90 rounded-2xl shadow-2xs flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-gray-900 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                ⚡
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900 leading-tight">Quick Attendance</p>
                <p className="text-[11px] text-gray-500 leading-tight">
                  Mark all {todayClasses.length} {todayClasses.length === 1 ? 'class' : 'classes'} in one click
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-present-all-today"
                onClick={() => handleBatchMark('present')}
                disabled={isMarkingAll}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                title="Mark all today's classes as Present"
              >
                <CheckCheck className="w-4 h-4" />
                <span>{isMarkingAll ? 'Marking...' : 'Present All'}</span>
              </button>

              <button
                id="btn-absent-all-today"
                onClick={() => handleBatchMark('absent')}
                disabled={isMarkingAll}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.97] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                title="Mark all today's classes as Absent"
              >
                <XCircle className="w-4 h-4" />
                <span>{isMarkingAll ? 'Marking...' : 'Absent All'}</span>
              </button>
            </div>
          </div>
        )}

        {todayClasses.length === 0 ? (
          <div
            id="today-empty-state"
            className="bg-white border border-gray-200 rounded-2xl p-8 text-center space-y-4 shadow-sm"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${isTodayWeekend ? 'bg-amber-50 text-amber-700' : isTodayDayOff ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>
              {isTodayWeekend ? <Calendar className="w-6 h-6" /> : isTodayDayOff ? <Coffee className="w-6 h-6" /> : <Calendar className="w-6 h-6" />}
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-gray-900">
                {isTodayWeekend
                  ? "Weekend Off — Rest & Recharge"
                  : isTodayDayOff
                  ? "College Day Off — No Classes Today"
                  : "No classes scheduled for today"}
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
                {isTodayWeekend
                  ? "Today is a scheduled weekend off. Weekends are fixed recurring off-days managed in Profile & Settings."
                  : isTodayDayOff
                  ? "Today is marked as an ad-hoc Day Off. Classes are excused and your attendance target is unaffected."
                  : "Upload today's timetable image or manage your weekly schedule."}
              </p>
            </div>
            {!isTodayWeekend && (
              <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                {!isTodayDayOff && (
                  <button
                    id="btn-today-go-schedule"
                    onClick={() => onNavigateTab('timetable')}
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-gray-900 text-white text-xs sm:text-sm font-semibold hover:bg-black transition-transform active:scale-[0.97] shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Go to Schedule</span>
                  </button>
                )}
                {/* Day Off toggle is only for working days (non-weekends) */}
                {onToggleDayOff && (
                  <button
                    id="btn-today-empty-day-off"
                    onClick={() => onToggleDayOff(todayStr)}
                    className={`min-h-[42px] px-4 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-colors shadow-2xs inline-flex items-center gap-2 cursor-pointer ${
                      isTodayDayOff
                        ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-sm'
                        : 'bg-white hover:bg-amber-50 text-gray-700 hover:text-amber-800 border-gray-200 hover:border-amber-300'
                    }`}
                  >
                    <Coffee className="w-4 h-4 text-amber-500" />
                    <span>{isTodayDayOff ? 'Day Off ✓ (Remove)' : 'Mark as Day Off'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : classFilter === 'remaining' && remainingClasses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            id="today-completed-all-state"
            className="bg-white border border-emerald-200/90 rounded-2xl p-7 sm:p-9 text-center space-y-4 shadow-sm bg-gradient-to-b from-emerald-50/40 via-white to-white"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-2xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">
                All classes marked for today!
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto">
                You've marked all {todayClasses.length} classes scheduled for today ({completedClasses.filter((c) => c.status === 'present').length} Present, {completedClasses.filter((c) => c.status === 'absent').length} Missed).
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-1 flex-wrap">
              <button
                id="btn-view-marked-today"
                onClick={() => setClassFilter('completed')}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-xs sm:text-sm font-semibold transition-transform active:scale-[0.97] shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>View Marked Classes ({completedClasses.length})</span>
              </button>
              <button
                id="btn-view-calendar-today"
                onClick={() => onNavigateTab('calendar')}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-semibold transition-colors shadow-2xs flex items-center gap-2 cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-gray-500" />
                <span>Calendar Log</span>
              </button>
            </div>
          </motion.div>
        ) : classFilter === 'completed' && completedClasses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            id="today-no-completed-state"
            className="bg-white border border-gray-200 rounded-2xl p-8 text-center space-y-3 shadow-sm"
          >
            <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-500 flex items-center justify-center mx-auto">
              <Clock3 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900">
                No classes marked yet
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto">
                You haven't marked any classes for today yet.
              </p>
            </div>
            <div className="pt-1">
              <button
                id="btn-switch-to-remaining"
                onClick={() => setClassFilter('remaining')}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-xs sm:text-sm font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                Show Remaining Classes ({remainingClasses.length})
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <AnimatePresence mode="popLayout">
              {displayedClasses.map((item) => {
                const isPresent = item.status === 'present';
                const isAbsent = item.status === 'absent';
                const isPending = item.status === null;

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.18 } }}
                    transition={{ duration: 0.2 }}
                    key={`today-class-${item.originalIndex}`}
                    id={`today-class-${item.originalIndex}`}
                    className={`p-4 rounded-2xl border transition-colors duration-200 shadow-sm ${
                      isPresent
                        ? 'border-emerald-300 bg-emerald-50/40'
                        : isAbsent
                        ? 'border-rose-300 bg-rose-50/40'
                        : 'border-gray-200 bg-white hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-base">{item.subjectName}</span>
                          {item.room && (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                              {item.room}
                            </span>
                          )}
                        </div>
                        {item.startTime || item.endTime ? (
                          <div className="flex items-center gap-2 text-xs text-gray-500 font-mono-numbers">
                            <Clock3 className="w-3.5 h-3.5 text-gray-400" />
                            <span>
                              {item.startTime}{item.endTime ? ` - ${item.endTime}` : ''}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            <span>Period #{item.originalIndex + 1}</span>
                          </div>
                        )}
                        {item.note && (
                          <p className="text-xs text-gray-600 italic mt-1 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                            "{item.note}"
                          </p>
                        )}
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0">
                        {isPresent && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Present
                          </span>
                        )}
                        {isAbsent && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                            <XIcon className="w-3 h-3" /> Absent
                          </span>
                        )}
                        {isPending && (
                          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                            Unmarked
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Toggle Marking Options: Present | Absent */}
                    <div className="mt-4 pt-3 border-t border-gray-200/80 flex items-center gap-2">
                      <motion.button
                        id={`btn-mark-present-${item.originalIndex}`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => handleToggleStatus(item.originalIndex, 'present')}
                        disabled={markingIndex === item.originalIndex}
                        className={`min-h-[44px] flex-1 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          isPresent
                            ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
                            : 'bg-gray-50 text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 border border-gray-200'
                        }`}
                        title={isPresent ? "Click to unmark" : "Mark as Present"}
                      >
                        <Check className="w-4 h-4" />
                        <span>{isPresent ? 'Present ✓' : 'Present'}</span>
                      </motion.button>

                      <motion.button
                        id={`btn-mark-absent-${item.originalIndex}`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => handleToggleStatus(item.originalIndex, 'absent')}
                        disabled={markingIndex === item.originalIndex}
                        className={`min-h-[44px] flex-1 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          isAbsent
                            ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-500'
                            : 'bg-gray-50 text-gray-700 hover:text-rose-700 hover:bg-rose-50 border border-gray-200'
                        }`}
                        title={isAbsent ? "Click to unmark" : "Mark as Absent"}
                      >
                        <XIcon className="w-4 h-4" />
                        <span>{isAbsent ? 'Absent ✓' : 'Absent'}</span>
                      </motion.button>

                      <motion.button
                        id={`btn-add-note-${item.originalIndex}`}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => {
                          setActiveNoteIndex(item.originalIndex);
                          setNoteInput(item.note || '');
                        }}
                        className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
                        title="Add note"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </motion.button>
                    </div>

                    {/* Inline note modal/dialog */}
                    <AnimatePresence>
                      {activeNoteIndex === item.originalIndex && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-200 space-y-2 overflow-hidden"
                        >
                          <div className="text-xs font-medium text-gray-700">Class Note (Optional)</div>
                          <input
                            type="text"
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            placeholder="e.g., Medical leave, Traffic, Extra session"
                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-gray-900"
                          />
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setActiveNoteIndex(null)}
                              className="px-3 py-1 text-xs text-gray-500 hover:text-gray-900 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveNote(item.originalIndex)}
                              className="px-3 py-1 text-xs bg-gray-900 text-white rounded-md font-semibold hover:bg-gray-800 cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* CUMULATIVE ATTENDANCE TREND LINE CHART */}
      <section id="attendance-trend-section" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-900" />
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">
              Attendance Percentage Trend
            </h2>
          </div>
          <span className="text-xs text-gray-500">Cumulative from Day 1 to Today</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          {trend.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis
                    dataKey="displayDate"
                    stroke="#6B7280"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#6B7280"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E7EB' }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E5E7EB',
                      borderRadius: '12px',
                      color: '#111827',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: any) => [`${value}%`, 'Cumulative Attendance']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="percentage"
                    stroke="#18181B"
                    strokeWidth={2.5}
                    dot={{ fill: '#18181B', r: 4, strokeWidth: 2, stroke: '#FFFFFF' }}
                    activeDot={{ r: 6, fill: '#374151' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-center text-gray-500 space-y-2">
              <TrendingUp className="w-8 h-8 text-gray-400" />
              <p className="text-sm">Trend data will appear as classes are held and marked.</p>
            </div>
          )}
        </div>
      </section>

      {/* PER-SUBJECT BREAKDOWN CARDS */}
      <section id="subjects-breakdown-section" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-gray-900" />
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Subject Breakdown</h2>
          </div>
          <button
            onClick={() => onNavigateTab('subjects')}
            className="text-xs text-gray-700 hover:text-gray-900 flex items-center gap-1 font-medium transition-colors"
          >
            <span>View All Subjects</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((sub) => {
            const pct = calculateSubjectAttendance(sub);
            const isSafe = pct >= targetPercentage;
            const quota = calculateSafeBunksOrNeeded(
              sub.attendedClasses,
              sub.totalClasses,
              targetPercentage
            );

            return (
              <motion.div
                key={sub.id}
                whileHover={{ scale: 1.01 }}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: sub.color || '#374151' }}
                      />
                      <h3 className="text-sm font-bold text-gray-900 truncate max-w-[170px]">
                        {sub.name}
                      </h3>
                    </div>
                    <p className="text-xs text-gray-500">{sub.code || 'CODE'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-gray-900 font-mono-numbers">{pct}%</span>
                    <span
                      className={`block text-[10px] font-semibold ${
                        isSafe ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {isSafe ? 'Safe' : 'Shortage'}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      backgroundColor: sub.color || '#374151',
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 font-mono-numbers pt-1">
                  <span>
                    Attended: <strong className="text-gray-900">{sub.attendedClasses}</strong> / {sub.totalClasses}
                  </span>
                  <span className="text-[11px] text-gray-500">{sub.teacher}</span>
                </div>

                {/* Subject-Specific Bunk Margin */}
                {sub.totalClasses > 0 && (
                  <div
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium flex items-center justify-between ${
                      isSafe
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50/70 border-rose-200 text-rose-800'
                    }`}
                  >
                    <span className="truncate">{quota.message}</span>
                    <span className="font-bold shrink-0 ml-2 font-mono-numbers">
                      {isSafe ? (quota.count > 0 ? `+${quota.count}` : '0') : `-${quota.count}`}
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
