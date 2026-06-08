import { Home, ShoppingCart, BookMarked, FileText, Plus, X, CheckCircle } from 'lucide-react';
import clsx from 'clsx';
import type { Quote } from '../../types';

interface ReservedProposal {
  quote: Quote;
  isExpired: boolean;
  isExpiringSoon: boolean;
}

interface MobileNavProps {
  mobileTab: 'catalogo' | 'propostas' | 'reservas';
  cartCount: number;
  reservedProposals: ReservedProposal[];
  quotes: Quote[];
  activeQuoteId: string | null;
  isMobileDrawerOpen: boolean;
  activeQuote: Quote | null;
  onTabChange: (tab: 'catalogo' | 'propostas' | 'reservas') => void;
  onToggleDrawer: () => void;
  onCloseDrawer: () => void;
  onSelectQuote: (id: string) => void;
  onOpenQuote: () => void;
  onNewQuote: () => void;
  onResetCatalog: () => void;
}

export function MobileNav({
  mobileTab, cartCount, reservedProposals, quotes, activeQuoteId,
  isMobileDrawerOpen, activeQuote,
  onTabChange, onToggleDrawer, onCloseDrawer, onSelectQuote, onOpenQuote, onNewQuote, onResetCatalog,
}: MobileNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 print:hidden">
      {/* Bottom Sheet */}
      {isMobileDrawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onCloseDrawer} />
          <div className="fixed bottom-16 left-0 right-0 bg-[#0B1120] rounded-t-2xl shadow-2xl flex flex-col max-h-[70vh] border-t border-white/10">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/5">
              <span className="text-sm font-bold text-slate-200">Minhas Propostas</span>
              <button onClick={onCloseDrawer} className="text-slate-400 p-1"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
              {quotes.length === 0 && (
                <p className="text-center text-slate-500 text-sm py-6">Nenhuma proposta ainda.<br />Selecione itens para iniciar.</p>
              )}
              {quotes.map(q => (
                <button
                  key={q.id}
                  onClick={() => { onSelectQuote(q.id); onOpenQuote(); onCloseDrawer(); }}
                  className={clsx(
                    'w-full flex justify-between items-center px-3.5 py-3 rounded-xl text-left transition-all border',
                    q.id === activeQuoteId
                      ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                      : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10',
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 shrink-0 opacity-60" />
                    <div className="min-w-0">
                      <span className="text-[13px] font-semibold block truncate">{q.name}</span>
                      {q.clientName && <span className="text-[11px] text-indigo-400 block truncate">{q.clientName}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {q.isReserved && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                    {q.items.length > 0 && (
                      <span className="bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                        {q.items.length}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="p-3 border-t border-white/5 grid grid-cols-2 gap-2">
              <button
                onClick={() => { onNewQuote(); onCloseDrawer(); }}
                className="flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold"
              >
                <Plus className="w-4 h-4" /> Nova Proposta
              </button>
              {activeQuote && (
                <button
                  onClick={() => { onOpenQuote(); onCloseDrawer(); }}
                  className="flex items-center justify-center gap-2 py-3 bg-white/10 text-slate-200 rounded-xl text-sm font-bold border border-white/10"
                >
                  <FileText className="w-4 h-4" /> Ver Proposta
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Barra de navegação */}
      <div className="bg-[#0B1120] border-t border-white/10 px-2 pb-safe">
        <div className="flex items-stretch h-16">
          <button
            onClick={() => { onTabChange('catalogo'); onCloseDrawer(); onResetCatalog(); }}
            className={clsx(
              'flex-1 flex flex-col items-center justify-center gap-1 transition-colors rounded-xl mx-0.5 my-1',
              mobileTab === 'catalogo' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300',
            )}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Catálogo</span>
          </button>

          <button
            onClick={() => { onTabChange('propostas'); onToggleDrawer(); }}
            className="flex-1 flex flex-col items-center justify-center gap-1 rounded-xl mx-0.5 my-1 relative"
          >
            <div className={clsx(
              'relative flex items-center justify-center w-10 h-10 rounded-full transition-all',
              mobileTab === 'propostas' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40' : 'bg-white/5 text-slate-400',
            )}>
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </div>
            <span className={clsx('text-[10px] font-semibold', mobileTab === 'propostas' ? 'text-indigo-400' : 'text-slate-500')}>
              Propostas
            </span>
          </button>

          <button
            onClick={() => { onTabChange('reservas'); onCloseDrawer(); }}
            className={clsx(
              'flex-1 flex flex-col items-center justify-center gap-1 transition-colors rounded-xl mx-0.5 my-1 relative',
              mobileTab === 'reservas' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300',
            )}
          >
            <div className="relative">
              <BookMarked className="w-5 h-5" />
              {reservedProposals.length > 0 && (
                <span className={clsx(
                  'absolute -top-1.5 -right-1.5 text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center',
                  reservedProposals.some(r => r.isExpired)       ? 'bg-red-500 text-white'
                  : reservedProposals.some(r => r.isExpiringSoon) ? 'bg-amber-500 text-white'
                  :                                                   'bg-emerald-500 text-white',
                )}>
                  {reservedProposals.length}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold">Reservas</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
