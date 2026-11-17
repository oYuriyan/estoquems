import { describe, expect, it } from 'vitest';
import type { Equipamento } from '../types';
import { isEquipmentAvailable } from './equipment';

const equipment = (status: string, flags: Partial<Equipamento> = {}): Equipamento => ({
  idPatrimonio: 'TEST', idGlpi: '1', numeroSerie: 'SN', tipo: 'NOTEBOOK',
  marca: 'DELL', modelo: 'Test', fornecedor: '', especificacoes: {
    processador: 'i5', ram: '16GB', armazenamento: '256GB', so: 'Linux',
  }, status, ...flags,
});

describe('Disponibilidade segura do catálogo', () => {
  it.each(['', 'USADO', 'NOVO', 'DESCONHECIDO', 'AGUARDANDO TRIAGEM',
    'LOCADO', 'VENDIDO', 'RMA', 'DISPONIVEL', 'DISPONIVEL SEMINOVO',
    'NÃO DISPONÍVEL', 'DISPONIVEL EM MANUTENCAO', 'RESERVADO NOVO'])('bloqueia estado sem confirmação: %s', (status) => {
    expect(isEquipmentAvailable(equipment(status))).toBe(false);
    expect(isEquipmentAvailable(equipment(status, { is_available: true }))).toBe(false);
  });

  it.each(['DISPONIVEL NOVO', 'DISPONIVEL USADO',
    ' disponível  usado '])('aceita estado reconhecido: %s', (status) => {
    expect(isEquipmentAvailable(equipment(status))).toBe(true);
  });

  it('respeita bloqueios locais e a indisponibilidade retornada pela API', () => {
    expect(isEquipmentAvailable(equipment('DISPONIVEL NOVO', { is_available: false }))).toBe(false);
    expect(isEquipmentAvailable(equipment('DISPONIVEL NOVO', { is_available: true, is_reserved: true }))).toBe(false);
    expect(isEquipmentAvailable(equipment('DISPONIVEL NOVO', { is_available: true, is_active: false }))).toBe(false);
  });
});
