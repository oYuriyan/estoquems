import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api';
import type { Quote, Equipamento } from '../types';
import { mapEquipment } from '../utils/equipment';

// Re-export para compatibilidade com imports existentes
export type { Equipamento, Quote };

export interface User {
  id?: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'SALES';
}

interface AppContextData {
  quotes: Quote[];
  setQuotes: React.Dispatch<React.SetStateAction<Quote[]>>;
  activeQuoteId: string | null;
  setActiveQuoteId: React.Dispatch<React.SetStateAction<string | null>>;
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  isDarkMode: boolean;
  setIsDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  refreshQuotes: () => Promise<void>;
  wsMessage: string | null;
}

const AppContext = createContext<AppContextData | undefined>(undefined);

const STORAGE_KEY_QUOTES = 'microEstoque_quotes';
const STORAGE_KEY_ACTIVE = 'microEstoque_activeQuoteId';

const loadPersistedQuotes = (): Quote[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_QUOTES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return [];
};

const loadPersistedActiveId = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY_ACTIVE) || null;
  } catch { /* ignore */ }
  return null;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [quotes, setQuotes] = useState<Quote[]>(loadPersistedQuotes);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(loadPersistedActiveId);
  
  // Lê o user persistido (se houver)
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('microEstoque_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('microEstoque_theme') === 'dark');
  const [wsMessage, setWsMessage] = useState<string | null>(null);

  const refreshQuotes = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiFetch('/api/quotes/');
      if (res.ok) {
        const backendQuotes = await res.json();
        // Mapeia do backend pro frontend
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedQuotes: Quote[] = backendQuotes.map((q: any) => ({
          id: q.id,
          status: q.status,
          operation: q.operation,
          name: q.name,
          clientName: q.client_name,
          margin: q.margin,
          validityDays: q.validity_days,
          isReserved: q.status === 'RESERVED',
          reservedAt: q.reserved_at,
          items: (q.items || []).map(mapEquipment)
        }));
        setQuotes(mappedQuotes);
        // Atualiza activeQuoteId caso tenha sido apagada
        setActiveQuoteId(prev => mappedQuotes.some(q => q.id === prev) ? prev : (mappedQuotes.length > 0 ? mappedQuotes[0].id : null));
      }
    } catch (err) {
      console.error('Erro ao buscar propostas do backend', err);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !quotes.some(quote => ['PENDING', 'PARTIAL'].includes(quote.operation?.status || ''))) return;
    const timer = setInterval(() => { void refreshQuotes(); }, 3000);
    return () => clearInterval(timer);
  }, [user, quotes, refreshQuotes]);

  // Carrega as propostas do backend ao logar
  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      refreshQuotes();
    } else {
      setTimeout(() => {
        setQuotes([]);
        setActiveQuoteId(null);
      }, 0);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Conexão WebSocket
  useEffect(() => {
    if (!user) return;
    
    const token = localStorage.getItem('microEstoque_token');
    if (!token) return;

    // Determina a URL do WebSocket baseado na URL atual
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = import.meta.env.DEV 
      ? `ws://localhost:3030/api/ws?token=${token}` 
      : `${protocol}//${window.location.host}/api/ws?token=${token}`;
      
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let messageTimer: ReturnType<typeof setTimeout>;
    let stopped = false;
    let retryDelay = 1000;
    const connect = () => {
      if (stopped) return;
      socket = new WebSocket(wsUrl);
      socket.onopen = () => {
        retryDelay = 1000;
        setWsMessage('RECONNECTED');
        clearTimeout(messageTimer);
        messageTimer = setTimeout(() => setWsMessage(null), 1000);
      };
      socket.onmessage = event => {
        if (event.data === "OPERATION_UPDATED") void refreshQuotes();
        setWsMessage(event.data);
        clearTimeout(messageTimer);
        messageTimer = setTimeout(() => setWsMessage(null), 1000);
      };
      socket.onclose = event => {
        if (!stopped && event.code !== 1008) {
          reconnectTimer = setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 30_000);
        }
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      clearTimeout(messageTimer);
      socket?.close();
    };
  }, [user, refreshQuotes]);

  // Listener global para sessão expirada (evento disparado pelo apiFetch ao receber 401)
  useEffect(() => {
    const handleSessionExpired = () => {
      // Limpa todos os dados de sessão
      localStorage.removeItem('microEstoque_user');
      localStorage.removeItem('microEstoque_token');
      setUser(null);
      // O Toast será exibido pelo App.tsx via window event, pois o Toaster só está disponível lá
      window.dispatchEvent(new CustomEvent('auth:show-toast'));
    };

    window.addEventListener('auth:expired', handleSessionExpired);
    return () => window.removeEventListener('auth:expired', handleSessionExpired);
  }, []);


  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_QUOTES, JSON.stringify(quotes));
  }, [quotes]);

  useEffect(() => {
    if (activeQuoteId) localStorage.setItem(STORAGE_KEY_ACTIVE, activeQuoteId);
    else localStorage.removeItem(STORAGE_KEY_ACTIVE);
  }, [activeQuoteId]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('microEstoque_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('microEstoque_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('microEstoque_user');
      // Limpa token também
      localStorage.removeItem('microEstoque_token');
    }
  }, [user]);

  return (
    <AppContext.Provider value={{ quotes, setQuotes, activeQuoteId, setActiveQuoteId, user, setUser, isDarkMode, setIsDarkMode, refreshQuotes, wsMessage }}>
      {children}
    </AppContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within an AppProvider');
  return context;
};
