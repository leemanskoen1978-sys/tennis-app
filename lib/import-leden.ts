// Een ledenlijst uit Excel omzetten naar leden van de club.
//
// Wat hier staat is alle regelgeving van de import en niets anders: geen databank, geen
// scherm, geen bestand. Het scherm geeft rijen tekst en de huidige ledenlijst, en krijgt
// een plan terug van wat er zou gebeuren. Dat is waarom de trainer het resultaat kan zien
// vóór er iets weggeschreven wordt — en waarom die belofte hier te testen valt.

import { isValidEmail, normalizePhone } from './contact';
import { parseEuro } from './money';
import type { Role, User } from './types';

/**
 * De rolnamen zoals een trainer ze schrijft. Engels staat erbij omdat een export uit deze
 * app of uit een ander systeem ze zo kan opleveren; dat is geen reden om af te keuren.
 *
 * Een `Map` in plaats van een object-literal: een gewoon object erft van `Object.prototype`,
 * dus `{}['constructor']` levert de functie `Object` op in plaats van `undefined` en glipt
 * zo ongemerkt door een `?? null` heen. `Object.create(null)` dicht dat lek ook, maar
 * `Object.create()` geeft `any` terug — de `Record<string, Role>`-annotatie erboven toetst
 * de literal dan niet meer, en een tikfout als `speler: 'PLAYR'` compileert stilletjes. Een
 * `Map<string, Role>` heeft geen prototype én blijft volledig getypt.
 */
const ROLNAMEN = new Map<string, Role>([
  ['speler', 'player'],
  ['player', 'player'],
  ['leerling', 'player'],
  ['trainer', 'coach'],
  ['coach', 'coach'],
  ['ouder', 'parent'],
  ['parent', 'parent'],
]);

/**
 * De rol uit één cel. Leeg is een speler — dat is verreweg het vaakst waar, en een club die
 * alleen leerlingen invoert hoeft dan geen kolom `rol` te hebben. Onbekend is `null` en
 * geen speler: stil van "hoofdtrainer" een speler maken is precies het soort fout dat pas
 * opvalt als die persoon zijn agenda niet ziet.
 */
export function leesRol(waarde: string): Role | null {
  const schoon = waarde.trim().toLowerCase();
  if (!schoon) return 'player';
  return ROLNAMEN.get(schoon) ?? null;
}

/**
 * Een uurtarief uit één cel. Leeg is geen tarief en levert `undefined` op — dat verschil is
 * elders in de app zichtbaar (een trainer zonder tarief krijgt een waarschuwing, een trainer
 * met €0 niet). Al de rest gaat door `parseEuro`, de ene bedragregel van de app, die ook
 * negatief en meer dan twee decimalen tegenhoudt (een negatief tarief zou betekenen dat de
 * club geld toelegt). Wat daar niet doorheen komt, is onleesbaar en levert `null` op.
 */
export function leesUurtarief(waarde: string): number | undefined | null {
  if (!waarde.replace(/[€\s]/g, '')) return undefined;
  return parseEuro(waarde) ?? null;
}

/** Waar staat welke kolom? De index per veld; ontbrekende optionele kolommen staan er niet in. */
export interface Kolommen {
  naam: number;
  email: number;
  rol?: number;
  telefoon?: number;
  uurtarief?: number;
}

// Knoopt LEDEN_KOPPEN vast aan de velden van `Kolommen`: een kop die daar niet in past, is
// een tikfout in dit bestand en geeft een compilefout in plaats van een stille breuk bij het
// draaien van de import. Een gewone functie in plaats van `satisfies`, want Jest's
// Babel-transform (nog) niet overweg kan met dat trefwoord.
//
// Dit vangt alleen een kop die er niet hoort te zijn, niet een kop die vergeten is: `T` mag
// een deelverzameling van `keyof Kolommen` zijn, dus `metKolomvelden(['naam','email'] as const)`
// compileert ook prima. Voor "staan alle vijf velden erin" is dit dus geen bewijs — dat moet
// het voorbeeldbestand van taak 4 zelf met een test aantonen.
function metKolomvelden<T extends readonly (keyof Kolommen)[]>(koppen: T): T {
  return koppen;
}

/** De koppen van het voorbeeldbestand, in de volgorde waarin ze daar staan. */
export const LEDEN_KOPPEN = metKolomvelden(['naam', 'email', 'rol', 'telefoon', 'uurtarief'] as const);

