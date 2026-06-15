import { useState, useCallback, useEffect } from 'react';

const TOUR_STORAGE_KEY = 'microEstoque_tour_done';

export interface TourStep {
  target: string;          // data-tour attribute value
  title: string;
  description: string;
  placement: 'bottom' | 'top' | 'left' | 'right';
}

export const TOUR_STEPS: TourStep[] = [
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
];

export function useTour(isAuthenticated: boolean) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Inicia o tour apenas APÓS o usuário estar autenticado e a UI principal estar montada.
  // Se rodar antes do login, os elementos [data-tour] não existem no DOM ainda,
  // e o OnboardingTour retorna null silenciosamente — o que causava o bug de tour invisível.
  useEffect(() => {
    if (!isAuthenticated) return;
    const done = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!done) {
      // Delay generoso para garantir que o catálogo carregou e renderizou os elementos alvo
      const timer = setTimeout(() => setIsActive(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated]); // Reage quando o usuário loga


  const next = useCallback(() => {
    setCurrentStepIndex(prev => {
      if (prev < TOUR_STEPS.length - 1) return prev + 1;
      // Último passo: finaliza
      localStorage.setItem(TOUR_STORAGE_KEY, 'true');
      setIsActive(false);
      return 0;
    });
  }, []);

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
    currentStep: TOUR_STEPS[currentStepIndex],
    currentStepIndex,
    totalSteps: TOUR_STEPS.length,
    next,
    prev,
    skip,
    restart,
  };
}
