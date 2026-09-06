// Wie kan dit lesuur overnemen van een zieke trainer — en als iemand het niet kan, waarom
// niet.
//
// Dit bestand rekent niets nieuws uit. Het stelt vijf vragen die elders al beantwoord zijn,
// in een vaste volgorde, en geeft de eerste die nee zegt terug als reden:
//
//  1. Is hij zelf ziek gemeld? — `ziekOp` in lib/ziekmelding.
//  2. Geldt er die dag een afwijkende periode waar dit uur buiten valt? — `periodeOp` en
//     `slotsOp` in lib/boekingstijd.
//  3. Valt het uur buiten zijn gewone boekingstijd of werkt hij die dag niet? — `slotsOp` in
//     lib/boekingstijd en `worksOnDay` in lib/slots.
//  4. Is de club die dag dicht? — `vakantieOpMoment` in lib/vakanties.
//  5. Geeft hij op dat moment zelf al les? — `botstMet` in lib/recurrence.
//
// De vakanties van de club staan in lib/boekingstijd bewust NIET in de boekingstijden: die
// sluiten iedereen, gelden dus niet per trainer, en horen op de schermen apart getoond te
// worden. Hier staan ze er wél in, en dat is precies de aanvulling die dit bestand maakt: een
// collega die in een clubvakantie zit kan die dag niet invallen, en wie alleen de
// boekingstijden navraagt zou hem stilzwijgend voorstellen. Hetzelfde geldt voor "is hij zelf
// ziek": die vraag is in deze fase nieuw en er is nergens anders een aanroeper van.
//
// En dan de kern van de zaak: dit bestand filtert nooit iemand stil weg. Er komt geen boolean
// uit en geen gefilterde lijst, maar per collega één uitkomst met `'kan'` of met de reden die
// nee zei. De beheerder mag bewust afwijken — hij belt een collega die eigenlijk vrij was
// toch — maar dat kan hij alleen als hij ziet waarom de app iemand niet voorstelt. Een lijst
// waar iemand zonder uitleg uit verdwijnt, is een lijst waarin hij gaat twijfelen of de app
// het wel goed ziet, en dan belt hij toch maar zelf de hele club rond. Dan heeft deze module
// niets opgelost.
//
// Puur rekenwerk: geen store, geen scherm, geen schrijfweg. Wie de kandidatenlijst samenstelt
// en wie er uiteindelijk aan de les gehangen wordt, gebeurt een laag hoger.

import { periodeOp, slotsOp } from './boekingstijd';
import type { BoekingsTrainer } from './boekingstijd';
import { botstMet } from './recurrence';
import { worksOnDay } from './slots';
import { dagSleutel, vakantieOpMoment } from './vakanties';
import { ziekOp } from './ziekmelding';
import type { OpenZiekmelding } from './ziekmelding';
import type { Booking, User, Vakantie } from './types';

/** Het lesuur waarvoor een vervanger gezocht wordt; meer weet dit bestand er niet van. */
export interface VervangerSlot {
  start_time: string; // ISO
  end_time: string;   // ISO
}

/**
 * Waarom deze collega dit uur niet kan — of `'kan'`. De vijf redenen staan uit elkaar omdat
 * ze een verschillend antwoord van de beheerder vragen: bij `'eigen_les'` verzet je iets, bij
 * `'clubvakantie'` gaat de les sowieso niet door, en bij `'zelf_ziek'` heeft bellen geen zin.
 */
export type VervangerReden =
  | 'kan'
  | 'eigen_les'
  | 'buiten_uren'
  | 'afwijkende_periode'
  | 'clubvakantie'
  | 'zelf_ziek';

/** De velden die deze vragen van een kandidaat nodig hebben. */
export type VervangerKandidaat = BoekingsTrainer & Pick<User, 'id' | 'name' | 'working_days'>;

/** Eén collega en het antwoord over hem. Nooit alleen een reden: het scherm toont de naam. */
export interface VervangerUitkomst {
  coach: Pick<User, 'id' | 'name'>;
  reden: VervangerReden;
}

/**
 * Kan deze collega dit lesuur overnemen, en zo niet: om welke van de vijf redenen?
 *
 * De volgorde van de vragen ligt vast en de eerste die nee zegt wint. Dat is geen
 * rangschikking op ernst maar een afspraak: zo levert dezelfde invoer altijd dezelfde reden
 * op, en kan de beheerder de app navertellen. Wie het slimmer doet (de "belangrijkste" reden
 * kiezen) bouwt een regel die niemand kan uitleggen als het misgaat.
 *
 * Wie er kandidaat is, bepaalt de aanroeper. Dit bestand weet niet dat de zieke trainer
 * zichzelf niet vervangt — dat is een keuze van het scherm, niet van deze regel.
 */
