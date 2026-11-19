import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiFetch } from '../utils/api';
import { useCatalog } from './useCatalog';

vi.mock('../utils/api', () => ({ apiFetch: vi.fn() }));
const catalog = { groups: [], current_page: 1, total_pages: 1, total_equipments: 0, source_updated_at: null };
const reply = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('nao acessa arquivo ou webhook publico e so anuncia sucesso depois da importacao', async () => {
  const rawFetch = vi.fn(); vi.stubGlobal('fetch', rawFetch);
  let reads = 0;
  vi.mocked(apiFetch).mockImplementation(async path => {
    if (path.includes('/grouped')) return reply(catalog);
    if (path.endsWith('/source-status')) return reply({ source_updated_at: reads++ === 0 ? 'old' : 'new' });
    return reply({}, path.endsWith('/refresh-source') ? 202 : 200);
  });
  const success = vi.fn(), info = vi.fn();
  const { result } = renderHook(() => useCatalog({ isAuthenticated: true }));
  await act(async () => {});
  let pending!: Promise<void>;
  await act(async () => { pending = result.current.syncGLPI(success, info); });
  expect(success).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); await pending; });
  expect(apiFetch).toHaveBeenCalledWith('/api/equipments/refresh-source', expect.objectContaining({ method: 'POST' }));
  expect(apiFetch).toHaveBeenCalledWith('/api/equipments/sync', expect.objectContaining({ method: 'POST' }));
  expect(success).toHaveBeenCalledOnce();
  expect(rawFetch).not.toHaveBeenCalled();
});

it('nao mostra sucesso nem importa quando a API recusa o acionamento', async () => {
  vi.mocked(apiFetch).mockImplementation(async path => {
    if (path.includes('/grouped')) return reply(catalog);
    if (path.endsWith('/source-status')) return reply({ source_updated_at: null });
    return reply({ detail: 'Operação permitida somente ao administrador.' }, 403);
  });
  const success = vi.fn(), info = vi.fn();
  const { result } = renderHook(() => useCatalog({ isAuthenticated: true }));
  await act(async () => {});
  await act(async () => { await result.current.syncGLPI(success, info); });
  expect(success).not.toHaveBeenCalled();
  expect(info).toHaveBeenCalledWith('Operação permitida somente ao administrador.');
  expect(apiFetch).not.toHaveBeenCalledWith('/api/equipments/sync', expect.anything());
});

it('cancela a espera ao sair da conta sem iniciar importacao posterior', async () => {
  vi.mocked(apiFetch).mockImplementation(async path => {
    if (path.includes('/grouped')) return reply(catalog);
    if (path.endsWith('/source-status')) return reply({ source_updated_at: 'old' });
    return reply({}, 202);
  });
  const success = vi.fn();
  const { result, rerender } = renderHook(({ authenticated }) => useCatalog({ isAuthenticated: authenticated }), { initialProps: { authenticated: true } });
  await act(async () => {});
  let pending!: Promise<void>;
  await act(async () => { pending = result.current.syncGLPI(success, vi.fn()); });
  rerender({ authenticated: false });
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); await pending; });
  expect(success).not.toHaveBeenCalled();
  expect(apiFetch).not.toHaveBeenCalledWith('/api/equipments/sync', expect.anything());
});
