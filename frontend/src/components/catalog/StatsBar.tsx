import { Server, Package, HardDrive } from 'lucide-react';
import clsx from 'clsx';

interface StatsBarProps {
  totalItems: number;
  totalNovos: number;
  totalUsados: number;
  statusFilter: string | null;
  onFilterChange: (filter: string | null) => void;
}

export function StatsBar({ totalItems, totalNovos, totalUsados, statusFilter, onFilterChange }: StatsBarProps) {

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4" data-tour="stats-bar">
      <button
        onClick={() => onFilterChange(null)}
        className={clsx(
          'bg-white dark:bg-[#161b22] rounded-xl p-4 shadow-sm border text-left flex flex-col justify-between transition-all',
          !statusFilter
            ? 'border-indigo-400 dark:border-indigo-500/60 ring-2 ring-indigo-100 dark:ring-indigo-500/10'
            : 'border-slate-200 dark:border-[#30363d] hover:border-slate-300',
        )}
      >
        <div className="flex justify-between items-start mb-2">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">Todos</span>
          <Server className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{totalItems}</div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">total encontrado</div>
      </button>

      <button
        onClick={() => onFilterChange(statusFilter === 'NOVO' ? null : 'NOVO')}
        className={clsx(
          'bg-white dark:bg-[#161b22] rounded-xl p-4 shadow-sm border text-left flex flex-col justify-between transition-all',
          statusFilter === 'NOVO'
            ? 'border-blue-400 dark:border-blue-500/60 ring-2 ring-blue-100 dark:ring-blue-500/10'
            : 'border-slate-200 dark:border-[#30363d] hover:border-blue-200',
        )}
      >
        <div className="flex justify-between items-start mb-2">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">Novos</span>
          <Package className="w-4 h-4 text-blue-400" />
        </div>
        <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{totalNovos}</div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">clique para filtrar</div>
      </button>

      <button
        onClick={() => onFilterChange(statusFilter === 'USADO' ? null : 'USADO')}
        className={clsx(
          'bg-white dark:bg-[#161b22] rounded-xl p-4 shadow-sm border text-left flex flex-col justify-between transition-all',
          statusFilter === 'USADO'
            ? 'border-amber-400 dark:border-amber-500/60 ring-2 ring-amber-100 dark:ring-amber-500/10'
            : 'border-slate-200 dark:border-[#30363d] hover:border-amber-200',
        )}
      >
        <div className="flex justify-between items-start mb-2">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">Usados</span>
          <HardDrive className="w-4 h-4 text-amber-400" />
        </div>
        <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{totalUsados}</div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">clique para filtrar</div>
      </button>
    </div>
  );
}
