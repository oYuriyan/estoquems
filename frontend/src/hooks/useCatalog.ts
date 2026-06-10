import { useState, useEffect, useCallback } from 'react';
import type { Catalogo } from '../types';
import { apiFetch } from '../utils/api';

interface UseCatalogOptions {
  /** Pausa o polling enquanto um modal está aberto, evitando re-renders durante interação */
  pausePolling?: boolean;
  onError?: (message: string) => void;
}

export function useCatalog({ pausePolling = false, onError }: UseCatalogOptions = {}) {
  const [data, setData] = useState<{ groups: GroupedItem[], metadados: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // States para server-side fetching
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    brand: null as string | null,
    statusFilter: null as string | null,
    sortKey: null as string | null,
    sortDir: 'desc'
  });
  
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);

  // Carrega ou anexa os dados
  const fetchCatalogo = useCallback(async (silent = true, resetPage = false) => {
    if (!silent) setIsRefreshing(true);
    
    const currentPage = resetPage ? 1 : page;
    
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', '24');
      if (filters.search) params.append('search', filters.search);
      if (filters.brand) params.append('brand', filters.brand);
      if (filters.statusFilter) params.append('status_filter', filters.statusFilter);
      if (filters.sortKey) {
        params.append('sort_key', filters.sortKey);
        params.append('sort_dir', filters.sortDir);
      }

      const response = await apiFetch(`/api/equipments/grouped?${params.toString()}`);
      if (!response.ok) throw new Error('Falha ao carregar o catálogo.');
      
      const payload = await response.json();
      
      // Converte snake_case para camelCase nos items
      const mappedGroups = payload.groups.map((g: any) => ({
        ...g,
        items: g.items.map((eq: any) => ({
          ...eq,
          idPatrimonio: eq.idPatrimonio || eq.id_patrimonio,
          numeroSerie: eq.numeroSerie || eq.numero_serie,
          idGlpi: eq.idGlpi || eq.id_glpi
        }))
      }));

      setData(prev => {
        if (resetPage || !prev) {
          return {
            groups: mappedGroups,
            metadados: { totalEquipments: payload.total_equipments, totalGroups: payload.total_groups }
          };
        }
        return {
          ...prev,
          groups: [...prev.groups, ...mappedGroups]
        };
      });
      
      setAvailableBrands(payload.available_brands || []);
      setHasMore(payload.current_page < payload.total_pages);
      if (resetPage) setPage(2);
      else setPage(prev => prev + 1);

    } catch (err: any) {
      console.error(err.message || 'Erro desconhecido ao carregar dados.');
      if (!silent) onError?.('Erro ao atualizar o catálogo.');
    } finally {
      if (resetPage) setLoading(false);
      setIsRefreshing(false);
    }
  }, [filters, page, onError]);

  // Se os filtros mudarem, reseta a página
  useEffect(() => {
    setLoading(true);
    fetchCatalogo(true, true);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

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
    } catch { }

    try {
      await fetch('/webhook/atualizar_estoque', { method: 'GET', mode: 'no-cors' });
    } catch { /* no-cors não lança erro */ }

    let attempts = 0;

    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/catalogo.json?t=${Date.now()}`, { cache: 'no-store' });
        const json = await res.json();
        const parsed = Array.isArray(json) ? json[0] : json;
        if (parsed?.metadados?.ultimaAtualizacao !== snapshotTimestamp) {
          clearInterval(poll);
          try {
            // Avisa o backend para ler o novo catalogo.json e salvar no Postgres
            await apiFetch('/api/equipments/sync', { method: 'POST' });
            // Recarrega do Postgres
            await fetchCatalogo(false);
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
  }, [data, isRefreshing]);

  // Auto-refresh a cada 60s
  useEffect(() => {
    if (pausePolling) return;
    // O auto refresh deve sempre ser silencioso e resetar para não ficar duplicando itens
    const interval = setInterval(() => fetchCatalogo(true, true), 60_000);
    return () => clearInterval(interval);
  }, [fetchCatalogo, pausePolling]);

  return { 
    data, 
    loading, 
    isRefreshing, 
    hasMore,
    filters,
    setFilters,
    availableBrands,
    fetchCatalogo, 
    loadMore: () => { if(hasMore) fetchCatalogo(true, false); },
    syncGLPI 
  };
}
