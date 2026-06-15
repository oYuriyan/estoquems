import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import type { Quote, Equipamento } from '../types';

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

  const refreshQuotes = async () => {
    if (!user) return;
    try {
      const res = await apiFetch('/api/quotes/');
      if (res.ok) {
        const backendQuotes = await res.json();
        // Mapeia do backend pro frontend
        const mappedQuotes: Quote[] = backendQuotes.map((q: any) => ({
          id: q.id,
          name: q.name,
          clientName: q.client_name,
          margin: q.margin,
          validityDays: q.validity_days,
          isReserved: q.status === 'RESERVED',
          reservedAt: q.reserved_at,
          items: (q.items || []).map((eq: any) => ({
             ...eq,
             idPatrimonio: eq.idPatrimonio || eq.id_patrimonio,
             numeroSerie: eq.numeroSerie || eq.numero_serie,
             idGlpi: eq.idGlpi || eq.id_glpi
          }))
        }));
        setQuotes(mappedQuotes);
        // Atualiza activeQuoteId caso tenha sido apagada
        setActiveQuoteId(prev => mappedQuotes.some(q => q.id === prev) ? prev : (mappedQuotes.length > 0 ? mappedQuotes[0].id : null));
      }
    } catch (err) {
      console.error('Erro ao buscar propostas do backend', err);
    }
  };

  // Carrega as propostas do backend ao logar
  useEffect(() => {
    if (user) {
      refreshQuotes();
    } else {
      setQuotes([]);
      setActiveQuoteId(null);
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
      
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      setWsMessage(event.data);
      // Limpa mensagem após 1s para permitir receber mesmos eventos repetidos
      setTimeout(() => setWsMessage(null), 1000);
    };
    
    ws.onclose = () => console.log('WebSocket desconectado');
    ws.onerror = (err) => console.error('WebSocket erro:', err);

    return () => {
      ws.close();
    };
  }, [user]);

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

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within an AppProvider');
  return context;
};
