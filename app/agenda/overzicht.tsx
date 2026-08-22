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
import { useAgendaScope } from '../../providers/agendaScope';
import {
  bookingsInPeriod, currentPeriod, pastBookings, periodLabel, upcomingBookings,
} from '../../lib/period';
import { useT } from '../../lib/i18n';

export default function OverzichtScreen(): React.JSX.Element {
  const t = useT();
  const { clearError } = useSimpleData();
  const router = useRouter();
  // Dezelfde beginstand als de twee schermen erachter — het is letterlijk dezelfde hook.
  // Anders belooft de tegel een aantal dat je daarna niet terugziet. Er staat hier geen
  // trainerbalk, dus de filter blijft op zijn beginstand staan.
  const { bookings: scoped } = useAgendaScope();

  const now = useMemo(() => new Date(), []);
  const thisMonth = useMemo(() => currentPeriod(now), [now]);

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
          title={t('Historiek')}
          // De telling zegt erbij waar hij over gaat: de tegel opent op deze maand, dus dat
          // is ook het aantal dat je hier leest.
          subtitle={t('{n} geweest in {periode} · ook andere periodes', {
            n: pastCount,
            periode: periodLabel(thisMonth),
          })}
          icon={History}
          onPress={() => router.push('/agenda/historiek')}
        />
        <ActionTile
          title={t('Nog te komen')}
          subtitle={upcomingCount === 1 ? t('1 geplande les') : t('{n} geplande lessen', { n: upcomingCount })}
          icon={CalendarClock}
          onPress={() => router.push('/agenda/komend')}
        />
      </TileGrid>
    </Screen>
  );
}
