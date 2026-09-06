// Wat is een lesgroep, en welke lessen voelt een wijziging eraan? Puur rekenwerk — geen
// store, geen scherm — zodat de regels van een groep één keer vastliggen en te testen zijn.
//
// De grens die dit bestand bewaakt: een groep is "het rooster van nu", een boeking is "wie er
// die dag bij stond". Wie wil weten wie er in les X zat leest `Booking.participant_ids` via
// lib/groups, en nooit `LesGroep.roster`. Zonder die grens veranderen de groepsprijs en de
// aanwezigheid van een les van vorige maand zodra iemand vandaag een speler aan de groep
// toevoegt — de club zou haar eigen geschiedenis zien opschuiven.
//
// `groupBookingsFrom` is met opzet een tweelingbroer van `seriesFrom` in lib/series en geen
// hergebruik ervan: dezelfde `>=`-grens, dezelfde sortering, een andere sleutel. `seriesFrom`
// is getypeerd rond `series_id` en heeft een terugval ("geen reeks? dan alleen jezelf") die
// voor een groep niets betekent. Verandert daar de "vanaf"-grens, verander hem hier ook —
// twee antwoorden op dezelfde vraag is precies wat deze verwijzing moet voorkomen.

import { t } from './i18n';
import { botstMet, type BezetBoeking } from './recurrence';
import { vakantieOpMoment } from './vakanties';
import type { Booking, LesGroep, Vakantie } from './types';

/** De velden die een vraag over de groep nodig heeft; meer weet dit bestand niet van een les. */
export type GroepBoeking = Pick<Booking, 'id' | 'group_id' | 'start_time' | 'status' | 'participant_ids'>;

/** Het plan voor een roosterwijziging: wat er zou veranderen, nog niets weggeschreven. */
export interface RosterChangePlan {
  /** De groep zoals hij na de wijziging zou zijn. */
  group: LesGroep;
  /** Welke toekomstige boekingen hun participant_ids moeten krijgen bijgewerkt, en naar wat. */
  bookingPatches: Array<{ id: string; participant_ids: string[] }>;
}

const at = (b: GroepBoeking): number => new Date(b.start_time).getTime();

/**
 * Waarom deze lesgroep niet klopt, of `null` als hij deugt. Wordt gelezen terwijl iemand nog
 * aan het invullen is, dus de melding is een zin die op het scherm past en geen foutcode.
 *
 * De trainer is hier verplicht, ook al mag `coach_id` op de groep zelf leeg zijn: een import
 * levert groepen op waarvan de trainer nog gekoppeld moet worden, maar wie er met de hand een
 * aanmaakt weet wie hem geeft.
 *
 * Wat hier bewust NIET staat is een controle op een al bestaand moment (weekdag, beginuur en
 * baan — zie `groepSleutel`). Die sleutel dient om bij de import een groep te herkennen, niet om
 * er een te weigeren: twee groepen op hetzelfde uur mag — denk aan een tijdelijke tweede groep
 * tijdens een trainerswissel.
 */
export function lesGroepFout(g: Omit<LesGroep, 'id'>): string | null {
  if (g.name.trim().length === 0) return t('Geef de lesgroep een naam.');
  if (g.level.trim().length === 0) return t('Geef de lesgroep een niveau.');
  if (!Number.isInteger(g.weekday) || g.weekday < 0 || g.weekday > 6) {
    return t('Kies een lesdag van de week.');
  }
  if (!Number.isInteger(g.start_hour) || g.start_hour < 0 || g.start_hour > 23) {
    return t('Kies een beginuur tussen 0 en 23.');
  }
  if (!Number.isInteger(g.start_minute) || g.start_minute < 0 || g.start_minute > 59) {
    return t('Kies een beginminuut tussen 0 en 59.');
  }
  if (!g.coach_id) return t('Kies een trainer voor de lesgroep.');
  if (g.season_end < g.season_start) return t('Het seizoen eindigt voor het begint.');
  return null;
}

/**
 * Alle lessen van deze groep, het hele seizoen door, op tijd gesorteerd — ook de lessen die
 * al geweest zijn. Dit is de lijst voor een overzicht of een telling achteraf, niet de lijst
 * waar een wijziging op mag landen. Daarvoor is `komendeLessen`.
 */
export function lessenVanGroep<B extends GroepBoeking>(bookings: B[], groupId: string): B[] {
  return bookings.filter((b) => b.group_id === groupId).sort((a, b) => at(a) - at(b));
}

