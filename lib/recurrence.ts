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
import type { Booking, Vakantie } from './types';
import { endOfDay } from './period';
import { formatDay } from './datetime';
import { vakantieOpMoment } from './vakanties';

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

/**
 * Waarom een les van de reeks afvalt. Er is er nog één van over: de clubvakantie.
 *
 * Tot 6 september 2026 stond `'bezet'` hier ook in, en dan viel de les uit de reeks. Dat is
 * omgedraaid — een overlap blokkeert nooit meer en waarschuwt altijd; zie `botsingen`
 * hieronder. De vakantie blijft wél blokkeren: op een dag dat de club dicht is geeft niemand
 * les, en die lessen achteraf één voor één terugvinden en schrappen is precies het werk dat
 * een reeks moest besparen.
 */
export type OvergeslagenReden = 'vakantie';

export interface OvergeslagenSlot extends SeriesSlot {
  reden: OvergeslagenReden;
  /** De naam van de vakantie, als dat de reden was. */
  vakantie?: string;
}

/**
 * Een les die gewoon doorgaat maar overlapt met een andere, met die andere les erbij.
 *
 * De botsende boeking en niet enkel "er is een botsing": alleen zo kan het scherm zeggen
 * wáármee het botst, en pas dan kan de lezer beoordelen of het kleutertennis is of een echte
 * vergissing. Dat onderscheid kan de code niet maken en de beheerder wel.
 */
export interface BotsendSlot extends SeriesSlot {
  /** De bestaande les waarmee dit moment overlapt. */
  conflict: BezetBoeking;
}

