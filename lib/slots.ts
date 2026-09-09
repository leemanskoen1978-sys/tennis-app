import { t } from './i18n';
import type { Booking, User } from './types';

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
 * Weet dit scherm zeker welke uren bij deze trainer bezet zijn?
 *
 * Alleen als je zijn hele agenda te zien krijgt, en dat zijn er twee: een beheerder, en de
 * trainer zelf. Voor alle anderen geeft de databank maar een deel van zijn lessen mee —
 * `bookings_select` in supabase-schema.sql laat je je eigen lessen zien, die van je kind, en
 * verder niets. Een ouder die naar de agenda van zijn trainer kijkt, ziet dus een lege
 * woensdag terwijl die vol staat. Een trainer die naar de agenda van een collega kijkt, ook.
 *
 * Waarom dat niet met een ruimere policy op te lossen is: dan leest hij mee wie er bij zijn
 * trainer les heeft, en dat is precies wat die regel afschermt. Wat er nodig is, is een
 * smalle bron die per trainer en dag alleen begin- en eindtijd teruggeeft, zonder namen. Zie
 * OPENSTAAND.md punt 1e.
 *
 * Zolang die er niet is, hoort het scherm niet "vrij" te zeggen waar het "ik weet het niet"
 * bedoelt. Deze functie is de vraag die het scherm daarvoor stelt.
 */
export function bezetIsVolledig(
  kijker: Pick<User, 'id' | 'is_admin'> | null | undefined,
  coachId: string | null | undefined,
): boolean {
  if (!kijker || !coachId) return false;
  return kijker.is_admin === true || kijker.id === coachId;
}

/** Hoeveel minuten één slot uit `generateSlots` beslaat. Die staan op het hele uur. */
const SLOT_MINUTEN = 60;

/** De minuut van de dag waarop dit moment valt, gelezen op de klok en niet in UTC. */
function minuutVanDag(iso: string): number | null {
  const d = new Date(iso);
  const ms = d.getTime();
  if (!Number.isFinite(ms)) return null;
  return d.getHours() * 60 + d.getMinutes();
}

/** Valt dit moment op deze kalenderdag, zoals je hem op de klok ziet? */
function opDag(iso: string, dag: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === dag.getFullYear()
    && d.getMonth() === dag.getMonth()
    && d.getDate() === dag.getDate();
}

/**
 * Welke uren van deze dag al bezet zijn bij deze trainer.
 *
 * Dit keek ooit alleen naar het béginuur van een les: stond er een les op 14:00, dan was het
 * slot van 14:00 bezet en verder niets. Twee soorten lessen vielen daardoor stil weg.
 *
 * Een les die niet op het hele uur begint, blokkeerde niets. De club heeft groepen van een
 * half uur (zie `duration_minutes` in lib/types), dus een les van 14:30 tot 15:00 liet het
 * slot van 14:00 gewoon vrij staan — terwijl de trainer er dan op de baan staat.
 *
 * En een les die langer duurt dan een uur blokkeerde alleen zijn eerste uur. Een les van
 * 16:00 tot 17:30 liet 17:00 vrij. Wie dat uur aanvroeg, kreeg het niet geweigerd: hij zag
 * "vrij" staan waar zijn trainer al bezet was.
 *
 * Nu telt de hele lesduur mee: een slot is bezet zodra het overlapt met een les. Geannuleerde
 * lessen tellen niet — die gaan niet door, dus dat uur is weer vrij.
 *
 * Wat dit NIET doet: zeggen of een uur echt vrij is. Deze lijst kan alleen de lessen zien die
 * de kijker mag zien, en een speler ziet in de databank alleen zijn eigen lessen
 * (`bookings_select` in supabase-schema.sql). Voor hem staat de dag van een trainer dus leeg,
 * hoe vol die in werkelijkheid ook is. Zie OPENSTAAND.md.
 */
export function bezetteSlots(
  slots: string[],
  bookings: ReadonlyArray<Pick<Booking, 'coach_id' | 'start_time' | 'end_time' | 'status'>>,
  coachId: string,
  dag: Date,
): Set<string> {
  return bezetteSlotsUit(
    slots,
    bookings.filter((b) => b.coach_id === coachId && b.status !== 'cancelled'),
    dag,
  );
}

/**
 * Dezelfde rekensom, maar op kale tijdvakken in plaats van op boekingen.
 *
 * Zo kan het uit twee bronnen komen zonder dat de regel twee keer opgeschreven staat: uit de
 * lessen die de app toch al heeft, en uit `bezette_uren` in de databank — die geeft alleen
 * begin- en eindtijd terug, zonder namen (zie BEZETTE-UREN.sql). Dat een speler op Reserveren
 * hetzelfde uur bezet ziet als zijn trainer, komt doordat het hier dezelfde functie is.
 *
 * Wat er binnenkomt is al gefilterd: deze functie kent geen trainer en geen status.
 */
export function bezetteSlotsUit(
  slots: string[],
  uren: ReadonlyArray<{ start_time: string; end_time: string }>,
  dag: Date,
): Set<string> {
  const bezet = new Set<string>();

  for (const b of uren) {
    if (!opDag(b.start_time, dag)) continue;

    const van = minuutVanDag(b.start_time);
    if (van === null) continue;
    // Een onleesbare of ontbrekende eindtijd telt als één uur: bij twijfel liever een uur te
    // veel dichthouden dan een speler op een bezette baan zetten.
    const tot = minuutVanDag(b.end_time) ?? van + SLOT_MINUTEN;
    const eind = tot > van ? tot : van + SLOT_MINUTEN;

    for (const slot of slots) {
      const slotVan = Number(slot.slice(0, 2)) * 60 + Number(slot.slice(3, 5));
      if (!Number.isFinite(slotVan)) continue;
      // Overlap, niet gelijkheid: het slot is bezet zodra het de les raakt. Aan elkaar
      // grenzen telt niet — een les tot 15:00 laat het slot van 15:00 vrij.
      if (slotVan < eind && slotVan + SLOT_MINUTEN > van) bezet.add(slot);
    }
  }

  return bezet;
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
