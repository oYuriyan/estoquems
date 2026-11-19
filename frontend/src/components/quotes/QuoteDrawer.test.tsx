import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Equipamento, Quote } from '../../types';
import { QuoteDrawer } from './QuoteDrawer';

const item: Equipamento = {
  id: 'item-1', idPatrimonio: 'TEST-1', idGlpi: '1', numeroSerie: 'SN-1',
  tipo: 'NOTEBOOK', marca: 'DELL', modelo: 'Test', status: 'DISPONIVEL NOVO', fornecedor: '',
  especificacoes: { processador: 'i5', ram: '16GB', armazenamento: '512GB' },
};
const quote: Quote = { id: 'quote-1', name: 'Proposta de teste', status: 'DRAFT', items: [item] };

function props() {
  return {
    quote, cart: [item], quoteStep: 3 as const, isSubmitting: false, isGeneratingPdf: false,
    unavailableIds: new Set<string>(), reservationBlockReason: null as string | null,
    onClose: vi.fn(), onStepChange: vi.fn(), onUpdateQuote: vi.fn(), onRemoveItem: vi.fn(),
    onDelete: vi.fn(), onReserve: vi.fn(), onCancelReserve: vi.fn(), onPrint: vi.fn(), onWhatsApp: vi.fn(),
  };
}

describe('Proteção da reserva na proposta', () => {
  it('explica o bloqueio por inventário antigo e mantém a exportação da proposta', () => {
    const p = { ...props(), reservationBlockReason: 'O inventário está desatualizado.' };
    render(<QuoteDrawer {...p} />);
    expect(screen.getByRole('status')).toHaveTextContent('Você pode continuar preparando a proposta');
    const reserve = screen.getByRole('button', { name: 'Reservar Equipamentos' });
    expect(reserve).toBeDisabled();
    fireEvent.click(reserve);
    expect(p.onReserve).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Gerar PDF' })).toBeEnabled();
  });
  it('permite confirmar quando o inventário está validado', () => {
    const p = props();
    render(<QuoteDrawer {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reservar Equipamentos' }));
    expect(p.onReserve).toHaveBeenCalledOnce();
  });
  it('mantém cancelamento disponível quando uma reserva já existe', () => {
    const p = { ...props(), quote: { ...quote, isReserved: true, status: 'RESERVED' as const }, reservationBlockReason: 'Inventário antigo.' };
    render(<QuoteDrawer {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar Reserva' }));
    expect(p.onCancelReserve).toHaveBeenCalledOnce();
  });
});

it('proposta pendente não oferece reserva comum nem aparece como encerrada', () => {
  const p=props();
  const operation={id:'pending-test',quote_id:quote.id,actor_id:'test',action:'reserve' as const,status:'PENDING',attempts:1,message:'Aguardando conferência.',created_at:'2026-11-19T12:00:00Z',updated_at:'2026-11-19T12:00:00Z',items:[]};
  render(<QuoteDrawer {...p} quote={{...quote,operation}} />);
  expect(screen.queryByText('Reservar Equipamentos')).not.toBeInTheDocument();
  expect(screen.queryByText(/Esta proposta está encerrada/)).not.toBeInTheDocument();
  expect(screen.getByText('Conferir no GLPI')).toBeInTheDocument();
});

it('itens da própria reserva confirmada não aparecem como indisponíveis', () => {
  const p={...props(),quote:{...quote,isReserved:true,status:'RESERVED' as const},unavailableIds:new Set([item.idPatrimonio])};
  render(<QuoteDrawer {...p}/>);
  expect(screen.queryByText('INDISPONÍVEL')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Cancelar Reserva'})).toBeEnabled();
  expect(screen.getByRole('button',{name:'Fechar proposta'})).toBeEnabled();
});
