// Overzicht: de splitsing die je in je hoofd al maakt — wat is geweest, en wat komt er nog.
// Het maandoverzicht gooide die twee op één hoop in één kalendermaand; daardoor stond een les
// van volgende week tussen de afgehandelde betalingen van vorige week. Twee tegels, elk met
// zijn eigen scherm en zijn eigen filters.

import React, { useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { CalendarClock, History } from 'lucide-react-native';

import { Screen } from '../../components/ui/Screen';
import { ActionTile, TileGrid } from '../../components/ui/ActionTile';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import {
  bookingsInPeriod, currentPeriod, pastBookings, periodLabel, upcomingBookings,
} from '../../lib/period';
import { bookingsByCoach, visibleBookings } from '../../lib/payments';

export default function OverzichtScreen(): React.JSX.Element {
  const { currentUser, bookings, clearError } = useSimpleData();
  const router = useRouter();

  const now = useMemo(() => new Date(), []);
  const thisMonth = useMemo(() => currentPeriod(now), [now]);

  // Dezelfde beginstand als de twee schermen erachter: een trainer bij zijn eigen lessen,
  // een speler bij alle trainers. Anders belooft de tegel een aantal dat je daarna niet
  // terugziet.
  const scoped = useMemo(() => {
    const coachId = currentUser?.role === 'coach' ? currentUser.id : null;
    return bookingsByCoach(visibleBookings(currentUser ?? null, bookings), coachId);
  }, [currentUser, bookings]);

  const pastCount = useMemo(
    () => pastBookings(bookingsInPeriod(scoped, thisMonth), now).length,
    [scoped, thisMonth, now],
  );
  const upcomingCount = useMemo(() => upcomingBookings(scoped, now).length, [scoped, now]);

  // De fout is één globale bak: wis bij binnenkomst wat een ander scherm achterliet.
  useEffect(() => {
    clearError();
  }, []);

  return (
    <Screen>
      <TileGrid>
        <ActionTile
          title="Historiek"
          // De telling zegt erbij waar hij over gaat: de tegel opent op deze maand, dus dat
          // is ook het aantal dat je hier leest.
          subtitle={`${pastCount} geweest in ${periodLabel(thisMonth)} · ook andere periodes`}
          icon={History}
          onPress={() => router.push('/agenda/historiek')}
        />
        <ActionTile
          title="Nog te komen"
          subtitle={upcomingCount === 1 ? '1 geplande les' : `${upcomingCount} geplande lessen`}
          icon={CalendarClock}
          onPress={() => router.push('/agenda/komend')}
        />
      </TileGrid>
    </Screen>
  );
}
