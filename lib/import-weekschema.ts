// De clublijst lezen: het tweede importformaat.
//
// WAAROM DIT NAAST lib/import-trainingen BESTAAT. Dat bestand leest het sjabloon van de app: één
// regel per les per leerling, met een datum erbij. De club levert iets anders aan — één regel per
// groep, met de spelers komma-gescheiden in één cel, en zonder één datum. Het is een weekschema;
// welke lessen daaruit volgen zegt de clubkalender, niet het bestand.
//
// De twee formaten delen hun uitkomst en verder niets. Deze module vertaalt naar `GeplandeGroep`
// uit lib/import-trainingen, en daar houdt het op: alles wat daarna komt — de spelers, de
// koppeling aan trainer en baan, `lessenUitGroep`, het plan, de droogloop, het toepassen — kent
// geen formaat en werkt voor allebei. Vandaar een aparte module en geen tak in de bestaande
// lezer: het enige wat ze gemeen hebben is het punt waar ze samenkomen, en dat punt staat in de
// andere module.
//
// Deze module schrijft niets weg en kent geen provider: rijen tekst gaan erin, geplande groepen
// komen eruit. Zo blijft ze testbaar zonder databank, net als de rest van lib/.

import {
  groepsnaamUitMoment, leesUurCel, zoekBaan,
  type GeplandeGroep, type ImportFoutLessen, type LesRegel, type Seizoen, type SpelerRegel,
} from './import-trainingen';
import { actieveGroepen, groepSleutel } from './lesgroepen';
import { normalizeName } from './students';
import type { Court, LesGroep } from './types';

// ---------------------------------------------------------------------------
// De cellen
// ---------------------------------------------------------------------------

/**
 * De Nederlandse weekdagen, zondag = 0 — dezelfde telling als `LesGroep.weekday` en
 * `Date#getDay`. De afkortingen staan erbij omdat de club ze in haar eigen lijst gebruikt.
 */
const WEEKDAGEN = new Map<string, number>([
  ['zondag', 0], ['zo', 0],
  ['maandag', 1], ['ma', 1],
  ['dinsdag', 2], ['di', 2],
  ['woensdag', 3], ['wo', 3],
  ['donderdag', 4], ['do', 4],
  ['vrijdag', 5], ['vr', 5],
  ['zaterdag', 6], ['za', 6],
]);

/**
 * De weekdag uit een cel, of `null` als er iets anders staat.
 *
 * `null` en niet 0 bij twijfel: zondag ís 0, en een onleesbare cel die als zondag binnenkomt zou
 * een groep een heel seizoen op de verkeerde dag zetten zonder dat er iets van te zien is.
 */
export function leesWeekdagCel(waarde: string): number | null {
  const sleutel = waarde.trim().toLowerCase();
  if (!sleutel) return null;
  const dag = WEEKDAGEN.get(sleutel);
  return dag === undefined ? null : dag;
}

/** Wat er in de kolom `Uur` staat: waar de les begint, en hoe lang hij duurt. */
export interface UurReeks {
  uur: number;
  minuut: number;
  /**
   * De duur in minuten, of `null` als de cel alleen een begintijd gaf. `null` betekent "de
   * lesduur van de club" en niet "nul minuten"; dat onderscheid is precies waarom dit veld
   * bestaat.
   */
  duurMinuten: number | null;
}

/**
 * De scheiding tussen begin en einde: een streepje in drie schrijfwijzen, of het woord "tot".
 * Het en-streepje staat erbij omdat Excel het gewone koppelteken graag automatisch vervangt.
 */
const REEKSSCHEIDING = /\s*(?:-|–|—|tot)\s*/;

/**
 * De begintijd en de lesduur uit één cel als `16:00 - 17:00`.
 *
 * De duur komt hier vandaan en niet uit de clubinstelling omdat het bestand hem geeft: 188 van
 * de 192 groepen van de club duren 60 minuten, twee 30 en twee 90. Die vier gingen zonder deze
 * functie verloren en stonden op 60 in de agenda.
 *
 * `leesUurCel` uit lib/import-trainingen doet het lezen van één tijdstip en blijft de enige plek
 * die dat kan — hier komt geen tweede versie van. Wat deze functie toevoegt is de reeks: hem
 * doormidden hakken en het verschil uitrekenen.
 */
export function leesUurReeksCel(waarde: string): UurReeks | null {
  const tekst = waarde.trim();
  if (!tekst) return null;
  const delen = tekst.split(REEKSSCHEIDING).filter((d) => d.length > 0);
  const begin = leesUurCel(delen[0] ?? '');
  if (!begin) return null;
  if (delen.length < 2) return { uur: begin.uur, minuut: begin.minuut, duurMinuten: null };
  const einde = leesUurCel(delen[1]);
  if (!einde) return null;
  const duurMinuten = (einde.uur * 60 + einde.minuut) - (begin.uur * 60 + begin.minuut);
  // Een les die eindigt voor hij begint is geen les over middernacht maar een tikfout: de club
  // geeft geen les om half een 's nachts. Doorlaten zou een negatieve duur opleveren, en die
  // maakt `lessenUitGroep` stil kapot.
  if (duurMinuten <= 0) return null;
  return { uur: begin.uur, minuut: begin.minuut, duurMinuten };
}

