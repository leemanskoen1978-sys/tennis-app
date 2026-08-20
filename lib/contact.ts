// Contactgegevens licht nakijken. Staat hier, naast de naamcontrole in `students.ts`, omdat
// "ziet dit eruit als een e-mailadres?" een regel is die je wil kunnen nalezen en testen.
// Bewust simpel gehouden: dit is een clubadministratie, geen postkantoor. We willen alleen
// de tikfouten tegenhouden (apenstaartje vergeten, veld leeg gelaten, een spatie erin),
// niet elke exotische maar geldige vorm afkeuren.

/**
 * Ziet deze tekst eruit als een e-mailadres?
 *
 * De eis: iets, één apenstaartje, iets met een punt erin, en nergens een spatie.
 * Spaties eromheen mag de gebruiker laten staan — die halen we er zelf af.
 */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * Een telefoonnummer zoals we het bewaren: spaties eromheen eraf. Niets ingevuld levert
 * `undefined` op, want het veld op `User` is optioneel en een lege string is geen nummer.
 */
export function normalizePhone(phone: string): string | undefined {
  const trimmed = phone.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