/**
 * De lessen van deze groep vanaf nu, op tijd gesorteerd.
 *
 * Nooit de eerdere: een les die al gegeven is, is geschiedenis en hoort niet mee te veranderen
 * omdat iemand de groep vandaag aanpast. Een les die precies op `now` begint telt wél mee
 * (`>=`), zodat de les van dit uur niet ontsnapt doordat hij toevallig net begonnen is —
 * dezelfde grens als `seriesFrom` in lib/series. Een onbekende groep levert niets op, geen
 * fout: een groep zonder lessen is een gewone toestand aan het begin van een seizoen.
 *
 * Afgezegde lessen blijven hier staan. Dit is de lijst om mee te tonen en te tellen, en een
 * afgezegde les hoort de trainer te zien; wie een wijziging wil doorvoeren neemt
 * `komendeLessen`.
 */
export function groupBookingsFrom<B extends GroepBoeking>(
  bookings: B[],
  groupId: string,
  now: Date,
): B[] {
  const vanaf = now.getTime();
  return bookings
    .filter((b) => b.group_id === groupId && at(b) >= vanaf)
    .sort((a, b) => at(a) - at(b));
}

/**
 * De lessen die er nog echt aankomen: `groupBookingsFrom` zonder de afgezegde.
 *
 * Een afgezegde les wordt nooit meer gegeven. Zou een roosterwijziging haar deelnemerslijst
 * toch overschrijven, dan veranderde de geschiedenis van die afzegging — er stond achteraf
 * iemand ingeschreven die er nooit voor afgezegd is — zonder dat iemand daar iets aan heeft.
 */
export function komendeLessen<B extends GroepBoeking>(
  bookings: B[],
  groupId: string,
  now: Date,
): B[] {
  return groupBookingsFrom(bookings, groupId, now).filter((b) => b.status !== 'cancelled');
}

/**
 * Wat er zou veranderen als de groep dit rooster kreeg: de groep zelf, plus per komende les
 * de nieuwe deelnemerslijst. Er wordt hier niets weggeschreven en niets gemuteerd — de
 * provider zet het plan in één keer weg, zodat groep en lessen nooit half bijgewerkt raken.
 *
 * `participant_ids` bevat nooit de betaler van de les; zie `participantIdsOf` in lib/groups.
 * De betaler van elke boeking blijft dus ongemoeid, ook als hij niet in het nieuwe rooster
 * staat.
 */
export function planRosterChange(
  group: LesGroep,
  newRoster: string[],
  bookings: GroepBoeking[],
  now: Date,
): RosterChangePlan {
  const raken = komendeLessen(bookings, group.id, now);
  return {
    group: { ...group, roster: [...newRoster] },
    bookingPatches: raken.map((b) => ({ id: b.id, participant_ids: [...newRoster] })),
  };
}

/** De velden die het verzetten nodig heeft; meer weet deze vraag niet van een les. */
export type VerzetBoeking = Pick<
  Booking,
  'id' | 'group_id' | 'coach_id' | 'taught_by_id' | 'court_id' | 'start_time' | 'end_time' | 'status'
>;

/**
 * Wat er aan één les verandert als de groep verzet wordt.
 *
 * `taught_by_id` staat hier met opzet NIET in. Een les die iemand anders al gaf, blijft van
 * hem, en zijn loon ook: de groep aan een andere trainer geven verschuift wie de les
 * toegewezen krijgt (`coach_id`), niet wie er die dag op de baan stond. Zie `lesgeverId` in
 * lib/lesgever, de enige plek die die tweede vraag beantwoordt.
 */
export interface VerzetPatch {
  id: string;
  start_time: string; // ISO
  end_time: string;   // ISO
  coach_id: string;
  court_id: string;
}

/**
 * Een komende les die het verzetten niet kan volgen, met de reden waarom.
 *
 * `'bezet'` stond hier tot 6 september 2026 ook bij en is weg: een overlap houdt een les niet
 * meer tegen, ze verhuist mee en komt in `botsingen` te staan. Wat overblijft zijn de twee
 * redenen die écht blokkeren — de club is dicht, of het moment is al geweest.
 */
export interface GeblokkeerdeLes {
  id: string;
  /** Het nieuwe moment dat voorgesteld werd — niet waar de les nu staat. */
  start_time: string;
  reden: 'vakantie' | 'verleden';
  /** De naam van de vakantie, als dat de reden was. */
  vakantie?: string;
}

/**
 * Een les die wél mee verhuist, maar op haar nieuwe plek overlapt met een andere les.
 *
 * De hele botsende boeking en niet enkel haar id: het scherm moet kunnen zeggen wáármee het
 * botst (lib/botsingen maakt er een zin van), en met alleen een id zou het die les eerst weer
 * moeten opzoeken in een lijst die het hier al had.
 */
export interface BotsendeVerzetting {
  id: string;
  /** Het nieuwe moment van de verhuizende les. */
  start_time: string;
  /** De bestaande les waarmee dat moment overlapt. */
  conflict: BezetBoeking;
}

