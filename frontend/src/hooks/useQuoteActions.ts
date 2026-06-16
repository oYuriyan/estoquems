import { useState } from 'react';
import { apiFetch } from '../utils/api';
import type { Quote, Equipamento } from '../types';

export function useQuoteActions(
  activeQuoteId: string | null,
  activeQuote: Quote | null,
  cart: Equipamento[],
  updateQuote: (id: string, patch: Partial<Quote>) => void,
  fetchCatalogo: (force?: boolean) => void,
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void,
  showConfirm: (title: string, msg: string, onConfirm: () => void) => void
) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReserve = async () => {
    if (cart.length === 0 || !activeQuoteId || !activeQuote) return;
    if (!navigator.onLine) { addToast('Você está offline.', 'error'); return; }
    setIsSubmitting(true);
    try {
      await updateQuote(activeQuoteId, {
        name: activeQuote.name,
        clientName: activeQuote.clientName || 'Não informado',
        validityDays: activeQuote.validityDays || 2,
        margin: activeQuote.margin || '',
      });

      const res = await apiFetch(`/api/quotes/${activeQuoteId}/reserve`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error(res.status === 409 ? 'Alguns itens não estão mais disponíveis.' : 'Erro ao comunicar com o sistema.');
      
      const reservedQuote = await res.json();
      
      updateQuote(activeQuoteId, { isReserved: true, reservedAt: new Date().toISOString(), backendId: reservedQuote.id });
      addToast('Reserva realizada com sucesso!', 'success');
      setTimeout(() => fetchCatalogo(true), 1500);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Erro desconhecido ao reservar.', 'error');
    } finally { setIsSubmitting(false); }
  };

  const handleCancelReserve = () => {
    if (!activeQuoteId || !activeQuote) return;
    showConfirm('Cancelar Reserva', 'Os itens voltarão para o estoque e o GLPI será atualizado.', async () => {
      setIsSubmitting(true);
      try {
        const backendId = (activeQuote as Record<string, unknown>).backendId || activeQuoteId;
        const res = await apiFetch(`/api/quotes/${backendId}/cancel`, {
          method: 'POST'
        });
        if (!res.ok) throw new Error('Erro ao cancelar reserva.');
        updateQuote(activeQuoteId, { isReserved: false, backendId: undefined });
        addToast('Reserva cancelada com sucesso.', 'success');
        setTimeout(() => fetchCatalogo(true), 1500);
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
