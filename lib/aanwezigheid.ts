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
 * Wat het afvinkscherm toont voor deze stand.
 *
 * Niets genoteerd leest als aanwezig, want dat is wat er in de praktijk aan de hand is: op
 * een handvol uitzonderingen na staat iedereen er. De trainer tikt dus alleen de afwezigen
 * aan in plaats van elk kind los te bevestigen.
 *
 * Deze vertaling valt op één plek. Zou elk scherm zelf `?? 'aanwezig'` schrijven, dan gaat
 * de telling (`aanwezigheidTelling`) er vroeg of laat anders over denken dan de namenlijst,
 * en dan klopt de regel "3 van 4 aanwezig" niet meer met wat eronder staat.
 *
 * Let op wat dit NIET doet: het schrijft niets weg. In de databank blijft "niets genoteerd"
 * gewoon leeg staan tot de trainer op Klaar tikt — zie `bevestigAanwezigheid`.
 */
export function getoondeStand(huidig: Aanwezigheid | null): Aanwezigheid {
  return huidig ?? 'aanwezig';
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

/**
 * De les afsluiten: wie nog geen aantekening heeft, was er.
 *
 * Dit is wat de Klaar-knop op het afvinkscherm wegschrijft, en het is het moment waarop
 * "niemand heeft hiernaar gekeken" verandert in "de trainer heeft dit gezien". Dat verschil
 * moet blijven bestaan — een les van volgende maand staat anders nu al op "iedereen
 * aanwezig", en het uitprintbare blad voor invaltrainers (`bladAanwezigheid` in
 * lib/export-trainingen) laat een vakje leeg juist om te zeggen dat er niet gekeken is.
 *
 * Bestaande aantekeningen blijven staan: de afwezigen die de trainer net aantikte, zijn
 * precies waarvoor hij het scherm opende.
 *
 * Wie niet meer meespeelt gaat eruit, om dezelfde reden als bij `zetAanwezigheid`.
 */
export function bevestigAanwezigheid(b: AanwezigheidBooking): { attendance: Aanwezigheden } {
  const uit: Aanwezigheden = {};
  for (const id of lessonPlayerIds(b)) {
    const bestaand = b.attendance?.[id];
    uit[id] = bestaand === 'afwezig' ? 'afwezig' : 'aanwezig';
  }
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
 * De volgende stand op het afvinkscherm: aanwezig ⇄ afwezig.
 *
 * Was een rondje van drie (leeg → aanwezig → afwezig → leeg), zodat een kind dat zijn eigen
 * naam aantikte zich kon herstellen door door te tikken. Dat rondje kostte een trainer drie
 * tikken per kind om bij "afwezig" te komen, terwijl hij er per les hooguit één of twee
 * nodig heeft: de rest staat er gewoon.
 *
 * Nu vertrekt alles vanuit aanwezig (zie `getoondeStand`) en zet één tik iemand op afwezig,
 * de volgende weer terug. Herstellen kan dus nog steeds door door te tikken.
 *
 * De weg terug naar "niets genoteerd" is uit het scherm verdwenen maar niet uit de app:
 * `zetAanwezigheid(b, id, null)` doet het nog, en het detailblad van een les gebruikt dat.
 */
export function volgendeStand(huidig: Aanwezigheid | null): Aanwezigheid {
  return getoondeStand(huidig) === 'aanwezig' ? 'afwezig' : 'aanwezig';
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
