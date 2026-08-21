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

/**
 * Een e-mailadres zoals we het vergelijken: spaties eraf, alles klein. Een adres bestaat
 * maar één keer, ongeacht hoofdletters — precies zoals de `unique`-index op deze kolom in de
 * databank het afdwingt — dus "JONAS@Club.be" en "jonas@club.be" horen hetzelfde lid aan te
 * wijzen.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Een telefoonnummer herleid tot alleen zijn cijfers, om twee schrijfwijzen van hetzelfde
 * nummer te vergelijken: "0470 12 34 56" en "0470123456" zijn hetzelfde nummer, alleen anders
 * opgeschreven. Voor het bewáren blijft `normalizePhone` de norm — dit is enkel de vorm om
 * twee nummers te vergelijken.
 */
export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}
