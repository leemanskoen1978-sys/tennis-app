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
// De lezer van het tweede formaat. Ja, die module importeert op haar beurt uit deze — een
// kring. Hij is met opzet ongevaarlijk: allebei de kanten gebruiken elkaar uitsluitend binnen
// een functie en nooit terwijl de module zelf opgebouwd wordt, en de typen die heen en weer gaan
// verdwijnen bij het compileren. Wat de kring oplevert is dat `planImportLessen` de ene ingang
// voor allebei de formaten blijft: het scherm hoeft niet te weten welk bestand het openmaakt.
import {
  groepenUitWeekRegels, isWeekschema, leesWeekRegels, spelerRegelsUitWeek,
} from './import-weekschema';
import { actieveGroepen, groepSleutel, groupBookingsFrom, lesGroepFout } from './lesgroepen';
import { botstMet, type BezetBoeking } from './recurrence';
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
  /**
   * De tweede kolom waar een terreinnummer in kan staan: `Indoor/Outdoor`. Dat is de kop die
   * het Tennis Vlaanderen-blad van de club gebruikt, en daar zet de club het terreinnummer in.
   *
   * WAAROM een eigen veld en niet gewoon een tweede schrijfwijze van `baan`: de export van
   * fase 4 schrijft `Baan` én `Indoor/Outdoor` allebei. Mikten die twee koppen op hetzelfde
   * veld, dan zou `leesKopregelLessen` de tweede als `dubbel` melden — en dan opent élke
   * herimport van een eigen exportbestand met de waarschuwing "deze kolom staat er twee keer",
   * precies de ruis die `KOPPEN_GENEGEERD` hieronder wil vermijden.
   */
  baanAlt?: number;
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
  // De kop van het Tennis Vlaanderen-blad. `schoneKop` haalt hoofdletters en spaties eraf en
  // laat de schuine streep staan, dus `Indoor / Outdoor` komt hier ook op uit.
  ['indoor/outdoor', 'baanAlt'],
]);

/**
 * Koppen die we lezen en bewust laten liggen. Ze staan apart van "onbekend" omdat ze in
 * `koen.xlsx` staan (`Weekdag`, `Weeknr`, `Locatie`) en in wat de export van
 * fase 4 schrijft (daar komen `Einduur`, `Gaf de les`, `Spelers` en `Status` bij). Zou de
 * import ze als "niet herkend" melden, dan opent élke echte import — ook de eigen export die er
 * ongewijzigd weer in moet kunnen — met een lijstje ruis, en dan leest niemand dat lijstje nog
 * op de dag dat er wél een echte tikfout in staat.
 *
 * Schoongemaakte vorm: klein, zonder spaties.
 *
 * `indoor/outdoor` stond hier ooit ook, maar staat nu in `KOPNAMEN_LESSEN`: de club draagt het
 * terreinnummer in die kolom (IMP-15). `locatie` blijft wel genegeerd — de app kent geen
 * locatiebegrip (IMPORT-SJABLOON).
 */
