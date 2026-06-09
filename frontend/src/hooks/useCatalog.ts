import { useState, useEffect, useCallback } from 'react';
import type { Catalogo } from '../types';
import { apiFetch } from '../utils/api';

interface UseCatalogOptions {
  /** Pausa o polling enquanto um modal está aberto, evitando re-renders durante interação */
  pausePolling?: boolean;
  onError?: (message: string) => void;
}

export function useCatalog({ pausePolling = false, onError }: UseCatalogOptions = {}) {
  const [data, setData] = useState<Catalogo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchCatalogo = useCallback(async (silent = true) => {
    if (!silent) setIsRefreshing(true);
    try {
      const response = await apiFetch('/api/equipments/');
      if (!response.ok) throw new Error('Falha ao carregar o catálogo.');
      
      const equipamentos = await response.json();
      
      // Monta o objeto no formato antigo para não quebrar a UI
      const mockCatalogo: Catalogo = {
        metadados: {
          ultimaAtualizacao: new Date().toISOString(),
          totalItens: equipamentos.length
        },
        estoque: equipamentos
      };
      
      setData(mockCatalogo);
    } catch (err: any) {
      console.error(err.message || 'Erro desconhecido ao carregar dados.');
      if (!silent) onError?.('Erro ao atualizar o catálogo.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [onError]);

  /** Aciona sync GLPI via n8n e faz polling até o catálogo ser atualizado (máx 30s) */
  const syncGLPI = useCallback(async (onSuccess?: (msg: string) => void, onInfo?: (msg: string) => void) => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    onInfo?.('Sincronização acionada. Aguardando n8n processar...');

    try {
      await fetch('/webhook/atualizar_estoque', { method: 'GET', mode: 'no-cors' });
    } catch { /* no-cors não lança erro */ }

    const snapshotTimestamp = data?.metadados?.ultimaAtualizacao ?? '';
    let attempts = 0;

    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/catalogo.json?t=${Date.now()}`, { cache: 'no-store' });
        const json = await res.json();
        const parsed = Array.isArray(json) ? json[0] : json;
        if (parsed?.metadados?.ultimaAtualizacao !== snapshotTimestamp) {
          clearInterval(poll);
          setData(parsed);
          setIsRefreshing(false);
          onSuccess?.('Catálogo atualizado com sucesso!');
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

  // Auto-refresh a cada 60s, pausado enquanto modais estiverem abertos
  useEffect(() => {
    fetchCatalogo(true);
    if (pausePolling) return;
    const interval = setInterval(() => fetchCatalogo(true), 60_000);
    return () => clearInterval(interval);
  }, [fetchCatalogo, pausePolling]);

  return { data, loading, isRefreshing, fetchCatalogo, syncGLPI };
}
