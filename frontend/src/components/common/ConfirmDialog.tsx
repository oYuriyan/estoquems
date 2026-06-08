import { AlertTriangle } from 'lucide-react';
import type { ConfirmDialog as ConfirmDialogType } from '../../types';

interface ConfirmDialogProps {
  dialog: ConfirmDialogType;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ dialog, onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm backdrop-enter print:hidden">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md modal-enter overflow-hidden">
        <div className="p-6 pb-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 text-center mb-2">
            {dialog.title}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center leading-relaxed">
            {dialog.message}
          </p>
        </div>
        <div className="flex border-t border-slate-100 dark:border-slate-800/50">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 dark:bg-[#0f172a] transition-colors border-r border-slate-100 dark:border-slate-800/50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
