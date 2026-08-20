import { coachesForPlayer, playersForCoach } from './relations';
import type { Booking, Lesson, StudentProgress } from './types';

const booking = (player: string, coach: string): Booking => ({
  id: `b-${player}-${coach}`,
  player_id: player,
  coach_id: coach,
  court_id: 'court1',
  start_time: '2026-08-20T09:00:00Z',
  end_time: '2026-08-20T10:00:00Z',
  status: 'confirmed',
  payment_method: 'open',
});

const lesson = (student: string | undefined, coach: string | undefined): Lesson => ({
  id: `l-${student ?? 'none'}-${coach ?? 'none'}`,
  title: 'Forehand',
  uploaded_by: coach ?? 'x',
  student_id: student,
  coach_id: coach,
});

const note = (student: string, coach: string): StudentProgress => ({
  id: `p-${student}-${coach}`,
  student_id: student,
  coach_id: coach,
  training_type: 'techniek',
});

describe('coachesForPlayer', () => {
  it('is empty when nothing links the player to anyone', () => {
    expect(coachesForPlayer('mathis', [], [], [])).toEqual([]);
    expect(coachesForPlayer('mathis', [booking('lotte', 'koen')], [], [])).toEqual([]);
  });

  it('finds a coach through a booking, a lesson or a progress note alone', () => {
    expect(coachesForPlayer('mathis', [booking('mathis', 'koen')], [], [])).toEqual(['koen']);
    expect(coachesForPlayer('mathis', [], [lesson('mathis', 'sanne')], [])).toEqual(['sanne']);
    expect(coachesForPlayer('mathis', [], [], [note('mathis', 'ella')])).toEqual(['ella']);
  });

  it('returns every coach when a player works with more than one', () => {
    const found = coachesForPlayer(
      'mathis',
      [booking('mathis', 'koen')],
      [lesson('mathis', 'sanne')],
      [note('mathis', 'ella')],
    );
    expect(found.sort()).toEqual(['ella', 'koen', 'sanne']);
  });

  it('deduplicates a coach linked through several sources', () => {
    const found = coachesForPlayer(
      'mathis',
      [booking('mathis', 'koen'), { ...booking('mathis', 'koen'), id: 'b2' }],
      [lesson('mathis', 'koen')],
      [note('mathis', 'koen')],
    );
    expect(found).toEqual(['koen']);
  });

  it('ignores library lessons that have no coach or no student', () => {
    expect(coachesForPlayer('mathis', [], [lesson('mathis', undefined)], [])).toEqual([]);
    expect(coachesForPlayer('mathis', [], [lesson(undefined, 'koen')], [])).toEqual([]);
  });
});

describe('playersForCoach', () => {
  it('is empty when the coach has no links', () => {
    expect(playersForCoach('koen', [], [], [])).toEqual([]);
    expect(playersForCoach('koen', [booking('mathis', 'sanne')], [], [])).toEqual([]);
  });

  it('finds a player through a booking, a lesson or a progress note alone', () => {
    expect(playersForCoach('koen', [booking('mathis', 'koen')], [], [])).toEqual(['mathis']);
    expect(playersForCoach('koen', [], [lesson('lotte', 'koen')], [])).toEqual(['lotte']);
    expect(playersForCoach('koen', [], [], [note('sam', 'koen')])).toEqual(['sam']);
  });

  it('returns every player and deduplicates across sources', () => {
    const found = playersForCoach(
      'koen',
      [booking('mathis', 'koen')],
      [lesson('mathis', 'koen'), lesson('lotte', 'koen')],
      [note('sam', 'koen')],
    );
    expect(found.sort()).toEqual(['lotte', 'mathis', 'sam']);
  });

  it('is many-to-many: the same player shows up for two coaches', () => {
    const bookings = [booking('mathis', 'koen'), booking('mathis', 'sanne')];
    expect(playersForCoach('koen', bookings, [], [])).toEqual(['mathis']);
    expect(playersForCoach('sanne', bookings, [], [])).toEqual(['mathis']);
  });

  it('ignores library lessons that have no student', () => {
    expect(playersForCoach('koen', [], [lesson(undefined, 'koen')], [])).toEqual([]);
  });
});