/** Het plan voor een verzetting: wat er zou veranderen, en wat er niet kan. */
export interface GroepWijzigingPlan {
  /** De groep zoals hij na de wijziging zou zijn. */
  group: LesGroep;
  /** Per komende les die mee verhuist: het nieuwe uur, de trainer en de baan. */
  bookingPatches: VerzetPatch[];
  /** De komende lessen die niet mee kunnen, met de reden erbij. */
  geblokkeerd: GeblokkeerdeLes[];
  /**
   * De lessen uit `bookingPatches` die op hun nieuwe plek overlappen. Ze staan er dus twéé
   * keer in: hier als waarschuwing, en in `bookingPatches` omdat ze verzet worden. Wie deze
   * lijst niet toont verzet een groep stilzwijgend bovenop een andere.
   */
  botsingen: BotsendeVerzetting[];
}

/** De velden waarvan een wijziging een al ingeplande les raakt. */
const VERZETVELDEN = ['weekday', 'start_hour', 'start_minute', 'coach_id', 'court_id'] as const;

/** De weekdag in maandag-eerste telling, dezelfde leesvolgorde als het scherm. */
const maandagEerst = (weekday: number): number => (weekday + 6) % 7;

/**
 * Wat er zou veranderen als de groep naar een andere dag, een ander uur, een andere trainer
 * of een andere baan ging: per komende les een nieuw moment, of een melding waarom het niet
 * kan. Er wordt hier niets weggeschreven en niets gemuteerd — de provider zet het plan in één
 * keer weg, net als bij `planRosterChange`.
 *
 * Waarom ze bestaat: fase 1 verzette alleen de groepsrij zelf en geen enkele al ingeplande
 * les. De beheerder verplaatste zijn groep naar donderdag en zag zijn lessen op dinsdag staan.
 *
 * De grens die ze bewaakt: alleen vooruit, en nooit `taught_by_id`. Een les die al gegeven is
 * hoort bij de geschiedenis van de club, en wie er echt lesgaf staat los van wie de les
 * toegewezen krijgt.
 */
export function planGroepWijziging(
  group: LesGroep,
  patch: Partial<Omit<LesGroep, 'id' | 'roster'>>,
  bookings: VerzetBoeking[],
  now: Date,
  /** De clubkalender; leeg betekent "het hele jaar door les", zoals in `planSeries`. */
  vakanties: Vakantie[] = [],
): GroepWijzigingPlan {
  const nieuw: LesGroep = { ...group, ...patch };
  const leeg: GroepWijzigingPlan = {
    group: nieuw, bookingPatches: [], geblokkeerd: [], botsingen: [],
  };

  // Naam, niveau en seizoen raken geen enkele les: alleen deze vijf velden bepalen waar en
  // bij wie een les staat.
  if (VERZETVELDEN.every((veld) => nieuw[veld] === group[veld])) return leeg;

  const raken = komendeLessen(bookings, group.id, now);
  // Een groep botst niet met zichzelf: haar eigen komende lessen staan op hun oude uur nog in
  // de lijst, en zonder deze uitzondering zou elke verschuiving van zichzelf zeggen dat ze
  // niet kan.
  const negeer = new Set(raken.map((b) => b.id));
  const verschil = maandagEerst(nieuw.weekday) - maandagEerst(group.weekday);
  const vanaf = now.getTime();

  const bookingPatches: VerzetPatch[] = [];
  const geblokkeerd: GeblokkeerdeLes[] = [];
  const botsingen: BotsendeVerzetting[] = [];

  for (const les of raken) {
    const oud = new Date(les.start_time);
    // Uitsluitend met dag-, uur- en minuutvelden rekenen. Bij "168 uur erbij" staat de les van
    // ná de uurwissel ineens om 09:00 of 11:00 — zie de kop van lib/recurrence.
    const beginDatum = new Date(
      oud.getFullYear(), oud.getMonth(), oud.getDate() + verschil,
      nieuw.start_hour, nieuw.start_minute, 0, 0,
    );
    // De duur van déze les, niet de clubinstelling: `lesson_duration_minutes` telt
    // uitdrukkelijk niet met terugwerkende kracht (zie het commentaar bij dat veld).
    const duurMinuten = (new Date(les.end_time).getTime() - oud.getTime()) / 60000;
    const eindDatum = new Date(
      oud.getFullYear(), oud.getMonth(), oud.getDate() + verschil,
      nieuw.start_hour, nieuw.start_minute + duurMinuten, 0, 0,
    );
    const start_time = beginDatum.toISOString();

    if (beginDatum.getTime() < vanaf) {
      geblokkeerd.push({ id: les.id, start_time, reden: 'verleden' });
      continue;
    }
    // De vakantie eerst: is de club dicht, dan doet het er niet meer toe of de trainer dan ook
    // nog bezet was — exact de volgorde van `planSeries`.
    const vakantie = vakantieOpMoment(vakanties, start_time);
    if (vakantie) {
      geblokkeerd.push({ id: les.id, start_time, reden: 'vakantie', vakantie: vakantie.naam });
      continue;
    }
    // De botsing houdt de les niet meer tegen: hij verhuist mee en wordt gemeld. Bij het
    // kleutertennis van deze club delen blauw en rood één half Terrein 7 en draait dezelfde
    // trainer er twee groepen naast elkaar — vroeger bleef zo'n groep bij een verzetting
    // stilletjes op haar oude dag staan, terwijl het scherm zei dat ze verhuisd was.
    const conflict = botstMet(
      { start_time, end_time: eindDatum.toISOString() },
      bookings,
      { coachId: nieuw.coach_id ?? les.coach_id, courtId: nieuw.court_id, negeer },
    );
    if (conflict) botsingen.push({ id: les.id, start_time, conflict });
    bookingPatches.push({
      id: les.id,
      start_time,
      end_time: eindDatum.toISOString(),
      coach_id: nieuw.coach_id ?? les.coach_id,
      // Een groep zonder baan haalt de baan van een les niet weg: een boeking heeft er een nodig.
      court_id: nieuw.court_id ?? les.court_id,
    });
  }

  return { group: nieuw, bookingPatches, geblokkeerd, botsingen };
}

