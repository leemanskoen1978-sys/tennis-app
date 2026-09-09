// Weekagenda: hoe vol staat mijn week echt. Het raster en het rekenwerk staan in
// Weekagenda/WeekRaster/lib/week; dit scherm kiest de week, bepaalt wie er van wie kijkt
// (trainerbalk) en tekent het lesdetail.

import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';

import { Weekagenda } from '../../components/Weekagenda';
import { BookingDetailSheet } from '../../components/BookingDetailSheet';
import { Screen } from '../../components/ui/Screen';
import { CoachFilter } from '../../components/ui/CoachFilter';
import { useSchoneLei, useSimpleData } from '../../providers/SimpleDataProvider';
import { useAgendaScope } from '../../providers/agendaScope';
import { useKindkeuze } from '../../providers/kindkeuze';
import type { Period } from '../../lib/period';
import { weekPeriod } from '../../lib/week';
import { isCoach } from '../../lib/rechten';
import type { Booking } from '../../lib/types';
import { tennisColors } from '../../constants/tennis-colors';

export default function WeekScreen(): React.JSX.Element {
  const { currentUser, error, clearError } = useSimpleData();
  const { kijktNaarZichzelf } = useKindkeuze();
  const [openBooking, setOpenBooking] = useState<Booking | null>(null);
  const { coachId, setCoachId, coaches, bookings } = useAgendaScope();
  useSchoneLei();

  const [week, setWeek] = useState<Period>(() => weekPeriod(new Date()));

  return (
    <Screen>
      <CoachFilter coaches={coaches} value={coachId} onChange={setCoachId} />

      <Weekagenda
        bookings={bookings}
        week={week}
        onWeek={setWeek}
        onBookingPress={(b) => { clearError(); setOpenBooking(b); }}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <BookingDetailSheet
        booking={openBooking}
        visible={openBooking !== null}
        canManage={isCoach(currentUser) && kijktNaarZichzelf}
        onClose={() => { clearError(); setOpenBooking(null); }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: tennisColors.danger, fontSize: 14 },
});