/** Komma, puntkomma of een regeleinde; alle drie komen ze in de clublijst voor. */
const LIJSTSCHEIDING = /[,;\r\n]+/;

/**
 * Eén cel met meerdere waarden erin, uit elkaar gehaald.
 *
 * Dit is het hart van het verschil met het eerste formaat: daar stond één leerling per regel,
 * hier staan er zeven in één vakje. De volgorde blijft die van het bestand — bij `Trainer(s)` en
 * `Terrein(en)` wint de eerste, en dat mag geen kwestie van toeval zijn.
 *
 * Ontdubbelen gebeurt op kleine letters, want "Jan Jansen" en "jan jansen" zijn binnen één cel
 * dezelfde persoon. Teruggegeven wordt wél de schrijfwijze zoals ze in het bestand stond: die
 * komt straks op een ledenkaart te staan.
 */
export function leesLijstCel(waarde: string): string[] {
  const uit: string[] = [];
  const gezien = new Set<string>();
  for (const stuk of waarde.split(LIJSTSCHEIDING)) {
    const naam = stuk.trim();
    if (!naam) continue;
    const sleutel = naam.toLowerCase();
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    uit.push(naam);
  }
  return uit;
}

// ---------------------------------------------------------------------------
// De koprij, en welk van de twee formaten dit is
// ---------------------------------------------------------------------------

/** Welke kolom waar staat. Alle zeven zijn verplicht: dit formaat komt uit één bron. */
export interface KolommenWeekschema {
  doelgroep: number;
  groep: number;
  weekdag: number;
  uur: number;
  terreinen: number;
  trainers: number;
  spelers: number;
}

/**
 * De koppen zoals de club ze spelt, met de schrijfwijzen die we aannemen. De kop wordt eerst
 * klein gemaakt, van spaties ontdaan — ook die er middenin — en van haakjes: `Terrein(en)`,
 * `Terreinen` en `terrein en` komen alle drie op `terreinen` uit.
 *
 * Een `Map` en geen object-literal, om dezelfde reden als in lib/import-trainingen: een gewoon
 * object erft van `Object.prototype`, dus `{}['constructor']` zou een kolom kunnen lijken.
 */
const WEEKSCHEMA_KOPPEN = new Map<string, keyof KolommenWeekschema>([
  ['doelgroep', 'doelgroep'],
  ['groep', 'groep'],
  ['weekdag', 'weekdag'],
  ['dag', 'weekdag'],
  ['uur', 'uur'],
  ['tijd', 'uur'],
  ['terreinen', 'terreinen'],
  ['terrein', 'terreinen'],
  ['baan', 'terreinen'],
  ['banen', 'terreinen'],
  ['trainers', 'trainers'],
  ['trainer', 'trainers'],
  ['coach', 'trainers'],
  ['spelers', 'spelers'],
  ['speler', 'spelers'],
  ['leerlingen', 'spelers'],
]);

/** Kop naar sleutel: klein, zonder spaties, zonder haakjes. */
function kopSleutel(kop: string): string {
  return kop.trim().toLowerCase().replace(/[()\s]/g, '');
}

export interface KopregelWeekschema {
  kolommen: KolommenWeekschema | null;
  nietHerkend: string[];
  dubbel: string[];
}

/** De zeven velden, in de volgorde waarin de club ze zet. */
const WEEKSCHEMA_VELDEN: Array<keyof KolommenWeekschema> = [
  'doelgroep', 'groep', 'weekdag', 'uur', 'terreinen', 'trainers', 'spelers',
];

/**
 * De koprij van de clublijst lezen.
 *
 * Alle zeven kolommen zijn verplicht, anders dan bij het sjabloon van de app waar er vier
 * optioneel zijn. Dat is geen strengheid om de strengheid: dit formaat komt uit één export van
 * één club, en een ontbrekende kolom betekent hier dat het bestand iets anders is dan we denken
 * — niet dat de beheerder een vakje leegliet.
 */
export function leesKopregelWeekschema(kopregel: readonly string[]): KopregelWeekschema {
  const gevonden = new Map<keyof KolommenWeekschema, number>();
  const nietHerkend: string[] = [];
  const dubbel: string[] = [];
  kopregel.forEach((kop, index) => {
    const rauw = kop.trim();
    if (!rauw) return;
    const veld = WEEKSCHEMA_KOPPEN.get(kopSleutel(rauw));
    if (!veld) { nietHerkend.push(rauw); return; }
    if (gevonden.has(veld)) { dubbel.push(rauw); return; }
    gevonden.set(veld, index);
  });
  if (WEEKSCHEMA_VELDEN.some((v) => !gevonden.has(v))) {
    return { kolommen: null, nietHerkend, dubbel };
  }
  return {
    kolommen: {
      doelgroep: gevonden.get('doelgroep') as number,
      groep: gevonden.get('groep') as number,
      weekdag: gevonden.get('weekdag') as number,
      uur: gevonden.get('uur') as number,
      terreinen: gevonden.get('terreinen') as number,
      trainers: gevonden.get('trainers') as number,
      spelers: gevonden.get('spelers') as number,
    },
    nietHerkend,
    dubbel,
  };
}

