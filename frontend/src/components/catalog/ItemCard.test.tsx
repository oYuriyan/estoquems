import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ItemCard } from './ItemCard';

describe('ItemCard Component', () => {
  const mockGroup = {
    key: 'DELL-OPTIPLEX',
    marca: 'DELL',
    modelo: 'OPTIPLEX 3020',
    tipo: 'DESKTOP',
    processador: 'CORE I5',
    ram: '8GB',
    armazenamento: '256GB SSD',
    so: 'WINDOWS 10',
    items: [
      {
        id: '1',
        idPatrimonio: 'PAT-001',
        idGlpi: 'GLPI-001',
        numeroSerie: 'SN001',
        tipo: 'DESKTOP',
        marca: 'DELL',
        modelo: 'OPTIPLEX',
        status: 'USADO',
        isReserved: false,
        isActive: true,
      }
    ]
  };

  it('renders group information correctly', () => {
    render(<ItemCard group={mockGroup} cartCount={0} onClick={() => {}} />);
    
    expect(screen.getByText('OPTIPLEX 3020')).toBeInTheDocument();
    expect(screen.getByText('CORE I5')).toBeInTheDocument();
    expect(screen.getByText('8GB')).toBeInTheDocument();
  });

  it('displays scarce badge when there is only 1 item', () => {
    render(<ItemCard group={mockGroup} cartCount={0} onClick={() => {}} />);
    expect(screen.getByText('Última Unidade')).toBeInTheDocument();
  });

  it('shows cart count when cartCount > 0', () => {
    render(<ItemCard group={mockGroup} cartCount={2} onClick={() => {}} />);
    expect(screen.getByText('2 na cotação')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<ItemCard group={mockGroup} cartCount={0} onClick={handleClick} />);
    
    fireEvent.click(screen.getByText('OPTIPLEX 3020'));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(mockGroup);
  });
});
