// Een seizoen trainingen uit Excel omzetten naar lesgroepen, spelers en lessen.
//
// Wat hier staat is alle regelgeving van de trainingenimport en niets anders: geen databank,
// geen scherm, geen bestand. Het scherm geeft rijen tekst plus de huidige lijsten van de club,
// en krijgt een plan terug van wat er zou gebeuren. Dat is waarom de beheerder het resultaat
// ziet vóór er iets weggeschreven wordt — en waarom die belofte hier te testen valt (D-10),
// op dezelfde manier als `lib/import-leden.ts` dat voor de ledenlijst doet.
//
// De kolommen liggen vast in `.planning/IMPORT-SJABLOON.md`; dit bestand is de enige plek waar
// ze in code staan. Ook het sjabloon dat de beheerder kan downloaden staat hier: dat is
// dezelfde kolomtabel van de andere kant bekeken, en die twee uit elkaar laten lopen zou
// betekenen dat de app haar eigen voorbeeldbestand niet meer leest.

import { GROEPSLES_METHOD } from './beurtenkaart';
import { normalizeEmail } from './contact';
import { actieveGroepen, groepSleutel, groupBookingsFrom, lesGroepFout } from './lesgroepen';
import { botstMet } from './recurrence';
import { normalizeName, zelfdeNaamOngeachtVolgorde, zoekOpNaam } from './students';
import type {
  Booking, BookingStatus, Court, LesGroep, PaymentMethod, Settings, User, Vakantie,
} from './types';
import { dagSleutel, vakantieOpMoment } from './vakanties';
import { buildXlsx, type XlsxCel } from './xlsx';
import { fractieNaarTijd, serieNaarDatum, type GelezenBlad } from './xlsx-lezen';

/** Waar staat welke kolom? De index per veld; ontbrekende optionele kolommen staan er niet in. */
export interface KolommenLessen {
  datum: number;
  uur: number;
  groep: number;
  coach: number;
  leerling: number;
  groepId?: number;
  typeLes?: number;
  emailLeerling?: number;
  baan?: number;
}

// Knoopt LESSEN_KOPPEN vast aan de velden van `KolommenLessen`: een kop die daar niet in past,
// is een tikfout in dit bestand en geeft een compilefout in plaats van een stille breuk bij het
// draaien van de import. Een gewone functie in plaats van `satisfies`, want Jest's
// Babel-transform kan (nog) niet overweg met dat trefwoord.
//
// Dit vangt alleen een veld dat er niet hoort te zijn, niet een veld dat vergeten is: `T` mag
// een deelverzameling van `keyof KolommenLessen` zijn. Dat alle negen kolommen in het sjabloon
// staan, moet het voorbeeldbestand dus zelf met een test aantonen.
function metKolomvelden<T extends readonly (keyof KolommenLessen)[]>(koppen: T): T {
  return koppen;
}

/** De velden van een lesregel, in de volgorde waarin het sjabloon ze zet. */
export const LESSEN_KOPPEN = metKolomvelden([
  'datum', 'uur', 'typeLes', 'groep', 'groepId', 'coach', 'leerling', 'emailLeerling', 'baan',
] as const);

/**
 * De koppen die een kolom aanwijzen, met de schrijfwijzen die we aannemen. De kop wordt eerst
 * klein gemaakt en van spaties ontdaan — ook de spaties er middenin — dus `Type les`,
 * `type les` en `Typeles` komen alle drie op `typeles` uit en staan hier één keer.
 *
 * De negen koppen zoals ze in `.planning/IMPORT-SJABLOON.md` en in het sjabloon gespeld staan:
 * verplicht `Datum`, `Uur`, `Groep`, `Coach`, `Leerling`; optioneel `Groep-ID`, `Type les`,
 * `E-mail leerling`, `Baan`.
 *
 * Een `Map` in plaats van een object-literal, om dezelfde twee redenen als in
 * `lib/import-leden.ts`: een gewoon object erft van `Object.prototype`, dus `{}['constructor']`
 * levert de functie `Object` op in plaats van `undefined` — geen ingebouwde Object-eigenschap
 * kan hier ooit een kolom lijken te zijn. En de sleutel/waarde-typen blijven bij het compileren
 * gecontroleerd, wat `Object.create(null)` (dat `any` teruggeeft) niet doet.
 */
const KOPNAMEN_LESSEN = new Map<string, keyof KolommenLessen>([
  ['datum', 'datum'],
  ['date', 'datum'],
  ['uur', 'uur'],
  ['beginuur', 'uur'],
  ['startuur', 'uur'],
  ['tijd', 'uur'],
  ['groep', 'groep'],
  ['lesgroep', 'groep'],
  ['groepid', 'groepId'],
  ['groep-id', 'groepId'],
  ['groepsid', 'groepId'],
  ['typeles', 'typeLes'],
  ['lestype', 'typeLes'],
  ['soortles', 'typeLes'],
  ['niveau', 'typeLes'],
  ['coach', 'coach'],
  ['trainer', 'coach'],
  ['lesgever', 'coach'],
  ['leerling', 'leerling'],
  ['speler', 'leerling'],
  ['emailleerling', 'emailLeerling'],
  ['e-mailleerling', 'emailLeerling'],
  ['leerlingemail', 'emailLeerling'],
  ['leerlinge-mail', 'emailLeerling'],
  ['emailadresleerling', 'emailLeerling'],
  ['baan', 'baan'],
  ['terrein', 'baan'],
  ['court', 'baan'],
]);

/**
 * Koppen die we lezen en bewust laten liggen. Ze staan apart van "onbekend" omdat ze in
 * `koen.xlsx` staan (`Weekdag`, `Weeknr`, `Locatie`, `Indoor/Outdoor`) en in wat de export van
 * fase 4 schrijft (daar komen `Einduur`, `Gaf de les`, `Spelers` en `Status` bij). Zou de
 * import ze als "niet herkend" melden, dan opent élke echte import — ook de eigen export die er
 * ongewijzigd weer in moet kunnen — met een lijstje ruis, en dan leest niemand dat lijstje nog
 * op de dag dat er wél een echte tikfout in staat.
 *
 * Schoongemaakte vorm: klein, zonder spaties. `indoor/outdoor` houdt zijn schuine streep, want
 * dat is geen spatie.
 */
const KOPPEN_GENEGEERD = new Set([
  'weekdag',
  'weeknr',
  'weeknummer',
  'einduur',
  'locatie',
  'indoor/outdoor',
  'gafdeles',
  'spelers',
  'status',
]);

/**
 * Het resultaat van het lezen van de koprij: niet alleen waar de kolommen staan, maar ook welke
 * koppen er stonden en niets betekenden. Dat laatste is geen bijzaak: een kop die stil genegeerd
 * wordt (een beheerder die `Groepsnaam` typt in plaats van `Groep`) levert een import op die er
 * goed uitziet en toch elke groep verkeerd samenstelt. Het scherm toont `nietHerkend` en
 * `dubbel` daarom vóór er iets wordt weggeschreven.
 *
 * `kolommen` blijft ook `null` als een verplichte kolom ontbreekt — maar `nietHerkend` en
 * `dubbel` worden dan wél gevuld. Juist in dat geval is de melding zonder die lijstjes
 * onbruikbaar: "verplichte kolom ontbreekt" zegt een beheerder niets, "ik mis Coach, en ik zag
 * wel een kolom Trainer die ik niet herken" wél.
 */
export interface KopregelLessen {
  /** `null` als een van de vijf verplichte kolommen ontbreekt: dan valt er niets te importeren. */
  kolommen: KolommenLessen | null;
  /** Koppen die er stonden en die we niet thuis konden brengen, precies zoals in het bestand. */
  nietHerkend: string[];
  /** Koppen die we herkenden, maar niet lazen omdat diezelfde kolom er al was. */
  dubbel: string[];
}

