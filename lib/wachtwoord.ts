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
 *
 * Dit is een vangnet, geen hoofdweg: normaal gooit `signUp` voor een bestaand adres geen
 * fout (zie `aanmeldUitkomst` hieronder), maar mocht Supabase dat ooit toch doen, dan hoort
 * de vertaling van die fout op precies één plek te staan. Vandaar dat `loginMessage` in
 * `providers/supabaseStore.ts` deze ene fout expres ongemoeid laat.
 */
export function gaatOverEenBestaandAccount(melding: string): boolean {
  return /already registered|already been registered|already exists/i.test(melding);
}

/** De drie standen van het loginscherm. Hier en niet in het scherm, want de regels die
 * erbij horen (wat "klaar om te versturen" betekent, welke uitkomst welke melding krijgt)
 * horen bij deze standen, niet bij de weergave ervan. */
export type Stand = 'inloggen' | 'eerste' | 'aanmelden';

/** Mag er verstuurd worden? Elke stand heeft haar eigen verplichte velden: alleen `eerste`
 * vraagt een herhaling, alleen `aanmelden` vraagt een naam. */
export function magVersturen(
  stand: Stand,
  velden: { email: string; wachtwoord: string; herhaling: string; naam: string },
): boolean {
  return velden.email.trim().length > 0 && velden.wachtwoord.length > 0
    && (stand !== 'aanmelden' || velden.naam.trim().length > 0)
    && (stand !== 'eerste' || velden.herhaling.length > 0);
}

/**
 * Wat een geslaagde `signUp` betekende — drie mogelijkheden, en het scherm mag ze niet uit
 * elkaar houden op basis van een gegooide fout, want er wordt voor het bestaande-account-
 * geval geen fout gegooid.
 *
 * Bij een bestaand, al bevestigd adres antwoordt Supabase met een gebruiker zónder
 * identiteiten — dat is expres geen fout, want een fout zou verklappen dat dit adres al lid
 * is van de club. Heeft de club "Confirm email" aan (zo hoort het voor deze club, zie de
 * README), dan komt er bij een nieuw adres nog geen sessie mee; pas na het klikken op de
 * link in de mail is er een.
 */
export type AanmeldUitkomst = 'ingelogd' | 'bevestig-je-mail' | 'bestaat-al';

export function aanmeldUitkomst(heeftSessie: boolean, aantalIdentiteiten: number): AanmeldUitkomst {
  // Een sessie wint altijd: `identities` is in het `User`-type van supabase-js optioneel, en
  // een antwoord mét sessie maar zonder dat veld zou hier anders "bestaat al" opleveren
  // terwijl deze persoon feitelijk al binnen is.
  if (heeftSessie) return 'ingelogd';
  if (aantalIdentiteiten === 0) return 'bestaat-al';
  return 'bevestig-je-mail';
}

/** Hoort bij `aanmeldUitkomst`: er bestond al een wachtwoord voor dit adres. */
export const BESTAAT_AL_MELDING = 'Er bestaat al een wachtwoord voor dit adres. Log gewoon in.';

/** Hoort bij `aanmeldUitkomst`: aangemaakt, maar er moet nog een mail bevestigd worden. */
export const BEVESTIG_MAIL_MELDING = 'Bijna klaar. Bevestig eerst de mail die we net gestuurd hebben.';

/**
 * De melding bij een uitkomst — hetzelfde ongeacht of iemand op "eerste keer hier" of op
 * "ik sta nog niet bij de club" klikte, want wie de verkeerde knop koos, verdient niet een
 * ander antwoord dan wie de juiste koos. `null` bij `'ingelogd'`: er staat dan al een sessie
 * klaar en de app springt vanzelf door, zonder dat er iets getoond hoeft te worden.
 */
export function aanmeldMelding(uitkomst: AanmeldUitkomst): string | null {
  switch (uitkomst) {
    case 'bestaat-al': return BESTAAT_AL_MELDING;
    case 'bevestig-je-mail': return BEVESTIG_MAIL_MELDING;
    case 'ingelogd': return null;
  }
}
