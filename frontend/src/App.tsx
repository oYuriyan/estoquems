import { useState, useEffect, useMemo } from 'react';
import { differenceInHours } from 'date-fns';
import clsx from 'clsx';

// Assets
import logoOficial from './assets/logo_oficial.png';
import watermarkOficial from './assets/watermark_oficial.png';

// Context
import { useAppContext } from './contexts/AppContext';

// Hooks
import { useCatalog }  from './hooks/useCatalog';
import { useQuotes }   from './hooks/useQuotes';
import { useToast }    from './hooks/useToast';
import { useConfirm }  from './hooks/useConfirm';
import { usePdf }      from './hooks/usePdf';

// Types
import type { GroupedItem, Equipamento } from './types';

// API
import { apiFetch } from './utils/api';

// Layout
import { LoginScreen }    from './components/layout/LoginScreen';
import { SkeletonLoader } from './components/layout/SkeletonLoader';
import { Sidebar }        from './components/layout/Sidebar';
import { Header }         from './components/layout/Header';
import { MobileNav }      from './components/layout/MobileNav';

// Catalog
import { StatsBar }         from './components/catalog/StatsBar';
import { FilterBar }        from './components/catalog/FilterBar';
import { CatalogView }      from './components/catalog/CatalogView';
import { ItemDetailModal }  from './components/catalog/ItemDetailModal';

// Quotes
import { QuoteDrawer } from './components/quotes/QuoteDrawer';

// Common
import { Toaster } from 'sonner';
import { ConfirmDialog }     from './components/common/ConfirmDialog';
import { PdfLoadingOverlay } from './components/common/PdfLoadingOverlay';
import { AdminPanel }        from './components/layout/AdminPanel';