export interface SeriesPlan {
  /** De lessen die aangemaakt kunnen worden, op tijd oplopend, inclusief de eerste. */
  usable: SeriesSlot[];
  /** De lessen die niet doorgaan, met de reden erbij. */
  skipped: OvergeslagenSlot[];
  /**
   * De lessen uit `usable` die overlappen met een bestaande les. Ze staan er dus twéé keer in:
   * hier als waarschuwing, en in `usable` omdat ze aangemaakt worden. Wie deze lijst negeert
   * maakt een dubbele boeking aan zonder het te melden, en dat is erger dan de weigering die
   * dit verving.
   */
  botsingen: BotsendSlot[];
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

/** De velden die de bezetvraag nodig heeft; meer weet deze module niet van een les. */
export type BezetBoeking = Pick<Booking, 'id' | 'coach_id' | 'court_id' | 'start_time' | 'end_time' | 'status'>;

/** Voor wie en waarvoor de vraag gesteld wordt. */
export interface BezetVraag {
  /** De trainer die op dat uur zou lesgeven. */
  coachId: string;
  /**
   * De baan waarop het zou gebeuren, als die vaststaat. Leeg betekent "kijk niet naar de
   * baan": zo werkt het aanmaken van een reeks, waar de baan pas later gekozen wordt.
   */
  courtId?: string;
  /**
   * De lessen die zelf aan het verhuizen zijn. Zonder die uitzondering botst elke groep die
   * een uur opschuift met haar eigen volgende week: de oude lessen staan er dan nog, en de
   * verzetting zou van zichzelf zeggen dat ze niet kan.
   */
  negeer?: ReadonlySet<string>;
}

/**
 * Botst dit tijdvak met een bestaande boeking — van dezelfde trainer, of op dezelfde baan?
 * De eerste botsende boeking eruit, of `null`. De boeking zelf en niet enkel een ja, zodat
 * de melder kan zeggen wáármee het botst; wie alleen het antwoord wil leest `!== null`.
 *
 * Dit is de enige plek in de hele codebase die twee tijdvakken vergelijkt: dezelfde
 * trainer, tijdvakken die elkaar raken zonder de grenzen mee te tellen (een les van 10–11
 * botst niet met 11–12), en een geannuleerde les houdt niets bezet. De provider had hier
 * tot vandaag een eigen kopie van (`overlaps` in providers/SimpleDataProvider); die is weg,
 * want twee kopieën lopen uiteen en dan meldt het scherm een reeks die de provider daarna
 * weigert. `planSeries`, `planGroepWijziging` en `addBooking` lopen alle drie hier doorheen,
 * en wie in deze fase een vervanger zoekt hoort dat ook te doen — schrijf geen vierde.
 *
 * De baan hoort erbij omdat een groep die naar een vrij uur van haar trainer verhuist alsnog
 * op een bezette baan kan uitkomen. Een les zonder baan houdt geen baan bezet.
 *
 * WAT EEN BOTSING SINDS 6 SEPTEMBER 2026 BETEKENT. Ze blokkeert nooit meer en waarschuwt
 * altijd. Deze functie is niet veranderd — ze beantwoordt nog steeds precies dezelfde vraag,
 * en dat antwoord is nog steeds gewenst. Alleen wat de aanroepers ermee doen is omgedraaid,
 * van weigeren naar melden. De aanleiding: op Terrein 7 hebben blauw en rood elk maar een
 * halve baan nodig, dus staan er twee of drie kleutergroepen tegelijk — en dezelfde trainer
 * draait er twee naast elkaar. Beide aannames van de oude regel ("één groep per baan", "één
 * groep per trainer") zijn bij deze club dus onwaar, en de weigering liet juist die
 * kinderlessen stilletjes verdwijnen. Wie hier een nieuwe aanroeper bijzet: melden, niet
 * weigeren — en de teruggegeven boeking gebruiken om te zeggen wáármee het botst.
 */
export function botstMet(
  slot: SeriesSlot,
  existing: BezetBoeking[],
  vraag: BezetVraag,
): BezetBoeking | null {
  const aStart = new Date(slot.start_time).getTime();
  const aEnd = new Date(slot.end_time).getTime();
  return existing.find((b) => {
    if (b.status === 'cancelled') return false;
    if (vraag.negeer?.has(b.id)) return false;
    const zelfdeTrainer = b.coach_id === vraag.coachId;
    const zelfdeBaan = !!vraag.courtId && !!b.court_id && b.court_id === vraag.courtId;
    if (!zelfdeTrainer && !zelfdeBaan) return false;
    const bStart = new Date(b.start_time).getTime();
    const bEnd = new Date(b.end_time).getTime();
    return aStart < bEnd && bStart < aEnd;
  }) ?? null;
}

/**
 * Zet één les plus een herhaalregel om in de volledige reeks, zegt welke lessen niet doorgaan
 * omdat de club dicht is, en welke wél doorgaan maar overlappen met een bestaande les.
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
  /**
   * De clubkalender. Valt een les in een vakantie, dan gaat hij niet door — geen enkele
   * trainer geeft les in een week dat de club dicht is, en die lessen achteraf één voor
   * één terugvinden en schrappen is precies het werk dat een reeks moest besparen.
   * Leeg betekent "het hele jaar door les", zoals het was voordat de kalender bestond.
   */
  vakanties: Vakantie[] = [],
): SeriesPlan {
  const empty: SeriesPlan = { usable: [], skipped: [], botsingen: [] };

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
  const skipped: OvergeslagenSlot[] = [];
  const botsingen: BotsendSlot[] = [];
  for (let i = 0; i < MAX_LESSONS; i++) {
    const days = i * step;
    const slotStart = shiftDays(start, days);
    if (slotStart.getTime() > limit) break;
    const slot: SeriesSlot = {
      start_time: slotStart.toISOString(),
      end_time: shiftDays(end, days).toISOString(),
    };
    // De vakantie eerst: is de club dicht, dan doet het er niet meer toe of de trainer op
    // dat uur ook nog een andere les had staan.
    const vakantie = vakantieOpMoment(vakanties, slot.start_time);
    if (vakantie) {
      skipped.push({ ...slot, reden: 'vakantie', vakantie: vakantie.naam });
      continue;
    }
    // De botsing valt de les niet meer af: ze gaat door én wordt gemeld. Bij het kleutertennis
    // van deze club staan blauw en rood samen op de halve baan van Terrein 7, met dezelfde
    // trainer ernaast — vroeger sloeg de reeks die weken over en verdwenen precies die
    // kinderlessen. Wie deze reeks aanmaakt hoort ze in het rood te zien staan, niet te missen.
    const conflict = botstMet(slot, existing, { coachId });
    if (conflict) botsingen.push({ ...slot, conflict });
    usable.push(slot);
  }

  return { usable, skipped, botsingen };
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
