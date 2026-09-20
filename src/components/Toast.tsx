import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = () => {
  return null;
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-[#7C5CFC] shrink-0" />,
  };

  const bgStyles = {
    success: 'border-emerald-500/30 bg-[#0F0F17]/95 shadow-emerald-500/10',
    error: 'border-rose-500/30 bg-[#0F0F17]/95 shadow-rose-500/10',
    info: 'border-[#7C5CFC]/30 bg-[#0F0F17]/95 shadow-[#7C5CFC]/10',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`pointer-events-auto p-3.5 rounded-xl border backdrop-blur-lg shadow-xl flex items-center justify-between gap-3 text-sm text-gray-200 ${bgStyles[toast.type]}`}
    >
      <div className="flex items-center gap-2.5">
        {icons[toast.type]}
        <span className="font-medium text-xs sm:text-sm">{toast.message}</span>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#161622] transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};