/** De schrijfwijzen van de datumkop in het eerste formaat; zie `LESSEN_KOPPEN`. */
const DATUMKOPPEN = new Set(['datum', 'date']);

/**
 * Hoeveel rijen er bovenaan afgezocht worden naar de koprij.
 *
 * WAAROM DIT NIET GEWOON RIJ 1 IS. Het echte bestand van de club begint met een titelregel
 * ("Aanbod: Tennis - Jaarcyclus 2026 - 2027"), dan een lege regel, en pas op rij 3 staan de
 * koppen. Een lezer die alleen naar rij 1 kijkt leest daar één cel met een titel, herkent geen
 * enkele kolom en meldt "de koprij mist een verplichte kolom" over een bestand dat helemaal in
 * orde is.
 *
 * Tien en niet onbeperkt: verder zoeken zou een blad zonder koprij pas na 196 rijen opgeven, en
 * dan is de kans groter dat er een gegevensrij als koprij aangezien wordt dan dat er nog een
 * echte komt. Een export die zijn koppen voorbij rij 10 zet, bestaat niet.
 */
const KOPREGEL_ZOEKDIEPTE = 10;

/**
 * Waar de koprij staat en wat erin staat, of `null` als er in de eerste rijen geen te vinden is.
 */
export function vindKopregelWeekschema(
  rijen: ReadonlyArray<readonly string[]>,
): { index: number; kop: KopregelWeekschema } | null {
  const diepte = Math.min(rijen.length, KOPREGEL_ZOEKDIEPTE);
  for (let i = 0; i < diepte; i++) {
    const kop = leesKopregelWeekschema(rijen[i]);
    if (kop.kolommen) return { index: i, kop };
  }
  return null;
}

/**
 * Is dit blad de clublijst, of het sjabloon van de app?
 *
 * DE DATUM BESLIST, EN NIET DE WEEKDAG. Dat was de eerste opzet en die was fout: `koen.xlsx` —
 * het echte bestand van de club in het éérste formaat — heeft zélf een kolom `Weekdag` staan,
 * naast `Weeknr`, `Locatie` en `Indoor/Outdoor`. De import negeert die kolommen, maar erop
 * kiezen zou dat bestand naar de verkeerde lezer sturen en alle 1398 regels laten verdwijnen.
 * De testsuite ving dat; zonder die test was het pas op de productiedatabank opgevallen.
 *
 * Wat de twee formaten echt scheidt is de datum. Het sjabloon van de app kán niet zonder — één
 * regel is één les op één dag — en de clublijst is een weekschema en heeft er per definitie geen.
 *
 * Allebei getoetst en niet alleen de datum: een bestand zonder datum én zonder weekdag is geen
 * van beide, en hoort de foutmelding van de gewone lezer te krijgen ("de koprij mist een
 * verplichte kolom: Datum, ..."). Dat is de melding die klopt bij een leeg of vreemd blad.
 */
