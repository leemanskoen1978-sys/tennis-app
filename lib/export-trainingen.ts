// De bladen van het exportbestand voor de trainingen: puur rekenwerk dat een werkmap
// samenstelt uit gegevens die het scherm al geladen heeft — geen databank, geen scherm, en
// daarom te testen zonder allebei.
//
// Dit bestand rekent zelf geen loon, geen prijs en geen lesgever uit. Het vraagt dat aan
// `lib/reports`, `lib/payments` en `lib/lesgever`, want twee antwoorden op dezelfde vraag
// lopen vroeg of laat uit elkaar — en in een bestand dat de club doorstuurt merkt niemand
// dat het antwoord van gisteren was.

import { isoWeeknummer } from './datetime';
import { groupSize, lessonPlayerIds } from './groups';
import { t } from './i18n';
import { lesgeverId } from './lesgever';
import { bookingMinutes } from './payments';
import { countedBookings, payoutsByCoach } from './reports';
import { bookingStatusLabel } from './status';
import { type XlsxBlad, type XlsxCel } from './xlsx';
import type { Booking, Court, LesGroep, User } from './types';

/**
 * Eén kolom van een blad: kop én cel naast elkaar, naar het model van `CsvColumn` in
 * `lib/csv.ts`. Zo kunnen de koprij en de inhoud niet uit elkaar schuiven als er een kolom
 * bij komt of van plaats verandert.
 */
export interface ExportKolom<R> {
  /** De kop zoals hij letterlijk in het bestand komt — zie `koppenVan` voor waarom niet vertaald. */
  label: string;
  /** De cel als tekst. Dit is ook de terugval als de waarde hieronder onbruikbaar blijkt. */
  value: (r: R) => string;
  /** De cel als getal. Ontbreekt = het blijft tekst. */
  getal?: (r: R) => number;
  /** Zet de cel op een bedrag met twee decimalen. Alleen zinnig samen met `getal`. */
  geld?: boolean;
  /** De cel als echte datum, zodat Excel erop kan sorteren. */
  datum?: (r: R) => Date;
  /** Kolombreedte in tekens. */
  breedte: number;
}

/**
 * De rijen van een blad: per item één rij cellen, in de volgorde van de kolomtabel.
 *
 * Eén celvertaler voor alle bladen, letterlijk de logica van `lib/csv.ts::toXlsx`: een datum
 * blijft een datum en een getal een getal, want dat is de hele reden dat `lib/xlsx.ts`
 * bestaat (D-03). Vier eigen celbouwers zouden vier keer anders met een kapotte waarde
 * omgaan.
 *
 * Een onbruikbare datum of een getal dat geen getal is valt terug op de tekstvorm van die
 * kolom: beter een leesbare cel die niet meesorteert dan een cel met 1899 erin.
 *
 * Geëxporteerd omdat de test de terugval rechtstreeks naloopt, op de regel zelf en niet via
 * een blad dat toevallig een datumkolom heeft.
 */
export function naarRijen<R>(
  kolommen: readonly ExportKolom<R>[],
  items: readonly R[],
): XlsxCel[][] {
  return items.map((r) => kolommen.map((c): XlsxCel => {
    if (c.datum) {
      const d = c.datum(r);
      if (!Number.isNaN(d.getTime())) return { soort: 'datum', waarde: d };
    }
    if (c.getal) {
      const n = c.getal(r);
      if (Number.isFinite(n)) return { soort: c.geld ? 'geld' : 'getal', waarde: n };
    }
    return { soort: 'tekst', waarde: c.value(r) };
  }));
}

/**
 * De koprij, letterlijk zoals de labels er staan — bewust zónder `t()`, waar
 * `lib/csv.ts::csvHeader` dat wél doet.
 *
 * Het verschil is wat het bestand ís. De maandexport van `lib/csv.ts` is een overzicht om te
 * lezen; dit is een bestandsformaat. De import van fase 5 leest deze koprij om te bepalen
 * welke kolom waar staat (`.planning/IMPORT-SJABLOON.md`). Stond hier `t()`, dan zou een
 * beheerder die de app op Engels heeft staan een bestand maken dat de app zelf niet meer kan
 * inlezen — en dat merkt hij pas bij de herimport, als de helft van de club verdubbelt
 * (EXP-07).
 */
