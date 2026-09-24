import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Subject,
  Timetable,
  TimetableClass,
  AttendanceDayDoc,
} from '../types/attendance';
import {
  formatDateToISO,
  parseISODate,
} from '../utils/attendanceCalculations';
import {
  Clock,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  Layers,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCheck,
  Upload,
  AlertCircle,
  FileImage,
  BookOpen,
  Coffee,
  Calendar,
  Lock,
  LogIn,
  XCircle,
} from 'lucide-react';

interface TimetableManagerViewProps {
  timetables?: Timetable[];
  subjects: Subject[];
  attendanceDocs: AttendanceDayDoc[];
  weekendDays?: number[];
  isSignedIn?: boolean;
  onSignIn?: () => void;
  onSaveTimetableAndPopulate?: (
    timetable: Partial<Timetable>,
    detectedSubjects?: { name: string; code?: string; teacher?: string }[]
  ) => Promise<{ message: string }>;
  onApplyTemplateToRange?: (weekStart: string, weekEnd: string) => Promise<{ message: string }>;
  onSaveDailySchedule?: (
    date: string,
    classes: TimetableClass[],
    detectedSubjects?: { name: string; code?: string; teacher?: string }[]
  ) => Promise<{ message: string }>;
  onClearDaySchedule?: (date: string) => Promise<void>;
  onToggleDayOff?: (date: string, reason?: string) => Promise<void>;
  onMarkAttendance?: (
    date: string,
    classIndex: number,
    status: 'present' | 'absent' | 'cancelled' | null
  ) => Promise<void>;
  onMarkAllAttendance?: (date: string, status: any) => Promise<void>;
}

