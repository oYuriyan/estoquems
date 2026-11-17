import { useState } from 'react';
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

  const handleReserve = async () => {
    if (cart.length === 0 || !activeQuoteId || !activeQuote) return;
    if (reservationBlockReason) { addToast(reservationBlockReason, 'error'); return; }
    if (!navigator.onLine) { addToast('Você está offline.', 'error'); return; }
    setIsSubmitting(true);
    try {
      const saved = await updateQuote(activeQuoteId, {
        name: activeQuote.name,
        clientName: activeQuote.clientName || 'Não informado',
        validityDays: activeQuote.validityDays || 2,
        margin: activeQuote.margin || '',
        items: cart,
      });
      if (!saved) throw new Error('A proposta não foi salva. Confira os dados antes de reservar.');

      const res = await apiFetch(`/api/quotes/${activeQuoteId}/reserve`, {
        method: 'POST'
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        const message = typeof error.detail === 'string' ? error.detail : error.detail?.message;
        throw new Error(typeof message === 'string' ? message : 'Não foi possível confirmar a reserva.');
      }
      
      await refreshQuotes();
      await fetchCatalogo(true, true);
      addToast('Reserva realizada com sucesso!', 'success');
    } catch (err: unknown) {
      await fetchCatalogo(true, true);
      addToast(err instanceof Error ? err.message : 'Erro desconhecido ao reservar.', 'error');
    } finally { setIsSubmitting(false); }
  };

  const handleCancelReserve = () => {
    if (!activeQuoteId || !activeQuote) return;
    showConfirm('Cancelar Reserva', 'Após a confirmação no GLPI, os equipamentos serão liberados e esta proposta ficará cancelada.', async () => {
      setIsSubmitting(true);
      try {
        const backendId = (activeQuote as unknown as Record<string, unknown>).backendId || activeQuoteId;
        const res = await apiFetch(`/api/quotes/${backendId}/cancel`, {
          method: 'POST'
        });
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(typeof error.detail === 'string' ? error.detail : 'Não foi possível cancelar a reserva.');
        }
        await refreshQuotes();
        await fetchCatalogo(true, true);
        addToast('Reserva cancelada com sucesso.', 'success');
      } catch (err: unknown) {
        addToast(err instanceof Error ? err.message : 'Erro desconhecido ao cancelar.', 'error');
      } finally { setIsSubmitting(false); }
    });
  };

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
    handleWhatsApp
  };
}
