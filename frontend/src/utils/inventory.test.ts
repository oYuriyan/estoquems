import { describe, expect, it } from 'vitest';
import { getReservationBlockReason } from './inventory';

describe('Atualidade do inventário para reserva', () => {
  const now = Date.parse('2026-11-17T12:00:00Z');
  it('bloqueia resposta antiga de API ou inventário ainda não validado', () => {
    expect(getReservationBlockReason(undefined, now)).toContain('ainda não foi validado');
    expect(getReservationBlockReason({ reservationAllowed: false, reservationBlockReason: 'Atualize a origem.' }, now)).toBe('Atualize a origem.');
  });
  it('exige autorização explícita e prazo válido do servidor', () => {
    expect(getReservationBlockReason({ reservationAllowed: true }, now)).toContain('Não foi possível confirmar');
    expect(getReservationBlockReason({ reservationAllowed: true, inventoryFreshUntil: 'invalid' }, now)).not.toBeNull();
  });
  it('bloqueia quando o prazo termina mesmo sem uma nova consulta', () => {
    const metadata = { reservationAllowed: true, inventoryFreshUntil: '2026-11-17T12:00:00Z' };
    expect(getReservationBlockReason(metadata, now)).toBeNull();
    expect(getReservationBlockReason(metadata, now + 1)).toContain('desatualizado');
  });
});
