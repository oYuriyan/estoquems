import { Search, X, LayoutGrid, List } from 'lucide-react';
import clsx from 'clsx';
import { ItemCard } from './ItemCard';
import type { GroupedItem, Equipamento } from '../../types';

interface CatalogViewProps {
  groupedEstoque: GroupedItem[];
  sortedGroupedEstoque: GroupedItem[];
  viewMode: 'cards' | 'list';
  cart: Equipamento[];
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  hasActiveFilters: boolean;
  onGroupClick: (group: GroupedItem) => void;
  onViewModeChange: (mode: 'cards' | 'list') => void;
  onSort: (key: string) => void;
  onResetFilters: () => void;
}

function SortHeader({ label, sortKey, sortConfig, onSort }: {
  label: string; sortKey: string;
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (key: string) => void;
}) {
  const arrow = sortConfig?.key === sortKey ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : '';
  return (
    <th
      onClick={() => onSort(sortKey)}
      className="py-4 px-5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#161b22] select-none transition-colors"
    >
      {label}{arrow}
    </th>
  );
}

export function CatalogView({
  groupedEstoque, sortedGroupedEstoque, viewMode, cart, sortConfig,
  hasActiveFilters, onGroupClick, onViewModeChange, onSort, onResetFilters,
}: CatalogViewProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          {groupedEstoque.length} agrupamento{groupedEstoque.length !== 1 ? 's' : ''}
        </h2>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#161b22] rounded-lg p-1 border border-slate-200 dark:border-[#30363d]">
          <button
            onClick={() => onViewModeChange('cards')}
            className={clsx('p-1.5 rounded transition-all', viewMode === 'cards' ? 'bg-white dark:bg-[#0d1117] shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300')}
            title="Cards"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={clsx('p-1.5 rounded transition-all', viewMode === 'list' ? 'bg-white dark:bg-[#0d1117] shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300')}
            title="Lista"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {groupedEstoque.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/50 border-dashed p-16 text-center shadow-sm">
          <Search className="w-14 h-14 text-slate-300 mx-auto mb-5" />
          <p className="text-slate-600 dark:text-slate-300 text-lg font-bold mb-2">Nenhum equipamento encontrado</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm max-w-md mx-auto mb-5">
            Verifique os termos digitados ou tente buscar de forma mais genérica.
          </p>
          {hasActiveFilters && (
            <button
              onClick={onResetFilters}
              className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl border border-indigo-200 transition-colors"
            >
              <X className="w-4 h-4" /> Limpar filtros
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-24">
          {groupedEstoque.map(group => (
            <ItemCard key={group.key} group={group} cart={cart} onClick={onGroupClick} />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#161b22] rounded-xl border border-slate-200 dark:border-[#30363d] shadow-sm overflow-hidden mb-8">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-[#0d1117] border-b border-slate-200 dark:border-[#30363d]">
              <tr>
                <SortHeader label="Marca"               sortKey="marca"           sortConfig={sortConfig} onSort={onSort} />
                <SortHeader label="Modelo"              sortKey="modelo"          sortConfig={sortConfig} onSort={onSort} />
                <SortHeader label="Processador"         sortKey="processador"     sortConfig={sortConfig} onSort={onSort} />
                <SortHeader label="RAM"                 sortKey="ram"             sortConfig={sortConfig} onSort={onSort} />
                <SortHeader label="Armazenamento"       sortKey="armazenamento"   sortConfig={sortConfig} onSort={onSort} />
                <SortHeader label="Sistema Operacional" sortKey="so"              sortConfig={sortConfig} onSort={onSort} />
                <SortHeader label="Qtd"                 sortKey="qtd"             sortConfig={sortConfig} onSort={onSort} />
                <SortHeader label="Cotados"             sortKey="cotados"         sortConfig={sortConfig} onSort={onSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {sortedGroupedEstoque.map(group => {
                const cartCount = cart.filter(c => group.items.some(i => i.idPatrimonio === c.idPatrimonio)).length;
                return (
                  <tr
                    key={group.key}
                    onClick={() => onGroupClick(group)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/60 dark:bg-[#0f172a] cursor-pointer transition-all duration-200"
                  >
                    <td className="py-4 px-5">
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700/50 uppercase tracking-wide">
                        {group.marca}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <div className="text-sm font-black text-slate-800 dark:text-slate-100">{group.modelo}</div>
                      <div className="text-[10px] text-indigo-500/70 font-bold uppercase tracking-wider mt-0.5">{group.tipo}</div>
                    </td>
                    <td className="py-4 px-5 text-[13px] font-semibold text-slate-700 dark:text-slate-200">{group.processador}</td>
                    <td className="py-4 px-5 text-[13px] font-semibold text-slate-700 dark:text-slate-200">{group.ram}</td>
                    <td className="py-4 px-5 text-[13px] font-semibold text-slate-700 dark:text-slate-200">{group.armazenamento}</td>
                    <td className="py-4 px-5 text-[13px] font-medium text-slate-500 dark:text-slate-400">{group.so}</td>
                    <td className="py-3.5 px-5 text-center">
                      <span className="inline-flex items-center justify-center bg-indigo-50 text-indigo-700 font-black px-2.5 py-1 rounded-lg text-sm border border-indigo-200">{group.items.length}</span>
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      {cartCount > 0
                        ? <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 font-bold text-xs px-2.5 py-1 rounded-lg border border-amber-200">{cartCount}</span>
                        : <span className="text-slate-300 text-xs">—</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
