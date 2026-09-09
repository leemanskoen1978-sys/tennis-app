// Welk lesmateriaal geldt er voor deze les?
//
// De tennisschool werkt met een lessenboekje: in een bepaalde periode doet een groep of een
// trainer een bepaalde training. Dit bestand beantwoordt als ENIGE de vraag welk materiaal er
// voor een gegeven les geldt. Wie die vraag ergens anders nog eens optelt, laat op de plek die
// hij vergat mee te wijzigen een instructie wegvallen — en een instructie die de app niet toont,
// is niet gegeven.
//
// Puur rekenwerk: geen store, geen scherm, geen schrijfweg. Wie een doorsturing aanmaakt of
// weghaalt, doet dat een laag hoger met `voegLesplanningToe` en `verwijderLesplanning`.
//
// Er wordt hier nooit iets aan een boeking geschreven. "Welk materiaal hoort bij deze les" is een
// afgeleid feit, net als `zoektVervanger` in lib/ziekmelding en `staatOpen` in lib/openstaand: een
// verwijzing per boeking zou honderden rijen per doorsturing kosten, opruimwerk bij elke
// periodewijziging, en geen materiaal op een les die later in die periode nog bijgeboekt wordt.

import { t } from './i18n';
import { dagSleutel, parseDag } from './vakanties';
import type { Booking, Lesplanning, Lesson } from './types';

/** De velden die deze vragen van een les nodig hebben; meer weet dit bestand er niet van. */
export type PlanningBoeking = Pick<Booking, 'coach_id' | 'start_time'> & { group_id?: string };

/**
 * Waarom deze doorsturing niet klopt, of `null` als ze deugt. Wordt gelezen terwijl iemand nog
 * aan het typen is, dus een half ingevulde datum is geen fout maar "nog niet af" — dezelfde
 * afspraak als `ziekmeldingFout` en `vakantieFout`.
 *
 * De volgorde van de controles ligt vast: eerst wát er doorgestuurd wordt, dan aan wie, dan of
 * de datums leesbaar zijn, en pas daarna of ze goed om staan. Wie tijdens het typen te horen
 * krijgt dat zijn periode verkeerd om staat, leest een verwijt over een veld dat hij nog invult.
 *
 * Een omgekeerde periode wordt geweigerd en niet stil omgedraaid. Dat is dezelfde beslissing als
 * op 6 september 2026 bij de ziekmeldingen: de eigenaar vulde september tot augustus in, dat werd
 * gelezen als augustus tot september, en hij kreeg een leeg resultaat zonder één woord uitleg.
 *
 * De dagen komen binnen als `jjjj-mm-dd`. Het scherm zet zijn dd/mm/jjjj-invoer daarvoor om met
 * `parseDayInput` en `dagSleutel`, precies zoals het ziekmeldingscherm dat doet; een half getypte
 * datum wordt daar een lege sleutel, en die maakt hier de ene melding die overal hetzelfde luidt.
 */
export function lesplanningFout(
  lessonId: string,
  coachId: string,
  groupId: string,
  van: string,
  tot: string,
): string | null {
  if (lessonId.trim().length === 0) return t('Kies welk lesmateriaal je doorstuurt.');
  if (coachId.trim().length === 0 && groupId.trim().length === 0) {
    return t('Kies een trainer, een groep, of beide.');
  }
  if (parseDag(van) === null || parseDag(tot) === null) {
    return t('Vul beide dagen in als dd/mm/jjjj.');
  }
  // Eén dag mag: dan is `tot` gelijk aan `van` en eindigt er niets te vroeg.
  if (tot < van) return t('De periode eindigt voor ze begint.');
  return null;
}

/**
 * Geldt deze doorsturing voor deze les? De dag valt binnen de periode, én de trainer klopt als
 * er een trainer staat, én de groep klopt als er een groep staat.
 *
 * DE TRAINER WORDT VERGELEKEN MET `coach_id` EN MET OPZET NIET MET `lesgeverId`. Neemt een
 * collega een les over van een zieke trainer, dan blijft het de les van die trainer en van die
 * groep, dus hoort er hetzelfde materiaal bij. De vervanger ziet het gewoon: het materiaal hangt
 * aan de les die hij geeft, niet aan zijn naam. Zou hier `lesgeverId` staan, dan verdwijnt de
 * instructie op het moment dat er iemand inspringt — precies wanneer een trainer haar het
 * hardst nodig heeft.
 *
 * De dag komt uit `dagSleutel` en nooit uit de ISO-tekst: die is in UTC gerenderd, dus een
 * avondles zou een dag opschuiven en op de verkeerde dag binnen of buiten de periode vallen.
 * Een onleesbare begintijd geldt als "niet in de periode": bij twijfel geen instructie in plaats
 * van een scherm dat struikelt op een datum die niet bestaat.
 */
export function geldtVoor(planning: Lesplanning, les: PlanningBoeking): boolean {
  const begin = new Date(les.start_time);
  if (Number.isNaN(begin.getTime())) return false;
  const dag = dagSleutel(begin);
  if (dag < planning.van || dag > planning.tot) return false;
  if (planning.coach_id && planning.coach_id !== les.coach_id) return false;
  if (planning.group_id && planning.group_id !== les.group_id) return false;
  return true;
}

/**
 * Welk lesmateriaal geldt er voor deze les — van bijzonder naar algemeen: eerst wat voor deze
 * groep bij deze trainer doorgestuurd is, dan wat voor de groep geldt, dan wat voor de trainer
 * geldt.
 *
 * ER WORDT NIETS WEGGELATEN ALS ER TWEE DINGEN GELDEN. De beheerder heeft ze beide ingevuld, en
 * een instructie die de app stil verbergt is een instructie die niet gegeven is. Dezelfde
 * afspraak als `vervangersVoor` in lib/vervanger, dat ook nooit iemand stil wegfiltert: het
 * scherm mag rangschikken, niet verbergen.
 *
 * Een planning waarvan het materiaal niet meer in de lijst staat valt weg. In de databank kan
 * dat niet blijven staan (`on delete cascade`), maar de opslag in de app kan tussen twee
 * ophaalronden even uit de pas lopen, en dan is een lege regel op het scherm erger dan geen
 * regel.
 */
export function materiaalVoor(
  les: PlanningBoeking,
  planningen: Lesplanning[],
  lessons: Lesson[],
): Lesson[] {
  const rang = (p: Lesplanning): number => {
    if (p.coach_id && p.group_id) return 0;
    if (p.group_id) return 1;
    return 2;
  };
  return planningen
    .filter((p) => geldtVoor(p, les))
    // `filter` gaf al een nieuwe lijst, dus deze sortering raakt de invoer niet aan.
    .sort((a, b) => rang(a) - rang(b))
    .map((p) => lessons.find((l) => l.id === p.lesson_id))
    .filter((l): l is Lesson => l !== undefined);
}
