import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, CheckCircle, AlertTriangle, Server, MemoryStick, HardDrive, Trash2, FileText, Send, X, LayoutDashboard, Monitor, ShoppingCart, Plus, Package, LayoutGrid, List, AlertCircle, Cpu, Info, RefreshCw } from 'lucide-react';
import { differenceInHours, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import clsx from 'clsx';
import Fuse from 'fuse.js';

import logoOficial from './assets/logo_oficial.png';
import watermarkOficial from './assets/watermark_oficial.png';

interface Especificacoes {
  processador: string;
  ram: string;
  armazenamento: string;
  tela?: string;
  so?: string;
}

interface Equipamento {
  idPatrimonio: string;
  numeroSerie: string;
  tipo: string;
  marca: string;
  modelo: string;
  status: string;
  fornecedor: string;
  especificacoes: Especificacoes;
  clienteAlocado?: string;
  ordemServico?: string;
}

interface Metadados {
  ultimaAtualizacao: string;
  totalItens: number;
}

interface Catalogo {
  metadados: Metadados;
  estoque: Equipamento[];
}

interface GroupedItem {
  key: string;
  modelo: string;
  marca: string;
  tipo: string;
  processador: string;
  ram: string;
  armazenamento: string;
  so: string;
  novos: number;
  usados: number;
  items: Equipamento[];
}

interface Quote {
  id: string;
  name: string;
  items: Equipamento[];
  clientName?: string;
  margin?: string;
  validityDays?: number;
  isReserved?: boolean;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  exiting?: boolean;
}

interface ConfirmDialog {
  title: string;
  message: string;
  onConfirm: () => void;
}

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

export default function App() {
  const [data, setData] = useState<Catalogo | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  // Multi-Quote State (persistido no localStorage)
  const [quotes, setQuotes] = useState<Quote[]>(loadPersistedQuotes);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(loadPersistedActiveId);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    const hasReservedUpdate = 'isReserved' in patch;
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, ...patch, isReserved: hasReservedUpdate ? patch.isReserved : false } : q));
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

  const syncGLPI = async () => {
    setIsRefreshing(true);
    try {
      await fetch('http://localhost:5678/webhook/atualizar_estoque', { method: 'GET', mode: 'no-cors' });
      addToast('Sincronização GLPI acionada! O catálogo será atualizado em instantes.', 'success');
      
      // Simula uma espera para o n8n terminar de gerar o arquivo e tenta baixar o novo
      setTimeout(() => fetchCatalogo(true), 5000); 
    } catch (err) {
      addToast('Erro ao acionar a sincronização GLPI.', 'error');
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCatalogo(true);
    const interval = setInterval(() => fetchCatalogo(true), 60000); // Auto-refresh a cada 60s
    return () => clearInterval(interval);
  }, [fetchCatalogo]);

  // Persistir cotações no localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_QUOTES, JSON.stringify(quotes));
  }, [quotes]);

  useEffect(() => {
    if (activeQuoteId) localStorage.setItem(STORAGE_KEY_ACTIVE, activeQuoteId);
    else localStorage.removeItem(STORAGE_KEY_ACTIVE);
  }, [activeQuoteId]);

  const searchedEstoque = useMemo(() => {
    if (!data?.estoque) return [];
    if (!search.trim()) return data.estoque;

    const tokens = search.trim().split(/\s+/).filter(Boolean);
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

    // Fallback fuzzy para erros de digitação
    const fuse = new Fuse(data.estoque, {
      keys: [
        'modelo', 'marca', 'tipo', 'numeroSerie', 'idPatrimonio',
        'especificacoes.processador', 'especificacoes.ram',
        'especificacoes.armazenamento', 'especificacoes.so'
      ],
      threshold: 0.4,
      ignoreLocation: true
    });
    return fuse.search(search).map(result => result.item);
  }, [data, search]);

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
    const { clientName, margin } = activeQuote;
    let text = `*Orçamento de Equipamentos*\nCliente: ${clientName || 'Não informado'}\n\n`;
    if (margin) text += `Condição/Margem: ${margin}\n\n`;

    cart.forEach(item => {
      text += `💻 *${item.tipo} ${item.marca} ${item.modelo}*\n`;
      text += `Proc: ${item.especificacoes?.processador} | RAM: ${item.especificacoes?.ram}\n`;
      text += `Armaz: ${item.especificacoes?.armazenamento} | SO: ${item.especificacoes?.so}\n`;
      text += `Série: ${item.numeroSerie} | Pat: ${item.idPatrimonio}\n\n`;
    });

    text += `_Gerado via Micro Estoque_`;
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleReserve = async () => {
    if (cart.length === 0 || !activeQuoteId || !activeQuote) return;
    setIsSubmitting(true);
    try {
      const payload = {
        propostaId: activeQuote.id,
        nomeProposta: activeQuote.name,
        cliente: activeQuote.clientName || 'Não informado',
        validadeDias: activeQuote.validityDays || 2,
        itens: cart.map(i => ({
          idPatrimonio: i.idPatrimonio,
          numeroSerie: i.numeroSerie,
          modelo: i.modelo
        }))
      };

      const response = await fetch('http://localhost:5678/webhook/reservar_ativos', {
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

      updateQuote(activeQuoteId, { isReserved: true });
      
      // Força um refresh para pegar o novo JSON com os status "RESERVADO" se o n8n já tiver rodado
      setTimeout(() => fetchCatalogo(true), 1500);
    } catch (err: any) {
      addToast(err.message || 'Erro desconhecido ao reservar.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCatalog = () => {
    setSearch('');
    setStatusFilter(null);
    setActiveBrand(null);
    setSortConfig(null);
    setViewMode('cards');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const ultimaAtualizacaoStr = data?.metadados?.ultimaAtualizacao || new Date().toISOString();
  const ultimaAtualizacao = parseISO(ultimaAtualizacaoStr);
  const statusCritico = differenceInHours(new Date(), ultimaAtualizacao) > 24;

  return (
    <div className="h-screen w-full flex bg-slate-50 overflow-hidden font-sans print:h-auto print:overflow-visible print:block">

      {/* SIDEBAR (Dark Theme #0B1120) */}
      <aside className="w-64 bg-[#0B1120] text-slate-300 flex-shrink-0 flex-col hidden md:flex print:hidden relative overflow-hidden">
        {/* Subtle glow effect behind logo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/10 blur-[50px] rounded-full pointer-events-none"></div>

        <div className="p-6 pb-2 border-b border-slate-800/50 flex flex-col items-center">
          <img src={logoOficial} alt="Logo" className="h-12 w-auto object-contain mb-4 filter drop-shadow-md" />
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 custom-scrollbar">
          <div className="px-3 mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Menu Principal</div>
          <button onClick={resetCatalog} className="w-full flex items-center gap-3 px-3 py-2.5 bg-indigo-600/10 text-indigo-400 rounded-xl font-medium transition-colors border border-indigo-500/20 shadow-sm hover:bg-indigo-600/20">
            <LayoutDashboard className="w-5 h-5" />
            Ver Todo o Catálogo
          </button>

          <div className="px-3 mt-8 mb-1 flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Minhas Propostas</span>
            <button onClick={addNewQuote} className="text-slate-500 hover:text-indigo-400 transition-colors" title="Nova proposta">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {quotes.length === 0 && (
            <div className="px-3 py-4 text-center">
              <p className="text-[11px] text-slate-500 leading-relaxed">Nenhuma proposta criada.<br />Selecione itens no catálogo para iniciar.</p>
            </div>
          )}

          {quotes.map(q => (
            <button
              key={q.id}
              onClick={() => setActiveQuoteId(q.id)}
              className={clsx(
                "w-full flex justify-between items-center px-3 py-2.5 rounded-xl font-medium transition-colors group text-left",
                q.id === activeQuoteId
                  ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20"
                  : "hover:bg-slate-800/50 text-slate-400 hover:text-slate-200"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 shrink-0" />
                <div className="min-w-0">
                  <span className="truncate text-sm block">{q.name}</span>
                  {q.clientName && <span className="truncate text-[11px] font-black text-indigo-300 block mt-0.5">{q.clientName}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {q.isReserved && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mr-1" />}
                {q.items.length > 0 && (
                  <span className="bg-amber-500 text-amber-950 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    {q.items.length}
                  </span>
                )}
                <span
                  onClick={(e) => { e.stopPropagation(); showConfirm('Excluir Proposta', `Deseja excluir "${q.name}"?`, () => removeQuote(q.id)); }}
                  className="text-slate-600 hover:text-red-400 transition-colors ml-1 opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800/50">
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Status do Estoque</span>
            <button onClick={() => fetchCatalogo(false)} disabled={isRefreshing} className={clsx("text-slate-500 hover:text-indigo-400 transition-colors", isRefreshing && "animate-spin text-indigo-400")} title="Atualizar Agora">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className={clsx(
            "w-full px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-xs font-bold shadow-inner border mb-3",
            statusCritico
              ? "bg-amber-900/30 text-amber-400 border-amber-900/50"
              : "bg-emerald-900/30 text-emerald-400 border-emerald-900/50"
          )}>
            {statusCritico ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
            <span>{format(ultimaAtualizacao, "dd/MM HH:mm")}</span>
          </div>
          <button 
            onClick={syncGLPI} 
            disabled={isRefreshing}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors border border-slate-700"
            title="Forçar webhook do n8n para atualizar o catálogo a partir do GLPI"
          >
            <Server className="w-3.5 h-3.5" /> Forçar Sincronização
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden print:hidden relative">
        {/* Top Header */}
        <header className="bg-white px-8 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-10 border-b border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Micro Estoque</h1>
            <p className="text-sm text-slate-500 font-medium">Catálogo comercial de ativos • {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
          </div>

          <div className="relative w-full md:w-auto flex items-center gap-3">
            <div className="relative flex-1 md:w-96 group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Buscar por marca, modelo, proc, série..."
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl leading-5 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm font-medium"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {activeQuote && cart.length > 0 && (
              <button
                onClick={() => setIsQuoteModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-sm whitespace-nowrap"
              >
                <FileText className="w-4 h-4" />
                <span>{activeQuote.name}</span>
                <span className="bg-white/20 text-[10px] font-bold px-1.5 py-0.5 rounded">{cart.length}</span>
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#f8fafc]">

          {/* Summary Cards / Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <button
              onClick={() => setStatusFilter(null)}
              className={clsx("bg-white rounded-2xl p-5 shadow-sm border text-left flex flex-col justify-between transition-all", !statusFilter ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200 hover:border-slate-300")}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">Todos</span>
                <Server className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="text-3xl font-black text-slate-800">{searchedEstoque.length}</div>
              <div className="text-xs text-slate-400 mt-1">total encontrado</div>
            </button>

            <button
              onClick={() => setStatusFilter(statusFilter === 'NOVO' ? null : 'NOVO')}
              className={clsx("bg-white rounded-2xl p-5 shadow-sm border text-left flex flex-col justify-between transition-all", statusFilter === 'NOVO' ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-200")}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">Novos</span>
                <Package className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-3xl font-black text-blue-600">{searchedEstoque.filter(i => i.status?.toUpperCase().includes('NOVO')).length}</div>
              <div className="text-xs text-slate-400 mt-1">clique para filtrar</div>
            </button>

            <button
              onClick={() => setStatusFilter(statusFilter === 'USADO' ? null : 'USADO')}
              className={clsx("bg-white rounded-2xl p-5 shadow-sm border text-left flex flex-col justify-between transition-all", statusFilter === 'USADO' ? "border-amber-400 ring-2 ring-amber-100" : "border-slate-200 hover:border-amber-200")}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">Usados</span>
                <HardDrive className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-3xl font-black text-amber-600">{searchedEstoque.filter(i => !i.status?.toUpperCase().includes('NOVO')).length}</div>
              <div className="text-xs text-slate-400 mt-1">clique para filtrar</div>
            </button>
          </div>

          {/* Quick Brand Filter */}
          {availableBrands.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-4 mb-4 custom-scrollbar">
              <button
                onClick={() => setActiveBrand(null)}
                className={clsx("whitespace-nowrap px-4 py-1.5 rounded-full text-[11px] font-bold transition-all border", !activeBrand ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600")}
              >
                Todas as Marcas
              </button>
              {availableBrands.map(marca => (
                <button
                  key={marca}
                  onClick={() => setActiveBrand(marca)}
                  className={clsx("whitespace-nowrap px-4 py-1.5 rounded-full text-[11px] font-bold transition-all border", activeBrand === marca ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600")}
                >
                  {marca}
                </button>
              ))}
            </div>
          )}

          {statusFilter && (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm text-slate-600 font-medium">Filtrando por:</span>
              <span className={clsx("text-xs font-bold px-3 py-1 rounded-full border", statusFilter === 'NOVO' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200")}>{statusFilter}</span>
              <button onClick={() => setStatusFilter(null)} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"><X className="w-3 h-3" /> limpar filtro</button>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">
              {groupedEstoque.length} agrupamento{groupedEstoque.length !== 1 ? 's' : ''}
            </h2>
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 border border-slate-200">
              <button onClick={() => setViewMode('cards')} className={clsx("p-2 rounded-md transition-all", viewMode === 'cards' ? "bg-white shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600")} title="Cards">
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('list')} className={clsx("p-2 rounded-md transition-all", viewMode === 'list' ? "bg-white shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600")} title="Lista">
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {groupedEstoque.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-16 text-center shadow-sm">
              <Search className="w-14 h-14 text-slate-300 mx-auto mb-5" />
              <p className="text-slate-600 text-lg font-bold mb-2">Nenhum equipamento encontrado</p>
              <p className="text-slate-400 text-sm max-w-md mx-auto mb-5">Verifique os termos digitados ou tente buscar de forma mais genérica. Você pode buscar por marca, modelo, processador ou número de série.</p>
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
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer flex flex-col overflow-hidden relative group/card"
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

                    <div className="p-5 flex-1 flex flex-col relative z-0">
                      <span className="text-[10px] font-black text-indigo-600/60 uppercase tracking-widest mb-1 mt-2 block">{group.tipo}</span>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wide">{group.marca}</span>
                      </div>
                      <h3 className="text-base font-black text-slate-800 leading-tight group-hover/card:text-indigo-600 transition-colors">
                        {group.modelo}
                      </h3>

                      <div className="mt-4 space-y-2.5 text-[13px]">
                        <div className="flex items-center gap-2"><Cpu className="w-4 h-4 text-indigo-400 shrink-0" /> <span className="font-semibold text-slate-700">{group.processador}</span></div>
                        <div className="flex items-center gap-2"><MemoryStick className="w-4 h-4 text-emerald-400 shrink-0" /> <span className="font-semibold text-slate-700">{group.ram}</span></div>
                        <div className="flex items-center gap-2"><HardDrive className="w-4 h-4 text-amber-400 shrink-0" /> <span className="font-semibold text-slate-700">{group.armazenamento}</span></div>
                        <div className="flex items-center gap-2"><Monitor className="w-4 h-4 text-slate-400 shrink-0" /> <span className="font-medium text-slate-600">{group.so}</span></div>
                      </div>

                      <div className="mt-4 flex gap-2 flex-wrap">
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

                    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                      <span className="font-bold text-slate-500 text-xs uppercase tracking-wide">Disponíveis</span>
                      <span className="inline-flex items-center justify-center bg-white text-indigo-700 font-black px-3 py-1 rounded-lg text-sm border border-slate-200 shadow-sm">
                        {group.items.length} unid.
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* LIST VIEW */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-24">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th onClick={() => requestSort('modelo')} className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 cursor-pointer hover:bg-slate-100 select-none">Modelo {sortConfig?.key === 'modelo' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('marca')} className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 cursor-pointer hover:bg-slate-100 select-none">Marca {sortConfig?.key === 'marca' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('processador')} className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 cursor-pointer hover:bg-slate-100 select-none">Processador {sortConfig?.key === 'processador' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('ram')} className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 cursor-pointer hover:bg-slate-100 select-none">RAM {sortConfig?.key === 'ram' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('armazenamento')} className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 cursor-pointer hover:bg-slate-100 select-none">Armazenamento {sortConfig?.key === 'armazenamento' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('qtd')} className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center cursor-pointer hover:bg-slate-100 select-none">Qtd {sortConfig?.key === 'qtd' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('cotados')} className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center cursor-pointer hover:bg-slate-100 select-none">Cotados {sortConfig?.key === 'cotados' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedGroupedEstoque.map((group) => {
                    const cartCountInGroup = cart.filter(c => group.items.some(i => i.idPatrimonio === c.idPatrimonio)).length;
                    return (
                      <tr key={group.key} onClick={() => setActiveGroup(group)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-slate-800">{group.modelo}</div>
                          <div className="text-[11px] text-slate-400 font-medium uppercase">{group.tipo}</div>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200 uppercase">{group.marca}</span>
                        </td>
                        <td className="py-3.5 px-5 text-sm font-semibold text-slate-700">{group.processador}</td>
                        <td className="py-3.5 px-5 text-sm font-semibold text-slate-700">{group.ram}</td>
                        <td className="py-3.5 px-5 text-sm font-semibold text-slate-700">{group.armazenamento}</td>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm backdrop-enter print:hidden">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden modal-enter">
              {/* Header Modal */}
              <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50 relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>
                <div>
                  <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">{activeGroup.tipo} • <span className="text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded">{activeGroup.marca}</span></div>
                  <h2 className="text-2xl font-black text-slate-800">{activeGroup.modelo}</h2>
                  <div className="flex gap-3 mt-3 text-sm font-semibold text-slate-700 flex-wrap">
                    <span className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm"><Cpu className="w-3.5 h-3.5 text-indigo-400" /> {activeGroup.processador}</span>
                    <span className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm"><MemoryStick className="w-3.5 h-3.5 text-emerald-400" /> {activeGroup.ram}</span>
                    <span className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm"><HardDrive className="w-3.5 h-3.5 text-amber-400" /> {activeGroup.armazenamento}</span>
                  </div>
                </div>
                <button onClick={() => setActiveGroup(null)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm border border-slate-200 transition-colors z-10">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Batch Controls */}
              <div className="px-6 py-3 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button onClick={allSelected ? deselectAll : selectAll} className={clsx("text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors", allSelected ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" : "bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100")}>
                    {allSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}
                  </button>
                  <span className="text-xs text-slate-400 font-medium">{selectedCount}/{activeGroup.items.length} selecionados</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Qtd:</label>
                  <select
                    value={selectedCount}
                    onChange={(e) => selectQuantity(Number(e.target.value))}
                    className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    {Array.from({ length: availableItems.length + 1 }, (_, i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table Area */}
              <div className="p-0 flex-1 overflow-y-auto custom-scrollbar bg-white">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 shadow-sm">
                    <tr>
                      <th className="py-3 px-6 w-12"></th>
                      <th className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Patrimônio</th>
                      <th className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Número de Série</th>
                      <th className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Sistema Operacional</th>
                      <th className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeGroup.items.map(item => {
                      const isReserved = item.status?.toUpperCase().includes('RESERVADO');
                      const isSelected = cart.some(c => c.idPatrimonio === item.idPatrimonio);
                      return (
                        <tr
                          key={item.idPatrimonio}
                          className={clsx("transition-colors", isReserved ? "bg-red-50/40 opacity-80" : "hover:bg-slate-50 cursor-pointer", isSelected && !isReserved ? "bg-indigo-50/50" : "")}
                          onClick={() => !isReserved && toggleCartItem(item)}
                        >
                          <td className="py-4 px-6">
                            <input
                              type="checkbox"
                              className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer pointer-events-none"
                              checked={isSelected}
                              disabled={isReserved}
                              readOnly
                            />
                          </td>
                          <td className="py-4 px-6 font-bold text-slate-800">{item.idPatrimonio}</td>
                          <td className="py-4 px-6">
                            <span className="font-mono text-sm font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded border border-slate-200">{item.numeroSerie}</span>
                          </td>
                          <td className="py-4 px-6 text-sm font-medium text-slate-600">{item.especificacoes.so || 'N/A'}</td>
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
                                    "bg-slate-100 text-slate-600 border-slate-200"
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

              <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
                <button onClick={() => setActiveGroup(null)} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-colors shadow-sm">
                  Concluído
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* QUOTE MODAL */}
      {isQuoteModalOpen && activeQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm backdrop-enter print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden modal-enter">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <FileText className="text-indigo-600" /> Montar Proposta Comercial
              </h2>
              <button onClick={() => setIsQuoteModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm border border-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
              <div className="mb-3 flex items-center gap-2 pb-3 border-b border-slate-100">
                <FileText className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-bold text-slate-700">{activeQuote?.name}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Cliente / Empresa</label>
                  <input type="text" value={activeQuote.clientName || ''} onChange={e => updateQuote(activeQuoteId, { clientName: e.target.value })} className="w-full border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800" placeholder="Ex: Acme Corp" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Margem / Condição</label>
                  <input type="text" value={activeQuote.margin || ''} onChange={e => updateQuote(activeQuoteId, { margin: e.target.value })} className="w-full border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800" placeholder="Ex: 10% de desconto à vista" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Validade (Dias)</label>
                  <input type="number" value={activeQuote.validityDays ?? 2} onChange={e => updateQuote(activeQuoteId, { validityDays: parseInt(e.target.value) || 0 })} className="w-full border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800" placeholder="Ex: 2" min="1" />
                </div>
              </div>

              <div className="flex justify-between items-end mb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Itens da Proposta</h3>
                <span className="text-xs font-bold bg-indigo-100 text-indigo-800 px-2 py-1 rounded-md">{cart.length} {cart.length === 1 ? 'item' : 'itens'}</span>
              </div>

              <div className="space-y-3">
                {cart.map(item => {
                  const isUnavailable = unavailableIds.has(item.idPatrimonio);
                  return (
                    <div key={item.idPatrimonio} className={clsx("flex justify-between items-center p-4 border rounded-xl shadow-sm transition-colors group", isUnavailable ? "border-red-300 bg-red-50/50" : "border-slate-200 bg-white hover:border-red-200")}>
                      <div className="min-w-0 flex-1">
                        {isUnavailable && (
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                            <span className="text-xs font-bold text-red-600 uppercase">Indisponível no estoque — item alterado ou removido do GLPI</span>
                          </div>
                        )}
                        <div className={clsx("font-bold", isUnavailable ? "text-red-400 line-through" : "text-slate-800")}>{item.tipo} {item.marca} {item.modelo}</div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-xs font-medium text-slate-500">Pat: {item.idPatrimonio}</span>
                          <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">NS: {item.numeroSerie}</span>
                          <span className="text-xs font-medium text-slate-500">{item.especificacoes.so}</span>
                        </div>
                      </div>
                      <button onClick={() => toggleCartItem(item)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 ml-2">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })}
                {cart.length === 0 && (
                  <div className="text-center p-8 text-slate-400 font-medium">Nenhum item nesta proposta. Selecione equipamentos no catálogo.</div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-slate-200 bg-slate-50 flex flex-wrap gap-3 justify-between items-center">
              <button onClick={deleteProposal} className="text-sm font-bold text-red-400 hover:text-red-600 transition-colors flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Excluir Proposta</button>
              <div className="flex items-center gap-2">
                {activeQuote.isReserved && (
                  <div className="flex items-center gap-2 mr-4 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 font-bold text-sm animate-pulse">
                    <CheckCircle className="w-5 h-5" /> Reserva Confirmada
                  </div>
                )}
                <button onClick={generateWhatsAppLink} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors shadow-sm">
                  <Send className="w-4 h-4" /> WhatsApp
                </button>
                <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-colors shadow-sm">
                  <FileText className="w-4 h-4" /> Gerar PDF
                </button>
                {!activeQuote.isReserved && (
                  <button onClick={handleReserve} disabled={isSubmitting} className={clsx("flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-sm", isSubmitting && "opacity-70 cursor-wait")}>
                    {isSubmitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Server className="w-4 h-4" />} Reservar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF PRINT TEMPLATE (Only visible on Print) */}
      {activeQuote && (
        <div className="hidden print:block p-8 bg-white text-slate-900 w-full min-h-screen relative font-sans">
          {/* Marca d'água no centro da página */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0">
            <img src={watermarkOficial} alt="" className="w-2/3 object-contain" />
          </div>

          {/* HEADER ESCURO */}
          <div className="bg-[#0f172a] rounded-xl p-6 mb-8 flex justify-between items-center text-white relative z-10 shadow-sm print:exact-colors print:bg-[#0f172a]">
            <div className="flex items-center">
              <img src={logoOficial} alt="Logo" className="h-16 object-contain" />
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-black text-blue-400 tracking-widest uppercase">Proposta Comercial</h1>
              <p className="text-xl font-bold mt-1 text-white">{activeQuote.name}</p>
              <p className="text-xs text-slate-400 mt-2">Emissão: {format(new Date(), "dd/MM/yyyy, HH:mm")}</p>
            </div>
          </div>

          {/* DADOS DO CONTRATANTE */}
          <div className="mb-6 relative z-10">
            <h2 className="text-blue-700 font-bold text-sm tracking-widest uppercase mb-2 border-l-4 border-blue-700 pl-2">Dados do Contratante</h2>
            <div className="grid grid-cols-2 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
              <div className="p-3 border-b border-slate-200 col-span-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Razão Social / Nome do Cliente</div>
                <div className="text-slate-800 font-medium text-sm">{activeQuote.clientName || "Não Informado"}</div>
              </div>
              <div className="p-3 border-r border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Condição Especial / Margem</div>
                <div className="text-slate-800 font-medium text-sm">{activeQuote.margin || "—"}</div>
              </div>
              <div className="p-3">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Validade da Proposta</div>
                <div className="text-slate-800 font-medium text-sm">
                  {activeQuote.validityDays ?? 2} {(activeQuote.validityDays ?? 2) <= 1 ? 'dia útil' : 'dias úteis'}
                </div>
              </div>
            </div>
          </div>

          {/* ITENS DA PROPOSTA */}
          <div className="mb-8 relative z-10">
            <h2 className="text-blue-700 font-bold text-sm tracking-widest uppercase mb-2 border-l-4 border-blue-700 pl-2">Itens da Proposta</h2>
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 w-1/3">Item / Equipamento</th>
                    <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 w-1/3 border-l border-slate-200">Especificações</th>
                    <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 w-1/3 border-l border-slate-200">Identificação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {cart.map((item, i) => (
                    <tr key={i}>
                      <td className="py-3 px-3 align-top">
                        <div className="font-black text-slate-800 text-sm uppercase">{item.tipo} {item.marca}</div>
                        <div className="text-slate-600 font-medium text-xs mt-0.5">{item.modelo}</div>
                      </td>
                      <td className="py-3 px-3 align-top text-[11px] text-slate-700 border-l border-slate-200">
                        <ul className="space-y-1">
                          <li><span className="font-bold text-slate-500 uppercase tracking-wide text-[9px]">Processador:</span> {item.especificacoes?.processador}</li>
                          <li><span className="font-bold text-slate-500 uppercase tracking-wide text-[9px]">Memória RAM:</span> {item.especificacoes?.ram}</li>
                          <li><span className="font-bold text-slate-500 uppercase tracking-wide text-[9px]">Armazenamento:</span> {item.especificacoes?.armazenamento}</li>
                          <li><span className="font-bold text-slate-500 uppercase tracking-wide text-[9px]">Sistema Operacional:</span> {item.especificacoes?.so}</li>
                        </ul>
                      </td>
                      <td className="py-3 px-3 align-top border-l border-slate-200">
                        <div className="mb-1.5"><span className="font-bold text-slate-500 uppercase tracking-wide text-[9px]">SÉRIE:</span> <span className="font-mono text-sm font-black text-slate-800 block mt-0.5">{item.numeroSerie}</span></div>
                        <div className="font-mono text-[11px] text-slate-600"><span className="font-bold text-slate-500 uppercase tracking-wide text-[9px] font-sans">PATRIMÔNIO:</span> {item.idPatrimonio}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FOOTER / AVISO */}
          <div className="mt-12 pt-8 relative z-10 break-inside-avoid">
            <p className="text-[11px] text-slate-500 text-center italic px-8">
              Declaro para os devidos fins que os equipamentos descritos acima compõem a proposta comercial atual. A efetivação e faturamento dependem de aprovação formal.
            </p>
          </div>

          {/* RODAPÉ ABSOLUTO */}
          <div className="fixed bottom-6 w-full left-0 px-8 flex justify-between items-center text-[9px] font-medium text-slate-400">
            <span>Documento eletrônico oficial gerado pela Micro Sistema Soluções (Micro Estoque).</span>
            <span>Página 1 de 1</span>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATIONS */}
      {toasts.length > 0 && (
        <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 print:hidden">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={clsx(
                "flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border backdrop-blur-sm min-w-[320px] max-w-[420px]",
                toast.exiting ? 'toast-exit' : 'toast-enter',
                toast.type === 'success' && "bg-emerald-50/95 border-emerald-200 text-emerald-800",
                toast.type === 'error' && "bg-red-50/95 border-red-200 text-red-800",
                toast.type === 'info' && "bg-blue-50/95 border-blue-200 text-blue-800"
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm backdrop-enter print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md modal-enter overflow-hidden">
            <div className="p-6 pb-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-black text-slate-800 text-center mb-2">{confirmDialog.title}</h3>
              <p className="text-sm text-slate-500 text-center leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="flex border-t border-slate-100">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-3.5 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors border-r border-slate-100"
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

    </div>
  );
}
