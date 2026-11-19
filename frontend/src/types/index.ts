// ─────────────────────────────────────────────────────────────────────────────
// Fonte única de verdade para todos os tipos do sistema Lummium
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
  id?: string;
  is_reserved?: boolean;
  is_available?: boolean;
  is_active?: boolean;
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
  tela?: string;
  available_count?: number;
  reserved_count?: number;
  novos: number;
  usados: number;
  items: Equipamento[];
}

export interface QuoteOperation {
  id: string; quote_id: string; action: 'reserve' | 'cancel'; status: string;
  parent_id?: string | null; actor_id: string; attempts: number; message: string;
  created_at: string; updated_at: string; next_check_at?: string | null;
  items: { equipment_id: string; id_glpi: string; serial: string; status: string; message: string }[];
  events?: { kind: string; actor: string; status: string; created_at: string }[];
}
export interface Quote {
  operation?: QuoteOperation | null;
  status?: 'DRAFT' | 'RESERVED' | 'CANCELED' | 'EXPIRED' | 'WON';
  id: string; // ID local (UUID)
  backendId?: string; // ID do banco de dados (FastAPI)
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
