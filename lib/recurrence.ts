// Herhalende lessen. Een trainer die elke dinsdag om 10:00 lesgeeft wil dat één keer
// invoeren, maar wél twaalf losse lessen overhouden: alleen dan kun je er later één
// verzetten of schrappen zonder de rest aan te raken. Deze module doet het rekenwerk —
// welke dagen komen eruit, en welke daarvan kunnen niet omdat de trainer dan al bezet is.
// Het aanmaken zelf gebeurt in de provider; hier staat geen opslag, zodat de reeks
// getest en getoond kan worden vóór er iets vastligt.
//
// Alles gebeurt in lokale tijd, net als `bookingsOnDay` in lib/hub en de periodes in
// lib/period. Dat is hier geen detail: een reeks die over de uurwissel loopt moet om
// 10:00 blijven staan, en dat lukt alleen als je met dag-, uur- en minuutvelden rekent
// en niet met "168 uur erbij".

import { t } from './i18n';
import type { Booking } from './types';
import { endOfDay } from './period';
import { formatDay } from './datetime';

export type RecurrenceFrequency = 'weekly' | 'biweekly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  /** Laatste dag waarop een les mag vallen, als YYYY-MM-DD. Inclusief. */
  until: string;
}

export interface SeriesSlot {
  start_time: string; // ISO
  end_time: string;   // ISO
}

export interface SeriesPlan {
  /** De lessen die aangemaakt kunnen worden, op tijd oplopend, inclusief de eerste. */
  usable: SeriesSlot[];
  /** De lessen die botsen met een bestaande boeking van dezelfde trainer. */
  skipped: SeriesSlot[];
}

/** Hoeveel dagen er tussen twee lessen zitten. */
const DAYS_BETWEEN: Record<RecurrenceFrequency, number> = {
  weekly: 7,
  biweekly: 14,
};

/**
 * De bovengrens op een reeks: honderdvier lessen, oftewel twee jaar wekelijks les.
 * Niemand boekt vooruit tot 2099, maar één verkeerd getikt jaartal in het veld "tot"
 * zou dat wel doen — en dan staan er duizenden lessen in de opslag die je stuk voor stuk
 * moet opruimen. Twee jaar is ruim voor een lesseizoen en klein genoeg om een typfout
 * onschadelijk te maken. Bij tweewekelijks dekt hetzelfde getal vier jaar; de grens is
 * bewust op het aantal lessen gelegd, want dát is wat er in de opslag terechtkomt.
 */
export const MAX_LESSONS = 104;

/** De namen van de frequenties zoals een trainer ze op het scherm leest. */
const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: 'Wekelijks',
  biweekly: 'Tweewekelijks',
};

