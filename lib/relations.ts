// Derived player <-> coach relation (spec: toegangsregels-en-filters).
//
// There is no link table. A coach "has" a player as soon as a booking, lesson or
// progress note exists between them. That makes the relation many-to-many for free
// and it can never go stale: book Mathis with Sanne and Mathis is in Sanne's list.

import type { Booking, Lesson, StudentProgress } from './types';

/** Every coach that has a booking, lesson or progress note with this player. */
export function coachesForPlayer(
  playerId: string,
  bookings: Booking[],
  lessons: Lesson[],
  progress: StudentProgress[],
): string[] {
  const ids = new Set<string>();
  for (const b of bookings) {
    if (b.player_id === playerId && b.coach_id) ids.add(b.coach_id);
  }
  for (const l of lessons) {
    if (l.student_id === playerId && l.coach_id) ids.add(l.coach_id);
  }
  for (const p of progress) {
    if (p.student_id === playerId && p.coach_id) ids.add(p.coach_id);
  }
  return [...ids];
}

/** Every player that has a booking, lesson or progress note with this coach. */
export function playersForCoach(
  coachId: string,
  bookings: Booking[],
  lessons: Lesson[],
  progress: StudentProgress[],
): string[] {
  const ids = new Set<string>();
  for (const b of bookings) {
    if (b.coach_id === coachId && b.player_id) ids.add(b.player_id);
  }
  for (const l of lessons) {
    if (l.coach_id === coachId && l.student_id) ids.add(l.student_id);
  }
  for (const p of progress) {
    if (p.coach_id === coachId && p.student_id) ids.add(p.student_id);
  }
  return [...ids];
}

// ---------------------------------------------------------------------------
// Het lesplan van één speler, met de voortgang eronder gehangen.
//
// Lesplan en voortgang stonden als twee lijsten naast elkaar, en dan zoek je zelf uit welke
// notitie bij welke les hoort. Terwijl die koppeling al bestaat: `StudentProgress.lesson_id`
// wordt gelegd zodra je in het voortgangsformulier een les aanwijst. Ook dit is een relatie
// die je niet bijhoudt maar afleidt, dus hij hoort hier.
// ---------------------------------------------------------------------------

/** Eén les uit het plan, met de notities die eraan hangen. */
export interface LessonWithProgress {
  lesson: Lesson;
  entries: StudentProgress[];
}

/** Het hele overzicht: de lessen in twee stapels, en wat er los van een les genoteerd is. */
export interface Lesplan {
  /** Nog te doen: alles wat niet op 'gegeven' staat. */
  planned: LessonWithProgress[];
  given: LessonWithProgress[];
  /** Notities zonder les. Die verdwijnen niet — ze horen alleen nergens onder. */
  loose: StudentProgress[];
  /** Alle notities van deze speler, ook de losse: waar de telling op de tegel op slaat. */
  entryCount: number;
}

/** Nieuwste notitie eerst; zelfde volgorde als het dossier elders aanhoudt. */
const byNewestFirst = (a: StudentProgress, b: StudentProgress): number =>
  (b.created_at ?? '').localeCompare(a.created_at ?? '');

/**
 * Bouwt het lesplan van een speler op uit alle lessen en alle notities.
 *
 * Een notitie die naar een les wijst die niet (meer) in het plan van deze speler zit, hoort
 * bij de losse notities: hij staat nergens in deze lijst, dus anders zou hij van het scherm
 * vallen. Hetzelfde geldt voor een notitie zonder les.
 */
export function buildLesplan(
  playerId: string,
  lessons: Lesson[],
  progress: StudentProgress[],
): Lesplan {
  const playerLessons = lessons.filter((l) => l.student_id === playerId);
  const entries = progress.filter((p) => p.student_id === playerId);
  const lessonIds = new Set(playerLessons.map((l) => l.id));

  const withProgress = (lesson: Lesson): LessonWithProgress => ({
    lesson,
    entries: entries.filter((p) => p.lesson_id === lesson.id).sort(byNewestFirst),
  });

  return {
    planned: playerLessons.filter((l) => l.status !== 'gegeven').map(withProgress),
    given: playerLessons.filter((l) => l.status === 'gegeven').map(withProgress),
    loose: entries
      .filter((p) => !p.lesson_id || !lessonIds.has(p.lesson_id))
      .sort(byNewestFirst),
    entryCount: entries.length,
  };
}

/**
 * Wat er op de tegel staat: allebei de kanten van dit overzicht in één regel,
 * bijvoorbeeld "2 te doen · 3 notities".
 */
export function lesplanSummary(plan: Lesplan): string {
  const todo = plan.planned.length > 0 ? `${plan.planned.length} te doen` : 'niets te doen';
  const notes = plan.entryCount === 0
    ? 'geen notities'
    : plan.entryCount === 1 ? '1 notitie' : `${plan.entryCount} notities`;
  return `${todo} · ${notes}`;
}
