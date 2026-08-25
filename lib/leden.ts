// De regels achter het ledenbeheer: wie mag wat worden, en wat sleept een verwijdering mee.
//
// Ze staan hier en niet in het scherm omdat het geen opmaak is maar beleid. Twee ervan zijn
// bovendien het soort regel dat je maar één keer fout hoeft te hebben: de laatste beheerder
// die zichzelf ontvinkt sluit de club buiten haar eigen deur, en een lid verwijderen neemt
// stilletjes zijn hele geschiedenis mee. Wat er precies meegaat hoort zichtbaar te zijn
// vóór je op de knop drukt, niet erna.

import { t } from './i18n';
import { isAdmin, isCoach } from './rechten';
import type {
  Beurtenkaart, Booking, Lesson, Memo, OuderKind, PlayerGoal, Role, StudentProgress, User,
} from './types';

/** De lijst zoals hij op het scherm staat: trainers eerst, daarbinnen op naam. */
export function ledenLijst(users: User[], zoek: string = ''): User[] {
  const term = zoek.trim().toLowerCase();
  const gevonden = term.length === 0
    ? users
    : users.filter((u) =>
      u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));

  return [...gevonden].sort((a, b) => {
    // Trainers bovenaan: dat zijn er een handvol tussen honderden spelers, en het is de
    // groep waar een beheerder het vaakst iets aan verzet.
    if (isCoach(a) !== isCoach(b)) return isCoach(a) ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/** Iedereen met het beheerdersvinkje. */
export function beheerders(users: User[]): User[] {
  return users.filter((u) => isAdmin(u));
}

/**
 * Mag het beheerdersvinkje bij deze gebruiker weg?
 *
 * Niet als hij de laatste is. Er is dan geen weg terug binnen de app: het vinkje zetten mag
 * alleen een beheerder (trigger `bewaak_is_admin`), dus de club zou een SQL-query nodig
 * hebben om weer bij haar eigen beheer te komen.
 */
export function magVinkjeWeg(users: User[], id: string): boolean {
  const nu = beheerders(users);
  return !(nu.length <= 1 && nu.some((u) => u.id === id));
}

/**
 * Waarom de rol van deze gebruiker niet mag wisselen, of `null` als het gewoon kan.
 *
 * Van een trainer een speler maken terwijl er nog lessen op zijn naam staan, laat die lessen
 * achter bij iemand die geen trainer meer is: ze staan dan in niemands agenda en zijn ook
 * niet meer te beheren. Eerst de lessen verzetten of schrappen, dan de rol.
 *
 * Andersom (speler wordt trainer) is er niets aan de hand: zijn eigen lessen blijven
 * gewoon van hem, hij krijgt er alleen een agenda bij.
 */
export function rolWisselBezwaar(
  user: User,
  nieuw: Role,
  bookings: Booking[],
): string | null {
  if (user.role === nieuw) return null;
  if (nieuw === 'coach') return null;

  const zijne = bookings.filter((b) => b.coach_id === user.id).length;
  if (zijne === 0) return null;
  return t('{naam} geeft nog {n} lessen. Verzet of schrap die eerst; daarna kan hij speler '
    + 'worden.', { naam: user.name, n: zijne });
}

/** Wat er samen met een lid verdwijnt. Alles bij nul betekent: alleen de naam gaat weg. */
export interface Gevolgen {
  /** Lessen waarin hij speelt of die hij geeft. */
  lessen: number;
  /** Verslagen in zijn dossier. */
  verslagen: number;
  /** Beurtenkaarten op zijn naam. */
  kaarten: number;
  /** Doelen in zijn dossier. */
  doelen: number;
  /** Lesmateriaal dat aan hem is toegewezen. */
  lesmateriaal: number;
  /** Koppelingen met een ouder of een kind. */
  koppelingen: number;
  /** Spraakmemo's over hem of van hem. */
  memos: number;
}

export interface LedenStore {
  bookings: Booking[];
  progress: StudentProgress[];
  beurtenkaarten: Beurtenkaart[];
  goals: PlayerGoal[];
  lessons: Lesson[];
  relaties: OuderKind[];
  memos: Memo[];
}

/**
 * Wat een verwijdering meeneemt. Dezelfde opsomming die de databank zelf afdwingt met
 * `on delete cascade`; hier staat ze zodat je het vóór de knop te zien krijgt in plaats van
 * erna te merken.
 */
export function gevolgenVanVerwijderen(store: LedenStore, id: string): Gevolgen {
  return {
    lessen: store.bookings.filter(
      (b) => b.player_id === id || b.coach_id === id || (b.participant_ids ?? []).includes(id),
    ).length,
    verslagen: store.progress.filter((p) => p.student_id === id || p.coach_id === id).length,
    kaarten: store.beurtenkaarten.filter((k) => k.player_id === id).length,
    doelen: store.goals.filter((g) => g.student_id === id).length,
    lesmateriaal: store.lessons.filter((l) => l.student_id === id).length,
    koppelingen: store.relaties.filter((r) => r.parent_id === id || r.child_id === id).length,
    memos: store.memos.filter((m) => m.student_id === id || m.coach_id === id).length,
  };
}

/** Heeft deze verwijdering meer gevolgen dan alleen de naam? */
export function heeftGevolgen(g: Gevolgen): boolean {
  return g.lessen + g.verslagen + g.kaarten + g.doelen + g.lesmateriaal + g.koppelingen
    + g.memos > 0;
}

/**
 * De opslag zonder dit lid — precies wat de databank er ook van maakt.
 *
 * De app moet dit zelf naspelen, want de cascade gebeurt daar en niet hier: zou de app
 * alleen de gebruikersrij weghalen, dan bleven zijn lessen in beeld staan tot iemand de
 * pagina ververst, en verwezen ze naar een speler die niet meer bestaat.
 *
 * `participant_ids` is de ene die de databank níét voor ons opruimt: dat is jsonb zonder
 * verwijzing, dus een verwijderd lid zou als onbekende naam in een groepsles blijven staan.
 */
export function zonderLid<T extends LedenStore & { users: User[] }>(store: T, id: string): T {
  return {
    ...store,
    users: store.users.filter((u) => u.id !== id),
    bookings: store.bookings
      .filter((b) => b.player_id !== id && b.coach_id !== id)
      .map((b) => {
        const mee = b.participant_ids;
        if (!mee || !mee.includes(id)) return b;
        return { ...b, participant_ids: mee.filter((p) => p !== id) };
      }),
    progress: store.progress.filter((p) => p.student_id !== id && p.coach_id !== id),
    beurtenkaarten: store.beurtenkaarten.filter((k) => k.player_id !== id),
    goals: store.goals.filter((g) => g.student_id !== id),
    lessons: store.lessons.filter((l) => l.student_id !== id),
    relaties: store.relaties.filter((r) => r.parent_id !== id && r.child_id !== id),
    memos: store.memos.filter((m) => m.student_id !== id && m.coach_id !== id),
  };
}
