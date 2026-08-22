// Wie mag wat.
//
// Er zijn drie rollen (speler, trainer, ouder) en daarnaast één vinkje: `is_admin`. Dat
// vinkje is met opzet géén vierde rol. Wie de club beheert, is meestal ook gewoon trainer
// met zijn eigen agenda, zijn eigen spelers en zijn eigen lesdag. Was "admin" een rol, dan
// zou hij dat allemaal kwijtraken, want overal in de app staat "is deze gebruiker trainer".
// Een vinkje voegt rechten toe zonder iets af te nemen.
//
// De app is niet de bewaker. Elke regel hier heeft zijn tegenhanger in de policies van
// supabase-schema.sql — die houden het tegen, dit bestand zorgt alleen dat het scherm niet
// iets aanbiedt wat de databank daarna weigert.

import { t } from './i18n';
import type { User } from './types';

/** Beheert deze gebruiker de club? */
export function isAdmin(user: User | null | undefined): boolean {
  return user?.is_admin === true;
}

/**
 * Geeft deze gebruiker les?
 *
 * Deze vraag stond op vijfendertig plekken los uitgeschreven als `role === 'coach'`, en
 * daar komt precies één verwarring uit voort: op de meeste van die plekken werd "trainer"
 * gebruikt waar "mag de cijfers van de club zien" bedoeld werd. Dat zijn twee vragen — zie
 * `isAdmin` hierboven — en zolang ze allebei `role === 'coach'` heten, valt niet te zien
 * welke van de twee er ergens staat.
 *
 * Het antwoord vertelt ook wát er dan vaststaat: een trainer bestáát en heeft `role`
 * 'coach'. Zo hoeft wie deze vraag stelt daarna niet nóg eens te controleren of er wel
 * iemand ingelogd is.
 */
export function isCoach(user: User | null | undefined): user is User & { role: 'coach' } {
  return user?.role === 'coach';
}

/**
 * Mag deze gebruiker in de agenda van een andere trainer werken — boeken, wijzigen,
 * schrappen? Alleen een beheerder. Een gewone trainer blijft bij zijn eigen agenda, want
 * anders kan een collega jouw lessen schrappen zonder dat je het merkt.
 */
export function magInElkeAgenda(user: User | null | undefined): boolean {
  return isAdmin(user);
}

/** Hoe iemand op zijn dossier heet. Het vinkje verbergt zijn rol niet, het komt erbij. */
export function rolLabel(user: User | null | undefined): string {
  if (!user) return t('Onbekend');
  const rol = user.role === 'coach' ? t('Trainer') : user.role === 'parent' ? t('Ouder') : t('Speler');
  return isAdmin(user) ? `${rol} · ${t('beheerder')}` : rol;
}
