import { generateSlots, isDateBookable } from './slots';

describe('generateSlots', () => {
  it('generates hourly slots from 09:00 to end time (exclusive)', () => {
    expect(generateSlots('21:00')).toEqual([
      '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
      '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
    ]);
  });
  it('respects a custom earlier end time', () => {
    expect(generateSlots('12:00')).toEqual(['09:00', '10:00', '11:00']);
  });
});

describe('isDateBookable', () => {
  const today = new Date('2026-08-19T10:00:00');
  it('blocks today', () => {
    expect(isDateBookable(new Date('2026-08-19T00:00:00'), today)).toBe(false);
  });
  it('blocks past days', () => {
    expect(isDateBookable(new Date('2026-08-18T00:00:00'), today)).toBe(false);
  });
  it('allows future days', () => {
    expect(isDateBookable(new Date('2026-08-20T00:00:00'), today)).toBe(true);
  });
});
