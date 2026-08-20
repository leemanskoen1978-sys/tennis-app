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
