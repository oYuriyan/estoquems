import { useEffect, useMemo, useCallback, useState } from 'react';
import { differenceInHours } from 'date-fns';
import clsx from 'clsx';

// Assets
import logoOficial from './assets/logo_oficial.png';
import watermarkOficial from './assets/watermark_oficial.png';

// Contexts
import { useAppContext } from './contexts/AppContext';
import { useUIContext }  from './contexts/UIContext';

// Hooks
import { useCatalog }      from './hooks/useCatalog';
import { useQuotes }       from './hooks/useQuotes';
import { useToast }        from './hooks/useToast';
import { useConfirm }      from './hooks/useConfirm';
import { usePdf }          from './hooks/usePdf';
import { useDebounce }     from './hooks/useDebounce';
import { useQuoteActions } from './hooks/useQuoteActions';

// Types
import type { GroupedItem } from './types';

// Layout
import { LoginScreen }    from './components/layout/LoginScreen';
import { SkeletonLoader } from './components/layout/SkeletonLoader';
import { Sidebar }        from './components/layout/Sidebar';
import { Header }         from './components/layout/Header';
import { MobileNav }      from './components/layout/MobileNav';

// Catalog
import { StatsBar }        from './components/catalog/StatsBar';
import { FilterBar }       from './components/catalog/FilterBar';
import { CatalogView }     from './components/catalog/CatalogView';
import { ItemDetailModal } from './components/catalog/ItemDetailModal';

// Quotes
import { QuoteDrawer } from './components/quotes/QuoteDrawer';

// Common
import { Toaster }           from 'sonner';
import { ConfirmDialog }     from './components/common/ConfirmDialog';
import { PdfLoadingOverlay } from './components/common/PdfLoadingOverlay';
import { AdminPanel }        from './components/layout/AdminPanel';
import { OnboardingTour }   from './components/common/OnboardingTour';

// Tour
import { useTour } from './hooks/useTour';

