import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuotes } from './useQuotes';
import { apiFetch } from '../utils/api';
import type { Quote } from '../types';

const context = {
  quotes: [] as Quote[], setQuotes: vi.fn(), activeQuoteId: 'quote-1',
  setActiveQuoteId: vi.fn(), refreshQuotes: vi.fn().mockResolvedValue(undefined),
};
vi.mock('../contexts/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../utils/api', () => ({ apiFetch: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  context.quotes = [{ id: 'quote-1', status: 'DRAFT', name: 'Proposta', validityDays: 2, items: [] }];
});

describe('Gravação de propostas', () => {
  it('informa falha HTTP e consulta novamente os dados do servidor', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ ok: false, json: async () => ({ detail: 'Gravação recusada' }) } as Response);
    const onError = vi.fn();
    const { result } = renderHook(() => useQuotes(onError));
    let saved;
    await act(async () => { saved = await result.current.updateQuote('quote-1', { clientName: 'Cliente' }); });
    expect(saved).toBe(false);
    expect(onError).toHaveBeenCalledWith('Gravação recusada');
    expect(context.refreshQuotes).toHaveBeenCalledOnce();
  });

  it('grava alterações rápidas em ordem e mantém o último cliente', async () => {
    const clients: string[] = [];
    vi.mocked(apiFetch).mockImplementation(async (_url, options) => {
      clients.push(JSON.parse(String(options?.body)).client_name);
      return { ok: true } as Response;
    });
    const { result } = renderHook(() => useQuotes());
    await act(async () => {
      const first = result.current.updateQuote('quote-1', { clientName: 'Primeiro' });
      const second = result.current.updateQuote('quote-1', { clientName: 'Último' });
      await Promise.all([first, second]);
    });
    expect(clients).toEqual(['Primeiro', 'Último']);
  });

  it('não tenta editar uma proposta cancelada', async () => {
    context.quotes[0].status = 'CANCELED';
    const { result } = renderHook(() => useQuotes());
    await act(async () => { expect(await result.current.updateQuote('quote-1', { clientName: 'Cliente' })).toBe(false); });
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