export const TimetableManagerView: React.FC<TimetableManagerViewProps> = ({
  timetables = [],
  subjects,
  attendanceDocs,
  weekendDays = [0, 6],
  isSignedIn = false,
  onSignIn,
  onSaveDailySchedule,
  onClearDaySchedule,
  onToggleDayOff,
  onMarkAttendance,
  onMarkAllAttendance,
}) => {
  const todayIso = formatDateToISO();
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Inline Upload Section State (Zero popups!)
  const [isUploadSectionOpen, setIsUploadSectionOpen] = useState(false);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline Quick Add Custom Input
  const [customSubjectInput, setCustomSubjectInput] = useState('');

  // Inline Clear Confirmation (No window.confirm popup!)
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  // Quick section/batch preference
  const [userSection, setUserSection] = useState<string>(() => {
    return localStorage.getItem('attendzy_user_section') || '';
  });
  const [isEditingSection, setIsEditingSection] = useState(false);
  const [tempSection, setTempSection] = useState(userSection);

  const handleSaveSection = () => {
    const trimmed = tempSection.trim();
    setUserSection(trimmed);
    localStorage.setItem('attendzy_user_section', trimmed);
    setIsEditingSection(false);
  };

  // Find doc for selected date
  const dayDoc = attendanceDocs.find((d) => d.date === selectedDate);
  const dayClasses = dayDoc?.classes || [];
  const parsedDate = parseISODate(selectedDate);
  const isWeekend = weekendDays.includes(parsedDate.getDay());
  const isCurrentDayOff = !isWeekend && Boolean(dayDoc?.isDayOff);
  const isToday = selectedDate === todayIso;

  // Date navigation helpers
  const handleShiftDate = (days: number) => {
    const d = parseISODate(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(formatDateToISO(d));
    setIsConfirmingClear(false);
  };

  const formattedDayTitle = parsedDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handleToggleUpload = () => {
    if (!isSignedIn) {
      setNoticeMessage('Sign in with Google is required to upload schedule images.');
      if (onSignIn) onSignIn();
      return;
    }
    setIsUploadSectionOpen((prev) => !prev);
    setUploadError(null);
  };

  // Inline Add Subject Preset
  const handleAddPresetClass = async (subjectName: string) => {
    if (!isSignedIn) {
      setNoticeMessage('Sign in with Google is required to add classes to your schedule.');
      if (onSignIn) onSignIn();
      return;
    }
    const trimmed = subjectName.trim();
    if (!trimmed || !onSaveDailySchedule) return;

    const newClass: TimetableClass = {
      subjectId: trimmed.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      subjectName: trimmed,
      startTime: '',
      endTime: '',
      room: '',
      status: null,
    };

    const updatedClasses = [...dayClasses, newClass];
    try {
      await onSaveDailySchedule(selectedDate, updatedClasses);
      setNoticeMessage(`Added "${trimmed}" to schedule.`);
      setTimeout(() => setNoticeMessage(null), 3000);
    } catch (err: any) {
      setNoticeMessage(err?.message || 'Failed to add class');
      setTimeout(() => setNoticeMessage(null), 3000);
    }
  };

  const handleAddCustomSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignedIn) {
      setNoticeMessage('Sign in with Google is required to add classes to your schedule.');
      if (onSignIn) onSignIn();
      return;
    }
    if (!customSubjectInput.trim()) return;
    await handleAddPresetClass(customSubjectInput.trim());
    setCustomSubjectInput('');
  };

  // Inline Remove Single Class
  const handleRemoveSingleClass = async (index: number) => {
    if (!isSignedIn) {
      setNoticeMessage('Sign in with Google is required to modify schedule classes.');
      if (onSignIn) onSignIn();
      return;
    }
    if (!onSaveDailySchedule) return;
    const removedName = dayClasses[index]?.subjectName || 'Class';
    const updatedClasses = dayClasses.filter((_, i) => i !== index);
    try {
      await onSaveDailySchedule(selectedDate, updatedClasses);
      setNoticeMessage(`Removed "${removedName}".`);
      setTimeout(() => setNoticeMessage(null), 3000);
    } catch (err: any) {
      setNoticeMessage(err?.message || 'Failed to remove class');
      setTimeout(() => setNoticeMessage(null), 3000);
    }
  };

  // Inline Image Upload Handler
  const handleProcessUploadedFile = (file: File) => {
    if (!isSignedIn) {
      setUploadError('Sign in with Google is required to upload schedule images.');
      if (onSignIn) onSignIn();
      return;
    }
    setUploadError(null);
    setIsProcessingUpload(true);
    setProcessingStep('Analyzing schedule and auto-detecting date & subjects with AI...');

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64String = reader.result as string;
        const response = await fetch('/api/parse-daily-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64String,
            mimeType: file.type || 'image/jpeg',
            date: selectedDate,
            section: userSection.trim() || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();

        // Auto-detect date from image
        let targetDate = selectedDate;
        if (data.detectedDate && /^\d{4}-\d{2}-\d{2}$/.test(data.detectedDate)) {
          targetDate = data.detectedDate;
          setSelectedDate(targetDate);
        } else if (data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
          targetDate = data.date;
          setSelectedDate(targetDate);
        }

        if (data.classes && Array.isArray(data.classes) && data.classes.length > 0) {
          const formattedClasses: TimetableClass[] = data.classes.map((item: any) => ({
            subjectId: (item.subject || 'class').toLowerCase().replace(/[^a-z0-9]/g, '-'),
            subjectName: item.subject || 'Lecture',
            startTime: item.startTime || '',
            endTime: item.endTime || '',
            room: '',
            teacher: item.teacher || '',
            status: null,
          }));

          if (onSaveDailySchedule) {
            await onSaveDailySchedule(targetDate, formattedClasses, data.detectedSubjects || []);
          }

          setNoticeMessage(`Successfully extracted & scheduled ${formattedClasses.length} classes for ${targetDate}.`);
          setIsUploadSectionOpen(false);
          setTimeout(() => setNoticeMessage(null), 4000);
        } else {
          throw new Error('No classes detected in image. You can click any preset below to add your classes.');
        }
      } catch (err: any) {
        console.error('Upload processing error:', err);
        setUploadError(err?.message || 'Failed to extract classes from image.');
      } finally {
        setIsProcessingUpload(false);
        setProcessingStep('');
      }
    };
    reader.readAsDataURL(file);
  };

  // Only show subjects which the user has previously added to their schedule or subjects list
  const previousScheduleSubjects: string[] = useMemo(() => {
    const map = new Map<string, string>(); // lowercased -> display name

    // 1. From all daily attendance schedule docs
    if (Array.isArray(attendanceDocs)) {
      for (const doc of attendanceDocs) {
        if (Array.isArray(doc.classes)) {
          for (const c of doc.classes) {
            const trimmed = c.subjectName?.trim();
            if (trimmed && !map.has(trimmed.toLowerCase())) {
              map.set(trimmed.toLowerCase(), trimmed);
            }
          }
        }
      }
    }

    // 2. From user's registered subjects list
    if (Array.isArray(subjects)) {
      for (const s of subjects) {
        const trimmed = s.name?.trim();
        if (trimmed && !map.has(trimmed.toLowerCase())) {
          map.set(trimmed.toLowerCase(), trimmed);
        }
      }
    }

    // 3. From timetable templates (if any)
    if (Array.isArray(timetables)) {
      for (const t of timetables) {
        if (t.days) {
          for (const dayClassList of Object.values(t.days)) {
            if (Array.isArray(dayClassList)) {
              for (const c of dayClassList) {
                const trimmed = c.subjectName?.trim();
                if (trimmed && !map.has(trimmed.toLowerCase())) {
                  map.set(trimmed.toLowerCase(), trimmed);
                }
              }
            }
          }
        }
      }
    }

    // 4. Also include any subjects from today's active schedule classes
    if (Array.isArray(dayClasses)) {
      for (const c of dayClasses) {
        const trimmed = c.subjectName?.trim();
        if (trimmed && !map.has(trimmed.toLowerCase())) {
          map.set(trimmed.toLowerCase(), trimmed);
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [attendanceDocs, subjects, timetables, dayClasses]);

  return (
    <div id="daily-schedule-view" className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 text-gray-800 flex items-center justify-center shadow-xs">
                <Clock className="w-5 h-5" />
              </div>
              <span>Schedule</span>
            </h1>

            {/* Section Badge / Editor */}
            {isEditingSection ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="e.g. B2, Sec A"
                  value={tempSection}
                  onChange={(e) => setTempSection(e.target.value)}
                  className="h-8 px-2.5 text-xs rounded-lg border border-gray-300 bg-white font-medium text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-gray-400"
                  autoFocus
                />
                <button
                  onClick={handleSaveSection}
                  className="h-8 px-2.5 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-black cursor-pointer"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditingSection(false)}
                  className="h-8 px-2 text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setTempSection(userSection);
                  setIsEditingSection(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 transition-colors cursor-pointer"
                title="Click to set your batch or section"
              >
                <Layers className="w-3.5 h-3.5 text-gray-500" />
                <span>{userSection.trim() ? `Section: ${userSection.trim()}` : '+ Set Section / Batch'}</span>
              </button>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1.5 max-w-2xl">
            Upload photos of your schedule or add classes directly using subject presets. Zero popups.
          </p>
        </div>

        {/* Primary Action Button (Toggles Inline Upload) - Hidden when College Day Off is active */}
        {!isCurrentDayOff && (
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              id="btn-upload-schedule-primary"
              onClick={handleToggleUpload}
              className={`min-h-[44px] px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm transition-transform active:scale-[0.98] cursor-pointer ${
                isUploadSectionOpen
                  ? 'bg-gray-200 text-gray-800 hover:bg-gray-300 border border-gray-300'
                  : 'bg-gray-900 hover:bg-black text-white'
              }`}
            >
              {!isSignedIn ? <Lock className="w-4 h-4 opacity-80" /> : <Sparkles className="w-4 h-4" />}
              <span>{isUploadSectionOpen ? 'Hide Upload Area' : !isSignedIn ? 'Sign In to Upload Schedule' : 'Upload Schedule Image'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Sign In Required Banner when user is not signed in */}
      {!isSignedIn && (
        <div
          id="schedule-signin-banner"
          className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-2xs"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-sm sm:text-base font-bold text-amber-950">
                Sign In Required to Add Schedule
              </h3>
              <p className="text-xs text-amber-800 leading-relaxed max-w-xl">
                You need to sign in with your Google account to create, upload, or modify classes in your schedule. Your timetable and attendance data will sync across your devices.
              </p>
            </div>
          </div>
          {onSignIn && (
            <button
              id="btn-schedule-signin-banner"
              type="button"
              onClick={onSignIn}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-[0.98] shrink-0 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In with Google</span>
            </button>
          )}
        </div>
      )}

      {/* Notice Banner */}
      <AnimatePresence>
        {noticeMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3.5 rounded-xl bg-gray-900 text-white text-xs flex items-center justify-between gap-3 shadow-md"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{noticeMessage}</span>
            </div>
            <button
              onClick={() => setNoticeMessage(null)}
              className="text-gray-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* INLINE Upload Schedule Section (NO POPUP MODAL) */}
      <AnimatePresence>
        {isUploadSectionOpen && !isCurrentDayOff && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-gray-700" />
                    <span>Upload Schedule Image</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Date and classes will be automatically detected and saved to your schedule.
                  </p>
                </div>
                <button
                  onClick={() => setIsUploadSectionOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  title="Close upload area"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drag & Drop Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleProcessUploadedFile(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 sm:p-8 rounded-xl border-2 border-dashed text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-400 bg-gray-50/50 hover:bg-gray-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleProcessUploadedFile(e.target.files[0]);
                    }
                  }}
                />

                {isProcessingUpload ? (
                  <div className="space-y-3 py-2">
                    <div className="w-7 h-7 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-semibold text-gray-900">{processingStep}</p>
                    <p className="text-[11px] text-gray-500">This takes just a couple of seconds...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 text-gray-700 flex items-center justify-center mx-auto shadow-2xs">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-900">Click to select photo</span>
                      <span className="text-xs text-gray-500"> or drag and drop image here</span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Supports JPG, PNG, Screenshots of daily timetable or notice board
                    </p>
                  </div>
                )}
              </div>

              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schedule Classes List & Inline Presets Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        {/* Card Header with Date Nav & Controls */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-3.5 flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleShiftDate(-1)}
                className="min-h-[40px] min-w-[40px] sm:min-h-[34px] sm:min-w-[34px] rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleShiftDate(1)}
                className="min-h-[40px] min-w-[40px] sm:min-h-[34px] sm:min-w-[34px] rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
              <span>Classes for {parsedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              {isToday && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Today
                </span>
              )}
              {isWeekend ? (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  Weekend Off
                </span>
              ) : isCurrentDayOff ? (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                  <Coffee className="w-3 h-3" />
                  Day Off
                </span>
              ) : null}
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
              {dayClasses.length}
            </span>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value);
                  setIsConfirmingClear(false);
                }
              }}
              className="min-h-[40px] sm:min-h-[34px] text-xs font-medium text-gray-700 border border-gray-200 rounded-xl px-2.5 py-1.5 bg-white hover:border-gray-300 focus:outline-hidden focus:ring-1 focus:ring-gray-400 cursor-pointer ml-1 shadow-2xs"
              title="Select date"
            />
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Day Off toggle is only for working days (non-weekends). Weekends are fixed in Settings */}
            {!isWeekend && onToggleDayOff && (
              <button
                id="btn-schedule-day-off"
                onClick={() => onToggleDayOff(selectedDate)}
                className={`min-h-[40px] sm:min-h-[36px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs ${
                  isCurrentDayOff
                    ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                    : 'bg-white hover:bg-amber-50 text-gray-700 hover:text-amber-800 border-gray-200 hover:border-amber-300'
                }`}
                title={isCurrentDayOff ? 'Remove Day Off status (re-open classes)' : 'Mark this date as Day Off (No classes)'}
              >
                <Coffee className="w-3.5 h-3.5 text-amber-500" />
                <span>{isCurrentDayOff ? 'Day Off ✓' : 'Mark Day Off'}</span>
              </button>
            )}

            {/* When College Day Off is active, hide Upload Schedule */}
            {!isCurrentDayOff && (
              <button
                onClick={handleToggleUpload}
                className="min-h-[40px] sm:min-h-[36px] px-3.5 py-1.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs"
              >
                {!isSignedIn ? <Lock className="w-3.5 h-3.5 opacity-80" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{isUploadSectionOpen ? 'Close Upload' : !isSignedIn ? 'Sign In to Upload' : 'Upload Schedule'}</span>
              </button>
            )}

            {/* Inline Clear Confirmation (Zero Popups) */}
            {dayClasses.length > 0 && onClearDaySchedule && (
              <div className="flex items-center">
                {isConfirmingClear ? (
                  <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2 py-1 rounded-xl">
                    <span className="text-xs text-rose-700 font-semibold">Clear day?</span>
                    <button
                      onClick={async () => {
                        if (!isSignedIn) {
                          setNoticeMessage('Sign in with Google is required to clear schedule classes.');
                          if (onSignIn) onSignIn();
                          setIsConfirmingClear(false);
                          return;
                        }
                        await onClearDaySchedule(selectedDate);
                        setIsConfirmingClear(false);
                        setNoticeMessage(`Schedule cleared for ${formattedDayTitle}.`);
                        setTimeout(() => setNoticeMessage(null), 3000);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setIsConfirmingClear(false)}
                      className="px-2 py-0.5 rounded-lg text-gray-600 hover:bg-rose-100 text-xs font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (!isSignedIn) {
                        setNoticeMessage('Sign in with Google is required to modify schedule classes.');
                        if (onSignIn) onSignIn();
                        return;
                      }
                      setIsConfirmingClear(true);
                    }}
                    className="min-h-[36px] px-2.5 py-1.5 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                    title="Clear all classes for this date"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* INLINE Quick Add With Presets - Hidden when College Day Off is active */}
        {isCurrentDayOff ? (
          <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200 text-center space-y-1.5">
            <div className="flex items-center justify-center gap-2 text-amber-950 font-bold text-sm">
              <Coffee className="w-4 h-4 text-amber-600" />
              <span>College Day Off — No Classes Held Today</span>
            </div>
            <p className="text-xs text-amber-800 max-w-lg mx-auto">
              College is closed today, so no lectures or classes are being held. Adding classes and uploading schedules are hidden because there are no college classes. If college was open, click "College Off ✓" above to re-open.
            </p>
          </div>
        ) : !isSignedIn ? (
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-gray-700">
              <div className="w-8 h-8 rounded-lg bg-gray-200 text-gray-700 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold block text-gray-900">Add Schedule Locked</span>
                <span className="text-gray-500">Sign in with Google to add classes or use subject presets.</span>
              </div>
            </div>
            {onSignIn && (
              <button
                id="btn-schedule-presets-signin"
                type="button"
                onClick={onSignIn}
                className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 shadow-2xs transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In to Add Classes</span>
              </button>
            )}
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-gray-600" />
                <span>Quick Add Subject Presets:</span>
              </span>
              <span className="text-[11px] text-gray-500 font-medium">
                {previousScheduleSubjects.length > 0
                  ? `${previousScheduleSubjects.length} previously scheduled subject${previousScheduleSubjects.length === 1 ? '' : 's'}`
                  : 'No previously scheduled subjects yet'}
              </span>
            </div>

            {/* Preset Chips (Only subjects previously added to schedule) */}
            {previousScheduleSubjects.length > 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                {previousScheduleSubjects.map((name) => (
                  <motion.button
                    key={`user-preset-${name}`}
                    type="button"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => handleAddPresetClass(name)}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-gray-300 text-gray-800 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                    title={`Click to add "${name}" to schedule`}
                  >
                    <Plus className="w-3.5 h-3.5 opacity-60" />
                    <span>{name}</span>
                  </motion.button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 py-0.5">
                No subjects added to your schedule yet. Type a subject name below to add your first class — it will then appear here as a 1-click preset for future days!
              </p>
            )}

            {/* Custom Subject Name Input (Inline) */}
            <form onSubmit={handleAddCustomSubject} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="+ Type subject name to add to schedule..."
                value={customSubjectInput}
                onChange={(e) => setCustomSubjectInput(e.target.value)}
                className="flex-1 min-h-[42px] px-3 text-xs rounded-xl border border-gray-200 bg-white font-medium text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-1 focus:ring-gray-400 shadow-2xs"
              />
              <button
                type="submit"
                disabled={!customSubjectInput.trim()}
                className="min-h-[42px] px-3.5 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-2xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Class</span>
              </button>
            </form>
          </div>
        )}

        {/* Classes List */}
        {dayClasses.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto ${isWeekend ? 'bg-amber-50 text-amber-700' : isCurrentDayOff ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
              {isWeekend ? <Calendar className="w-6 h-6" /> : isCurrentDayOff ? <Coffee className="w-6 h-6" /> : !isSignedIn ? <Lock className="w-6 h-6 text-gray-400" /> : <Clock className="w-6 h-6 text-gray-500" />}
            </div>
            {isWeekend ? (
              <>
                <h4 className="text-sm font-semibold text-gray-900">Weekend Off — No classes scheduled</h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  This date is part of your fixed weekend schedule. Weekends can only be modified in Settings.
                </p>
              </>
            ) : isCurrentDayOff ? (
              <>
                <h4 className="text-sm font-semibold text-amber-950">College Day Off — Classes Excused</h4>
                <p className="text-xs text-amber-800 max-w-sm mx-auto">
                  This working day is marked as an ad-hoc Day Off. Classes are excused and will not count against your attendance target.
                </p>
              </>
            ) : !isSignedIn ? (
              <>
                <h4 className="text-sm font-semibold text-gray-900">No classes scheduled for this date</h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Sign in with Google to add classes or upload your schedule image.
                </p>
                {onSignIn && (
                  <div className="pt-1">
                    <button
                      id="btn-schedule-empty-signin"
                      type="button"
                      onClick={onSignIn}
                      className="min-h-[38px] px-4 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-semibold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign In with Google</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <h4 className="text-sm font-semibold text-gray-900">No classes scheduled for this date</h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Click any of your subject preset chips above to add classes, or mark this day off.
                </p>
              </>
            )}

            {/* Day Off toggle is only for working days (non-weekends) */}
            {!isWeekend && onToggleDayOff && (
              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  id="btn-schedule-empty-day-off"
                  onClick={() => onToggleDayOff(selectedDate)}
                  className={`min-h-[38px] px-4 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer ${
                    isCurrentDayOff
                      ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-sm'
                      : 'bg-white hover:bg-amber-50 text-gray-800 hover:text-amber-900 border-gray-200 hover:border-amber-300 shadow-2xs'
                  }`}
                >
                  <Coffee className="w-3.5 h-3.5 text-amber-500" />
                  <span>{isCurrentDayOff ? 'Day Off ✓ (Remove)' : 'Mark as Day Off'}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {onMarkAllAttendance && dayClasses.length > 0 && !isCurrentDayOff && !isWeekend && (
              <div className="flex items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-gray-200/90 shadow-2xs flex-wrap">
                <span className="text-xs font-semibold text-gray-700">Quick Mark Attendance ({dayClasses.length} {dayClasses.length === 1 ? 'class' : 'classes'}):</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onMarkAllAttendance(selectedDate, 'present')}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer active:scale-95"
                    title="Mark all classes on this date as Present"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Present All</span>
                  </button>
                  <button
                    onClick={() => onMarkAllAttendance(selectedDate, 'absent')}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer active:scale-95"
                    title="Mark all classes on this date as Absent"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Absent All</span>
                  </button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {dayClasses.map((item, idx) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                key={idx}
                className="p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white hover:border-gray-300 transition-colors space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-bold text-gray-900">{item.subjectName}</h4>
                    {item.startTime || item.endTime ? (
                      <p className="text-xs text-gray-500 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>{item.startTime}{item.endTime ? ` - ${item.endTime}` : ''}</span>
                        {item.room && <span>• Room {item.room}</span>}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                        <span>Class #{idx + 1}</span>
                        {item.teacher && <span>• {item.teacher}</span>}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div>
                      {item.status === 'present' && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Present
                        </span>
                      )}
                      {item.status === 'absent' && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                          Absent
                        </span>
                      )}
                      {item.status === 'cancelled' && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                          Cancelled
                        </span>
                      )}
                      {item.status === null && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-white text-gray-500 border border-gray-200">
                          Unmarked
                        </span>
                      )}
                    </div>

                    {/* Quick remove this single class (zero popups) */}
                    <button
                      onClick={() => handleRemoveSingleClass(idx)}
                      className="p-1 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Remove class"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Quick Attendance Marking Buttons for this class */}
                {onMarkAttendance && (
                  <div className="pt-2.5 border-t border-gray-200/80 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] text-gray-500 font-semibold">Mark:</span>
                    <div className="flex items-center gap-1.5 flex-1 justify-end">
                      <button
                        onClick={() => onMarkAttendance(selectedDate, idx, item.status === 'present' ? null : 'present')}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-2xs ${
                          item.status === 'present'
                            ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-500'
                            : 'bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Present</span>
                      </button>

                      <button
                        onClick={() => onMarkAttendance(selectedDate, idx, item.status === 'absent' ? null : 'absent')}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-2xs ${
                          item.status === 'absent'
                            ? 'bg-rose-600 text-white shadow-xs ring-1 ring-rose-500'
                            : 'bg-white border border-gray-200 text-gray-700 hover:bg-rose-50 hover:text-rose-700'
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Absent</span>
                      </button>

                      <button
                        onClick={() => onMarkAttendance(selectedDate, idx, item.status === 'cancelled' ? null : 'cancelled')}
                        className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer active:scale-95 ${
                          item.status === 'cancelled'
                            ? 'bg-gray-800 text-white'
                            : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                        }`}
                        title="Class was cancelled / holiday"
                      >
                        Off
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Also export as DailyScheduleView
export const DailyScheduleView = TimetableManagerView;
