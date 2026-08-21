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
 * `Object.create(null)` in plaats van `{}`: anders levert `ROLNAMEN['constructor']` de
 * functie `Object` op in plaats van `undefined`, en glipt zo'n kolomwaarde ongemerkt door
 * de `?? null` heen. Geen trainer noemt een rol zo, maar het is een gratis lek dat we niet
 * hoeven te hebben.
 */
const ROLNAMEN: Record<string, Role> = Object.assign(Object.create(null), {
  speler: 'player',
  player: 'player',
  leerling: 'player',
  trainer: 'coach',
  coach: 'coach',
  ouder: 'parent',
  parent: 'parent',
});

/**
 * De rol uit één cel. Leeg is een speler — dat is verreweg het vaakst waar, en een club die
 * alleen leerlingen invoert hoeft dan geen kolom `rol` te hebben. Onbekend is `null` en
 * geen speler: stil van "hoofdtrainer" een speler maken is precies het soort fout dat pas
 * opvalt als die persoon zijn agenda niet ziet.
 */
export function leesRol(waarde: string): Role | null {
  const schoon = waarde.trim().toLowerCase();
  if (!schoon) return 'player';
  return ROLNAMEN[schoon] ?? null;
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
function metKolomvelden<T extends readonly (keyof Kolommen)[]>(koppen: T): T {
  return koppen;
}

/** De koppen van het voorbeeldbestand, in de volgorde waarin ze daar staan. */
export const LEDEN_KOPPEN = metKolomvelden(['naam', 'email', 'rol', 'telefoon', 'uurtarief'] as const);

/**
 * Andere schrijfwijzen die we aannemen. De kop wordt eerst klein gemaakt en van spaties
 * ontdaan — ook de spaties er middenin, dus "Uur tarief" en "Telefoon nummer" komen hier
 * ook op uit — dus hier staan alleen de echt andere woorden. Het koppelteken in 'e-mail'
 * blijft staan: dat is geen spatie.
 *
 * `Object.create(null)` om dezelfde reden als bij `ROLNAMEN`: geen ingebouwde
 * Object-eigenschap mag hier ooit een kolom lijken te zijn.
 */
const KOPNAMEN: Record<string, keyof Kolommen> = Object.assign(Object.create(null), {
  naam: 'naam',
  name: 'naam',
  email: 'email',
  'e-mail': 'email',
  mail: 'email',
  rol: 'rol',
  role: 'rol',
  telefoon: 'telefoon',
  telefoonnummer: 'telefoon',
  gsm: 'telefoon',
  phone: 'telefoon',
  uurtarief: 'uurtarief',
  tarief: 'uurtarief',
});

/**
 * Het resultaat van het lezen van de kopregel: niet alleen waar de kolommen staan, maar ook
 * welke koppen er stonden en niets betekenden. Dat laatste is niet bijzaak: een kop die stil
 * wordt genegeerd (een trainer die "Tarief/uur" typt in plaats van "uurtarief") levert een
 * geïmporteerde lijst op die er goed uitziet en het toch mist — en dat valt pas op als iemand
 * weken later zijn tarief niet blijkt te hebben. Het scherm toont `nietHerkend` daarom aan
 * de trainer, vóór er iets wordt weggeschreven.
 */
export interface Kopregel {
  kolommen: Kolommen;
  /** Koppen die er stonden en die we niet thuis konden brengen, precies zoals in het bestand. */
  nietHerkend: string[];
}

/**
 * De kopregel lezen. `null` betekent: hier ontbreekt een kolom die we niet kunnen missen.
 * Naam en e-mailadres zijn verplicht — zonder adres valt een lid later nooit aan zijn login
 * te koppelen, en dan is de import zinloos werk geweest.
 */
export function leesKopregel(kopregel: readonly string[]): Kopregel | null {
  const gevonden: Partial<Record<keyof Kolommen, number>> = {};
  const nietHerkend: string[] = [];
  kopregel.forEach((kop, i) => {
    const schoon = kop.trim().toLowerCase().replace(/\s+/g, '');
    if (!schoon) return; // een lege kop is geen kop, en dus ook geen vergissing.
    const veld = KOPNAMEN[schoon];
    if (!veld) {
      nietHerkend.push(kop);
      return;
    }
    // De eerste kolom met deze naam wint; een tweede is een vergissing en geen overschrijving.
    if (gevonden[veld] === undefined) gevonden[veld] = i;
  });
  const { naam, email } = gevonden;
  if (naam === undefined || email === undefined) return null;
  return { kolommen: { ...gevonden, naam, email }, nietHerkend };
}