export default function App() {
  // ── Global state ──────────────────────────────────────────────────────────
  const {
    quotes, activeQuoteId, user, setUser, isDarkMode, setIsDarkMode, wsMessage
  } = useAppContext();

  // ── Local UI state ────────────────────────────────────────────────────────
  const [viewMode, setViewMode]           = useState<'cards' | 'list'>('cards');
  const [activeGroup, setActiveGroup]     = useState<GroupedItem | null>(null);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [mobileTab, setMobileTab]         = useState<'catalogo' | 'propostas' | 'reservas'>('catalogo');
  const [quoteStep, setQuoteStep]         = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const { addToast }     = useToast();
  const { confirmDialog, showConfirm, dismissConfirm } = useConfirm();
  const { generatePdf }                        = usePdf({ onSuccess: addToast, onError: addToast, setGenerating: setIsGeneratingPdf });

  const anyModalOpen = isQuoteModalOpen || !!confirmDialog || isMobileDrawerOpen;

  const { 
    data, loading, isRefreshing, hasMore, loadMore,
    filters, setFilters, availableBrands,
    fetchCatalogo, syncGLPI 
  } = useCatalog({
    pausePolling: anyModalOpen,
    onError: (msg) => addToast(msg, 'error'),
  });

  const {
    activeQuote, setActiveQuoteId, cart,
    updateQuote, addNewQuote, removeQuote, toggleCartItem,
  } = useQuotes();

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => { if (isQuoteModalOpen) setQuoteStep(1); }, [isQuoteModalOpen]);
  useEffect(() => { document.documentElement.classList.toggle('dark', isDarkMode); }, [isDarkMode]);
  
  // Escuta eventos WebSocket para recarregar silenciosamente o catálogo
  useEffect(() => {
    if (wsMessage === 'RESERVED' || wsMessage === 'CANCELED') {
      fetchCatalogo(true, true); // true = silencioso, true = resetPage (recarrega tudo)
    }
  }, [wsMessage, fetchCatalogo]);

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

  // ── Handlers ──────────────────────────────────────────────────────────────
  const resetCatalog = () => { 
    setFilters({ search: '', brand: null, statusFilter: null, sortKey: null, sortDir: 'desc' });
    setViewMode('cards'); 
  };
  const requestSort  = (key: string) => {
    setFilters(prev => ({
      ...prev,
      sortKey: key,
      sortDir: prev.sortKey === key && prev.sortDir === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleSelectQuote = (id: string) => { setActiveQuoteId(id); setIsQuoteModalOpen(true); };

  const handleDeleteQuote = (id: string) => showConfirm('Excluir Proposta', `Deseja excluir esta proposta?`, () => removeQuote(id));

  const handleReserve = async () => {
    if (cart.length === 0 || !activeQuoteId || !activeQuote) return;
    if (!navigator.onLine) { addToast('Você está offline.', 'error'); return; }
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/quotes/', {
        method: 'POST',
        body: JSON.stringify({
          name: activeQuote.name, 
          client_name: activeQuote.clientName || 'Não informado',
          validity_days: activeQuote.validityDays || 2, 
          margin: activeQuote.margin || '',
          equipment_ids: cart.map(i => (i as any).id || i.idPatrimonio) // fallback se id missing no mock
        }),
      });
      if (!res.ok) throw new Error(res.status === 409 ? 'Alguns itens não estão mais disponíveis.' : 'Erro ao comunicar com o sistema.');
      
      const createdQuote = await res.json();
      
      updateQuote(activeQuoteId, { isReserved: true, reservedAt: new Date().toISOString(), backendId: createdQuote.id });
      addToast('Reserva realizada com sucesso!', 'success');
      setTimeout(() => fetchCatalogo(true), 1500);
    } catch (err: any) {
      addToast(err.message || 'Erro desconhecido ao reservar.', 'error');
    } finally { setIsSubmitting(false); }
  };

  const handleCancelReserve = () => {
    if (!activeQuoteId || !activeQuote) return;
    showConfirm('Cancelar Reserva', 'Os itens voltarão para o estoque e o GLPI será atualizado.', async () => {
      setIsSubmitting(true);
      try {
        const backendId = (activeQuote as any).backendId || activeQuoteId; // Usa o ID retornado do backend
        const res = await apiFetch(`/api/quotes/${backendId}/cancel`, {
          method: 'POST'
        });
        if (!res.ok) throw new Error('Erro ao cancelar reserva.');
        updateQuote(activeQuoteId, { isReserved: false, backendId: undefined });
        addToast('Reserva cancelada com sucesso.', 'success');
        setTimeout(() => fetchCatalogo(true), 1500);
      } catch (err: any) {
        addToast(err.message || 'Erro desconhecido ao cancelar.', 'error');
      } finally { setIsSubmitting(false); }
    });
  };

  const handleWhatsApp = () => {
    if (!activeQuote) return;
    const { clientName, margin, validityDays } = activeQuote;
    const groups: Record<string, { tipo: string; marca: string; modelo: string; processador: string; ram: string; armazenamento: string; so: string; items: Equipamento[] }> = {};
    cart.forEach(item => {
      const proc = item.especificacoes?.processador || 'N/A'; const ram = item.especificacoes?.ram || 'N/A';
      const arm  = item.especificacoes?.armazenamento || 'N/A'; const so = item.especificacoes?.so || 'N/A';
      const key  = [item.tipo, item.marca, item.modelo, proc, ram, arm, so].join('|').toUpperCase();
      if (!groups[key]) groups[key] = { tipo: item.tipo, marca: item.marca, modelo: item.modelo, processador: proc, ram, armazenamento: arm, so, items: [] };
      groups[key].items.push(item);
    });
    let text = `*Proposta de Equipamentos*\nCliente: ${clientName || '_____'}\nCondição: ${margin || '_____'}\nValidade: ${validityDays ? `${validityDays} dias` : '_____'}\n\n`;
    Object.values(groups).forEach((g, idx, arr) => {
      const qty = g.items.length;
      text += `*${qty} ${qty > 1 ? 'Unidades' : 'Unidade'} - ${g.tipo} ${g.marca} ${g.modelo}*\n`;
      text += `Processador: ${g.processador}\nMemória RAM: ${g.ram}\nArmazenamento: ${g.armazenamento}\nSistema Operacional: ${g.so}\n\n`;
      g.items.forEach(i => { text += `Número de Série: ${i.numeroSerie} | ID: ${i.idPatrimonio}\n`; });
      if (idx < arr.length - 1) text += '\n';
    });
    text += '\n_Gerado via Micro Sistema_';
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // ── Early returns ──────────────────────────────────────────────────────────  // 🚀 Early returns 🚀
  if (!user) return <LoginScreen onLogin={setUser} />;
  if (loading)      return <SkeletonLoader />;

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
          search={filters.search}
          onSearchChange={(v) => setFilters(p => ({ ...p, search: v }))}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-32 md:pb-6 bg-[#f1f5f9] dark:bg-[#0d1117]" id="catalog-scroll-area">
          <StatsBar
            estoque={data?.groups.flatMap(g => g.items) || []}
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
            onGroupClick={setActiveGroup}
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
    </div>
  );
}
