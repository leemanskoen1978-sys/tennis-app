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

/**
 * Het landnummer waarmee een nummer zonder eigen landcode wordt aangevuld: België.
 *
 * WhatsApp kent geen "binnenland" — een nummer moet er internationaal in, anders opent het
 * gesprek gewoon niet. En in een clubadministratie staat een nummer nu eenmaal als
 * "0470 12 34 56" en niet als "+32 470 ...". Speelt de club ooit over de grens, dan is dit
 * de ene regel die dan mee moet.
 */
export const LANDNUMMER = '32';

/**
 * Een e-mailadres als `mailto:`-link, of `null` als het er geen is.
 *
 * Meer dan het adres zetten we er niet in: geen onderwerp, geen tekst. Wat de trainer wil
 * schrijven, weet hij zelf, en een half ingevulde mail is lastiger weg te krijgen dan een
 * lege.
 */
export function mailtoLink(email: string | undefined): string | null {
  if (!email || !isValidEmail(email)) return null;
  return `mailto:${encodeURIComponent(normalizeEmail(email))}`;
}

/**
 * Een telefoonnummer als WhatsApp-link, of `null` als er geen bruikbaar nummer in staat.
 *
 * `wa.me` en niet `whatsapp://`: die eerste doet het op een telefoon (hij opent de app) én
 * op een computer (hij opent WhatsApp Web of stuurt je naar de installatie). Met het
 * app-adres krijgt wie op zijn laptop werkt een foutmelding van de browser.
 *
 * Het nummer gaat er internationaal in, zonder plus en zonder spaties:
 *  - "+32 470 12 34 56" en "0032470123456" dragen hun landcode al;
 *  - "0470 12 34 56" is een binnenlands nummer: de nul eraf, het landnummer ervoor;
 *  - "470123456" heeft geen van beide en krijgt het landnummer erbij.
 *
 * Te kort is geen nummer maar een tikfout, en daar hoort geen knop bij.
 */
export function whatsappLink(phone: string | undefined): string | null {
  if (!phone) return null;
  const cijfers = normalizePhoneDigits(phone);
  if (cijfers.length < 6) return null;
  let internationaal: string;
  if (cijfers.startsWith('00')) internationaal = cijfers.slice(2);
  else if (cijfers.startsWith('0')) internationaal = LANDNUMMER + cijfers.slice(1);
  else if (cijfers.startsWith(LANDNUMMER)) internationaal = cijfers;
  else internationaal = LANDNUMMER + cijfers;
  if (internationaal.length < 8) return null;
  return `https://wa.me/${internationaal}`;
}
