import { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { differenceInHours } from 'date-fns';
import Fuse from 'fuse.js';
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
import { ToastContainer }   from './components/common/ToastContainer';
import { ConfirmDialog }    from './components/common/ConfirmDialog';
import { PdfLoadingOverlay } from './components/common/PdfLoadingOverlay';

export default function App() {
  // ── Global state ──────────────────────────────────────────────────────────
  const { salesperson, setSalesperson, isDarkMode, setIsDarkMode } = useAppContext();

  // ── Local UI state ────────────────────────────────────────────────────────
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState<string | null>(null);
  const [activeBrand, setActiveBrand]     = useState<string | null>(null);
  const [viewMode, setViewMode]           = useState<'cards' | 'list'>('cards');
  const [sortConfig, setSortConfig]       = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [activeGroup, setActiveGroup]     = useState<GroupedItem | null>(null);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [mobileTab, setMobileTab]         = useState<'catalogo' | 'propostas' | 'reservas'>('catalogo');
  const [quoteStep, setQuoteStep]         = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const deferredSearch = useDeferredValue(search);

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const { toasts, addToast, dismissToast }     = useToast();
  const { confirmDialog, showConfirm, dismissConfirm } = useConfirm();
  const { generatePdf }                        = usePdf({ onSuccess: addToast, onError: addToast, setGenerating: setIsGeneratingPdf });

  const anyModalOpen = isQuoteModalOpen || !!confirmDialog || isMobileDrawerOpen;

  const { data, loading, isRefreshing, fetchCatalogo, syncGLPI } = useCatalog({
    pausePolling: anyModalOpen,
    onError: (msg) => addToast(msg, 'error'),
  });

  const {
    quotes, activeQuote, activeQuoteId, setActiveQuoteId, cart,
    updateQuote, addNewQuote, removeQuote, toggleCartItem,
  } = useQuotes();

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => { if (isQuoteModalOpen) setQuoteStep(1); }, [isQuoteModalOpen]);
  useEffect(() => { document.documentElement.classList.toggle('dark', isDarkMode); }, [isDarkMode]);

  // ── Memoized search & filter ───────────────────────────────────────────────
  const fuseInstance = useMemo(() => {
    if (!data?.estoque) return null;
    return new Fuse(data.estoque, {
      keys: ['modelo', 'marca', 'tipo', 'numeroSerie', 'idPatrimonio',
             'especificacoes.processador', 'especificacoes.ram',
             'especificacoes.armazenamento', 'especificacoes.so'],
      threshold: 0.4, ignoreLocation: true,
    });
  }, [data]);

  const searchedEstoque = useMemo(() => {
    if (!data?.estoque) return [];
    if (!deferredSearch.trim()) return data.estoque;
    const tokens = deferredSearch.trim().split(/\s+/).filter(Boolean);
    const exact = data.estoque.filter(item => {
      const s = [item.modelo, item.marca, item.tipo, item.numeroSerie,
                 item.idPatrimonio, item.especificacoes?.processador,
                 item.especificacoes?.ram, item.especificacoes?.armazenamento,
                 item.especificacoes?.so].filter(Boolean).join(' ').toUpperCase();
      return tokens.every(t => s.includes(t.toUpperCase()));
    });
    return exact.length > 0 ? exact : fuseInstance?.search(deferredSearch).map(r => r.item) ?? [];
  }, [data, deferredSearch, fuseInstance]);

  const filteredEstoque = useMemo(() => {
    let res = searchedEstoque;
    if (statusFilter) res = res.filter(i => statusFilter === 'NOVO' ? i.status?.toUpperCase().includes('NOVO') : !i.status?.toUpperCase().includes('NOVO'));
    if (activeBrand)  res = res.filter(i => i.marca === activeBrand);
    return res;
  }, [searchedEstoque, statusFilter, activeBrand]);

  const availableBrands = useMemo(() => {
    let res = searchedEstoque;
    if (statusFilter) res = res.filter(i => statusFilter === 'NOVO' ? i.status?.toUpperCase().includes('NOVO') : !i.status?.toUpperCase().includes('NOVO'));
    return Array.from(new Set(res.map(i => i.marca))).sort();
  }, [searchedEstoque, statusFilter]);

  const unavailableIds = useMemo(() => {
    if (!data?.estoque) return new Set<string>();
    const estoqueIds = new Set(data.estoque.map(e => e.idPatrimonio));
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

  const groupedEstoque = useMemo(() => {
    const groups: Record<string, GroupedItem> = {};
    filteredEstoque.forEach(item => {
      const key = [item.modelo, item.especificacoes?.processador || 'N/A', item.especificacoes?.ram || 'N/A',
                   item.especificacoes?.armazenamento || 'N/A', item.especificacoes?.so || 'N/A'].join('|');
      if (!groups[key]) groups[key] = { key, modelo: item.modelo, marca: item.marca, tipo: item.tipo,
        processador: item.especificacoes?.processador || 'N/A', ram: item.especificacoes?.ram || 'N/A',
        armazenamento: item.especificacoes?.armazenamento || 'N/A', so: item.especificacoes?.so || 'N/A',
        novos: 0, usados: 0, items: [] };
      groups[key].items.push(item);
      if (item.status?.toUpperCase().includes('NOVO')) groups[key].novos++; else groups[key].usados++;
    });
    const values = Object.values(groups);
    values.sort((a, b) => {
      const aInCart = cart.some(c => a.items.some(i => i.idPatrimonio === c.idPatrimonio)) ? 1 : 0;
      const bInCart = cart.some(c => b.items.some(i => i.idPatrimonio === c.idPatrimonio)) ? 1 : 0;
      return bInCart - aInCart || b.items.length - a.items.length;
    });
    return values;
  }, [filteredEstoque, cart]);

  const sortedGroupedEstoque = useMemo(() => {
    if (!sortConfig) return groupedEstoque;
    return [...groupedEstoque].sort((a, b) => {
      let av: any, bv: any;
      if (sortConfig.key === 'qtd')    { av = a.items.length; bv = b.items.length; }
      else if (sortConfig.key === 'cotados') { av = cart.filter(c => a.items.some(i => i.idPatrimonio === c.idPatrimonio)).length; bv = cart.filter(c => b.items.some(i => i.idPatrimonio === c.idPatrimonio)).length; }
      else { av = a[sortConfig.key as keyof GroupedItem]; bv = b[sortConfig.key as keyof GroupedItem]; }
      if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
      if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [groupedEstoque, sortConfig, cart]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const resetCatalog = () => { setSearch(''); setStatusFilter(null); setActiveBrand(null); setSortConfig(null); setViewMode('cards'); };
  const requestSort  = (key: string) => setSortConfig(prev => ({ key, direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));

  const handleSelectQuote = (id: string) => { setActiveQuoteId(id); setIsQuoteModalOpen(true); };

  const handleDeleteQuote = (id: string) => showConfirm('Excluir Proposta', `Deseja excluir esta proposta?`, () => removeQuote(id));

  const handleReserve = async () => {
    if (cart.length === 0 || !activeQuoteId || !activeQuote) return;
    if (!navigator.onLine) { addToast('Você está offline.', 'error'); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch('/webhook/reservar_ativos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propostaId: activeQuote.id, nomeProposta: activeQuote.name,
          cliente: activeQuote.clientName || 'Não informado',
          validadeDias: activeQuote.validityDays || 2, vendedor: salesperson,
          itens: cart.map(i => ({ idPatrimonio: i.idPatrimonio, numeroSerie: i.numeroSerie, modelo: i.modelo, statusOriginal: i.status, idGlpi: i.idGlpi })),
        }),
      });
      if (!res.ok) throw new Error(res.status === 409 ? 'Alguns itens não estão mais disponíveis.' : 'Erro ao comunicar com o sistema.');
      updateQuote(activeQuoteId, { isReserved: true, reservedAt: new Date().toISOString() });
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
        const res = await fetch('/webhook/cancelar_reserva', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ propostaId: activeQuote.id, vendedor: salesperson,
            itens: cart.map(i => ({ idPatrimonio: i.idPatrimonio, idGlpi: i.idGlpi, statusOriginal: i.status })) }),
        });
        if (!res.ok) throw new Error('Erro ao cancelar reserva.');
        updateQuote(activeQuoteId, { isReserved: false });
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
    text += '\n_Gerado via Micro Estoque_';
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // ── Early returns ──────────────────────────────────────────────────────────
  if (!salesperson) return <LoginScreen onLogin={setSalesperson} />;
  if (loading)      return <SkeletonLoader />;

  const ultimaAtualizacaoStr = data?.metadados?.ultimaAtualizacao || new Date().toISOString();

  return (
    <div className={clsx('h-screen w-full flex bg-slate-50 dark:bg-[#0f172a] overflow-hidden font-sans print:h-auto print:overflow-visible print:block')}>

      <Sidebar
        salesperson={salesperson}
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
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden print:hidden relative">
        <Header
          isDarkMode={isDarkMode}
          search={search}
          onSearchChange={setSearch}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 bg-[#f1f5f9] dark:bg-[#0d1117]">
          <StatsBar
            estoque={searchedEstoque}
            statusFilter={statusFilter}
            onFilterChange={setStatusFilter}
          />
          <FilterBar
            brands={availableBrands}
            activeBrand={activeBrand}
            statusFilter={statusFilter}
            onBrandChange={setActiveBrand}
            onClearStatusFilter={() => setStatusFilter(null)}
          />
          <CatalogView
            groupedEstoque={groupedEstoque}
            sortedGroupedEstoque={sortedGroupedEstoque}
            viewMode={viewMode}
            cart={cart}
            sortConfig={sortConfig}
            hasActiveFilters={!!(search || statusFilter || activeBrand)}
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

      {/* Overlays / Notificações */}
      {isGeneratingPdf && <PdfLoadingOverlay />}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

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
