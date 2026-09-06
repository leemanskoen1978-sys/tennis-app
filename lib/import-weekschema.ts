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

import { leesUurCel } from './import-trainingen';

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
