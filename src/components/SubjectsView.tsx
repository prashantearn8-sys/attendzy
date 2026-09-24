import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Subject } from '../types/attendance';
import {
  calculateSubjectAttendance,
  calculateSafeBunksOrNeeded,
  DEFAULT_TARGET_PERCENTAGE,
} from '../utils/attendanceCalculations';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  X,
  Target,
} from 'lucide-react';

interface SubjectsViewProps {
  subjects: Subject[];
  targetPercentage?: number;
  onSaveSubject: (subject: Partial<Subject>) => Promise<void>;
  onDeleteSubject: (subjectId: string) => Promise<void>;
  onRecalculateTotals: () => Promise<void>;
}

const SUBJECT_COLOR_PALETTE = [
  '#000000',
  '#2563eb',
  '#059669',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#0891b2',
  '#4f46e5',
];

export const SubjectsView: React.FC<SubjectsViewProps> = ({
  subjects,
  targetPercentage = DEFAULT_TARGET_PERCENTAGE,
  onSaveSubject,
  onDeleteSubject,
  onRecalculateTotals,
}) => {
  const [editingSubject, setEditingSubject] = useState<Partial<Subject> | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'safe' | 'deficit'>('all');

  // Attendance metrics across all enrolled courses
  const safeCount = subjects.filter((s) => calculateSubjectAttendance(s) >= targetPercentage).length;
  const deficitCount = subjects.length - safeCount;
  const overallAttended = subjects.reduce((acc, s) => acc + s.attendedClasses, 0);
  const overallTotal = subjects.reduce((acc, s) => acc + s.totalClasses, 0);
  const overallPct = overallTotal > 0 ? Math.round((overallAttended / overallTotal) * 1000) / 10 : 0;

  const filteredSubjects = subjects.filter((s) => {
    if (filterStatus === 'safe') return calculateSubjectAttendance(s) >= targetPercentage;
    if (filterStatus === 'deficit') return calculateSubjectAttendance(s) < targetPercentage;
    return true;
  });

  const openAddForm = () => {
    setEditingSubject({
      name: '',
      code: '',
      teacher: '',
      totalClasses: 0,
      attendedClasses: 0,
      color: SUBJECT_COLOR_PALETTE[Math.floor(Math.random() * SUBJECT_COLOR_PALETTE.length)],
    });
    setIsFormOpen(true);
  };

  const openEditForm = (subject: Subject) => {
    setEditingSubject({ ...subject });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject || !editingSubject.name) return;

    setIsSubmitting(true);
    try {
      await onSaveSubject(editingSubject);
      setIsFormOpen(false);
      setEditingSubject(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await onDeleteSubject(id);
    setDeletingSubjectId(null);
  };

  return (
    <div id="subjects-view" className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-gray-900" />
            <span>Course Subjects & Attendance Targets</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Manage your enrolled courses, faculty names, and individual {targetPercentage}% attendance targets.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={onRecalculateTotals}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-700 hover:text-gray-900 hover:border-gray-400 shadow-sm transition-colors cursor-pointer"
            title="Recalculate cumulative counts from all calendar records"
          >
            Recalculate
          </motion.button>
          <motion.button
            id="btn-add-new-subject"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              if (isFormOpen && !editingSubject?.id) {
                setIsFormOpen(false);
              } else {
                openAddForm();
              }
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isFormOpen && !editingSubject?.id ? 'Close Form' : 'Add Subject'}</span>
          </motion.button>
        </div>
      </div>

      {/* Inline Add / Edit Subject Form (NO POPUP MODAL) */}
      <AnimatePresence>
        {isFormOpen && editingSubject && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-base font-bold text-gray-900">
                  {editingSubject.id ? 'Edit Subject' : 'Add New Subject'}
                </h3>
                <button
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingSubject(null);
                  }}
                  className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-gray-700 font-semibold block mb-1.5">
                    Subject Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingSubject.name || ''}
                    onChange={(e) =>
                      setEditingSubject({ ...editingSubject, name: e.target.value })
                    }
                    placeholder="e.g. Mathematics"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:bg-white transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-700 font-semibold block mb-1.5">
                      Subject Code
                    </label>
                    <input
                      type="text"
                      value={editingSubject.code || ''}
                      onChange={(e) =>
                        setEditingSubject({ ...editingSubject, code: e.target.value })
                      }
                      placeholder="e.g. MATH101"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 font-semibold block mb-1.5">
                      Faculty / Teacher
                    </label>
                    <input
                      type="text"
                      value={editingSubject.teacher || ''}
                      onChange={(e) =>
                        setEditingSubject({ ...editingSubject, teacher: e.target.value })
                      }
                      placeholder="e.g. Dr. Smith"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-700 font-semibold block mb-1.5">
                      Total Classes Held
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingSubject.totalClasses ?? 0}
                      onChange={(e) =>
                        setEditingSubject({
                          ...editingSubject,
                          totalClasses: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:bg-white transition-all font-mono-numbers"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 font-semibold block mb-1.5">
                      Classes Attended
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingSubject.attendedClasses ?? 0}
                      onChange={(e) =>
                        setEditingSubject({
                          ...editingSubject,
                          attendedClasses: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:bg-white transition-all font-mono-numbers"
                    />
                  </div>
                </div>

                {/* Color Palette */}
                <div>
                  <label className="text-xs text-gray-700 font-semibold block mb-1.5">
                    Accent Color
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {SUBJECT_COLOR_PALETTE.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setEditingSubject({ ...editingSubject, color: c })}
                        className={`w-9 h-9 rounded-xl transition-all cursor-pointer ${
                          editingSubject.color === c
                            ? 'scale-110 ring-2 ring-gray-900 ring-offset-2 ring-offset-white shadow-xs'
                            : 'opacity-85 hover:opacity-100 hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditingSubject(null);
                    }}
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Subject'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overview Analytics Banner & Filter Tabs */}
      {subjects.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <span>Attendance Target Status</span>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                  Target: {targetPercentage}%
                </span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {safeCount} of {subjects.length} course{subjects.length === 1 ? '' : 's'} meeting your attendance target
              </p>
            </div>

            {/* Segmented Filter Control */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterStatus === 'all'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                All ({subjects.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('safe')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterStatus === 'safe'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-gray-500 hover:text-emerald-700'
                }`}
              >
                On Track ({safeCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('deficit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterStatus === 'deficit'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-gray-500 hover:text-rose-700'
                }`}
              >
                Needs Attendance ({deficitCount})
              </button>
            </div>
          </div>

          {/* Aggregate Progress vs Target Bar */}
          <div className="pt-1">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-600 font-medium">
                Overall Course Average: <strong className="font-mono text-gray-900">{overallPct}%</strong>
              </span>
              <span className="text-gray-500 text-[11px] font-mono">
                {overallAttended} / {overallTotal} Total Classes
              </span>
            </div>
            <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
              {/* Safe zone overlay from target to 100% */}
              <div
                className="absolute top-0 bottom-0 bg-emerald-500/10 pointer-events-none"
                style={{ left: `${Math.min(100, Math.max(0, targetPercentage))}%`, right: 0 }}
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, overallPct))}%` }}
                transition={{ duration: 0.6 }}
                className={`h-full rounded-full ${
                  overallPct >= targetPercentage ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              {/* Target vertical indicator */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-gray-950 z-10"
                style={{ left: `${Math.min(100, Math.max(0, targetPercentage))}%` }}
                title={`Target: ${targetPercentage}%`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Subject Cards Grid */}
      {filteredSubjects.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-gray-700">No subjects found in this view</p>
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-black cursor-pointer"
          >
            Show All Subjects
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSubjects.map((sub) => {
            const pct = calculateSubjectAttendance(sub);
            const isSafe = pct >= targetPercentage;
            const delta = pct - targetPercentage;
            const quota = calculateSafeBunksOrNeeded(sub.attendedClasses, sub.totalClasses, targetPercentage);

            return (
              <motion.div
                key={sub.id}
                whileHover={{ scale: 1.01 }}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:border-gray-300 space-y-4 relative overflow-hidden transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: sub.color || '#000' }}
                        />
                        <h3 className="font-bold text-gray-900 text-base leading-tight">
                          {sub.name}
                        </h3>
                      </div>
                      {sub.code && (
                        <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                          {sub.code}
                        </span>
                      )}
                      {sub.teacher && (
                        <p className="text-xs text-gray-500">Faculty: {sub.teacher}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditForm(sub)}
                        className="min-h-[44px] min-w-[44px] p-2 text-gray-400 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center cursor-pointer"
                        title="Edit subject"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Inline Delete Confirmation */}
                      {deletingSubjectId === sub.id ? (
                        <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl">
                          <span className="text-xs text-rose-700 font-bold">Delete?</span>
                          <button
                            onClick={() => handleDelete(sub.id)}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeletingSubjectId(null)}
                            className="px-2 py-1 rounded-lg text-gray-500 hover:bg-rose-100 text-xs cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingSubjectId(sub.id)}
                          className="min-h-[44px] min-w-[44px] p-2 text-gray-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors flex items-center justify-center cursor-pointer"
                          title="Delete subject"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Visual Current vs Target Attendance Section */}
                  <div className="space-y-3 pt-3 border-t border-gray-100">
                    {/* Benchmark Comparison Header */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 font-medium">Current:</span>
                        <span
                          className={`font-black font-mono text-base ${
                            isSafe ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {pct}%
                        </span>
                        <span
                          className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                            isSafe
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {delta >= 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200/80">
                        <Target className="w-3.5 h-3.5 text-gray-900" />
                        <span className="text-[11px] text-gray-500 font-medium">Target:</span>
                        <span className="font-bold text-gray-900 font-mono text-xs">{targetPercentage}%</span>
                      </div>
                    </div>

                    {/* Visual Comparative Progress Bar with Target Notch */}
                    <div className="relative pt-1 pb-4.5 select-none">
                      {/* Outer Track */}
                      <div className="relative w-full h-3.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                        {/* Safe Zone Background Indicator (from target to 100%) */}
                        <div
                          className="absolute top-0 bottom-0 bg-emerald-500/10 pointer-events-none"
                          style={{ left: `${Math.min(100, Math.max(0, targetPercentage))}%`, right: 0 }}
                        />

                        {/* Active Attendance Progress Fill */}
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                          transition={{ duration: 0.65, ease: 'easeOut' }}
                          className={`h-full rounded-full transition-all relative ${
                            isSafe ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                      </div>

                      {/* Target Benchmark Notch & Marker */}
                      <div
                        className="absolute top-1 bottom-4.5 pointer-events-none transition-all z-10"
                        style={{ left: `${Math.min(100, Math.max(0, targetPercentage))}%` }}
                      >
                        {/* Top Marker Arrow Pip */}
                        <div className="absolute -top-1 -translate-x-1/2 w-2 h-1.5 bg-gray-900 rounded-t-xs" />
                        {/* Vertical Benchmark Rule */}
                        <div className="absolute top-0 -translate-x-1/2 w-0.5 h-3.5 bg-gray-950 shadow-xs" />
                        {/* Bottom Indicator Label */}
                        <div className="absolute top-4 -translate-x-1/2 flex items-center">
                          <span className="text-[9px] font-bold font-mono text-gray-700 bg-white px-1 py-0.2 rounded border border-gray-200 shadow-2xs whitespace-nowrap">
                            Target {targetPercentage}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Classes Count & Threshold Verdict */}
                    <div className="flex items-center justify-between text-xs pt-0.5 text-gray-600">
                      <div className="flex items-center gap-1.5 font-medium">
                        {isSafe ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        )}
                        <span className={isSafe ? 'text-emerald-700' : 'text-rose-700'}>
                          {isSafe ? `Target Met (Safe)` : `Attendance Shortage`}
                        </span>
                      </div>
                      <div className="font-mono font-medium text-gray-700 text-xs">
                        <span className="font-bold text-gray-900">{sub.attendedClasses}</span> / {sub.totalClasses} classes
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actionable Bunk or Deficit Insight */}
                <div className="pt-1">
                  {sub.totalClasses > 0 ? (
                    <div
                      className={`text-xs p-2.5 rounded-xl border font-medium flex items-center justify-between gap-2 ${
                        isSafe
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                          : 'bg-rose-50/70 border-rose-200 text-rose-950'
                      }`}
                    >
                      <div className="truncate">
                        <span className="font-bold text-gray-900 mr-1.5">
                          {isSafe ? 'Safe Margin:' : 'Deficit:'}
                        </span>
                        <span className="text-gray-700">{quota.message}</span>
                      </div>
                      <span
                        className={`font-mono font-bold text-xs shrink-0 px-2 py-0.5 rounded-md ${
                          isSafe ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isSafe ? (quota.count > 0 ? `+${quota.count} bunks` : '0 bunks') : `+${quota.count} needed`}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-400 italic text-center py-1.5 bg-gray-50 rounded-xl border border-gray-100">
                      No classes held yet
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