/** De schoongemaakte vorm van een kop: klein, zonder spaties eromheen en zonder spaties erin. */
function schoneKop(kop: string): string {
  return kop.trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * De koprij lezen. `Datum`, `Uur`, `Groep`, `Coach` en `Leerling` zijn verplicht (D-04) — zonder
 * een van die vijf valt er geen les te bouwen — maar zelfs dan geven we terug wat we wél zagen,
 * zodat het scherm kan zeggen wat er moet veranderen.
 */
export function leesKopregelLessen(kopregel: readonly string[]): KopregelLessen {
  const gevonden: Partial<Record<keyof KolommenLessen, number>> = {};
  const nietHerkend: string[] = [];
  const dubbel: string[] = [];
  kopregel.forEach((kop, i) => {
    const schoon = schoneKop(kop);
    if (!schoon) return; // een lege kop is geen kop, en dus ook geen vergissing.
    if (KOPPEN_GENEGEERD.has(schoon)) return;
    const veld = KOPNAMEN_LESSEN.get(schoon);
    if (!veld) {
      nietHerkend.push(kop.trim());
      return;
    }
    if (gevonden[veld] === undefined) {
      gevonden[veld] = i;
    } else {
      // De eerste kolom met deze naam wint; een tweede is een vergissing, geen overschrijving.
      // Zo kan een kolomkop die op een andere lijkt nooit stilzwijgend een eerdere kolom
      // overnemen (T-05-08).
      dubbel.push(kop.trim());
    }
  });
  const { datum, uur, groep, coach, leerling } = gevonden;
  const compleet = datum !== undefined && uur !== undefined && groep !== undefined
    && coach !== undefined && leerling !== undefined;
  const kolommen = compleet
    ? { ...gevonden, datum, uur, groep, coach, leerling }
    : null;
  return { kolommen, nietHerkend, dubbel };
}

/** Eén regel die niet verwerkt wordt, met de reden in gewone taal. */
export interface ImportFoutLessen {
  /** Het regelnummer zoals de beheerder het in Excel ziet: de koprij is regel 1. */
  regel: number;
  /**
   * De reden, als vaste zin met eventuele plaatshouders van de vorm `{waarde}` — nooit als
   * kant-en-klare tekst met een waarde er al in geplakt. Plakte deze module de waarde er zelf
   * in, dan kreeg elke regel een eigen, unieke sleutel die nooit vertaald kan worden. Het scherm
   * doet `t(reden, vars)`, precies zoals `lib/i18n.ts` bedoeld is.
   */
  reden: string;
  /** De waarden voor de plaatshouders in `reden`. Ontbreekt bij een reden zonder plaatshouder. */
  vars?: Record<string, string | number>;
}

/**
 * Is dit hele bestand afgekeurd, in plaats van een paar regels erin?
 *
 * Zo'n uitkomst heeft precies één fout, op regel 1 (de koprij), en geen enkele regel die wél
 * doorging: dat gebeurt alleen bij een leeg bestand of een koprij zonder een van de vijf
 * verplichte kolommen. Het scherm moet dat lezen als "dit bestand deugt niet" en niet als "deze
 * ene regel wordt overgeslagen" — de twee gevallen vragen om een ander soort melding.
 */
export function bestandAfgekeurdLessen(
  uitkomst: { regels: readonly unknown[]; fouten: readonly ImportFoutLessen[] },
): boolean {
  return (
    uitkomst.regels.length === 0
    && uitkomst.fouten.length === 1
    && uitkomst.fouten[0].regel === 1
  );
}

// ---------------------------------------------------------------------------
// Van rauwe tekst naar regels met betekenis
// ---------------------------------------------------------------------------

/** Hoeveel dagen die maand echt heeft. Februari volgt de schrikkelregel van de kalender. */
function dagenInMaand(jaar: number, maand: number): number {
  if (maand === 2) {
    const schrikkel = (jaar % 4 === 0 && jaar % 100 !== 0) || jaar % 400 === 0;
    return schrikkel ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(maand) ? 30 : 31;
}

/**
 * De datum uit één cel, als kale jaar-, maand- en dagvelden.
 *
 * Twee vormen, omdat er twee bronnen zijn: Excel bewaart een datum als serienummer (`46274`),
 * maar een beheerder die de kolom als tekst opmaakt of het sjabloon met de hand invult, typt
 * `09/09/2026`. Beide moeten kunnen, anders hangt het van de celopmaak af of een bestand
 * binnenkomt.
 *
 * De dag staat vóór de maand: dat is wat Nederlandse Excel schrijft en wat de club typt. Er is
 * geen manier om `03/12/2026` zonder die afspraak te lezen, en de afspraak van het land waarin
 * de club staat is de enige die niet elke keer anders uitvalt.
 *
 * Kale getallen en geen `Date`, om dezelfde reden als `serieNaarDatum` (D-15): een `Date` sleept
 * een tijdzone mee, en een avondles staat dan zomaar op de dag ervoor. En er wordt uitgerekend
 * of de dag in die maand bestáát, in plaats van hem aan een `Date` te voeren die 31 februari
 * stilzwijgend 3 maart maakt — precies het soort verschuiving dat een heel seizoen scheeftrekt
 * zonder foutmelding.
 */
export function leesDatumCel(waarde: string): { jaar: number; maand: number; dag: number } | null {
  const schoon = waarde.trim();
  if (!schoon) return null;

  if (/^\d+(\.\d+)?$/.test(schoon)) {
    const serie = Number(schoon);
    // Serie 0 is de verzonnen dag 0 januari 1900; alles daaronder of erboven valt buiten elke
    // kalender waarin een tennisles kan staan.
    if (serie < 1 || serie > 2_958_465) return null;
    return serieNaarDatum(serie);
  }

  const treffer = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(schoon);
  if (!treffer) return null;
  const dag = Number(treffer[1]);
  const maand = Number(treffer[2]);
  const jaar = Number(treffer[3]);
  if (maand < 1 || maand > 12) return null;
  if (dag < 1 || dag > dagenInMaand(jaar, maand)) return null;
  return { jaar, maand, dag };
}

/**
 * Het beginuur uit één cel, als klokuur en minuut.
 *
 * Ook hier twee vormen, en die zijn hier niet theoretisch: Excel bewaart een tijdstip als het
 * deel van de dag dat verstreken is (`0.625`), terwijl de export van fase 4 het uur juist als
 * tekst `HH:MM` wegschrijft. Kon deze functie er maar één, dan zou de app haar eigen export niet
 * terug kunnen lezen (EXP-07) of het bestand van de club niet kunnen openen.
 *
 * De omrekening van de breuk komt uit `fractieNaarTijd` en wordt hier niet overgedaan: die kent
 * de valkuil van D-20 (`0.58333333333333337 × 24 = 13.999...`, en `Math.floor` daarvan is 13).
 * Eén plek die dat weet, is één plek waar het goed staat.
 */
export function leesUurCel(waarde: string): { uur: number; minuut: number } | null {
  const schoon = waarde.trim();
  if (!schoon) return null;

  let tijd: { uur: number; minuut: number } | null = null;
  // Een tijdbreuk begint altijd met een nul of met de punt zelf, want ze is kleiner dan één dag.
  // Dat onderscheid is nodig omdat `HH.MM` er ook uitziet als een kommagetal: `09.30` is half
  // tien en niet 9,3 dagen. Andersom blijft `0.625` een breuk en geen "nul uur en 625" — dat is
  // wat Excel zelf in de cel zet, en de breuk wint dus in dat ene twijfelgeval.
  if (/^0*\.\d+$/.test(schoon)) {
    tijd = fractieNaarTijd(Number(schoon));
  } else {
    const treffer = /^(\d{1,2})[:.](\d{2})$/.exec(schoon);
    if (!treffer) return null;
    tijd = { uur: Number(treffer[1]), minuut: Number(treffer[2]) };
  }

  if (tijd.uur < 0 || tijd.uur > 23 || tijd.minuut < 0 || tijd.minuut > 59) return null;
  return tijd;
}

/**
 * Het blad met de lessen erin.
 *
 * De export van fase 4 schrijft meerdere bladen en `Lessen` is het enige met lessen erin; het
 * bestand van de club heeft één blad dat gewoon `Sheet1` heet. Daarom eerst op naam zoeken en
 * anders het eerste blad nemen: een import die alleen een blad `Lessen` accepteert, weigert het
 * bestand waarvoor deze hele fase gebouwd is.
 */
export function kiesLessenBlad(bladen: readonly GelezenBlad[]): GelezenBlad | null {
  return bladen.find((b) => b.naam.trim().toLowerCase() === 'lessen') ?? bladen[0] ?? null;
}

/**
 * Eén regel uit het bestand, waarvan elk veld een betekenis heeft. Eén regel is één les × één
 * leerling (D-01): een groepsles van zes staat er als zes regels met dezelfde datum en hetzelfde
 * uur.
 *
 * De tekstvelden zijn getrimd en een ontbrekende optionele kolom wordt een lege tekst en geen
 * `undefined`. Dat scheelt de rest van de fase een vraagteken per veld: "geen kolom Baan" en
 * "kolom Baan, cel leeg" betekenen voor de import allebei hetzelfde — deze les krijgt geen baan.
 */
export interface LesRegel {
  /** Het regelnummer zoals de beheerder het in Excel ziet: de koprij is regel 1. */
  regel: number;
  datum: { jaar: number; maand: number; dag: number };
  uur: { uur: number; minuut: number };
  groep: string;
  groepId: string;
  typeLes: string;
  coach: string;
  leerling: string;
  emailLeerling: string;
  baan: string;
}

export interface GelezenLessen {
  regels: LesRegel[];
  fouten: ImportFoutLessen[];
  nietHerkend: string[];
  dubbel: string[];
}

/**
 * Het hele blad, van rauwe teksten naar regels met betekenis. Schrijft niets weg en kijkt naar
 * niets buiten dit bestand: of de coach bestaat en welke groep dit wordt, is de volgende stap.
 *
 * De volgorde waarin een rij beoordeeld wordt, is met opzet dezelfde als in `planImport`: een
 * lege rij is geen fout, en een rij die op één veld sneuvelt krijgt er geen tweede melding
 * bovenop. Eén regel in het bestand hoort tot precies één mededeling te leiden, anders wordt een
 * lijst van 1400 regels een lijst van 3000 meldingen die niemand meer naloopt.
 */
export function leesLesRegels(rijen: ReadonlyArray<readonly string[]>): GelezenLessen {
  const uitkomst: GelezenLessen = { regels: [], fouten: [], nietHerkend: [], dubbel: [] };
  if (rijen.length === 0) {
    uitkomst.fouten.push({ regel: 1, reden: 'Dit bestand is leeg.' });
    return uitkomst;
  }

  // Eerst overnemen, dán pas afhaken: juist als de koprij niet deugt, heeft de beheerder die
  // lijstjes nodig — dat is het geval waarin hij zijn bestand moet aanpassen.
  const kop = leesKopregelLessen(rijen[0]);
  uitkomst.nietHerkend = kop.nietHerkend;
  uitkomst.dubbel = kop.dubbel;
  const { kolommen } = kop;
  if (!kolommen) {
    uitkomst.fouten.push({
      regel: 1,
      reden: 'De koprij mist een verplichte kolom: Datum, Uur, Groep, Coach of Leerling.',
    });
    return uitkomst;
  }

  for (let i = 1; i < rijen.length; i++) {
    const rij = rijen[i];
    const regel = i + 1;
    const cel = (index: number | undefined): string =>
      index === undefined ? '' : (rij[index] ?? '').trim();

    // Een rij waarvan alle cellen leeg zijn, is geen vergissing: er staat weleens een lege
    // scheidingsregel tussen twee groepen, en een blad van Excel houdt zijn laatste rijen nog
    // een tijdje vast nadat je ze gewist hebt. Zo'n regel slaan we stil over.
    if (rij.every((c) => !c || !c.trim())) continue;

    const datumCel = cel(kolommen.datum);
    if (!datumCel) { uitkomst.fouten.push({ regel, reden: 'Geen datum ingevuld.' }); continue; }
    const datum = leesDatumCel(datumCel);
    if (!datum) {
      uitkomst.fouten.push({
        regel,
        reden: 'Deze datum kon niet gelezen worden: {waarde}',
        vars: { waarde: datumCel },
      });
      continue;
    }

    const uurCel = cel(kolommen.uur);
    if (!uurCel) { uitkomst.fouten.push({ regel, reden: 'Geen uur ingevuld.' }); continue; }
    const uur = leesUurCel(uurCel);
    if (!uur) {
      uitkomst.fouten.push({
        regel,
        reden: 'Dit uur kon niet gelezen worden: {waarde}',
        vars: { waarde: uurCel },
      });
      continue;
    }

    // De coach wordt hier alleen op leeg gecontroleerd, niet op bestaan: of deze naam een
    // trainer van de club is, weet dit bestand niet (D-07) en dat hoort bij het plan.
    const coach = cel(kolommen.coach);
    if (!coach) { uitkomst.fouten.push({ regel, reden: 'Geen coach ingevuld.' }); continue; }
    const leerling = cel(kolommen.leerling);
    if (!leerling) { uitkomst.fouten.push({ regel, reden: 'Geen leerling ingevuld.' }); continue; }

    // Een lege `Groep` is uitdrukkelijk géén fout: dat is een gewone privéles
    // (IMPORT-SJABLOON). Er wordt dan geen lesgroep van gemaakt en er wordt er ook geen aan
    // gekoppeld.
    uitkomst.regels.push({
      regel,
      datum,
      uur,
      groep: cel(kolommen.groep),
      groepId: cel(kolommen.groepId),
      typeLes: cel(kolommen.typeLes),
      coach,
      leerling,
      emailLeerling: cel(kolommen.emailLeerling),
      baan: cel(kolommen.baan),
    });
  }

  return uitkomst;
}

// ---------------------------------------------------------------------------
// Van regels naar lesgroepen (IMP-03)
// ---------------------------------------------------------------------------

/**
 * Een lesgroep zoals hij uit het bestand volgt, nog zonder één ding weggeschreven te zijn.
 *
 * De namen van de leerlingen staan er als tekst in en niet als gebruiker-ids: wie van hen de
 * club al kent, beslist `spelersUitRegels` hieronder, en dat is bewust een aparte stap — deze
 * functie hoeft de ledenlijst niet te kennen om te weten welke groepen er in het bestand zitten.
 */
export interface GeplandeGroep {
  /** De afgeleide sleutel van de eerste regel: `naam|weekdag|beginuur`, uit `groepSleutel`. */
  sleutel: string;
  /** De bestaande groep die dit blijkt te zijn, of `null` als dit een nieuwe groep is. */
  bestaand: LesGroep | null;
  /**
   * Is `bestaand` gevonden via de kolom `Groep-ID` in plaats van via de afgeleide sleutel?
   *
   * Dit verschil is niet cosmetisch. Bij een sleutelmatch zijn naam, weekdag en beginuur per
   * definitie gelijk aan die van de bestaande groep — daar valt niets aan bij te werken. Bij een
   * `Groep-ID`-match mógen ze juist verschillen: dáárvoor bestaat die kolom. Zonder dit vlaggetje
   * kan `groepWijzigingen` die twee gevallen niet uit elkaar houden, en dat was precies de bug:
   * een groep die in de export hernoemd werd kwam terug als "ongewijzigd" en hield haar oude naam.
   */
  viaGroepId: boolean;
  naam: string;
  niveau: string;
  /** 0-6 met zondag = 0, dezelfde telling als `LesGroep.weekday`. */
  weekdag: number;
  beginuur: number;
  beginminuut: number;
  /** De naam zoals hij in de kolom `Coach` stond; opzoeken doet `zoekTrainer`. */
  coachNaam: string;
  /** De naam of het nummer zoals het in de kolom `Baan` stond; leeg als er geen kolom was. */
  baanNaam: string;
  seizoenVan: string;
  seizoenTot: string;
  leerlingNamen: string[];
  regels: LesRegel[];
}

/** Wat er onderweg per groep verzameld wordt; `GeplandeGroep` is hiervan de uitkomst. */
interface GroepEmmer {
  sleutel: string;
  bestaand: LesGroep | null;
  /** Waar staat `true` zodra één regel van deze groep haar via `Groep-ID` aanwees. */
  viaGroepId: boolean;
  naam: string;
  weekdag: number;
  beginuur: number;
  beginminuut: number;
  seizoenVan: string;
  seizoenTot: string;
  regels: LesRegel[];
  leerlingNamen: string[];
  /** De namen die al in `leerlingNamen` staan, genormaliseerd — zo blijft dedupliceren goedkoop. */
  gezien: Set<string>;
  typen: Array<{ waarde: string; regel: number }>;
  coaches: Array<{ waarde: string; regel: number }>;
  banen: Array<{ waarde: string; regel: number }>;
}

/**
 * De waarde die het vaakst voorkomt, en de eerste regel die daarvan afwijkt.
 *
 * Lege waarden horen er niet in: een cel die niemand invulde is geen tweede mening. Zou een
 * lege `Type les` meetellen, dan kreeg elke groep waarin één regel dat vakje leeg liet een
 * waarschuwing over een verschil dat er niet is.
 *
 * Bij een gelijkspel wint de waarde die het eerst in het bestand stond: een `Map` bewaart de
 * volgorde waarin sleutels erin kwamen, dus dat volgt vanzelf uit de lus hieronder.
 */
function meestVoorkomend(waarden: ReadonlyArray<{ waarde: string; regel: number }>): {
  gekozen: string;
  afwijking: { regel: number; andere: string } | null;
} {
  const telling = new Map<string, number>();
  for (const { waarde } of waarden) telling.set(waarde, (telling.get(waarde) ?? 0) + 1);
  let gekozen = '';
  let beste = 0;
  telling.forEach((aantal, waarde) => {
    if (aantal > beste) { gekozen = waarde; beste = aantal; }
  });
  const afwijkend = waarden.find((w) => w.waarde !== gekozen);
  return {
    gekozen,
    afwijking: afwijkend ? { regel: afwijkend.regel, andere: afwijkend.waarde } : null,
  };
}

/**
 * Welke lesgroepen zitten er in dit bestand, en welke daarvan kent de club al?
 *
 * Dit is de kern van de hele fase. De sleutel waarop regels samengevoegd worden is `Groep` +
 * weekdag + beginuur (D-02), en die sleutel komt uit `groepSleutel` in `lib/lesgroepen.ts` —
 * lees het doc-commentaar daar: die functie is precies hiervoor geschreven. Een tweede, net iets
 * andere sleutel hier naast zetten is exact de fout die deze fase probeert te vermijden: dan
 * herkent de import morgen een groep die de app zelf wél herkent, of andersom.
 *
 * Waarom niet de groepsnaam alleen: in `koen.xlsx` staat "Groep 8" op drie momenten met drie
 * volledig verschillende rosters — zes kinderen op woensdag 17u, vier andere op vrijdag 17u,
 * twee volwassenen op vrijdag 19u, nul overlap. Het nummer is een administratief label dat
 * hergebruikt wordt, geen groep mensen; matchen op de naam zou daar één groep van twaalf van
 * maken.
 *
 * De sleutel telt de beginminuut NIET mee. Twee groepen met dezelfde naam op hetzelfde uur maar
 * met een andere minuut vallen dus samen. Dat is aanvaard en geen vergissing: dit is de
 * bestaande sleutel van de app, en een club die twee groepen met dezelfde naam op 17:00 en 17:15
 * plant heeft een groter probleem dan een import.
 *
 * Staat er een `Groep-ID` in het bestand en hoort dat bij een bestaande, niet-gearchiveerde
 * groep, dan wint dat van de sleutel (D-03): zo blijft een groep herkenbaar ook als haar naam of
 * haar uur veranderd is. Een `Groep-ID` dat nergens bij hoort — een export van vorig seizoen —
 * levert een waarschuwing op en valt terug op de sleutel, want dat mag een import niet blokkeren.
 */
export function groepenUitRegels(
  regels: readonly LesRegel[],
  bestaande: readonly LesGroep[],
): { groepen: GeplandeGroep[]; waarschuwingen: ImportFoutLessen[] } {
  const waarschuwingen: ImportFoutLessen[] = [];

  // Gearchiveerde groepen tellen niet mee bij het herkennen: archiveren was een bewuste daad van
  // de club, en een import die zo'n groep weer tot leven wekt maakt die daad ongedaan zonder het
  // te vragen. Er komt dan gewoon een nieuwe groep bij.
  const actief = actieveGroepen([...bestaande]);
  const opId = new Map<string, LesGroep>(actief.map((g) => [g.id, g]));
  const opSleutel = new Map<string, LesGroep>();
  for (const g of actief) {
    // De eerste wint: twee actieve groepen met dezelfde sleutel mag (zie `lesGroepFout`), en
    // welke van de twee we dan kiezen is niet aan de import om stil te veranderen.
    if (!opSleutel.has(groepSleutel(g))) opSleutel.set(groepSleutel(g), g);
  }

  const emmers = new Map<string, GroepEmmer>();
  const gemeldeIds = new Set<string>();

  for (const r of regels) {
    const naam = r.groep.trim();
    // Een regel zonder groep is een privéles (IMPORT-SJABLOON): geen groep, geen roster, en
    // uitdrukkelijk ook geen waarschuwing.
    if (!naam) continue;

    // De weekdag uit lokale velden, dezelfde telling als `LesGroep.weekday` (zondag = 0). Nooit
    // een datum in wereldtijd opbouwen en nooit een ISO-tekst laten parsen: in een westelijke
    // tijdzone schuift de les dan een dag op, en daarmee de hele groepssleutel.
    const dag = new Date(r.datum.jaar, r.datum.maand - 1, r.datum.dag);
    const sleutel = groepSleutel({ name: naam, weekday: dag.getDay(), start_hour: r.uur.uur });

    let bestaand: LesGroep | null = null;
    let viaGroepId = false;
    if (r.groepId) {
      bestaand = opId.get(r.groepId) ?? null;
      viaGroepId = bestaand !== null;
      if (!bestaand && !gemeldeIds.has(r.groepId)) {
        gemeldeIds.add(r.groepId);
        waarschuwingen.push({
          regel: r.regel,
          reden: 'Deze groep heeft een Groep-ID dat ik niet ken: {waarde}. Ik zoek de groep op naam, dag en uur.',
          vars: { waarde: r.groepId },
        });
      }
    }
    if (!bestaand) bestaand = opSleutel.get(sleutel) ?? null;

    // De emmer draagt het id van de bestaande groep als we die kennen: zo vallen regels mét en
    // regels zónder `Groep-ID` van dezelfde groep in dezelfde emmer, in plaats van in twee.
    const emmerSleutel = bestaand ? `id:${bestaand.id}` : sleutel;
    const dagTekst = dagSleutel(dag);
    let emmer = emmers.get(emmerSleutel);
    if (!emmer) {
      // De eerste regel bepaalt naam, dag en uur. Binnen een sleutel-emmer zijn die drie per
      // definitie gelijk; alleen een emmer die op `Groep-ID` samenviel kan er meerdere hebben,
      // en dan is de eerste regel van het bestand het minst willekeurige antwoord.
      emmer = {
        sleutel,
        bestaand,
        viaGroepId,
        naam,
        weekdag: dag.getDay(),
        beginuur: r.uur.uur,
        beginminuut: r.uur.minuut,
        seizoenVan: dagTekst,
        seizoenTot: dagTekst,
        regels: [],
        leerlingNamen: [],
        gezien: new Set<string>(),
        typen: [],
        coaches: [],
        banen: [],
      };
      emmers.set(emmerSleutel, emmer);
    }

    // Eén regel die de groep bij haar id noemt is genoeg. Een bestand mag de kolom `Groep-ID`
    // half ingevuld hebben — de export vult hem overal, een beheerder die er rijen bij typt
    // niet — en dan is de emmer nog steeds op het id herkend.
    if (viaGroepId) emmer.viaGroepId = true;

    emmer.regels.push(r);
    if (dagTekst < emmer.seizoenVan) emmer.seizoenVan = dagTekst;
    if (dagTekst > emmer.seizoenTot) emmer.seizoenTot = dagTekst;

    const leerling = r.leerling.trim();
    const gezien = normalizeName(leerling);
    if (leerling && !emmer.gezien.has(gezien)) {
      emmer.gezien.add(gezien);
      emmer.leerlingNamen.push(leerling);
    }
    if (r.typeLes.trim()) emmer.typen.push({ waarde: r.typeLes.trim(), regel: r.regel });
    if (r.coach.trim()) emmer.coaches.push({ waarde: r.coach.trim(), regel: r.regel });
    if (r.baan.trim()) emmer.banen.push({ waarde: r.baan.trim(), regel: r.regel });
  }

  const groepen: GeplandeGroep[] = [];
  emmers.forEach((emmer) => {
    const niveau = meestVoorkomend(emmer.typen);
    const coach = meestVoorkomend(emmer.coaches);
    // De baan krijgt geen waarschuwing bij verschil: welke baan een les krijgt is een planning
    // die per week mag wisselen, terwijl het niveau en de trainer eigenschappen van de groep
    // zelf zijn. Wat er ontbreekt om te kunnen plannen, meldt `koppelingVoorGroep`.
    const baan = meestVoorkomend(emmer.banen);

    if (niveau.afwijking) {
      waarschuwingen.push({
        regel: niveau.afwijking.regel,
        reden: 'De groep {groep} heeft meer dan één Type les: {gekozen} en {andere}. Ik neem {gekozen}.',
        vars: { groep: emmer.naam, gekozen: niveau.gekozen, andere: niveau.afwijking.andere },
      });
    }
    if (coach.afwijking) {
      waarschuwingen.push({
        regel: coach.afwijking.regel,
        reden: 'De groep {groep} heeft meer dan één coach: {gekozen} en {andere}. Ik neem {gekozen}.',
        vars: { groep: emmer.naam, gekozen: coach.gekozen, andere: coach.afwijking.andere },
      });
    }

    groepen.push({
      sleutel: emmer.sleutel,
      bestaand: emmer.bestaand,
      viaGroepId: emmer.viaGroepId,
      naam: emmer.naam,
      niveau: niveau.gekozen,
      weekdag: emmer.weekdag,
      beginuur: emmer.beginuur,
      beginminuut: emmer.beginminuut,
      coachNaam: coach.gekozen,
      baanNaam: baan.gekozen,
      seizoenVan: emmer.seizoenVan,
      seizoenTot: emmer.seizoenTot,
      leerlingNamen: emmer.leerlingNamen,
      regels: emmer.regels,
    });
  });

  return { groepen, waarschuwingen };
}

/** Wat er met een lesgroep zou gebeuren: er is er nog geen, hij blijft zoals hij is, of hij wijzigt. */
export type GroepStatus = 'nieuw' | 'ongewijzigd' | 'bijgewerkt';

/** Wie er bij een bestaande groep bij komt en wie eraf gaat, als gebruiker-ids. */
export interface GroepRosterVerschil {
  status: GroepStatus;
  toegevoegd: string[];
  verwijderd: string[];
}

/**
 * Verandert deze groep, en zo ja voor wie?
 *
 * Ids en geen namen, want een roster is een lijst gebruikers (`LesGroep.roster`): het omzetten
 * van de namen uit het bestand naar ids gebeurt met `spelersUitRegels`, en pas daarna valt deze
 * vraag te beantwoorden. De volgorde doet er niet toe — een roster is een verzameling mensen en
 * geen rangschikking, dus twee dezelfde namen in een andere volgorde is géén wijziging die de
 * beheerder wil zien.
 */
export function groepRosterVerschil(
  bestaand: LesGroep | null,
  roster: readonly string[],
): GroepRosterVerschil {
  if (!bestaand) return { status: 'nieuw', toegevoegd: [...roster], verwijderd: [] };
  const was = new Set(bestaand.roster);
  const wordt = new Set(roster);
  const toegevoegd = [...wordt].filter((id) => !was.has(id));
  const verwijderd = [...was].filter((id) => !wordt.has(id));
  const status = toegevoegd.length === 0 && verwijderd.length === 0 ? 'ongewijzigd' : 'bijgewerkt';
  return { status, toegevoegd, verwijderd };
}

// ---------------------------------------------------------------------------
// Spelers, trainers en banen (IMP-04)
// ---------------------------------------------------------------------------

/**
 * De trainer met deze naam, of niemand.
 *
 * Twee dingen liggen hier vast. Ten eerste: er wordt alleen gezócht. Een trainer aanmaken
 * betekent een uurtarief en toegang tot de club, en dat is geen bijproduct van een import
 * (D-07). Ontbreekt hij, dan meldt de droogloop het en gaan de lessen van die groep niet door —
 * de groep zelf wél, met een lege `coach_id`.
 *
 * Ten tweede: dit gaat langs `zoekOpNaam` uit `lib/students.ts`, precies dezelfde naamregel als
 * de spelerzoekopdracht hieronder. Dat moet, want in dit bestand staat de achternaam vooraan:
 * de kolom `Coach` van `koen.xlsx` zegt op alle 1398 regels "Leemans Koen", terwijl datzelfde
 * account in de app "Koen Leemans" heet. Een tweede, strengere regel voor trainers zou IMP-10
 * stilzwijgend breken — elke groep zou dan een onbekende trainer hebben (D-22).
 *
 * Eerst filteren op `role: 'coach'` uit `lib/types.ts`, dan pas zoeken: een speler die toevallig
 * zo heet mag nooit als trainer aan een les hangen.
 */
export function zoekTrainer(users: readonly User[], naam: string): User | null {
  return zoekOpNaam(users.filter((u) => u.role === 'coach'), naam);
}

/**
 * De baan met deze naam of dit nummer, of geen enkele.
 *
 * Allebei, want `.planning/IMPORT-SJABLOON.md` staat allebei toe: de club schrijft "Baan 1" of
 * gewoon "1". Ook hier wordt niets aangemaakt — een baan is een ding met een uurtarief en een
 * agenda, en dat verzin je niet uit een cel.
 *
 * Bij twee banen die even goed passen komt er niets uit, om dezelfde reden als bij `zoekOpNaam`:
 * stilzwijgend de eerste kiezen is een heel seizoen lessen op de verkeerde baan.
 */
export function zoekBaan(courts: readonly Court[], waarde: string): Court | null {
  const schoon = waarde.trim();
  if (!schoon) return null;
  const opNaam = courts.filter((c) => c.name.trim().toLowerCase() === schoon.toLowerCase());
  if (opNaam.length === 1) return opNaam[0];
  if (opNaam.length === 0 && /^\d+$/.test(schoon)) {
    const opNummer = courts.filter((c) => c.number === Number(schoon));
    if (opNummer.length === 1) return opNummer[0];
  }
  return null;
}

/** Eén leerling uit het bestand: hoe hij er stond, zijn adres, en wie hij bij ons al is. */
export interface GeplandeSpeler {
  /** De naam zoals hij in het bestand stond, ongewijzigd op de spaties eromheen na. */
  naam: string;
  /** Het genormaliseerde adres uit `E-mail leerling`, of leeg als er geen stond. */
  email: string;
  /** Het bestaande lid, of `null` als dit een nieuw lid wordt. */
  bestaand: User | null;
}

/** Wat er onderweg per leerling verzameld wordt. */
interface SpelerEmmer {
  naam: string;
  email: string;
  /** Het eerste regelnummer waarop deze naam stond; daar wijst een melding over hem naar. */
  regel: number;
}

/**
 * Wie er in dit bestand lesheeft, en wie van hen de club al kent.
 *
 * Eén ingang per unieke leerling, genormaliseerd op naam: dezelfde onbekende leerling op honderd
 * regels is één nieuw lid en geen honderd. De volgorde is die van het bestand, zodat de
 * droogloop leest zoals de beheerder scrolt.
 *
 * Passen er twee bestaande leden op dezelfde naam, dan komt er géén koppeling uit maar een
 * melding. Hem dan maar als nieuw lid opnemen zou een derde naamgenoot opleveren, en dat is
 * erger dan hem overslaan: de beheerder beslist welke van de twee het is (T-05-11).
 */
export function spelersUitRegels(
  regels: readonly LesRegel[],
  users: readonly User[],
): { spelers: GeplandeSpeler[]; waarschuwingen: ImportFoutLessen[] } {
  const emmers = new Map<string, SpelerEmmer>();
  for (const r of regels) {
    const naam = r.leerling.trim();
    if (!naam) continue;
    const sleutel = normalizeName(naam);
    const email = normalizeEmail(r.emailLeerling);
    const emmer = emmers.get(sleutel);
    if (!emmer) {
      emmers.set(sleutel, { naam, email, regel: r.regel });
      continue;
    }
    // Het eerste ingevulde adres wint. Later overschrijven zou betekenen dat regel 1300 stil
    // bepaalt wie er post krijgt; leeg overschrijven zou een adres kwijtmaken.
    if (!emmer.email && email) emmer.email = email;
  }

  const spelers: GeplandeSpeler[] = [];
  const waarschuwingen: ImportFoutLessen[] = [];
  emmers.forEach((emmer) => {
    const bestaand = zoekOpNaam(users, emmer.naam);
    if (!bestaand) {
      // `zoekOpNaam` geeft `null` bij niemand én bij twee treffers. Dat verschil telt hier: het
      // eerste geval wordt een nieuw lid, het tweede mag juist géén nieuw lid worden.
      const kandidaten = users.filter((u) => zelfdeNaamOngeachtVolgorde(u.name, emmer.naam));
      if (kandidaten.length > 1) {
        waarschuwingen.push({
          regel: emmer.regel,
          reden: 'Er staan al meerdere leden die {naam} kunnen zijn; koppel deze leerling zelf, ik laat hem staan.',
          vars: { naam: emmer.naam },
        });
        return;
      }
    }
    spelers.push({ naam: emmer.naam, email: emmer.email, bestaand });
  });

  return { spelers, waarschuwingen };
}

/**
 * Een nieuwe speler als rij voor de ledenlijst, in dezelfde vorm als `lib/import-leden.ts` hem
 * bouwt (D-06): naam, adres, rol. Geen sleutel met `undefined` erin — dat is het verschil tussen
 * "niet ingevuld" en "leeggemaakt".
 *
 * Een leeg adres mag: een kind in de planning van de club heeft niet altijd een eigen mailbox,
 * en zo'n regel weigeren zou de hele import op één lege cel laten stranden. Het adres is nodig
 * om hem later een account te kunnen geven, niet om hem in een groep te zetten.
 *
 * Let op wat hier níét gebeurt: er wordt geen account aangemaakt, alleen een rij in de
 * ledenlijst voorgesteld. De operationele keerzijde staat in `.planning/codebase/CONCERNS.md`:
 * zolang "Confirm email" in Supabase uitstaat, is een lid dat al in `users` staat maar zich nog
 * nooit aanmeldde, te claimen door wie zijn adres kent. Dat geldt hier precies zoals bij de
 * ledenimport, en het importscherm hoort eraan te herinneren.
 */
export function nieuwLidUitSpeler(speler: GeplandeSpeler): Omit<User, 'id'> {
  return { name: speler.naam, email: speler.email, role: 'player' };
}

/** De trainer en de baan van één lesgroep, met wat er nog aan ontbreekt. */
export interface GroepKoppeling {
  trainer: User | null;
  baan: Court | null;
  /** Wat er ontbreekt om de lessen van deze groep te kunnen inplannen. Hoogstens twee zinnen. */
  meldingen: ImportFoutLessen[];
}

/**
 * De trainer en de baan van deze groep opzoeken — en niets aanmaken.
 *
 * Eén melding per groep, nooit één per regel. Dat is geen verfraaiing: `koen.xlsx` heeft 1398
 * regels en tien groepen, dus per regel melden levert 2796 zinnen op. Dat is geen droogloop meer
 * maar een muur, en een muur leest niemand na (D-09). Het regelnummer wijst naar de eerste regel
 * van de groep, zodat de beheerder weet waar hij moet kijken.
 *
 * Wat een ontbrekende trainer of baan betekent: de lesgroep wordt wél aangemaakt, met haar
 * roster en een lege `coach_id` — `lib/types.ts` laat dat veld met opzet leeg zijn voor precies
 * dit geval. De lessen van die groep gaan niet door, en dat kan ook niet: `Booking.coach_id` en
 * `Booking.court_id` zijn allebei verplicht. Een les zonder trainer of zonder baan bestaat niet
 * in dit gegevensmodel.
 */
export function koppelingVoorGroep(
  groep: GeplandeGroep,
  users: readonly User[],
  courts: readonly Court[],
): GroepKoppeling {
  const regel = groep.regels[0]?.regel ?? 1;
  const meldingen: ImportFoutLessen[] = [];

  const trainer = zoekTrainer(users, groep.coachNaam);
  if (!trainer) {
    meldingen.push(groep.coachNaam
      ? {
        regel,
        reden: 'Ik ken geen trainer {naam}; koppel hem aan een account, anders worden de lessen van {groep} niet ingepland.',
        vars: { naam: groep.coachNaam, groep: groep.naam },
      }
      : {
        regel,
        reden: 'Bij {groep} staat geen trainer; zonder trainer worden haar lessen niet ingepland.',
        vars: { groep: groep.naam },
      });
  }

  const baan = zoekBaan(courts, groep.baanNaam);
  if (!baan) {
    // Een lege `Baan` is geen tikfout: `koen.xlsx` heeft die kolom niet eens. De melding gaat
    // dus over wat er ontbreekt om te kunnen plannen, en niet over een naam die fout zou zijn.
    meldingen.push(groep.baanNaam
      ? {
        regel,
        reden: 'Ik ken geen baan {waarde}; koppel er een aan {groep}, anders worden haar lessen niet ingepland.',
        vars: { waarde: groep.baanNaam, groep: groep.naam },
      }
      : {
        regel,
        reden: 'Bij {groep} staat geen baan; koppel er een, anders worden haar lessen niet ingepland.',
        vars: { groep: groep.naam },
      });
  }

  return { trainer, baan, meldingen };
}

// ---------------------------------------------------------------------------
// Van groepen naar lessen (IMP-05, IMP-11)
// ---------------------------------------------------------------------------

/**
 * De velden die dit bestand van een bestaande les nodig heeft; meer weet de import niet van een
 * boeking. Een uitbreiding van `BezetBoeking` uit lib/recurrence met de groep erbij: de
 * botsingsvraag heeft de groep niet nodig, de herimport wél — die moet de lessen van déze groep
 * kunnen terugvinden.
 */
export type ImportBoeking = Pick<
  Booking, 'id' | 'group_id' | 'coach_id' | 'court_id' | 'start_time' | 'end_time' | 'status'
>;

/** Hoe lang een les duurt als de club er niets over zei. Zie `Settings.lesson_duration_minutes`. */
export const LESDUUR_MINUTEN = 60;

/**
 * De lesduur van de club, in minuten.
 *
 * Eén clubinstelling en geen kolom in het bestand (D-05): een kolom die op elke regel hetzelfde
 * hoort te zijn, is een kolom die op regel 700 verkeerd ingevuld wordt. De instelling geldt voor
 * lessen die hierna ingepland worden en werkt nooit met terugwerkende kracht — een les die al in
 * de agenda staat houdt zijn eigen begin- en eindtijd. Lees het commentaar bij
 * `lesson_duration_minutes` in lib/types: daar staat waarom, en `planGroepWijziging` in
 * lib/lesgroepen houdt zich aan dezelfde regel.
 */
export function lesduurVan(settings: Pick<Settings, 'lesson_duration_minutes'>): number {
  const duur = settings.lesson_duration_minutes;
  return typeof duur === 'number' && duur > 0 ? duur : LESDUUR_MINUTEN;
}

/**
 * De sleutel waaraan één les te herkennen is: zijn lesgroep, zijn dag en zijn beginuur (D-11).
 *
 * Dit is een herkenningssleutel om een les uit een geïmporteerde planning terug te vinden, en
 * geen uniciteitsregel — precies zoals `groepSleutel` in lib/lesgroepen dat voor een groep is.
 * Twee lessen met dezelfde sleutel mógen bestaan; wat deze sleutel doet, is een tweede inleesbeurt
 * van hetzelfde bestand laten zien dat die les er al staat, in plaats van er nog een te maken.
 *
 * De groep komt binnen als tekst en niet als groep, want er zijn twee soorten: een groep die de
 * club al kent draagt haar id, een nieuwe groep haar afgeleide sleutel. De dag is een lokale
 * dagsleutel (`dagSleutel`), nooit een ISO-tijdstip: dat laatste zou de sleutel van een avondles
 * in een westelijke tijdzone een dag laten opschuiven.
 */
export function lesSleutel(groepSleutelOfId: string, dag: string, uur: number, minuut: number): string {
  return `${groepSleutelOfId.trim().toLowerCase()}|${dag.trim().toLowerCase()}|${uur}|${minuut}`;
}

/** Waaronder deze groep haar lessen herkent: haar id als de club haar kent, anders haar sleutel. */
function groepIdentiteit(groep: GeplandeGroep): string {
  return groep.bestaand ? groep.bestaand.id : groep.sleutel;
}

/**
 * Een lokaal tijdstip als `HH:MM`, om te tonen en te vergelijken.
 *
 * Bewust niet `formatTime` uit lib/datetime: die maakt schermtekst in de taal van de gebruiker,
 * en wat hier gebouwd wordt is een gegeven in het plan — even tijdzone- en taalloos als
 * `dagSleutel` dat voor een dag is.
 */
function tijdTekst(d: Date): string {
  const twee = (n: number): string => String(n).padStart(2, '0');
  return `${twee(d.getHours())}:${twee(d.getMinutes())}`;
}

/**
 * Eén les zoals hij uit het bestand volgt, met lokale `Date`-velden en nog geen enkele identiteit
 * erin.
 *
 * Er wordt hier met opzet géén `Booking` gebouwd. Een boeking heeft een betaler, deelnemers, een
 * trainer en een baan — allemaal gebruiker-ids die pas bestaan nadat de nieuwe spelers
 * weggeschreven zijn (plan 05-08). Die grens is precies waarom dit bestand puur kan blijven: het
 * rekent uit wát er zou gebeuren, zonder iets of iemand te hoeven aanmaken.
 */
export interface GeplandeLes {
  sleutel: string;
  start: Date;
  eind: Date;
  groep: GeplandeGroep;
  /**
   * Het regelnummer van de eerste rij waaruit deze les volgt. Zonder dat verschijnt er straks
   * een les in de agenda en weet niemand meer waar hij vandaan kwam (T-05-17).
   */
  regel: number;
}

/**
 * Een les uit het bestand die niet ingepland wordt, met de reden.
 *
 * De woorden zijn letterlijk overgenomen: `vakantie` en `bezet` uit `OvergeslagenReden` in
 * lib/recurrence, `verleden` uit `GeblokkeerdeLes` in lib/lesgroepen. Drie vocabulaires voor
 * hetzelfde zou de schermen laten uiteenlopen — dezelfde melding zou dan in Reserveren anders
 * heten dan in de import.
 */
export interface OvergeslagenLes {
  sleutel: string;
  start: Date;
  reden: 'vakantie' | 'bezet' | 'verleden';
  /** De naam van de vakantie, als dat de reden was. */
  vakantie?: string;
  regel: number;
}

/** Wat er van een geplande les naar de boeking gaat: wie betaalt, wie meedoet, en hoe. */
export interface LesDeelnemers {
  player_id: string;
  participant_ids: string[];
  payment_method: PaymentMethod;
}

/**
 * De betaler en de deelnemers van één les, uit het rooster van de groep.
 *
 * De eerste speler betaalt en de anderen staan ernaast: dat is de grens die lib/groups bewaakt —
 * `Booking.player_id` is de betaler en staat nooit óók in `participant_ids`. Bij meer dan één
 * speler is de betaalwijze `GROEPSLES_METHOD`, want een groepsles gaat altijd op factuur
 * (lib/beurtenkaart dwingt dat sowieso af). Eén speler is een gewone privéles en houdt zijn
 * betaalwijze open: er is nog niets afgesproken.
 *
 * Een leeg rooster levert niets op. Een les zonder speler bestaat niet.
 */
export function deelnemersVoorLes(roster: readonly string[]): LesDeelnemers | null {
  const [betaler, ...anderen] = roster.filter((id) => id.trim() !== '');
  if (!betaler) return null;
  return {
    player_id: betaler,
    participant_ids: anderen,
    payment_method: anderen.length > 0 ? GROEPSLES_METHOD : 'open',
  };
}

/**
 * Een geplande les als bezette plek, zodat het bestand ook met zichzelf kan botsen.
 *
 * Zonder dit ziet de import alleen de agenda zoals die vóór de import was: twee groepen die in
 * hetzelfde bestand dezelfde trainer op hetzelfde uur claimen zouden er dan allebei doorkomen, en
 * de tweede zou pas bij het wegschrijven stuklopen — of erger, er gewoon naast komen te staan.
 */
export function alsBezet(les: GeplandeLes, koppeling: GroepKoppeling): ImportBoeking {
  return {
    id: `import:${les.sleutel}`,
    group_id: les.groep.bestaand?.id,
    coach_id: koppeling.trainer?.id ?? '',
    court_id: koppeling.baan?.id ?? '',
    start_time: les.start.toISOString(),
    end_time: les.eind.toISOString(),
    status: 'confirmed',
  };
}

/**
 * Eén dag waarop het bestand en de agenda het oneens zijn: er staat al een les van deze groep,
 * maar op een ander uur of afgezegd.
 *
 * Genoeg om de beheerder te laten beslissen zonder zijn bestand ernaast te leggen: welke groep,
 * welke dag, hoe laat de les nu staat, hoe laat het bestand hem zet, en of hij afgezegd is.
 */
export interface HandmatigeWijziging {
  regel: number;
  groep: string;
  /** De lokale dag, als jjjj-mm-dd — dezelfde dagsleutel als een vakantie. */
  dag: string;
  /** Het beginuur zoals de les nu in de agenda staat, als HH:MM. */
  bestaandeTijd: string;
  /** Het beginuur dat het bestand voorstelt, als HH:MM. */
  tijdInBestand: string;
  status: BookingStatus;
}

/** Een komende les van de groep die niet meer in het bestand staat. Een melding, geen opdracht. */
export interface VerdwenenLes {
  id: string;
  groep: string;
  dag: string;
  tijd: string;
}

/** Wat er met de lessen van één groep zou gebeuren. */
export interface GroepLessen {
  /** De lessen die aangemaakt worden. */
  nieuweLessen: GeplandeLes[];
  /** De boekingen die al precies goed staan: zelfde groep, zelfde dag, zelfde beginuur. */
  ongewijzigd: string[];
  /** De lessen uit het bestand die niet doorgaan, met hun reden. */
  overgeslagen: OvergeslagenLes[];
  /** De dagen waarop iemand met de hand ingreep. Het bestand overrulet die nooit (D-13). */
  handmatigGewijzigd: HandmatigeWijziging[];
  /** De komende lessen van de groep die het bestand niet meer kent. */
  verdwenenUitBestand: VerdwenenLes[];
  /** Wat er ontbreekt om deze groep te kunnen plannen; komt uit `koppelingVoorGroep`. */
  meldingen: ImportFoutLessen[];
}

/**
 * De lessen van één groep: welke gaan er door, en welke niet en waarom.
 *
 * De datums komen uit het bestand en nergens anders vandaan. Er wordt met opzet geen herhaalregel
 * gebouwd — de reeksenbouwer van lib/recurrence blijft hier ongebruikt. Het bestand zegt "één regel
 * per les × leerling", en een week zonder les staat er gewoon niet in; een herhaalregel zou datums
 * verzinnen die de club nooit geschreven heeft. Wél `vakantieOpMoment` en `botstMet` uit diezelfde
 * bestanden, per datum die er wél in staat.
 *
 * Alles in lokale velden: `new Date(jaar, maand - 1, dag, uur, minuut)` en de duur erbij in het
 * minuutveld. `.toISOString()` gebeurt precies één keer, om de vraag aan `botstMet` te stellen —
 * nooit om een datum te lézen. Een reeks die over de uurwissel loopt blijft zo op hetzelfde lokale
 * uur staan; met "168 uur erbij" zou hij naar 16:00 of 18:00 schuiven.
 *
 * `nu` is een parameter en nooit `new Date()` hierbinnen: dat is wat dit hele blok testbaar maakt,
 * en het is dezelfde discipline als `komendeLessen(bookings, groupId, now)` in lib/lesgroepen.
 *
 * `bestaandeBoekingen` is de lijst waar `botstMet` in kijkt. Die mag — en hoort — al gefilterd te
 * zijn op wat deze groep kan raken: de lessen van haar trainer, die van haar baan en die van
 * haarzelf. Er staan ook de lessen in die dit plan zelf al goedkeurde (zie `alsBezet`), zodat het
 * bestand ook met zichzelf botst. Een club met tienduizend lessen mag deze functie niet in een
 * kwadratische vergelijking laten lopen (T-05-16).
 */
export function lessenUitGroep(
  groep: GeplandeGroep,
  koppeling: GroepKoppeling,
  bestaandeBoekingen: readonly ImportBoeking[],
  vakanties: readonly Vakantie[],
  duurMinuten: number,
  nu: Date,
): GroepLessen {
  const uit: GroepLessen = {
    nieuweLessen: [],
    ongewijzigd: [],
    overgeslagen: [],
    handmatigGewijzigd: [],
    verdwenenUitBestand: [],
    meldingen: koppeling.meldingen,
  };

  // Zonder trainer of zonder baan valt er niets in te plannen: `Booking.coach_id` en
  // `Booking.court_id` zijn allebei verplicht. De groep zelf gaat wél gewoon door, met haar
  // roster en een lege `coach_id` — zie `koppelingVoorGroep`, dat de melding al schreef.
  const { trainer, baan } = koppeling;
  if (!trainer || !baan) return uit;

  const identiteit = groepIdentiteit(groep);
  const bezet = [...bestaandeBoekingen];

  // Eén kandidaat per uniek moment: een groepsles van zes staat als zes regels in het bestand,
  // en dat is één les. De eerste regel van dat moment draagt de melding.
  const kandidaten = new Map<string, { regel: number; start: Date; dag: string }>();
  for (const r of groep.regels) {
    const start = new Date(r.datum.jaar, r.datum.maand - 1, r.datum.dag, r.uur.uur, r.uur.minuut);
    const dag = dagSleutel(start);
    const sleutel = lesSleutel(identiteit, dag, r.uur.uur, r.uur.minuut);
    if (!kandidaten.has(sleutel)) kandidaten.set(sleutel, { regel: r.regel, start, dag });
  }

  // De lessen die deze groep vanaf nu al in de agenda heeft, afgezegde meegerekend: juist een
  // afgezegde les moet gezien worden, want die mag niet stilzwijgend terugkomen. Vandaar
  // `groupBookingsFrom` en niet `komendeLessen` — lees het verschil in lib/lesgroepen. Alles vanaf
  // `nu` vooruit; wat geweest is komt in deze lijst niet voor en wordt dus ook nooit aangeraakt.
  const vanGroep = groep.bestaand
    ? groupBookingsFrom([...bestaandeBoekingen], groep.bestaand.id, nu)
    : [];
  // Twee kaarten, één keer opgebouwd: op sleutel voor "staat deze les er al precies zo", en op dag
  // voor "staat er die dag iets ánders van deze groep". Een club met tienduizend lessen mag geen
  // lijst-in-lijst worden (T-05-16).
  const opSleutel = new Map<string, ImportBoeking>();
  const opDag = new Map<string, ImportBoeking[]>();
  for (const b of vanGroep) {
    const wanneer = new Date(b.start_time);
    const dag = dagSleutel(wanneer);
    const sleutel = lesSleutel(identiteit, dag, wanneer.getHours(), wanneer.getMinutes());
    if (!opSleutel.has(sleutel)) opSleutel.set(sleutel, b);
    const opDieDag = opDag.get(dag);
    if (opDieDag) opDieDag.push(b); else opDag.set(dag, [b]);
  }
  /** De boekingen die het bestand herkende; wat overblijft is uit het bestand verdwenen. */
  const herkend = new Set<string>();

  const opTijd = [...kandidaten.entries()].sort((a, b) => a[1].start.getTime() - b[1].start.getTime());
  for (const [sleutel, kandidaat] of opTijd) {
    const { start, regel } = kandidaat;

    // Vanaf vandaag vooruit (IMP-07, D-12). Een regel met een datum van gisteren verandert niets:
    // hij wordt niet ingepland, niet bijgewerkt en niet verwijderd. Wat geweest is, blijft staan.
    if (start.getTime() < nu.getTime()) {
      uit.overgeslagen.push({ sleutel, start, reden: 'verleden', regel });
      continue;
    }

    // Staat deze les er al precies zo? Dan verandert er niets (IMP-06). Dit is wat een tweede
    // inleesbeurt van hetzelfde bestand niets laat verdubbelen.
    const zelfde = opSleutel.get(sleutel);
    if (zelfde && zelfde.status !== 'cancelled') {
      uit.ongewijzigd.push(zelfde.id);
      herkend.add(zelfde.id);
      continue;
    }

    // Staat er die dag wél een les van deze groep, maar op een ander uur of afgezegd? Dan greep
    // iemand met de hand in. Een les die met de hand verzet of afgezegd is, wordt niet
    // stilzwijgend teruggezet: de droogloop meldt zulke botsingen apart en de beheerder beslist
    // (D-13). Zonder deze stap zou een herimport een afzegging ongedaan maken, of er een tweede
    // les op dezelfde dag naast zetten.
    const opDieDag = opDag.get(kandidaat.dag) ?? [];
    if (opDieDag.length > 0) {
      const bestaandeLes = opDieDag[0];
      uit.handmatigGewijzigd.push({
        regel,
        groep: groep.naam,
        dag: kandidaat.dag,
        bestaandeTijd: tijdTekst(new Date(bestaandeLes.start_time)),
        tijdInBestand: tijdTekst(start),
        status: bestaandeLes.status,
      });
      for (const b of opDieDag) herkend.add(b.id);
      continue;
    }

    // De minuten in het minuutveld optellen, niet in milliseconden: een les van 17:00 die over de
    // uurwissel heen gepland wordt hoort om 17:00 te blijven staan.
    const eind = new Date(
      start.getFullYear(), start.getMonth(), start.getDate(),
      start.getHours(), start.getMinutes() + duurMinuten,
    );
    const slot = { start_time: start.toISOString(), end_time: eind.toISOString() };

    // De vakantie eerst: is de club dicht, dan doet het er niet meer toe of de trainer dan ook nog
    // bezet was — exact de volgorde van de reeksenbouwer in lib/recurrence en van
    // `planGroepWijziging` in lib/lesgroepen.
    const vakantie = vakantieOpMoment([...vakanties], slot.start_time);
    if (vakantie) {
      uit.overgeslagen.push({ sleutel, start, reden: 'vakantie', vakantie: vakantie.naam, regel });
      continue;
    }

    // De enige botsingsregel van de app; hier komt geen tweede versie van (lees het commentaar
    // bij `botstMet`). Een bezette trainer of een bezette baan wordt gemeld en nooit stil
    // overschreven: de bestaande les blijft precies staan waar hij staat.
    if (botstMet(slot, bezet, { coachId: trainer.id, courtId: baan.id }) !== null) {
      uit.overgeslagen.push({ sleutel, start, reden: 'bezet', regel });
      continue;
    }

    uit.nieuweLessen.push({ sleutel, start, eind, groep, regel });
  }

  // Wat de groep nog aan komende lessen heeft en het bestand niet kent, wordt gemeld en niet
  // verwijderd. De import zegt het, de beheerder beslist: een bestand waarin per ongeluk de
  // laatste maand ontbreekt zou anders een maand lessen van de club wissen. Afgezegde lessen
  // blijven hier weg — die zijn hierboven al als handmatige wijziging gezien of gaan sowieso niet
  // meer door.
  for (const b of vanGroep) {
    if (b.status === 'cancelled' || herkend.has(b.id)) continue;
    const wanneer = new Date(b.start_time);
    uit.verdwenenUitBestand.push({
      id: b.id,
      groep: groep.naam,
      dag: dagSleutel(wanneer),
      tijd: tijdTekst(wanneer),
    });
  }

  return uit;
}

/**
 * Wat dit bestand aan een bestaande lesgroep verandert — alleen de velden die echt anders zijn.
 *
 * Alleen de échte verschillen, om dezelfde reden als `verschillen` in lib/import-leden: zou hier
 * elk veld in staan, dan is bij een herimport ineens élke groep "bijgewerkt" en verzuipt de ene
 * echte wijziging in de ruis.
 *
 * Naam, weekdag en beginuur tellen alleen mee bij een match op `Groep-ID` (`groep.viaGroepId`).
 * Bij een sleutelmatch vórmen die drie de sleutel waarmee de groep herkend werd en zijn ze per
 * definitie gelijk — meevergelijken zou daar alleen ruis opleveren. Bij een `Groep-ID`-match is
 * het net omgekeerd: dáár mógen ze verschillen, want dat is precies waarvoor die kolom bestaat
 * (`.planning/IMPORT-SJABLOON.md`, D-03). De bug die dit voorkomt: een beheerder hernoemt een
 * groep in het geëxporteerde blad, stuurt het terug, en de import meldt "ongewijzigd" — de groep
 * wordt netjes herkend en houdt haar oude naam. Dan is IMP-07 een lege belofte.
 *
 * WAAROM DE LESSEN HIER NIET MEE VERHUIZEN. Verandert `weekday` of `start_hour`, dan raakt dat
 * de al ingeplande lessen van die groep, en de app heeft daar een regel voor:
 * `planGroepWijziging` in lib/lesgroepen verzet elke komende les mee en meldt wat botst. Die
 * regel wordt hier bewust NIET aangeroepen. Twee redenen:
 *
 * 1. Een import mag geen seizoen lessen verzetten als bijwerking van het lezen van een bestand.
 *    `planGroepWijziging` hoort bij een beheerder die op het groepsscherm bewust een dag of uur
 *    omzet en het gevolg meteen voor zich ziet. Hier komt de wijziging uit een cel in Excel, en
 *    de weg van dit bestand naar de lessen loopt al ergens anders langs.
 * 2. Die andere weg is strenger en staat er al. `lessenUitGroep` plant de lessen uit de datums
 *    in het bestand zelf: op het nieuwe uur komen ze als nieuwe lessen binnen, staat er die dag
 *    al een les van de groep op een ander uur dan is dat een `handmatigGewijzigd` (er wordt niets
 *    overschreven), en wat het bestand niet meer kent belandt in `verdwenenUitBestand` — gemeld,
 *    niet gewist. `planGroepWijziging` zou juist over die handmatige wijzigingen heen walsen, en
 *    twee regels voor dezelfde vraag lopen vroeg of laat uit elkaar (D-13).
 *
 * De beheerder ziet het gevolg dus volledig in de droogloop en beslist zelf. Wat hier bijgewerkt
 * wordt is de groepsrij, niet haar agenda.
 *
 * Het seizoen wordt opgerekt en nooit ingekort. Een beheerder die alleen de maand januari
 * opnieuw inleest, bedoelt niet dat het seizoen voortaan één maand duurt.
 */
export function groepWijzigingen(
  bestaand: LesGroep,
  groep: GeplandeGroep,
  koppeling: GroepKoppeling,
): Partial<Omit<LesGroep, 'id' | 'roster'>> {
  const wijzigingen: Partial<Omit<LesGroep, 'id' | 'roster'>> = {};
  if (groep.viaGroepId) {
    if (groep.naam !== bestaand.name) wijzigingen.name = groep.naam;
    if (groep.weekdag !== bestaand.weekday) wijzigingen.weekday = groep.weekdag;
    if (groep.beginuur !== bestaand.start_hour) wijzigingen.start_hour = groep.beginuur;
  }
  if (groep.niveau && groep.niveau !== bestaand.level) wijzigingen.level = groep.niveau;
  if (groep.beginminuut !== bestaand.start_minute) wijzigingen.start_minute = groep.beginminuut;
  if (koppeling.trainer && koppeling.trainer.id !== bestaand.coach_id) {
    wijzigingen.coach_id = koppeling.trainer.id;
  }
  if (koppeling.baan && koppeling.baan.id !== bestaand.court_id) {
    wijzigingen.court_id = koppeling.baan.id;
  }
  if (groep.seizoenVan < bestaand.season_start) wijzigingen.season_start = groep.seizoenVan;
  if (groep.seizoenTot > bestaand.season_end) wijzigingen.season_end = groep.seizoenTot;
  return wijzigingen;
}

// ---------------------------------------------------------------------------
// Het volledige plan (IMP-02)
// ---------------------------------------------------------------------------

/**
 * Het voorvoegsel van een speler die de club nog niet kent.
 *
 * Een roster is een lijst gebruiker-ids, maar een leerling die vanavond voor het eerst in een
 * bestand opduikt heeft er nog geen: dat id ontstaat pas als hij weggeschreven wordt (plan 05-08).
 * Zonder plaatshouder zou hij uit het rooster van het plan vallen, en dan zou een groep waaraan
 * één nieuwe speler toegevoegd wordt als "ongewijzigd" op het scherm staan. Wie dit plan
 * wegschrijft, vervangt elke plaatshouder door het id dat hij zojuist aanmaakte.
 */
export const NIEUWE_SPELER = 'nieuw:';

/** Het id van deze leerling, of zijn plaatshouder zolang hij er nog geen heeft. */
export function spelerSleutel(speler: GeplandeSpeler): string {
  return speler.bestaand ? speler.bestaand.id : `${NIEUWE_SPELER}${normalizeName(speler.naam)}`;
}

/**
 * Eén lesgroep in het plan, met alles erbij om hem te tonen zonder terug naar de rijen te hoeven:
 * naam, dag, uur, trainer en aantal spelers. Dat is precies wat de droogloop moet laten zien
 * (`.planning/IMPORT-SJABLOON.md`), en een scherm dat het zelf uit `regels` moest halen zou de
 * telling van dit bestand overdoen — en er vroeg of laat anders op uitkomen.
 */
export interface GroepInPlan {
  groep: GeplandeGroep;
  status: GroepStatus;
  naam: string;
  weekdag: number;
  beginuur: number;
  beginminuut: number;
  /** De naam van het gekoppelde account, of die uit het bestand als er geen account bij past. */
  trainerNaam: string;
  trainer: User | null;
  baan: Court | null;
  aantalSpelers: number;
  /** Het rooster als ids; een nieuwe speler draagt zijn plaatshouder (`NIEUWE_SPELER`). */
  roster: string[];
  toegevoegd: string[];
  verwijderd: string[];
  /** De velden van de bestaande groep die veranderen; leeg bij een nieuwe of ongewijzigde groep. */
  wijzigingen: Partial<Omit<LesGroep, 'id' | 'roster'>>;
}

/** Wat dit bestand met de club zou doen. Alles bij elkaar, en nog niets weggeschreven. */
export interface ImportPlanLessen {
  /** De regels die gelezen konden worden; elke les in het plan wijst er met zijn regelnummer naar. */
  regels: LesRegel[];
  groepenNieuw: GroepInPlan[];
  groepenBijgewerkt: GroepInPlan[];
  groepenOngewijzigd: GroepInPlan[];
  /** De leerlingen die de club nog niet kent, in de volgorde van het bestand. */
  spelersNieuw: GeplandeSpeler[];
  nieuweLessen: GeplandeLes[];
  /** De ids van de boekingen die al precies goed staan. */
  ongewijzigdeLessen: string[];
  overgeslagen: OvergeslagenLes[];
  handmatigGewijzigd: HandmatigeWijziging[];
  verdwenenUitBestand: VerdwenenLes[];
  /** Wat er niet gelezen kon worden, met regelnummer en reden. */
  fouten: ImportFoutLessen[];
  /** Wat wel doorgaat maar de beheerder beter even nakijkt. */
  waarschuwingen: ImportFoutLessen[];
  nietHerkend: string[];
  dubbel: string[];
}

/** De boeking bij haar sleutel zetten, en de lijst aanmaken als ze er nog niet was. */
function bijSleutel(kaart: Map<string, ImportBoeking[]>, sleutel: string, b: ImportBoeking): void {
  const lijst = kaart.get(sleutel);
  if (lijst) lijst.push(b); else kaart.set(sleutel, [b]);
}

/**
 * Wat dit bestand met de club zou doen: de koprij, de regels, de groepen, de spelers, de
 * koppelingen en de lessen, achter elkaar.
 *
 * Dit is de enige functie die het importscherm hoeft te kennen, en er komt geen databank aan te
 * pas, geen scherm en geen bestand: rijen tekst plus de lijsten die de club vandaag heeft gaan
 * erin, en een plan komt eruit. Daarom kan de beheerder zien wat er gaat gebeuren vóór er iets
 * vastligt, en daarom valt die belofte hier te testen — dezelfde belofte die `planImport` in
 * lib/import-leden voor de ledenlijst doet (D-10). Alles is synchroon; wie hier ooit iets wil
 * ophalen, hoort dat buiten deze functie te doen en het resultaat mee te geven.
 *
 * `nu` komt binnen als parameter en wordt hier nooit zelf uitgelezen: alleen zo is "wat geweest
 * is blijft staan" te testen zonder de klok van de machine te moeten geloven.
 */
export function planImportLessen(
  rijen: ReadonlyArray<readonly string[]>,
  bestaandeGroepen: readonly LesGroep[],
  users: readonly User[],
  courts: readonly Court[],
  bookings: readonly ImportBoeking[],
  settings: Pick<Settings, 'lesson_duration_minutes' | 'vakanties'>,
  nu: Date,
): ImportPlanLessen {
  const gelezen = leesLesRegels(rijen);
  const plan: ImportPlanLessen = {
    regels: gelezen.regels,
    groepenNieuw: [],
    groepenBijgewerkt: [],
    groepenOngewijzigd: [],
    spelersNieuw: [],
    nieuweLessen: [],
    ongewijzigdeLessen: [],
    overgeslagen: [],
    handmatigGewijzigd: [],
    verdwenenUitBestand: [],
    fouten: gelezen.fouten,
    waarschuwingen: [],
    nietHerkend: gelezen.nietHerkend,
    dubbel: gelezen.dubbel,
  };
  if (gelezen.regels.length === 0) return plan;

  const uitGroepen = groepenUitRegels(gelezen.regels, bestaandeGroepen);
  plan.waarschuwingen.push(...uitGroepen.waarschuwingen);

  const uitSpelers = spelersUitRegels(gelezen.regels, users);
  plan.waarschuwingen.push(...uitSpelers.waarschuwingen);
  plan.spelersNieuw = uitSpelers.spelers.filter((s) => s.bestaand === null);
  // Eén kaart van naam naar id, één keer gebouwd: per groep opnieuw door de spelerslijst lopen
  // maakt van 1400 regels een kwadratische zoektocht (T-05-16).
  const idVanNaam = new Map(uitSpelers.spelers.map((s) => [normalizeName(s.naam), spelerSleutel(s)]));

  const duurMinuten = lesduurVan(settings);
  const vakanties = settings.vakanties ?? [];

  // Drie kaarten over de bestaande boekingen, één keer gebouwd. Een botsing kan alleen ontstaan
  // bij dezelfde trainer of op dezelfde baan, en de herimport kijkt alleen naar de lessen van de
  // groep zelf: `lessenUitGroep` krijgt dus een korte, gefilterde lijst mee in plaats van alle
  // boekingen van de club (T-05-16).
  const opCoach = new Map<string, ImportBoeking[]>();
  const opBaan = new Map<string, ImportBoeking[]>();
  const opGroep = new Map<string, ImportBoeking[]>();
  for (const b of bookings) {
    bijSleutel(opCoach, b.coach_id, b);
    if (b.court_id) bijSleutel(opBaan, b.court_id, b);
    if (b.group_id) bijSleutel(opGroep, b.group_id, b);
  }

  for (const groep of uitGroepen.groepen) {
    const koppeling = koppelingVoorGroep(groep, users, courts);
    plan.waarschuwingen.push(...koppeling.meldingen);

    // De namen van het bestand als ids; een leerling die om een melding vroeg (twee naamgenoten)
    // staat niet in de kaart en dus ook niet in het rooster.
    const roster: string[] = [];
    for (const naam of groep.leerlingNamen) {
      const id = idVanNaam.get(normalizeName(naam));
      if (id) roster.push(id);
    }
    const verschil = groepRosterVerschil(groep.bestaand, roster);
    const wijzigingen = groep.bestaand
      ? groepWijzigingen(groep.bestaand, groep, koppeling)
      : {};
    const status: GroepStatus = verschil.status === 'ongewijzigd' && Object.keys(wijzigingen).length > 0
      ? 'bijgewerkt'
      : verschil.status;

    const inPlan: GroepInPlan = {
      groep,
      status,
      naam: groep.naam,
      weekdag: groep.weekdag,
      beginuur: groep.beginuur,
      beginminuut: groep.beginminuut,
      trainerNaam: koppeling.trainer?.name ?? groep.coachNaam,
      trainer: koppeling.trainer,
      baan: koppeling.baan,
      aantalSpelers: roster.length,
      roster,
      toegevoegd: verschil.toegevoegd,
      verwijderd: verschil.verwijderd,
      wijzigingen,
    };
    if (status === 'nieuw') plan.groepenNieuw.push(inPlan);
    else if (status === 'bijgewerkt') plan.groepenBijgewerkt.push(inPlan);
    else plan.groepenOngewijzigd.push(inPlan);

    // Alleen wat deze groep kan raken. Dubbels eruit, want een les van haar eigen trainer op haar
    // eigen baan staat in twee van de drie kaarten.
    const raakbaar = new Map<string, ImportBoeking>();
    const alles = [
      ...(groep.bestaand ? opGroep.get(groep.bestaand.id) ?? [] : []),
      ...(koppeling.trainer ? opCoach.get(koppeling.trainer.id) ?? [] : []),
      ...(koppeling.baan ? opBaan.get(koppeling.baan.id) ?? [] : []),
    ];
    for (const b of alles) raakbaar.set(b.id, b);

    const lessen = lessenUitGroep(
      groep, koppeling, [...raakbaar.values()], vakanties, duurMinuten, nu,
    );
    plan.nieuweLessen.push(...lessen.nieuweLessen);
    plan.ongewijzigdeLessen.push(...lessen.ongewijzigd);
    plan.overgeslagen.push(...lessen.overgeslagen);
    plan.handmatigGewijzigd.push(...lessen.handmatigGewijzigd);
    plan.verdwenenUitBestand.push(...lessen.verdwenenUitBestand);

    // De zojuist goedgekeurde lessen tellen vanaf nu mee als bezet: zo botst het bestand ook met
    // zichzelf, en niet alleen met wat er al stond.
    for (const les of lessen.nieuweLessen) {
      const bezet = alsBezet(les, koppeling);
      bijSleutel(opCoach, bezet.coach_id, bezet);
      if (bezet.court_id) bijSleutel(opBaan, bezet.court_id, bezet);
    }
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Van plan naar rijen (IMP-09)
// ---------------------------------------------------------------------------

/** Eén bestaande lesgroep die bijgewerkt wordt, met alleen de velden die echt veranderen. */
export interface GroepBijwerking {
  id: string;
  patch: Partial<Omit<LesGroep, 'id'>>;
}

/**
 * Het goedgekeurde plan als concrete rijen: precies wat er weggeschreven wordt en niets meer.
 *
 * Er staat met opzet geen lijst met te verwijderen boekingen in. Een les die uit het bestand
 * verdween staat in `ImportPlanLessen.verdwenenUitBestand` — dat is een melding voor de
 * beheerder en geen opdracht. De import maakt aan en werkt bij; wissen doet ze nooit (D-13).
 */
export interface ImportWijziging {
  nieuweUsers: User[];
  nieuweGroepen: LesGroep[];
  gewijzigdeGroepen: GroepBijwerking[];
  nieuweBoekingen: Booking[];
  /** Wat er van het plan niet weggeschreven wordt, met regelnummer en reden. */
  fouten: ImportFoutLessen[];
}

/** Wat een uitgevoerde import opleverde: de aantallen, en wat er niet doorging. */
export interface ImportUitslagLessen {
  spelers: number;
  nieuweGroepen: number;
  bijgewerkteGroepen: number;
  lessen: number;
  fouten: ImportFoutLessen[];
}

/** Alle groepen van het plan achter elkaar, in de volgorde waarin het scherm ze toont. */
function alleGroepen(plan: ImportPlanLessen): GroepInPlan[] {
  return [...plan.groepenNieuw, ...plan.groepenBijgewerkt, ...plan.groepenOngewijzigd];
}

/** Het regelnummer waar deze groep in Excel begint; daar wijst een melding over haar naar. */
function regelVanGroep(inPlan: GroepInPlan): number {
  return inPlan.groep.regels[0]?.regel ?? 1;
}

/**
 * Een lesgroep zoals ze de opslag in gaat, zonder haar id.
 *
 * Er staat geen `created_at` in, en dat is opzet: `bouwImportWijziging` moet op dezelfde invoer
 * twee keer exact dezelfde rijen geven, en een klok maakt dat onmogelijk. Het veld is optioneel
 * (`lib/types.ts`) en de club leest het nergens om iets te beslissen.
 *
 * Een ontbrekende trainer of baan komt er niet als sleutel met `undefined` in te staan: dat is
 * het verschil tussen "niet ingevuld" en "leeggemaakt", precies zoals `lib/import-leden.ts` een
 * leeg telefoonnummer weglaat in plaats van het als `undefined` mee te sturen.
 */
function groepUitPlan(inPlan: GroepInPlan, roster: string[]): Omit<LesGroep, 'id'> {
  const groep: Omit<LesGroep, 'id'> = {
    name: inPlan.naam,
    level: inPlan.groep.niveau,
    weekday: inPlan.weekdag,
    start_hour: inPlan.beginuur,
    start_minute: inPlan.beginminuut,
    season_start: inPlan.groep.seizoenVan,
    season_end: inPlan.groep.seizoenTot,
    roster,
    archived: false,
  };
  if (inPlan.trainer) groep.coach_id = inPlan.trainer.id;
  if (inPlan.baan) groep.court_id = inPlan.baan.id;
  return groep;
}

/**
 * Het goedgekeurde plan omzetten in de rijen die weggeschreven worden — nog steeds zonder één
 * databankverbinding en zonder een enkele belofte om op te wachten: dit blijft synchroon.
 *
 * De volgorde is eerst de spelers, dan de groepen, dan de lessen. Dat is geen willekeur maar de
 * kern van wat IMP-09 hier betekent (D-21). Ten eerste moet het wel: de groepen verwijzen met
 * hun rooster naar spelers, en de lessen verwijzen naar allebei. Ten tweede — en daar gaat het
 * echt om — is dit de volgorde waarin een halverwege afgebroken import het minst schadelijk
 * achterblijft. Een speler zonder groep is onschadelijk en wordt bij een volgende inleesbeurt
 * gewoon op zijn naam herkend. Een groep zonder lessen staat zichtbaar in het lesgroepenscherm
 * en krijgt haar lessen bij een volgende beurt alsnog. Andersom zou er een les kunnen staan
 * met een speler-id dat nergens bij hoort, en dat is niet met opnieuw inlezen recht te zetten.
 *
 * De ids komen als parameter binnen en worden hier niet gemaakt. Dat maakt de uitkomst
 * voorspelbaar en dus testbaar; de provider geeft er zijn eigen idmaker in, precies zoals
 * `addBookingSeries` dat doet. (De naam van die maker staat hier bewust niet: dit bestand mag
 * niets uit `providers/` kennen, ook niet bij naam.)
 *
 * Wat hier NIET gebeurt: er wordt niets opnieuw uitgerekend. Welke lessen doorgaan, welke groep
 * bij welke bestaande groep hoort en wie er nieuw is, heeft `planImportLessen` al beslist en de
 * beheerder al gezien. Zou deze functie daar iets aan bijstellen, dan schreef ze iets anders weg
 * dan de droogloop toonde — en dan is die droogloop een belofte die niet nagekomen wordt (D-10).
 */
export function bouwImportWijziging(
  plan: ImportPlanLessen,
  maakId: (voorvoegsel: string) => string,
): ImportWijziging {
  const uit: ImportWijziging = {
    nieuweUsers: [],
    nieuweGroepen: [],
    gewijzigdeGroepen: [],
    nieuweBoekingen: [],
    fouten: [],
  };

  // 1. De spelers. Zij hangen nergens aan vast en moeten er eerst zijn: elk rooster hieronder
  //    verwijst naar hun ids.
  const idVanPlaatshouder = new Map<string, string>();
  for (const speler of plan.spelersNieuw) {
    const id = maakId('u');
    idVanPlaatshouder.set(spelerSleutel(speler), id);
    uit.nieuweUsers.push({ ...nieuwLidUitSpeler(speler), id });
  }

  /**
   * Het rooster van het plan als echte ids. Een plaatshouder (`NIEUWE_SPELER`) hoort altijd bij
   * een speler uit `plan.spelersNieuw` en is dus altijd te vervangen; blijft er er tóch een
   * over, dan was het plan niet met zichzelf in overeenstemming en valt hij eruit — liever een
   * speler minder in een groep dan een rij met een id dat nergens bij hoort.
   */
  const echteIds = (roster: readonly string[]): string[] => roster
    .map((id) => idVanPlaatshouder.get(id) ?? id)
    .filter((id) => !id.startsWith(NIEUWE_SPELER));

  // 2. De groepen. Ze verwijzen naar de spelers hierboven, en de lessen verwijzen straks naar
  //    hen. Het id van een bestaande groep is dat wat de club al kende.
  const idVanGroep = new Map<GeplandeGroep, string>();
  const geweigerd = new Set<GeplandeGroep>();

  for (const inPlan of plan.groepenNieuw) {
    const groep = groepUitPlan(inPlan, echteIds(inPlan.roster));
    // Dezelfde controle die `addLesGroep` doet, en met opzet vóór de opslag: stuitte de provider
    // er halverwege op, dan stonden de spelers er al en de groep niet — met een lege plek in de
    // agenda tot gevolg. Nu wordt de hele groep overgeslagen en zegt de melding waarom.
    const fout = lesGroepFout(groep);
    if (fout) {
      geweigerd.add(inPlan.groep);
      uit.fouten.push({
        regel: regelVanGroep(inPlan),
        // De reden van `lesGroepFout` is al vertaalde schermtekst; ze wordt als waarde
        // doorgegeven en niet in de zin geplakt, zodat de zin zelf vertaalbaar blijft.
        reden: 'Ik kan de lesgroep {groep} niet aanmaken: {reden} Haar lessen gaan dus ook niet door.',
        vars: { groep: inPlan.naam, reden: fout },
      });
      continue;
    }
    const id = maakId('lg');
    idVanGroep.set(inPlan.groep, id);
    uit.nieuweGroepen.push({ ...groep, id });
  }

  for (const inPlan of plan.groepenBijgewerkt) {
    const bestaand = inPlan.groep.bestaand;
    if (!bestaand) continue;
    idVanGroep.set(inPlan.groep, bestaand.id);
    // Het rooster gaat altijd mee: dat is wat "bijgewerkt" hier betekent. Welke velden verder
    // veranderen heeft `groepWijzigingen` al bepaald — er wordt niets bij bedacht.
    uit.gewijzigdeGroepen.push({
      id: bestaand.id,
      patch: { ...inPlan.wijzigingen, roster: echteIds(inPlan.roster) },
    });
  }

  for (const inPlan of plan.groepenOngewijzigd) {
    // Niets bij te werken, maar haar lessen kunnen er wél bij komen: een groep die de club al
    // kent en waar dit bestand een week aan toevoegt.
    if (inPlan.groep.bestaand) idVanGroep.set(inPlan.groep, inPlan.groep.bestaand.id);
  }

  // 3. De lessen. Ze verwijzen naar de groep én naar haar spelers, dus ze kunnen pas nu.
  const inPlanVanGroep = new Map(alleGroepen(plan).map((g) => [g.groep, g] as const));
  /** De groepen waarover al een melding geschreven is; één zin per groep, nooit één per les (D-09). */
  const gemeld = new Set<GeplandeGroep>(geweigerd);

  for (const les of plan.nieuweLessen) {
    const inPlan = inPlanVanGroep.get(les.groep);
    const groepId = idVanGroep.get(les.groep);
    if (!inPlan || !groepId) continue;

    // `Booking.coach_id` en `Booking.court_id` zijn allebei verplicht: een les zonder trainer of
    // zonder baan bestaat niet in dit gegevensmodel. Er wordt er geen aangemaakt en er wordt ook
    // geen trainer of baan verzonnen — dat is uitdrukkelijk geen bijproduct van een import
    // (D-07, en het besluit over een ontbrekende trainer in plan 05-05).
    const deelnemers = deelnemersVoorLes(echteIds(inPlan.roster));
    if (!inPlan.trainer || !inPlan.baan || !deelnemers) {
      if (!gemeld.has(les.groep)) {
        gemeld.add(les.groep);
        uit.fouten.push({
          regel: les.regel,
          reden: 'De lessen van {groep} worden niet ingepland: er ontbreekt een trainer, een baan of een leerling.',
          vars: { groep: inPlan.naam },
        });
      }
      continue;
    }

    const boeking: Booking = {
      id: maakId('b'),
      group_id: groepId,
      player_id: deelnemers.player_id,
      coach_id: inPlan.trainer.id,
      court_id: inPlan.baan.id,
      start_time: les.start.toISOString(),
      end_time: les.eind.toISOString(),
      status: 'confirmed',
      payment_method: deelnemers.payment_method,
    };
    // Leeg lijstje weglaten in plaats van als lege sleutel meesturen: "leeg of afwezig is een
    // gewone les voor één speler" (lib/types.ts), en een lege sleutel is het verschil tussen
    // "niet ingevuld" en "leeggemaakt".
    if (deelnemers.participant_ids.length > 0) {
      boeking.participant_ids = deelnemers.participant_ids;
    }
    uit.nieuweBoekingen.push(boeking);
  }

  return uit;
}

// ---------------------------------------------------------------------------
// Het sjabloon om te downloaden (IMP-01)
// ---------------------------------------------------------------------------

/**
 * De koppen van het sjabloon, letterlijk zoals `.planning/IMPORT-SJABLOON.md` en de export van
 * fase 4 ze spellen. Vijf verplichte en vier optionele; de vier die alleen de leesbaarheid
 * dienen (`Weekdag`, `Weeknr`, `Locatie`, `Indoor/Outdoor`) staan er niet in — wie ze toevoegt
 * krijgt er geen klacht over, maar een leeg sjabloon hoeft niet te vragen wat het zelf niet
 * gebruikt.
 */
const KOPPEN_SJABLOON = [
  'Datum', 'Uur', 'Type les', 'Groep', 'Groep-ID', 'Coach', 'Leerling', 'E-mail leerling', 'Baan',
] as const;

/** Iets ruimere kolommen dan Excel zelf kiest; een naam mag niet half achter zijn buur vallen. */
const BREEDTES_SJABLOON = [12, 8, 14, 14, 14, 22, 22, 26, 10] as const;

/**
 * Het lege sjabloon dat een beheerder kan downloaden (IMP-01).
 *
 * Twee regels en niet één, om dezelfde reden als `voorbeeldLedenCsv` in `lib/import-leden.ts`:
 * alleen naast een gevulde cel is te zien dat een lege cel gewoon mag. De tweede regel heeft
 * geen baan en geen e-mailadres, en komt er toch gewoon door.
 *
 * De twee regels vertellen bovendien de vorm van het bestand: dezelfde datum, hetzelfde uur en
 * dezelfde groep met twee verschillende leerlingen — één regel per les × leerling (D-01). Die
 * vorm uitleggen in het bestand zelf werkt beter dan in een handleiding die niemand opent naast
 * zijn Excel.
 *
 * De koppen gaan niet door `t()`, terwijl bijna alle andere tekst in deze app dat wel doet: dit
 * is een bestandsformaat en geen schermtekst, en de import leest deze koprij zelf terug. Een
 * beheerder die de app op Engels heeft staan zou anders een sjabloon downloaden dat zijn eigen
 * import niet meer herkent. Dezelfde keuze als bij de export van fase 4.
 *
 * Er is geen kolom voor de lesduur, en dat is opzet: de duur is een clubinstelling van zestig
 * minuten (D-05, IMP-11). Een kolom die op elke regel hetzelfde hoort te zijn, is een kolom die
 * op regel 700 verkeerd ingevuld wordt.
 */
export function voorbeeldTrainingenXlsx(): Uint8Array {
  // Een datum in de toekomst, met lokale velden gebouwd (D-15): geen `Date.parse` van een tekst,
  // want dat leest een `2027-09-08` als UTC en zet de les in een westelijke tijdzone een dag
  // terug.
  const datum = new Date(2027, 8, 8);
  const rij = (leerling: string, email: string, baan: string): XlsxCel[] => [
    { soort: 'datum', waarde: datum },
    { soort: 'tekst', waarde: '17:00' },
    { soort: 'tekst', waarde: 'Groepsles' },
    { soort: 'tekst', waarde: 'Groep 4' },
    { soort: 'tekst', waarde: '' },
    { soort: 'tekst', waarde: 'Sofie Maes' },
    { soort: 'tekst', waarde: leerling },
    { soort: 'tekst', waarde: email },
    { soort: 'tekst', waarde: baan },
  ];

  return buildXlsx({
    naam: 'Lessen',
    koppen: KOPPEN_SJABLOON,
    breedtes: BREEDTES_SJABLOON,
    rijen: [
      rij('Jonas Peeters', 'jonas@voorbeeld.be', 'Baan 1'),
      rij('Emma Willems', '', ''),
    ],
  });
}
