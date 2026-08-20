import {
  seedUsers, seedCourts, seedBookings, seedLessons, seedProgress, defaultSettings,
} from './seed';
import { coachesForPlayer } from './relations';
import { pendingPaymentsFor, rateForGroup } from './payments';

describe('seed data', () => {
  it('has two coaches and two players', () => {
    expect(seedUsers.map((u) => [u.name, u.role])).toEqual([
      ['Koen', 'coach'],
      ['Sanne', 'coach'],
      ['Mathis', 'player'],
      ['Test', 'player'],
    ]);
  });

  // The demo data has to show what the app now does: one player, two coaches.
  it('gives Mathis both coaches, through bookings, lessons and progress', () => {
    expect(coachesForPlayer('u-mathis', seedBookings, seedLessons, seedProgress).sort())
      .toEqual(['u-koen', 'u-sanne']);
    expect(seedLessons.filter((l) => l.student_id === 'u-mathis').map((l) => l.coach_id).sort())
      .toEqual(['u-koen', 'u-sanne']);
    expect(seedProgress.filter((p) => p.student_id === 'u-mathis').map((p) => p.coach_id).sort())
      .toEqual(['u-koen', 'u-sanne']);
  });

  it('gives each coach their own money to handle', () => {
    for (const coach of ['u-koen', 'u-sanne']) {
      const user = seedUsers.find((u) => u.id === coach)!;
      const mine = pendingPaymentsFor(user, seedBookings);
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.every((b) => b.coach_id === coach)).toBe(true);
    }
  });
  it('has at least one court with an hourly rate', () => {
    expect(seedCourts.length).toBeGreaterThan(0);
    expect(seedCourts[0].hourly_rate).toBeGreaterThan(0);
  });

  // Zonder tarief toont het rapport overal € 0,00 met "Uurtarief nog niet ingesteld" — correct,
  // maar de app oogt daardoor leeg bij het eerste gebruik.
  it('gives every coach an hourly rate of their own, different from the court rate', () => {
    const coaches = seedUsers.filter((u) => u.role === 'coach');
    for (const c of coaches) {
      expect(c.hourly_rate).toBeGreaterThan(0);
      expect(seedCourts.map((court) => court.hourly_rate)).not.toContain(c.hourly_rate);
    }
    // Twee keer hetzelfde bedrag zou de uitsplitsing per trainer nietszeggend maken.
    expect(new Set(coaches.map((c) => c.hourly_rate)).size).toBe(coaches.length);
  });

  it('has a group staffel on every court: up to 2 the normal rate, from 3 on more', () => {
    for (const court of seedCourts) {
      const steps = court.group_rates ?? [];
      expect(steps.length).toBeGreaterThan(1);
      expect(rateForGroup(court, 1)).toBe(court.hourly_rate);
      expect(rateForGroup(court, 2)).toBe(court.hourly_rate);
      expect(rateForGroup(court, 3)).toBeGreaterThan(court.hourly_rate);
    }
  });
  it('default booking end time is 21:00', () => {
    expect(defaultSettings.booking_end_time).toBe('21:00');
  });
});