export default function App() {
  // ── Domínio (AppContext) ───────────────────────────────────────────────────
  const {
    quotes, activeQuoteId, user, setUser, isDarkMode, setIsDarkMode, wsMessage
  } = useAppContext();

  // ── UI (UIContext) ─────────────────────────────────────────────────────────
  const {
    isQuoteModalOpen, setIsQuoteModalOpen,
    isAdminPanelOpen, setIsAdminPanelOpen,
    isMobileDrawerOpen, setIsMobileDrawerOpen,
    mobileTab, setMobileTab,
    quoteStep, setQuoteStep,
    activeGroup, setActiveGroup,
    viewMode, setViewMode,
    searchTerm, setSearchTerm,
    anyModalOpen,
  } = useUIContext();

  // ── Tour de Onboarding ────────────────────────────────────────────────────
  const { isActive: isTourActive, currentStep: tourStep, currentStepIndex, totalSteps, next: tourNext, prev: tourPrev, skip: tourSkip } = useTour(!!user);

  // ── Hooks de funcionalidade ────────────────────────────────────────────────
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { addToast }                          = useToast();
  const { confirmDialog, showConfirm, dismissConfirm } = useConfirm();
  const { generatePdf }                       = usePdf({ onSuccess: addToast, onError: addToast, setGenerating: setIsGeneratingPdf });

  const {
    data, loading, isRefreshing, hasMore, loadMore,
    filters, setFilters, availableBrands,
    fetchCatalogo, syncGLPI
  } = useCatalog({
    pausePolling: anyModalOpen || !!confirmDialog,
    isAuthenticated: !!user,
    onError: (msg) => addToast(msg, 'error'),
  });

  const {
    activeQuote, setActiveQuoteId, cart,
    updateQuote, addNewQuote, removeQuote, toggleCartItem,
  } = useQuotes();

  const debouncedSearch = useDebounce(searchTerm, 300);

  // ── Effects ───────────────────────────────────────────────────────────────
  // Reset stepper ao abrir modal de proposta
  useEffect(() => { if (isQuoteModalOpen) setQuoteStep(1); }, [isQuoteModalOpen, setQuoteStep]);

  // Aplica classe dark no document
  useEffect(() => { document.documentElement.classList.toggle('dark', isDarkMode); }, [isDarkMode]);

  // Sincroniza o search debounce com os filtros da API
  useEffect(() => {
    setFilters(prev => {
      if (prev.search === debouncedSearch) return prev;
      return { ...prev, search: debouncedSearch };
    });
  }, [debouncedSearch, setFilters]);

  // Sincroniza reset do catálogo de volta pro input
  useEffect(() => {
    if (filters.search === '' && searchTerm !== '') {
      setSearchTerm('');
    }
  }, [filters.search, setSearchTerm]);

  // Escuta eventos WebSocket para recarregar silenciosamente o catálogo
  useEffect(() => {
    if (wsMessage === 'RESERVED' || wsMessage === 'CANCELED') {
      fetchCatalogo(true, true);
    }
  }, [wsMessage, fetchCatalogo]);

  // Exibe toast quando sessão expira por 401 (evento emitido pelo AppContext)
  useEffect(() => {
    const handleShowToast = () => {
      addToast('Sua sessão expirou. Por favor, faça login novamente.', 'error');
    };
    window.addEventListener('auth:show-toast', handleShowToast);
    return () => window.removeEventListener('auth:show-toast', handleShowToast);
  }, [addToast]);

  // ── Memos ─────────────────────────────────────────────────────────────────
  const unavailableIds = useMemo(() => {
    if (!data?.groups) return new Set<string>();
    const estoqueIds = new Set(data.groups.flatMap(g => g.items).map(e => e.idPatrimonio));
    const ids = new Set<string>();
    quotes.forEach(q => q.items.forEach(item => { if (!estoqueIds.has(item.idPatrimonio)) ids.add(item.idPatrimonio); }));
    return ids;
  }, [data, quotes]);

  const reservedProposals = useMemo(() => quotes
    .filter(q => q.isReserved)
    .map(q => {
      const days = q.validityDays ?? 2;
      const expiresAt = q.reservedAt ? new Date(new Date(q.reservedAt).getTime() + days * 86400000) : null;
      const now = new Date();
      const isExpired = expiresAt ? expiresAt < now : false;
      const hoursLeft = expiresAt ? differenceInHours(expiresAt, now) : null;
      const isExpiringSoon = hoursLeft !== null && hoursLeft <= 12 && !isExpired;
      return { quote: q, expiresAt, isExpired, isExpiringSoon };
    }), [quotes]);

  const sortedGroupedEstoque = data?.groups || [];

  // ── Handlers (estáveis com useCallback) ───────────────────────────────────
  const resetCatalog = useCallback(() => {
    setFilters({ search: '', brand: null, statusFilter: null, sortKey: null, sortDir: 'desc' });
    setViewMode('cards');
  }, [setFilters, setViewMode]);

  const requestSort = useCallback((key: string) => {
    setFilters(prev => ({
      ...prev,
      sortKey: key,
      sortDir: prev.sortKey === key && prev.sortDir === 'desc' ? 'asc' : 'desc'
    }));
  }, [setFilters]);

  const handleSelectQuote = useCallback((id: string) => {
    setActiveQuoteId(id);
    setIsQuoteModalOpen(true);
  }, [setActiveQuoteId, setIsQuoteModalOpen]);

  const handleDeleteQuote = useCallback((id: string) =>
    showConfirm('Excluir Proposta', 'Deseja excluir esta proposta?', () => removeQuote(id)),
  [showConfirm, removeQuote]);

  const handleGroupClick = useCallback((group: GroupedItem) => setActiveGroup(group), [setActiveGroup]);

  const { isSubmitting, handleReserve, handleCancelReserve, handleWhatsApp } = useQuoteActions(
    activeQuoteId,
    activeQuote,
    cart,
    updateQuote,
    fetchCatalogo,
    addToast,
    showConfirm
  );

  // ── Early returns ──────────────────────────────────────────────────────────
  if (!user) return <LoginScreen onLogin={setUser} />;
  if (loading && !data) return <SkeletonLoader />;

  const ultimaAtualizacaoStr = data?.metadados?.ultimaAtualizacao || new Date().toISOString();

  return (
    <div className={clsx('h-screen w-full flex bg-slate-50 dark:bg-[#0f172a] overflow-hidden font-sans print:h-auto print:overflow-visible print:block')}>

      <Sidebar
        user={user}
        quotes={quotes}
        activeQuoteId={activeQuoteId}
        reservedProposals={reservedProposals}
        isRefreshing={isRefreshing}
        ultimaAtualizacao={ultimaAtualizacaoStr}
        onSelectQuote={handleSelectQuote}
        onNewQuote={addNewQuote}
        onDeleteQuote={handleDeleteQuote}
        onResetCatalog={resetCatalog}
        onSyncGlpi={() => syncGLPI(
          (msg) => addToast(msg, 'success'),
          (msg) => addToast(msg, 'info'),
        )}
        onLogout={() => setUser(null)}
        onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden print:hidden relative">
        <Header
          isDarkMode={isDarkMode}
          search={searchTerm}
          onSearchChange={setSearchTerm}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-32 md:pb-6 bg-[#f1f5f9] dark:bg-[#0d1117]" id="catalog-scroll-area">
          <StatsBar
            totalItems={data?.metadados?.totalEquipments || 0}
            totalNovos={data?.metadados?.totalNovos || 0}
            totalUsados={data?.metadados?.totalUsados || 0}
            statusFilter={filters.statusFilter}
            onFilterChange={(v) => setFilters(p => ({ ...p, statusFilter: v }))}
          />
          <FilterBar
            brands={availableBrands}
            activeBrand={filters.brand}
            statusFilter={filters.statusFilter}
            onBrandChange={(v) => setFilters(p => ({ ...p, brand: v }))}
            onClearStatusFilter={() => setFilters(p => ({ ...p, statusFilter: null }))}
          />
          <CatalogView
            groupedEstoque={sortedGroupedEstoque}
            sortedGroupedEstoque={sortedGroupedEstoque}
            totalGroups={data?.metadados?.totalGroups || sortedGroupedEstoque.length}
            viewMode={viewMode}
            cart={cart}
            sortConfig={filters.sortKey ? { key: filters.sortKey, direction: filters.sortDir as 'asc'|'desc' } : null}
            hasActiveFilters={!!(filters.search || filters.statusFilter || filters.brand)}
            hasMore={hasMore}
            isLoadingMore={isRefreshing}
            onLoadMore={loadMore}
            onGroupClick={handleGroupClick}
            onViewModeChange={setViewMode}
            onSort={requestSort}
            onResetFilters={resetCatalog}
          />
        </div>
      </main>

      {/* Modais */}
      {activeGroup && (
        <ItemDetailModal
          group={activeGroup}
          cart={cart}
          onClose={() => setActiveGroup(null)}
          onToggleItem={toggleCartItem}
          onUpdateItems={items => updateQuote(activeQuoteId, { items })}
        />
      )}

      {isQuoteModalOpen && activeQuote && (
        <QuoteDrawer
          quote={activeQuote}
          cart={cart}
          quoteStep={quoteStep}
          isSubmitting={isSubmitting}
          isGeneratingPdf={isGeneratingPdf}
          unavailableIds={unavailableIds}
          onClose={() => setIsQuoteModalOpen(false)}
          onStepChange={setQuoteStep}
          onUpdateQuote={patch => updateQuote(activeQuoteId, patch)}
          onRemoveItem={toggleCartItem}
          onDelete={() => showConfirm('Excluir Proposta', 'Esta ação não pode ser desfeita.', () => { removeQuote(activeQuoteId!); setIsQuoteModalOpen(false); })}
          onReserve={handleReserve}
          onCancelReserve={handleCancelReserve}
          onPrint={() => generatePdf(activeQuote, cart, logoOficial, watermarkOficial)}
          onWhatsApp={handleWhatsApp}
        />
      )}

      {isAdminPanelOpen && user && (
        <AdminPanel onClose={() => setIsAdminPanelOpen(false)} currentUser={user} />
      )}

      {/* Overlays / Notificações */}
      {isGeneratingPdf && <PdfLoadingOverlay />}

      <Toaster richColors position="top-right" theme={isDarkMode ? 'dark' : 'light'} />

      {confirmDialog && (
        <ConfirmDialog
          dialog={confirmDialog}
          onCancel={dismissConfirm}
          onConfirm={() => { confirmDialog.onConfirm(); dismissConfirm(); }}
        />
      )}

      {/* Mobile Navigation */}
      {!isQuoteModalOpen && !confirmDialog && (
        <MobileNav
          mobileTab={mobileTab}
          cartCount={cart.length}
          reservedProposals={reservedProposals}
          quotes={quotes}
          activeQuoteId={activeQuoteId}
          isMobileDrawerOpen={isMobileDrawerOpen}
          activeQuote={activeQuote}
          onTabChange={setMobileTab}
          onToggleDrawer={() => setIsMobileDrawerOpen(p => !p)}
          onCloseDrawer={() => setIsMobileDrawerOpen(false)}
          onSelectQuote={handleSelectQuote}
          onOpenQuote={() => setIsQuoteModalOpen(true)}
          onNewQuote={addNewQuote}
          onResetCatalog={resetCatalog}
        />
      )}

      {/* Onboarding Tour — só aparece na primeira visita */}
      {isTourActive && tourStep && (
        <OnboardingTour
          isActive={isTourActive}
          currentStep={tourStep}
          currentStepIndex={currentStepIndex}
          totalSteps={totalSteps}
          onNext={tourNext}
          onPrev={tourPrev}
          onSkip={tourSkip}
        />
      )}
    </div>
  );
}
