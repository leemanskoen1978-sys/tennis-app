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