/**
 * Andere schrijfwijzen die we aannemen. De kop wordt eerst klein gemaakt en van spaties
 * ontdaan — ook de spaties er middenin, dus "Uur tarief" en "Telefoon nummer" komen hier
 * ook op uit — dus hier staan alleen de echt andere woorden. Het koppelteken in 'e-mail'
 * blijft staan: dat is geen spatie. 'e-mailadres' en varianten staan erbij omdat dat in een
 * Belgische ledenlijst minstens zo gangbaar is als 'mail'.
 *
 * Een `Map` in plaats van een object-literal, om dezelfde twee redenen als bij `ROLNAMEN`:
 * geen ingebouwde Object-eigenschap kan hier ooit een kolom lijken te zijn, en de
 * sleutel/waarde-typen blijven bij het compileren gecontroleerd.
 */
const KOPNAMEN = new Map<string, keyof Kolommen>([
  ['naam', 'naam'],
  ['name', 'naam'],
  ['email', 'email'],
  ['e-mail', 'email'],
  ['mail', 'email'],
  ['e-mailadres', 'email'],
  ['emailadres', 'email'],
  ['mailadres', 'email'],
  ['rol', 'rol'],
  ['role', 'rol'],
  ['telefoon', 'telefoon'],
  ['telefoonnummer', 'telefoon'],
  ['gsm', 'telefoon'],
  ['phone', 'telefoon'],
  ['uurtarief', 'uurtarief'],
  ['tarief', 'uurtarief'],
]);

/**
 * Het resultaat van het lezen van de kopregel: niet alleen waar de kolommen staan, maar ook
 * welke koppen er stonden en niets betekenden. Dat laatste is niet bijzaak: een kop die stil
 * wordt genegeerd (een trainer die "Tarief/uur" typt in plaats van "uurtarief") levert een
 * geïmporteerde lijst op die er goed uitziet en het toch mist — en dat valt pas op als iemand
 * weken later zijn tarief niet blijkt te hebben. Het scherm toont `nietHerkend` en `dubbel`
 * daarom aan de trainer, vóór er iets wordt weggeschreven.
 *
 * `kolommen` blijft ook `null` als naam of email ontbreekt — maar `nietHerkend` en `dubbel`
 * worden dan wél gevuld. Juist in dat geval is de foutmelding zonder die twee lijstjes
 * onbruikbaar: "verplichte kolom ontbreekt" zegt een trainer niets, "ik mis email, en ik zag
 * wel een kolom 'E-mailadres' die ik niet herken" wél.
 */
export interface Kopregel {
  /** `null` als naam of email ontbreekt: dan valt er niets te importeren. */
  kolommen: Kolommen | null;
  /** Koppen die er stonden en die we niet thuis konden brengen, precies zoals in het bestand. */
  nietHerkend: string[];
  /** Koppen die we herkenden, maar niet lazen omdat diezelfde kolom er al was. */
  dubbel: string[];
}

/**
 * De kopregel lezen. Naam en e-mailadres zijn verplicht — zonder adres valt een lid later
 * nooit aan zijn login te koppelen, en dan is de import zinloos werk geweest — maar zelfs
 * dan geven we terug wat we wél zagen, zodat het scherm kan zeggen wat er moet veranderen.
 */
export function leesKopregel(kopregel: readonly string[]): Kopregel {
  const gevonden: Partial<Record<keyof Kolommen, number>> = {};
  const nietHerkend: string[] = [];
  const dubbel: string[] = [];
  kopregel.forEach((kop, i) => {
    const schoon = kop.trim().toLowerCase().replace(/\s+/g, '');
    if (!schoon) return; // een lege kop is geen kop, en dus ook geen vergissing.
    const veld = KOPNAMEN.get(schoon);
    if (!veld) {
      nietHerkend.push(kop.trim());
      return;
    }
    if (gevonden[veld] === undefined) {
      gevonden[veld] = i;
    } else {
      // De eerste kolom met deze naam wint; een tweede is een vergissing, geen overschrijving.
      dubbel.push(kop.trim());
    }
  });
  const { naam, email } = gevonden;
  const kolommen = naam === undefined || email === undefined ? null : { ...gevonden, naam, email };
  return { kolommen, nietHerkend, dubbel };
}