export function koppenVan<R>(kolommen: readonly ExportKolom<R>[]): string[] {
  return kolommen.map((c) => c.label);
}

/** De drie tabellen die elk blad nodig heeft om een id in een naam om te zetten. */
export interface Opzoektabellen {
  gebruikerById: Map<string, User>;
  baanById: Map<string, Court>;
  groepById: Map<string, LesGroep>;
}

/**
 * De opzoektabellen, één keer gebouwd en daarna hergebruikt door elk blad.
 *
 * Niet uit netheid: een seizoen van de club is enkele duizenden rijen (één regel per les ×
 * leerling — `koen.xlsx` is er 1398 voor één trainer alleen). Een `.find()` per rij over de
 * ledenlijst maakt daar een kwadratische zoektocht van, en dat is precies het soort traagheid
 * dat pas op het echte seizoen zichtbaar wordt en niet op een testbestand van tien regels.
 */
export function opzoektabellen(
  users: readonly User[],
  courts: readonly Court[],
  groepen: readonly LesGroep[],
): Opzoektabellen {
  return {
    gebruikerById: new Map(users.map((u) => [u.id, u])),
    baanById: new Map(courts.map((c) => [c.id, c])),
    groepById: new Map(groepen.map((g) => [g.id, g])),
  };
}

// ---------------------------------------------------------------------------
// Blad "Lessen" — het kolomformaat dat de import van fase 5 leest
//
// Eén regel per les × leerling, precies zoals `koen.xlsx` het al jaren doet: een groepsles van
// zes staat er als zes regels met dezelfde datum en hetzelfde uur. Zie
// `.planning/IMPORT-SJABLOON.md`; dat bestand is bindend, dit is de schrijfkant ervan.
// ---------------------------------------------------------------------------

/**
 * De Nederlandse weekdagnamen als vaste tabel, en met opzet niet uit `toLocaleDateString`.
 *
 * Deze kolom hoort bij een bestandsformaat en mag niet met de taalinstelling van de app of
 * met de landinstelling van de telefoon meebewegen: hetzelfde seizoen op twee toestellen
 * geëxporteerd moet twee gelijke bestanden opleveren. `Date#getDay` telt vanaf zondag.
 */
const WEEKDAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

function twee(n: number): string {
  return String(n).padStart(2, '0');
}

function uur(d: Date | null): string {
  return d ? `${twee(d.getHours())}:${twee(d.getMinutes())}` : '';
}

