import { useState, useEffect, useMemo } from 'react';
import { Search, CheckCircle, AlertTriangle, Server, MemoryStick, HardDrive, Trash2, FileText, Send, X, LayoutDashboard, Monitor, ShoppingCart, Plus, Package } from 'lucide-react';
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
  clientName: string;
  margin: string;
}

export default function App() {
  const [data, setData] = useState<Catalogo | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Multi-Quote State
  const [quotes, setQuotes] = useState<Quote[]>([{ id: '1', name: 'Cotação 1', items: [], clientName: '', margin: '' }]);
  const [activeQuoteId, setActiveQuoteId] = useState('1');
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals
  const [activeGroup, setActiveGroup] = useState<GroupedItem | null>(null);

  const activeQuote = quotes.find(q => q.id === activeQuoteId) || quotes[0];
  const cart = activeQuote.items;

  const updateQuote = (id: string, patch: Partial<Quote>) => {
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
  };

  const addNewQuote = () => {
    const id = Date.now().toString();
    const name = `Cotação ${quotes.length + 1}`;
    setQuotes(prev => [...prev, { id, name, items: [], clientName: '', margin: '' }]);
    setActiveQuoteId(id);
  };

  const removeQuote = (id: string) => {
    if (quotes.length === 1) return;
    const remaining = quotes.filter(q => q.id !== id);
    setQuotes(remaining);
    setActiveQuoteId(remaining[0].id);
  };

  useEffect(() => {
    const fetchCatalogo = async () => {
      try {
        const response = await fetch(`/catalogo.json?t=${new Date().getTime()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Falha ao carregar o catálogo.');
        const json = await response.json();
        const parsedData = Array.isArray(json) ? json[0] : json;
        setData(parsedData);
      } catch (err: any) {
        console.error(err.message || 'Erro desconhecido ao carregar dados.');
      } finally {
        setLoading(false);
      }
    };
    fetchCatalogo();
  }, []);

  const searchedEstoque = useMemo(() => {
    if (!data?.estoque) return [];
    if (!search.trim()) return data.estoque;

    const fuse = new Fuse(data.estoque, {
      keys: [
        'modelo',
        'marca',
        'tipo',
        'numeroSerie',
        'idPatrimonio',
        'especificacoes.processador',
        'especificacoes.ram',
        'especificacoes.armazenamento',
        'especificacoes.so'
      ],
      threshold: 0.3,
      ignoreLocation: true
    });

    return fuse.search(search).map(result => result.item);
  }, [data, search]);

  const filteredEstoque = useMemo(() => {
    if (!statusFilter) return searchedEstoque;
    return searchedEstoque.filter(item => {
      const s = item.status?.toUpperCase() || '';
      if (statusFilter === 'NOVO') return s.includes('NOVO');
      if (statusFilter === 'USADO') return s.includes('USADO');
      return true;
    });
  }, [searchedEstoque, statusFilter]);

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

    return Object.values(groups).sort((a, b) => b.items.length - a.items.length);
  }, [filteredEstoque]);

  const toggleCartItem = (item: Equipamento) => {
    const exists = cart.some(c => c.idPatrimonio === item.idPatrimonio);
    const newItems = exists
      ? cart.filter(c => c.idPatrimonio !== item.idPatrimonio)
      : [...cart, item];
    updateQuote(activeQuoteId, { items: newItems });
  };

  const clearCart = () => {
    if (confirm('Tem certeza que deseja limpar toda a cotação?')) updateQuote(activeQuoteId, { items: [] });
  };

  const generateWhatsAppLink = () => {
    const { clientName, margin } = activeQuote;
    let text = `*Orçamento de Equipamentos*\nCliente: ${clientName || 'Não informado'}\n\n`;
    if (margin) text += `Condição/Margem: ${margin}\n\n`;
    
    cart.forEach(item => {
      text += `💻 *${item.tipo} ${item.marca} ${item.modelo}*\n`;
      text += `Proc: ${item.especificacoes?.processador} | RAM: ${item.especificacoes?.ram}\n`;
      text += `Armaz: ${item.especificacoes?.armazenamento} | SO: ${item.especificacoes?.so}\n`;
      text += `Série: ${item.numeroSerie} | Pat: ${item.idPatrimonio}\n\n`;
    });
    
    text += `_Gerado via Catálogo Comercial_`;
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleReserve = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
      // const response = await fetch('YOUR_N8N_WEBHOOK_URL', { ... });
      await new Promise(resolve => setTimeout(resolve, 1500));
      alert('Reserva solicitada com sucesso ao n8n!');
      updateQuote(activeQuoteId, { items: [] });
      setIsQuoteModalOpen(false);
    } catch (err) {
      alert('Erro ao comunicar com n8n. Verifique o webhook.');
    } finally {
      setIsSubmitting(false);
    }
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
    <div className="h-screen w-full flex bg-slate-50 overflow-hidden font-sans">
      
      {/* SIDEBAR (Dark Theme #0B1120) */}
      <aside className="w-64 bg-[#0B1120] text-slate-300 flex-shrink-0 flex-col hidden md:flex print:hidden relative overflow-hidden">
        {/* Subtle glow effect behind logo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/10 blur-[50px] rounded-full pointer-events-none"></div>
        
        <div className="p-6 pb-2 border-b border-slate-800/50 flex flex-col items-center">
          <img src={logoOficial} alt="Logo" className="h-12 w-auto object-contain mb-4 filter drop-shadow-md" />
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 custom-scrollbar">
          <div className="px-3 mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Menu Principal</div>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 bg-indigo-600/10 text-indigo-400 rounded-xl font-medium transition-colors border border-indigo-500/20 shadow-sm">
            <LayoutDashboard className="w-5 h-5" />
            Catálogo Comercial
          </button>
          
          <div className="px-3 mt-8 mb-1 flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Minhas Cotações</span>
            <button onClick={addNewQuote} className="text-slate-500 hover:text-indigo-400 transition-colors" title="Nova cotação">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          {quotes.map(q => (
            <button
              key={q.id}
              onClick={() => { setActiveQuoteId(q.id); if (q.items.length > 0) setIsQuoteModalOpen(true); }}
              className={clsx(
                "w-full flex justify-between items-center px-3 py-2.5 rounded-xl font-medium transition-colors group text-left",
                q.id === activeQuoteId
                  ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20"
                  : "hover:bg-slate-800/50 text-slate-400 hover:text-slate-200"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <ShoppingCart className="w-4 h-4 shrink-0" />
                <span className="truncate text-sm">{q.name}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {q.items.length > 0 && (
                  <span className="bg-amber-500 text-amber-950 text-xs font-bold px-1.5 py-0.5 rounded">
                    {q.items.length}
                  </span>
                )}
                {quotes.length > 1 && (
                  <span
                    onClick={(e) => { e.stopPropagation(); removeQuote(q.id); }}
                    className="text-slate-600 hover:text-red-400 transition-colors ml-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </button>
          ))}
        </nav>
        
        <div className="p-4 border-t border-slate-800/50">
           <div className="text-[10px] text-center text-slate-500 uppercase tracking-widest mb-2 font-bold">Status do Estoque</div>
           <div className={clsx(
              "w-full px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-xs font-bold shadow-inner border",
              statusCritico 
                ? "bg-amber-900/30 text-amber-400 border-amber-900/50" 
                : "bg-emerald-900/30 text-emerald-400 border-emerald-900/50"
            )}>
              {statusCritico ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
              <span>{format(ultimaAtualizacao, "dd/MM HH:mm")}</span>
            </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden print:hidden relative">
        {/* Top Header */}
        <header className="bg-white px-8 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-10 border-b border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Painel Operacional</h1>
            <p className="text-sm text-slate-500 font-medium">Visão geral do catálogo • {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
          </div>
          
          <div className="relative w-full md:w-96 group">
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
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#f8fafc]">
          
          {/* Summary Cards / Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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

            <button
              onClick={() => { if (cart.length > 0) setIsQuoteModalOpen(true); }}
              className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:border-emerald-300 text-left flex flex-col justify-between transition-all"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">No Carrinho</span>
                <ShoppingCart className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-3xl font-black text-emerald-600">{cart.length}</div>
              <div className="text-xs text-slate-400 mt-1">{cart.length > 0 ? 'clique para ver proposta' : 'nenhum selecionado'}</div>
            </button>
          </div>

          {statusFilter && (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm text-slate-600 font-medium">Filtrando por:</span>
              <span className={clsx("text-xs font-bold px-3 py-1 rounded-full border", statusFilter === 'NOVO' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200")}>{statusFilter}</span>
              <button onClick={() => setStatusFilter(null)} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"><X className="w-3 h-3"/> limpar filtro</button>
            </div>
          )}

          <h2 className="text-lg font-bold text-slate-800 mb-4">
            {groupedEstoque.length} agrupamento{groupedEstoque.length !== 1 ? 's' : ''}
          </h2>

          {groupedEstoque.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-12 text-center shadow-sm">
              <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 text-lg font-medium">Nenhum equipamento encontrado.</p>
            </div>
          ) : (
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
                      <span className="text-[10px] font-black text-indigo-600/60 uppercase tracking-widest mb-1 mt-2 block">{group.tipo} • {group.marca}</span>
                      <h3 className="text-base font-black text-slate-800 leading-tight group-hover/card:text-indigo-600 transition-colors">
                        {group.modelo}
                      </h3>

                      <div className="mt-4 space-y-2 text-xs font-medium text-slate-600">
                        <div className="flex items-center gap-2"><MemoryStick className="w-3.5 h-3.5 text-slate-400 shrink-0"/> <span className="truncate">{group.processador}</span></div>
                        <div className="flex items-center gap-2"><HardDrive className="w-3.5 h-3.5 text-slate-400 shrink-0"/> <span className="truncate">{group.ram} | {group.armazenamento}</span></div>
                        <div className="flex items-center gap-2"><Monitor className="w-3.5 h-3.5 text-slate-400 shrink-0"/> <span className="truncate">{group.so}</span></div>
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
          )}
        </div>
      </main>


      {/* MODAL DE SELEÇÃO DE MÁQUINAS (ACTIVE GROUP) */}
      {activeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50 relative">
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>
               <div>
                  <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">{activeGroup.tipo} • {activeGroup.marca}</div>
                  <h2 className="text-2xl font-black text-slate-800">{activeGroup.modelo}</h2>
                  <div className="flex gap-4 mt-3 text-sm font-medium text-slate-600">
                    <span className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm"><MemoryStick className="w-3.5 h-3.5 text-slate-400" /> {activeGroup.processador}</span>
                    <span className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm"><HardDrive className="w-3.5 h-3.5 text-slate-400" /> {activeGroup.ram} | {activeGroup.armazenamento}</span>
                  </div>
               </div>
               <button onClick={() => setActiveGroup(null)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm border border-slate-200 transition-colors z-10">
                 <X className="w-5 h-5" />
               </button>
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
                    const isSelected = cart.some(c => c.idPatrimonio === item.idPatrimonio);
                    return (
                      <tr 
                        key={item.idPatrimonio} 
                        className={clsx("transition-colors hover:bg-slate-50 cursor-pointer", isSelected ? "bg-indigo-50/50" : "")}
                        onClick={() => toggleCartItem(item)}
                      >
                        <td className="py-4 px-6">
                           <input 
                              type="checkbox" 
                              className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer pointer-events-none"
                              checked={isSelected}
                              readOnly
                            />
                        </td>
                        <td className="py-4 px-6 font-bold text-slate-800">{item.idPatrimonio}</td>
                        <td className="py-4 px-6 font-mono text-sm text-slate-600">{item.numeroSerie}</td>
                        <td className="py-4 px-6 text-sm font-medium text-slate-600">{item.especificacoes.so || 'N/A'}</td>
                        <td className="py-4 px-6">
                           <span className={clsx("text-[10px] font-bold px-2.5 py-1 rounded-full border", 
                              item.status?.includes('NOVO') ? "bg-blue-50 text-blue-700 border-blue-200" :
                              item.status?.includes('DISPONIVEL') ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              "bg-slate-100 text-slate-600 border-slate-200"
                            )}>
                              {item.status?.replace('DISPONIVEL', '').trim() || item.status}
                            </span>
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
      )}

      {/* QUOTE MODAL */}
      {isQuoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
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
                <ShoppingCart className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-bold text-slate-700">{activeQuote.name}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Cliente / Empresa</label>
                  <input type="text" value={activeQuote.clientName} onChange={e => updateQuote(activeQuoteId, { clientName: e.target.value })} className="w-full border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800" placeholder="Ex: Acme Corp" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Margem / Condição</label>
                  <input type="text" value={activeQuote.margin} onChange={e => updateQuote(activeQuoteId, { margin: e.target.value })} className="w-full border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800" placeholder="Ex: 10% de desconto à vista" />
                </div>
              </div>

              <div className="flex justify-between items-end mb-3">
                 <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Itens da Cotação</h3>
                 <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded-md">{cart.length} selecionados</span>
              </div>
              
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.idPatrimonio} className="flex justify-between items-center p-4 border border-slate-200 rounded-xl bg-white shadow-sm hover:border-red-200 transition-colors group">
                    <div>
                      <div className="font-bold text-slate-800">{item.tipo} {item.marca} {item.modelo}</div>
                      <div className="text-xs font-medium text-slate-500 mt-1">Pat: {item.idPatrimonio} | NS: {item.numeroSerie} | {item.especificacoes.so}</div>
                    </div>
                    <button onClick={() => toggleCartItem(item)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                {cart.length === 0 && (
                   <div className="text-center p-8 text-slate-400 font-medium">Você esvaziou a cotação.</div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-slate-200 bg-slate-50 flex flex-wrap gap-3 justify-between items-center">
               <button onClick={clearCart} className="text-sm font-bold text-slate-400 hover:text-red-500 transition-colors">Esvaziar Cotação</button>
               <div className="flex gap-2">
                  <button onClick={generateWhatsAppLink} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors shadow-sm">
                    <Send className="w-4 h-4" /> WhatsApp
                  </button>
                  <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-colors shadow-sm">
                    <FileText className="w-4 h-4" /> PDF
                  </button>
                  <button onClick={handleReserve} disabled={isSubmitting || cart.length === 0} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-sm disabled:opacity-50">
                    {isSubmitting ? 'Reservando...' : 'Reservar'}
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF PRINT TEMPLATE (Only visible on Print) */}
      <div className="hidden print:block p-8 bg-white text-slate-900 w-full relative h-screen">
        {/* Marca d'água no centro da página */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0">
           <img src={watermarkOficial} alt="" className="w-1/2 object-contain" />
        </div>
        
        <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-6 mb-8 relative z-10">
          <div>
            <h1 className="text-3xl font-black text-indigo-700 tracking-tight uppercase">Proposta Comercial</h1>
            <p className="text-slate-500 mt-1 font-medium">Data: {format(new Date(), "dd/MM/yyyy")}</p>
          </div>
          <div className="text-right flex flex-col items-end">
             <img src={logoOficial} alt="Logo" className="h-14 object-contain mb-2" />
             <p className="font-bold text-slate-800 text-xs">OS Digital - Operações</p>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-8 relative z-10">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Para</h3>
            <p className="text-xl font-black text-slate-800">{activeQuote.clientName || "Cliente"}</p>
          </div>
          {activeQuote.margin && (
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Condição Especial</h3>
              <p className="text-lg font-bold text-slate-700">{activeQuote.margin}</p>
            </div>
          )}
        </div>

        <table className="w-full text-left border-collapse mt-8 relative z-10">
          <thead>
            <tr className="border-b-2 border-slate-800">
              <th className="py-3 px-2 text-xs font-bold uppercase tracking-wider text-slate-600">Item</th>
              <th className="py-3 px-2 text-xs font-bold uppercase tracking-wider text-slate-600">Descrição Técnica</th>
              <th className="py-3 px-2 text-xs font-bold uppercase tracking-wider text-slate-600">Identificação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {cart.map((item, i) => (
              <tr key={i}>
                <td className="py-4 px-2 align-top">
                  <div className="font-black text-slate-800">{item.tipo} {item.marca}</div>
                  <div className="text-slate-600 font-medium">{item.modelo}</div>
                </td>
                <td className="py-4 px-2 align-top text-xs text-slate-600 font-medium">
                  <ul className="list-disc pl-4 space-y-1">
                    <li><span className="font-bold text-slate-800">Processador:</span> {item.especificacoes?.processador}</li>
                    <li><span className="font-bold text-slate-800">Memória/Armazenamento:</span> {item.especificacoes?.ram} | {item.especificacoes?.armazenamento}</li>
                    <li><span className="font-bold text-slate-800">Sist. Operacional:</span> {item.especificacoes?.so}</li>
                  </ul>
                </td>
                <td className="py-4 px-2 align-top">
                  <div className="font-mono text-xs mb-1"><span className="font-bold text-slate-500 font-sans">SÉRIE:</span> {item.numeroSerie}</div>
                  <div className="font-mono text-xs"><span className="font-bold text-slate-500 font-sans">PAT:</span> {item.idPatrimonio}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="absolute bottom-10 w-full text-center text-xs font-bold text-slate-400 border-t border-slate-200 pt-6">
          Documento gerado eletronicamente. Validade da proposta: 5 dias úteis.
        </div>
      </div>

    </div>
  );
}
