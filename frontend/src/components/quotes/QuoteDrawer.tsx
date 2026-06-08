import { FileText, X, CheckCircle, Trash2, AlertCircle, Send, Server, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { Quote, Equipamento } from '../../types';

interface QuoteDrawerProps {
  quote: Quote;
  cart: Equipamento[];
  quoteStep: 1 | 2 | 3;
  isSubmitting: boolean;
  isGeneratingPdf: boolean;
  unavailableIds: Set<string>;
  onClose: () => void;
  onStepChange: (step: 1 | 2 | 3) => void;
  onUpdateQuote: (patch: Partial<Quote>) => void;
  onRemoveItem: (item: Equipamento) => void;
  onDelete: () => void;
  onReserve: () => void;
  onCancelReserve: () => void;
  onPrint: () => void;
  onWhatsApp: () => void;
}

export function QuoteDrawer({
  quote, cart, quoteStep, isSubmitting, isGeneratingPdf, unavailableIds,
  onClose, onStepChange, onUpdateQuote, onRemoveItem, onDelete,
  onReserve, onCancelReserve, onPrint, onWhatsApp,
}: QuoteDrawerProps) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm print:hidden" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg flex flex-col bg-white/95 dark:bg-[#0d1117]/95 backdrop-blur-xl shadow-2xl border-l border-slate-200 dark:border-[#30363d] drawer-enter print:hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="text-indigo-500 w-4 h-4 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100 truncate">{quote.name}</h2>
              {quote.isReserved ? (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-2.5 h-2.5" /> Reservada
                </span>
              ) : (
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">Passo {quoteStep} de 3</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          {/* Step 2 — Dados do Cliente */}
          {!quote.isReserved && quoteStep === 2 && (
            <div className="step-enter space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Cliente / Empresa</label>
                <input
                  type="text"
                  value={quote.clientName || ''}
                  onChange={e => onUpdateQuote({ clientName: e.target.value })}
                  className="w-full border border-slate-300 dark:border-[#30363d] rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none text-sm font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-[#0d1117] placeholder-slate-400 transition-colors"
                  placeholder="Nome do cliente ou empresa"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Margem / Condição</label>
                  <input
                    type="text"
                    value={quote.margin || ''}
                    onChange={e => onUpdateQuote({ margin: e.target.value })}
                    className="w-full border border-slate-300 dark:border-[#30363d] rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none text-sm font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-[#0d1117] placeholder-slate-400 transition-colors"
                    placeholder="Ex: 10%"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Validade (Dias)</label>
                  <input
                    type="number"
                    value={quote.validityDays ?? 2}
                    onChange={e => onUpdateQuote({ validityDays: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-300 dark:border-[#30363d] rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none text-sm font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-[#0d1117] transition-colors"
                    placeholder="2" min="1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 1 — Lista de itens (ou se reservado) */}
          {(quote.isReserved || quoteStep === 1) && (
            <div className="step-enter">
              <div className="flex justify-between items-center mb-2.5">
                <h3 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Itens da Proposta</h3>
                <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-500/20">
                  {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <div className="space-y-2">
                {cart.map(item => {
                  const isUnavailable = unavailableIds.has(item.idPatrimonio);
                  return (
                    <div
                      key={item.idPatrimonio}
                      className={clsx(
                        'flex justify-between items-center p-3 border rounded-lg transition-colors group',
                        isUnavailable
                          ? 'border-red-400/40 bg-red-950/10 dark:bg-red-950/20'
                          : 'border-slate-200/60 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/40',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        {isUnavailable && (
                          <div className="flex items-center gap-1 mb-1">
                            <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                            <span className="text-[9px] font-bold text-red-500 uppercase tracking-wide">Indisponível</span>
                          </div>
                        )}
                        <div className={clsx('font-bold text-sm leading-tight', isUnavailable ? 'text-red-400 line-through' : 'text-slate-800 dark:text-slate-100')}>
                          {item.marca} {item.modelo}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] text-slate-500">Pat: {item.idPatrimonio}</span>
                          <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10">
                            NS: {item.numeroSerie}
                          </span>
                        </div>
                      </div>
                      {!quote.isReserved && (
                        <button
                          onClick={() => onRemoveItem(item)}
                          className="p-1.5 text-slate-400 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors shrink-0 ml-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {cart.length === 0 && (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-600 text-sm italic">
                    Nenhum item. Selecione equipamentos no catálogo.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3 — Resumo */}
          {!quote.isReserved && quoteStep === 3 && (
            <div className="step-enter space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Resumo da Proposta</h3>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <p className="text-xs text-slate-500 mb-1">Cliente / Empresa</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4">{quote.clientName || 'Não informado'}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Condição</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{quote.margin || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Validade</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{quote.validityDays} dias</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-[#161b22] p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 flex justify-between items-center shadow-sm">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Total de Equipamentos</span>
                <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{cart.length} unid.</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 shrink-0 space-y-3">
          {quote.isReserved ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 rounded-lg border border-emerald-200 dark:border-emerald-800/50 font-bold text-sm">
                <CheckCircle className="w-4 h-4" /> Equipamentos Reservados
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onCancelReserve}
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white dark:bg-[#161b22] hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg font-semibold text-sm transition-colors border border-slate-200 dark:border-[#30363d]"
                >
                  <X className="w-3.5 h-3.5" /> Cancelar Reserva
                </button>
              </div>
            </div>
          ) : (
            <>
              {quoteStep === 1 && (
                <button
                  onClick={() => onStepChange(2)}
                  disabled={cart.length === 0}
                  className={clsx('w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm transition-colors shadow-sm', cart.length === 0 && 'opacity-50 cursor-not-allowed')}
                >
                  Avançar para Dados do Cliente
                </button>
              )}
              {quoteStep === 2 && (
                <div className="flex gap-2">
                  <button onClick={() => onStepChange(1)} className="flex-1 px-4 py-3 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm">Voltar</button>
                  <button onClick={() => onStepChange(3)} className="flex-[2] px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm transition-colors shadow-sm">Revisão e Envio</button>
                </div>
              )}
              {quoteStep === 3 && (
                <>
                  <div className="flex gap-2">
                    <button onClick={() => onStepChange(2)} className="px-3 py-2.5 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm">Voltar</button>
                    <button onClick={onWhatsApp} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
                      <Send className="w-3.5 h-3.5" /> WhatsApp
                    </button>
                    <button onClick={onPrint} disabled={isGeneratingPdf} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-700 hover:bg-slate-800 dark:bg-white/10 dark:hover:bg-white/15 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-wait">
                      {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                      {isGeneratingPdf ? 'Gerando...' : 'Gerar PDF'}
                    </button>
                  </div>
                  <button
                    onClick={onReserve}
                    disabled={isSubmitting || cart.length === 0}
                    className={clsx('w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed', isSubmitting && 'opacity-70 cursor-wait')}
                  >
                    {isSubmitting
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <Server className="w-4 h-4" />}
                    Reservar Equipamentos
                  </button>
                </>
              )}
            </>
          )}
          <button
            onClick={onDelete}
            className="w-full text-[11px] font-bold text-red-400/70 hover:text-red-500 transition-colors flex items-center justify-center gap-1.5 py-1.5 mt-2"
          >
            <Trash2 className="w-3 h-3" /> Excluir Proposta
          </button>
        </div>
      </div>
    </>
  );
}
