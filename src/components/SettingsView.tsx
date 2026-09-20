import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  Subject,
  AttendanceDayDoc,
  Timetable,
} from '../types/attendance';
import {
  LogOut,
  Download,
  FileSpreadsheet,
  Database,
  Trash2,
  CheckCircle2,
  User,
  CalendarDays,
  Check,
  Target,
  Percent,
  Award,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Link2,
  Unlink,
  Sparkles,
  ArrowRight,
  Sheet,
} from 'lucide-react';
import {
  WEEK_DAYS_LIST,
  formatWeekendSummary,
  DEFAULT_TARGET_PERCENTAGE,
  calculateOverallAttendance,
} from '../utils/attendanceCalculations';

interface SettingsViewProps {
  user: UserProfile | null;
  subjects: Subject[];
  attendanceDocs: AttendanceDayDoc[];
  timetables: Timetable[];
  weekendDays: number[];
  targetPercentage?: number;
  onUpdateWeekendDays: (days: number[]) => void;
  onUpdateTargetPercentage?: (percentage: number) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onClearAllData?: () => Promise<void>;
  onUpdateUser?: (updated: UserProfile) => void;
  onBuildGoogleSheet?: () => Promise<void>;
  onSyncGoogleSheet?: () => Promise<void>;
  onUnlinkGoogleSheet?: () => Promise<void>;
  onToggleAutoSyncGoogleSheet?: (enabled: boolean) => Promise<void>;
  isGoogleSheetSyncing?: boolean;
  isGoogleSheetCreating?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  subjects,
  attendanceDocs,
  timetables,
  weekendDays,
  targetPercentage = DEFAULT_TARGET_PERCENTAGE,
  onUpdateWeekendDays,
  onUpdateTargetPercentage,
  onSignIn,
  onSignOut,
  onClearAllData,
  onBuildGoogleSheet,
  onSyncGoogleSheet,
  onUnlinkGoogleSheet,
  onToggleAutoSyncGoogleSheet,
  isGoogleSheetSyncing = false,
  isGoogleSheetCreating = false,
}) => {
  const [isClearing, setIsClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [justUpdatedTarget, setJustUpdatedTarget] = useState(false);
  const [customInput, setCustomInput] = useState<string>(String(targetPercentage));
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    setCustomInput(String(targetPercentage));
    setInputError(null);
  }, [targetPercentage]);

  const overallStats = calculateOverallAttendance(subjects, attendanceDocs);

  const TARGET_PRESETS = [
    { value: 75, label: '75%', desc: 'Standard College Minimum' },
    { value: 80, label: '80%', desc: 'Safe Buffer' },
    { value: 85, label: '85%', desc: 'Distinction / Scholarship' },
    { value: 90, label: '90%', desc: 'Strict Honor Quota' },
  ];

  const handleTargetChange = (val: number) => {
    const clamped = Math.min(100, Math.max(1, Math.round(val)));
    if (onUpdateTargetPercentage) {
      onUpdateTargetPercentage(clamped);
      setJustUpdatedTarget(true);
      setTimeout(() => setJustUpdatedTarget(false), 2500);
    }
    setCustomInput(String(clamped));
    setInputError(null);
  };

  const commitTargetInput = (rawVal: string) => {
    const trimmed = rawVal.trim();
    if (!trimmed) {
      setCustomInput(String(targetPercentage));
      setInputError(null);
      return;
    }
    const parsed = Number(trimmed);
    if (isNaN(parsed) || parsed < 1 || parsed > 100) {
      setInputError('Please enter a percentage between 1 and 100');
      return;
    }
    handleTargetChange(parsed);
  };

  const isSatSun =
    weekendDays.length === 2 && weekendDays.includes(0) && weekendDays.includes(6);
  const isSunOnly = weekendDays.length === 1 && weekendDays.includes(0);

  // Export JSON
  const handleExportJSON = () => {
    const data = {
      user,
      subjects,
      timetables,
      attendance: attendanceDocs,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendease-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export CSV
  const handleExportCSV = () => {
    const rows: string[] = ['Date,Subject Name,Start Time,End Time,Room,Status,Marked At,Note'];

    attendanceDocs.forEach((doc) => {
      doc.classes.forEach((c) => {
        rows.push(
          `"${doc.date}","${c.subjectName}","${c.startTime}","${c.endTime}","${c.room || ''}","${c.status || 'unmarked'}","${c.markedAt || ''}","${(c.note || '').replace(/"/g, '""')}"`
        );
      });
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendease-attendance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = async () => {
    if (!onClearAllData) return;
    setIsClearing(true);
    try {
      await onClearAllData();
      setIsConfirmingClear(false);
      setClearSuccess(true);
      setTimeout(() => setClearSuccess(false), 4000);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div id="settings-view" className="space-y-6 pb-12 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Profile & Settings</h1>
      </div>

      {/* Student Profile Card */}
      <div id="settings-profile-card" className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-gray-200 bg-gray-100 flex items-center justify-center">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : user?.name ? (
                <div className="w-full h-full bg-slate-800 text-white flex items-center justify-center font-bold text-lg">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              ) : (
                <User className="w-7 h-7 text-gray-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">
                  {user?.name || 'Student Guest'}
                </h3>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  user?.email
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-gray-100 text-gray-600 border-gray-200'
                }`}>
                  {user?.email ? 'Google Synced' : 'Local Session'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                {user?.email || 'Local attendance tracking profile'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {user ? (
              <button
                id="settings-logout-btn"
                onClick={onSignOut}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-white hover:bg-rose-50 text-xs sm:text-sm font-semibold text-gray-700 hover:text-rose-600 border border-gray-200 hover:border-rose-200 transition-colors flex items-center gap-2 shadow-2xs cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                id="settings-signin-btn"
                onClick={onSignIn}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-gray-900 hover:bg-black text-xs sm:text-sm font-semibold text-white transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <User className="w-4 h-4" />
                <span>Sign In with Google</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Weekend Configuration Card */}
      <div id="settings-weekend-card" className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-gray-900" />
              <span>Weekend Days (Fixed Recurring Off)</span>
            </h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-800 border border-gray-200 self-start sm:self-auto">
            {formatWeekendSummary(weekendDays)}
          </span>
        </div>

        {/* Quick Presets */}
        <div className="space-y-2 pt-1">
          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            Quick Presets
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              id="weekend-preset-sat-sun"
              type="button"
              onClick={() => onUpdateWeekendDays([0, 6])}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                isSatSun
                  ? 'bg-gray-900 text-white border-gray-900 shadow-xs'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
              }`}
            >
              {isSatSun && <Check className="w-3.5 h-3.5" />}
              <span>Saturday &amp; Sunday</span>
              <span className={`text-[10px] ml-1 px-1.5 py-0.5 rounded-full ${isSatSun ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-500'}`}>
                2 days
              </span>
            </button>

            <button
              id="weekend-preset-sun-only"
              type="button"
              onClick={() => onUpdateWeekendDays([0])}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                isSunOnly
                  ? 'bg-gray-900 text-white border-gray-900 shadow-xs'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
              }`}
            >
              {isSunOnly && <Check className="w-3.5 h-3.5" />}
              <span>Sunday Only</span>
              <span className={`text-[10px] ml-1 px-1.5 py-0.5 rounded-full ${isSunOnly ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-500'}`}>
                1 day
              </span>
            </button>
          </div>
        </div>

        {/* Custom Day Toggles */}
        <div className="space-y-2 pt-1">
          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            Select Individual Off Days
          </label>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {WEEK_DAYS_LIST.map((d) => {
              const isSelected = weekendDays.includes(d.dayIndex);
              return (
                <button
                  key={d.dayIndex}
                  id={`weekend-day-btn-${d.dayIndex}`}
                  type="button"
                  onClick={() => {
                    const next = isSelected
                      ? weekendDays.filter((i) => i !== d.dayIndex)
                      : [...weekendDays, d.dayIndex].sort((a, b) => a - b);
                    onUpdateWeekendDays(next);
                  }}
                  className={`min-h-[44px] py-2 px-1 rounded-xl text-xs font-semibold border flex flex-col items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-gray-900 text-white border-gray-900 shadow-xs ring-1 ring-gray-900'
                      : 'bg-gray-50 hover:bg-white text-gray-600 hover:text-gray-900 border-gray-200'
                  }`}
                >
                  <span className="text-[11px] sm:text-xs font-bold">{d.short}</span>
                  <span className={`text-[9px] mt-0.5 ${isSelected ? 'text-gray-300 font-medium' : 'text-gray-400'}`}>
                    {isSelected ? 'Off' : 'Class'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Target Attendance Percentage Card */}
      <div id="settings-target-percentage-card" className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-gray-900" />
              <span>Target Attendance Percentage</span>
            </h2>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {justUpdatedTarget && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 animate-fade-in">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-gray-900 text-white shadow-2xs">
              {targetPercentage}% Target
            </span>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            Quick Threshold Presets
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TARGET_PRESETS.map((preset) => {
              const isActive = targetPercentage === preset.value;
              return (
                <button
                  key={preset.value}
                  id={`target-preset-${preset.value}`}
                  type="button"
                  onClick={() => handleTargetChange(preset.value)}
                  className={`min-h-[46px] p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'bg-gray-900 text-white border-gray-900 shadow-sm ring-1 ring-gray-900'
                      : 'bg-gray-50 hover:bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold font-mono-numbers">{preset.label}</span>
                    {isActive && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <span className={`text-[10px] mt-0.5 truncate ${isActive ? 'text-gray-300' : 'text-gray-500'}`}>
                    {preset.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Type Custom Target Percentage (Slider Removed) */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label htmlFor="target-percentage-input" className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-gray-500" />
                <span>Type Custom Percentage</span>
              </label>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                commitTargetInput(customInput);
              }}
              className="flex items-center gap-2 self-start sm:self-auto"
            >
              <div className="relative flex items-center">
                <input
                  id="target-percentage-input"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={customInput}
                  onChange={(e) => {
                    setCustomInput(e.target.value);
                    if (inputError) setInputError(null);
                  }}
                  onBlur={() => {
                    if (customInput.trim() !== '' && customInput.trim() !== String(targetPercentage)) {
                      commitTargetInput(customInput);
                    }
                  }}
                  placeholder="75"
                  className="w-24 pl-3 pr-7 py-1.5 text-sm font-bold text-gray-900 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-2xs"
                />
                <span className="absolute right-2.5 text-xs font-bold text-gray-400 pointer-events-none">
                  %
                </span>
              </div>

              <button
                type="submit"
                id="btn-set-custom-target"
                className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-gray-900 hover:bg-black text-xs font-semibold text-white transition-colors cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
              >
                <span>Set</span>
              </button>
            </form>
          </div>

          {inputError && (
            <p className="text-xs text-rose-600 font-medium pt-0.5 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{inputError}</span>
            </p>
          )}
        </div>

        {/* Attendance Goal Standing Banner */}
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${
          overallStats.percentage >= targetPercentage
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
            : 'bg-amber-50/70 border-amber-200 text-amber-900'
        }`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
            overallStats.percentage >= targetPercentage
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
          }`}>
            {overallStats.percentage >= targetPercentage ? (
              <ShieldCheck className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
          </div>
          <div className="space-y-0.5 text-xs">
            <div className="font-bold flex items-center gap-2">
              <span>
                {overallStats.percentage >= targetPercentage
                  ? `Safe Standing (${overallStats.percentage}% vs ${targetPercentage}% target)`
                  : `Attendance Shortage (${overallStats.percentage}% vs ${targetPercentage}% target)`}
              </span>
            </div>
            <p className={overallStats.percentage >= targetPercentage ? 'text-emerald-800' : 'text-amber-800'}>
              {overallStats.totalClasses > 0
                ? `${overallStats.totalAttended} attended and ${overallStats.totalAbsent} missed out of ${overallStats.totalClasses} classes conducted. Note: Bunk margins and class deficits are evaluated per individual subject in the Subjects tab.`
                : `Set your goal to ${targetPercentage}%. Individual bunk margins and attendance requirements are computed separately for each subject.`}
            </p>
          </div>
        </div>
      </div>

      {/* Google Sheets Live Linked Spreadsheet */}
      <div id="settings-google-sheets-card" className="bg-white border border-emerald-200/90 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">Google Sheets Live Sync</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Google Workspace
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Live attendance spreadsheet created and saved in your Gmail Google Drive
              </p>
            </div>
          </div>

          {user?.googleSpreadsheetId && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Linked
              </span>
            </div>
          )}
        </div>

        {/* Not Signed in with Google State */}
        {!user || user.id.startsWith('guest_') ? (
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-800">Sign in with your Google account</p>
              <p className="text-xs text-gray-600 max-w-lg">
                Connect your Gmail account to automatically create and sync a dedicated Google Sheet with live subject quotas, bunk allowances, and daily logs.
              </p>
            </div>
            <button
              onClick={onSignIn}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-gray-900 hover:bg-black text-xs font-bold text-white transition-colors flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-xs"
            >
              <span>Sign in with Google</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : !user.googleSpreadsheetId ? (
          /* Signed In, but Spreadsheet Not Built Yet */
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs text-emerald-900 space-y-2">
              <p className="font-semibold flex items-center gap-1.5 text-emerald-950">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>One-click Google Drive spreadsheet integration</span>
              </p>
              <p className="text-emerald-800 leading-relaxed">
                We will build a spreadsheet named <span className="font-semibold">"Attendzy - Live Attendance ({user.name})"</span> directly inside your Google Drive account (<span className="font-mono text-[11px] bg-white/80 px-1 py-0.5 rounded border border-emerald-200">{user.email}</span>) with two formatted tabs:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200/70">
                  <span className="font-bold text-emerald-950 block">1. Live Subject Stats Tab</span>
                  <span className="text-gray-600">Calculates Attended/Total, exact %, Status, and how many classes you can safely bunk or must attend.</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200/70">
                  <span className="font-bold text-emerald-950 block">2. Daily Attendance Log Tab</span>
                  <span className="text-gray-600">Full chronological breakdown with date, weekday, subject, status, time slots, and notes.</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                id="btn-build-google-sheet"
                onClick={onBuildGoogleSheet}
                disabled={isGoogleSheetCreating}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-xs sm:text-sm font-bold text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow disabled:opacity-60"
              >
                {isGoogleSheetCreating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Building Spreadsheet in your Drive...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Build Live Spreadsheet in Google Sheets</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Spreadsheet is Linked and Active */
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900">
                    {user.googleSpreadsheetName || 'Attendzy - Live Attendance'}
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-md">
                    Connected
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-mono text-[11px] truncate max-w-md">
                  Google Drive Account: <span className="text-gray-800 font-semibold">{user.email}</span>
                </p>
                {user.lastGoogleSheetSyncTime && (
                  <p className="text-[11px] text-gray-500">
                    Last live synced: <span className="font-medium text-gray-700">{new Date(user.lastGoogleSheetSyncTime).toLocaleString()}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                {user.googleSpreadsheetUrl && (
                  <a
                    href={user.googleSpreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    id="btn-open-google-sheet"
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span>Open in Google Sheets</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                <button
                  id="btn-sync-google-sheet-now"
                  onClick={onSyncGoogleSheet}
                  disabled={isGoogleSheetSyncing}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white hover:bg-gray-100 border border-gray-300 text-xs font-semibold text-gray-800 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-gray-600 ${isGoogleSheetSyncing ? 'animate-spin' : ''}`} />
                  <span>{isGoogleSheetSyncing ? 'Syncing...' : 'Sync Now'}</span>
                </button>

                <button
                  id="btn-unlink-google-sheet"
                  onClick={onUnlinkGoogleSheet}
                  title="Unlink this spreadsheet from Attendzy"
                  className="min-h-[38px] px-2.5 py-1.5 rounded-xl text-gray-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 text-xs transition-colors cursor-pointer"
                >
                  <Unlink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Auto Sync Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/40 border border-emerald-100">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-gray-900 block">Auto-Sync on Attendance Changes</span>
                <span className="text-[11px] text-gray-600 block">
                  Automatically updates your Google Sheet whenever you mark present, absent, or edit classes in Attendzy.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                <input
                  type="checkbox"
                  checked={user.autoSyncGoogleSheets !== false}
                  onChange={(e) => onToggleAutoSyncGoogleSheet && onToggleAutoSyncGoogleSheet(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Data Export Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Download className="w-5 h-5 text-gray-900" />
            <span>Export Attendance Records</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <button
            onClick={handleExportCSV}
            className="min-h-[44px] p-4 rounded-xl bg-gray-50 hover:bg-white border border-gray-200 hover:border-gray-400 text-left transition-all flex items-center justify-between group active:scale-[0.98] shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 group-hover:text-black transition-colors">
                  Spreadsheet (CSV)
                </h4>
                <p className="text-xs text-gray-500">Excel / Sheets compatible log</p>
              </div>
            </div>
            <Download className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" />
          </button>

          <button
            onClick={handleExportJSON}
            className="min-h-[44px] p-4 rounded-xl bg-gray-50 hover:bg-white border border-gray-200 hover:border-gray-400 text-left transition-all flex items-center justify-between group active:scale-[0.98] shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-200 text-gray-800 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 group-hover:text-black transition-colors">
                  Full Backup (JSON)
                </h4>
                <p className="text-xs text-gray-500">Subjects + Schedules + Marks</p>
              </div>
            </div>
            <Download className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" />
          </button>
        </div>
      </div>

      {/* Clear All Data */}
      {onClearAllData && (
        <div className="bg-white border border-rose-200/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-600" />
              <span>Clear All Data</span>
            </h2>
          </div>

          {clearSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>All attendance records and subjects have been cleared.</span>
            </div>
          )}

          {isConfirmingClear ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-rose-50 border border-rose-200 p-3.5 rounded-xl">
              <span className="text-xs text-rose-800 font-semibold">
                Delete all subjects, timetables, and attendance marks permanently?
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleClear}
                  disabled={isClearing}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer disabled:opacity-50"
                >
                  {isClearing ? 'Clearing...' : 'Yes, Delete All'}
                </button>
                <button
                  onClick={() => setIsConfirmingClear(false)}
                  disabled={isClearing}
                  className="px-3 py-1.5 rounded-lg text-gray-700 hover:bg-rose-100 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsConfirmingClear(true)}
              disabled={isClearing}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-white hover:bg-rose-50 text-xs sm:text-sm font-semibold text-rose-600 hover:text-rose-700 border border-rose-200 hover:border-rose-300 transition-colors flex items-center gap-2 shadow-2xs cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear All Data & Subjects</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
