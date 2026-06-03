import React, { createContext, useContext, useState, useEffect } from 'react';

// Reuse types from App.tsx (or move them to a separate file later)
export interface Equipamento {
  idPatrimonio: string;
  idGlpi: string;
  numeroSerie: string;
  tipo: string;
  marca: string;
  modelo: string;
  status: string;
  fornecedor: string;
  especificacoes: {
    processador: string;
    ram: string;
    armazenamento: string;
    tela?: string;
    so?: string;
  };
}

export interface Quote {
  id: string;
  name: string;
  items: Equipamento[];
  clientName?: string;
  margin?: string;
  validityDays?: number;
  isReserved?: boolean;
  reservedAt?: string;
}

interface AppContextData {
  quotes: Quote[];
  setQuotes: React.Dispatch<React.SetStateAction<Quote[]>>;
  activeQuoteId: string | null;
  setActiveQuoteId: React.Dispatch<React.SetStateAction<string | null>>;
  salesperson: string | null;
  setSalesperson: React.Dispatch<React.SetStateAction<string | null>>;
  isDarkMode: boolean;
  setIsDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
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
  const [salesperson, setSalesperson] = useState<string | null>(localStorage.getItem('microEstoque_salesperson'));
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('microEstoque_theme') === 'dark');

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

  return (
    <AppContext.Provider value={{ quotes, setQuotes, activeQuoteId, setActiveQuoteId, salesperson, setSalesperson, isDarkMode, setIsDarkMode }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within an AppProvider');
  return context;
};
