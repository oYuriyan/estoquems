import { memo } from 'react';
import { Cpu, MemoryStick, HardDrive, Monitor, ShoppingCart } from 'lucide-react';
import type { GroupedItem, Equipamento } from '../../types';

interface ItemCardProps {
  group: GroupedItem;
  cartCount: number;
  onClick: (group: GroupedItem) => void;
  className?: string;
  style?: React.CSSProperties;
}

function ItemCardComponent({ group, cartCount, onClick, className, style }: ItemCardProps) {
  const isScarce = group.items.length === 1;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <div
      onClick={() => onClick(group)}
      onMouseMove={handleMouseMove}
      style={style}
      className={`spotlight-card w-[85vw] sm:w-[320px] md:w-full shrink-0 md:shrink snap-start md:snap-align-none bg-white dark:bg-[#161b22] rounded-2xl border border-slate-200 dark:border-[#30363d] hover:border-indigo-400 dark:hover:border-indigo-500/60 hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer flex flex-col overflow-hidden relative group/card shadow-sm ${className || ''}`}
    >
      {isScarce && (
        <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] uppercase font-bold px-3 py-1 rounded-bl-lg animate-pulse shadow-sm z-10">
          Última Unidade
        </div>
      )}
      {cartCount > 0 && (
        <div className="absolute top-0 left-0 bg-amber-500 text-amber-950 text-[10px] uppercase font-bold px-3 py-1 rounded-br-lg shadow-sm z-10 flex items-center gap-1">
          <ShoppingCart className="w-3 h-3" /> {cartCount} na cotação
        </div>
      )}

      <div className="p-4 md:p-6 flex-1 flex flex-col relative z-0">
        <span className="text-[10px] font-black text-indigo-600/60 uppercase tracking-widest mb-1 md:mt-2 block">{group.tipo}</span>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700/50 uppercase tracking-wide">
            {group.marca}
          </span>
        </div>
        <h3 className="text-base md:text-lg font-black text-slate-800 dark:text-slate-100 leading-tight group-hover/card:text-indigo-600 transition-colors">
          {group.modelo}
        </h3>

        <div className="mt-4 md:mt-5 space-y-2 md:space-y-2.5 text-[12px] md:text-[13px]">
          <div className="flex items-center gap-2"><Cpu        className="w-4 h-4 text-indigo-400 shrink-0" /> <span className="font-semibold text-slate-700 dark:text-slate-200">{group.processador}</span></div>
          <div className="flex items-center gap-2"><MemoryStick className="w-4 h-4 text-emerald-400 shrink-0" /> <span className="font-semibold text-slate-700 dark:text-slate-200">{group.ram}</span></div>
          <div className="flex items-center gap-2"><HardDrive  className="w-4 h-4 text-amber-400 shrink-0" />  <span className="font-semibold text-slate-700 dark:text-slate-200">{group.armazenamento}</span></div>
          <div className="flex items-center gap-2"><Monitor    className="w-4 h-4 text-slate-400 shrink-0" />  <span className="font-medium text-slate-600 dark:text-slate-300">{group.so}</span></div>
        </div>

        <div className="mt-4 md:mt-5 flex gap-2 flex-wrap">
          {group.novos > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
              {group.novos} Novo{group.novos > 1 ? 's' : ''}
            </span>
          )}
          {group.usados > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
              {group.usados} Usado{group.usados > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 md:px-6 py-3 border-t border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-[#0f172a] flex justify-between items-center">
        <span className="font-bold text-slate-500 dark:text-slate-400 text-[10px] md:text-[11px] uppercase tracking-wide">Disponíveis</span>
        <span className="inline-flex items-center justify-center bg-white dark:bg-slate-800 text-indigo-700 font-black px-3 py-1 rounded-lg text-sm border border-slate-200 dark:border-slate-700/50 shadow-sm">
          {group.items.length} unid.
        </span>
      </div>
    </div>
  );
}

export const ItemCard = memo(ItemCardComponent);
