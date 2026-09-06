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

import { leesUurCel, type ImportFoutLessen } from './import-trainingen';

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

/**
 * Is dit blad de clublijst, of het sjabloon van de app?
 *
 * Op `Weekdag` en niet op de zeven kolommen samen: een bestand waarin één kop verkeerd gespeld
 * is, hoort de nette foutmelding van deze lezer te krijgen ("de koprij mist een verplichte
 * kolom") en niet stilzwijgend door de andere lezer beoordeeld te worden, die dan over een
 * ontbrekende `Datum` klaagt. `Weekdag` is bovendien het ene woord dat in het sjabloon van de
 * app niet voorkomt en er ook nooit in kan komen: dat sjabloon heeft datums.
 */
export function isWeekschema(kopregel: readonly string[]): boolean {
  return kopregel.some((kop) => WEEKSCHEMA_KOPPEN.get(kopSleutel(kop)) === 'weekdag');
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
  // lijstjes nodig — dat is het geval waarin hij zijn bestand moet aanpassen.
  const kop = leesKopregelWeekschema(rijen[0]);
  uit.nietHerkend = kop.nietHerkend;
  uit.dubbel = kop.dubbel;
  const { kolommen } = kop;
  if (!kolommen) {
    uit.fouten.push({
      regel: 1,
      reden: 'De koprij mist een verplichte kolom: Doelgroep, Groep, Weekdag, Uur, Terrein(en), Trainer(s) of Speler(s).',
    });
    return uit;
  }

  for (let i = 1; i < rijen.length; i++) {
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

/** Waar `weekSleutels` naar kijkt. Smal gehouden, zodat een test geen hele regel hoeft te bouwen. */
export type SleutelRegel = Pick<WeekRegel, 'weekdag' | 'beginuur' | 'terreinen' | 'groep'>;

/** De sleutel zonder tiebreak: weekdag, beginuur en het eerste terrein. */
function grondSleutel(r: SleutelRegel): string {
  return `${r.weekdag}|${r.beginuur}|${(r.terreinen[0] ?? '').trim().toLowerCase()}`;
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
