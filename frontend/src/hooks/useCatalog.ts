import { useState, useEffect, useCallback, useRef } from 'react';
import type { GroupedItem } from '../types';
import { apiFetch } from '../utils/api';
import { mapEquipment } from '../utils/equipment';

interface UseCatalogOptions {
  pausePolling?: boolean;
  isAuthenticated?: boolean;
  onError?: (message: string) => void;
}

export function useCatalog({ pausePolling = false, isAuthenticated = false, onError }: UseCatalogOptions = {}) {
  const [data, setData] = useState<{ 
    groups: GroupedItem[], 
    metadados: {
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

      setData(prev => {
        if (resetPage || !prev) {
          return {
            groups: mappedGroups,
            metadados: { 
              totalEquipments: payload.total_equipments, 
              totalGroups: payload.total_groups,
              totalNovos: payload.total_novos,
              totalUsados: payload.total_usados,
              totalAvailable: payload.total_available,
              totalReserved: payload.total_reserved,
              ultimaAtualizacao: payload.retrieved_at || new Date().toISOString(),
              ultimaSincronizacaoGLPI: payload.source_updated_at || undefined,
            }
          };
        }
        return {
          ...prev,
          groups: [...prev.groups, ...mappedGroups.filter((group: GroupedItem) => !prev.groups.some(previous => previous.key === group.key))]
        };
      });
      
      setAvailableBrands(payload.available_brands || []);
      setAvailableTypes(payload.available_types || []);
      setHasMore(payload.current_page < payload.total_pages);
      page.current = currentPage + 1;
      return true;

    } catch (err: unknown) {
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

  /** Aciona sync GLPI via n8n e faz polling até o catálogo ser atualizado (máx 30s) */
  const syncGLPI = useCallback(async (onSuccess?: (msg: string) => void, onInfo?: (msg: string) => void) => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    onInfo?.('Sincronização acionada. Aguardando n8n processar...');

    // Busca o timestamp real atual do arquivo ANTES de disparar o n8n
    let snapshotTimestamp = '';
    try {
      const initialRes = await fetch(`/catalogo.json?t=${Date.now()}`, { cache: 'no-store' });
      const initialJson = await initialRes.json();
      const initialParsed = Array.isArray(initialJson) ? initialJson[0] : initialJson;
      snapshotTimestamp = initialParsed?.metadados?.ultimaAtualizacao ?? '';
    } catch { /* ignore */ }

    try {
      const response = await fetch('/webhook/atualizar_estoque', { method: 'GET', cache: 'no-store' });
      if (!response.ok) throw new Error('Falha ao acionar a sincronização.');
    } catch {
      setIsRefreshing(false);
      onInfo?.('Não foi possível acionar a sincronização do GLPI.');
      return;
    }

    let attempts = 0;

    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/catalogo.json?t=${Date.now()}`, { cache: 'no-store' });
        const json = await res.json();
        const parsed = Array.isArray(json) ? json[0] : json;
        if (parsed?.metadados?.ultimaAtualizacao && parsed.metadados.ultimaAtualizacao !== snapshotTimestamp) {
          clearInterval(poll);
          try {
            // Avisa o backend para ler o novo catalogo.json e salvar no Postgres
            const response = await apiFetch('/api/equipments/sync', { method: 'POST' });
            if (!response.ok) throw new Error('Falha ao gravar o catálogo no banco.');
            // Recarrega do Postgres (resetando a página para atualizar contagens e limpar duplicatas)
            if (!await fetchCatalogo(false, true)) throw new Error('Falha ao consultar o catálogo atualizado.');
            onSuccess?.('Catálogo atualizado e sincronizado com sucesso!');
          } catch (err) {
            console.error('Erro ao sincronizar com o banco de dados:', err);
            onInfo?.('JSON gerado, mas houve um erro ao sincronizar com o banco.');
          }
          setIsRefreshing(false);
          return;
        }
      } catch { /* ignora erros de polling */ }

      if (attempts >= 6) {
        clearInterval(poll);
        setIsRefreshing(false);
        onInfo?.('Sincronização acionada, mas o catálogo ainda não foi atualizado. Tente em instantes.');
      }
    }, 5000);
  }, [isRefreshing, fetchCatalogo]);

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
