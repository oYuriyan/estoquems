import { useMemo, useCallback, useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { apiFetch } from '../utils/api';
import type { Equipamento, Quote } from '../types';

export function useQuotes() {
  const { quotes, setQuotes, activeQuoteId, setActiveQuoteId, refreshQuotes } = useAppContext();
  const [isSyncing, setIsSyncing] = useState(false);

  const activeQuote = useMemo(
    () => quotes.find(q => q.id === activeQuoteId) || quotes[0] || null,
    [quotes, activeQuoteId]
  );

  const cart = useMemo(() => activeQuote?.items ?? [], [activeQuote]);

  // Atualiza no backend e no estado local
  const updateQuote = useCallback(async (id: string | null, patch: Partial<Quote>) => {
    if (!id) return;
    
    // Optimistic update
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));

    // Se estiver reservado não editamos via DRAFT endpoint
    const quote = quotes.find(q => q.id === id);
    if (quote?.isReserved) return;

    try {
      const payload: any = {};
      if (patch.name !== undefined) payload.name = patch.name;
      if (patch.clientName !== undefined) payload.client_name = patch.clientName;
      if (patch.margin !== undefined) payload.margin = patch.margin;
      if (patch.validityDays !== undefined) payload.validity_days = patch.validityDays;
      if (patch.items !== undefined) {
        payload.equipment_ids = patch.items.map(i => (i as any).id || i.idPatrimonio);
      }
      
      // Apenas faz request se houver algo pra atualizar
      if (Object.keys(payload).length > 0) {
        await apiFetch(`/api/quotes/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      }
    } catch (err) {
      console.error('Falha ao atualizar draft no backend', err);
    }
  }, [quotes, setQuotes]);

  const addNewQuote = useCallback(async () => {
    setIsSyncing(true);
    try {
      const name = `Proposta ${quotes.length + 1}`;
      const res = await apiFetch('/api/quotes/draft', {
        method: 'POST',
        body: JSON.stringify({ name, equipment_ids: [] })
      });
      if (res.ok) {
        const created = await res.json();
        const newQuote: Quote = { 
          id: created.id, 
          name: created.name, 
          items: [], 
          clientName: '', 
          margin: '', 
          validityDays: 2 
        };
        setQuotes(prev => [...prev, newQuote]);
        setActiveQuoteId(created.id);
        return created.id;
      }
    } catch (err) {
      console.error('Falha ao criar proposta no backend', err);
    } finally {
      setIsSyncing(false);
    }
    return null;
  }, [quotes.length, setQuotes, setActiveQuoteId]);

  const removeQuote = useCallback(async (id: string) => {
    const backup = quotes.find(q => q.id === id);
    if (!backup) return;

    const remaining = quotes.filter(q => q.id !== id);
    // Optimistic
    setQuotes(remaining);
    if (id === activeQuoteId) {
      setActiveQuoteId(remaining.length > 0 ? remaining[0].id : null);
    }
    try {
      const res = await apiFetch(`/api/quotes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha na API');
    } catch (err) {
      console.error('Falha ao excluir proposta no backend', err);
      // rollback limpo
      setQuotes(prev => [...prev, backup]);
    }
  }, [quotes, activeQuoteId, setQuotes, setActiveQuoteId]);

  const toggleCartItem = useCallback(async (item: Equipamento) => {
    let targetQuoteId = activeQuoteId;
    
    // Cria proposta automaticamente se não houver nenhuma
    if (quotes.length === 0 || !activeQuote) {
       targetQuoteId = await addNewQuote();
       if (!targetQuoteId) return; // falha
    }
    
    // Calcula os novos items baseados no activeQuote atual ou no que acabou de ser criado
    // Mas precisamos ter certeza que temos a referencia atual.
    // Usar setQuotes com callback é mais seguro para o estado local, mas para o backend precisamos do array final.
    // Como a adição de quote foi async, o hook state não atualizou na mesma renderização. 
    // É mais seguro sempre forçar o recarregamento pelo refreshQuotes depois.
    
    const currentQuote = quotes.find(q => q.id === targetQuoteId) || { items: [] };
    const exists = currentQuote.items.some((c: Equipamento) => c.idPatrimonio === item.idPatrimonio);
    
    const newItems = exists
      ? currentQuote.items.filter((c: Equipamento) => c.idPatrimonio !== item.idPatrimonio)
      : [...currentQuote.items, item];
      
    await updateQuote(targetQuoteId, { items: newItems });
  }, [quotes, activeQuote, activeQuoteId, addNewQuote, updateQuote]);

  return {
    quotes,
    activeQuote,
    activeQuoteId,
    setActiveQuoteId,
    cart,
    isSyncing,
    updateQuote,
    addNewQuote,
    removeQuote,
    toggleCartItem,
  };
}
