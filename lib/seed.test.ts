import { seedUsers, seedCourts, defaultSettings } from './seed';

describe('seed data', () => {
  it('has exactly Koen (coach), Mathis (player), Test (player)', () => {
    expect(seedUsers.map((u) => [u.name, u.role])).toEqual([
      ['Koen', 'coach'],
      ['Mathis', 'player'],
      ['Test', 'player'],
    ]);
  });
  it('has at least one court with an hourly rate', () => {
    expect(seedCourts.length).toBeGreaterThan(0);
    expect(seedCourts[0].hourly_rate).toBeGreaterThan(0);
  });
  it('default booking end time is 21:00', () => {
    expect(defaultSettings.booking_end_time).toBe('21:00');
  });
});
