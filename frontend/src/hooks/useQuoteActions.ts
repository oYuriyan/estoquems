import { useState, useRef } from 'react';
import { apiFetch } from '../utils/api';
import type { Quote, Equipamento } from '../types';

export function useQuoteActions(
  activeQuoteId: string | null,
  activeQuote: Quote | null,
  cart: Equipamento[],
  updateQuote: (id: string, patch: Partial<Quote>) => Promise<boolean>,
  fetchCatalogo: (silent?: boolean, resetPage?: boolean) => Promise<boolean>,
  refreshQuotes: () => Promise<void>,
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void,
  showConfirm: (title: string, msg: string, onConfirm: () => void) => void,
  reservationBlockReason: string | null,
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);

  const submitOperation = async (action: string) => {
    if (!activeQuoteId || !activeQuote || submitting.current) return;
    if (action === 'reserve' && reservationBlockReason) { addToast(reservationBlockReason, 'error'); return; }
    if (!navigator.onLine) { addToast('Você está offline.', 'error'); return; }
    submitting.current = true;
    setIsSubmitting(true);
    try {
      const pending = ['PENDING', 'PARTIAL'].includes(activeQuote.operation?.status || '');
      if (action === 'reserve' && !pending) {
        if (!cart.length) return;
        if (reservationBlockReason) { addToast(reservationBlockReason, 'error'); return; }
        const saved = await updateQuote(activeQuoteId, {
          name: activeQuote.name, clientName: activeQuote.clientName || 'Não informado',
          validityDays: activeQuote.validityDays || 2, margin: activeQuote.margin || '', items: cart,
        });
        if (!saved) throw new Error('A proposta não foi salva. Confira os dados antes de reservar.');
      }
      const response = await apiFetch(`/api/quotes/${activeQuoteId}/${action}`, {method:'POST',headers:{'X-Lummium-Operations':'1'}});
      const data = await response.json().catch(() => ({}));
      const message = typeof data.detail === 'string' ? data.detail : data.detail?.message;
      if (response.status === 202) {
        addToast(typeof message === 'string' ? message : 'Operação registrada; aguardando conferência.', 'info');
      } else if (!response.ok) {
        throw new Error(typeof message === 'string' ? message : 'Não foi possível confirmar a operação.');
      } else {
        addToast(data.operation?.message || 'Operação confirmada.', 'success');
      }
    } catch (error: unknown) {
      addToast(error instanceof Error ? error.message : 'Não foi possível confirmar a operação.', 'error');
    } finally {
      await Promise.allSettled([refreshQuotes(), fetchCatalogo(true, true)]);
      submitting.current = false;
      setIsSubmitting(false);
    }
  };
  const handleReserve = () => submitOperation('reserve');
  const handleReconcile = () => submitOperation('reconcile');
  const handleRetry = () => submitOperation('retry');
  const handleReverse = () => showConfirm('Desfazer reserva parcial', 'Somente os itens confirmados desta proposta serão liberados após conferência no GLPI. Deseja continuar?', () => { void submitOperation('reverse'); });
  const handleCancelReserve = () => showConfirm('Cancelar Reserva', 'Os equipamentos serão liberados somente após confirmação no GLPI.', () => { void submitOperation('cancel'); });

  const handleWhatsApp = () => {
    if (!activeQuote) return;
    const { clientName, margin, validityDays } = activeQuote;
    const groups: Record<string, { tipo: string; marca: string; modelo: string; processador: string; ram: string; armazenamento: string; so: string; items: Equipamento[] }> = {};
    cart.forEach(item => {
      const proc = item.especificacoes?.processador || 'N/A'; const ram = item.especificacoes?.ram || 'N/A';
      const arm  = item.especificacoes?.armazenamento || 'N/A'; const so = item.especificacoes?.so || 'N/A';
      const key  = [item.tipo, item.marca, item.modelo, proc, ram, arm, so].join('|').toUpperCase();
      if (!groups[key]) groups[key] = { tipo: item.tipo, marca: item.marca, modelo: item.modelo, processador: proc, ram, armazenamento: arm, so, items: [] };
      groups[key].items.push(item);
    });
    let text = `*Proposta de Equipamentos*\nCliente: ${clientName || '_____'}\nCondição: ${margin || '_____'}\nValidade: ${validityDays ? `${validityDays} dias` : '_____'}\n\n`;
    Object.values(groups).forEach((g, idx, arr) => {
      const qty = g.items.length;
      text += `*${qty} ${qty > 1 ? 'Unidades' : 'Unidade'} - ${g.tipo} ${g.marca} ${g.modelo}*\n`;
      text += `Processador: ${g.processador}\nMemória RAM: ${g.ram}\nArmazenamento: ${g.armazenamento}\nSistema Operacional: ${g.so}\n\n`;
      g.items.forEach(i => { text += `Número de Série: ${i.numeroSerie} | ID: ${i.idPatrimonio}\n`; });
      if (idx < arr.length - 1) text += '\n';
    });
    text += '\n_Gerado via Lummium_';
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return {
    isSubmitting,
    handleReserve,
    handleCancelReserve,
    handleReconcile, handleRetry, handleReverse,
    handleWhatsApp
  };
}
