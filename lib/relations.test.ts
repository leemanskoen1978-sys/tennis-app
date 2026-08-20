import {
  buildLesplan, coachesForPlayer, lesplanSummary, playersForCoach, type Lesplan,
} from './relations';
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

describe('buildLesplan', () => {
  const les = (id: string, student: string | undefined, status?: 'gepland' | 'gegeven'): Lesson => ({
    id, title: `Les ${id}`, uploaded_by: 'koen', coach_id: 'koen', student_id: student, status,
  });
  const entry = (id: string, student: string, lessonId?: string, createdAt?: string): StudentProgress => ({
    id, student_id: student, coach_id: 'koen', training_type: 'techniek',
    lesson_id: lessonId, created_at: createdAt,
  });

  it('hangs a note under the lesson it points at', () => {
    const plan = buildLesplan('mathis', [les('l1', 'mathis')], [entry('p1', 'mathis', 'l1')]);
    expect(plan.planned).toHaveLength(1);
    expect(plan.planned[0].entries.map((e) => e.id)).toEqual(['p1']);
    expect(plan.loose).toEqual([]);
  });

  it('splits planned from given', () => {
    const plan = buildLesplan(
      'mathis',
      [les('l1', 'mathis'), les('l2', 'mathis', 'gegeven'), les('l3', 'mathis', 'gepland')],
      [],
    );
    expect(plan.planned.map((p) => p.lesson.id)).toEqual(['l1', 'l3']);
    expect(plan.given.map((p) => p.lesson.id)).toEqual(['l2']);
  });

  it('keeps a note without a lesson as a loose note', () => {
    const plan = buildLesplan('mathis', [les('l1', 'mathis')], [entry('p1', 'mathis')]);
    expect(plan.planned[0].entries).toEqual([]);
    expect(plan.loose.map((e) => e.id)).toEqual(['p1']);
  });

  it('keeps a note pointing at a lesson outside this plan as a loose note', () => {
    // De les is aan iemand anders toegewezen (of uit het plan gehaald): de notitie mag
    // daardoor niet van het scherm vallen.
    const plan = buildLesplan('mathis', [les('l1', 'lotte')], [entry('p1', 'mathis', 'l1')]);
    expect(plan.planned).toEqual([]);
    expect(plan.loose.map((e) => e.id)).toEqual(['p1']);
  });

  it('sorts several notes on the same lesson newest first', () => {
    const plan = buildLesplan(
      'mathis',
      [les('l1', 'mathis')],
      [
        entry('oud', 'mathis', 'l1', '2026-01-01T10:00:00Z'),
        entry('nieuw', 'mathis', 'l1', '2026-03-01T10:00:00Z'),
        entry('midden', 'mathis', 'l1', '2026-02-01T10:00:00Z'),
      ],
    );
    expect(plan.planned[0].entries.map((e) => e.id)).toEqual(['nieuw', 'midden', 'oud']);
  });

  it('leaves another player out of it', () => {
    const plan = buildLesplan(
      'mathis',
      [les('l1', 'mathis'), les('l2', 'lotte')],
      [entry('p1', 'lotte', 'l2'), entry('p2', 'mathis')],
    );
    expect(plan.planned.map((p) => p.lesson.id)).toEqual(['l1']);
    expect(plan.entryCount).toBe(1);
    expect(plan.loose.map((e) => e.id)).toEqual(['p2']);
  });

  it('counts every note of this player, loose ones included', () => {
    const plan = buildLesplan(
      'mathis',
      [les('l1', 'mathis')],
      [entry('p1', 'mathis', 'l1'), entry('p2', 'mathis')],
    );
    expect(plan.entryCount).toBe(2);
  });
});

describe('lesplanSummary', () => {
  const plan = (planned: number, entries: number): Lesplan => ({
    planned: Array.from({ length: planned }, (_, i) => ({
      lesson: { id: `l${i}`, title: 'x', uploaded_by: 'koen' },
      entries: [],
    })),
    given: [],
    loose: [],
    entryCount: entries,
  });

  it('covers both sides of the sheet', () => {
    expect(lesplanSummary(plan(2, 3))).toBe('2 te doen · 3 notities');
  });

  it('speaks singular and says so when there is nothing', () => {
    expect(lesplanSummary(plan(1, 1))).toBe('1 te doen · 1 notitie');
    expect(lesplanSummary(plan(0, 0))).toBe('niets te doen · geen notities');
  });
});
