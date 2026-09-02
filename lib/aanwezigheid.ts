// Wie er die dag effectief stond. Eén les, één aantekening per speler.
//
// De aanwezigheid hangt aan de boeking en niet aan de speler: het is geen eigenschap van
// een kind maar van een uur op de baan. Zo blijft ze staan waar ze hoort — verdwijnt de
// les, dan verdwijnt de aantekening mee, en een speler die van groep wisselt sleept niets
// mee naar zijn nieuwe lessen.
//
// Ze staat als één jsonb-veld op de les en niet in een eigen tabel, om dezelfde reden als
// de deelnemers zelf (zie de derde keuze bovenaan supabase-schema.sql): dit lijstje wordt
// nooit los opgevraagd of los gewijzigd, altijd samen met zijn les.
//
// Drie standen, en niet twee: aanwezig, afwezig, en "nog niet ingevuld". Die derde is de
// beginstand van elke les en moet apart bestaan — anders staat elke les uit de toekomst,
// en elke les van vóór dit veld, met terugwerkende kracht op "iedereen afwezig".

import { t } from './i18n';
import { lessonPlayerIds, type GroupBooking } from './groups';

/** Wat er per speler genoteerd kan staan. Niets genoteerd is `undefined` — zie hierboven. */
export type Aanwezigheid = 'aanwezig' | 'afwezig';

/** De aantekeningen van één les: speler-id → aanwezig of afwezig. */
export type Aanwezigheden = Record<string, Aanwezigheid>;

/** De velden die dit bestand van een les nodig heeft: wie er meedoet, en wat er genoteerd staat. */
export type AanwezigheidBooking = GroupBooking & { attendance?: Aanwezigheden };

/**
 * Wat er voor deze speler genoteerd staat, of `null` als er niets staat.
 *
 * Alleen voor wie meespeelt. Wie uit de les gehaald werd kan nog een aantekening in het
 * veld hebben staan (`zetAanwezigheid` ruimt die pas op bij de volgende wijziging), en die
 * hoort nergens meer mee te tellen.
 */
export function aanwezigheidVan(
  b: AanwezigheidBooking,
  playerId: string,
): Aanwezigheid | null {
  if (!lessonPlayerIds(b).includes(playerId)) return null;
  const waarde = b.attendance?.[playerId];
  return waarde === 'aanwezig' || waarde === 'afwezig' ? waarde : null;
}

/**
 * De aantekening van één speler zetten, en de rest van de les teruggeven zoals ze was.
 *
 * `null` wist hem, en opnieuw op dezelfde knop tikken doet hetzelfde. Er moet een weg terug
 * zijn naar "nog niet ingevuld": zonder die weg is een verkeerde tik onherstelbaar, en dan
 * staat er de hele winter "afwezig" bij een kind dat er gewoon was.
 *
 * Wat niet meer meespeelt, gaat eruit. Een deelnemer die de trainer uit de les haalde laat
 * anders een aantekening achter die nergens meer op het scherm komt maar wél in elke
 * telling meedoet.
 */
export function zetAanwezigheid(
  b: AanwezigheidBooking,
  playerId: string,
  waarde: Aanwezigheid | null,
): { attendance: Aanwezigheden } {
  const spelers = lessonPlayerIds(b);
  const uit: Aanwezigheden = {};
  for (const id of spelers) {
    const bestaand = b.attendance?.[id];
    if (bestaand === 'aanwezig' || bestaand === 'afwezig') uit[id] = bestaand;
  }
  if (!spelers.includes(playerId)) return { attendance: uit };
  if (waarde === null || uit[playerId] === waarde) delete uit[playerId];
  else uit[playerId] = waarde;
  return { attendance: uit };
}

/** Hoeveel spelers er aanwezig, afwezig en nog niet ingevuld zijn. Telt alleen wie meespeelt. */
export function aanwezigheidTelling(b: AanwezigheidBooking): {
  aanwezig: number;
  afwezig: number;
  open: number;
} {
  let aanwezig = 0;
  let afwezig = 0;
  let open = 0;
  for (const id of lessonPlayerIds(b)) {
    const waarde = aanwezigheidVan(b, id);
    if (waarde === 'aanwezig') aanwezig += 1;
    else if (waarde === 'afwezig') afwezig += 1;
    else open += 1;
  }
  return { aanwezig, afwezig, open };
}

/**
 * De samenvatting boven de knoppen: "2 van 3 aanwezig", met erachter hoeveel er nog open
 * staan. Is er nog niets genoteerd, dan zegt de regel dat met zoveel woorden — een les
 * waar niemand bij afgevinkt is, is iets anders dan een les waar iedereen wegbleef.
 */
export function aanwezigheidRegel(b: AanwezigheidBooking): string {
  const { aanwezig, afwezig, open } = aanwezigheidTelling(b);
  const totaal = aanwezig + afwezig + open;
  if (aanwezig === 0 && afwezig === 0) return t('Nog niets afgevinkt.');
  const kop = t('{n} van {totaal} aanwezig', { n: aanwezig, totaal });
  if (open === 0) return kop;
  return `${kop} · ${open === 1 ? t('1 nog niet afgevinkt') : t('{n} nog niet afgevinkt', { n: open })}`;
}

/**
 * De volgende stand op het afvinkscherm: leeg → aanwezig → afwezig → leeg.
 *
 * Eén rondje, want daar tikt een kind zelf op zijn eigen naam en heeft het maar één knop.
 * Dat de derde tik weer leeg maakt is met opzet: wie zich vergist tikt gewoon door tot de
 * juiste stand er staat, in plaats van de trainer erbij te moeten roepen.
 */
export function volgendeStand(huidig: Aanwezigheid | null): Aanwezigheid | null {
  if (huidig === null) return 'aanwezig';
  if (huidig === 'aanwezig') return 'afwezig';
  return null;
}

/**
 * Mag deze gebruiker de aanwezigheid van deze speler in deze les zetten?
 *
 * De trainer van de les en de beheerder mogen alles: zij vinken af wat er gebeurd is.
 *
 * Daarnaast mag je jezelf zetten — en een ouder zijn kind — maar alleen voor een les die
 * vandaag of later begint. Dat is het verschil tussen je afmelden en de geschiedenis
 * herschrijven: wie er vorige week stond, is wat de trainer zag, en dat hoort niet meer
 * bij te stellen door de andere kant van de rekening. Dezelfde grens staat in de databank
 * (`bewaak_betaalvelden` in supabase-schema.sql) — hier zodat het scherm geen knop
 * aanbiedt die daar geweigerd wordt.
 *
 * `eigenIds` zijn de spelers voor wie je spreekt: jijzelf, plus je goedgekeurde kinderen.
 */
export function magAanwezigheidZetten(
  kijker: { id: string; is_admin?: boolean } | null | undefined,
  booking: AanwezigheidBooking & { coach_id: string; start_time: string },
  playerId: string,
  eigenIds: readonly string[],
  now: Date,
): boolean {
  if (!kijker) return false;
  if (kijker.is_admin === true || booking.coach_id === kijker.id) return true;
  if (!eigenIds.includes(playerId)) return false;
  if (!lessonPlayerIds(booking).includes(playerId)) return false;
  const start = new Date(booking.start_time);
  // Een onleesbare begintijd telt als "niet meer van jou": bij twijfel beslist de trainer.
  if (Number.isNaN(start.getTime())) return false;
  const vandaag = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return start.getTime() >= vandaag.getTime();
}
