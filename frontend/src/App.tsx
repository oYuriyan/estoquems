import { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { Search, CheckCircle, AlertTriangle, Server, MemoryStick, HardDrive, Trash2, FileText, Send, X, LayoutDashboard, Monitor, ShoppingCart, Plus, Package, LayoutGrid, List, AlertCircle, Cpu, Info, Sun, Moon, Loader2, Home, BookMarked } from 'lucide-react';
import { differenceInHours, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import clsx from 'clsx';
import Fuse from 'fuse.js';

import logoOficial from './assets/logo_oficial.png';
import watermarkOficial from './assets/watermark_oficial.png';
import { generatePdfBlob } from './utils/generatePdf';
import { useAppContext } from './contexts/AppContext';
import type { Equipamento, Catalogo, GroupedItem, Quote, Toast, ConfirmDialog } from './types';

// Tipos centralizados em src/types/index.ts — não redefinir aqui


export default function App() {
  const [data, setData] = useState<Catalogo | null>(null);
  const [search, setSearch] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  // Global State (via Context API)
  const { quotes, setQuotes, activeQuoteId, setActiveQuoteId, salesperson, setSalesperson, isDarkMode, setIsDarkMode } = useAppContext();
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // QW-6: FAB mobile — controla o drawer de propostas no celular
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  // Bottom nav tab ativa no mobile
  const [mobileTab, setMobileTab] = useState<'catalogo' | 'propostas' | 'reservas'>('catalogo');
  const [quoteStep, setQuoteStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (isQuoteModalOpen) {
      setQuoteStep(1);
    }
  }, [isQuoteModalOpen]);

  // Toast & Confirm
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);

  // Modals
  const [activeGroup, setActiveGroup] = useState<GroupedItem | null>(null);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 350);
    }, 3500);
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ title, message, onConfirm });
  }, []);

  const activeQuote = quotes.find(q => q.id === activeQuoteId) || quotes[0] || null;
  const cart = activeQuote ? activeQuote.items : [];

  const updateQuote = (id: string | null, patch: Partial<Quote>) => {
    if (!id) return;
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
  };

  const addNewQuote = () => {
    const id = Date.now().toString();
    const name = `Proposta ${quotes.length + 1}`;
    setQuotes(prev => [...prev, { id, name, items: [], clientName: '', margin: '', validityDays: 2 }]);
    setActiveQuoteId(id);
  };

  const removeQuote = (id: string) => {
    const remaining = quotes.filter(q => q.id !== id);
    setQuotes(remaining);
    if (id === activeQuoteId) {
      setActiveQuoteId(remaining.length > 0 ? remaining[0].id : null);
    }
    setIsQuoteModalOpen(false);
  };

  const fetchCatalogo = useCallback(async (silent = true) => {
    if (!silent) setIsRefreshing(true);
    try {
      const response = await fetch(`/catalogo.json?t=${new Date().getTime()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Falha ao carregar o catálogo.');
      const json = await response.json();
      const parsedData = Array.isArray(json) ? json[0] : json;
      setData(parsedData);
    } catch (err: any) {
      console.error(err.message || 'Erro desconhecido ao carregar dados.');
      if (!silent) addToast('Erro ao atualizar o catálogo.', 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [addToast]);

  // Sync GLPI com feedback progressivo — polling até o catálogo mudar (máx 30s)
  const syncGLPI = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    addToast('Sincronização acionada. Aguardando n8n processar...', 'info');
    try {
      await fetch('/webhook/atualizar_estoque', { method: 'GET', mode: 'no-cors' });
    } catch { /* no-cors não lança erro mesmo com falha */ }

    // Polling: tenta 6x em intervalos de 5s (30s total)
    const snaphotTimestamp = data?.metadados?.ultimaAtualizacao ?? '';
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/catalogo.json?t=${Date.now()}`, { cache: 'no-store' });
        const json = await res.json();
        const parsed = Array.isArray(json) ? json[0] : json;
        if (parsed?.metadados?.ultimaAtualizacao !== snaphotTimestamp) {
          clearInterval(poll);
          setData(parsed);
          setIsRefreshing(false);
          addToast('Catálogo atualizado com sucesso!', 'success');
          return;
        }
      } catch { /* ignora erros de polling */ }
      if (attempts >= 6) {
        clearInterval(poll);
        setIsRefreshing(false);
        addToast('Sincronização acionada, mas o catálogo ainda não foi atualizado. Tente novamente em instantes.', 'info');
      }
    }, 5000);
  };

  // Auto-refresh pausado quando qualquer modal está aberto (evita re-render durante interação)
  const anyModalOpen = isQuoteModalOpen || !!confirmDialog || isMobileDrawerOpen;

  useEffect(() => {
    fetchCatalogo(true);
    if (anyModalOpen) return; // não agenda interval se modal aberto
    const interval = setInterval(() => fetchCatalogo(true), 60000);
    return () => clearInterval(interval);
  }, [fetchCatalogo, anyModalOpen]);



  // QW-5: Fuse memoizado — o índice é construído UMA VEZ quando o data muda,
  // não a cada keystroke. Melhora performance em catálogos grandes.
  const fuseInstance = useMemo(() => {
    if (!data?.estoque) return null;
    return new Fuse(data.estoque, {
      keys: [
        'modelo', 'marca', 'tipo', 'numeroSerie', 'idPatrimonio',
        'especificacoes.processador', 'especificacoes.ram',
        'especificacoes.armazenamento', 'especificacoes.so'
      ],
      threshold: 0.4,
      ignoreLocation: true
    });
  }, [data]);

  const searchedEstoque = useMemo(() => {
    if (!data?.estoque) return [];
    if (!deferredSearch.trim()) return data.estoque;

    const tokens = deferredSearch.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return data.estoque;

    // Busca por tokens: TODOS os termos devem aparecer em algum campo
    const tokenResults = data.estoque.filter(item => {
      const searchStr = [
        item.modelo, item.marca, item.tipo, item.numeroSerie,
        item.idPatrimonio, item.especificacoes?.processador,
        item.especificacoes?.ram, item.especificacoes?.armazenamento,
        item.especificacoes?.so
      ].filter(Boolean).join(' ').toUpperCase();
      return tokens.every(t => searchStr.includes(t.toUpperCase()));
    });

    if (tokenResults.length > 0) return tokenResults;

    // Fallback fuzzy reutilizando o índice pré-construído
    return fuseInstance ? fuseInstance.search(deferredSearch).map(r => r.item) : [];
  }, [data, deferredSearch, fuseInstance]);

  const filteredEstoque = useMemo(() => {
    let res = searchedEstoque;
    if (statusFilter) {
      res = res.filter(item => {
        const s = item.status?.toUpperCase() || '';
        if (statusFilter === 'NOVO') return s.includes('NOVO');
        if (statusFilter === 'USADO') return s.includes('USADO');
        return true;
      });
    }
    if (activeBrand) {
      res = res.filter(item => item.marca === activeBrand);
    }
    return res;
  }, [searchedEstoque, statusFilter, activeBrand]);

  const availableBrands = useMemo(() => {
    let res = searchedEstoque;
    if (statusFilter) {
      res = res.filter(item => {
        const s = item.status?.toUpperCase() || '';
        if (statusFilter === 'NOVO') return s.includes('NOVO');
        if (statusFilter === 'USADO') return s.includes('USADO');
        return true;
      });
    }
    return Array.from(new Set(res.map(i => i.marca))).sort();
  }, [searchedEstoque, statusFilter]);

  // Detectar itens cotados que não estão mais disponíveis no estoque
  const unavailableIds = useMemo(() => {
    if (!data?.estoque) return new Set<string>();
    const estoqueIds = new Set(data.estoque.map(e => e.idPatrimonio));
    const ids = new Set<string>();
    quotes.forEach(q => {
      q.items.forEach(item => {
        if (!estoqueIds.has(item.idPatrimonio)) {
          ids.add(item.idPatrimonio);
        }
      });
    });
    return ids;
  }, [data, quotes]);

  // Thermal panel: show reserved proposals with calculated expiration (reservedAt + validityDays)
  const reservedProposals = useMemo(() => {
    return quotes
      .filter(q => q.isReserved)
      .map(q => {
        const days = q.validityDays ?? 2;
        const expiresAt = q.reservedAt
          ? new Date(new Date(q.reservedAt).getTime() + days * 24 * 60 * 60 * 1000)
          : null;
        const now = new Date();
        const isExpired = expiresAt ? expiresAt < now : false;
        const hoursLeft = expiresAt ? differenceInHours(expiresAt, now) : null;
        const isExpiringSoon = hoursLeft !== null && hoursLeft <= 12 && !isExpired;
        return { quote: q, expiresAt, isExpired, isExpiringSoon, hoursLeft };
      });
  }, [quotes]);

  const groupedEstoque = useMemo(() => {
    const groups = filteredEstoque.reduce((acc: Record<string, GroupedItem>, item) => {
      // Agrupar pela especificação EXATA para evitar confusão de dados
      const key = [
        item.modelo,
        item.especificacoes?.processador || 'N/A',
        item.especificacoes?.ram || 'N/A',
        item.especificacoes?.armazenamento || 'N/A',
        item.especificacoes?.so || 'N/A'
      ].join('|');
      if (!acc[key]) {
        acc[key] = {
          key,
          modelo: item.modelo,
          marca: item.marca,
          tipo: item.tipo,
          processador: item.especificacoes?.processador || 'N/A',
          ram: item.especificacoes?.ram || 'N/A',
          armazenamento: item.especificacoes?.armazenamento || 'N/A',
          so: item.especificacoes?.so || 'N/A',
          novos: 0,
          usados: 0,
          items: []
        };
      }
      acc[key].items.push(item);
      if (item.status?.toUpperCase().includes('NOVO')) acc[key].novos++;
      else acc[key].usados++;
      return acc;
    }, {});

    const values = Object.values(groups);
    // Sort: items in active proposal first, then by quantity
    values.sort((a, b) => {
      const aInCart = cart.some(c => a.items.some(i => i.idPatrimonio === c.idPatrimonio)) ? 1 : 0;
      const bInCart = cart.some(c => b.items.some(i => i.idPatrimonio === c.idPatrimonio)) ? 1 : 0;
      if (aInCart !== bInCart) return bInCart - aInCart;
      return b.items.length - a.items.length;
    });
    return values;
  }, [filteredEstoque, cart]);

  const sortedGroupedEstoque = useMemo(() => {
    let sortableItems = [...groupedEstoque];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'qtd') {
          aValue = a.items.length;
          bValue = b.items.length;
        } else if (sortConfig.key === 'cotados') {
          aValue = cart.filter(c => a.items.some(i => i.idPatrimonio === c.idPatrimonio)).length;
          bValue = cart.filter(c => b.items.some(i => i.idPatrimonio === c.idPatrimonio)).length;
        } else {
          aValue = a[sortConfig.key as keyof GroupedItem];
          bValue = b[sortConfig.key as keyof GroupedItem];
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [groupedEstoque, sortConfig, cart]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const toggleCartItem = (item: Equipamento) => {
    let currentActiveId = activeQuoteId;
    if (quotes.length === 0 || !activeQuote) {
      const id = Date.now().toString();
      const newQuote: Quote = { id, name: 'Proposta 1', items: [item], clientName: '', margin: '', validityDays: 2 };
      setQuotes([newQuote]);
      setActiveQuoteId(id);
      return;
    }

    const exists = cart.some(c => c.idPatrimonio === item.idPatrimonio);
    const newItems = exists
      ? cart.filter(c => c.idPatrimonio !== item.idPatrimonio)
      : [...cart, item];
    updateQuote(currentActiveId as string, { items: newItems });
  };

  const deleteProposal = () => {
    if (!activeQuoteId) return;
    showConfirm(
      'Excluir Proposta',
      'Tem certeza que deseja excluir esta proposta e todos os seus dados? Esta ação não pode ser desfeita.',
      () => {
        removeQuote(activeQuoteId);
        setIsQuoteModalOpen(false);
      }
    );
  };

  const generateWhatsAppLink = () => {
    if (!activeQuote) return;
    const { clientName, margin, validityDays } = activeQuote;

    const clientText = clientName ? clientName : '_____';
    const marginText = margin ? margin : '_____';
    const validityText = validityDays ? `${validityDays} dias` : '_____';

    let text = `*Proposta de Equipamentos*\n`;
    text += `Cliente: ${clientText}\n`;
    text += `Condição: ${marginText}\n`;
    text += `Validade: ${validityText}\n\n`;

    // Group items by type, brand, model, and specs
    const groups: Record<string, {
      tipo: string;
      marca: string;
      modelo: string;
      processador: string;
      ram: string;
      armazenamento: string;
      so: string;
      items: Equipamento[];
    }> = {};

    cart.forEach(item => {
      const proc = item.especificacoes?.processador || 'N/A';
      const ram = item.especificacoes?.ram || 'N/A';
      const arm = item.especificacoes?.armazenamento || 'N/A';
      const so = item.especificacoes?.so || 'N/A';

      const key = [
        item.tipo,
        item.marca,
        item.modelo,
        proc,
        ram,
        arm,
        so
      ].join('|').toUpperCase();

      if (!groups[key]) {
        groups[key] = {
          tipo: item.tipo,
          marca: item.marca,
          modelo: item.modelo,
          processador: proc,
          ram: ram,
          armazenamento: arm,
          so: so,
          items: []
        };
      }
      groups[key].items.push(item);
    });

    const groupValues = Object.values(groups);
    let itemsText = '';

    groupValues.forEach((group, index) => {
      const qty = group.items.length;
      const unitText = qty > 1 ? 'Unidades' : 'Unidade';
      const title = `${qty} ${unitText} - ${group.tipo} ${group.marca} ${group.modelo}`.toUpperCase();

      itemsText += `*${title}*\n`;
      itemsText += `Processador: ${group.processador.toUpperCase()}\n`;
      itemsText += `Memória RAM: ${group.ram.toUpperCase()}\n`;
      itemsText += `Armazenamento: ${group.armazenamento.toUpperCase()}\n`;
      itemsText += `Sistema Operacional: ${group.so.toUpperCase()}\n\n`;

      group.items.forEach(item => {
        itemsText += `Número de Série: ${item.numeroSerie} | ID: ${item.idPatrimonio}\n`;
      });

      if (index < groupValues.length - 1) {
        itemsText += `\n`;
      }
    });

    text += itemsText + `\n`;
    text += `_Gerado via Micro Estoque_`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleReserve = async () => {
    if (cart.length === 0 || !activeQuoteId || !activeQuote) return;
    setIsSubmitting(true);
    
    // Check for offline PWA status
    if (!navigator.onLine) {
      addToast("Você está offline. Conecte-se à internet para realizar a reserva.", "error");
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        propostaId: activeQuote.id,
        nomeProposta: activeQuote.name,
        cliente: activeQuote.clientName || 'Não informado',
        validadeDias: activeQuote.validityDays || 2,
        vendedor: salesperson,
        itens: cart.map(i => ({
          idPatrimonio: i.idPatrimonio,
          numeroSerie: i.numeroSerie,
          modelo: i.modelo,
          statusOriginal: i.status,
          idGlpi: i.idGlpi
        }))
      };

      const response = await fetch('/webhook/reservar_ativos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('Falha na reserva. Algumas máquinas não estão mais disponíveis no estoque.');
        } else {
          throw new Error('Erro ao comunicar com o sistema. Verifique a conexão com o n8n.');
        }
      }

      updateQuote(activeQuoteId, { isReserved: true, reservedAt: new Date().toISOString() });

      // Forca um refresh para pegar o novo JSON com os status "RESERVADO" se o n8n ja tiver rodado
      setTimeout(() => fetchCatalogo(true), 1500);
    } catch (err: any) {
      addToast(err.message || 'Erro desconhecido ao reservar.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelReserve = async () => {
    if (!activeQuoteId || !activeQuote) return;
    showConfirm(
      'Cancelar Reserva',
      'Tem certeza que deseja cancelar esta reserva? Os itens voltarão para o estoque e o GLPI será atualizado.',
      async () => {
        setIsSubmitting(true);
        try {
          const response = await fetch('/webhook/cancelar_reserva', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              propostaId: activeQuote.id,
              vendedor: salesperson,
              itens: cart.map(i => ({
                idPatrimonio: i.idPatrimonio,
                idGlpi: i.idGlpi,
                statusOriginal: i.status
              }))
            })
          });
          if (!response.ok) throw new Error('Erro ao comunicar com o n8n para cancelar a reserva.');

          updateQuote(activeQuoteId, { isReserved: false });
          addToast('Reserva cancelada com sucesso.', 'success');
          setTimeout(() => fetchCatalogo(true), 1500);
        } catch (err: any) {
          addToast(err.message || 'Erro desconhecido ao cancelar.', 'error');
        } finally {
          setIsSubmitting(false);
        }
      }
    );
  };


  const handlePrint = async () => {
    if (!activeQuote) return;
    setIsGeneratingPdf(true);

    // No mobile com Share API disponível: gera direto e compartilha (sem abrir aba)
    // No PC ou sem Share API: gera e abre o Blob numa nova aba de forma limpa
    let newTab: Window | null = null;
    const canUseShare = typeof navigator.canShare === 'function';

    if (!canUseShare) {
      // Abre a aba ANTES do await para não ser bloqueada pelo popup blocker
      newTab = window.open('', '_blank');
      if (newTab) {
        newTab.document.write('<html><head><title>Proposta PDF</title></head><body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;"><div style="text-align:center;color:#94a3b8"><div style="font-size:40px;margin-bottom:16px">⏳</div><p style="font-size:18px;font-weight:bold;color:#e2e8f0">Gerando PDF...</p><p style="font-size:14px">Isso leva apenas alguns segundos.</p></div></body></html>');
      }
    }

    try {
      const clientName = activeQuote?.clientName || 'Cliente';
      const quoteName = activeQuote?.name || 'Proposta';
      const safeName = `${clientName}-${quoteName}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `proposta_${safeName}.pdf`;

      const pdfBlob = await generatePdfBlob(activeQuote, cart, logoOficial, watermarkOficial);
      const file = new File([pdfBlob], filename, { type: 'application/pdf' });

      // Mobile com Share API (HTTPS) — compartilha direto
      if (canUseShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `Proposta: ${activeQuote?.name}`, text: 'Segue a proposta em anexo.' });
          addToast('PDF compartilhado com sucesso!', 'success');
          return;
        } catch (shareError: any) {
          if (shareError.name === 'AbortError') return; // usuário cancelou
          // Share falhou — cai no fallback de aba
        }
      }

      // Fallback: injetar o PDF na aba já aberta (ou criar nova)
      const url = URL.createObjectURL(pdfBlob);
      if (newTab) {
        newTab.location.href = url;
      } else {
        const tab = window.open(url, '_blank');
        if (!tab) {
          // Último recurso: download direto
          const link = document.createElement('a');
          link.href = url; link.download = filename;
          document.body.appendChild(link); link.click(); document.body.removeChild(link);
        }
      }
      addToast('PDF gerado com sucesso!', 'success');
    } catch (error) {
      if (newTab) newTab.close();
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Erro ao gerar PDF:', errorMsg);
      addToast(`Erro ao gerar o PDF: ${errorMsg}.`, 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const resetCatalog = () => {
    setSearch('');
    setStatusFilter(null);
    setActiveBrand(null);
    setSortConfig(null);
    setViewMode('cards');
  };

  if (!salesperson) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 font-sans">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
          <img src={logoOficial} alt="Logo" className="h-16 mx-auto mb-6 object-contain" />
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Bem-vindo(a)</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-6 leading-relaxed">Por favor, identifique-se para acessar o catálogo comercial. Seu nome será registrado nas reservas.</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const name = formData.get('name')?.toString().trim();
            if (name) {
              localStorage.setItem('microEstoque_salesperson', name);
              setSalesperson(name);
            }
          }}>
            <input type="text" name="name" placeholder="Ex: Yuri Yan" required className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl mb-4 font-bold text-slate-800 dark:text-slate-100 text-center focus:ring-2 focus:ring-indigo-500 outline-none" />
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm">Acessar Sistema</button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0f172a] p-6 overflow-hidden">
        <div className="h-16 w-full max-w-7xl mx-auto bg-slate-200/50 dark:bg-slate-800/50 rounded-xl mb-8 animate-shimmer"></div>
        <div className="flex flex-1 gap-6 max-w-7xl w-full mx-auto">
          <div className="w-64 hidden md:block rounded-xl animate-shimmer bg-slate-200/50 dark:bg-slate-800/50"></div>
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex gap-4 mb-4">
              <div className="h-24 flex-1 rounded-xl animate-shimmer bg-slate-200/50 dark:bg-slate-800/50"></div>
              <div className="h-24 flex-1 rounded-xl animate-shimmer bg-slate-200/50 dark:bg-slate-800/50"></div>
              <div className="h-24 flex-1 rounded-xl animate-shimmer bg-slate-200/50 dark:bg-slate-800/50"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 rounded-2xl animate-shimmer bg-slate-200/50 dark:bg-slate-800/50"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const ultimaAtualizacaoStr = data?.metadados?.ultimaAtualizacao || new Date().toISOString();
  const ultimaAtualizacao = parseISO(ultimaAtualizacaoStr);
  const statusCritico = differenceInHours(new Date(), ultimaAtualizacao) > 24;

  return (
    <div className="h-screen w-full flex bg-slate-50 dark:bg-[#0f172a] overflow-hidden font-sans print:h-auto print:overflow-visible print:block">

      {/* SIDEBAR (Dark Theme #0B1120) */}
      <aside className="w-64 bg-[#0B1120] text-slate-300 flex-shrink-0 flex-col hidden md:flex print:hidden relative overflow-hidden">
        {/* Subtle glow effect behind logo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/10 blur-[50px] rounded-full pointer-events-none"></div>

        <div className="p-5 pb-2 border-b border-white/5 flex flex-col items-center">
          <img src={logoOficial} alt="Logo" className="h-11 w-auto object-contain mb-3 filter drop-shadow-md" />
          <div className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div> {salesperson}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <div className="px-3 mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 dark:text-slate-500">Menu Principal</div>
          <button onClick={resetCatalog} className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded-lg font-semibold text-sm transition-colors border border-indigo-500/20">
            <LayoutDashboard className="w-4 h-4" />
            Ver Todo o Catalogo
          </button>

          <div className="px-1 mt-6 mb-1 flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Minhas Propostas</span>
            <button onClick={addNewQuote} className="text-slate-500 hover:text-indigo-400 transition-colors p-1 rounded-md hover:bg-indigo-500/10" title="Nova proposta">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {quotes.length === 0 && (
            <div className="px-2 py-4 text-center">
              <p className="text-[11px] text-slate-600 leading-relaxed">Nenhuma proposta ainda.<br />Selecione itens para iniciar.</p>
            </div>
          )}

          {quotes.filter(q => !q.isReserved).map(q => (
            <div key={q.id} className="mb-0.5">
              <button
                onClick={() => { setActiveQuoteId(q.id); setIsQuoteModalOpen(true); }}
                className={clsx(
                  "w-full flex justify-between items-center px-3 py-2 rounded-lg font-medium transition-all text-left group text-sm",
                  q.id === activeQuoteId
                    ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/25"
                    : "hover:bg-white/5 text-slate-400 hover:text-slate-200"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <div className="min-w-0">
                    <span className="truncate text-[13px] font-semibold block">{q.name}</span>
                    {q.clientName && <span className="truncate text-[10px] font-bold text-indigo-400 block mt-0.5">{q.clientName}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-1">
                  {q.isReserved && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                  {q.items.length > 0 && (
                    <span className="bg-indigo-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {q.items.length}
                    </span>
                  )}
                  <span
                    onClick={(e) => { e.stopPropagation(); showConfirm('Excluir Proposta', `Deseja excluir "${q.name}"?`, () => removeQuote(q.id)); }}
                    className="text-slate-700 hover:text-red-400 transition-colors ml-0.5 opacity-0 group-hover:opacity-100 p-0.5 rounded"
                  >
                    <X className="w-3 h-3" />
                  </span>
                </div>
              </button>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-4">
          {/* Thermal Panel */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Reservas Ativas</span>
            {reservedProposals.length === 0 ? (
              <div className="px-3 py-2 rounded-lg bg-white/3 border border-white/5 text-[11px] text-slate-500 text-center italic">Nenhuma reserva ativa</div>
            ) : (
              <div className="space-y-1.5">
                {reservedProposals.map(({ quote: q, expiresAt, isExpired, isExpiringSoon }) => (
                  <button
                    key={q.id}
                    onClick={() => { setActiveQuoteId(q.id); setIsQuoteModalOpen(true); }}
                    className={clsx(
                      "w-full px-2.5 py-2 rounded-md border text-left flex justify-between items-center gap-2 hover:opacity-80 transition-opacity",
                      isExpired ? "bg-red-950/40    border-red-800/50    text-red-300" :
                        isExpiringSoon ? "bg-amber-950/40  border-amber-800/50  text-amber-300" :
                          "bg-emerald-950/40 border-emerald-800/50 text-emerald-300"
                    )}
                  >
                    <div className="min-w-0">
                      <span className="font-bold truncate block text-[11px]">{q.name}</span>
                      <span className="text-[9px] opacity-60 block">
                        {q.clientName || 'Sem cliente'} · {q.items.length} item{q.items.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      {isExpired ? (
                        <span className="text-[9px] font-bold animate-pulse">VENCIDO</span>
                      ) : expiresAt ? (
                        <span className="font-mono text-[9px]">{format(expiresAt, "dd/MM HH:mm")}</span>
                      ) : (
                        <span className="text-[9px] opacity-40">s/ data</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Stock Status */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Status do Estoque</span>
            </div>
            <div
              onDoubleClick={syncGLPI}
              title="Data da última atualização. Dica: Clique duplo para forçar sincronização."
              className={clsx(
                "px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-xs font-bold border mb-2 select-none transition-colors",
                statusCritico
                  ? "bg-amber-950/30 text-amber-400 border-amber-900/40 hover:bg-amber-950/40"
                  : "bg-emerald-950/30 text-emerald-400 border-emerald-900/40 hover:bg-emerald-950/40",
                isRefreshing && "opacity-50 cursor-wait"
              )}
            >
              {statusCritico ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
              <span>{format(ultimaAtualizacao, "dd/MM HH:mm")}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden print:hidden relative">
        {/* Top Header */}
        <header className="bg-white dark:bg-[#161b22] px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 z-10 border-b border-slate-200 dark:border-[#30363d] shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Micro Estoque</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
          </div>

          <div className="relative w-full md:w-auto flex items-center gap-2">
            <div className="relative flex-1 md:w-80 group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Buscar marca, modelo, proc, serie..."
                className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-[#30363d] rounded-lg text-sm bg-white dark:bg-[#0d1117] text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="rounded-lg border border-slate-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all w-9 h-9 flex items-center justify-center shrink-0 relative overflow-hidden"
              title="Alternar Tema"
            >
              <Sun className={clsx("w-4 h-4 absolute transition-all duration-500", isDarkMode ? "rotate-90 opacity-0 scale-50" : "rotate-0 opacity-100 scale-100")} />
              <Moon className={clsx("w-4 h-4 absolute transition-all duration-500", isDarkMode ? "rotate-0 opacity-100 scale-100" : "-rotate-90 opacity-0 scale-50")} />
            </button>
          </div>
        </header>

        {/* Scrollable Content — pb-20 garante que o conteúdo não fique atrás da bottom bar no mobile */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 bg-[#f1f5f9] dark:bg-[#0d1117]">

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <button
              onClick={() => setStatusFilter(null)}
              className={clsx("bg-white dark:bg-[#161b22] rounded-xl p-4 shadow-sm border text-left flex flex-col justify-between transition-all",
                !statusFilter
                  ? "border-indigo-400 dark:border-indigo-500/60 ring-2 ring-indigo-100 dark:ring-indigo-500/10"
                  : "border-slate-200 dark:border-[#30363d] hover:border-slate-300"
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">Todos</span>
                <Server className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{searchedEstoque.length}</div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">total encontrado</div>
            </button>

            <button
              onClick={() => setStatusFilter(statusFilter === 'NOVO' ? null : 'NOVO')}
              className={clsx("bg-white dark:bg-[#161b22] rounded-xl p-4 shadow-sm border text-left flex flex-col justify-between transition-all",
                statusFilter === 'NOVO'
                  ? "border-blue-400 dark:border-blue-500/60 ring-2 ring-blue-100 dark:ring-blue-500/10"
                  : "border-slate-200 dark:border-[#30363d] hover:border-blue-200"
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">Novos</span>
                <Package className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{searchedEstoque.filter(i => i.status?.toUpperCase().includes('NOVO')).length}</div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">clique para filtrar</div>
            </button>

            <button
              onClick={() => setStatusFilter(statusFilter === 'USADO' ? null : 'USADO')}
              className={clsx("bg-white dark:bg-[#161b22] rounded-xl p-4 shadow-sm border text-left flex flex-col justify-between transition-all",
                statusFilter === 'USADO'
                  ? "border-amber-400 dark:border-amber-500/60 ring-2 ring-amber-100 dark:ring-amber-500/10"
                  : "border-slate-200 dark:border-[#30363d] hover:border-amber-200"
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">Usados</span>
                <HardDrive className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{searchedEstoque.filter(i => !i.status?.toUpperCase().includes('NOVO')).length}</div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">clique para filtrar</div>
            </button>
          </div>

          {availableBrands.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-3 mb-3">
              <button
                onClick={() => setActiveBrand(null)}
                className={clsx("whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-bold transition-all border",
                  !activeBrand
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white dark:bg-[#161b22] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#30363d] hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                )}
              >
                Todas as Marcas
              </button>
              {availableBrands.map(marca => (
                <button
                  key={marca}
                  onClick={() => setActiveBrand(marca)}
                  className={clsx("whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-bold transition-all border",
                    activeBrand === marca
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white dark:bg-[#161b22] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#30363d] hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                  )}
                >
                  {marca}
                </button>
              ))}
            </div>
          )}

          {statusFilter && (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">Filtrando por:</span>
              <span className={clsx("text-xs font-bold px-3 py-1 rounded-full border", statusFilter === 'NOVO' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200")}>{statusFilter}</span>
              <button onClick={() => setStatusFilter(null)} className="text-xs text-slate-400 dark:text-slate-500 hover:text-red-500 flex items-center gap-1"><X className="w-3 h-3" /> limpar filtro</button>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {groupedEstoque.length} agrupamento{groupedEstoque.length !== 1 ? 's' : ''}
            </h2>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#161b22] rounded-lg p-1 border border-slate-200 dark:border-[#30363d]">
              <button onClick={() => setViewMode('cards')} className={clsx("p-1.5 rounded transition-all", viewMode === 'cards' ? "bg-white dark:bg-[#0d1117] shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300")} title="Cards">
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('list')} className={clsx("p-1.5 rounded transition-all", viewMode === 'list' ? "bg-white dark:bg-[#0d1117] shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300")} title="Lista">
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {groupedEstoque.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/50 border-dashed p-16 text-center shadow-sm">
              <Search className="w-14 h-14 text-slate-300 mx-auto mb-5" />
              <p className="text-slate-600 dark:text-slate-300 text-lg font-bold mb-2">Nenhum equipamento encontrado</p>
              <p className="text-slate-400 dark:text-slate-500 text-sm max-w-md mx-auto mb-5">Verifique os termos digitados ou tente buscar de forma mais genérica. Você pode buscar por marca, modelo, processador ou número de série.</p>
              {(search || statusFilter) && (
                <button onClick={resetCatalog} className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl border border-indigo-200 transition-colors">
                  <X className="w-4 h-4" /> Limpar filtros
                </button>
              )}
            </div>
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-24">
              {groupedEstoque.map((group) => {
                const isScarce = group.items.length === 1;
                const cartCountInGroup = cart.filter(c => group.items.some(i => i.idPatrimonio === c.idPatrimonio)).length;

                return (
                  <div
                    key={group.key}
                    onClick={() => setActiveGroup(group)}
                    className="bg-white dark:bg-[#161b22] rounded-2xl border border-slate-200 dark:border-[#30363d] hover:border-indigo-400 dark:hover:border-indigo-500/60 hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer flex flex-col overflow-hidden relative group/card shadow-sm"
                  >
                    {isScarce && (
                      <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] uppercase font-bold px-3 py-1 rounded-bl-lg animate-pulse shadow-sm z-10">
                        Última Unidade
                      </div>
                    )}

                    {cartCountInGroup > 0 && (
                      <div className="absolute top-0 left-0 bg-amber-500 text-amber-950 text-[10px] uppercase font-bold px-3 py-1 rounded-br-lg shadow-sm z-10 flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3" /> {cartCountInGroup} na cotação
                      </div>
                    )}

                    <div className="p-6 flex-1 flex flex-col relative z-0">
                      <span className="text-[10px] font-black text-indigo-600/60 uppercase tracking-widest mb-1 mt-2 block">{group.tipo}</span>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700/50 uppercase tracking-wide">{group.marca}</span>
                      </div>
                      <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 leading-tight group-hover/card:text-indigo-600 transition-colors">
                        {group.modelo}
                      </h3>

                      <div className="mt-5 space-y-2.5 text-[13px]">
                        <div className="flex items-center gap-2"><Cpu className="w-4 h-4 text-indigo-400 shrink-0" /> <span className="font-semibold text-slate-700 dark:text-slate-200">{group.processador}</span></div>
                        <div className="flex items-center gap-2"><MemoryStick className="w-4 h-4 text-emerald-400 shrink-0" /> <span className="font-semibold text-slate-700 dark:text-slate-200">{group.ram}</span></div>
                        <div className="flex items-center gap-2"><HardDrive className="w-4 h-4 text-amber-400 shrink-0" /> <span className="font-semibold text-slate-700 dark:text-slate-200">{group.armazenamento}</span></div>
                        <div className="flex items-center gap-2"><Monitor className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" /> <span className="font-medium text-slate-600 dark:text-slate-300">{group.so}</span></div>
                      </div>

                      <div className="mt-5 flex gap-2 flex-wrap">
                        {group.novos > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                            {group.novos} Novo{group.novos > 1 ? 's' : ''}
                          </span>
                        )}
                        {group.usados > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                            {group.usados} Usado{group.usados > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-[#0f172a] flex justify-between items-center">
                      <span className="font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wide">Disponíveis</span>
                      <span className="inline-flex items-center justify-center bg-white dark:bg-slate-800 text-indigo-700 font-black px-3 py-1 rounded-lg text-sm border border-slate-200 dark:border-slate-700/50 shadow-sm">
                        {group.items.length} unid.
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* LIST VIEW */
            <div className="bg-white dark:bg-[#161b22] rounded-xl border border-slate-200 dark:border-[#30363d] shadow-sm overflow-hidden mb-8">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-[#0d1117] border-b border-slate-200 dark:border-[#30363d]">
                  <tr>
                    <th onClick={() => requestSort('marca')} className="py-4 px-5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#161b22] select-none transition-colors">Marca {sortConfig?.key === 'marca' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('modelo')} className="py-4 px-5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#161b22] select-none transition-colors">Modelo {sortConfig?.key === 'modelo' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('processador')} className="py-4 px-5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#161b22] select-none transition-colors">Processador {sortConfig?.key === 'processador' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('ram')} className="py-4 px-5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#161b22] select-none transition-colors">RAM {sortConfig?.key === 'ram' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('armazenamento')} className="py-4 px-5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#161b22] select-none transition-colors">Armazenamento {sortConfig?.key === 'armazenamento' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('so')} className="py-4 px-5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#161b22] select-none transition-colors">Sistema Operacional {sortConfig?.key === 'so' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('qtd')} className="py-4 px-5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-[#161b22] select-none transition-colors">Qtd {sortConfig?.key === 'qtd' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('cotados')} className="py-4 px-5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-[#161b22] select-none transition-colors">Cotados {sortConfig?.key === 'cotados' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {sortedGroupedEstoque.map((group) => {
                    const cartCountInGroup = cart.filter(c => group.items.some(i => i.idPatrimonio === c.idPatrimonio)).length;
                    return (
                      <tr key={group.key} onClick={() => setActiveGroup(group)} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 dark:bg-[#0f172a] cursor-pointer transition-all duration-200">
                        <td className="py-4 px-5">
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700/50 uppercase tracking-wide">{group.marca}</span>
                        </td>
                        <td className="py-4 px-5">
                          <div className="text-sm font-black text-slate-800 dark:text-slate-100">{group.modelo}</div>
                          <div className="text-[10px] text-indigo-500/70 dark:text-indigo-400/80 font-bold uppercase tracking-wider mt-0.5">{group.tipo}</div>
                        </td>
                        <td className="py-4 px-5 text-[13px] font-semibold text-slate-700 dark:text-slate-200"><div className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-indigo-400" /> {group.processador}</div></td>
                        <td className="py-4 px-5 text-[13px] font-semibold text-slate-700 dark:text-slate-200"><div className="flex items-center gap-1.5"><MemoryStick className="w-3.5 h-3.5 text-emerald-400" /> {group.ram}</div></td>
                        <td className="py-4 px-5 text-[13px] font-semibold text-slate-700 dark:text-slate-200"><div className="flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5 text-amber-400" /> {group.armazenamento}</div></td>
                        <td className="py-4 px-5 text-[13px] font-medium text-slate-500 dark:text-slate-400"><div className="flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5 text-slate-400" /> {group.so}</div></td>
                        <td className="py-3.5 px-5 text-center">
                          <span className="inline-flex items-center justify-center bg-indigo-50 text-indigo-700 font-black px-2.5 py-1 rounded-lg text-sm border border-indigo-200">{group.items.length}</span>
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          {cartCountInGroup > 0 ? (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 font-bold text-xs px-2.5 py-1 rounded-lg border border-amber-200">
                              <ShoppingCart className="w-3 h-3" /> {cartCountInGroup}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>


      {/* MODAL DE SELEÇÃO DE MÁQUINAS (ACTIVE GROUP) */}
      {activeGroup && (() => {
        const availableItems = activeGroup.items.filter(i => !i.status?.toUpperCase().includes('RESERVADO'));
        const selectedCount = cart.filter(c => activeGroup.items.some(i => i.idPatrimonio === c.idPatrimonio)).length;
        const allSelected = availableItems.length > 0 && selectedCount === availableItems.length;

        const selectAll = () => {
          const currentIds = new Set(cart.map(c => c.idPatrimonio));
          const toAdd = availableItems.filter(i => !currentIds.has(i.idPatrimonio));
          if (toAdd.length > 0) updateQuote(activeQuoteId, { items: [...cart, ...toAdd] });
        };

        const deselectAll = () => {
          const groupIds = new Set(activeGroup.items.map(i => i.idPatrimonio));
          updateQuote(activeQuoteId, { items: cart.filter(c => !groupIds.has(c.idPatrimonio)) });
        };

        const selectQuantity = (qty: number) => {
          const groupIds = new Set(activeGroup.items.map(i => i.idPatrimonio));
          const withoutGroup = cart.filter(c => !groupIds.has(c.idPatrimonio));
          const toAdd = availableItems.slice(0, qty);
          updateQuote(activeQuoteId, { items: [...withoutGroup, ...toAdd] });
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm backdrop-enter print:hidden">
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden modal-enter">
              {/* Header Modal */}
              <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50 flex justify-between items-start bg-slate-50/50 dark:bg-slate-800/50 relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>
                <div>
                  <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">{activeGroup.tipo} • <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded">{activeGroup.marca}</span></div>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">{activeGroup.modelo}</h2>
                  <div className="flex gap-3 mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200 flex-wrap">
                    <span className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-sm"><Cpu className="w-3.5 h-3.5 text-indigo-400" /> {activeGroup.processador}</span>
                    <span className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-sm"><MemoryStick className="w-3.5 h-3.5 text-emerald-400" /> {activeGroup.ram}</span>
                    <span className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-sm"><HardDrive className="w-3.5 h-3.5 text-amber-400" /> {activeGroup.armazenamento}</span>
                  </div>
                </div>
                <button onClick={() => setActiveGroup(null)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 p-2 rounded-full shadow-sm border border-slate-200 dark:border-slate-700/50 transition-colors z-10">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Batch Controls */}
              <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button onClick={allSelected ? deselectAll : selectAll} className={clsx("text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors", allSelected ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" : "bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100")}>
                    {allSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}
                  </button>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">{selectedCount}/{activeGroup.items.length} selecionados</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-wider">Qtd:</label>
                  <select
                    value={selectedCount}
                    onChange={(e) => selectQuantity(Number(e.target.value))}
                    className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-800"
                  >
                    {Array.from({ length: availableItems.length + 1 }, (_, i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table Area */}
              <div className="p-0 flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800/50 z-10 border-b border-slate-200 dark:border-slate-700/50 shadow-sm">
                    <tr>
                      <th className="py-3 px-6 w-12"></th>
                      <th className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 dark:text-slate-500">Patrimônio</th>
                      <th className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 dark:text-slate-500">Número de Série</th>
                      <th className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 dark:text-slate-500">Sistema Operacional</th>
                      <th className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 dark:text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {activeGroup.items.map(item => {
                      const isReserved = item.status?.toUpperCase().includes('RESERVADO');
                      const isSelected = cart.some(c => c.idPatrimonio === item.idPatrimonio);
                      return (
                        <tr
                          key={item.idPatrimonio}
                          className={clsx("transition-colors", isReserved ? "bg-red-50/40 opacity-80" : "hover:bg-slate-50 dark:hover:bg-slate-800/60 dark:bg-[#0f172a] cursor-pointer", isSelected && !isReserved ? "bg-indigo-50/50" : "")}
                          onClick={() => !isReserved && toggleCartItem(item)}
                        >
                          <td className="py-4 px-6">
                            <input
                              type="checkbox"
                              className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-600 cursor-pointer pointer-events-none"
                              checked={isSelected}
                              disabled={isReserved}
                              readOnly
                            />
                          </td>
                          <td className="py-4 px-6 font-bold text-slate-800 dark:text-slate-100">{item.idPatrimonio}</td>
                          <td className="py-4 px-6">
                            <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded border border-slate-200 dark:border-slate-700/50">{item.numeroSerie}</span>
                          </td>
                          <td className="py-4 px-6 text-sm font-medium text-slate-600 dark:text-slate-300">{item.especificacoes.so || 'N/A'}</td>
                          <td className="py-4 px-6">
                            {isReserved ? (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-red-50 text-red-700 border-red-200 whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                {item.status}
                              </span>
                            ) : (
                              <span className={clsx("text-[10px] font-bold px-2.5 py-1 rounded-full border",
                                item.status?.includes('NOVO') ? "bg-blue-50 text-blue-700 border-blue-200" :
                                  item.status?.includes('DISPONIVEL') ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                    "bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/50"
                              )}>
                                {item.status?.replace('DISPONIVEL', '').trim() || item.status}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-[#0f172a] flex justify-end">
                <button onClick={() => setActiveGroup(null)} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-colors shadow-sm">
                  Concluído
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* QUOTE DRAWER (Right Slide-over) */}
      {isQuoteModalOpen && activeQuote && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm print:hidden" onClick={() => setIsQuoteModalOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg flex flex-col bg-white/95 dark:bg-[#0d1117]/95 backdrop-blur-xl shadow-2xl border-l border-slate-200 dark:border-[#30363d] drawer-enter print:hidden">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="text-indigo-500 w-4 h-4 shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-base font-black text-slate-800 dark:text-slate-100 truncate">{activeQuote.name}</h2>
                  {activeQuote.isReserved ? (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-2.5 h-2.5" /> Reservada
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">Passo {quoteStep} de 3</span>
                  )}
                </div>
              </div>
              <button onClick={() => setIsQuoteModalOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors shrink-0 ml-2">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-5 flex-1 overflow-y-auto space-y-5">
              
              {/* STEP 2: Dados do Cliente */}
              {!activeQuote.isReserved && quoteStep === 2 && (
                <div className="step-enter space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-1.5">Cliente / Empresa</label>
                    <input
                      type="text"
                      value={activeQuote.clientName || ''}
                      onChange={e => updateQuote(activeQuoteId, { clientName: e.target.value })}
                      className="w-full border border-slate-300 dark:border-[#30363d] rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none text-sm font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-[#0d1117] placeholder-slate-400 dark:placeholder-slate-600 transition-colors"
                      placeholder="Nome do cliente ou empresa"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-1.5">Margem / Condição</label>
                      <input
                        type="text"
                        value={activeQuote.margin || ''}
                        onChange={e => updateQuote(activeQuoteId, { margin: e.target.value })}
                        className="w-full border border-slate-300 dark:border-[#30363d] rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none text-sm font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-[#0d1117] placeholder-slate-400 dark:placeholder-slate-600 transition-colors"
                        placeholder="Ex: 10%"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-1.5">Validade (Dias)</label>
                      <input
                        type="number"
                        value={activeQuote.validityDays ?? 2}
                        onChange={e => updateQuote(activeQuoteId, { validityDays: parseInt(e.target.value) || 0 })}
                        className="w-full border border-slate-300 dark:border-[#30363d] rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none text-sm font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-[#0d1117] transition-colors"
                        placeholder="2"
                        min="1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 1: Items List (or if Reserved) */}
              {(activeQuote.isReserved || quoteStep === 1) && (
                <div className="step-enter">
                  <div className="flex justify-between items-center mb-2.5">
                    <h3 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Itens da Proposta</h3>
                    <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-500/20">
                      {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {cart.map(item => {
                      const isUnavailable = unavailableIds.has(item.idPatrimonio);
                      return (
                        <div key={item.idPatrimonio} className={clsx(
                          "flex justify-between items-center p-3 border rounded-lg transition-colors group",
                          isUnavailable
                            ? "border-red-400/40 bg-red-950/10 dark:bg-red-950/20"
                            : "border-slate-200/60 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/40"
                        )}>
                          <div className="min-w-0 flex-1">
                            {isUnavailable && (
                              <div className="flex items-center gap-1 mb-1">
                                <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                                <span className="text-[9px] font-bold text-red-500 uppercase tracking-wide">Indisponivel</span>
                              </div>
                            )}
                            <div className={clsx("font-bold text-sm leading-tight", isUnavailable ? "text-red-400 line-through" : "text-slate-800 dark:text-slate-100")}>
                              {item.marca} {item.modelo}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[10px] text-slate-500 dark:text-slate-500">Pat: {item.idPatrimonio}</span>
                              <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10">
                                NS: {item.numeroSerie}
                              </span>
                            </div>
                          </div>
                          {!activeQuote.isReserved && (
                            <button onClick={() => toggleCartItem(item)} className="p-1.5 text-slate-400 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors shrink-0 ml-2">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {cart.length === 0 && (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-600 text-sm italic">
                        Nenhum item. Selecione equipamentos no catalogo.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: Review & Summary */}
              {!activeQuote.isReserved && quoteStep === 3 && (
                <div className="step-enter space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Resumo da Proposta</h3>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-1">Cliente / Empresa</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4">{activeQuote.clientName || 'Não informado'}</p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Condição</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{activeQuote.margin || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Validade</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{activeQuote.validityDays} dias</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-[#161b22] p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 flex justify-between items-center shadow-sm">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Total de Equipamentos</span>
                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{cart.length} unid.</span>
                  </div>
                </div>
              )}

            </div>

            {/* Drawer Footer */}
            <div className="px-4 py-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 shrink-0 space-y-3">
              {activeQuote.isReserved ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 rounded-lg border border-emerald-200 dark:border-emerald-800/50 font-bold text-sm">
                    <CheckCircle className="w-4 h-4" /> Equipamentos Reservados
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleCancelReserve} disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white dark:bg-[#161b22] hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg font-semibold text-sm transition-colors border border-slate-200 dark:border-[#30363d]">
                      <X className="w-3.5 h-3.5" /> Cancelar Reserva
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {quoteStep === 1 && (
                    <button onClick={() => setQuoteStep(2)} disabled={cart.length === 0} className={clsx("w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm transition-colors shadow-sm", cart.length === 0 && "opacity-50 cursor-not-allowed")}>
                      Avançar para Dados do Cliente
                    </button>
                  )}
                  {quoteStep === 2 && (
                    <div className="flex gap-2">
                      <button onClick={() => setQuoteStep(1)} className="flex-1 px-4 py-3 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm">Voltar</button>
                      <button onClick={() => setQuoteStep(3)} className="flex-[2] px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm transition-colors shadow-sm">Revisão e Envio</button>
                    </div>
                  )}
                  {quoteStep === 3 && (
                    <>
                      <div className="flex gap-2">
                        <button onClick={() => setQuoteStep(2)} className="px-3 py-2.5 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm">
                          Voltar
                        </button>
                        <button onClick={generateWhatsAppLink} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
                          <Send className="w-3.5 h-3.5" /> WhatsApp
                        </button>
                        <button onClick={handlePrint} disabled={isGeneratingPdf} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-700 hover:bg-slate-800 dark:bg-white/10 dark:hover:bg-white/15 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-wait">
                          {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} 
                          {isGeneratingPdf ? 'Gerando...' : 'Gerar PDF'}
                        </button>
                      </div>
                      <button onClick={handleReserve} disabled={isSubmitting || cart.length === 0} className={clsx("w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed", isSubmitting && "opacity-70 cursor-wait")}>
                        {isSubmitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Server className="w-4 h-4" />} Reservar Equipamentos
                      </button>
                    </>
                  )}
                </>
              )}
              <button onClick={deleteProposal} className="w-full text-[11px] font-bold text-red-400/70 hover:text-red-500 transition-colors flex items-center justify-center gap-1.5 py-1.5 mt-2">
                <Trash2 className="w-3 h-3" /> Excluir Proposta
              </button>
            </div>
          </div>
        </>
      )}

      {/* O componente HTML de PDF foi removido, agora o PDF é gerado nativamente via pdfMake */}

      {/* TOAST NOTIFICATIONS */}
      {toasts.length > 0 && (
        <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 print:hidden">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={clsx(
                "flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border backdrop-blur-md min-w-[320px] max-w-[420px] transition-all",
                toast.exiting ? 'toast-exit' : 'toast-enter',
                toast.type === 'success' && "bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-100",
                toast.type === 'error' && "bg-red-50/95 dark:bg-red-950/90 border-red-300 dark:border-red-800/50 text-red-900 dark:text-red-100",
                toast.type === 'info' && "bg-blue-50/95 dark:bg-blue-950/90 border-blue-300 dark:border-blue-800/50 text-blue-900 dark:text-blue-100"
              )}
            >
              {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500 shrink-0" />}
              <span className="text-sm font-semibold flex-1">{toast.message}</span>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-current opacity-40 hover:opacity-100 transition-opacity shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* CONFIRM DIALOG */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm backdrop-enter print:hidden">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md modal-enter overflow-hidden">
            <div className="p-6 pb-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 text-center mb-2">{confirmDialog.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 text-center leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="flex border-t border-slate-100 dark:border-slate-800/50">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-3.5 text-sm font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/60 dark:bg-[#0f172a] transition-colors border-r border-slate-100 dark:border-slate-800/50"
              >
                Cancelar
              </button>
              <button
                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
                className="flex-1 py-3.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── OVERLAY DE LOADING DO PDF (in-app, sem aba em branco) ─────────── */}
      {isGeneratingPdf && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm print:hidden">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 max-w-xs w-full mx-4">
            <div className="w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-800 dark:text-slate-100 text-base">Gerando PDF</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Isso leva apenas alguns segundos...</p>
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM NAVIGATION BAR (mobile only — oculta quando modal aberto) ── */}
      {!isQuoteModalOpen && !confirmDialog && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 print:hidden">
          {/* Bottom Sheet drawer de propostas (aberto pelo tab Propostas) */}
          {isMobileDrawerOpen && (
            <>
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileDrawerOpen(false)} />
              <div className="fixed bottom-16 left-0 right-0 bg-[#0B1120] rounded-t-2xl shadow-2xl flex flex-col max-h-[70vh] border-t border-white/10">
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/5">
                  <span className="text-sm font-bold text-slate-200">Minhas Propostas</span>
                  <button onClick={() => setIsMobileDrawerOpen(false)} className="text-slate-400 p-1"><X className="w-5 h-5" /></button>
                </div>
                <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
                  {quotes.length === 0 && (
                    <p className="text-center text-slate-500 text-sm py-6">Nenhuma proposta ainda.<br />Selecione itens para iniciar.</p>
                  )}
                  {quotes.map(q => (
                    <button
                      key={q.id}
                      onClick={() => { setActiveQuoteId(q.id); setIsQuoteModalOpen(true); setIsMobileDrawerOpen(false); }}
                      className={clsx(
                        'w-full flex justify-between items-center px-3.5 py-3 rounded-xl text-left transition-all border',
                        q.id === activeQuoteId
                          ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                          : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 shrink-0 opacity-60" />
                        <div className="min-w-0">
                          <span className="text-[13px] font-semibold block truncate">{q.name}</span>
                          {q.clientName && <span className="text-[11px] text-indigo-400 block truncate">{q.clientName}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {q.isReserved && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                        {q.items.length > 0 && (
                          <span className="bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{q.items.length}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="p-3 border-t border-white/5 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { addNewQuote(); setIsMobileDrawerOpen(false); }}
                    className="flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold"
                  >
                    <Plus className="w-4 h-4" /> Nova Proposta
                  </button>
                  {activeQuote && (
                    <button
                      onClick={() => { setIsQuoteModalOpen(true); setIsMobileDrawerOpen(false); }}
                      className="flex items-center justify-center gap-2 py-3 bg-white/10 text-slate-200 rounded-xl text-sm font-bold border border-white/10"
                    >
                      <FileText className="w-4 h-4" /> Ver Proposta
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* A barra em si */}
          <div className="bg-[#0B1120] border-t border-white/10 px-2 pb-safe">
            <div className="flex items-stretch h-16">

              {/* Tab: Catálogo */}
              <button
                onClick={() => { setMobileTab('catalogo'); setIsMobileDrawerOpen(false); resetCatalog(); }}
                className={clsx(
                  'flex-1 flex flex-col items-center justify-center gap-1 transition-colors rounded-xl mx-0.5 my-1',
                  mobileTab === 'catalogo' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                )}
              >
                <Home className="w-5 h-5" />
                <span className="text-[10px] font-semibold">Catálogo</span>
              </button>

              {/* Tab: Propostas — botão central destacado */}
              <button
                onClick={() => { setMobileTab('propostas'); setIsMobileDrawerOpen(prev => !prev); }}
                className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors rounded-xl mx-0.5 my-1 relative"
              >
                <div className={clsx(
                  'relative flex items-center justify-center w-10 h-10 rounded-full transition-all',
                  mobileTab === 'propostas' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40' : 'bg-white/5 text-slate-400'
                )}>
                  <ShoppingCart className="w-5 h-5" />
                  {cart.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                      {cart.length > 9 ? '9+' : cart.length}
                    </span>
                  )}
                </div>
                <span className={clsx('text-[10px] font-semibold', mobileTab === 'propostas' ? 'text-indigo-400' : 'text-slate-500')}>
                  Propostas
                </span>
              </button>

              {/* Tab: Reservas */}
              <button
                onClick={() => { setMobileTab('reservas'); setIsMobileDrawerOpen(false); }}
                className={clsx(
                  'flex-1 flex flex-col items-center justify-center gap-1 transition-colors rounded-xl mx-0.5 my-1 relative',
                  mobileTab === 'reservas' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                )}
              >
                <div className="relative">
                  <BookMarked className="w-5 h-5" />
                  {reservedProposals.length > 0 && (
                    <span className={clsx(
                      'absolute -top-1.5 -right-1.5 text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center',
                      reservedProposals.some(r => r.isExpired) ? 'bg-red-500 text-white' :
                      reservedProposals.some(r => r.isExpiringSoon) ? 'bg-amber-500 text-white' :
                      'bg-emerald-500 text-white'
                    )}>
                      {reservedProposals.length}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold">Reservas</span>
              </button>

            </div>
          </div>
        </nav>
      )}

    </div>
  );
}
