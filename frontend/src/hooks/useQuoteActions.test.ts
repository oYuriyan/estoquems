import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useQuoteActions } from './useQuoteActions';
import { apiFetch } from '../utils/api';
import type { Equipamento, Quote } from '../types';

vi.mock('../utils/api', () => ({ apiFetch: vi.fn() }));
const item: Equipamento = {
  id: 'item-1', idPatrimonio: 'TEST-1', idGlpi: '1', numeroSerie: 'SN-1', tipo: 'NOTEBOOK',
  marca: 'DELL', modelo: 'Test', status: 'DISPONIVEL NOVO', fornecedor: '',
  especificacoes: { processador: 'i5', ram: '16GB', armazenamento: '512GB' },
};
const quote: Quote = { id: 'quote-1', name: 'Teste', status: 'DRAFT', items: [item] };
beforeEach(() => vi.clearAllMocks());

it('não salva nem chama o webhook quando a tela já sabe que o inventário está bloqueado', async () => {
  const update = vi.fn().mockResolvedValue(true), fetchCatalog = vi.fn(), refresh = vi.fn(), toast = vi.fn();
  const { result } = renderHook(() => useQuoteActions(quote.id, quote, [item], update, fetchCatalog, refresh, toast, vi.fn(), 'Inventário antigo.'));
  await act(async () => result.current.handleReserve());
  expect(update).not.toHaveBeenCalled();
  expect(apiFetch).not.toHaveBeenCalled();
  expect(toast).toHaveBeenCalledWith('Inventário antigo.', 'error');
});

it('mostra a mensagem estruturada quando o servidor bloqueia uma tela desatualizada', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ ok: false, json: async () => ({ detail: { code: 'inventory_stale', message: 'Atualize o inventário antes de reservar.' } }) } as Response);
  const update = vi.fn().mockResolvedValue(true), fetchCatalog = vi.fn().mockResolvedValue(true), refresh = vi.fn(), toast = vi.fn();
  const { result } = renderHook(() => useQuoteActions(quote.id, quote, [item], update, fetchCatalog, refresh, toast, vi.fn(), null));
  await act(async () => result.current.handleReserve());
  expect(toast).toHaveBeenCalledWith('Atualize o inventário antes de reservar.', 'error');
  expect(fetchCatalog).toHaveBeenCalled();
  expect(refresh).toHaveBeenCalled();
});

it('HTTP 202 mostra pendência e nunca anuncia sucesso', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ok:true,status:202,json:async()=>({detail:{message:'Conferência pendente.'}})} as Response);
  const update=vi.fn().mockResolvedValue(true),refresh=vi.fn(),fetchCatalog=vi.fn(),toast=vi.fn();
  const {result}=renderHook(()=>useQuoteActions(quote.id,quote,[item],update,fetchCatalog,refresh,toast,vi.fn(),null));
  await act(async()=>result.current.handleReserve());
  expect(toast).toHaveBeenCalledWith('Conferência pendente.','info');
  expect(toast.mock.calls.some(call=>call[1]==='success')).toBe(false);
  expect(refresh).toHaveBeenCalledOnce();
});
it('dois cliques simultâneos enviam somente uma solicitação', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ok:true,status:200,json:async()=>({operation:{message:'Reserva confirmada.'}})} as Response);
  const update=vi.fn().mockResolvedValue(true);
  const {result}=renderHook(()=>useQuoteActions(quote.id,quote,[item],update,vi.fn(),vi.fn(),vi.fn(),vi.fn(),null));
  await act(async()=>{await Promise.all([result.current.handleReserve(),result.current.handleReserve()]);});
  expect(apiFetch).toHaveBeenCalledOnce();
});
