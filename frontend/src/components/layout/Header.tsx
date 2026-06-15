import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Sun, Moon } from 'lucide-react';
import clsx from 'clsx';

interface HeaderProps {
  isDarkMode: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onToggleDarkMode: () => void;
}

export function Header({ isDarkMode, search, onSearchChange, onToggleDarkMode }: HeaderProps) {
  return (
    <header className="bg-white dark:bg-[#161b22] px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 z-10 border-b border-slate-200 dark:border-[#30363d] shadow-sm">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Catálogo</h1>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] uppercase tracking-widest font-bold text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10 px-2 py-0.5 rounded">LUMMIUM</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </span>
        </div>
      </div>

      <div className="relative w-full md:w-auto flex items-center gap-2">
        <div className="relative flex-1 md:w-80 group" data-tour="search">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Buscar marca, modelo, proc, serie..."
            className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-[#30363d] rounded-lg text-sm bg-white dark:bg-[#0d1117] text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
        <button
          onClick={onToggleDarkMode}
          className="rounded-lg border border-slate-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all w-9 h-9 flex items-center justify-center shrink-0 relative overflow-hidden"
          title="Alternar Tema"
        >
          <Sun className={clsx('w-4 h-4 absolute transition-all duration-500', isDarkMode ? 'rotate-90 opacity-0 scale-50' : 'rotate-0 opacity-100 scale-100')} />
          <Moon className={clsx('w-4 h-4 absolute transition-all duration-500', isDarkMode ? 'rotate-0 opacity-100 scale-100' : '-rotate-90 opacity-0 scale-50')} />
        </button>
      </div>
    </header>
  );
}
