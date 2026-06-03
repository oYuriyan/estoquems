// ─────────────────────────────────────────────────────────────────────────────
// Fonte única de verdade para todos os tipos do sistema Micro Estoque
// Importar sempre daqui — nunca redefinir em outros arquivos
// ─────────────────────────────────────────────────────────────────────────────

export interface Especificacoes {
  processador: string;
  ram: string;
  armazenamento: string;
  tela?: string;
  so?: string;
}

export interface Equipamento {
  idPatrimonio: string;
  idGlpi: string;
  numeroSerie: string;
  tipo: string;
  marca: string;
  modelo: string;
  status: string;
  fornecedor: string;
  especificacoes: Especificacoes;
  clienteAlocado?: string;
  ordemServico?: string;
  dataExpiracao?: string | null;
}

export interface Metadados {
  ultimaAtualizacao: string;
  totalItens: number;
}

export interface Catalogo {
  metadados: Metadados;
  estoque: Equipamento[];
}

export interface GroupedItem {
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

export interface Quote {
  id: string;
  name: string;
  items: Equipamento[];
  clientName?: string;
  margin?: string;
  validityDays?: number;
  isReserved?: boolean;
  reservedAt?: string; // ISO timestamp when reservation was made
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  exiting?: boolean;
}

export interface ConfirmDialog {
  title: string;
  message: string;
  onConfirm: () => void;
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}
