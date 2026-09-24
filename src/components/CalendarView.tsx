import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AttendanceDayDoc,
  AttendanceStatus,
  Subject,
  TimetableClass,
} from '../types/attendance';
import {
  formatDateToISO,
  parseISODate,
} from '../utils/attendanceCalculations';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Calendar,
  CalendarDays,
  AlertTriangle,
  Check,
  CheckCheck,
  X as XIcon,
  XCircle,
  Clock3,
  Clock,
  Sparkles,
  Info,
  Plus,
  Trash2,
  Coffee,
} from 'lucide-react';

interface CalendarViewProps {
  attendanceDocs: AttendanceDayDoc[];
  subjects: Subject[];
  weekendDays?: number[];
  isSignedIn?: boolean;
  onSignIn?: () => void;
  onMarkAttendance: (date: string, classIndex: number, status: AttendanceStatus, note?: string) => Promise<void>;
  onMarkAllAttendance?: (date: string, status: AttendanceStatus) => Promise<void>;
  onNavigateTab: (tab: 'timetable' | 'dashboard') => void;
  onSaveDailySchedule?: (
    date: string,
    classes: TimetableClass[],
    detectedSubjects?: { name: string; code?: string; teacher?: string }[]
  ) => Promise<{ message: string }>;
  onClearDaySchedule?: (date: string) => Promise<void>;
  onToggleDayOff?: (date: string, reason?: string) => Promise<void>;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  attendanceDocs,
  subjects,
  weekendDays = [0, 6],
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
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [isConfirmingClearDate, setIsConfirmingClearDate] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const handleBatchMark = async (status: AttendanceStatus) => {
    if (!onMarkAllAttendance) return;
    setIsMarkingAll(true);
    try {
      await onMarkAllAttendance(selectedDate, status);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const selectedDoc = useMemo(
    () => attendanceDocs.find((d) => d.date === selectedDate),
    [attendanceDocs, selectedDate]
  );

  const selectedDayOfWeek = parseISODate(selectedDate).getDay();
  const isSelectedWeekend = weekendDays.includes(selectedDayOfWeek);
  const isCurrentDayOff = !isSelectedWeekend && Boolean(selectedDoc?.isDayOff);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(todayStr);
  };

  // Calendar Grid Math (Monday start)
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Day of week for 1st day (0 = Sunday, 1 = Monday...)
    let startDayOfWeek = firstDayOfMonth.getDay();
    // Adjust to Monday = 0, Sunday = 6
    startDayOfWeek = (startDayOfWeek + 6) % 7;

    const days = [];

    // Padding days before month start
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date: formatDateToISO(prevDate),
        dayNum: prevDate.getDate(),
        isCurrentMonth: false,
      });
    }

    // Days in current month
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(year, month, i);
      days.push({
        date: formatDateToISO(d),
        dayNum: i,
        isCurrentMonth: true,
      });
    }

    // Padding days to fill 35 or 42 grid slots
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({
        date: formatDateToISO(nextDate),
        dayNum: i,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentMonth]);

  const monthTitle = currentMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const selectedDateFormatted = parseISODate(selectedDate).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div id="calendar-view" className="space-y-6 pb-12">
      {/* Calendar Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-gray-900" />
            <span>Monthly Attendance Calendar</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Track daily class statuses, review past attendance, and catch unmarked days.
          </p>
        </div>

        {/* Month Navigator & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={goToToday}
            className="min-h-[44px] px-3.5 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-700 hover:text-gray-900 hover:border-gray-400 shadow-sm transition-colors cursor-pointer"
          >
            Today
          </motion.button>

          {!isSelectedWeekend && onToggleDayOff && (
            <motion.button
              id="btn-cal-header-day-off"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onToggleDayOff(selectedDate)}
              className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer ${
                isCurrentDayOff
                  ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                  : 'bg-white hover:bg-amber-50 text-gray-700 hover:text-amber-800 border-gray-200 hover:border-amber-300'
              }`}
              title={isCurrentDayOff ? 'Remove Day Off status' : 'Mark selected date as Day Off (No classes in college)'}
            >
              <Coffee className="w-4 h-4 text-amber-500" />
              <span>{isCurrentDayOff ? 'Day Off ✓' : 'Mark Day Off'}</span>
            </motion.button>
          )}

          <div className="flex items-center bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={prevMonth}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-5 h-5" />
            </motion.button>
            <span className="px-3 text-sm font-bold text-gray-900 min-w-[130px] text-center">
              {monthTitle}
            </span>
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={nextMonth}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-gray-200 text-xs text-gray-600 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium text-gray-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            Present
          </span>
          <span className="flex items-center gap-1.5 font-medium text-gray-700">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            Absent
          </span>
          <span className="flex items-center gap-1.5 font-medium text-gray-700">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
            Unmarked
          </span>
          <span className="flex items-center gap-1.5 font-medium text-gray-700">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            Day Off
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Amber badge = Past day with unmarked classes</span>
        </div>
      </div>

      {/* Main Grid + Day Detail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar Monthly Matrix */}
        <div className="lg:col-span-8 bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 pb-2 border-b border-gray-200">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
              const dayIndex = idx === 6 ? 0 : idx + 1;
              const isWeekend = weekendDays.includes(dayIndex);
              return (
                <div key={day} className={`py-1.5 rounded-lg ${isWeekend ? 'text-amber-900 font-bold bg-amber-50/60 border border-amber-200/50' : ''}`}>
                  <span>{day}</span>
                  {isWeekend && (
                    <span className="hidden sm:inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-700 bg-amber-100/90 px-1 py-0.2 rounded ml-1 border border-amber-200">
                      <Coffee className="w-2.5 h-2.5" />
                      <span>Off</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Day cells */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={monthTitle}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="grid grid-cols-7 gap-1 sm:gap-2"
            >
              {calendarDays.map((cell) => {
                const isToday = cell.date === todayStr;
              const isSelected = cell.date === selectedDate;
              const isPast = cell.date < todayStr;
              const cellDayOfWeek = parseISODate(cell.date).getDay();
              const isWeekend = weekendDays.includes(cellDayOfWeek);

              const doc = attendanceDocs.find((d) => d.date === cell.date);
              const classes = doc?.classes || [];
              const isDayOff = !isWeekend && Boolean(doc?.isDayOff);

              // Check if past day has unmarked classes
              const hasUnmarkedPast = isPast && classes.length > 0 && classes.some((c) => c.status === null);

              return (
                <motion.div
                  key={cell.date}
                  id={`cal-day-${cell.date}`}
                  onClick={() => setSelectedDate(cell.date)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`min-h-[58px] sm:min-h-[80px] p-1.5 sm:p-2 rounded-xl border flex flex-col justify-between cursor-pointer transition-all duration-200 relative ${
                    isSelected
                      ? 'border-gray-900 bg-gray-50 ring-2 ring-gray-900'
                      : isToday
                      ? 'border-gray-800 bg-gray-100'
                      : isDayOff
                      ? 'border-amber-300 bg-amber-50/50 hover:border-amber-400 hover:bg-amber-50'
                      : cell.isCurrentMonth
                      ? isWeekend && classes.length === 0
                        ? 'border-gray-200/90 bg-gray-50/70 hover:border-gray-400 hover:bg-gray-50'
                        : 'border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50'
                      : 'border-transparent bg-transparent opacity-30'
                  }`}
                >
                  {/* Date number and badges */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs sm:text-sm font-bold font-mono-numbers ${
                        isToday
                          ? 'text-gray-900 px-1.5 py-0.5 rounded bg-gray-200'
                          : isDayOff
                          ? 'text-amber-900 font-bold'
                          : cell.isCurrentMonth
                          ? isWeekend && classes.length === 0
                            ? 'text-gray-600'
                            : 'text-gray-800'
                          : 'text-gray-400'
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    {/* Badges: Weekend is fixed in Settings, Day Off can be toggled on working days */}
                    <div className="flex items-center gap-1">
                      {isWeekend && classes.length === 0 ? (
                        <span
                          title="Weekend Off (Fixed • Configured in Settings)"
                          className="text-[9px] font-medium text-amber-800/80 bg-amber-50/80 px-1 py-0.2 rounded border border-amber-100"
                        >
                          Wknd
                        </span>
                      ) : isDayOff && onToggleDayOff ? (
                        <button
                          type="button"
                          id={`cal-cell-day-off-${cell.date}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleDayOff(cell.date);
                          }}
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-all cursor-pointer bg-amber-600 hover:bg-amber-700 text-white shadow-2xs"
                          title="Day Off active (click to remove)"
                        >
                          <Coffee className="w-2.5 h-2.5 shrink-0" />
                          <span>Off ✓</span>
                        </button>
                      ) : null}

                      {hasUnmarkedPast && (
                        <span
                          title="Unmarked attendance on this past day"
                          className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
                        />
                      )}
                    </div>
                  </div>

                  {/* Class dots */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {classes.map((c, i) => {
                      let dotColor = 'bg-gray-400';
                      if (c.status === 'present' || c.status === 'late') dotColor = 'bg-emerald-500';
                      else if (c.status === 'absent') dotColor = 'bg-rose-500';

                      return (
                        <span
                          key={i}
                          className={`w-2 h-2 rounded-full ${dotColor}`}
                          title={`${c.subjectName}: ${c.status || 'Unmarked'}`}
                        />
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Selected Day Classes Panel */}
        <div className="lg:col-span-4 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="border-b border-gray-200 pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-semibold text-gray-500">
                    Selected Day Details
                  </span>
                  {isSelectedWeekend ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      Weekend Off
                    </span>
                  ) : isCurrentDayOff ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-0.5">
                      <Coffee className="w-2.5 h-2.5" />
                      Day Off
                    </span>
                  ) : null}
                </div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 mt-0.5">
                  {selectedDateFormatted}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {!isSelectedWeekend && onToggleDayOff && (
                  <button
                    id="btn-day-off-panel"
                    onClick={() => onToggleDayOff(selectedDate)}
                    className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isCurrentDayOff
                        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs ring-1 ring-amber-600'
                        : 'bg-white hover:bg-amber-50 text-gray-700 hover:text-amber-800 border border-gray-200 hover:border-amber-300'
                    }`}
                    title={isCurrentDayOff ? 'Remove Day Off status' : 'Mark this date as Day Off (No classes)'}
                  >
                    <Coffee className="w-3.5 h-3.5 text-amber-500" />
                    <span>{isCurrentDayOff ? 'Day Off ✓' : 'Day Off'}</span>
                  </button>
                )}

                {/* When Day Off is active (no classes in college), hide Upload Schedule and Add Class buttons */}
                {!isCurrentDayOff && (
                  <>
                    <button
                      onClick={() => {
                        if (!isSignedIn && onSignIn) {
                          onSignIn();
                        }
                        onNavigateTab('timetable');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                      title="Go to Schedule to upload"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Upload</span>
                    </button>
                    <button
                      onClick={() => {
                        if (!isSignedIn && onSignIn) {
                          onSignIn();
                        }
                        onNavigateTab('timetable');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Go to Schedule to add class"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Class</span>
                    </button>
                  </>
                )}
                {selectedDoc && selectedDoc.classes.length > 0 && onClearDaySchedule && (
                  <div>
                    {isConfirmingClearDate ? (
                      <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-lg">
                        <span className="text-[11px] text-rose-700 font-bold">Clear?</span>
                        <button
                          onClick={async () => {
                            await onClearDaySchedule(selectedDate);
                            setIsConfirmingClearDate(false);
                          }}
                          className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[11px] font-bold"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setIsConfirmingClearDate(false)}
                          className="px-1 py-0.5 text-[11px] text-gray-500"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsConfirmingClearDate(true)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                        title="Clear this day's classes"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {selectedDate === todayStr ? (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-800 border border-gray-200">
                  Today
                </span>
              ) : selectedDate < todayStr ? (
                <span className="text-[11px] font-medium text-gray-500">Past Date</span>
              ) : (
                <span className="text-[11px] font-medium text-gray-700">Upcoming Date</span>
              )}
              {weekendDays.includes(parseISODate(selectedDate).getDay()) && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                  Weekend
                </span>
              )}
              {isCurrentDayOff && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                  <Coffee className="w-3 h-3" />
                  Day Off
                </span>
              )}
              <span className="text-xs text-gray-500 font-mono-numbers">
                {selectedDoc?.classes?.length || 0} classes
              </span>
            </div>

            {/* Day Off Indicator Banner */}
            {isCurrentDayOff && (
              <div className="mt-2.5 p-3 rounded-xl bg-amber-50/90 border border-amber-200 flex items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <Coffee className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-950">Marked as Day Off</p>
                    <p className="text-[11px] text-amber-800">
                      Classes for this day are excused and do not penalize your attendance quota.
                    </p>
                  </div>
                </div>
                {onToggleDayOff && (
                  <button
                    onClick={() => onToggleDayOff(selectedDate)}
                    className="text-[11px] font-semibold text-amber-900 hover:text-amber-950 underline cursor-pointer shrink-0"
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Class List for Selected Day */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {!selectedDoc || selectedDoc.classes.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto ${isCurrentDayOff ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
                  {isSelectedWeekend ? <Calendar className="w-6 h-6" /> : isCurrentDayOff ? <Coffee className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                </div>
                {isSelectedWeekend ? (
                  <>
                    <p className="text-sm font-semibold text-gray-800">Weekend Off — No classes scheduled</p>
                    <p className="text-xs text-gray-500 max-w-xs mx-auto">
                      This date is part of your fixed weekend schedule. Weekends can only be modified in Settings.
                    </p>
                  </>
                ) : isCurrentDayOff ? (
                  <>
                    <p className="text-sm font-semibold text-amber-950">College Day Off — Classes Excused</p>
                    <p className="text-xs text-amber-800 max-w-xs mx-auto">
                      This date is marked as an ad-hoc Day Off. Classes are excused and will not count against your attendance target.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-gray-800">No schedule for this day</p>
                    <p className="text-xs text-gray-500 max-w-xs mx-auto">
                      Upload a timetable image or add your classes for this date.
                    </p>
                  </>
                )}
                <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                  {!isCurrentDayOff && !isSelectedWeekend && (
                    <button
                      onClick={() => onNavigateTab('timetable')}
                      className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-gray-900 hover:bg-black text-xs font-semibold text-white transition-colors shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Go to Schedule</span>
                    </button>
                  )}
                  {/* Day Off toggle is only for working days (non-weekends) */}
                  {!isSelectedWeekend && onToggleDayOff && (
                    <button
                      id="btn-day-off-empty"
                      onClick={() => onToggleDayOff(selectedDate)}
                      className={`min-h-[40px] px-4 py-2 rounded-xl border text-xs font-semibold transition-colors shadow-2xs inline-flex items-center gap-1.5 cursor-pointer ${
                        isCurrentDayOff
                          ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-sm'
                          : 'bg-white hover:bg-amber-50 text-gray-700 hover:text-amber-800 border-gray-200 hover:border-amber-300'
                      }`}
                    >
                      <Coffee className="w-3.5 h-3.5 text-amber-600" />
                      <span>{isCurrentDayOff ? 'Day Off ✓ (Remove)' : 'Mark as Day Off'}</span>
                    </button>
                  )}
                  {isSelectedWeekend && (
                    <button
                      onClick={() => onNavigateTab('settings' as any)}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <CalendarDays className="w-3.5 h-3.5 text-gray-500" />
                      <span>Weekend Settings</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {onMarkAllAttendance && (
                  <div className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                    <span className="text-xs font-semibold text-gray-700">Quick Mark All:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleBatchMark('present')}
                        disabled={isMarkingAll}
                        className="min-h-[34px] px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                        title="Mark all classes on this date as Present"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>{isMarkingAll ? 'Updating...' : 'Present All'}</span>
                      </button>
                      <button
                        onClick={() => handleBatchMark('absent')}
                        disabled={isMarkingAll}
                        className="min-h-[34px] px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                        title="Mark all classes on this date as Absent"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{isMarkingAll ? 'Updating...' : 'Absent All'}</span>
                      </button>
                    </div>
                  </div>
                )}
                {selectedDoc.classes.map((cls, idx) => {
                const isPresent = cls.status === 'present';
                const isAbsent = cls.status === 'absent';

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2.5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">{cls.subjectName}</h4>
                        {cls.startTime || cls.endTime ? (
                          <p className="text-xs text-gray-500 font-mono-numbers flex items-center gap-1.5 mt-0.5">
                            <Clock3 className="w-3.5 h-3.5 text-gray-400" />
                            <span>
                              {cls.startTime}{cls.endTime ? ` - ${cls.endTime}` : ''}
                            </span>
                            {cls.room && <span>• {cls.room}</span>}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            <span>Period #{idx + 1}</span>
                          </p>
                        )}
                      </div>

                      {/* Status indicator badge */}
                      <div>
                        {isPresent && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Present
                          </span>
                        )}
                        {isAbsent && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                            Absent
                          </span>
                        )}
                        {cls.status === null && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-white text-gray-600 border border-gray-200">
                            Unmarked
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Marking Buttons */}
                    <div className="flex items-center gap-1.5 pt-1 border-t border-gray-200">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => onMarkAttendance(selectedDate, idx, isPresent ? null : 'present')}
                        className={`min-h-[44px] flex-1 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                          isPresent
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 border border-gray-200'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Present</span>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => onMarkAttendance(selectedDate, idx, isAbsent ? null : 'absent')}
                        className={`min-h-[44px] flex-1 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                          isAbsent
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'bg-white text-gray-700 hover:text-rose-700 hover:bg-rose-50 border border-gray-200'
                        }`}
                      >
                        <XIcon className="w-3.5 h-3.5" />
                        <span>Absent</span>
                      </motion.button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};
