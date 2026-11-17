import { X, Cpu, MemoryStick, HardDrive } from 'lucide-react';
import clsx from 'clsx';
import type { GroupedItem, Equipamento } from '../../types';
import { isEquipmentAvailable, isEquipmentReserved } from '../../utils/equipment';

interface ItemDetailModalProps {
  group: GroupedItem;
  cart: Equipamento[];
  onClose: () => void;
  onToggleItem: (item: Equipamento) => void;
  onUpdateItems: (items: Equipamento[]) => void;
}

export function ItemDetailModal({
  group, cart, onClose, onToggleItem, onUpdateItems,
}: ItemDetailModalProps) {
  const availableItems = group.items.filter(isEquipmentAvailable);
  const selectedCount = cart.filter(c => availableItems.some(i => i.idPatrimonio === c.idPatrimonio)).length;
  const allSelected = availableItems.length > 0 && selectedCount === availableItems.length;

  const selectAll = () => {
    const currentIds = new Set(cart.map(c => c.idPatrimonio));
    const toAdd = availableItems.filter(i => !currentIds.has(i.idPatrimonio));
    if (toAdd.length > 0) onUpdateItems([...cart, ...toAdd]);
  };

  const deselectAll = () => {
    const groupIds = new Set(group.items.map(i => i.idPatrimonio));
    onUpdateItems(cart.filter(c => !groupIds.has(c.idPatrimonio)));
  };

  const selectQuantity = (qty: number) => {
    const groupIds = new Set(group.items.map(i => i.idPatrimonio));
    const withoutGroup = cart.filter(c => !groupIds.has(c.idPatrimonio));
    onUpdateItems([...withoutGroup, ...availableItems.slice(0, qty)]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm backdrop-enter print:hidden">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden modal-enter">
        {/* Header */}
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50 flex justify-between items-start bg-slate-50/50 dark:bg-slate-800/50 relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">
              {group.tipo} · <span className="text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700/80 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 shadow-sm">{group.marca}</span>
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">{group.modelo}</h2>
            <div className="flex gap-3 mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200 flex-wrap">
              <span className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-sm">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" /> {group.processador}
              </span>
              <span className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-sm">
                <MemoryStick className="w-3.5 h-3.5 text-emerald-400" /> {group.ram}
              </span>
              <span className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-sm">
                <HardDrive className="w-3.5 h-3.5 text-amber-400" /> {group.armazenamento}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 p-2 rounded-full shadow-sm border border-slate-200 dark:border-slate-700/50 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Batch Controls */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={allSelected ? deselectAll : selectAll}
              className={clsx(
                'text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors',
                allSelected
                  ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                  : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100',
              )}
            >
              {allSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </button>
            <span className="text-xs text-slate-400 font-medium">{selectedCount}/{availableItems.length} disponíveis selecionados</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quantidade:</label>
            <select
              value={selectedCount}
              onChange={e => selectQuantity(Number(e.target.value))}
              className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-800"
            >
              {Array.from({ length: availableItems.length + 1 }, (_, i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800/50 z-10 border-b border-slate-200 dark:border-slate-700/50 shadow-sm">
              <tr>
                <th className="py-3 px-6 w-12" />
                <th className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Patrimônio</th>
                <th className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Número de Série</th>
                <th className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Sistema Operacional</th>
                <th className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {group.items.map(item => {
                const isReserved = isEquipmentReserved(item);
                const isUnavailable = !isEquipmentAvailable(item);
                const isSelected = cart.some(c => c.idPatrimonio === item.idPatrimonio);
                return (
                  <tr
                    key={item.idPatrimonio}
                    className={clsx(
                      'transition-colors',
                      isUnavailable ? 'bg-red-50/40 opacity-80' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 dark:bg-[#0f172a] cursor-pointer',
                      isSelected && !isUnavailable && 'bg-indigo-50/50',
                    )}
                    onClick={() => !isUnavailable && onToggleItem(item)}
                  >
                    <td className="py-4 px-6">
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-600 cursor-pointer pointer-events-none"
                        checked={isSelected}
                        disabled={isUnavailable}
                        readOnly
                      />
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-800 dark:text-slate-100">{item.idPatrimonio}</td>
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded border border-slate-200 dark:border-slate-700/50">
                        {item.numeroSerie}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm font-medium text-slate-600 dark:text-slate-300">{item.especificacoes.so || 'N/A'}</td>
                    <td className="py-4 px-6">
                      {isReserved ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-red-50 text-red-700 border-red-200 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          Reservado
                        </span>
                      ) : (
                        <span className={clsx(
                          'text-[10px] font-bold px-2.5 py-1 rounded-full border',
                          item.status?.includes('NOVO')       ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : item.status?.includes('DISPONIVEL') ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          :                                        'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/50',
                        )}>
                          {item.status?.replace('DISPONIVEL', '').trim() || item.status}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-[#0f172a] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-colors shadow-sm"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
}
