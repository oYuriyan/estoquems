import React, { createContext, useContext, useState, useCallback } from 'react';
import type { GroupedItem } from '../types';

/**
 * UIContext — Estado exclusivo de interface do usuário.
 *
 * Separado do AppContext (que contém dados de domínio como user, quotes, wsMessage)
 * para evitar que mudanças de UI causem re-renders em componentes que só consomem
 * dados de negócio, e vice-versa.
 */
interface UIContextData {
  // Modais e Drawers
  isQuoteModalOpen: boolean;
  setIsQuoteModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAdminPanelOpen: boolean;
  setIsAdminPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobileDrawerOpen: boolean;
  setIsMobileDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Navegação mobile
  mobileTab: 'catalogo' | 'propostas' | 'reservas';
  setMobileTab: React.Dispatch<React.SetStateAction<'catalogo' | 'propostas' | 'reservas'>>;

  // Fluxo de criação de proposta
  quoteStep: 1 | 2 | 3;
  setQuoteStep: React.Dispatch<React.SetStateAction<1 | 2 | 3>>;

  // Catálogo
  activeGroup: GroupedItem | null;
  setActiveGroup: React.Dispatch<React.SetStateAction<GroupedItem | null>>;
  viewMode: 'cards' | 'list';
  setViewMode: React.Dispatch<React.SetStateAction<'cards' | 'list'>>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;

  // Estado derivado
  anyModalOpen: boolean;

  // Ações compostas
  openQuote: (id: string, setActiveQuoteId: (id: string) => void) => void;
  closeQuote: () => void;
}

const UIContext = createContext<UIContextData | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'catalogo' | 'propostas' | 'reservas'>('catalogo');
  const [quoteStep, setQuoteStep] = useState<1 | 2 | 3>(1);
  const [activeGroup, setActiveGroup] = useState<GroupedItem | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [searchTerm, setSearchTerm] = useState('');

  const anyModalOpen = isQuoteModalOpen || isMobileDrawerOpen;

  // Abre a modal de proposta e reseta o stepper
  const openQuote = useCallback((id: string, setActiveQuoteId: (id: string) => void) => {
    setActiveQuoteId(id);
    setQuoteStep(1);
    setIsQuoteModalOpen(true);
  }, []);

  const closeQuote = useCallback(() => {
    setIsQuoteModalOpen(false);
  }, []);

  return (
    <UIContext.Provider value={{
      isQuoteModalOpen, setIsQuoteModalOpen,
      isAdminPanelOpen, setIsAdminPanelOpen,
      isMobileDrawerOpen, setIsMobileDrawerOpen,
      mobileTab, setMobileTab,
      quoteStep, setQuoteStep,
      activeGroup, setActiveGroup,
      viewMode, setViewMode,
      searchTerm, setSearchTerm,
      anyModalOpen,
      openQuote,
      closeQuote,
    }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUIContext = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUIContext must be used within a UIProvider');
  return context;
};