export function isWeekschema(rijen: ReadonlyArray<readonly string[]>): boolean {
  const diepte = Math.min(rijen.length, KOPREGEL_ZOEKDIEPTE);
  for (let i = 0; i < diepte; i++) {
    const sleutels = rijen[i].map(kopSleutel);
    if (sleutels.some((k) => DATUMKOPPEN.has(k))) return false;
    if (sleutels.some((k) => WEEKSCHEMA_KOPPEN.get(k) === 'weekdag')) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Van rijen naar regels
// ---------------------------------------------------------------------------

/** Eén regel van de clublijst: één groep, met alles wat het bestand erover zegt. */
export interface WeekRegel {
  /** Het regelnummer zoals de beheerder het in Excel ziet: de koprij is regel 1. */
  regel: number;
  doelgroep: string;
  groep: string;
  /** 0-6 met zondag = 0, dezelfde telling als `LesGroep.weekday`. */
  weekdag: number;
  beginuur: number;
  beginminuut: number;
  /** `null` als de cel geen einde gaf; dan geldt de lesduur van de club. */
  duurMinuten: number | null;
  terreinen: string[];
  trainers: string[];
  spelers: string[];
}

export interface GelezenWeekschema {
  regels: WeekRegel[];
  fouten: ImportFoutLessen[];
  nietHerkend: string[];
  dubbel: string[];
}

/**
 * Het hele blad, van rauwe teksten naar regels met betekenis. Schrijft niets weg en kijkt naar
 * niets buiten dit bestand: of de trainer bestaat en welke groep dit wordt, is de volgende stap.
 *
 * Eén regel in het bestand leidt tot precies één mededeling, net als in `leesLesRegels`: een rij
 * die op de weekdag sneuvelt krijgt er geen tweede melding over het uur bovenop. Bij 192 regels
 * is dat het verschil tussen een lijstje dat je naloopt en een muur die je wegklikt.
 */
export function leesWeekRegels(rijen: ReadonlyArray<readonly string[]>): GelezenWeekschema {
  const uit: GelezenWeekschema = { regels: [], fouten: [], nietHerkend: [], dubbel: [] };
  if (rijen.length === 0) {
    uit.fouten.push({ regel: 1, reden: 'Dit bestand is leeg.' });
    return uit;
  }

  // Eerst overnemen, dán pas afhaken: juist als de koprij niet deugt heeft de beheerder die
  // lijstjes nodig — dat is het geval waarin hij zijn bestand moet aanpassen. Staat er nergens
  // een bruikbare koprij, dan wordt rij 1 gemeld: dat is de rij waar de beheerder gaat kijken.
  const gevonden = vindKopregelWeekschema(rijen);
  if (!gevonden) {
    const kop = leesKopregelWeekschema(rijen[0]);
    uit.nietHerkend = kop.nietHerkend;
    uit.dubbel = kop.dubbel;
    uit.fouten.push({
      regel: 1,
      reden: 'De koprij mist een verplichte kolom: Doelgroep, Groep, Weekdag, Uur, Terrein(en), Trainer(s) of Speler(s).',
    });
    return uit;
  }
  uit.nietHerkend = gevonden.kop.nietHerkend;
  uit.dubbel = gevonden.kop.dubbel;
  const kolommen = gevonden.kop.kolommen as KolommenWeekschema;

  for (let i = gevonden.index + 1; i < rijen.length; i++) {
    const rij = rijen[i];
    const regel = i + 1;
    const cel = (index: number): string => (rij[index] ?? '').trim();

    // Een rij waarvan alle cellen leeg zijn is geen vergissing: Excel houdt gewiste rijen nog
    // een tijdje vast, en tussen twee doelgroepen staat weleens een witregel.
    if (rij.every((c) => !c || !c.trim())) continue;

    const dagCel = cel(kolommen.weekdag);
    const weekdag = leesWeekdagCel(dagCel);
    if (weekdag === null) {
      uit.fouten.push({
        regel,
        reden: 'Deze weekdag kon niet gelezen worden: {waarde}',
        vars: { waarde: dagCel },
      });
      continue;
    }

    const uurCel = cel(kolommen.uur);
    const reeks = leesUurReeksCel(uurCel);
    if (!reeks) {
      uit.fouten.push({
        regel,
        reden: 'Dit uur kon niet gelezen worden: {waarde}',
        vars: { waarde: uurCel },
      });
      continue;
    }

    // De trainer wordt alleen op leeg gecontroleerd en niet op bestaan: of deze naam een trainer
    // van de club is weet dit bestand niet, en dat hoort bij het plan (D-07).
    const trainers = leesLijstCel(cel(kolommen.trainers));
    if (trainers.length === 0) {
      uit.fouten.push({ regel, reden: 'Geen trainer ingevuld.' });
      continue;
    }

    // Een lege `Speler(s)` is uitdrukkelijk géén fout: er staan twee zulke groepen in de echte
    // clublijst. De groep komt er gewoon, met een leeg rooster.
    uit.regels.push({
      regel,
      doelgroep: cel(kolommen.doelgroep),
      groep: cel(kolommen.groep),
      weekdag,
      beginuur: reeks.uur,
      beginminuut: reeks.minuut,
      duurMinuten: reeks.duurMinuten,
      terreinen: leesLijstCel(cel(kolommen.terreinen)),
      trainers,
      spelers: leesLijstCel(cel(kolommen.spelers)),
    });
  }

  return uit;
}

// ---------------------------------------------------------------------------
// De sleutel
// ---------------------------------------------------------------------------

/**
 * Waar `weekSleutels` naar kijkt.
 *
 * `baanSleutel` en niet de naam uit het bestand: dit moet het baan-ID zijn, want `groepSleutel`
 * in lib/lesgroepen sleutelt bestaande groepen op `court_id`. Zaten de twee kanten in een andere
 * ruimte — hier "terrein 7", daar "c7" — dan vond de import nooit één bestaande groep terug en
 * kwamen er elk seizoen 192 nieuwe bij. Het omzetten van naam naar ID doet `groepenUitWeekRegels`
 * met `zoekBaan`, want alleen die kent de banen van de club.
 */
export interface SleutelRegel {
  weekdag: number;
  beginuur: number;
  baanSleutel: string;
  groep: string;
}

/** De sleutel zonder tiebreak: weekdag, beginuur en de baan — precies `groepSleutel`. */
function grondSleutel(r: SleutelRegel): string {
  return `${r.weekdag}|${r.beginuur}|${r.baanSleutel}`;
}

/**
 * De herkenningssleutel per regel, in dezelfde volgorde als de regels erin gingen.
 *
 * WAAROM DE NAAM ER NIET ALTIJD IN ZIT. De beslissing van de eigenaar: de sleutel is weekdag +
 * uur + terrein, en `Groep` komt er alleen bij als tiebreak. Op de echte clublijst botsen vijf
 * momenten — alle vijf Terrein 7, waar blauw, rood en het multimove samen op een halve baan
 * staan — en met de naam erbij nul. Zat de naam er altijd in, dan zou een groep die de club
 * hernoemt bij de volgende import als nieuwe groep terugkomen, en dat zou voor 187 groepen
 * gelden om vijf gevallen op te lossen.
 *
 * De beginminuut telt niet mee, net zomin als in `groepSleutel` van lib/lesgroepen: twee groepen
 * op 17:00 en 17:15 vallen samen. Dat is de bestaande, aanvaarde grofheid, en hier afwijken zou
 * de import iets anders laten herkennen dan de rest van de app.
 *
 * Blijven twee regels ook mét hun naam gelijk, dan krijgt de tweede een volgnummer. Twee
 * identieke regels zijn een fout in het bestand, maar ze op elkaar laten vallen zou stil één van
 * de twee groepen wegmaken; zo blijven ze allebei zichtbaar.
 */
export function weekSleutels(regels: ReadonlyArray<SleutelRegel>): string[] {
  const telling = new Map<string, number>();
  for (const r of regels) {
    const g = grondSleutel(r);
    telling.set(g, (telling.get(g) ?? 0) + 1);
  }
  const gebruikt = new Map<string, number>();
  return regels.map((r) => {
    const g = grondSleutel(r);
    const basis = (telling.get(g) ?? 0) > 1 ? `${g}|${r.groep.trim().toLowerCase()}` : g;
    const eerder = gebruikt.get(basis) ?? 0;
    gebruikt.set(basis, eerder + 1);
    return eerder === 0 ? basis : `${basis}#${eerder + 1}`;
  });
}

// ---------------------------------------------------------------------------
// Van regels naar geplande groepen — waar de twee formaten samenkomen
// ---------------------------------------------------------------------------

/**
 * De spelers van alle groepen als één platte lijst, zodat `spelersUitRegels` ze kan lezen.
 *
 * De volgorde is die van het bestand, en het regelnummer is dat van de groep waarin de speler
 * stond: een melding over "Jan Jansen" wijst dan naar de regel waar de beheerder hem ziet staan.
 * Ontdubbelen gebeurt hier niet — dat doet `spelersUitRegels` al, en het twee keer doen zou
 * betekenen dat twee plekken moeten blijven afspreken wat dezelfde naam is.
 *
 * De e-mail is altijd leeg: de clublijst heeft geen adreskolom. Wat daarmee gebeurt staat in
 * `demoAdres` — een leeg adres kan niet, want `users.email` is uniek én verplicht.
 */
export function spelerRegelsUitWeek(
  regels: readonly WeekRegel[],
  leden: readonly Groepslid[] = [],
): SpelerRegel[] {
  // Op naam, met de woorden op alfabetische volgorde. De twee bladen van de club schrijven allebei
  // "Naam Voornaam", dus in de praktijk staat er hetzelfde — maar het is één export van één
  // systeem en die kan van vorm veranderen. Dat de volgorde niet uitmaakt is bovendien geen nieuwe
  // regel in deze app: `zelfdeNaamOngeachtVolgorde` in lib/students koppelt "de Clippele Antoine"
  // uit een bestand al aan "Antoine de Clippele" in de ledenlijst. Hier hetzelfde doen houdt de
  // twee bladen bij elkaar op precies de manier waarop het bestand bij de ledenlijst komt.
  //
  // `normalizeName` alleen zou niet volstaan: dat maakt klein en haalt de rare tekens weg, maar
  // laat de volgorde staan.
  const naamsleutel = (naam: string): string => normalizeName(naam).split(' ').sort().join(' ');
  const opNaam = new Map<string, Groepslid>();
  for (const lid of leden) {
    const sleutel = naamsleutel(lid.naam);
    if (!opNaam.has(sleutel)) opNaam.set(sleutel, lid);
  }

  const uit: SpelerRegel[] = [];
  for (const r of regels) {
    for (const naam of r.spelers) {
      const lid = opNaam.get(naamsleutel(naam));
      uit.push({
        regel: r.regel,
        leerling: naam,
        emailLeerling: lid?.email ?? '',
        telefoon: lid?.telefoon ?? '',
      });
    }
  }
  return uit;
}

/**
 * Alle dagen in het seizoen die op deze weekdag vallen, als lesregels voor één groep.
 *
 * WAAROM HIER DATUMS UITGEREKEND WORDEN. `lessenUitGroep` bouwt de lessen van een groep uit haar
 * `regels`: één ingang per moment, met een datum en een uur. Het eerste formaat levert die
 * regels rechtstreeks — één rij is één les op één dag. Het weekschema levert ze niet, en dan zou
 * de groep wél aangemaakt worden en geen enkele les krijgen.
 *
 * Dit is geen datum verzinnen. "Woensdag" plus "7 september tot 30 juni" ís een lijst
 * woensdagen; dat is precies wat de club bedoelt als ze een weekschema aanlevert. Wat de app
 * niet mag doen is een seizoen raden — vandaar dat het uit de clubinstellingen komt en dat
 * `planImportLessen` weigert zolang het er niet staat.
 *
 * De vakanties worden hier NIET overgeslagen. Dat doet `lessenUitGroep` verderop, en het daar
 * laten houdt één plek die weet wanneer de club dicht is; hier een tweede zeef bouwen zou de
 * twee formaten uit elkaar laten lopen zodra de kalender verandert.
 */
function lesregelsInSeizoen(r: WeekRegel, seizoen: Seizoen): LesRegel[] {
  const [jv, mv, dv] = seizoen.van.split('-').map(Number);
  const [jt, mt, dt] = seizoen.tot.split('-').map(Number);
  const eerste = new Date(jv, mv - 1, dv);
  const laatste = new Date(jt, mt - 1, dt);
  // Vooruit naar de eerste keer dat deze weekdag valt. `getDay` telt zondag = 0, net als
  // `WEEKDAGEN` hierboven en `LesGroep.weekday`.
  const stap = (r.weekdag - eerste.getDay() + 7) % 7;
  const regels: LesRegel[] = [];
  const dag = new Date(eerste.getFullYear(), eerste.getMonth(), eerste.getDate() + stap);
  while (dag.getTime() <= laatste.getTime()) {
    regels.push({
      regel: r.regel,
      datum: { jaar: dag.getFullYear(), maand: dag.getMonth() + 1, dag: dag.getDate() },
      uur: { uur: r.beginuur, minuut: r.beginminuut },
      groep: r.groep,
      groepId: '',
      typeLes: r.doelgroep,
      coach: r.trainers[0] ?? '',
      // De leerling staat hier niet in: het weekschema kent één spelerslijst per groep, niet per
      // les. `lessenUitGroep` leest van een regel alleen het regelnummer, de datum en het uur —
      // wie er in de groep zit komt uit het rooster, en dat is bij dit formaat het enige juiste.
      leerling: '',
      emailLeerling: '',
      baan: r.terreinen[0] ?? '',
    });
    dag.setDate(dag.getDate() + 7);
  }
  return regels;
}

/**
 * Van regels naar geplande groepen: de laatste stap die het formaat nog kent.
 *
 * Wat hier met opzet NIET gebeurt: de trainer opzoeken, de spelers aan leden koppelen, de lessen
 * inplannen. Dat doet `planImportLessen` voor allebei de formaten met dezelfde functies. Deze
 * functie levert `GeplandeGroep` op, en daarmee houdt het verschil tussen de twee bestanden op te
 * bestaan.
 *
 * Het seizoen komt van buiten en niet uit het bestand, want het bestand heeft geen datums. Het
 * staat in de clubinstellingen sinds SEIZOEN-EN-LESDUUR.sql; `seizoenUitSettings` haalt het eruit
 * en `planImportLessen` weigert het weekschema zolang het er niet staat.
 */
export function groepenUitWeekRegels(
  regels: readonly WeekRegel[],
  bestaande: readonly LesGroep[],
  courts: readonly Court[],
  seizoen: Seizoen,
): { groepen: GeplandeGroep[]; waarschuwingen: ImportFoutLessen[] } {
  const waarschuwingen: ImportFoutLessen[] = [];

  // Gearchiveerde groepen tellen niet mee bij het herkennen — dezelfde regel als in
  // `groepenUitRegels`: archiveren was een bewuste daad van de club, en een import die zo'n groep
  // weer tot leven wekt maakt die daad ongedaan zonder het te vragen. Er komt dan een nieuwe bij.
  const actief = actieveGroepen([...bestaande]);
  const opSleutel = new Map<string, LesGroep>();
  const opNaamSleutel = new Map<string, LesGroep>();
  for (const g of actief) {
    // De eerste wint: twee actieve groepen op dezelfde sleutel mag (zie `lesGroepFout`), en welke
    // van de twee we dan kiezen is niet aan de import om stil te veranderen.
    if (!opSleutel.has(groepSleutel(g))) opSleutel.set(groepSleutel(g), g);
    // Dezelfde tiebreak als in het bestand, maar dan over de bestaande groepen. Zonder deze kaart
    // zou een bestand waarin het kleutertennis mét naam gesleuteld is nooit meer dan één van die
    // groepen terugvinden — de andere zou elk seizoen als nieuwe groep terugkomen.
    const metNaam = `${groepSleutel(g)}|${g.name.trim().toLowerCase()}`;
    if (!opNaamSleutel.has(metNaam)) opNaamSleutel.set(metNaam, g);
  }

  // Naam naar ID, vóór het sleutelen. Kent de club de baan niet, dan blijft de naam staan als
  // sleutel: zo botsen twee groepen op datzelfde onbekende terrein nog steeds met elkaar, en
  // niet met een groep zonder baan.
  const baanSleutelVan = (r: WeekRegel): string => {
    const naam = (r.terreinen[0] ?? '').trim();
    if (!naam) return '';
    return zoekBaan(courts, naam)?.id ?? naam.toLowerCase();
  };

  const sleutels = weekSleutels(regels.map((r) => ({
    weekdag: r.weekdag,
    beginuur: r.beginuur,
    baanSleutel: baanSleutelVan(r),
    groep: r.groep,
  })));
  const groepen = regels.map((r, i): GeplandeGroep => {
    const sleutel = sleutels[i];
    const baanNaam = (r.terreinen[0] ?? '').trim();

    if (r.terreinen.length > 1) {
      waarschuwingen.push({
        regel: r.regel,
        reden: 'Deze groep staat op meerdere terreinen; ik zet haar op {baan}. De andere: {rest}.',
        vars: { baan: baanNaam, rest: r.terreinen.slice(1).join(', ') },
      });
    }
    if (r.trainers.length > 1) {
      waarschuwingen.push({
        regel: r.regel,
        reden: 'Deze groep heeft meerdere trainers; ik zet {trainer} erop. De andere: {rest}.',
        vars: { trainer: r.trainers[0], rest: r.trainers.slice(1).join(', ') },
      });
    }
    if (baanNaam && !zoekBaan(courts, baanNaam)) {
      waarschuwingen.push({
        regel: r.regel,
        reden: 'Dit terrein kent de club niet: {baan}. De groep komt er wel, maar zonder lessen tot ze een baan heeft.',
        vars: { baan: baanNaam },
      });
    }

    // Eerst op de sleutel mét naam, dan op de grondsleutel — en niet andersom. Een bestand dat de
    // naam nodig had om twee groepen uit elkaar te houden moet ze allebei kunnen terugvinden;
    // zonder deze volgorde zouden ze samen naar dezelfde bestaande groep wijzen.
    const bestaandeGroep = opNaamSleutel.get(sleutel) ?? opSleutel.get(sleutel) ?? null;

    return {
      sleutel,
      bestaand: bestaandeGroep,
      // Dit formaat heeft geen kolom `Groep-ID`; het herkennen loopt uitsluitend via de sleutel.
      viaGroepId: false,
      naam: r.groep.trim() || groepsnaamUitMoment(r.weekdag, r.beginuur, r.beginminuut, baanNaam),
      niveau: r.doelgroep.trim(),
      weekdag: r.weekdag,
      beginuur: r.beginuur,
      beginminuut: r.beginminuut,
      duurMinuten: r.duurMinuten,
      coachNaam: r.trainers[0] ?? '',
      baanNaam,
      seizoenVan: seizoen.van,
      seizoenTot: seizoen.tot,
      leerlingNamen: r.spelers,
      // De momenten waarop deze groep lesheeft, uitgerekend uit haar weekdag en het seizoen.
      // Zie `lesregelsInSeizoen` voor waarom dat hier gebeurt en niet in `lessenUitGroep`.
      regels: lesregelsInSeizoen(r, seizoen),
    };
  });

  return { groepen, waarschuwingen };
}

// ---------------------------------------------------------------------------
// Het tweede blad: groepsleden
//
// De werkmap van de club heeft twee bladen. `groepen` is het weekschema hierboven; `groepsleden`
// zet dezelfde spelers nóg een keer neer, één regel per lid per groep, mét hun e-mailadres,
// gsm-nummer en geboortedatum.
//
// WAAROM DAT BLAD ERBIJ GELEZEN WORDT. Zonder dit krijgen 552 spelers een verzonnen adres op
// example.com, terwijl hun echte adres in hetzelfde bestand staat. Dat is niet alleen zonde: een
// club die haar spelers niet vanuit de app kan bereiken, gaat het ergens anders doen.
//
// WAT ER NIET UIT GELEZEN WORDT, en met opzet: het rooster. Wie er in welke groep zit staat in de
// kolom `Speler(s)` van het blad `groepen`, en dat blijft de bron. Twee bronnen voor hetzelfde
// rooster betekent twee antwoorden zodra ze uiteenlopen, en dan moet er een derde regel komen die
// zegt welke wint. Dit blad doet één ding: het vult aan wat de club over een speler weet.
//
// De geboortedatum wordt evenmin overgenomen. `User` heeft er geen veld voor, en er een bij
// verzinnen omdat het bestand het toevallig levert is een reden om later spijt te hebben.
// ---------------------------------------------------------------------------

/** Welke kolom waar staat op het blad `groepsleden`. Alleen wat we echt gebruiken. */
export interface KolommenGroepsleden {
  naam: number;
  voornaam: number;
  email: number;
  gsm: number;
}

/** De koppen van dat blad, met dezelfde normalisatie als hierboven. */
const GROEPSLEDEN_KOPPEN = new Map<string, keyof KolommenGroepsleden>([
  ['naam', 'naam'],
  ['achternaam', 'naam'],
  ['voornaam', 'voornaam'],
  ['e-mailadres', 'email'],
  ['emailadres', 'email'],
  ['e-mail', 'email'],
  ['email', 'email'],
  ['gsm-nummer', 'gsm'],
  ['gsmnummer', 'gsm'],
  ['gsm', 'gsm'],
  ['telefoon', 'gsm'],
]);

/** De vier velden die dit blad moet hebben om bruikbaar te zijn. */
const GROEPSLEDEN_VELDEN: Array<keyof KolommenGroepsleden> = ['naam', 'voornaam', 'email', 'gsm'];

function leesKopregelGroepsleden(kopregel: readonly string[]): KolommenGroepsleden | null {
  const gevonden = new Map<keyof KolommenGroepsleden, number>();
  kopregel.forEach((kop, index) => {
    const veld = GROEPSLEDEN_KOPPEN.get(kopSleutel(kop));
    if (veld && !gevonden.has(veld)) gevonden.set(veld, index);
  });
  if (GROEPSLEDEN_VELDEN.some((v) => !gevonden.has(v))) return null;
  return {
    naam: gevonden.get('naam') as number,
    voornaam: gevonden.get('voornaam') as number,
    email: gevonden.get('email') as number,
    gsm: gevonden.get('gsm') as number,
  };
}

/** Eén lid van de club, zoals het blad `groepsleden` hem kent. */
export interface Groepslid {
  /**
   * Naam en voornaam aan elkaar, in die volgorde — precies zoals de kolom `Speler(s)` van het
   * andere blad ze schrijft ("Jansen Jan"). Zo vinden de twee bladen elkaar zonder dat er een
   * tweede naamregel bij komt: `zoekOpNaam` uit lib/students doet de rest, en die kan al met een
   * omgedraaide volgorde overweg.
   */
  naam: string;
  email: string;
  telefoon: string;
}

/**
 * Is dit blad de ledenlijst uit de werkmap van de club?
 *
 * Op `Voornaam` én een adreskolom: `Voornaam` scheidt dit blad van `groepen` (dat heeft alleen
 * `Speler(s)`), en de adreskolom is het enige waarvoor dit blad erbij gelezen wordt.
 */
export function isGroepsledenBlad(rijen: ReadonlyArray<readonly string[]>): boolean {
  const diepte = Math.min(rijen.length, KOPREGEL_ZOEKDIEPTE);
  for (let i = 0; i < diepte; i++) {
    if (leesKopregelGroepsleden(rijen[i])) return true;
  }
  return false;
}

/**
 * De leden van dat blad, ontdubbeld op naam.
 *
 * Ontdubbeld omdat een speler die in twee groepen zit er twee keer op staat: 666 regels voor 552
 * spelers. Het eerste ingevulde adres wint, net als in `spelersUitRegels` — later overschrijven
 * zou regel 600 stil laten bepalen wie er post krijgt, en leeg overschrijven zou een adres
 * kwijtmaken.
 *
 * Regels zonder naam of zonder voornaam vallen weg zonder melding. Dit blad is een aanvulling en
 * geen opdracht: wat er niet in staat, blijft gewoon zoals het zonder dit blad was.
 */
export function leesGroepsleden(rijen: ReadonlyArray<readonly string[]>): Groepslid[] {
  const diepte = Math.min(rijen.length, KOPREGEL_ZOEKDIEPTE);
  let kop: KolommenGroepsleden | null = null;
  let start = 0;
  for (let i = 0; i < diepte; i++) {
    const gevonden = leesKopregelGroepsleden(rijen[i]);
    if (gevonden) { kop = gevonden; start = i + 1; break; }
  }
  if (!kop) return [];

  const opNaam = new Map<string, Groepslid>();
  for (let i = start; i < rijen.length; i++) {
    const rij = rijen[i];
    const cel = (index: number): string => (rij[index] ?? '').trim();
    const achternaam = cel(kop.naam);
    const voornaam = cel(kop.voornaam);
    if (!achternaam || !voornaam) continue;
    const naam = `${achternaam} ${voornaam}`;
    const sleutel = naam.toLowerCase();
    const bestaand = opNaam.get(sleutel);
    if (!bestaand) {
      opNaam.set(sleutel, { naam, email: cel(kop.email), telefoon: cel(kop.gsm) });
      continue;
    }
    if (!bestaand.email) bestaand.email = cel(kop.email);
    if (!bestaand.telefoon) bestaand.telefoon = cel(kop.gsm);
  }
  return [...opNaam.values()];
}
