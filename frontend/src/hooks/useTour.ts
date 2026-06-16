import { useState, useCallback, useEffect } from 'react';

const TOUR_STORAGE_KEY = 'microEstoque_tour_done';

export interface TourStep {
  target: string;          // data-tour attribute value
  title: string;
  description: string;
  placement: 'bottom' | 'top' | 'left' | 'right';
}

export const FULL_TOUR_STEPS: TourStep[] = [
  {
    target: 'search',
    title: '🔍 Busca Inteligente',
    description: 'Digite aqui para encontrar qualquer equipamento. A busca filtra por modelo, marca, processador e muito mais — em tempo real.',
    placement: 'bottom',
  },
  {
    target: 'stats-bar',
    title: '📊 Resumo do Estoque',
    description: 'Aqui você vê o total de equipamentos disponíveis. Clique em "Novo" ou "Usado" para filtrar rapidamente por condição.',
    placement: 'bottom',
  },
  {
    target: 'filter-bar',
    title: '🏷️ Filtros por Marca',
    description: 'Use os filtros de marca para encontrar equipamentos específicos. Você pode combinar com a busca por texto.',
    placement: 'bottom',
  },
  {
    target: 'catalog-grid',
    title: '🖥️ Catálogo de Equipamentos',
    description: 'Clique em qualquer card para ver as unidades disponíveis e adicioná-las à sua proposta. O indicador amarelo mostra itens já cotados.',
    placement: 'top',
  },
  {
    target: 'sidebar-quotes',
    title: '📋 Suas Propostas',
    description: 'Suas propostas ficam aqui, na barra lateral. Clique no "+" para criar uma nova, ou selecione uma existente para continuar editando.',
    placement: 'right',
  },
  {
    target: 'sidebar-quotes',
    title: '✅ Seleção e Reserva',
    description: 'Dentro da proposta, você seleciona os equipamentos desejados e pode reservá-los por 48 horas! Isso garante os itens para seu cliente.',
    placement: 'right',
  }
];

export function useTour(isAuthenticated: boolean) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const activeSteps = isMobile 
    ? FULL_TOUR_STEPS.map((s): TourStep => 
        s.target === 'sidebar-quotes' 
          ? { 
              ...s, 
              target: 'mobile-nav', 
              placement: 'top',
              description: s.description.replace('na barra lateral', 'aqui embaixo').replace('Clique no "+"', 'Acesse o menu') 
            } 
          : s
      )
    : FULL_TOUR_STEPS;
  useEffect(() => {
    if (!isAuthenticated) return;
    const done = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!done) {
      const timer = setTimeout(() => setIsActive(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated]);

  const next = useCallback(() => {
    setCurrentStepIndex(prev => {
      if (prev < activeSteps.length - 1) return prev + 1;
      localStorage.setItem(TOUR_STORAGE_KEY, 'true');
      setIsActive(false);
      return 0;
    });
  }, [activeSteps.length]);

  const prev = useCallback(() => {
    setCurrentStepIndex(prev => Math.max(0, prev - 1));
  }, []);

  const skip = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setIsActive(false);
    setCurrentStepIndex(0);
  }, []);

  const restart = useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  return {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps: activeSteps.length,
    next,
    prev,
    skip,
    restart,
  };
}
