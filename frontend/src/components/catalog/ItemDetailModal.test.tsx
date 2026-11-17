import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ItemDetailModal } from './ItemDetailModal';
import { ItemCard } from './ItemCard';
import type { Equipamento, GroupedItem } from '../../types';

const item: Equipamento = {
  id: 'available', idPatrimonio: 'PAT-1', idGlpi: '1', numeroSerie: 'SN-1',
  tipo: 'NOTEBOOK', marca: 'DELL', modelo: 'Latitude', status: 'DISPONIVEL NOVO',
  fornecedor: '', especificacoes: { processador: 'i5', ram: '16GB', armazenamento: '512GB' },
  is_reserved: false, is_available: true,
};
const reserved: Equipamento = { ...item, id: 'reserved', idPatrimonio: 'PAT-2', numeroSerie: 'SN-2', is_reserved: true, is_available: false };
const group: GroupedItem = {
  key: 'test', modelo: 'Latitude', marca: 'DELL', tipo: 'NOTEBOOK', processador: 'i5',
  ram: '16GB', armazenamento: '512GB', so: 'Windows 11', novos: 1, usados: 0, items: [item, reserved],
};

describe('Disponibilidade no catálogo', () => {
  it('mostra somente a unidade livre como disponível no cartão', () => {
    render(<ItemCard group={group} cartCount={0} onClick={vi.fn()} />);
    expect(screen.getByText('1 unid.')).toBeInTheDocument();
    expect(screen.getByText('1 reservada')).toBeInTheDocument();
    expect(screen.getByText('Última Unidade')).toBeInTheDocument();
  });

  it('bloqueia a unidade reservada e selecionar todos inclui apenas a livre', () => {
    const onUpdateItems = vi.fn();
    const onToggleItem = vi.fn();
    render(<ItemDetailModal group={group} cart={[]} onClose={vi.fn()} onToggleItem={onToggleItem} onUpdateItems={onUpdateItems} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).not.toBeDisabled();
    expect(checkboxes[1]).toBeDisabled();
    fireEvent.click(screen.getByText('PAT-2'));
    expect(onToggleItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar Todos' }));
    expect(onUpdateItems).toHaveBeenCalledWith([item]);
  });
});
