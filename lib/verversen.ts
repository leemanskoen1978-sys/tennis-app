// Wanneer haalt de app uit zichzelf opnieuw op?
//
// De opslag wordt één keer geladen: bij het opstarten en bij een wisseling van login. Dat
// is genoeg zolang alles wat verandert door de app zelf gaat. Maar een scherm dat openstaat
// weet niets van wat er ondertussen elders gebeurt — een collega die een uur verzet, een
// lading lessen die met SQL binnenkomt. Zo'n tabblad blijft de stand van gisteren tonen, en
// dat is niet te zien: een verouderd scherm ziet er precies uit als een kloppend scherm.
//
// Daarom haalt de app opnieuw op zodra je terugkomt — het tabblad weer voorgrond, de app op
// de telefoon weer open. Dat moment is met opzet gekozen: het is precies wanneer je opnieuw
// naar het scherm kíjkt, en het kost niets zolang je weg bent.
//
// De regel staat hier los van de provider omdat het vier voorwaarden zijn die je moet kunnen
// nalezen en testen, zonder databank erbij.

/**
 * Hoe lang na een lading er niet opnieuw opgehaald wordt.
 *
 * Zonder pauze haalt elk tikje op een ander venster en terug een volledige lading op: op
 * web vuurt het terugkomen ook als je maar even naar een ander tabblad kijkt. Een halve
 * minuut is lang genoeg om dat weg te nemen en kort genoeg om nooit in de weg te zitten —
 * wie terugkomt na een pauze die ertoe doet, is allang verder dan dertig seconden.
 */
export const VERVERS_PAUZE_MS = 30_000;

export interface VerversToestand {
  /** Zonder login valt er niets op te halen: RLS geeft dan toch lege lijsten. */
  ingelogd: boolean;
  /** Er loopt al een lading — een tweede zou hem alleen inhalen. */
  laadt: boolean;
  /**
   * Er loopt een schrijfactie. Dan niet ophalen: de databank kan de wijziging nog niet
   * hebben, en dan zou het antwoord de stand van vóór die actie terugzetten op het scherm.
   */
  schrijft: boolean;
  /** Hoe lang geleden de laatste lading klaar was, in milliseconden. */
  sindsLaatsteLading: number;
}

/** Mag er nu stil opnieuw opgehaald worden? */
export function magStilVerversen(toestand: VerversToestand): boolean {
  if (!toestand.ingelogd) return false;
  if (toestand.laadt || toestand.schrijft) return false;
  return toestand.sindsLaatsteLading > VERVERS_PAUZE_MS;
}
