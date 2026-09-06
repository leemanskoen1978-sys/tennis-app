// Spelers herkennen op naam. Staat hier, en niet in de keuzelijst zelf, omdat "bestaat deze
// naam al?" een regel is die je wil kunnen nalezen en testen: hij bepaalt of een trainer een
// tweede speler met dezelfde naam kan aanmaken, en dat is precies wat we willen voorkomen.

import type { User } from './types';

/**
 * De naam zoals we hem vergelijken: spaties eraf, alles klein. Twee trainers typen dezelfde
 * speler nu eenmaal als "jonas", "Jonas " of "JONAS", en dat hoort één en dezelfde speler te zijn.
 */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Bestaat deze naam al in de lijst? Hoofdletterongevoelig en zonder spaties eromheen.
 * Een lege naam telt nooit als bestaand — daar hoort ook nooit iets mee te gebeuren.
 */
export function nameExists(students: readonly User[], name: string): boolean {
  const q = normalizeName(name);
  if (!q) return false;
  return students.some((s) => normalizeName(s.name) === q);
}

/**
 * Mag de rij "… toevoegen…" verschijnen?
 *
 * Alleen als er iets getypt is, als aanmaken überhaupt kan, en als de naam nog niet bestaat.
 * Zo blijft de trainer weg van twee spelers met exact dezelfde naam, want in elke latere
 * keuzelijst zijn die twee niet meer uit elkaar te houden.
 */
export function canCreateName(
  students: readonly User[],
  name: string,
  createSupported: boolean,
): boolean {
  if (!createSupported) return false;
  if (!normalizeName(name)) return false;
  return !nameExists(students, name);
}

/**
 * De naam in losse woorden, elk op dezelfde manier klein gemaakt als hierboven.
 *
 * Blijft binnen dit bestand: hij is geen regel op zichzelf, alleen het bouwsteentje onder de
 * twee functies hieronder. Hergebruikt `normalizeName` letterlijk, zodat er nooit twee
 * versies van "hoe maken we een naam vergelijkbaar" naast elkaar staan.
 */
function naamWoorden(name: string): string[] {
  return normalizeName(name).split(/\s+/).filter((woord) => woord.length > 0);
}

/**
 * Zijn dit twee schrijfwijzen van dezelfde naam, ook als voor- en achternaam omgedraaid staan?
 *
 * In de seizoensplanning van de club staat de achternaam vooraan: "Leemans Koen",
 * "de Clippele Antoine". Dat is geen tikfout maar hoe dat bestand nu eenmaal geschreven is,
 * terwijl dezelfde mensen hier "Koen Leemans" en "Antoine de Clippele" heten. Woord voor
 * woord vergelijken lost dat op, en meteen ook een achternaam van twee woorden — "de" is
 * gewoon een woord, geen voornaam.
 *
 * Waarom `normalizeName` zelf niet losser gemaakt wordt: de ledenimport en de keuzelijsten
 * leunen op de vergelijking mét volgorde. Die stilletjes verruimen zou daar twee spelers
 * laten samenvallen zonder dat iemand erom gevraagd heeft. Deze regel staat er dus naast, en
 * alleen de import gebruikt hem.
 *
 * Even veel woorden is een eis: "Koen" is niet "Koen Leemans", en "Koen Jan Leemans" ook
 * niet. Een gedeeltelijke treffer is hier gevaarlijker dan geen treffer — geen treffer meldt
 * de droogloop, een verkeerde treffer koppelt de les aan de verkeerde persoon.
 */
export function zelfdeNaamOngeachtVolgorde(a: string, b: string): boolean {
  const woordenA = naamWoorden(a);
  const woordenB = naamWoorden(b);
  if (woordenA.length === 0 || woordenB.length === 0) return false;
  if (woordenA.length !== woordenB.length) return false;
  const gesorteerdA = [...woordenA].sort();
  const gesorteerdB = [...woordenB].sort();
  return gesorteerdA.every((woord, i) => woord === gesorteerdB[i]);
}

/**
 * Zoek de ene persoon die deze naam draagt — of niemand.
 *
 * Bij twee treffers komt er bewust `null` uit in plaats van de eerste. Twee mensen die
 * dezelfde woorden in een andere volgorde heten zijn hier niet uit elkaar te houden, en dan
 * hoort de droogloop dat te melden zodat de beheerder beslist. Stilzwijgend de eerste kiezen
 * is precies de fout die deze functie moet voorkomen: een heel seizoen lessen op naam van de
 * verkeerde speler.
 */
export function zoekOpNaam<T extends { name: string }>(lijst: readonly T[], naam: string): T | null {
  const treffers = lijst.filter((item) => zelfdeNaamOngeachtVolgorde(item.name, naam));
  return treffers.length === 1 ? treffers[0] : null;
}
