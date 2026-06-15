import { memo, useRef, useEffect } from 'react';
import { X, LayoutGrid, List, Cpu, MemoryStick, HardDrive, Monitor } from 'lucide-react';
import clsx from 'clsx';
import { ItemCard } from './ItemCard';
import type { GroupedItem, Equipamento } from '../../types';

interface CatalogViewProps {
  groupedEstoque: GroupedItem[];
  totalGroups: number;
  viewMode: 'cards' | 'list';
  cart: Equipamento[];
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  hasActiveFilters: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onGroupClick: (group: GroupedItem) => void;
  onViewModeChange: (mode: 'cards' | 'list') => void;
  onSort: (key: string) => void;
  onResetFilters: () => void;
}

function SortHeader({ label, sortKey, sortConfig, onSort, className = "" }: {
  label: string; sortKey: string;
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (key: string) => void;
  className?: string;
}) {
  const arrow = sortConfig?.key === sortKey ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : '';
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={clsx("py-4 px-3 md:px-5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#161b22] select-none transition-colors", className)}
    >
      {label}{arrow}
    </th>
  );
}

function CatalogViewComponent({
  groupedEstoque, totalGroups, viewMode, cart, sortConfig,
  hasActiveFilters, hasMore, isLoadingMore, onLoadMore, 
  onGroupClick, onViewModeChange, onSort, onResetFilters,
}: CatalogViewProps) {
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && onLoadMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '300px' }
    );

    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);
  // O agrupamento por tipo causava Layout Shifts pesados na paginação server-side.
  // Agora usamos um Grid contínuo estilo E-commerce, que é perfeitamente fluido.

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          {totalGroups} agrupamento{totalGroups !== 1 ? 's' : ''}
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
        <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-slate-200 dark:border-[#30363d] border-dashed p-16 text-center shadow-sm">
          <div className="flex justify-center mb-6 opacity-60">
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M60 10L105 35V85L60 110L15 85V35L60 10Z" fill="#F1F5F9" stroke="#CBD5E1" className="dark:fill-slate-800 dark:stroke-slate-700" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M60 10L60 60M60 60L105 35M60 60L15 35" stroke="#CBD5E1" className="dark:stroke-slate-700" strokeWidth="2" strokeLinejoin="round"/>
              <circle cx="60" cy="50" r="10" fill="#E2E8F0" className="dark:fill-slate-700"/>
              <path d="M55 50L60 55L65 45" stroke="#94A3B8" className="dark:stroke-slate-500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-slate-700 dark:text-slate-200 text-xl font-black mb-2">Nenhum equipamento encontrado</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 pb-12" data-tour="catalog-grid">
          {groupedEstoque.map((group, index) => {
            const cartCountInGroup = cart.filter(c =>
              group.items.some(i => i.idPatrimonio === c.idPatrimonio)
            ).length;
            
            return (
              <ItemCard 
                key={group.key} 
                group={group} 
                cartCount={cartCountInGroup} 
                onClick={onGroupClick} 
                className="animate-fade-slide-up"
                style={{ animationDelay: `${Math.min(index * 0.05, 0.5)}s` }}
              />
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#161b22] rounded-xl border border-slate-200 dark:border-[#30363d] shadow-sm overflow-hidden mb-8">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-[#0d1117] border-b border-slate-200 dark:border-[#30363d]">
              <tr>
                <SortHeader label="Marca"               sortKey="marca"           sortConfig={sortConfig} onSort={onSort} className="hidden md:table-cell" />
                <SortHeader label="Modelo"              sortKey="modelo"          sortConfig={sortConfig} onSort={onSort} />
                <SortHeader label="Processador"         sortKey="processador"     sortConfig={sortConfig} onSort={onSort} className="hidden md:table-cell" />
                <SortHeader label="RAM"                 sortKey="ram"             sortConfig={sortConfig} onSort={onSort} className="hidden md:table-cell" />
                <SortHeader label="Armaz."              sortKey="armazenamento"   sortConfig={sortConfig} onSort={onSort} className="hidden lg:table-cell" />
                <SortHeader label="S.O."                sortKey="so"              sortConfig={sortConfig} onSort={onSort} className="hidden lg:table-cell" />
                <SortHeader label="Quantidade"          sortKey="qtd"             sortConfig={sortConfig} onSort={onSort} />
                <SortHeader label="Cotados"             sortKey="cotados"         sortConfig={sortConfig} onSort={onSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {groupedEstoque.map(group => {
                const cartCount = cart.filter(c => group.items.some(i => i.idPatrimonio === c.idPatrimonio)).length;
                return (
                  <tr
                    key={group.key}
                    onClick={() => onGroupClick(group)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/60 dark:bg-[#0f172a] cursor-pointer transition-all duration-200"
                  >
                    <td className="py-4 px-3 md:px-5 hidden md:table-cell">
                      <span className="text-[10px] md:text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 px-2 md:px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700/50 uppercase tracking-wide">
                        {group.marca}
                      </span>
                    </td>
                    <td className="py-4 px-3 md:px-5">
                      <div className="flex items-center gap-2">
                        {group.tipo?.toUpperCase() === 'DESKTOP' ? (
                          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3M3 8a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v4H3V8z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l1-2h2l1 2" />
                            </svg>
                          </div>
                        )}
                        <div>
                          <div className="text-xs md:text-sm font-black text-slate-800 dark:text-slate-100 line-clamp-2 md:line-clamp-1">{group.modelo}</div>
                          <div className="text-[9px] md:text-[10px] text-indigo-500/70 font-bold uppercase tracking-wider mt-0.5">
                            {group.tipo} <span className="md:hidden"> • {group.marca}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Condensed Specs for Mobile */}
                      <div className="mt-2 text-[10px] text-slate-500 md:hidden flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5"><Cpu className="w-3 h-3 text-indigo-400" /> <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-medium">{group.processador}</span></div>
                        <div className="flex items-center gap-1.5"><MemoryStick className="w-3 h-3 text-emerald-400" /> <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-medium">{group.ram}</span></div>
                        <div className="flex items-center gap-1.5"><HardDrive className="w-3 h-3 text-amber-400" /> <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-medium">{group.armazenamento}</span></div>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-[12px] lg:text-[13px] font-semibold text-slate-700 dark:text-slate-200 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-indigo-400 shrink-0" />
                        {group.processador}
                      </div>
                    </td>
                    <td className="py-4 px-5 text-[12px] lg:text-[13px] font-semibold text-slate-700 dark:text-slate-200 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <MemoryStick className="w-4 h-4 text-emerald-400 shrink-0" />
                        {group.ram}
                      </div>
                    </td>
                    <td className="py-4 px-5 text-[12px] lg:text-[13px] font-semibold text-slate-700 dark:text-slate-200 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-amber-400 shrink-0" />
                        {group.armazenamento}
                      </div>
                    </td>
                    <td className="py-4 px-5 text-[12px] lg:text-[13px] font-medium text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-slate-400 shrink-0" />
                        {group.so}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 md:px-5 text-center">
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

      {/* Infinite Scroll trigger */}
      {hasMore && groupedEstoque.length > 0 && (
        <div ref={observerTarget} className="flex justify-center mt-6 mb-8 w-full h-10">
          {isLoadingMore && (
            <div className="flex items-center gap-2 text-indigo-500 font-bold text-sm">
              <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
              Carregando mais...
            </div>
          )}
        </div>
      )}
    </>
  );
}

export const CatalogView = memo(CatalogViewComponent);
