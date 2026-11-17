import type { Equipamento, GroupedItem } from '../types';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

export function isEquipmentReserved(item: Equipamento): boolean {
  return item.is_reserved === true || /\b(RESERVADO|RESERVED)\b/.test(normalize(item.status || ''));
}

export function isEquipmentAvailable(item: Equipamento): boolean {
  if (item.is_active === false || isEquipmentReserved(item)) return false;
  if (item.is_available === false) return false;
  const status = normalize(item.status || '').trim().replace(/\s+/g, ' ');
  return ['DISPONIVEL NOVO', 'DISPONIVEL USADO'].includes(status);
}

export const availableCount = (group: GroupedItem) => group.items.filter(isEquipmentAvailable).length;
export const reservedCount = (group: GroupedItem) => group.items.filter(isEquipmentReserved).length;

export function mapEquipment(item: Equipamento & { id_patrimonio?: string; numero_serie?: string; id_glpi?: string }): Equipamento {
  return {
    ...item,
    idPatrimonio: item.idPatrimonio || item.id_patrimonio || '',
    numeroSerie: item.numeroSerie || item.numero_serie || '',
    idGlpi: item.idGlpi || item.id_glpi || '',
  };
}