export function kanVervangen(
  kandidaat: VervangerKandidaat,
  slot: VervangerSlot,
  bestaandeLessen: Booking[],
  vakanties: Vakantie[],
  open: OpenZiekmelding[],
  clubEinde: string,
): VervangerUitkomst {
  const coach = { id: kandidaat.id, name: kandidaat.name };
  const antwoord = (reden: VervangerReden): VervangerUitkomst => ({ coach, reden });

  // De lokale dag en het lokale uur uit de velden van de `Date` zelf. Nooit de ISO-tekst
  // afknippen: die is in UTC gerenderd, dus een avondles zou een dag opschuiven en deze
  // collega op de verkeerde dag ziek of juist beschikbaar maken.
  const begin = new Date(slot.start_time);
  const dag = dagSleutel(begin);
  const twee = (n: number): string => String(n).padStart(2, '0');
  const lesuur = `${twee(begin.getHours())}:${twee(begin.getMinutes())}`;
  // De uren waarop er bij hem geboekt kan worden: zijn periode als er een geldt, anders zijn
  // eigen tijd, anders die van de club. Alle drie de lagen in één antwoord, uit lib/boekingstijd.
  const zijnUren = slotsOp(kandidaat, begin, clubEinde);
  const binnenZijnUren = zijnUren.includes(lesuur);

  // D-08, reden 1: zelf ziek gemeld. Eerst, want dan hoeft de beheerder niet eens te bellen.
  if (ziekOp(kandidaat.id, dag, open)) return antwoord('zelf_ziek');

  // D-08, reden 2: een afwijkende periode. Het onderscheid met de volgende stap zit hierin:
  // is er een periode, dan is de periode de reden ("die weken geeft hij geen les"); is er
  // geen, dan zijn het zijn gewone uren. Dezelfde uitkomst, maar de beheerder weet waar hij
  // moet kijken als hij het wil veranderen.
  if (periodeOp(kandidaat, begin) !== null && !binnenZijnUren) {
    return antwoord('afwijkende_periode');
  }

  // D-08, reden 3: buiten zijn boekingstijden. Ook de dag telt mee — een lege of ontbrekende
  // lijst werkdagen betekent "elke dag", zie `worksOnDay`.
  if (!worksOnDay(kandidaat, begin) || !binnenZijnUren) return antwoord('buiten_uren');

  // D-08, reden 4: de club is die dag dicht. Dit is de vraag die lib/boekingstijd met opzet
  // niet stelt en die hier dus zelf gesteld moet worden.
  if (vakantieOpMoment(vakanties, slot.start_time) !== null) return antwoord('clubvakantie');

  // D-08, reden 5: hij geeft op dat moment zelf al les. Via `botstMet` uit lib/recurrence, de
  // enige plek in de codebase die twee tijdvakken vergelijkt. Hier zelf twee tijdvakken
  // vergelijken is de fout die het onderzoek van deze fase als grootste losse risico noemt: de
  // kopie loopt uiteen met de provider, en het scherm stelt dan een vervanger voor die de
  // provider daarna weigert. Geen baan meegegeven: die staat pas vast als de les er is.
  if (botstMet(slot, bestaandeLessen, { coachId: kandidaat.id }) !== null) {
    return antwoord('eigen_les');
  }

  return antwoord('kan');
}

/**
 * Het vervangersvoorstel: elke kandidaat met zijn antwoord, in de volgorde waarin hij
 * binnenkwam.
 *
 * Deze functie is met opzet saai. De verleiding is om er `.filter((u) => u.reden === 'kan')`
 * in te zetten, of "wie kan" bovenaan te sorteren, en precies dat verbiedt D-09: er gaan er
 * even veel uit als er in gingen. Een beheerder die niet ziet waarom een collega ontbreekt,
 * weet niet of de app hem terecht wegliet of iets mist — en dan belt hij toch maar zelf de
 * hele club rond, en heeft deze module niets opgelost. Dat hij bewust mag afwijken, kan
 * alleen als de reden op zijn scherm staat.
 *
 * Het scherm mag de lijst in twee groepen tonen, "kan" boven en "kan niet" eronder. Dat is
 * presentatie. De lijst zelf is compleet.
 *
 * Ook geen rangschikking op geschiktheid, voorkeur of ervaring (D-10): voor één club met een
 * handvol trainers is "kan hij of niet" genoeg, en de beheerder kent zijn mensen beter dan
 * welke score ook.
 */
export function vervangersVoor(
  kandidaten: VervangerKandidaat[],
  slot: VervangerSlot,
  bestaandeLessen: Booking[],
  vakanties: Vakantie[],
  open: OpenZiekmelding[],
  clubEinde: string,
): VervangerUitkomst[] {
  return kandidaten.map((k) =>
    kanVervangen(k, slot, bestaandeLessen, vakanties, open, clubEinde));
}