function geldigeDatum(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Eén uitgeklapte regel: één les, één leerling. Zestien kolommen, allemaal al opgezocht. */
interface LesRij {
  /** Het begin van de les; hieruit komt de datumcel, en `datum` is de tekstvorm ervan. */
  start: Date | null;
  datum: string;
  weekdag: string;
  weeknr: number | null;
  uur: string;
  einduur: string;
  typeLes: string;
  groep: string;
  groepId: string;
  /** De TOEGEWEZEN trainer: van wie deze les is. */
  coach: string;
  /** Wie hem WERKELIJK gaf — via `lesgeverId`, zie de toelichting bij `lesRijen`. */
  gafDeLes: string;
  leerling: string;
  emailLeerling: string;
  baan: string;
  binnenBuiten: string;
  spelers: number;
  status: string;
}

/**
 * De lessen uitgeklapt naar één rij per leerling, op tijd oplopend.
 *
 * Eén gang over de gesorteerde boekingen, met de opzoektabellen die er al liggen: een seizoen
 * is enkele duizenden rijen en een `.find()` per rij maakt daar een kwadratische zoektocht
 * van. De meegegeven lijst blijft ongemoeid — het scherm sorteert zelf anders.
 */
function lesRijen(bookings: readonly Booking[], tabellen: Opzoektabellen): LesRij[] {
  const { gebruikerById, baanById, groepById } = tabellen;

  return [...bookings]
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .flatMap((b) => {
      const start = geldigeDatum(b.start_time);
      const eind = geldigeDatum(b.end_time);
      const groep = b.group_id ? groepById.get(b.group_id) : undefined;
      // Een baan die er niet meer is, is iets anders dan een les zonder baan: de eerste
      // heet "Onbekend" (de les vond wél op een baan plaats), de tweede blijft leeg zoals
      // het sjabloon voorschrijft. Indoor/Outdoor kan in beide gevallen niets zeggen (D-10).
      const baan = b.court_id ? baanById.get(b.court_id) : undefined;
      // Wie de les gaf komt uitsluitend uit `lesgeverId` (lib/lesgever) — de enige plek die
      // die vraag beantwoordt. Wie hier de velden van de boeking zelf zou uitlezen, zet een
      // tweede antwoord naast het eerste en krijgt dat gat terug op de dag dat de regel
      // verandert: dan staat de vaste trainer in het bestand voor een les die zijn vervanger
      // gaf, en gaat de uitbetaling daarop mee.
      const gever = gebruikerById.get(lesgeverId(b));
      const spelers = groupSize(b);
      const gedeeld = {
        start,
        datum: start ? `${twee(start.getDate())}/${twee(start.getMonth() + 1)}/${start.getFullYear()}` : '',
        weekdag: start ? WEEKDAGEN[start.getDay()] : '',
        weeknr: isoWeeknummer(b.start_time),
        uur: uur(start),
        einduur: uur(eind),
        // Geen groep is geen fout maar een gewone privéles (D-08): een lege `Groep` zegt bij
        // de herimport "maak hier geen lesgroep van", en `Type les` zegt wat het wél was.
        typeLes: groep?.level ?? (b.group_id ? t('Onbekend') : 'Privéles'),
        groep: groep?.name ?? '',
        groepId: b.group_id ?? '',
        coach: gebruikerById.get(b.coach_id)?.name ?? t('Onbekend'),
        gafDeLes: gever?.name ?? t('Onbekend'),
        baan: b.court_id ? baan?.name ?? t('Onbekend') : '',
        binnenBuiten: baan ? (baan.indoor ? 'Indoor' : 'Outdoor') : '',
        spelers,
        status: bookingStatusLabel(b.status),
      };

      // De betaler voorop, dan de deelnemers — `lessonPlayerIds` is de enige plek die weet
      // wie er meedeed. Een speler die uit de ledenlijst verdwenen is houdt zijn regel: de
      // les is gegeven, en een verwijderd account maakt dat niet ongedaan.
      return lessonPlayerIds(b).map((spelerId): LesRij => {
        const speler = gebruikerById.get(spelerId);
        return {
          ...gedeeld,
          leerling: speler?.name ?? t('Onbekend'),
          emailLeerling: speler?.email ?? '',
        };
      });
    });
}

/**
 * De zestien kolommen van blad "Lessen", letterlijk zoals `.planning/IMPORT-SJABLOON.md` ze
 * noemt. Hernoemen, weglaten of erbij verzinnen breekt de herimport (EXP-07).
 *
 * `Locatie` staat er bewust niet bij (D-09): de app kent geen locatiebegrip en er is geen bron
 * voor. Een kolom vullen met verzonnen inhoud is erger dan hem weglaten; bij het inlezen
 * blijft hij een genegeerde kolom, zodat `koen.xlsx` ongewijzigd binnenkomt.
 */
const LESSEN_KOLOMMEN: readonly ExportKolom<LesRij>[] = [
  { label: 'Datum', value: (r) => r.datum, datum: (r) => r.start ?? new Date(NaN), breedte: 12 },
  { label: 'Weekdag', value: (r) => r.weekdag, breedte: 11 },
  {
    label: 'Weeknr', value: (r) => (r.weeknr === null ? '' : String(r.weeknr)),
    getal: (r) => r.weeknr ?? NaN, breedte: 8,
  },
  { label: 'Uur', value: (r) => r.uur, breedte: 8 },
  { label: 'Einduur', value: (r) => r.einduur, breedte: 9 },
  { label: 'Type les', value: (r) => r.typeLes, breedte: 16 },
  { label: 'Groep', value: (r) => r.groep, breedte: 16 },
  // Het interne kenmerk van de lesgroep. Hierdoor herkent een herimport de groep ook als de
  // naam of het uur veranderd is — zonder deze kolom verdubbelt hij de halve club.
  { label: 'Groep-ID', value: (r) => r.groepId, breedte: 38 },
  { label: 'Coach', value: (r) => r.coach, breedte: 18 },
  { label: 'Gaf de les', value: (r) => r.gafDeLes, breedte: 18 },
  { label: 'Leerling', value: (r) => r.leerling, breedte: 22 },
  { label: 'E-mail leerling', value: (r) => r.emailLeerling, breedte: 26 },
  { label: 'Baan', value: (r) => r.baan, breedte: 14 },
  { label: 'Indoor/Outdoor', value: (r) => r.binnenBuiten, breedte: 15 },
  { label: 'Spelers', value: (r) => String(r.spelers), getal: (r) => r.spelers, breedte: 9 },
  { label: 'Status', value: (r) => r.status, breedte: 20 },
];

/**
 * Blad "Lessen": elke les van de gekozen periode, uitgeklapt naar één regel per leerling.
 *
 * De tabnaam is een vaste Nederlandse waarde en gaat net als de koprij niet door `t()` — de
 * import zoekt dit blad terug op zijn naam, en een tab die "Lessons" heet zou een export
 * onleesbaar maken voor de app die hem schreef.
 */
export function bladLessen(bookings: readonly Booking[], tabellen: Opzoektabellen): XlsxBlad {
  return {
    naam: 'Lessen',
    koppen: koppenVan(LESSEN_KOLOMMEN),
    breedtes: LESSEN_KOLOMMEN.map((c) => c.breedte),
    rijen: naarRijen(LESSEN_KOLOMMEN, lesRijen(bookings, tabellen)),
  };
}

// ---------------------------------------------------------------------------
// Blad "Uren per trainer" — het loonrapport van Beheer, in het bestand
//
// Dit blad rekent geen enkel bedrag zelf uit. Trainer, lessen en loon komen regel voor regel
// uit `payoutsByCoach` (lib/reports), de enige plek die weet wie welke les gaf en wat hij
// daarvoor krijgt. Twee implementaties van diezelfde vraag lopen uiteen zodra er één loonregel
// verandert, en dan toont het scherm het ene bedrag en het doorgestuurde bestand het andere.
// ---------------------------------------------------------------------------

/**
 * De gegeven minuten per lesgever, en daarna omgerekend naar uren.
 *
 * Dit is de enige nieuwe berekening op dit blad, en ze mag omdat het uren zijn en geen geld:
 * `lib/reports.ts` telt de uren nergens op, maar de duur zelf komt onveranderd uit
 * `bookingMinutes` (lib/payments) en de groepering gebruikt exact dezelfde sleutel
 * (`lesgeverId`) en exact dezelfde lessenselectie (`countedBookings`) als `payoutsByCoach`.
 * Daardoor kunnen de kolom "Uren" en de kolom "Lessen" niet uit elkaar lopen: ze tellen per
 * definitie dezelfde lessen.
 *
 * De minuten worden eerst opgeteld en pas op het einde gedeeld — per les afronden laat een
 * seizoen van les-van-vijftig-minuten centimeters verschuiven. Twee decimalen, want een
 * cel met 0,8333333333333334 erin leest niemand.
 */
function urenPerLesgever(bookings: Booking[]): Map<string, number> {
  const minuten = new Map<string, number>();
  for (const b of countedBookings(bookings)) {
    const lesgever = lesgeverId(b);
    minuten.set(lesgever, (minuten.get(lesgever) ?? 0) + bookingMinutes(b));
  }
  return new Map([...minuten].map(([id, m]) => [id, Math.round((m / 60) * 100) / 100]));
}

/** Eén regel van het loonoverzicht: wat er van deze trainer op het blad komt. */
interface UrenRij {
  naam: string;
  lessen: number;
  uren: number;
  /** Letterlijk `CoachTotal.amount` — hier wordt niets bijgeteld of afgetrokken. */
  loon: number;
  /** De zichtbare waarschuwing bij een ontbrekend uurtarief; leeg als er niets aan de hand is. */
  letOp: string;
}

/**
 * Het loonrapport als rijen, met de uren erbij.
 *
 * Eén `.map()` over `payoutsByCoach` en met opzet géén tweede sortering: dat rapport sorteert
 * al aflopend op bedrag en bij een gelijk bedrag op naam. Wie hier opnieuw sorteert, laat het
 * bestand in een andere volgorde staan dan Beheer → Rapport, en dan lijken twee overzichten
 * van dezelfde periode iets anders te zeggen.
 */
function urenRijen(bookings: Booking[], users: User[]): UrenRij[] {
  const uren = urenPerLesgever(bookings);
  return payoutsByCoach(bookings, users).map((r) => ({
    naam: r.name,
    lessen: r.lessons,
    uren: uren.get(r.coachId) ?? 0,
    loon: r.amount,
    // Wél door `t()`, anders dan de koppen: dit is schermtekst voor wie het bestand leest en
    // geen kolomnaam die de import terugzoekt. Een vergeten tarief moet opvallen — €0,00 zonder
    // melding is niet te onderscheiden van een trainer die gratis werkt.
    letOp: r.missingRate ? t('Geen uurtarief ingevuld') : '',
  }));
}

/**
 * De vijf kolommen van blad "Uren per trainer".
 *
 * Er staat hier bewust GEEN omzetkolom (D-05). De omzet loopt op het uurtarief van de baan —
 * wat de speler betaalt — en het loon op dat van de trainer — wat hij krijgt. Die twee
 * bedragen naast elkaar op één blad is precies hoe ze in elkaar schuiven: iemand telt de
 * verkeerde kolom op en de club denkt dat ze verlies maakt of dat een trainer te veel kreeg.
 * Wie omzet wil, vindt ze in Beheer → Rapport, waar ze met haar eigen uitleg staat.
 */
const UREN_KOLOMMEN: readonly ExportKolom<UrenRij>[] = [
  { label: 'Trainer', value: (r) => r.naam, breedte: 22 },
  { label: 'Lessen', value: (r) => String(r.lessen), getal: (r) => r.lessen, breedte: 9 },
  { label: 'Uren', value: (r) => String(r.uren), getal: (r) => r.uren, breedte: 9 },
  {
    label: 'Loon (EUR)', value: (r) => String(r.loon),
    getal: (r) => r.loon, geld: true, breedte: 13,
  },
  { label: 'Let op', value: (r) => r.letOp, breedte: 26 },
];

/**
 * Blad "Uren per trainer": per trainer het aantal lessen, de gegeven uren en het loon over de
 * gekozen periode, gerekend op wie de les werkelijk gaf.
 *
 * De tabnaam is net als bij blad "Lessen" een vaste Nederlandse waarde en gaat niet door
 * `t()`: het bestand hoort op elk toestel hetzelfde te heten.
 */
export function bladUrenPerTrainer(bookings: Booking[], users: User[]): XlsxBlad {
  return {
    naam: 'Uren per trainer',
    koppen: koppenVan(UREN_KOLOMMEN),
    breedtes: UREN_KOLOMMEN.map((c) => c.breedte),
    rijen: naarRijen(UREN_KOLOMMEN, urenRijen(bookings, users)),
  };
}
