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
