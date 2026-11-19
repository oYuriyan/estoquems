import { useState, useEffect, useCallback, useRef } from 'react';
import type { GroupedItem } from '../types';
import { apiFetch } from '../utils/api';
import { mapEquipment } from '../utils/equipment';
import type { InventoryReservationMetadata } from '../utils/inventory';

interface UseCatalogOptions {
  pausePolling?: boolean;
  isAuthenticated?: boolean;
  onError?: (message: string) => void;
}

export function useCatalog({ pausePolling = false, isAuthenticated = false, onError }: UseCatalogOptions = {}) {
  const [data, setData] = useState<{ 
    groups: GroupedItem[], 
    metadados: InventoryReservationMetadata & {
      ultimaAtualizacao?: string;
      ultimaSincronizacaoGLPI?: string;
      totalEquipments?: number;
      totalNovos?: number;
      totalUsados?: number;
      totalGroups?: number;
      totalAvailable?: number;
      totalReserved?: number;
    }
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // States para server-side fetching
  const page = useRef(1);
  const request = useRef<AbortController | null>(null);
  const syncRequest = useRef<AbortController | null>(null);
  const errorHandler = useRef(onError);
  useEffect(() => { errorHandler.current = onError; }, [onError]);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    brand: null as string | null,
    statusFilter: null as string | null,
    typeFilter: 'NOTEBOOK' as string | null,
    sortKey: null as string | null,
    sortDir: 'desc'
  });
  
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);

  // Carrega ou anexa os dados
  const fetchCatalogo = useCallback(async (silent = true, resetPage = false) => {
    if (!resetPage && request.current) return false;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    if (!silent || !resetPage) setIsRefreshing(true);
    const currentPage = resetPage ? 1 : page.current;
    
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', '24');
      if (filters.search) params.append('search', filters.search);
      if (filters.brand) params.append('brand', filters.brand);
      if (filters.statusFilter) params.append('status_filter', filters.statusFilter);
      if (filters.typeFilter) params.append('type_filter', filters.typeFilter);
      if (filters.sortKey) {
        params.append('sort_key', filters.sortKey);
        params.append('sort_dir', filters.sortDir);
      }

      const response = await apiFetch(`/api/equipments/grouped?${params.toString()}`, { signal: controller.signal });
      if (!response.ok) throw new Error('Falha ao carregar o catálogo.');
      
      const payload = await response.json();
      if (controller.signal.aborted) return false;
      
      // Converte snake_case para camelCase nos items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedGroups = payload.groups.map((g: any) => ({
        ...g,
        items: g.items.map(mapEquipment)
      }));

      const metadados = {
        totalEquipments: payload.total_equipments,
        totalGroups: payload.total_groups,
        totalNovos: payload.total_novos,
        totalUsados: payload.total_usados,
        totalAvailable: payload.total_available,
        totalReserved: payload.total_reserved,
        ultimaAtualizacao: payload.retrieved_at || new Date().toISOString(),
        ultimaSincronizacaoGLPI: payload.source_updated_at || undefined,
        reservationAllowed: payload.reservation_allowed === true,
        reservationBlockReason: payload.reservation_block_reason || undefined,
        inventoryFreshUntil: payload.inventory_fresh_until || undefined,
      };

      setData(prev => {
        if (resetPage || !prev) {
          return {
            groups: mappedGroups,
            metadados,
          };
        }
        return {
          ...prev,
          metadados,
          groups: [...prev.groups, ...mappedGroups.filter((group: GroupedItem) => !prev.groups.some(previous => previous.key === group.key))]
        };
      });
      
      setAvailableBrands(payload.available_brands || []);
      setAvailableTypes(payload.available_types || []);
      setHasMore(payload.current_page < payload.total_pages);
      page.current = currentPage + 1;
      return true;

    } catch (err: unknown) {
      if (controller.signal.aborted) return false;
      console.error(err instanceof Error ? err.message : 'Erro desconhecido ao carregar dados.');
      if (!controller.signal.aborted && !silent) errorHandler.current?.('Erro ao atualizar o catálogo.');
      return false;
    } finally {
      if (request.current === controller) {
        request.current = null;
        if (resetPage) setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [filters]);

  // Se os filtros ou a autenticação mudarem, reseta a página (somente se autenticado)
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!data) setTimeout(() => setLoading(true), 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCatalogo(false, true);
    return () => { request.current?.abort(); };
  }, [filters, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cancela a espera local ao sair da conta ou desmontar a tela.
  useEffect(() => () => syncRequest.current?.abort(), [isAuthenticated]);

  /** Somente a API autenticada solicita a exportação; arquivo e webhook ficam internos. */
  const syncGLPI = useCallback(async (onSuccess?: (msg: string) => void, onInfo?: (msg: string) => void) => {
    if (isRefreshing || syncRequest.current || !isAuthenticated) return;
    const controller = new AbortController();
    syncRequest.current = controller;
    setIsRefreshing(true);

    const readSourceTime = async () => {
      const response = await apiFetch('/api/equipments/source-status', { signal: controller.signal });
      if (response.status === 502) return null;
      if (!response.ok) throw new Error('Não foi possível consultar a exportação do inventário.');
      const payload = await response.json();
      return typeof payload.source_updated_at === 'string' ? payload.source_updated_at : null;
    };
    const waitForRetry = () => new Promise<void>((resolve, reject) => {
      if (controller.signal.aborted) { reject(new DOMException('Cancelado', 'AbortError')); return; }
      const abort = () => { window.clearTimeout(timer); reject(new DOMException('Cancelado', 'AbortError')); };
      const timer = window.setTimeout(() => { controller.signal.removeEventListener('abort', abort); resolve(); }, 5000);
      controller.signal.addEventListener('abort', abort, { once: true });
    });

    try {
      const previousTimestamp = await readSourceTime();
      const requested = await apiFetch('/api/equipments/refresh-source', { method: 'POST', signal: controller.signal });
      if (!requested.ok) {
        const error = await requested.json().catch(() => ({}));
        throw new Error(typeof error.detail === 'string' ? error.detail : 'Não foi possível solicitar a atualização do inventário.');
      }
      onInfo?.('Atualização solicitada. Aguardando a exportação do inventário...');
      for (let attempt = 0; attempt < 6; attempt++) {
        await waitForRetry();
        const timestamp = await readSourceTime();
        if (!timestamp || timestamp === previousTimestamp) continue;
        const imported = await apiFetch('/api/equipments/sync', { method: 'POST', signal: controller.signal });
        if (!imported.ok) {
          const error = await imported.json().catch(() => ({}));
          throw new Error(typeof error.detail === 'string' ? error.detail : 'A exportação não pôde ser validada. O catálogo anterior foi preservado.');
        }
        if (!await fetchCatalogo(false, true)) throw new Error('Não foi possível consultar o catálogo atualizado.');
        onSuccess?.('Catálogo atualizado e validado com sucesso!');
        return;
      }
      onInfo?.('A origem ainda não confirmou uma exportação nova. O catálogo anterior foi preservado.');
    } catch (error) {
      if (!controller.signal.aborted) onInfo?.(error instanceof Error ? error.message : 'Não foi possível atualizar o inventário.');
    } finally {
      if (syncRequest.current === controller) {
        syncRequest.current = null;
        setIsRefreshing(false);
      }
    }
  }, [isRefreshing, isAuthenticated, fetchCatalogo]);

  // Auto-refresh a cada 60s
  useEffect(() => {
    if (pausePolling || !isAuthenticated) return;
    // O auto refresh deve sempre ser silencioso e resetar para não ficar duplicando itens
    const interval = setInterval(() => fetchCatalogo(true, true), 60_000);
    return () => clearInterval(interval);
  }, [fetchCatalogo, pausePolling, isAuthenticated]);

  return { 
    data, 
    loading, 
    isRefreshing, 
    hasMore,
    filters,
    setFilters,
    availableBrands,
    availableTypes,
    fetchCatalogo, 
    loadMore: () => { if(hasMore) fetchCatalogo(true, false); },
    syncGLPI 
  };
}
