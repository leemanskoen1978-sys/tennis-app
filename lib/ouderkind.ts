// Welke kinderen horen bij welke ouder.
//
// Anders dan de band tussen trainer en speler (lib/relations) valt deze niet af te leiden:
// er is niets in de app waaruit blijkt dat Nova de dochter van Wim is. Dus wordt hij
// bijgehouden, en dan is de vraag wíe hem legt. Een ouder die zelf een kind mag aanvinken,
// kan het dossier van elk kind van de club openen; daarom vraagt hij het, en beslist een
// trainer. Dezelfde vorm als een lesaanvraag, en om dezelfde reden.
//
// De databank denkt er hetzelfde over: `ouder_kind_insert` in supabase-schema.sql laat een
// ouder alleen een rij met status 'pending' aanmaken, en alleen op zijn eigen naam.

import { t } from './i18n';
import type { OuderKind, User } from './types';

/** De id's van de kinderen die aan deze ouder zijn toegewezen. */
export function kinderenVan(parentId: string | null | undefined, relaties: OuderKind[]): string[] {
  if (!parentId) return [];
  return relaties
    .filter((r) => r.parent_id === parentId && r.status === 'approved')
    .map((r) => r.child_id);
}

/** Dezelfde kinderen, als gebruikers en op naam gesorteerd — zoals ze op het scherm staan. */
export function kinderenVoor(
  parentId: string | null | undefined,
  relaties: OuderKind[],
  users: User[],
  taal = 'nl',
): User[] {
  const ids = new Set(kinderenVan(parentId, relaties));
  return users
    .filter((u) => ids.has(u.id))
    .sort((a, b) => a.name.localeCompare(b.name, taal));
}

/** Is dit kind van deze ouder — en dus: mag hij zijn dossier zien? */
export function isMijnKind(
  parentId: string | null | undefined,
  childId: string,
  relaties: OuderKind[],
): boolean {
  return kinderenVan(parentId, relaties).includes(childId);
}

/**
 * De aanvraag van deze ouder over dit kind, in welke stand dan ook.
 *
 * Er is er hoogstens één: de databank staat één rij per paar toe. Dat is met opzet — vraagt
 * een ouder het twee keer, dan is het dezelfde vraag, en een tweede rij zou de trainer
 * dezelfde beslissing nog eens laten nemen.
 */
export function aanvraagVoor(
  parentId: string | null | undefined,
  childId: string,
  relaties: OuderKind[],
): OuderKind | null {
  if (!parentId) return null;
  return relaties.find((r) => r.parent_id === parentId && r.child_id === childId) ?? null;
}

/** Alles wat op een beslissing van de trainer wacht, oudste aanvraag eerst. */
export function openAanvragen(relaties: OuderKind[]): OuderKind[] {
  return relaties
    .filter((r) => r.status === 'pending')
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
}

/** De eigen aanvragen van een ouder die nog op een antwoord wachten. */
export function eigenAanvragen(
  parentId: string | null | undefined,
  relaties: OuderKind[],
): OuderKind[] {
  if (!parentId) return [];
  return openAanvragen(relaties).filter((r) => r.parent_id === parentId);
}

/**
 * De geweigerde aanvragen van deze ouder.
 *
 * Die blijven staan in plaats van te verdwijnen: een aanvraag die zonder bericht van het
 * scherm valt, laat de ouder wachten op iets wat allang beslist is. Zelfde reden als
 * `recentGeweigerd` bij een lesaanvraag.
 */
export function geweigerdeAanvragen(
  parentId: string | null | undefined,
  relaties: OuderKind[],
): OuderKind[] {
  if (!parentId) return [];
  return relaties.filter((r) => r.parent_id === parentId && r.status === 'rejected');
}

/**
 * Wie je nog als kind kunt aanvragen: de spelers van de club, zonder jezelf en zonder wie er
 * al een aanvraag over loopt.
 *
 * Jezelf staat er met opzet niet bij. Je eigen naam in die lijst is precies de vergissing
 * die je maakt als je snel typt, en "ik ben mijn eigen kind" levert een koppeling op die
 * nergens iets betekent.
 *
 * Trainers ook niet: een kind aan de club is een speler. Wil een trainer zijn eigen kind
 * volgen, dan staat dat kind in de ledenlijst als speler — dát is degene die je kiest.
 */
export function kandidaten(
  parentId: string | null | undefined,
  relaties: OuderKind[],
  users: User[],
  taal = 'nl',
): User[] {
  if (!parentId) return [];
  const bezet = new Set(
    relaties.filter((r) => r.parent_id === parentId).map((r) => r.child_id),
  );
  return users
    .filter((u) => u.role === 'player' && u.id !== parentId && !bezet.has(u.id))
    .sort((a, b) => a.name.localeCompare(b.name, taal));
}

/** Wat er bij een aanvraag staat: waar hij op wacht, of wat ermee gebeurd is. */
export function aanvraagLabel(relatie: OuderKind): string {
  if (relatie.status === 'pending') return t('Wacht op goedkeuring');
  if (relatie.status === 'rejected') return t('Niet goedgekeurd');
  return t('Goedgekeurd');
}
