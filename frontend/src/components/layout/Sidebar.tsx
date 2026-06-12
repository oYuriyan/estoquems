import { format } from 'date-fns';
import { parseISO, differenceInHours } from 'date-fns';
import { CheckCircle, AlertTriangle, FileText, Plus, X, LogOut } from 'lucide-react';
import clsx from 'clsx';
import type { Quote } from '../../types';
import type { User } from '../../contexts/AppContext';

interface ReservedProposal {
  quote: Quote;
  expiresAt: Date | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
}

interface SidebarProps {
  user: User;
  quotes: Quote[];
  activeQuoteId: string | null;
  reservedProposals: ReservedProposal[];
  isRefreshing: boolean;
  ultimaAtualizacao: string;
  onSelectQuote: (id: string) => void;
  onNewQuote: () => void;
  onDeleteQuote: (id: string) => void;
  onResetCatalog: () => void;
  onSyncGlpi: () => void;
  onLogout: () => void;
}

export function Sidebar({
  user, quotes, activeQuoteId, reservedProposals,
  isRefreshing, ultimaAtualizacao,
  onSelectQuote, onNewQuote, onDeleteQuote, onResetCatalog, onSyncGlpi, onLogout,
  onOpenAdminPanel,
}: SidebarProps & { onOpenAdminPanel: () => void }) {
  const parsedDate = parseISO(ultimaAtualizacao);
  const statusCritico = differenceInHours(new Date(), parsedDate) > 24;

  return (
    <aside className="w-64 bg-[#0B1120] dark:bg-[#0B1120]/80 backdrop-blur-xl border-r border-white/5 text-slate-300 flex-shrink-0 flex-col hidden md:flex print:hidden relative overflow-hidden shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
      <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/15 blur-[60px] rounded-full pointer-events-none" />

      {/* Logo + usuário */}
      <div className="p-5 pb-2 border-b border-white/5 flex flex-col items-center">
        {/* Lummium Logo */}
        <div className="flex justify-center items-center mb-6 select-none">
          <span className="text-3xl font-black tracking-tight text-slate-800 dark:text-white drop-shadow-sm">
            <span className="text-cyan-500">L</span>ummium<span className="text-cyan-500">.</span>
          </span>
        </div>
        <div className="flex items-center gap-3 w-full justify-center">
          <div className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full text-center">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate max-w-[140px]">{user.name}</span>
          </div>
          <button onClick={onLogout} title="Sair da Conta" className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <button
          onClick={onResetCatalog}
          className="w-full flex items-center justify-center gap-2.5 px-3 py-3 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 hover:from-indigo-500/30 hover:to-purple-500/30 text-indigo-300 rounded-xl font-bold text-xs transition-all border border-indigo-500/20 hover:border-indigo-400/40 hover:scale-[1.02] shadow-sm uppercase tracking-wider mb-2"
        >
          Visão Geral do Catálogo
        </button>

        <button
          disabled
          className="w-full flex items-center justify-between px-3 py-2.5 bg-white/5 opacity-50 cursor-not-allowed rounded-xl font-bold text-[11px] text-slate-400 border border-white/5 uppercase tracking-wider"
        >
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Relatórios</span>
          <span className="text-[8px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded uppercase font-black">Em breve</span>
        </button>

        <div className="px-1 mt-6 mb-1 flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Propostas Ativas</span>
          <button
            onClick={onNewQuote}
            className="text-slate-500 hover:text-indigo-400 transition-colors p-1 rounded-md hover:bg-indigo-500/10"
            title="Nova proposta"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {quotes.length === 0 && (
          <div className="px-2 py-4 text-center">
            <p className="text-[11px] text-slate-600 leading-relaxed">Nenhuma proposta ainda.<br />Selecione itens para iniciar.</p>
          </div>
        )}

        {quotes.filter(q => !q.isReserved).map(q => (
          <div key={q.id} className="mb-0.5">
            <button
              onClick={() => onSelectQuote(q.id)}
              className={clsx(
                'w-full flex justify-between items-center px-3 py-2.5 rounded-xl font-medium transition-all duration-300 text-left group text-sm relative overflow-hidden',
                q.id === activeQuoteId
                  ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 shadow-[0_0_20px_rgba(99,102,241,0.15)] bg-gradient-to-r from-indigo-500/10 to-purple-500/10'
                  : 'hover:bg-white/10 text-slate-400 hover:text-slate-200 hover:translate-x-1 border border-transparent',
              )}
            >
              {q.id === activeQuoteId && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-400 rounded-l-xl shadow-[0_0_10px_rgba(99,102,241,0.8)] animate-pulse" />
              )}
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-3.5 h-3.5 shrink-0 opacity-70" />
                <div className="min-w-0">
                  <span className="truncate text-[13px] font-semibold block">{q.name}</span>
                  {q.clientName && <span className="truncate text-[10px] font-bold text-indigo-400 block mt-0.5">{q.clientName}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                {q.isReserved && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                {q.items.length > 0 && (
                  <span className="bg-indigo-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {q.items.length}
                  </span>
                )}
                <span
                  onClick={e => { e.stopPropagation(); onDeleteQuote(q.id); }}
                  className="text-slate-700 hover:text-red-400 transition-colors ml-0.5 opacity-0 group-hover:opacity-100 p-0.5 rounded"
                >
                  <X className="w-3 h-3" />
                </span>
              </div>
            </button>
          </div>
        ))}
      </nav>

      {/* Reservas + Status */}
      <div className="p-4 border-t border-white/5 space-y-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Reservas Ativas</span>
          {reservedProposals.length === 0 ? (
            <div className="px-3 py-2 rounded-lg bg-white/3 border border-white/5 text-[11px] text-slate-500 text-center italic">Nenhuma reserva ativa</div>
          ) : (
            <div className="space-y-1.5">
              {reservedProposals.map(({ quote: q, expiresAt, isExpired, isExpiringSoon }) => (
                <button
                  key={q.id}
                  onClick={() => onSelectQuote(q.id)}
                  className={clsx(
                    'w-full px-3 py-2.5 rounded-xl border text-left flex justify-between items-center gap-2 transition-all hover:-translate-y-0.5 shadow-sm',
                    isExpired      ? 'bg-gradient-to-r from-red-950/40 to-red-900/20 border-red-800/50 text-red-300'
                    : isExpiringSoon ? 'bg-gradient-to-r from-amber-950/40 to-amber-900/20 border-amber-800/50 text-amber-300'
                    :                  'bg-gradient-to-r from-emerald-950/40 to-emerald-900/20 border-emerald-800/50 text-emerald-300',
                  )}
                >
                  <div className="min-w-0">
                    <span className="font-bold truncate block text-[11px]">{q.name}</span>
                    <span className="text-[9px] opacity-60 block">
                      {q.clientName || 'Sem cliente'} · {q.items.length} item{q.items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    {isExpired ? (
                      <span className="text-[9px] font-bold animate-pulse">VENCIDO</span>
                    ) : expiresAt ? (
                      <span className="font-mono text-[9px]">{format(expiresAt, 'dd/MM HH:mm')}</span>
                    ) : (
                      <span className="text-[9px] opacity-40">s/ data</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Status do Estoque</span>
          <div
            onDoubleClick={user.role === 'ADMIN' ? onSyncGlpi : undefined}
            title={user.role === 'ADMIN' ? "Clique duplo para forçar sincronização com GLPI." : "Última sincronização do estoque."}
            className={clsx(
              'px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-xs font-bold border mb-2 select-none transition-colors',
              user.role === 'ADMIN' ? 'cursor-pointer' : 'cursor-default opacity-80',
              statusCritico
                ? 'bg-amber-950/30 text-amber-400 border-amber-900/40 hover:bg-amber-950/40'
                : 'bg-emerald-950/30 text-emerald-400 border-emerald-900/40 hover:bg-emerald-950/40',
              isRefreshing && 'opacity-50 cursor-wait',
            )}
          >
            {statusCritico ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
            <span>{format(parsedDate, 'dd/MM HH:mm')}</span>
          </div>
        </div>

        {user.role === 'ADMIN' && (
          <button
            onClick={onOpenAdminPanel}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg font-bold text-[10px] transition-colors border border-indigo-500/20 uppercase tracking-widest"
          >
            Configurações de Acesso
          </button>
        )}
      </div>
    </aside>
  );
}
