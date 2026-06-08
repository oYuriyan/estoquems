import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import clsx from 'clsx';
import type { Toast } from '../../types';

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 print:hidden">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={clsx(
            'flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border backdrop-blur-md min-w-[320px] max-w-[420px] transition-all',
            toast.exiting ? 'toast-exit' : 'toast-enter',
            toast.type === 'success' && 'bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-100',
            toast.type === 'error'   && 'bg-red-50/95 dark:bg-red-950/90 border-red-300 dark:border-red-800/50 text-red-900 dark:text-red-100',
            toast.type === 'info'    && 'bg-blue-50/95 dark:bg-blue-950/90 border-blue-300 dark:border-blue-800/50 text-blue-900 dark:text-blue-100',
          )}
        >
          {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />}
          {toast.type === 'error'   && <AlertCircle  className="w-5 h-5 text-red-500 shrink-0" />}
          {toast.type === 'info'    && <Info          className="w-5 h-5 text-blue-500 shrink-0" />}
          <span className="text-sm font-semibold flex-1">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="text-current opacity-40 hover:opacity-100 transition-opacity shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
