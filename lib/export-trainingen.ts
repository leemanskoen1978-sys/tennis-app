// De bladen van het exportbestand voor de trainingen: puur rekenwerk dat een werkmap
// samenstelt uit gegevens die het scherm al geladen heeft — geen databank, geen scherm, en
// daarom te testen zonder allebei.
//
// Dit bestand rekent zelf geen loon, geen prijs en geen lesgever uit. Het vraagt dat aan
// `lib/reports`, `lib/payments` en `lib/lesgever`, want twee antwoorden op dezelfde vraag
// lopen vroeg of laat uit elkaar — en in een bestand dat de club doorstuurt merkt niemand
// dat het antwoord van gisteren was.

import { type XlsxCel } from './xlsx';
import type { Court, LesGroep, User } from './types';

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
