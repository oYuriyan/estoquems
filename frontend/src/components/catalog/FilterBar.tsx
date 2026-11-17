import { X } from 'lucide-react';
import clsx from 'clsx';

interface FilterBarProps {
  brands: string[];
  types: string[];
  activeType: string | null;
  onTypeChange: (type: string | null) => void;
  activeBrand: string | null;
  statusFilter: string | null;
  onBrandChange: (brand: string | null) => void;
  onClearStatusFilter: () => void;
}

export function FilterBar({ brands, types, activeType, onTypeChange, activeBrand, statusFilter, onBrandChange, onClearStatusFilter }: FilterBarProps) {
  if (brands.length === 0 && !statusFilter) {
    return <div data-tour="filter-bar" className="w-full h-0 pointer-events-none" />;
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-3">
        <label htmlFor="equipment-type" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Equipamento</label>
        <select id="equipment-type" value={activeType || ''} onChange={event => onTypeChange(event.target.value || null)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs bg-white dark:bg-[#161b22] dark:text-slate-200">
          <option value="">Todos os tipos</option>
          {[...new Set(['NOTEBOOK', ...types])].map(type => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>
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
