export interface InventoryReservationMetadata {
  reservationAllowed?: boolean;
  reservationBlockReason?: string;
  inventoryFreshUntil?: string;
}

export function getReservationBlockReason(metadata?: InventoryReservationMetadata, now = Date.now()): string | null {
  if (metadata?.reservationAllowed !== true) {
    return metadata?.reservationBlockReason || 'O inventário ainda não foi validado. Atualize e sincronize o estoque antes de reservar.';
  }
  const freshUntil = Date.parse(metadata.inventoryFreshUntil || '');
  if (!Number.isFinite(freshUntil)) {
    return 'Não foi possível confirmar a atualidade do inventário. Consulte o catálogo novamente antes de reservar.';
  }
  if (now > freshUntil) {
    return 'O inventário está desatualizado. Atualize e sincronize o estoque antes de reservar.';
  }
  return null;
}
