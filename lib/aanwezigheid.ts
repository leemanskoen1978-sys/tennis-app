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
import { lesgeverId } from './lesgever';

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
    uit[id] = getoondeStand(aanwezigheidVan(b, id));
  }
  return { attendance: uit };
}

/**
 * Mag deze les in één keer bevestigd worden — de Klaar-knop van het afvinkscherm?
 *
 * Alleen als hij begonnen is. Afvinken is vaststellen wie er stond, en dat kun je pas zien
 * als de les bezig is. Het scherm toont met opzet ook lessen die nog moeten komen, zodat een
 * trainer alvast iemand kan afmelden die zich afmeldde; die ene aantekening is een mededeling
 * en mag. De hele groep aanwezig verklaren is een waarneming, en die kan nog niet gedaan zijn.
 *
 * Zonder deze grens zou één tik op Klaar bij een les van volgende week "hier heeft niemand
 * naar gekeken" wegnemen voor die hele groep — precies wat de derde stand moet bewaken, en
 * vanaf dit scherm niet meer terug te draaien.
 */
export function magLesBevestigen(
  booking: { start_time: string },
  now: Date,
): boolean {
  const start = new Date(booking.start_time);
  // Een onleesbare begintijd telt als "nog niet begonnen": bij twijfel niets vastleggen.
  if (Number.isNaN(start.getTime())) return false;
  return start.getTime() <= now.getTime();
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
 * Hoe vaak deze ene speler er was, over een reeks lessen.
 *
 * `aanwezigheidTelling` telt één les over al zijn spelers; dit telt één speler over al zijn
 * lessen. Dat is de vraag die het spelersdossier stelt, en tot nu toe stelde niets in de app
 * die vraag — aanwezigheid bestond alleen per losse les.
 *
 * De drie standen blijven gescheiden. "Niet afgevinkt" mag niet bij "aanwezig" opgeteld
 * worden: een les waar niemand naar keek is geen aanwezigheid, en juist die vermenging is
 * wat het hele driestandenmodel moet voorkomen.
 *
 * `totaal` telt alleen de lessen waarin deze speler meespeelt, want alleen die zeggen iets
 * over hem.
 */
export function aanwezigheidOverzicht(
  bookings: readonly AanwezigheidBooking[],
  playerId: string,
): { aanwezig: number; afwezig: number; open: number; totaal: number } {
  let aanwezig = 0;
  let afwezig = 0;
  let open = 0;
  for (const b of bookings) {
    if (!lessonPlayerIds(b).includes(playerId)) continue;
    const stand = aanwezigheidVan(b, playerId);
    if (stand === 'aanwezig') aanwezig += 1;
    else if (stand === 'afwezig') afwezig += 1;
    else open += 1;
  }
  return { aanwezig, afwezig, open, totaal: aanwezig + afwezig + open };
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
 * De volgende stand op het afvinkscherm.
 *
 * Was een rondje van drie (leeg → aanwezig → afwezig → leeg), zodat een kind dat zijn eigen
 * naam aantikte zich kon herstellen door door te tikken. Dat rondje kostte een trainer drie
 * tikken per kind om bij "afwezig" te komen, terwijl hij er per les hooguit één of twee
 * nodig heeft: de rest staat er gewoon.
 *
 * Bij een les die bezig is, is het daarom een schakelaar: alles vertrekt vanuit aanwezig
 * (zie `getoondeStand`), één tik zet iemand op afwezig, de volgende weer terug.
 *
 * Bij een les die nog moet beginnen niet. Het scherm toont die lessen met opzet, zodat een
 * trainer alvast iemand kan afmelden die zich afmeldde. Zo'n afmelding is een mededeling en
 * mag. Maar de weg terug mag daar géén 'aanwezig' wegschrijven: dat is een waarneming, en
 * die kan nog niet gedaan zijn. Er zou dan een les van volgende maand een aanwezigheid
 * claimen die niemand ooit vaststelde — precies wat de derde stand moet bewaken, en vanaf
 * dit scherm niet meer terug te draaien. Daar gaat de tik dus terug naar niets-genoteerd,
 * wat op het scherm weer als aanwezig leest. Voor de trainer voelt het identiek.
 *
 * De weg terug naar "niets genoteerd" bestaat verder in `zetAanwezigheid`, op twee manieren:
 * `null` doorgeven, en opnieuw tikken op de stand die er al staat (de test
 * `uit[playerId] === waarde`). Het detailblad van een les gebruikt die tweede. Wie ooit die
 * zelfwissende tak opruimt omdat hij op een ongelukje lijkt, haalt de enige weg terug weg
 * die er in de app echt gebruikt wordt.
 */
export function volgendeStand(
  huidig: Aanwezigheid | null,
  lesBegonnen: boolean,
): Aanwezigheid | null {
  if (!lesBegonnen) return huidig === 'afwezig' ? null : 'afwezig';
  return getoondeStand(huidig) === 'aanwezig' ? 'afwezig' : 'aanwezig';
}

/**
 * De kalenderdag in Brussel, als `JJJJ-MM-DD`.
 *
 * De databank rekent hard in `Europe/Brussels` (`date_trunc('day', now() at time zone
 * 'Europe/Brussels')` in `bewaak_betaalvelden`). Rekende de app in de tijdzone van het
 * toestel, dan lopen de twee grenzen een dag uit elkaar voor wie van elders inlogt, en biedt
 * het scherm een knop aan die de databank weigert. De club staat in België; dat is de dag
 * die telt.
 *
 * Als tekst en niet als Date, zodat twee dagen met een gewone vergelijking te ordenen zijn.
 */
export function brusselseDag(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

/**
 * Mag deze gebruiker de aanwezigheid van deze speler in deze les zetten?
 *
 * De beheerder mag alles, altijd. Iedereen anders is gebonden aan de dag van de les: je mag
 * een les van vandaag of later bijstellen, en niets van gisteren of eerder.
 *
 * Dat geldt sinds vandaag óók voor de trainer van de les. Die had hier een onvoorwaardelijke
 * pas, en daarmee kon hij de geschiedenis van een heel seizoen herschrijven. Wat geweest is,
 * is wat er op de baan is vastgesteld; vergat hij af te vinken, dan meldt hij het aan de
 * beheerder en die zet het recht.
 *
 * De grens is de DAG en niet het uur, en dat is met opzet. Afvinken gebeurt ná de les: zou de
 * grens "zodra de les voorbij is" zijn, dan blokkeert ze een trainer die zijn groep om vijf
 * over het uur afvinkt — het gewone geval, geen correctie.
 *
 * `lesgeverId` en niet `coach_id`: een vervanger die de les overnam, staat op de baan en
 * vinkt dus af. Dezelfde scheur zat in de Klaar-knop en is daar al rechtgezet.
 *
 * Voor een speler of ouder komt er bovenop dat het over zijn eigen aantekening moet gaan:
 * je meldt jezelf af, niet je medespeler. `eigenIds` zijn de spelers voor wie je spreekt —
 * jijzelf, plus je goedgekeurde kinderen.
 *
 * De databank bewaakt dezelfde grens (`bewaak_betaalvelden` in supabase-schema.sql). Deze
 * functie zorgt alleen dat het scherm niets aanbiedt wat daar geweigerd wordt.
 */
export function magAanwezigheidZetten(
  kijker: { id: string; is_admin?: boolean } | null | undefined,
  booking: AanwezigheidBooking & { coach_id: string; taught_by_id?: string; start_time: string },
  playerId: string,
  eigenIds: readonly string[],
  now: Date,
): boolean {
  if (!kijker) return false;
  if (kijker.is_admin === true) return true;

  const start = new Date(booking.start_time);
  // Een onleesbare begintijd telt als "niet meer van jou": bij twijfel beslist de beheerder.
  if (Number.isNaN(start.getTime())) return false;
  if (brusselseDag(start) < brusselseDag(now)) return false;

  if (lesgeverId(booking) === kijker.id) return true;
  if (!eigenIds.includes(playerId)) return false;
  return lessonPlayerIds(booking).includes(playerId);
}
