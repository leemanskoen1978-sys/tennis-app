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
import type { Role, User } from './types';

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

/**
 * Mag deze kijker zien wat die trainer verdient — zijn uurtarief én wat het deze maand
 * opleverde?
 *
 * Alleen jijzelf, of wie de club beheert. Een trainer is geen collega-boekhouder: wat een
 * ander verdient hoort niet bij het werk dat hij doet, en het stond nota bene in het
 * dossier van elke trainer, open voor iedereen die het opende.
 *
 * De databank bewaakt dit zelf (`rates_select` in supabase-schema.sql, op de tabel
 * `coach_rates`). Deze functie zorgt alleen dat het scherm niets aanbiedt wat daarna toch
 * leeg blijft.
 */
export function magLoonZien(
  kijker: User | null | undefined,
  trainer: User | null | undefined,
): boolean {
  if (!kijker || !trainer) return false;
  return isAdmin(kijker) || kijker.id === trainer.id;
}

/**
 * Mag deze gebruiker de cijfers van de hele club zien — de omzet, het loon van elke
 * trainer, de lijst per speler?
 *
 * Alleen een beheerder. Een gewone trainer krijgt in het rapport zijn eigen lessen te zien;
 * dat is wat "hoe draait het" voor hem betekent. Dit stond eerder als `role === 'coach'` in
 * het rapport, en dat is precies de verwarring die `isCoach` hierboven beschrijft.
 */
export function magClubcijfersZien(user: User | null | undefined): boolean {
  return isAdmin(user);
}

/**
 * Hoe een rol heet op het scherm.
 *
 * Vier bestanden hielden hier hun eigen tabelletje voor bij, en één daarvan (het
 * aanmeldscherm) noemde een trainer "Coach" terwijl de rest van de app hem "Trainer"
 * noemt. Dat is geen kleinigheid: het aanmeldscherm is het eerste wat iemand ziet.
 */
export const ROLE_LABELS: Record<Role, string> = {
  player: 'Speler',
  coach: 'Trainer',
  parent: 'Ouder',
};

/** Diezelfde naam, vertaald. */
export function roleLabel(role: Role): string {
  return t(ROLE_LABELS[role]);
}

/** Hoe iemand op zijn dossier heet. Het vinkje verbergt zijn rol niet, het komt erbij. */
export function rolLabel(user: User | null | undefined): string {
  if (!user) return t('Onbekend');
  const rol = roleLabel(user.role);
  return isAdmin(user) ? `${rol} · ${t('beheerder')}` : rol;
}
