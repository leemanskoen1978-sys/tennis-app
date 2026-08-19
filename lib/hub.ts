// Counters for the hub tiles. Without a tab bar you no longer see at a glance where
// something is waiting, so every tile carries a live number instead.

import type { Booking, User } from './types';

/** Bookings that start today and are not cancelled. */
export function bookingsToday(bookings: Booking[], now: Date): number {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  return bookings.filter((b) => {
    if (b.status === 'cancelled') return false;
    const s = new Date(b.start_time);
    return s.getFullYear() === y && s.getMonth() === m && s.getDate() === d;
  }).length;
}

export function countPlayers(users: User[]): number {
  return users.filter((u) => u.role !== 'coach').length;
}

export function countCoaches(users: User[]): number {
  return users.filter((u) => u.role === 'coach').length;
}