const KOPPEN_GENEGEERD = new Set([
  'weekdag',
  'weeknr',
  'weeknummer',
  'einduur',
  'locatie',
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
 * De baan van een regel, uit de twee kolommen die er een kunnen dragen.
 *
 * `Baan` wint van `Indoor/Outdoor`, want de eigen export van fase 4 zet de échte baannaam in
 * `Baan` en gebruikt `Indoor/Outdoor` alleen nog voor het woord. Zonder die voorrang zou een
 * herimport van een eigen exportbestand de baan uit de verkeerde kolom halen.
 *
 * De woorden `indoor` en `outdoor` betekenen géén baan maar de oude inhoud van die kolom
 * (D-12). Die uitzondering voorkomt deze bug: in `koen.xlsx` staat op alle 1398 regels
 * letterlijk `Indoor`, dus zonder haar zou elke groep aan een verzonnen baan "Indoor" hangen.
 * `zoekBaan` vindt daar terecht niets bij, en de beheerder leest dan "Ik ken geen baan Indoor"
 * in plaats van de juiste melding "bij deze groep staat geen baan".
 */
export function baanUitCellen(baan: string, binnenBuiten: string): string {
  const uitBaan = baan.trim();
  if (uitBaan) return uitBaan;
  const alt = binnenBuiten.trim();
  const woord = alt.toLowerCase();
  if (woord === 'indoor' || woord === 'outdoor') return '';
  return alt;
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
      baan: baanUitCellen(cel(kolommen.baan), cel(kolommen.baanAlt)),
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
  /** De afgeleide sleutel van de eerste regel: `weekdag|beginuur|baan`, uit `groepSleutel`. */
  sleutel: string;
  /** De bestaande groep die dit blijkt te zijn, of `null` als dit een nieuwe groep is. */
  bestaand: LesGroep | null;
  /**
   * Is `bestaand` gevonden via de kolom `Groep-ID` in plaats van via de afgeleide sleutel?
   *
   * Dit verschil is niet cosmetisch. Bij een sleutelmatch zijn weekdag, beginuur en baan per
   * definitie gelijk aan die van de bestaande groep, en neemt `groepenUitRegels` haar naam
   * ongewijzigd over — daar valt niets aan bij te werken. Bij een `Groep-ID`-match mag dat alle
   * vijf verschillen: dáárvoor bestaat die kolom. Zonder dit vlaggetje
   * kan `groepWijzigingen` die twee gevallen niet uit elkaar houden, en dat was precies de bug:
   * een groep die in de export hernoemd werd kwam terug als "ongewijzigd" en hield haar oude naam.
   */
  viaGroepId: boolean;
  /**
   * De naam die deze groep hoort te krijgen of te houden. Niet zomaar de cel `Groep`: die doet
   * sinds deze fase niet meer mee aan het matchen én niet meer aan het benoemen. Zie
   * `groepenUitRegels` voor de drie regels die deze naam bepalen.
   */
  naam: string;
  niveau: string;
  /** 0-6 met zondag = 0, dezelfde telling als `LesGroep.weekday`. */
  weekdag: number;
  beginuur: number;
  beginminuut: number;
  /**
   * De lesduur van deze groep in minuten, of `null` voor de lesduur van de club.
   *
   * Het sjabloon van de app geeft die niet — daar staat één begintijd per les — dus daar is dit
   * altijd `null`. De clublijst geeft een reeks (`16:00 - 17:00`) en daaruit volgt de duur; vier
   * van haar 192 groepen wijken af van de 60 minuten van de club.
   */
  duurMinuten: number | null;
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
  /** De ruwe waarde uit de kolom `Groep` van de eerste regel; alleen bruikbaar bij een `Groep-ID`. */
  naamUitBestand: string;
  /** De uitkomst van de drie naamregels, pas ingevuld in de afsluitende lus. */
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
 * De Nederlandse weekdagnamen, zondag = 0 — dezelfde telling als `LesGroep.weekday` en als
 * `Date#getDay`. Bewust niet `DAY_LABELS` uit lib/slots: dat zijn afkortingen voor op het
 * scherm, en die gaan door `t()`.
 */
const WEEKDAGNAMEN = [
  'Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag',
] as const;

/**
 * Hoe een nieuwe lesgroep gaat heten: naar het moment waarop ze lesheeft. `Woensdag 17:00`, of
 * `Woensdag 17:00 — baan 3` als er een baan bij hoort.
 *
 * WAAROM DEZE NAAM NIET DOOR `t()` GAAT. Een groepsnaam wordt opgeslagen en daarna door de
 * beheerder bewerkt: het is inhoud van de club, geen schermtekst. Zou hij vertaald worden, dan
 * zou dezelfde groep anders heten afhankelijk van wie hem aanmaakte, en zou de beheerder die hem
 * hernoemt tegen een tekst aankijken die morgen weer terugspringt. Om dezelfde reden zijn de
 * koppen van de export in fase 4 Nederlands en niet vertaald, en om dezelfde reden is
 * `DAY_LABELS` uit lib/slots hier niet bruikbaar: die afkortingen zijn er voor het scherm.
 *
 * De minuut staat er wél in, ook al telt hij niet mee in `groepSleutel`: de naam hoort de echte
 * begintijd te tonen. Een groep van 17:30 heet `Woensdag 17:30`.
 *
 * Is de baannaam alleen cijfers, dan wordt het `— baan 3`; anders komt de tekst ongewijzigd
 * achter het em-streepje, zoals `.planning/IMPORT-SJABLOON.md` het spelt.
 */
export function groepsnaamUitMoment(
  weekdag: number,
  beginuur: number,
  beginminuut: number,
  baanNaam: string,
): string {
  const dag = WEEKDAGNAMEN[weekdag] ?? '';
  const tijd = `${String(beginuur).padStart(2, '0')}:${String(beginminuut).padStart(2, '0')}`;
  const moment = `${dag} ${tijd}`.trim();
  const baan = baanNaam.trim();
  if (!baan) return moment;
  return `${moment} — ${/^\d+$/.test(baan) ? `baan ${baan}` : baan}`;
}

/**
 * Welke lesgroepen zitten er in dit bestand, en welke daarvan kent de club al?
 *
 * Dit is de kern van de hele fase. De sleutel waarop regels samengevoegd worden is het moment:
 * weekdag + beginuur + baan. Die sleutel komt uit `groepSleutel` in `lib/lesgroepen.ts` — lees
 * het doc-commentaar daar, want daar staat waarom de kolom `Groep` er niet meer in zit. Een
 * tweede, net iets andere sleutel hier naast zetten is exact de fout die deze fase vermijdt: dan
 * herkent de import morgen een groep die de app zelf niet herkent, of andersom.
 *
 * DE KOLOM `GROEP` DOET NIET MEER MEE — niet aan het matchen en niet aan het benoemen. Bij deze
 * club komt die kolom uit het Tennis Vlaanderen-systeem: in `koen.xlsx` staat "Groep 8" op drie
 * momenten met twaalf verschillende mensen en nul overlap. Wat de kolom nog wél draagt is het
 * onderscheid groepsles/privéles: een lége `Groep` is een privéles (IMPORT-SJABLOON), en daar
 * ontstaat geen lesgroep uit.
 *
 * DE BAAN WORDT PER REGEL GELEZEN. Dat heeft een gevolg dat een lezer anders pas in productie
 * ontdekt: een bestand dat dezelfde groep de ene week op baan 1 en de andere week op baan 2 zet,
 * valt uiteen in twee lesgroepen. Dat is inherent aan een afgeleide sleutel, en de weg eruit is
 * de kolom `Groep-ID` — precies zoals `.planning/IMPORT-SJABLOON.md` beschrijft. Om te
 * voorkomen dat het stil gebeurt komt er één waarschuwing per moment dat op verschillende banen
 * blijkt te staan. Eén zin per moment, nooit één per regel: 1398 regels mogen geen muur opleveren (D-09).
 * Bij deze club liggen de banen per groep vast (woensdag terrein 10, vrijdag terrein 8), dus dit
 * is een vangnet dat in de praktijk niet hoort af te gaan.
 *
 * De sleutel telt de beginminuut NIET mee. Twee groepen op hetzelfde uur maar met een andere
 * minuut vallen dus samen. Dat is de bestaande, aanvaarde grofheid van de sleutel van de app.
 *
 * DE NAAM VAN EEN GROEP volgt uit drie regels, in deze volgorde (D-04, D-05, D-06):
 * 1. Is de groep via `Groep-ID` herkend en is de kolom `Groep` gevuld, dan ís dat de naam. Het
 *    bestand komt dan uit de export van deze app, dus hernoemen hoort te werken. Is die kolom
 *    leeg, dan blijft de bestaande naam staan in plaats van leeggemaakt te worden.
 * 2. Anders, bij een bestaande groep: haar eigen naam. Een herimport zonder `Groep-ID`
 *    overschrijft nooit de naam die de beheerder op het groepsscherm gaf.
 * 3. Anders: `groepsnaamUitMoment` — `Woensdag 17:00`, of met de baan erachter.
 *
 * Staat er een `Groep-ID` in het bestand en hoort dat bij een bestaande, niet-gearchiveerde
 * groep, dan wint dat van de sleutel (D-03): zo blijft een groep herkenbaar ook als haar naam,
 * haar uur of haar baan veranderd is. Een `Groep-ID` dat nergens bij hoort — een export van
 * vorig seizoen — levert een waarschuwing op en valt terug op de sleutel, want dat mag een
 * import niet blokkeren.
 */
export function groepenUitRegels(
  regels: readonly LesRegel[],
  bestaande: readonly LesGroep[],
  courts: readonly Court[],
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
  // Per `weekdag|beginuur`: welke banen kwamen daar voorbij? Meer dan één is de stille splitsing
  // waar het doc-commentaar hierboven over gaat, en die krijgt straks één zin.
  const momenten = new Map<string, {
    weekdag: number; beginuur: number; beginminuut: number; regel: number; banen: Set<string>;
  }>();

  for (const r of regels) {
    // Een regel zonder groep is een privéles (IMPORT-SJABLOON): geen groep, geen roster, en
    // uitdrukkelijk ook geen waarschuwing. Dit is het enige waarvoor de kolom `Groep` nog telt —
    // matchen en benoemen doet ze niet meer.
    const naamUitBestand = r.groep.trim();
    if (!naamUitBestand) continue;

    // De weekdag uit lokale velden, dezelfde telling als `LesGroep.weekday` (zondag = 0). Nooit
    // een datum in wereldtijd opbouwen en nooit een ISO-tekst laten parsen: in een westelijke
    // tijdzone schuift de les dan een dag op, en daarmee de hele groepssleutel.
    const dag = new Date(r.datum.jaar, r.datum.maand - 1, r.datum.dag);
    // De baan van déze regel, en niet die van de groep: de sleutel is afgeleid van wat er op de
    // regel staat. Een baan die de club niet kent telt als "geen baan" — `koppelingVoorGroep`
    // meldt dat verderop, en één onbekende naam hoort de groepen niet uit elkaar te trekken.
    const baanVanRegel = zoekBaan(courts, r.baan);
    const sleutel = groepSleutel({
      weekday: dag.getDay(), start_hour: r.uur.uur, court_id: baanVanRegel?.id,
    });

    const momentSleutel = `${dag.getDay()}|${r.uur.uur}`;
    let moment = momenten.get(momentSleutel);
    if (!moment) {
      moment = {
        weekdag: dag.getDay(),
        beginuur: r.uur.uur,
        // De minuut van de eerste regel van dit moment; hij dient alleen om de melding een
        // herkenbare tijd te geven en niet om iets uit elkaar te houden.
        beginminuut: r.uur.minuut,
        regel: r.regel,
        banen: new Set<string>(),
      };
      momenten.set(momentSleutel, moment);
    }
    moment.banen.add(baanVanRegel?.id ?? '');

    let bestaand: LesGroep | null = null;
    let viaGroepId = false;
    if (r.groepId) {
      bestaand = opId.get(r.groepId) ?? null;
      viaGroepId = bestaand !== null;
      if (!bestaand && !gemeldeIds.has(r.groepId)) {
        gemeldeIds.add(r.groepId);
        waarschuwingen.push({
          regel: r.regel,
          reden: 'Deze groep heeft een Groep-ID dat ik niet ken: {waarde}. Ik zoek de groep op dag, uur en baan.',
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
      // De eerste regel bepaalt dag, uur en de ruwe naam uit het bestand. Binnen een
      // sleutel-emmer zijn dag en uur per definitie gelijk; alleen een emmer die op `Groep-ID`
      // samenviel kan er meerdere hebben, en dan is de eerste regel van het bestand het minst
      // willekeurige antwoord.
      emmer = {
        sleutel,
        bestaand,
        viaGroepId,
        naamUitBestand,
        // De naam volgt pas in de afsluitende lus: daar is de baan van de groep bekend, en daar
        // pas is te zeggen of regel 1, 2 of 3 van de naamregels geldt.
        naam: '',
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

  // Eén zin per moment dat op verschillende banen staat, en pas hier: tijdens de lus is nog niet
  // bekend of er een tweede baan komt.
  momenten.forEach((moment) => {
    if (moment.banen.size < 2) return;
    const tijd = `${String(moment.beginuur).padStart(2, '0')}:${String(moment.beginminuut).padStart(2, '0')}`;
    waarschuwingen.push({
      regel: moment.regel,
      reden: 'Op {dag} om {uur} staan lessen op meer dan één baan; ik houd ze uit elkaar als aparte lesgroepen.',
      vars: { dag: WEEKDAGNAMEN[moment.weekdag] ?? '', uur: tijd },
    });
  });

  const groepen: GeplandeGroep[] = [];
  emmers.forEach((emmer) => {
    const niveau = meestVoorkomend(emmer.typen);
    const coach = meestVoorkomend(emmer.coaches);
    // De baan krijgt geen waarschuwing bij verschil: welke baan een les krijgt is een planning
    // die per week mag wisselen, terwijl het niveau en de trainer eigenschappen van de groep
    // zelf zijn. Wat er ontbreekt om te kunnen plannen, meldt `koppelingVoorGroep`.
    const baan = meestVoorkomend(emmer.banen);

    // De drie naamregels van D-04, D-05 en D-06; de onderbouwing staat in het doc-commentaar
    // hierboven. Let op de volgorde: `Groep-ID` wint, daarna de bestaande naam, en pas als er
    // niets van dat al bestond heet de groep naar haar moment.
    emmer.naam = emmer.viaGroepId && emmer.naamUitBestand
      ? emmer.naamUitBestand
      : emmer.bestaand
        ? emmer.bestaand.name
        : groepsnaamUitMoment(emmer.weekdag, emmer.beginuur, emmer.beginminuut, baan.gekozen);

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
      // Het sjabloon van de app kent geen lesduur per groep: één begintijd per les, en de duur
      // komt van de clubinstelling. Zie `GeplandeGroep.duurMinuten`.
      duurMinuten: null,
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
 * Twee dingen liggen hier vast. Ten eerste: deze functie zóekt alleen, en maakt niets aan. Wie
 * er ontbreekt aanmaken doet `trainersUitGroepen`, en dat is sinds 6 september 2026 een aparte,
 * zichtbare stap in het plan (`trainersNieuw`) in plaats van iets wat hier stilletjes gebeurt.
 *
 * WAT ER VAN D-07 OVERBLIJFT. Die afspraak zei: een trainer aanmaken is geen bijproduct van een
 * import, want het betekent een uurtarief en toegang tot de club. De eigenaar heeft dat
 * omgedraaid, en met reden: de clublijst noemt twaalf trainers die de club niet als account
 * heeft, en zonder trainer plant `lessenUitGroep` geen enkele les — dat waren 192 groepen zonder
 * één les. Wat van D-07 overeind blijft is dat het niet stilletjes mag: de droogloop toont de
 * namen vóór het wegschrijven, ze krijgen geen uurtarief, en hun login is een aparte handeling
 * (TRAINERS-LOGIN.sql) en geen gevolg van de import.
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

/**
 * Het domein voor een verzonnen adres. `example.com` is bij RFC 2606 gereserveerd en kan nooit
 * post ontvangen: er gaat met zekerheid geen mail naar een echt persoon die toevallig zo heet.
 * Een eigen domein zou dat niet garanderen.
 */
const DEMO_DOMEIN = 'example.com';

/**
 * Een verzonnen, uniek e-mailadres voor iemand waarvan het bestand er geen geeft.
 *
 * WAAROM DIT MOET BESTAAN. `users.email` is in supabase-schema.sql `unique not null`. De
 * clublijst heeft geen e-mailkolom, dus zonder dit zouden 550 leden allemaal een leeg adres
 * krijgen en zou de tweede daarvan de hele import laten stranden op die unieke sleutel —
 * halverwege, met leerlingen zonder groep als restant. Een leeg adres is hier dus geen "nog niet
 * ingevuld" maar een bom. Dat het nooit opviel komt doordat `koen.xlsx` wél adressen heeft.
 *
 * Het adres is afgeleid van de naam en niet van een toevalsgetal: zo is het te lezen, en ziet de
 * beheerder in Beheer → Leden meteen dat het verzonnen is en van wie.
 *
 * `bezet` gaat erin en wordt hier niet bijgewerkt: de aanroeper houdt die lijst bij, want alleen
 * die weet welke adressen er in dezelfde importbeurt al uitgedeeld zijn.
 */
export function demoAdres(naam: string, bezet: ReadonlySet<string>): string {
  const stam = naam
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  const basis = stam || 'lid';
  let adres = `${basis}@${DEMO_DOMEIN}`;
  let n = 1;
  while (bezet.has(adres)) {
    n += 1;
    adres = `${basis}${n}@${DEMO_DOMEIN}`;
  }
  return adres;
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
/**
 * De drie velden die `spelersUitRegels` van een regel leest.
 *
 * Smal gehouden zodat het weekschema dezelfde spelerslezer kan gebruiken: dat formaat kent geen
 * `LesRegel` — het heeft per groep een lijst namen in één cel — maar wel deze drie. Eén plek die
 * bepaalt wie een bestaand lid is en wie een nieuw, voor allebei de formaten; een tweede zou
 * vroeg of laat anders gaan matchen dan deze.
 */
export type SpelerRegel = Pick<LesRegel, 'regel' | 'leerling' | 'emailLeerling'>;

export function spelersUitRegels(
  regels: readonly SpelerRegel[],
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
  // De adressen die al vergeven zijn: die van de leden die de club kent, plus die van de leden
  // die deze importbeurt zelf aanmaakt. Eén verzameling voor allebei, want een verzonnen adres
  // mag niet botsen met een echt adres én niet met een verzonnen adres van drie regels eerder.
  const bezetteAdressen = new Set(
    users.map((u) => u.email.trim().toLowerCase()).filter(Boolean),
  );
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
    // Een nieuw lid zonder adres krijgt er een verzonnen. Zie `demoAdres` voor waarom dat geen
    // luxe is: een leeg adres kan niet, want `users.email` is uniek én verplicht. Een bestáánd
    // lid raken we niet aan — dat heeft er al een, en dat is misschien wel zijn echte.
    const email = bestaand
      ? emmer.email
      : emmer.email || demoAdres(emmer.naam, bezetteAdressen);
    if (!bestaand) bezetteAdressen.add(email.toLowerCase());
    spelers.push({ naam: emmer.naam, email, bestaand });
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

/** Het seizoen als twee dagsleutels. */
export interface Seizoen {
  van: string;
  tot: string;
}

/** Een dagsleutel jjjj-mm-dd en niets anders — dezelfde vorm als `Vakantie.van`. */
const DAGSLEUTEL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Het seizoen uit de clubinstellingen, of `null` als het er niet bruikbaar in staat.
 *
 * Eén ingang, zodat elke plek die het seizoen nodig heeft dezelfde afwezigheid ziet. `null` is
 * hier geen fout maar een toestand: een club die het nog niet ingesteld heeft hoort dat te
 * lezen te krijgen, niet een verzonnen jaartal te zien.
 *
 * Een half seizoen telt als afwezig. Met één datum zonder de andere kan `lessenUitGroep` niets,
 * en hem aanvullen met een gok is precies wat deze velden moesten wegnemen.
 */
export function seizoenUitSettings(
  settings: Pick<Settings, 'season_start' | 'season_end'>,
): Seizoen | null {
  const van = (settings.season_start ?? '').trim();
  const tot = (settings.season_end ?? '').trim();
  if (!DAGSLEUTEL.test(van) || !DAGSLEUTEL.test(tot)) return null;
  if (tot < van) return null;
  return { van, tot };
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
 * De woorden zijn letterlijk overgenomen: `vakantie` uit `OvergeslagenReden` in lib/recurrence,
 * `verleden` uit `GeblokkeerdeLes` in lib/lesgroepen. Drie vocabulaires voor hetzelfde zou de
 * schermen laten uiteenlopen — dezelfde melding zou dan in Reserveren anders heten dan in de
 * import. `bezet` hoorde hier tot 6 september 2026 ook bij en is uit alle drie verdwenen: een
 * overlap slaat geen les meer over, ze meldt zich (zie `BotsendeLes` hieronder).
 */
export interface OvergeslagenLes {
  sleutel: string;
  start: Date;
  reden: 'vakantie' | 'verleden';
  /** De naam van de vakantie, als dat de reden was. */
  vakantie?: string;
  regel: number;
}

/**
 * Een les die het bestand gewoon inplant, maar die overlapt met een les die er al staat.
 *
 * DIT IS DE MELDING DIE DE IMPORT VAN DEZE CLUB MOGELIJK MAAKT. Op vijf momenten in de echte
 * clubijst staan twee of drie kleutergroepen tegelijk op Terrein 7 — blauw en rood hebben elk
 * maar een halve baan nodig — en op vier daarvan draait dezelfde trainer er twee naast elkaar.
 * Zolang een botsing de les tegenhield, plande de import juist die vijf momenten niet in en
 * verdwenen precies de kinderlessen. Nu gaan ze door en staat de overlap in de droogloop in
 * het rood, zodat de beheerder ziet of het kleutertennis is of een echte vergissing.
 *
 * `groep` staat erbij en niet alleen het regelnummer: de droogloop toont aantallen en namen,
 * geen 1400 regels (D-09), en "Terrein 7 om 14:00" zegt niets zonder te weten wélke groep.
 */
export interface BotsendeLes {
  sleutel: string;
  start: Date;
  regel: number;
  /** De naam van de groep die hier ingepland wordt. */
  groep: string;
  /** De bestaande les waarmee dit moment overlapt. */
  conflict: BezetBoeking;
  /** De trainer en de baan waarvoor de botsing gevonden werd; lib/botsingen maakt er een zin van. */
  coachId: string;
  courtId: string;
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

/**
 * De trainerwissel van één groep: de komende lessen die een andere trainer krijgen, en hoeveel
 * het er zijn.
 *
 * `groep`, `van` en `naar` zijn er om te tonen; `trainerId` is het enige dat weggeschreven wordt.
 * `van` mag leeg zijn — dan heeft de trainer die er stond geen account meer bij de club.
 */
export interface TrainerWissel {
  groep: string;
  /** De naam van de trainer die er nu op staat, of leeg als de club dat account niet (meer) kent. */
  van: string;
  naar: string;
  /** Het id dat op `Booking.coach_id` komt te staan. */
  trainerId: string;
  aantal: number;
  boekingIds: string[];
}

/**
 * Noemt het bestand een andere coach dan wat er op de komende lessen van deze groep staat, dan
 * krijgen die lessen die trainer — met hun aantal erbij, zodat de droogloop het vooraf kan zeggen.
 *
 * `taught_by_id` WORDT NIET AANGERAAKT, EN KÁN HIER NIET AANGERAAKT WORDEN. Dat veld betekent iets
 * anders dan `coach_id`: het zegt wie de les werkelijk gaf, en het bepaalt het loon (fase 2,
 * lib/lesgever). Een les die iemand anders gaf blijft van hem, ook als de groep vandaag een andere
 * vaste trainer krijgt. Het veld staat niet eens in de `Pick` van `ImportBoeking` hierboven, en dat
 * is met opzet: de bescherming zit in het type en niet in een afspraak die iemand ooit vergeet.
 *
 * ALLEEN VOORUIT. `vanGroep` komt uit `groupBookingsFrom(..., nu)` in lib/lesgroepen en bevat per
 * definitie niets van vóór `nu`. Een les die al gegeven is verandert nooit van trainer — dezelfde
 * grens als overal in dit project, en hier bovendien een loonvraag.
 *
 * ER WORDT NIET GERADEN. De app kan niet zien of een `coach_id` met de hand gezet is of door een
 * eerdere import, dus wordt er niet geprobeerd slim te zijn: elke afwijkende komende les gaat mee,
 * de wijziging staat zichtbaar in de droogloop mét het aantal erbij, en de beheerder bevestigt
 * (D-10). Een afgezegde les blijft erbuiten: die wordt nooit meer gegeven.
 *
 * WAT DIT BEWUST NIET CONTROLEERT. De nieuwe trainer krijgt lessen die al op hun eigen moment
 * staan; er wordt geen nieuw uur geclaimd. Maar hij kán op dat uur al een andere les hebben. Dat
 * wordt niet geweigerd en ook niet stil opgelost — het aantal staat in de droogloop en de
 * beheerder ziet wat hij bevestigt.
 */
export function trainerwisselVoorGroep(
  groep: GeplandeGroep,
  koppeling: GroepKoppeling,
  vanGroep: readonly ImportBoeking[],
  users: readonly User[],
): TrainerWissel | null {
  const trainer = koppeling.trainer;
  // Geen bestaande groep: er staat nog geen enkele les die van trainer kan wisselen. Geen trainer:
  // de club kent de naam uit de kolom `Coach` niet, en er wordt er geen verzonnen.
  if (!groep.bestaand || !trainer) return null;

  const boekingen = vanGroep.filter(
    (b) => b.status !== 'cancelled' && b.coach_id !== trainer.id,
  );
  if (boekingen.length === 0) return null;

  return {
    groep: groep.naam,
    van: users.find((u) => u.id === boekingen[0].coach_id)?.name ?? '',
    naar: trainer.name,
    trainerId: trainer.id,
    aantal: boekingen.length,
    boekingIds: boekingen.map((b) => b.id),
  };
}

/** Wat er met de lessen van één groep zou gebeuren. */
export interface GroepLessen {
  /** De lessen die aangemaakt worden. */
  nieuweLessen: GeplandeLes[];
  /** De boekingen die al precies goed staan: zelfde groep, zelfde dag, zelfde beginuur. */
  ongewijzigd: string[];
  /** De lessen uit het bestand die niet doorgaan, met hun reden. */
  overgeslagen: OvergeslagenLes[];
  /**
   * De lessen uit `nieuweLessen` die overlappen met een bestaande les. Ze staan er dus twéé
   * keer in: hier als waarschuwing, en in `nieuweLessen` omdat ze aangemaakt worden.
   */
  botsingen: BotsendeLes[];
  /** De dagen waarop iemand met de hand ingreep. Het bestand overrulet die nooit (D-13). */
  handmatigGewijzigd: HandmatigeWijziging[];
  /** De komende lessen van de groep die het bestand niet meer kent. */
  verdwenenUitBestand: VerdwenenLes[];
  /** Wat er ontbreekt om deze groep te kunnen plannen; komt uit `koppelingVoorGroep`. */
  meldingen: ImportFoutLessen[];
  /** De komende lessen die een andere trainer krijgen, of `null` als er niets wisselt. */
  trainerwissel: TrainerWissel | null;
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
  users: readonly User[],
  bestaandeBoekingen: readonly ImportBoeking[],
  vakanties: readonly Vakantie[],
  duurMinuten: number,
  nu: Date,
): GroepLessen {
  const uit: GroepLessen = {
    nieuweLessen: [],
    ongewijzigd: [],
    overgeslagen: [],
    botsingen: [],
    handmatigGewijzigd: [],
    verdwenenUitBestand: [],
    meldingen: koppeling.meldingen,
    trainerwissel: null,
  };

  // De lessen die deze groep vanaf nu al in de agenda heeft, afgezegde meegerekend: juist een
  // afgezegde les moet gezien worden, want die mag niet stilzwijgend terugkomen. Vandaar
  // `groupBookingsFrom` en niet `komendeLessen` — lees het verschil in lib/lesgroepen. Alles vanaf
  // `nu` vooruit; wat geweest is komt in deze lijst niet voor en wordt dus ook nooit aangeraakt.
  const vanGroep = groep.bestaand
    ? groupBookingsFrom([...bestaandeBoekingen], groep.bestaand.id, nu)
    : [];

  // De trainerwissel staat bewust vóór de terugkeer hieronder. Een groep zonder baan in het
  // bestand plant geen enkele nieuwe les in — maar haar bestaande lessen staan er gewoon, en die
  // horen hun nieuwe trainer wél te krijgen. Anders zou de groep straks trainer Y zeggen en de
  // agenda nog steeds trainer X, en dat is precies de tegenstrijdigheid die deze fase wegneemt.
  uit.trainerwissel = trainerwisselVoorGroep(groep, koppeling, vanGroep, users);

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
    // bij `botstMet`). Een bezette trainer of een bezette baan houdt de les niet meer tegen —
    // dit is precies het kleutertennis op Terrein 7, waar blauw en rood samen op een halve
    // baan staan en dezelfde trainer er twee groepen naast elkaar draait. De les wordt
    // ingepland én gemeld; de bestaande les blijft nog steeds precies staan waar hij staat.
    const conflict = botstMet(slot, bezet, { coachId: trainer.id, courtId: baan.id });
    if (conflict) {
      uit.botsingen.push({
        sleutel, start, regel, groep: groep.naam, conflict,
        coachId: trainer.id, courtId: baan.id,
      });
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
 * Voor weekdag en beginuur is de reden onveranderd: die twee vórmen samen met de baan de sleutel
 * waarmee de groep herkend werd, dus bij een sleutelmatch zijn ze per definitie gelijk.
 *
 * Voor de naam is de reden sinds deze fase een andere, en dat is het makkelijk te missen stuk.
 * De naam zit niet meer in de sleutel, dus hij zóú kunnen verschillen — maar hij doet dat niet,
 * omdat `groepenUitRegels` bij een sleutelmatch bewust de naam van de bestáánde groep overneemt
 * (D-05: een herimport zonder `Groep-ID` overschrijft nooit een naam die de beheerder zelf gaf).
 * Meevergelijken zou hier dus nooit een verschil vinden, en zou de indruk wekken dat de kolom
 * `Groep` een naam kan opdringen. Dat kan ze niet — behalve met een `Groep-ID` erbij.
 *
 * Bij een `Groep-ID`-match is het namelijk net omgekeerd: dáár mogen naam, dag, uur, trainer en
 * baan allemaal verschillen, want dat is precies waarvoor die kolom bestaat
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
  // De duur telt mee als wijziging: een groep die in het bestand van 60 naar 90 minuten gaat,
  // hoort dat in de app ook te worden. Geeft het bestand geen duur, dan blijft staan wat er
  // stond — `null` betekent "de clubinstelling" en dat mag een handmatige correctie niet
  // wegvegen.
  if (groep.duurMinuten !== null && groep.duurMinuten !== bestaand.duration_minutes) {
    wijzigingen.duration_minutes = groep.duurMinuten;
  }
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

/** Het voorvoegsel van een trainer die nog aangemaakt moet worden. Zie `NIEUWE_SPELER`. */
export const NIEUWE_TRAINER = 'nieuwe-trainer:';

/** Een trainer uit het bestand: hoe hij er stond, en wie hij bij ons al is. */
export interface GeplandeTrainer {
  naam: string;
  bestaand: User | null;
}

/** Het id waarmee een nog niet bestaande trainer door het plan reist. */
export function trainerSleutel(trainer: GeplandeTrainer): string {
  return trainer.bestaand ? trainer.bestaand.id : `${NIEUWE_TRAINER}${normalizeName(trainer.naam)}`;
}

/**
 * Wie er in dit bestand lesgeeft, en wie van hen de club al kent.
 *
 * WAAROM DE ONBEKENDEN AANGEMAAKT WORDEN. Tot 6 september 2026 leverde een onbekende trainer een
 * waarschuwing op en kwam de groep er zonder trainer — en zonder trainer plant `lessenUitGroep`
 * geen enkele les, want `Booking.coach_id` is verplicht. Bij de clublijst zijn dat twaalf
 * trainers en dus 192 groepen zonder één les. De beheerder eerst twaalf accounts met de hand
 * laten aanmaken voor hij mag importeren is geen betere uitkomst dan ze aanmaken en het hem in
 * de droogloop laten zien.
 *
 * Ze krijgen rol `coach` en een demo-adres; een login hoort er niet bij, dat doet
 * TRAINERS-LOGIN.sql na afloop.
 *
 * Eén ingang per unieke naam, genormaliseerd: dezelfde trainer op twintig groepen is één
 * account. Precies de vorm van `spelersUitRegels`, en met opzet — het is dezelfde vraag over een
 * andere kolom. Passen er twee bestaande trainers op dezelfde naam, dan komt er géén koppeling
 * uit maar een melding: een derde naamgenoot aanmaken is erger dan hem overslaan.
 */
export function trainersUitGroepen(
  groepen: readonly GeplandeGroep[],
  users: readonly User[],
): { trainers: GeplandeTrainer[]; waarschuwingen: ImportFoutLessen[] } {
  const gezien = new Set<string>();
  const trainers: GeplandeTrainer[] = [];
  const waarschuwingen: ImportFoutLessen[] = [];
  for (const groep of groepen) {
    const naam = groep.coachNaam.trim();
    if (!naam) continue;
    const sleutel = normalizeName(naam);
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    const bestaand = zoekTrainer(users, naam);
    if (!bestaand) {
      // `zoekTrainer` geeft `null` bij niemand én bij twee treffers. Dat verschil telt hier: het
      // eerste geval wordt een nieuw account, het tweede mag er juist geen worden.
      const kandidaten = users.filter(
        (u) => u.role === 'coach' && zelfdeNaamOngeachtVolgorde(u.name, naam),
      );
      if (kandidaten.length > 1) {
        waarschuwingen.push({
          regel: groep.regels[0]?.regel ?? 1,
          reden: 'Er staan al meerdere trainers die {naam} kunnen zijn; koppel deze groep zelf.',
          vars: { naam },
        });
        continue;
      }
    }
    trainers.push({ naam, bestaand });
  }
  return { trainers, waarschuwingen };
}

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
  /**
   * De trainers die de club nog niet als account heeft; die worden aangemaakt. Zie
   * `trainersUitGroepen` voor waarom dat gebeurt en niet alleen gemeld wordt.
   */
  trainersNieuw: GeplandeTrainer[];
  nieuweLessen: GeplandeLes[];
  /** De ids van de boekingen die al precies goed staan. */
  ongewijzigdeLessen: string[];
  overgeslagen: OvergeslagenLes[];
  /**
   * De lessen die ingepland worden maar overlappen met een les die er al staat. Ze staan óók
   * in `nieuweLessen`: dit is een waarschuwing, geen weigering. De droogloop toont ze in het
   * rood — een import die dit zwijgend doorlaat maakt dubbele boekingen aan.
   */
  botsingen: BotsendeLes[];
  handmatigGewijzigd: HandmatigeWijziging[];
  verdwenenUitBestand: VerdwenenLes[];
  /**
   * Per groep de komende lessen die een andere trainer krijgen, met hun aantal erbij. Dit staat
   * in het plan en niet pas in de wijziging, zodat de droogloop vóór het wegschrijven kan zeggen
   * om hoeveel lessen het gaat — de beheerder ziet het, hij ontdekt het niet achteraf (D-10).
   */
  trainerwissels: TrainerWissel[];
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
  settings: Pick<
    Settings, 'lesson_duration_minutes' | 'vakanties' | 'season_start' | 'season_end'
  >,
  nu: Date,
): ImportPlanLessen {
  // Welk van de twee formaten is dit? De clublijst heeft een kolom `Weekdag` en het sjabloon van
  // de app heeft datums; die twee sluiten elkaar uit. Zie `isWeekschema` voor waarom er op dat
  // ene woord gekozen wordt en niet op de zeven koppen samen.
  const isWeek = rijen.length > 0 && isWeekschema(rijen[0]);
  const gelezenWeek = isWeek ? leesWeekRegels(rijen) : null;
  const gelezen = isWeek ? null : leesLesRegels(rijen);
  const gelezenIets = gelezenWeek ?? gelezen;

  const plan: ImportPlanLessen = {
    // `regels` is de lijst van het eerste formaat en blijft dat: het weekschema kent geen
    // `LesRegel`, en er een verzinnen zou een datum verzinnen die de club nooit schreef.
    regels: gelezen?.regels ?? [],
    groepenNieuw: [],
    groepenBijgewerkt: [],
    groepenOngewijzigd: [],
    spelersNieuw: [],
    trainersNieuw: [],
    nieuweLessen: [],
    ongewijzigdeLessen: [],
    overgeslagen: [],
    botsingen: [],
    handmatigGewijzigd: [],
    verdwenenUitBestand: [],
    trainerwissels: [],
    fouten: [...(gelezenIets?.fouten ?? [])],
    waarschuwingen: [],
    nietHerkend: gelezenIets?.nietHerkend ?? [],
    dubbel: gelezenIets?.dubbel ?? [],
  };
  if (!gelezenIets || gelezenIets.regels.length === 0) return plan;

  let uitGroepen: { groepen: GeplandeGroep[]; waarschuwingen: ImportFoutLessen[] };
  let spelerRegels: readonly SpelerRegel[];

  if (gelezenWeek) {
    // Het weekschema heeft geen datums; zonder seizoen valt er niets in te plannen. Een fout en
    // geen waarschuwing: doorgaan zou 192 groepen zonder één les opleveren, en dat leest als "de
    // import deed niets" in plaats van als "er ontbreekt een instelling".
    const seizoen = seizoenUitSettings(settings);
    if (!seizoen) {
      plan.fouten.push({
        regel: 1,
        reden: 'Dit bestand is een weekschema zonder datums, en het seizoen van de club staat nog niet ingesteld.',
      });
      return plan;
    }
    uitGroepen = groepenUitWeekRegels(gelezenWeek.regels, bestaandeGroepen, courts, seizoen);
    spelerRegels = spelerRegelsUitWeek(gelezenWeek.regels);
  } else {
    uitGroepen = groepenUitRegels(gelezen!.regels, bestaandeGroepen, courts);
    spelerRegels = gelezen!.regels;
  }
  plan.waarschuwingen.push(...uitGroepen.waarschuwingen);

  const uitTrainers = trainersUitGroepen(uitGroepen.groepen, users);
  plan.waarschuwingen.push(...uitTrainers.waarschuwingen);
  plan.trainersNieuw = uitTrainers.trainers.filter((tr) => tr.bestaand === null);

  // De nog aan te maken trainers meetellen als bestaande gebruikers voor de rest van dit plan.
  // Zonder dit vindt `koppelingVoorGroep` ze niet en plant `lessenUitGroep` geen les — precies de
  // toestand die deze stap wegneemt. Het zijn plaatshouders; hun echte id ontstaat pas in
  // `bouwImportWijziging`, net als bij een nieuwe speler.
  const usersMetNieuwe: User[] = [
    ...users,
    ...plan.trainersNieuw.map((tr) => ({
      id: trainerSleutel(tr),
      name: tr.naam,
      email: '',
      role: 'coach' as const,
    })),
  ];

  const uitSpelers = spelersUitRegels(spelerRegels, users);
  plan.waarschuwingen.push(...uitSpelers.waarschuwingen);
  plan.spelersNieuw = uitSpelers.spelers.filter((s) => s.bestaand === null);
  // Eén kaart van naam naar id, één keer gebouwd: per groep opnieuw door de spelerslijst lopen
  // maakt van 1400 regels een kwadratische zoektocht (T-05-16).
  const idVanNaam = new Map(uitSpelers.spelers.map((s) => [normalizeName(s.naam), spelerSleutel(s)]));

  const clubDuur = lesduurVan(settings);
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
    const koppeling = koppelingVoorGroep(groep, usersMetNieuwe, courts);
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

    // De duur van de groep wint van die van de club. Vier van de 192 groepen van de club wijken
    // af — twee van 30 minuten, twee van 90 — en die stonden zonder dit op 60.
    const lessen = lessenUitGroep(
      groep, koppeling, usersMetNieuwe, [...raakbaar.values()], vakanties,
      groep.duurMinuten ?? clubDuur, nu,
    );
    plan.nieuweLessen.push(...lessen.nieuweLessen);
    plan.ongewijzigdeLessen.push(...lessen.ongewijzigd);
    plan.overgeslagen.push(...lessen.overgeslagen);
    plan.botsingen.push(...lessen.botsingen);
    plan.handmatigGewijzigd.push(...lessen.handmatigGewijzigd);
    plan.verdwenenUitBestand.push(...lessen.verdwenenUitBestand);
    if (lessen.trainerwissel) plan.trainerwissels.push(lessen.trainerwissel);

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
/**
 * Wat de beheerder apart bevestigde: mag deze import ook wegnemen en omzetten?
 *
 * Er is met opzet GEEN standaardwaarde, dezelfde discipline als `nu` overal in dit importpad.
 * Een standaard `true` zou betekenen dat een aanroeper die vergeet te kiezen stilzwijgend de
 * agenda omzet; een standaard `false` zou betekenen dat hij stilzwijgend de bevestiging van de
 * beheerder negeert. Allebei erger dan een compilefout.
 */
export interface ImportKeuze {
  /** Waar: pas ook toe wat wegneemt of omzet. Onwaar: laat precies díé twee dingen staan. */
  ingrijpend: boolean;
}

export interface ImportWijziging {
  nieuweUsers: User[];
  nieuweGroepen: LesGroep[];
  gewijzigdeGroepen: GroepBijwerking[];
  nieuweBoekingen: Booking[];
  /**
   * De komende lessen die een andere trainer krijgen, met een patch die letterlijk niets anders
   * kan bevatten dan `coach_id`.
   *
   * Die smalle typering is het punt en geen slordigheid. Een `Partial<Booking>` zou de deur
   * openzetten voor een import die er ooit ook `taught_by_id`, `start_time` of `status` in legt,
   * en dan zijn de twee beloften van deze fase — een les die iemand anders gaf blijft van hem, en
   * wat geweest is blijft staan — een afspraak die iemand kan vergeten. Zo is het een fout die
   * niet compileert.
   */
  gewijzigdeBoekingen: Array<{ id: string; patch: { coach_id: string } }>;
  /** Wat er van het plan niet weggeschreven wordt, met regelnummer en reden. */
  fouten: ImportFoutLessen[];
}

/** Wat een uitgevoerde import opleverde: de aantallen, en wat er niet doorging. */
export interface ImportUitslagLessen {
  spelers: number;
  nieuweGroepen: number;
  bijgewerkteGroepen: number;
  lessen: number;
  /** De bestaande lessen die een andere trainer kregen; los geteld van de nieuwe lessen. */
  bijgewerkteLessen: number;
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
  // Alleen zetten als het bestand een duur gaf. Leeg betekent "de lesduur van de club", en dat
  // is iets anders dan nul — zie `LesGroep.duration_minutes`.
  if (inPlan.groep.duurMinuten !== null) groep.duration_minutes = inPlan.groep.duurMinuten;
  return groep;
}

/** Hoeveel lessen er om welke reden niet ingepland worden. */
export interface OvergeslagenTelling {
  /** Ze vallen in een clubvakantie. */
  vakantie: number;
  /** Ze zijn al geweest; wat geweest is blijft staan zoals het was. */
  verleden: number;
}

/**
 * De overgeslagen lessen geteld per reden.
 *
 * Dit hoort hier en niet op het scherm, om dezelfde reden als de rest van dit bestand: de
 * droogloop toont aantallen en geen 1400 regels (D-09), en een scherm dat zelf telt komt vroeg
 * of laat op een ander getal uit dan wat er straks weggeschreven wordt.
 */
export function overgeslagenPerReden(
  plan: Pick<ImportPlanLessen, 'overgeslagen'>,
): OvergeslagenTelling {
  const telling: OvergeslagenTelling = { vakantie: 0, verleden: 0 };
  for (const les of plan.overgeslagen) telling[les.reden] += 1;
  return telling;
}

/**
 * De nieuwe lesgroepen die niet aangemaakt kúnnen worden, met de reden erbij.
 *
 * Dit is dezelfde controle die `addLesGroep` doet en die `bouwImportWijziging` hieronder
 * uitvoert. Ze staat hier apart zodat de droogloop haar kan tonen vóór er iets weggeschreven
 * is, uit één bron — anders leest een beheerder "tien nieuwe lesgroepen", drukt hij op
 * Importeren, en krijgt hij er nul met de uitleg pas achteraf.
 *
 * Dat is geen theoretisch geval. `lesGroepFout` eist een `coach_id` (lib/lesgroepen), en een
 * bestand met een trainer die nog geen account heeft levert dus een fout per groep op. De weg
 * eruit is één handeling: geef die trainer een account en lees hetzelfde bestand opnieuw in.
 *
 * Het rooster blijft hier leeg, en dat mag: `lesGroepFout` kijkt er niet naar. De ids van de
 * nieuwe spelers bestaan op dit moment nog niet — ze zouden het antwoord toch niet veranderen.
 */
export function geweigerdeNieuweGroepen(
  plan: Pick<ImportPlanLessen, 'groepenNieuw'>,
): Array<{ inPlan: GroepInPlan; fout: ImportFoutLessen }> {
  const uit: Array<{ inPlan: GroepInPlan; fout: ImportFoutLessen }> = [];
  for (const inPlan of plan.groepenNieuw) {
    const reden = lesGroepFout(groepUitPlan(inPlan, []));
    if (!reden) continue;
    uit.push({
      inPlan,
      fout: {
        regel: regelVanGroep(inPlan),
        // De reden van `lesGroepFout` is al vertaalde schermtekst; ze wordt als waarde
        // doorgegeven en niet in de zin geplakt, zodat de zin zelf vertaalbaar blijft.
        reden: 'Ik kan de lesgroep {groep} niet aanmaken: {reden} Haar lessen gaan dus ook niet door.',
        vars: { groep: inPlan.naam, reden },
      },
    });
  }
  return uit;
}

// ---------------------------------------------------------------------------
// De rem op de vergissing (IMP-16, IMP-17)
//
// Drie afleidingen over een klaar plan, in dezelfde geest als `overgeslagenPerReden`
// hierboven: ze rekenen niets opnieuw uit, ze staan hier en niet op het scherm, en `nu` komt
// als parameter binnen zodat ze zonder de klok van de machine te testen zijn.
// ---------------------------------------------------------------------------

/** De periode waarover een importbestand gaat, en hoeveel daarvan al voorbij is. */
export interface Bestandsperiode {
  /** De vroegste dag in het bestand, als `jjjj-mm-dd`. */
  van: string;
  /** De laatste dag in het bestand, als `jjjj-mm-dd`. */
  tot: string;
  /** Het deel van de periode `van`–`tot` dat vóór `nu` ligt, van 0 tot 1. */
  aandeelGeweest: number;
}

/** De dag als geheel getal, uit lokale velden — zo weegt zomer- en wintertijd niet mee. */
function dagGetal(jaar: number, maand: number, dag: number): number {
  return Date.UTC(jaar, maand - 1, dag);
}

/**
 * Waar dit bestand over gaat, en hoeveel daarvan al geweest is.
 *
 * Het aandeel gaat over de PERIODE en niet over het aantal regels, en dat is geen detail: de
 * zin die het scherm hiermee bouwt luidt "Dit bestand gaat over 9 september 2026 tot 25 juni
 * 2027, en 60% daarvan is al geweest" (D-17), en "daarvan" slaat op die periode. Een
 * percentage over de regels zou een ander getal geven dan de zin belooft, en het zou meebewegen
 * met hoeveel leerlingen er per les in het bestand staan — dat is geen eigenschap van de tijd.
 *
 * De dagen worden uit lokale datumvelden gebouwd en nooit uit een ISO-tekst gelezen: dat laatste
 * schuift de dag in een westelijke tijdzone, en dan gaat het bestand over de dag ervóór.
 */
export function bestandsperiode(
  regels: readonly LesRegel[],
  nu: Date,
): Bestandsperiode | null {
  // Geen regels, geen periode: er valt dan niets over dit bestand te zeggen, en een verzonnen
  // "vandaag tot vandaag" zou een waarschuwing kunnen afvuren die nergens over gaat.
  if (regels.length === 0) return null;

  let vroegste = regels[0].datum;
  let laatste = regels[0].datum;
  for (const r of regels) {
    const d = dagGetal(r.datum.jaar, r.datum.maand, r.datum.dag);
    if (d < dagGetal(vroegste.jaar, vroegste.maand, vroegste.dag)) vroegste = r.datum;
    if (d > dagGetal(laatste.jaar, laatste.maand, laatste.dag)) laatste = r.datum;
  }

  const vanGetal = dagGetal(vroegste.jaar, vroegste.maand, vroegste.dag);
  const totGetal = dagGetal(laatste.jaar, laatste.maand, laatste.dag);
  const nuGetal = dagGetal(nu.getFullYear(), nu.getMonth() + 1, nu.getDate());
  const spanne = totGetal - vanGetal;
  // Eén dag in het bestand: er valt niets te delen. Vóór die dag is er niets geweest, erna alles.
  const aandeel = spanne <= 0
    ? (nuGetal > vanGetal ? 1 : 0)
    : Math.min(1, Math.max(0, (nuGetal - vanGetal) / spanne));

  return {
    van: dagSleutel(new Date(vroegste.jaar, vroegste.maand - 1, vroegste.dag)),
    tot: dagSleutel(new Date(laatste.jaar, laatste.maand - 1, laatste.dag)),
    aandeelGeweest: aandeel,
  };
}

/** De spelers die volgens dit bestand uit één roster zouden vallen, met hun namen erbij. */
export interface SpelerEruit {
  groep: string;
  namen: string[];
  ids: string[];
}

/** Wat deze import van bestaande gegevens zou wegnemen of omzetten — en verder niets. */
export interface IngrijpendeWijzigingen {
  trainerwissels: TrainerWissel[];
  spelersEruit: SpelerEruit[];
  /** De komende lessen die een andere trainer zouden krijgen, alle wissels bij elkaar. */
  aantalLessen: number;
}

/**
 * Wat er van deze import apart bevestigd hoort te worden (D-16).
 *
 * Twee dingen, en met opzet niet meer: een andere trainer op komende lessen, en een speler die
 * uit een roster verdwijnt. Dat zijn de twee bewegingen die iets wegnemen of omzetten wat er al
 * stond. Erbij komen — een nieuwe groep, een nieuwe speler, een nieuwe les — staat hier
 * uitdrukkelijk niet in en wordt nooit geremd: een rem die overal staat is een rem die niemand
 * meer leest.
 *
 * Deze functie SELECTEERT en rekent niets opnieuw uit. `trainerwissels` is de lijst van het plan
 * ongewijzigd, `aantalLessen` is de som van hun `aantal`, en `spelersEruit` komt regelrecht uit
 * `verwijderd` van de bijgewerkte groepen. Zou hier iets herrekend worden, dan kan het
 * bevestigingsblok iets anders tonen dan wat er straks wel of niet gebeurt — precies de belofte
 * die `bouwImportWijziging` hieronder al bewaakt (D-10).
 *
 * Wat hier bewust NIET in zit: de lessen die uit het bestand verdwenen. Zo'n les is al een
 * melding en nooit een opdracht — de import verwijdert nooit een les (D-13). Er valt dus niets
 * aan te bevestigen.
 */
export function ingrijpendeWijzigingen(
  plan: ImportPlanLessen,
  users: readonly User[],
): IngrijpendeWijzigingen {
  const naamVanId = new Map(users.map((u) => [u.id, u.name] as const));
  const spelersEruit: SpelerEruit[] = [];
  for (const inPlan of plan.groepenBijgewerkt) {
    if (inPlan.verwijderd.length === 0) continue;
    spelersEruit.push({
      groep: inPlan.naam,
      // Kent de club dat account niet meer, dan is het id nog altijd meer dan een lege regel.
      namen: inPlan.verwijderd.map((id) => naamVanId.get(id) ?? id),
      ids: [...inPlan.verwijderd],
    });
  }
  return {
    trainerwissels: plan.trainerwissels,
    spelersEruit,
    aantalLessen: plan.trainerwissels.reduce((som, w) => som + w.aantal, 0),
  };
}

/** De twee dingen waarover de droogloop bovenaan kan waarschuwen. */
export type ImportWaarschuwingSoort = 'verleden' | 'sindsdien-gewijzigd';

export interface ImportWaarschuwing {
  soort: ImportWaarschuwingSoort;
  /** Een vaste zin met plaatshouders, om dezelfde reden als bij `ImportFoutLessen.reden`. */
  reden: string;
  vars: Record<string, string | number>;
}

/**
 * Wat er bovenaan de droogloop hoort te staan, vóór alle aantallen (D-17).
 *
 * Twee waarschuwingen, allebei op bewijs en niet op vermoeden. De eerste zegt waar dit bestand
 * over gaat en hoeveel daarvan al geweest is — dat is de goedkoopste manier om te zien dat je
 * het bestand van vórig seizoen te pakken hebt. De tweede vuurt pas als er allebei iets waar is:
 * er is eerder een seizoen ingelezen, én dit bestand zou nú iets terugdraaien. Alleen een datum
 * is niet genoeg: er is geen wijzigingslogboek in deze app, dus "er is sindsdien iets in de app
 * veranderd" valt uit een tijdstip niet af te leiden (zie `Settings.laatste_trainingen_import`).
 */
export function importWaarschuwingen(
  periode: Bestandsperiode | null,
  ingrijpend: IngrijpendeWijzigingen,
  settings: Pick<Settings, 'laatste_trainingen_import'>,
): ImportWaarschuwing[] {
  const uit: ImportWaarschuwing[] = [];

  if (periode && periode.aandeelGeweest >= 0.5) {
    uit.push({
      soort: 'verleden',
      reden: 'Dit bestand gaat over {van} tot {tot}, en {percentage}% daarvan is al geweest.',
      vars: {
        van: periode.van,
        tot: periode.tot,
        percentage: Math.round(periode.aandeelGeweest * 100),
      },
    });
  }

  const vorige = settings.laatste_trainingen_import;
  const draaitIetsTerug = ingrijpend.aantalLessen > 0 || ingrijpend.spelersEruit.length > 0;
  if (vorige && draaitIetsTerug) {
    // Het opgeslagen tijdstip is een volledige ISO-tekst met tijd en zone erin; die mag wél
    // gelezen worden, in tegenstelling tot een kale dag-tekst. Deugt hij toch niet, dan gaat
    // hij ongewijzigd naar het scherm: liever een rare datum dan geen waarschuwing.
    const gelezen = new Date(vorige);
    uit.push({
      soort: 'sindsdien-gewijzigd',
      reden: 'Je las al eerder een seizoen in op {datum}. Dit bestand draait terug wat je daarna in de app wijzigde — kijk hieronder na wat dat precies is.',
      vars: { datum: Number.isNaN(gelezen.getTime()) ? vorige : dagSleutel(gelezen) },
    });
  }

  return uit;
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
 * bij welke bestaande groep hoort, wie er nieuw is en welke komende lessen van trainer wisselen,
 * heeft `planImportLessen` al beslist en de beheerder al gezien — die laatste lijst mét het aantal
 * erbij, want dat is wat de droogloop toont. Zou deze functie daar iets aan bijstellen, dan schreef ze iets anders weg
 * dan de droogloop toonde — en dan is die droogloop een belofte die niet nagekomen wordt (D-10).
 * De keuze van de beheerder verandert daar niets aan: ze LAAT WEG, ze berekent niets anders.
 *
 * Die keuze werkt op precies twee plekken hieronder, en de asymmetrie is het hele punt (D-16).
 * Wegnemen en omzetten — een andere trainer op komende lessen, een speler die uit een roster
 * valt — is wat een oud bestand terugdraait, en dat gebeurt alleen als de beheerder het apart
 * bevestigde. Erbij komen is nooit ingrijpend en wordt daarom nooit geremd: een nieuwe groep,
 * een nieuwe speler en een nieuwe les gaan altijd door. De gewone weg — een seizoen inladen —
 * blijft één klik, want een rem die overal staat is een rem die niemand meer leest.
 */
export function bouwImportWijziging(
  plan: ImportPlanLessen,
  maakId: (voorvoegsel: string) => string,
  keuze: ImportKeuze,
): ImportWijziging {
  const uit: ImportWijziging = {
    nieuweUsers: [],
    nieuweGroepen: [],
    gewijzigdeGroepen: [],
    nieuweBoekingen: [],
    gewijzigdeBoekingen: [],
    fouten: [],
  };

  // 1. De mensen. Zij hangen nergens aan vast en moeten er eerst zijn: elk rooster en elke groep
  //    hieronder verwijst naar hun ids.
  const idVanPlaatshouder = new Map<string, string>();

  //    De trainers eerst. Een groep zonder trainer plant geen les, dus zij dragen meer dan een
  //    naam. Hun adres is verzonnen — de clublijst heeft geen e-mailkolom — en moet uniek zijn,
  //    want `users.email` is `unique not null`; zie `demoAdres`. `plan.spelersNieuw` draagt zijn
  //    adressen al, dus die tellen hier mee om te voorkomen dat een trainer die óók als speler in
  //    het bestand staat twee keer hetzelfde adres krijgt.
  const bezetteAdressen = new Set(
    plan.spelersNieuw.map((sp) => sp.email.trim().toLowerCase()).filter(Boolean),
  );
  for (const trainer of plan.trainersNieuw) {
    const id = maakId('u');
    idVanPlaatshouder.set(trainerSleutel(trainer), id);
    const email = demoAdres(trainer.naam, bezetteAdressen);
    bezetteAdressen.add(email.toLowerCase());
    uit.nieuweUsers.push({ id, name: trainer.naam, email, role: 'coach' });
  }

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

  /**
   * Hetzelfde voor één trainer-id. Een groep en haar lessen dragen de plaatshouder van een
   * trainer die deze importbeurt zelf aanmaakt; zonder deze vervanging staat straks
   * `coach_id: 'nieuwe-trainer:ann devries'` in de databank en wijst hij nergens naar.
   */
  const echtTrainerId = (id: string): string => idVanPlaatshouder.get(id) ?? id;

  // 2. De groepen. Ze verwijzen naar de spelers hierboven, en de lessen verwijzen straks naar
  //    hen. Het id van een bestaande groep is dat wat de club al kende.
  const idVanGroep = new Map<GeplandeGroep, string>();
  // Dezelfde controle die `addLesGroep` doet, en met opzet vóór de opslag: stuitte de provider
  // er halverwege op, dan stonden de spelers er al en de groep niet — met een lege plek in de
  // agenda tot gevolg. Nu wordt de hele groep overgeslagen en zegt de melding waarom. Ze staat
  // in `geweigerdeNieuweGroepen` hierboven en niet hier, omdat het importscherm precies deze
  // zinnen al in de droogloop toont: één bron, dus wat de beheerder leest is wat er gebeurt.
  const geweigerdeGroepen = geweigerdeNieuweGroepen(plan);
  const geweigerd = new Set<GeplandeGroep>(geweigerdeGroepen.map((g) => g.inPlan.groep));
  for (const g of geweigerdeGroepen) uit.fouten.push(g.fout);

  for (const inPlan of plan.groepenNieuw) {
    if (geweigerd.has(inPlan.groep)) continue;
    const id = maakId('lg');
    idVanGroep.set(inPlan.groep, id);
    const nieuweGroep = { ...groepUitPlan(inPlan, echteIds(inPlan.roster)), id };
    if (nieuweGroep.coach_id) nieuweGroep.coach_id = echtTrainerId(nieuweGroep.coach_id);
    uit.nieuweGroepen.push(nieuweGroep);
  }

  for (const inPlan of plan.groepenBijgewerkt) {
    const bestaand = inPlan.groep.bestaand;
    if (!bestaand) continue;
    idVanGroep.set(inPlan.groep, bestaand.id);
    // Het rooster gaat altijd mee: dat is wat "bijgewerkt" hier betekent. Welke velden verder
    // veranderen heeft `groepWijzigingen` al bepaald — er wordt niets bij bedacht.
    //
    // Eerste van de twee plekken waar de keuze werkt (zie de kop van deze functie). Zonder de
    // aparte bevestiging blijft wie eruit zou vallen gewoon staan; wie erbij komt zit al in
    // `inPlan.roster` en gaat dus hoe dan ook door.
    const rooster = keuze.ingrijpend ? inPlan.roster : [...inPlan.roster, ...inPlan.verwijderd];
    uit.gewijzigdeGroepen.push({
      id: bestaand.id,
      patch: { ...inPlan.wijzigingen, roster: echteIds(rooster) },
    });
  }

  for (const inPlan of plan.groepenOngewijzigd) {
    // Niets bij te werken, maar haar lessen kunnen er wél bij komen: een groep die de club al
    // kent en waar dit bestand een week aan toevoegt.
    if (inPlan.groep.bestaand) idVanGroep.set(inPlan.groep, inPlan.groep.bestaand.id);
  }

  // 2b. De trainerwissels. Een boeking die al bestaat en alleen van trainer wisselt hangt nergens
  //     van af — ze kon net zo goed eerst — maar ze hoort logisch bij de groep waarvan ze is, en
  //     daarom staat ze hier: ná de groepen en vóór de lessen. Welke lessen wisselen staat al in
  //     het plan dat de beheerder goedkeurde; er wordt hier niets herrekend.
  //     Tweede en laatste plek waar de keuze werkt: zonder de aparte bevestiging blijft de
  //     trainer op de komende lessen staan zoals hij stond.
  if (keuze.ingrijpend) {
    for (const wissel of plan.trainerwissels) {
      for (const id of wissel.boekingIds) {
        uit.gewijzigdeBoekingen.push({ id, patch: { coach_id: wissel.trainerId } });
      }
    }
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
    // zonder baan bestaat niet in dit gegevensmodel. Een BAAN wordt hier nog steeds niet
    // verzonnen — die is een ding met een uurtarief en een agenda, en dat volgt niet uit een cel.
    // Een trainer wél, maar dan hierboven en zichtbaar: zie `trainersUitGroepen`.
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
      coach_id: echtTrainerId(inPlan.trainer.id),
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
