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

/** Hoeveel dagen terug een trainer kan boeken, en hoever iedereen vooruit kan. */
export const DAGEN_TERUG = 7;
export const DAGEN_VOORUIT = 14;

/**
 * De dagen in de keuzestrook. Een trainer krijgt er een week verleden bij; een speler
 * begint bij vandaag.
 *
 * Die week terug is er omdat een les die al gegeven is nog ingevoerd moet kunnen worden.
 * Vergeet een trainer dat op de baan, dan bestaat dat uur nergens: niet in zijn omzet, niet
 * op een factuur, niet in het dossier van de speler. Een week is ruim genoeg om dat recht
 * te zetten en kort genoeg om niet in de boekhouding van vorige maand te gaan graven.
 */
export function bookingDays(now: Date, daysBack: number, daysAhead: number): Date[] {
  const dagen: Date[] = [];
  for (let i = -daysBack; i < daysAhead; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() + i);
    dagen.push(d);
  }
  return dagen;
}

/**
 * Mag er op deze dag geboekt worden?
 *
 * Voor een speler: vanaf morgen. Wie vanochtend nog snel een uur vastlegt, zet zijn trainer
 * voor een voldongen feit terwijl die misschien al ergens anders staat, en een les
 * aanvragen die al geweest is slaat helemaal nergens op.
 *
 * Voor een trainer: elke dag die in de strook staat, verleden inbegrepen. Hij weet zelf wat
 * er die dag nog kan, en een uur dat hij gaf maar vergat in te geven, moet hij alsnog
 * kunnen invoeren. Hoever terug dat reikt, bepaalt `bookingDays` — niet deze functie.
 */
export function isDateBookable(
  date: Date,
  now: Date = new Date(),
  trainerMag = false,
): boolean {
  if (trainerMag) return true;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

// De uren van één trainer stonden hier ooit ook (`slotsForCoach`): de clubtijd, versmald
// door zijn eigen uren. Die zijn verhuisd naar lib/boekingstijd, en de grens is daarbij
// omgedraaid — een trainer mag nu buiten de clubtijd vallen, want anders kan wie tot tien
// uur 's avonds lesgeeft dat nergens kwijt. De clubtijd is sindsdien wat je krijgt als je
// zelf niets invult.

/** "Ma · Wo · Vr" for the profile card, or "Elke dag" when nothing is set. */
export function formatWorkingDays(coach: Pick<User, 'working_days'>): string {
  const days = coach.working_days;
  if (days === undefined || days.length === 0) return t('Elke dag');
  return DISPLAY_DAY_ORDER.filter((d) => days.includes(d))
    .map((d) => t(DAY_LABELS[d]))
    .join(' · ');
}