/**
 * De sleutel waaraan een groep te herkennen is: haar moment. Lesdag, beginuur en baan — en
 * uitdrukkelijk niet haar naam.
 *
 * DIT IS DE ENIGE SLEUTEL, OOK VOOR DE IMPORT. Buiten deze definitie is er precies één caller:
 * `lib/import-trainingen.ts`. Verder alleen de twee testbestanden `lib/lesgroepen.test.ts` en
 * `lib/import-trainingen.test.ts`. Er is geen scherm en geen provider die op de oude vorm rekent
 * — dat is nagekeken en niet aangenomen, dus deze functie mag voor iedereen tegelijk wijzigen.
 * Dat moet ook: een tweede, net iets andere sleutel naast deze zou betekenen dat de import
 * morgen een groep herkent die de app zelf niet herkent, of andersom.
 *
 * WAAROM DE NAAM ERUIT GAAT. Bij deze club komt de kolom `Groep` uit het Tennis
 * Vlaanderen-systeem. In `koen.xlsx` staat "Groep 8" op drie momenten met twaalf verschillende
 * mensen en nul overlap: het is een administratief label dat hergebruikt wordt, geen groep
 * mensen. Hem meetellen maakte van één groep drie, en van een trainerswissel een nieuwe groep
 * in plaats van een wijziging aan de bestaande. Dat laatste is de bug die deze fase wegneemt.
 * De naam is voortaan een eigenschap van de groep en niet haar identiteit — de beheerder mag
 * hem bewerken zonder dat de volgende import haar niet meer terugvindt.
 *
 * WAAROM DE BAAN ERIN KOMT. Zolang de club één trainer heeft volstaat lesdag + beginuur, maar
 * met meerdere trainers geven er twee tegelijk les op verschillende terreinen. De baan is dan
 * het enige dat die twee groepen uit elkaar houdt.
 *
 * De beginminuut telt niet mee, net zomin als vroeger: twee groepen op 17:00 en 17:15 vallen
 * samen. Dat is de bestaande, aanvaarde grofheid van deze sleutel.
 *
 * En nog steeds: dit is een herkenningssleutel om een groep uit een geïmporteerde planning terug
 * te vinden, en geen uniciteitsregel. `lesGroepFout` weigert geen tweede groep op dezelfde
 * sleutel — twee groepen op hetzelfde uur mag.
 */
export function groepSleutel(g: Pick<LesGroep, 'weekday' | 'start_hour' | 'court_id'>): string {
  return `${g.weekday}|${g.start_hour}|${g.court_id ?? ''}`;
}

/** De groepen die de club dit moment lesgeeft. */
export function actieveGroepen(groepen: LesGroep[]): LesGroep[] {
  return groepen.filter((g) => !g.archived);
}

/**
 * De groepen van een afgelopen seizoen. Ze blijven opvraagbaar in plaats van te verdwijnen:
 * hun lessen staan er nog, en wie er volgend jaar naar terugkijkt hoort te zien bij welke
 * groep die lessen hoorden.
 */
export function gearchiveerdeGroepen(groepen: LesGroep[]): LesGroep[] {
  return groepen.filter((g) => g.archived);
}
