import { Loader2 } from 'lucide-react';

export function PdfLoadingOverlay() {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm print:hidden">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 max-w-xs w-full mx-4">
        <div className="w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
        </div>
        <div className="text-center">
          <p className="font-bold text-slate-800 dark:text-slate-100 text-base">Gerando PDF</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Isso leva apenas alguns segundos...
          </p>
        </div>
      </div>
    </div>
  );
}
