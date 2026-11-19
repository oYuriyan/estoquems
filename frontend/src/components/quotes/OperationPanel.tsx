import { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/api';
import type { QuoteOperation } from '../../types';

const labels: Record<string, string> = {
  PENDING: 'Aguardando conferência', PARTIAL: 'Confirmação parcial', SUCCEEDED: 'Confirmada',
  CONFLICT: 'Conflito na origem', REVERSED: 'Reserva desfeita', REVERSING: 'Liberação em andamento',
  confirmed: 'Confirmado', pending: 'Pendente', conflict: 'Conflito',
};
const events: Record<string,string> = {
  created:'Solicitação registrada',attempt_started:'Tentativa iniciada',result_received:'Resultado recebido',
  inspection_started:'Conferência iniciada',inspection_result:'Estado conferido',confirmation_unknown:'Confirmação pendente',
  reverse_requested:'Desfazimento solicitado',reverse_without_write:'Conferência concluída sem alteração',
};
interface Props {
  quoteId: string; operation: QuoteOperation; isSubmitting: boolean;
  onReconcile?: () => void; onRetry?: () => void; onReverse?: () => void;
}
export function OperationPanel({ quoteId, operation, isSubmitting, onReconcile, onRetry, onReverse }: Props) {
  const pending = ['PENDING', 'PARTIAL'].includes(operation.status);
  const [history, setHistory] = useState<QuoteOperation[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void apiFetch(`/api/quotes/${quoteId}/history`, {signal:controller.signal}).then(async response => {
      if (!response.ok) throw new Error('Não foi possível consultar o histórico.');
      const data = await response.json();
      if (!controller.signal.aborted) { setHistory(data); setError(''); }
    }).catch(() => { if (!controller.signal.aborted) setError('Histórico temporariamente indisponível.'); });
    return () => controller.abort();
  }, [quoteId, operation.id, operation.status, operation.updated_at, operation.attempts]);
  return <section aria-label="Acompanhamento da operação" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-slate-900 dark:bg-amber-950/30 dark:text-slate-100 space-y-3">
    <div><h3 className="font-bold text-sm">{labels[operation.status] || operation.status}</h3>
      <p className="text-sm">{operation.message}</p>
      {pending && <p className="text-xs mt-1">A proposta está protegida até a confirmação. Não há sucesso confirmado para os itens pendentes.</p>}
      {operation.next_check_at && <p className="text-xs mt-1">Aguarde a operação anterior até {new Date(operation.next_check_at).toLocaleTimeString('pt-BR')} antes de tentar novamente.</p>}
    </div>
    <ul className="space-y-1 text-xs">{operation.items.map(item => <li key={item.equipment_id} className="flex justify-between gap-2">
      <span className="break-all">{item.serial || item.id_glpi}</span><span className="font-semibold shrink-0">{labels[item.status] || item.status}</span>
    </li>)}</ul>
    {pending && <div className="flex flex-wrap gap-2">
      <button type="button" disabled={isSubmitting || !onReconcile} onClick={onReconcile} className="px-3 py-2 rounded-lg border border-slate-400 text-xs font-bold disabled:opacity-50">Conferir no GLPI</button>
      <button type="button" disabled={isSubmitting || !onRetry} onClick={onRetry} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50">Tentar concluir</button>
      {operation.action === 'reserve' && <button type="button" disabled={isSubmitting || !onReverse} onClick={onReverse} className="px-3 py-2 rounded-lg border border-red-400 text-xs font-bold disabled:opacity-50">Desfazer reserva parcial</button>}
    </div>}
    <details className="text-xs">
      <summary className="cursor-pointer font-bold">Histórico das operações</summary>
      {error && <p role="status">{error}</p>}
      {history.map(entry => <div key={entry.id} className="mt-3 border-t border-amber-200 pt-2">
        <p className="font-bold">{entry.action === 'reserve' ? 'Reserva' : 'Cancelamento'} · {labels[entry.status] || entry.status}</p>
        <p className="break-all">Acompanhamento: {entry.id}</p>
        <ol className="mt-1 space-y-1">{entry.events?.map((item, index) => <li key={index}>
          {new Date(item.created_at).toLocaleString('pt-BR')} · {item.actor} · {events[item.kind] || item.kind}
        </li>)}</ol>
      </div>)}
    </details>
  </section>;
}
