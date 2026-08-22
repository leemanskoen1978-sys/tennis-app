// Nog te komen: alle lessen die nog moeten plaatsvinden, op tijd oplopend. Geen
// periodekiezer — je wilt hier juist niets missen — en geen export: een agenda vooruit is
// geen afrekening. Geannuleerde lessen staan er niet bij; die komen niet meer.

import React, { useMemo } from 'react';
import { Text, StyleSheet } from 'react-native';

import { LessonCards } from '../../components/LessonCards';
import { Screen } from '../../components/ui/Screen';
import { CoachFilter } from '../../components/ui/CoachFilter';
import { useSchoneLei, useSimpleData } from '../../providers/SimpleDataProvider';
import { useAgendaScope } from '../../providers/agendaScope';
import { upcomingBookings } from '../../lib/period';
import { tennisColors } from '../../constants/tennis-colors';
import { typography } from '../../constants/theme';
import { useT } from '../../lib/i18n';

export default function KomendScreen(): React.JSX.Element {
  const t = useT();
  const { error } = useSimpleData();
  const { coachId, setCoachId, coaches, bookings } = useAgendaScope();
  useSchoneLei();

  const now = useMemo(() => new Date(), []);

  const shown = useMemo(() => upcomingBookings(bookings, now), [bookings, now]);


  return (
    <Screen>
      <CoachFilter coaches={coaches} value={coachId} onChange={setCoachId} />

      {shown.length === 0 ? null : (
        <Text style={styles.count}>
          {shown.length === 1 ? t('1 geplande les') : t('{n} geplande lessen', { n: shown.length })}
        </Text>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <LessonCards bookings={shown} empty={t('Er staan geen lessen meer gepland.')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  count: { ...typography.body, color: tennisColors.text, fontWeight: '600' },
  error: { color: tennisColors.danger, fontSize: 14 },
});
