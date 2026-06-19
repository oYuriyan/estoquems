import { X } from 'lucide-react';
import clsx from 'clsx';

interface FilterBarProps {
  brands: string[];
  activeBrand: string | null;
  statusFilter: string | null;
  onBrandChange: (brand: string | null) => void;
  onClearStatusFilter: () => void;
}

export function FilterBar({ brands, activeBrand, statusFilter, onBrandChange, onClearStatusFilter }: FilterBarProps) {
  if (brands.length === 0 && !statusFilter) {
    return <div data-tour="filter-bar" className="w-full h-0 pointer-events-none" />;
  }

  return (
    <>
      {brands.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-3" data-tour="filter-bar">
          <button
            onClick={() => onBrandChange(null)}
            className={clsx(
              'whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-bold transition-all border',
              !activeBrand
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white dark:bg-[#161b22] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#30363d] hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400',
            )}
          >
            Todas as Marcas
          </button>
          {brands.map(marca => (
            <button
              key={marca}
              onClick={() => onBrandChange(marca)}
              className={clsx(
                'whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-bold transition-all border',
                activeBrand === marca
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white dark:bg-[#161b22] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#30363d] hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400',
              )}
            >
              {marca}
            </button>
          ))}
        </div>
      )}

      {statusFilter && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">Filtrando por:</span>
          <span className={clsx(
            'text-xs font-bold px-3 py-1 rounded-full border',
            statusFilter === 'NOVO'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-amber-50 text-amber-700 border-amber-200',
          )}>
            {statusFilter}
          </span>
          <button
            onClick={onClearStatusFilter}
            className="text-xs text-slate-400 dark:text-slate-500 hover:text-red-500 flex items-center gap-1"
          >
            <X className="w-3 h-3" /> limpar filtro
          </button>
        </div>
      )}
    </>
  );
}
