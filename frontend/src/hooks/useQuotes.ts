import { useMemo, useCallback } from 'react';
import { useAppContext } from '../contexts/AppContext';
import type { Equipamento, Quote } from '../types';

export function useQuotes() {
  const { quotes, setQuotes, activeQuoteId, setActiveQuoteId } = useAppContext();

  const activeQuote = useMemo(
    () => quotes.find(q => q.id === activeQuoteId) || quotes[0] || null,
    [quotes, activeQuoteId]
  );

  const cart = useMemo(() => activeQuote?.items ?? [], [activeQuote]);

  const updateQuote = useCallback((id: string | null, patch: Partial<Quote>) => {
    if (!id) return;
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
  }, [setQuotes]);

  const addNewQuote = useCallback(() => {
    const id = Date.now().toString();
    const name = `Proposta ${quotes.length + 1}`;
    const newQuote: Quote = { id, name, items: [], clientName: '', margin: '', validityDays: 2 };
    setQuotes(prev => [...prev, newQuote]);
    setActiveQuoteId(id);
    return id;
  }, [quotes.length, setQuotes, setActiveQuoteId]);

  const removeQuote = useCallback((id: string) => {
    const remaining = quotes.filter(q => q.id !== id);
    setQuotes(remaining);
    if (id === activeQuoteId) {
      setActiveQuoteId(remaining.length > 0 ? remaining[0].id : null);
    }
  }, [quotes, activeQuoteId, setQuotes, setActiveQuoteId]);

  const toggleCartItem = useCallback((item: Equipamento) => {
    // Cria proposta automaticamente se não houver nenhuma
    if (quotes.length === 0 || !activeQuote) {
      const id = Date.now().toString();
      setQuotes([{ id, name: 'Proposta 1', items: [item], clientName: '', margin: '', validityDays: 2 }]);
      setActiveQuoteId(id);
      return;
    }
    const exists = cart.some(c => c.idPatrimonio === item.idPatrimonio);
    const newItems = exists
      ? cart.filter(c => c.idPatrimonio !== item.idPatrimonio)
      : [...cart, item];
    updateQuote(activeQuoteId, { items: newItems });
  }, [quotes, activeQuote, cart, activeQuoteId, setQuotes, setActiveQuoteId, updateQuote]);

  return {
    quotes,
    activeQuote,
    activeQuoteId,
    setActiveQuoteId,
    cart,
    updateQuote,
    addNewQuote,
    removeQuote,
    toggleCartItem,
  };
}
