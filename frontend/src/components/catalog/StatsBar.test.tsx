import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { StatsBar } from './StatsBar';

const base = { totalItems: 2, totalNovos: 2, totalUsados: 0, totalReserved: 0, statusFilter: null, onFilterChange: vi.fn() };

it('nao promete unidades livres para reservar quando o inventario esta bloqueado', () => {
  render(<StatsBar {...base} inventoryBlocked />);
  expect(screen.getByText('Saldo consultado')).toBeInTheDocument();
  expect(screen.getByText('aguardando inventário validado')).toBeInTheDocument();
  expect(screen.queryByText('livres para reservar')).not.toBeInTheDocument();
});

it('apresenta o saldo como disponivel quando a origem foi validada', () => {
  render(<StatsBar {...base} inventoryBlocked={false} />);
  expect(screen.getByText('Disponíveis')).toBeInTheDocument();
  expect(screen.getByText('livres para reservar')).toBeInTheDocument();
});
