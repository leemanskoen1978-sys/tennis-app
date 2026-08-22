import { t } from './i18n';
import type { User } from './types';

/**
 * Weekday labels indexed by `Date.getDay()`, so Sunday is 0. `User.working_days` uses the
 * same numbering; keeping one counting scheme avoids a whole class of off-by-one bugs.
 */
export const DAY_LABELS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'] as const;

/** Reading order for people: Monday first, Sunday last. Storage order stays getDay(). */
const DISPLAY_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** Hourly HH:00 slots from 09:00 up to (excluding) endTime, e.g. '21:00'. */
export function generateSlots(endTime: string): string[] {
  const startHour = 9;
  const endHour = parseInt(endTime.slice(0, 2), 10);
  const slots: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
  }
  return slots;
}

/**
 * Mag er op deze dag geboekt worden? Het verleden nooit, en vandaag alleen als
 * `todayAllowed` het toestaat.
 *
 * Die uitzondering is er voor de trainer. Een speler die vanochtend nog snel een uur wil
 * vastleggen, zet zijn trainer voor een voldongen feit; die staat misschien al ergens
 * anders. Maar de trainer zelf weet wat er die dag nog kan — belt een leerling om half
 * negen voor een uur om elf, dan moet hij dat gewoon kunnen inzetten. Vandaar dat de app
 * dit niet voor iedereen dichtzet, maar per persoon.
 */
export function isDateBookable(
  date: Date,
  now: Date = new Date(),
  todayAllowed = false,
): boolean {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d.getTime() === t.getTime()) return todayAllowed;
  return d.getTime() > t.getTime();
}

/**
 * De uren die op deze dag nog kunnen. Op een andere dag dan vandaag zijn dat ze allemaal;
 * vandaag vallen de uren weg die al begonnen zijn.
 *
 * Zonder dit zou de trainer die vandaag mag boeken om drie uur 's middags nog een les van
 * negen uur 's ochtends kunnen inzetten — een les die al voorbij is voor hij bestaat.
 */
export function slotsStillToCome(slots: string[], day: Date, now: Date): string[] {
  const zelfdeDag = day.getFullYear() === now.getFullYear()
    && day.getMonth() === now.getMonth()
    && day.getDate() === now.getDate();
  if (!zelfdeDag) return slots;
  const nu = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  // Tijden staan als 'HH:MM' met een voorloopnul, dus gewoon vergelijken klopt hier.
  return slots.filter((slot) => slot > nu);
}

/**
 * Does this coach teach on this weekday? Nothing set means every day: every coach that
 * existed before this field was used has it empty, and "empty = never" would make the
 * whole club unbookable overnight.
 */
export function worksOnDay(coach: Pick<User, 'working_days'>, date: Date): boolean {
  const days = coach.working_days;
  if (days === undefined || days.length === 0) return true;
  return days.includes(date.getDay());
}

/**
 * The slots this coach actually teaches: the club window narrowed by their own hours.
 * The club window is the outer bound — a coach cannot extend past it, only sit inside it.
 * Times are zero-padded 'HH:MM', so plain string comparison is chronological.
 */
export function slotsForCoach(
  coach: Pick<User, 'working_hours'>,
  clubEndTime: string,
): string[] {
  const club = generateSlots(clubEndTime);
  const hours = coach.working_hours;
  if (hours === undefined) return club;
  return club.filter((slot) => slot >= hours.start && slot < hours.end);
}

/** "Ma · Wo · Vr" for the profile card, or "Elke dag" when nothing is set. */
export function formatWorkingDays(coach: Pick<User, 'working_days'>): string {
  const days = coach.working_days;
  if (days === undefined || days.length === 0) return t('Elke dag');
  return DISPLAY_DAY_ORDER.filter((d) => days.includes(d))
    .map((d) => t(DAY_LABELS[d]))
    .join(' · ');
}
