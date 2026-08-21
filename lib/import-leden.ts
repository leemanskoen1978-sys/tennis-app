// Een ledenlijst uit Excel omzetten naar leden van de club.
//
// Wat hier staat is alle regelgeving van de import en niets anders: geen databank, geen
// scherm, geen bestand. Het scherm geeft rijen tekst en de huidige ledenlijst, en krijgt
// een plan terug van wat er zou gebeuren. Dat is waarom de trainer het resultaat kan zien
// vóór er iets weggeschreven wordt — en waarom die belofte hier te testen valt.

import { isValidEmail, normalizePhone } from './contact';
import type { Role, User } from './types';

/** De koppen van het voorbeeldbestand, in de volgorde waarin ze daar staan. */
export const LEDEN_KOPPEN = ['naam', 'email', 'rol', 'telefoon', 'uurtarief'] as const;

/**
 * De rolnamen zoals een trainer ze schrijft. Engels staat erbij omdat een export uit deze
 * app of uit een ander systeem ze zo kan opleveren; dat is geen reden om af te keuren.
 */
const ROLNAMEN: Record<string, Role> = {
  speler: 'player',
  player: 'player',
  leerling: 'player',
  trainer: 'coach',
  coach: 'coach',
  ouder: 'parent',
  parent: 'parent',
};

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
 * Een uurtarief uit één cel. Leeg levert `undefined` op — geen tarief is iets anders dan een
 * tarief van nul, en dat verschil is elders in de app zichtbaar (een trainer zonder tarief
 * krijgt een waarschuwing, een trainer met €0 niet). Onleesbaar levert `null`.
 */
export function leesUurtarief(waarde: string): number | undefined | null {
  const schoon = waarde.replace(/[€\s]/g, '').replace(',', '.');
  if (!schoon) return undefined;
  const getal = Number(schoon);
  return Number.isFinite(getal) ? getal : null;
}

/** Waar staat welke kolom? De index per veld; ontbrekende optionele kolommen staan er niet in. */
export interface Kolommen {
  naam: number;
  email: number;
  rol?: number;
  telefoon?: number;
  uurtarief?: number;
}

/**
 * Andere schrijfwijzen die we aannemen. De kop wordt eerst klein gemaakt en van spaties
 * ontdaan, dus hier staan alleen de echt andere woorden.
 */
const KOPNAMEN: Record<string, keyof Kolommen> = {
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
};

/**
 * De kopregel lezen. `null` betekent: hier ontbreekt een kolom die we niet kunnen missen.
 * Naam en e-mailadres zijn verplicht — zonder adres valt een lid later nooit aan zijn login
 * te koppelen, en dan is de import zinloos werk geweest.
 */
export function kolomIndexen(kopregel: readonly string[]): Kolommen | null {
  const gevonden: Partial<Record<keyof Kolommen, number>> = {};
  kopregel.forEach((kop, i) => {
    const veld = KOPNAMEN[kop.trim().toLowerCase()];
    // De eerste kolom met deze naam wint; een tweede is een vergissing en geen overschrijving.
    if (veld && gevonden[veld] === undefined) gevonden[veld] = i;
  });
  if (gevonden.naam === undefined || gevonden.email === undefined) return null;
  return { ...gevonden, naam: gevonden.naam, email: gevonden.email };
}
