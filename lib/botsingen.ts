// Een overlap in woorden. De ene plek die van een botsende boeking een zin maakt die een
// mens kan beoordelen.
//
// WAAROM DIT BESTAAT. Sinds 6 september 2026 blokkeert een overlap nooit meer en waarschuwt
// ze altijd (zie de kop van `botstMet` in lib/recurrence). "Altijd waarschuwen" is alleen
// iets waard als de waarschuwing zegt wáármee het botst: op Terrein 7 staan blauw en rood
// samen op een halve baan, met dezelfde trainer ernaast, en dat is gewoon goed. Twee
// volwassenengroepen op één terrein is dat niet. Die twee zien er in de code identiek uit —
// `botstMet` geeft in beide gevallen een boeking terug — en alleen een mens die de trainer,
// het terrein en het uur van die andere les leest, kan ze uit elkaar houden. Vandaar dat
// `botstMet` met opzet de boeking teruggeeft en geen `true`, en vandaar deze module.
//
// Vier schermen tonen dezelfde waarschuwing: het boekingsvenster, de droogloop van de
// lessenimport, de voorvertoning van een groepsverzetting en de reeks. Eén formulering voor
// alle vier, want dezelfde botsing hoort in Reserveren niet anders te heten dan in de import.
//
// DEZE MODULE VERGELIJKT GEEN TIJDVAKKEN, EN MAG DAT NOOIT GAAN DOEN. Ze beantwoordt de vraag
// "botst het?" niet — ze verwoordt alleen het antwoord dat `botstMet` al gaf. `botstMet` in
// lib/recurrence blijft de enige plek in de codebase die twee tijdvakken tegen elkaar legt; dat
// was een opruiming die van twee implementaties naar één ging (de provider had er een eigen
// kopie van), en een tweede ernaast zou die precies ongedaan maken. Wat hier wél vergeleken
// wordt zijn ids: staat de botsende les op dezelfde trainer, op dezelfde baan, of op allebei.
// Dat is een leesvraag over een gevonden botsing, geen tweede botsingsregel.
//
// Namen komen van buiten. Deze module zoekt niets op in een opslag en kent geen provider:
// de lijst trainers en de lijst banen gaan erin, een zin komt eruit. Zo blijft ze testbaar
// zonder databank, net als de rest van lib/.

import { t } from './i18n';
import { formatDayTimeRange } from './datetime';
import type { BezetBoeking } from './recurrence';

/** Waarmee de overlap zit: met de agenda van de trainer, met de baan, of met allebei. */
export type BotsingSoort = 'trainer' | 'baan' | 'beide';

/**
 * De namen die een botsing leesbaar maken. Alleen `id` en `name` — meer heeft een zin niet
 * nodig, en zo kan elk scherm zijn eigen `users` en `courts` doorgeven zonder ze om te bouwen.
 */
export interface BotsingNamen {
  trainers: ReadonlyArray<{ id: string; name: string }>;
  banen: ReadonlyArray<{ id: string; name: string }>;
}

/** Voor wie en waarop de botsing gevonden werd; dezelfde twee velden als in `BezetVraag`. */
export interface BotsingVraag {
  coachId: string;
  courtId?: string;
}

const GEEN_NAMEN: BotsingNamen = { trainers: [], banen: [] };

/**
 * Zit de overlap in de trainer, in de baan, of in allebei?
 *
 * Dit leidt af uit dezelfde twee vergelijkingen die `botstMet` zelf maakt, en niet uit een
 * extra veld op de uitkomst: één bron voor de regel, en de afleiding hier ernaast. Botst het
 * op geen van beide — wat niet kan gebeuren als de boeking echt uit `botstMet` komt — dan is
 * `'beide'` het eerlijkste antwoord: dan wordt er niets weggelaten uit de melding.
 */
export function botsingSoort(conflict: BezetBoeking, vraag: BotsingVraag): BotsingSoort {
  const trainer = conflict.coach_id === vraag.coachId;
  const baan = !!vraag.courtId && !!conflict.court_id && conflict.court_id === vraag.courtId;
  if (trainer && baan) return 'beide';
  if (baan) return 'baan';
  if (trainer) return 'trainer';
  return 'beide';
}

/** De naam van de trainer van de botsende les, of een nette omschrijving als hij weg is. */
function trainerNaam(conflict: BezetBoeking, namen: BotsingNamen): string {
  const gevonden = namen.trainers.find((u) => u.id === conflict.coach_id);
  return gevonden?.name.trim() || t('een andere trainer');
}

/** Idem voor de baan. Een les zonder baan komt hier niet als baanbotsing binnen. */
function baanNaam(conflict: BezetBoeking, namen: BotsingNamen): string {
  const gevonden = namen.banen.find((c) => c.id === conflict.court_id);
  return gevonden?.name.trim() || t('een ander terrein');
}

/**
 * De waarschuwing in één zin: wat er al staat, van wie, en wanneer.
 *
 * Het uur van de bestáánde les staat erbij en niet dat van de nieuwe. Bij het kleutertennis
 * vallen ze samen en maakt het niets uit, maar bij een les van 60 minuten die over een les van
 * 30 heen valt is juist dat verschil wat de beheerder wil zien.
 *
 * De zin zegt nergens dat er iets misgaat, want dat weet ze niet: hij meldt wat er al staat en
 * laat het oordeel aan de lezer. "Terrein 7 is al bezet" was de oude, weigerende toon; die
 * paste bij een regel die de les tegenhield en past niet meer bij een regel die hem doorlaat.
 */
export function botsingTekst(
  conflict: BezetBoeking,
  vraag: BotsingVraag,
  namen: BotsingNamen = GEEN_NAMEN,
): string {
  const wanneer = formatDayTimeRange(conflict.start_time, conflict.end_time);
  switch (botsingSoort(conflict, vraag)) {
    case 'baan':
      return t('{baan}: daar staat al een les op {wanneer}.', {
        baan: baanNaam(conflict, namen),
        wanneer,
      });
    case 'trainer':
      return t('{trainer} geeft dan al een andere les op {wanneer}.', {
        trainer: trainerNaam(conflict, namen),
        wanneer,
      });
    default:
      return t('{trainer} staat dan al op {baan}, op {wanneer}.', {
        trainer: trainerNaam(conflict, namen),
        baan: baanNaam(conflict, namen),
        wanneer,
      });
  }
}

/**
 * Dezelfde waarschuwing voor een hele lijst botsingen, ontdubbeld en op volgorde.
 *
 * Ontdubbeld omdat een reeks van twaalf weken twaalf keer met dezelfde buurgroep botst en de
 * beheerder dan twaalf identieke regels zou lezen. Wat hij wil weten is: met wélke lessen
 * overlapt dit, één regel per andere les. Het aantal weken staat elders in de melding.
 */
export function botsingRegels(
  botsingen: ReadonlyArray<{ conflict: BezetBoeking }>,
  vraag: BotsingVraag,
  namen: BotsingNamen = GEEN_NAMEN,
): string[] {
  const gezien = new Set<string>();
  const regels: string[] = [];
  for (const b of botsingen) {
    if (gezien.has(b.conflict.id)) continue;
    gezien.add(b.conflict.id);
    regels.push(botsingTekst(b.conflict, vraag, namen));
  }
  return regels;
}
