// Counters for the hub tiles. Without a tab bar you no longer see at a glance where
// something is waiting, so every tile carries a live number instead.

import type { Booking, User } from './types';

/**
 * De lessen die op deze dag beginnen, geannuleerde niet meegerekend, op tijd oplopend.
 * De vergelijking is lokaal: een les van 's avonds laat hoort bij de dag zoals je hem
 * op de klok ziet, niet bij de dag in UTC. Zowel de teller op het hoofdscherm als de
 * lijst "Vandaag" in de agenda gebruikt deze ene definitie van "valt op deze dag".
 */
export function bookingsOnDay(bookings: Booking[], day: Date): Booking[] {
  const y = day.getFullYear(), m = day.getMonth(), d = day.getDate();
  return bookings
    .filter((b) => {
      if (b.status === 'cancelled') return false;
      const s = new Date(b.start_time);
      return s.getFullYear() === y && s.getMonth() === m && s.getDate() === d;
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}

/** Bookings that start today and are not cancelled. */
export function bookingsToday(bookings: Booking[], now: Date): number {
  return bookingsOnDay(bookings, now).length;
}

export function countPlayers(users: User[]): number {
  return users.filter((u) => u.role !== 'coach').length;
}

export function countCoaches(users: User[]): number {
  return users.filter((u) => u.role === 'coach').length;
}
