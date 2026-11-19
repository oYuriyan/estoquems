import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { OperationPanel } from './OperationPanel';
import { apiFetch } from '../../utils/api';
import type { QuoteOperation } from '../../types';
vi.mock('../../utils/api', () => ({apiFetch:vi.fn()}));
const operation: QuoteOperation = {
 id:'operation-test',quote_id:'quote-test',actor_id:'actor-test',action:'reserve',status:'PARTIAL',
 message:'Alguns itens aguardam conferência.',attempts:1,created_at:'2026-11-19T12:00:00Z',updated_at:'2026-11-19T12:00:00Z',
 items:[{equipment_id:'a',id_glpi:'1',serial:'TESTE1',status:'confirmed',message:'Confirmado'},
 {equipment_id:'b',id_glpi:'2',serial:'TESTE2',status:'pending',message:'Pendente'}],
};
beforeEach(() => {vi.clearAllMocks();vi.mocked(apiFetch).mockResolvedValue({ok:true,json:async()=>[{...operation,events:[{kind:'created',actor:'Vendedor de teste',status:'PENDING',created_at:operation.created_at}]}]} as Response);});
it('explica confirmação parcial e oferece ações explícitas por proposta', async()=>{
 const reconcile=vi.fn(),retry=vi.fn(),reverse=vi.fn();
 render(<OperationPanel quoteId="quote-test" operation={operation} isSubmitting={false} onReconcile={reconcile} onRetry={retry} onReverse={reverse}/>);
 expect(screen.getByText('Confirmação parcial')).toBeInTheDocument();
 expect(screen.getByText('TESTE1')).toBeInTheDocument();expect(screen.getByText('TESTE2')).toBeInTheDocument();
 fireEvent.click(screen.getByText('Conferir no GLPI'));fireEvent.click(screen.getByText('Tentar concluir'));fireEvent.click(screen.getByText('Desfazer reserva parcial'));
 expect(reconcile).toHaveBeenCalledOnce();expect(retry).toHaveBeenCalledOnce();expect(reverse).toHaveBeenCalledOnce();
 await waitFor(()=>expect(screen.getByText(/Vendedor de teste/)).toBeInTheDocument());
});
it('cancelamento pendente oferece conclusão sem desfazer novamente a liberação', async()=>{
 render(<OperationPanel quoteId="quote-test" operation={{...operation,action:'cancel'}} isSubmitting={true} onRetry={vi.fn()}/>);
 expect(screen.queryByText('Desfazer reserva parcial')).not.toBeInTheDocument();
 expect(screen.getByText('Tentar concluir')).toBeDisabled();
 await waitFor(()=>expect(apiFetch).toHaveBeenCalled());
});
