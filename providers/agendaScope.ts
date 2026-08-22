// Waar een agendascherm naar kijkt: de lessen die deze gebruiker mag zien, al gefilterd op
// de trainer die hij koos.
//
// Agenda, Komend, Overzicht, Historiek en Rapport bouwden dit ieder apart op — dezelfde drie
// regels, vijf keer. Erger dan het dubbele werk was dat de beginstand van de filter er vijf
// keer los stond: verandert die regel ooit, dan verandert hij op vier schermen mee en op het
// vijfde niet.
//
// Het rekenwerk zelf staat niet hier maar in lib/payments (`bookingsInScope`,
// `defaultCoachFilter`); deze hook doet alleen het onthouden van de keuze.

import { useMemo, useState } from 'react';
import { bookingsInScope, defaultCoachFilter } from '../lib/payments';
import { coachesOf } from '../lib/hub';
import { useSimpleData } from './SimpleDataProvider';
import type { Booking, User } from '../lib/types';

export interface AgendaScope {
  /** De trainer waar de lijst nu op staat. `null` is "alle trainers". */
  coachId: string | null;
  setCoachId: (id: string | null) => void;
  /** De trainers voor de filterbalk. */
  coaches: User[];
  /** De lessen die overblijven: eerst wie mag kijken, dan de gekozen trainer. */
  bookings: Booking[];
}

export function useAgendaScope(): AgendaScope {
  const { currentUser, bookings, users } = useSimpleData();
  const [coachId, setCoachId] = useState<string | null>(
    () => defaultCoachFilter(currentUser),
  );

  const coaches = useMemo(() => coachesOf(users), [users]);
  const shown = useMemo(
    () => bookingsInScope(currentUser ?? null, bookings, coachId),
    [currentUser, bookings, coachId],
  );

  return { coachId, setCoachId, coaches, bookings: shown };
}
