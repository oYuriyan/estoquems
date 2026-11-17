import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { apiFetch } from '../utils/api';
import type { Equipamento, Quote } from '../types';
import { isEquipmentAvailable } from '../utils/equipment';

export function useQuotes(onError?: (message: string) => void) {
  const { quotes, setQuotes, activeQuoteId, setActiveQuoteId, refreshQuotes } = useAppContext();
  const [isSyncing, setIsSyncing] = useState(false);
  const quotesRef = useRef(quotes);
  const queues = useRef(new Map<string, Promise<boolean>>());
  const errorRef = useRef(onError);
  useEffect(() => { quotesRef.current = quotes; }, [quotes]);
  useEffect(() => { errorRef.current = onError; }, [onError]);

  const activeQuote = useMemo(
    () => quotes.find(q => q.id === activeQuoteId) || quotes[0] || null,
    [quotes, activeQuoteId]
  );

  const cart = useMemo(() => activeQuote?.items ?? [], [activeQuote]);

  // Atualiza no backend e no estado local
  const updateQuote = useCallback((id: string | null, patch: Partial<Quote>): Promise<boolean> => {
    const quote = quotesRef.current.find(q => q.id === id);
    if (!id || !quote) return Promise.resolve(false);
    if (quote.isReserved || (quote.status && quote.status !== 'DRAFT')) {
      errorRef.current?.('Crie uma nova proposta para selecionar equipamentos.');
      return Promise.resolve(false);
    }
    const next = { ...quote, ...patch };
    quotesRef.current = quotesRef.current.map(q => q.id === id ? next : q);
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
    // Uma fila por proposta impede que respostas fora de ordem sobrescrevam
    // os dados mais recentes durante digitação e seleção rápida.
    const previous = queues.current.get(id) || Promise.resolve(true);
    const task = previous.then(async () => {
      try {
        const response = await apiFetch(`/api/quotes/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: next.name, client_name: next.clientName || '',
            margin: next.margin || '', validity_days: next.validityDays ?? 2,
            equipment_ids: next.items.map(item => item.id || item.idPatrimonio),
          }),
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(typeof error.detail === 'string' ? error.detail : 'Não foi possível salvar a proposta. Confira os dados.');
        }
        return true;
      } catch (error) {
        errorRef.current?.(error instanceof Error ? error.message : 'Não foi possível salvar a proposta.');
        return false;
      }
    });
    queues.current.set(id, task);
    void task.then(async success => {
      if (queues.current.get(id) !== task) return;
      queues.current.delete(id);
      if (!success) await refreshQuotes();
    });
    return task;
  }, [setQuotes, refreshQuotes]);

  const addNewQuote = useCallback(async () => {
    setIsSyncing(true);
    try {
      const name = `Proposta ${quotesRef.current.length + 1}`;
      const res = await apiFetch('/api/quotes/draft', {
        method: 'POST',
        body: JSON.stringify({ name, equipment_ids: [] })
      });
      if (res.ok) {
        const created = await res.json();
        const newQuote: Quote = { 
          id: created.id, 
          status: 'DRAFT',
          name: created.name, 
          items: [], 
          clientName: '', 
          margin: '', 
          validityDays: 2 
        };
        quotesRef.current = [...quotesRef.current, newQuote];
        setQuotes(prev => [...prev, newQuote]);
        setActiveQuoteId(created.id);
        return created.id;
      }
      throw new Error('Não foi possível criar a proposta.');
    } catch (err) {
      errorRef.current?.(err instanceof Error ? err.message : 'Não foi possível criar a proposta.');
    } finally {
      setIsSyncing(false);
    }
    return null;
  }, [setQuotes, setActiveQuoteId]);

  const removeQuote = useCallback(async (id: string) => {
    await queues.current.get(id);
    const backup = quotes.find(q => q.id === id);
    if (!backup) return false;
    try {
      const res = await apiFetch(`/api/quotes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha na API');
      const remaining = quotesRef.current.filter(q => q.id !== id);
      quotesRef.current = remaining;
      setQuotes(prev => prev.filter(q => q.id !== id));
      if (id === activeQuoteId) setActiveQuoteId(remaining[0]?.id || null);
      return true;
    } catch (err) {
      console.error('Falha ao excluir proposta no backend', err);
      errorRef.current?.('Não foi possível excluir a proposta. Cancele a reserva antes de excluir.');
      return false;
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
    
    const currentQuote = quotesRef.current.find(q => q.id === targetQuoteId);
    if (!currentQuote) return;
    if (currentQuote.isReserved || (currentQuote.status && currentQuote.status !== 'DRAFT')) {
      errorRef.current?.('Crie uma nova proposta para selecionar equipamentos.');
      return;
    }
    const exists = currentQuote.items.some((c: Equipamento) => c.idPatrimonio === item.idPatrimonio);
    if (!exists && !isEquipmentAvailable(item)) {
      errorRef.current?.('Este equipamento não está disponível para reserva.');
      return;
    }
    
    const newItems = exists
      ? currentQuote.items.filter((c: Equipamento) => c.idPatrimonio !== item.idPatrimonio)
      : [...currentQuote.items, item];
      
    await updateQuote(targetQuoteId, { items: newItems });
  }, [quotes, activeQuote, activeQuoteId, addNewQuote, updateQuote]);

  const updateCartItems = useCallback(async (items: Equipamento[]) => {
    let id = activeQuoteId;
    if (!id || !quotesRef.current.some(quote => quote.id === id)) id = await addNewQuote();
    if (id) await updateQuote(id, { items });
  }, [activeQuoteId, addNewQuote, updateQuote]);

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
    updateCartItems,
  };
}
