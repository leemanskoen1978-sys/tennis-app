// Waar het dossier van iemand staat.
//
// Sinds de weekagenda in de dossiers woont, is "mijn dossier" een bestemming geworden en
// niet langer alleen een scherm dat een trainer opent voor iemand anders. Wie waar terecht
// komt is een regel — een trainer heeft een trainersdossier, iedereen anders een
// spelersdossier — en geen opmaak, dus hij staat hier en niet in een scherm.
//
// Niet in lib/rechten.ts: dat bestand beantwoordt "mag het", en dit is "waarheen".

import { isCoach } from './rechten';
import type { User } from './types';

/**
 * Het pad naar het dossier waar deze gebruiker zijn eigen lessen terugvindt.
 *
 * `speler` is de actieve speler (`useActieveSpeler`): voor iedereen zichzelf, en voor een
 * ouder het kind dat hij koos. Wijkt die af van de ingelogde gebruiker, dan is dát het
 * dossier dat hij zoekt — ook als hij zelf trainer is, want op dat moment is hij vader.
 *
 * `null` als er niemand is ingelogd; het scherm hoort dan geen knop te tonen.
 */
export function dossierPad(user: User | null, speler: User | null): string | null {
  if (!user) return null;
  if (speler && speler.id !== user.id) return `/players/${speler.id}`;
  return isCoach(user) ? `/coaches/${user.id}` : `/players/${user.id}`;
}