function parseMoment(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * De einddag uit de regel, als lokale dag. Streng: alleen YYYY-MM-DD, en de dag moet
 * echt bestaan. Een "2026-02-30" mag niet stilletjes naar maart doorrollen, want dan
 * krijgt de trainer een les meer dan hij vroeg.
 */
function parseUntil(until: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(until.trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

/**
 * Dezelfde dagtijd, een aantal dagen verder. Door de dag op te tellen in het veld `date`
 * en uur en minuut ongemoeid te laten blijft een les van 10:00 ook na de uurwissel om
 * 10:00 staan — bij optellen in milliseconden zou hij naar 09:00 of 11:00 schuiven.
 */
function shiftDays(d: Date, days: number): Date {
  return new Date(
    d.getFullYear(), d.getMonth(), d.getDate() + days,
    d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds(),
  );
}

/**
 * Botst deze les met een bestaande boeking van dezelfde trainer? Woordelijk dezelfde
 * regel als `overlaps` in providers/SimpleDataProvider: dezelfde trainer, tijdvakken die
 * elkaar raken zonder de grenzen mee te tellen (een les van 10–11 botst niet met 11–12),
 * en een geannuleerde les houdt niets bezet. Wijkt deze versie ooit af, dan meldt het
 * scherm een reeks die de provider vervolgens weigert — daarom moeten de twee gelijk zijn.
 */
function collides(slot: SeriesSlot, coachId: string, existing: Booking[]): boolean {
  const aStart = new Date(slot.start_time).getTime();
  const aEnd = new Date(slot.end_time).getTime();
  return existing.some((b) => {
    if (b.status === 'cancelled' || b.coach_id !== coachId) return false;
    const bStart = new Date(b.start_time).getTime();
    const bEnd = new Date(b.end_time).getTime();
    return aStart < bEnd && bStart < aEnd;
  });
}

/**
 * Zet één les plus een herhaalregel om in de volledige reeks, en zegt welke lessen
 * niet kunnen omdat de trainer dan al bezet is.
 *
 * Onbruikbare invoer levert een lege reeks op in plaats van een fout: dit rekenwerk loopt
 * mee terwijl iemand nog in het formulier tikt, en een halfaf ingevulde datum mag geen
 * scherm laten crashen.
 */
export function planSeries(
  startTime: string,
  endTime: string,
  rule: RecurrenceRule,
  coachId: string,
  existing: Booking[],
): SeriesPlan {
  const empty: SeriesPlan = { usable: [], skipped: [] };

  const start = parseMoment(startTime);
  const end = parseMoment(endTime);
  const until = parseUntil(rule.until);
  if (!start || !end || !until) return empty;
  // Een les die eindigt vóór hij begint is geen les; de duur zou dan negatief zijn en
  // elke botsingstest zinloos maken.
  if (end.getTime() <= start.getTime()) return empty;

  const step = DAYS_BETWEEN[rule.frequency];
  if (!step) return empty;

  // De laatste dag telt helemaal mee: een les die om 20:00 op de einddag begint hoort erbij.
  const limit = endOfDay(until).getTime();

  const usable: SeriesSlot[] = [];
  const skipped: SeriesSlot[] = [];
  for (let i = 0; i < MAX_LESSONS; i++) {
    const days = i * step;
    const slotStart = shiftDays(start, days);
    if (slotStart.getTime() > limit) break;
    const slot: SeriesSlot = {
      start_time: slotStart.toISOString(),
      end_time: shiftDays(end, days).toISOString(),
    };
    (collides(slot, coachId, existing) ? skipped : usable).push(slot);
  }

  return { usable, skipped };
}

/** Leesbare samenvatting, bv. "Wekelijks tot en met za 20 dec · 12 lessen". */
export function seriesSummary(plan: SeriesPlan, rule: RecurrenceRule): string {
  const until = parseUntil(rule.until);
  // Dezelfde dagopmaak als overal elders in de app; geen eigen variant erbij.
  const day = until ? formatDay(until) : formatDay(rule.until);
  const n = plan.usable.length;
  const lessons = n === 0 ? t('geen lessen') : n === 1 ? t('1 les') : t('{n} lessen', { n });
  return t('{frequentie} tot en met {dag} · {lessen}', {
    frequentie: t(FREQUENCY_LABELS[rule.frequency]),
    dag: day,
    lessen: lessons,
  });
}

/**
 * De laatste dag van een reeks van `aantal` lessen, de eerste meegerekend.
 *
 * Een trainer denkt in "tien weken", niet in "tot en met 3 november". Dit rekent het ene
 * naar het andere om, zodat het scherm naar een aantal kan vragen en de regel eronder
 * gewoon met een einddatum blijft werken — er verandert niets aan `planSeries`.
 *
 * Een aantal van 1 of minder levert de eerste dag zelf op: dan is er geen reeks, en dat is
 * geen fout maar een antwoord.
 */
export function laatsteDagVan(
  eerste: Date,
  frequency: RecurrenceFrequency,
  aantal: number,
): Date {
  const stappen = Number.isFinite(aantal) ? Math.max(1, Math.floor(aantal)) - 1 : 0;
  const dagen = stappen * (frequency === 'biweekly' ? 14 : 7);
  return new Date(eerste.getFullYear(), eerste.getMonth(), eerste.getDate() + dagen);
}
