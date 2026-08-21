// De controles van het scherm "stel je wachtwoord in", los van dat scherm.
//
// Ze staan hier omdat een verkeerd getypt wachtwoord dat je nog nooit gebruikt hebt je
// buitensluit zonder dat er een weg terug is. Dat is te belangrijk om alleen in een scherm
// te bestaan waar geen test bij kan.

/** Supabase eist zes tekens; de app zegt dat vooraf in plaats van het antwoord af te wachten. */
export const MIN_WACHTWOORD = 6;

/**
 * Deugt dit wachtwoord, en is het tweemaal gelijk getypt? Geeft de melding in het
 * Nederlands terug, of `null` als er niets aan de hand is. Het scherm haalt hem door `t()`.
 *
 * De lengte gaat vóór de gelijkheid: wie een te kort wachtwoord tweemaal fout typt, heeft
 * meer aan "te kort" dan aan "niet gelijk" — dat eerste is de fout die hij zelf kan zien.
 */
export function controleerWachtwoord(wachtwoord: string, herhaling: string): string | null {
  if (wachtwoord.length < MIN_WACHTWOORD) return 'Kies een wachtwoord van minstens zes tekens.';
  if (wachtwoord !== herhaling) return 'De twee wachtwoorden zijn niet gelijk.';
  return null;
}

/**
 * Gaat deze foutmelding erover dat het adres al een login heeft?
 *
 * Dat is de belangrijkste fout van dit scherm: iemand die vorig seizoen al een wachtwoord
 * koos en het vergeten is, komt hier terecht en hoort "log gewoon in" te lezen in plaats van
 * de Engelse tekst van Supabase. De formulering aan die kant verandert weleens, vandaar dat
 * er op meerdere woorden gelet wordt.
 */
export function gaatOverEenBestaandAccount(melding: string): boolean {
  return /already registered|already been registered|already exists/i.test(melding);
}
