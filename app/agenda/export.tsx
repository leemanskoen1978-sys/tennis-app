// Maandoverzicht: eerst zien wat je uitvoert, dan pas uitvoeren.

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { monthRows, toCsv, CSV_HEADER } from '../../lib/csv';
import { shareCsv } from '../../lib/share';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

const MONTH_NAMES = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function shift(month: Date, delta: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + delta, 1);
}

export default function ExportScreen(): React.JSX.Element {
  const { currentUser, bookings, users, courts } = useSimpleData();
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));

  const isCoach = currentUser?.role === 'coach';

  // Een trainer voert zijn eigen lessen uit, een speler die van hemzelf: geld en dossiers
  // blijven per persoon, ook in een export. Dezelfde regel als pendingPaymentsFor.
  const mine = useMemo(() => {
    if (!currentUser) return [];
    return bookings.filter((b) =>
      isCoach ? b.coach_id === currentUser.id : b.player_id === currentUser.id,
    );
  }, [bookings, currentUser, isCoach]);

  const rows = useMemo(
    () => monthRows(mine, users, courts, month),
    [mine, users, courts, month],
  );

  const total = rows.reduce((sum, r) => sum + r.price, 0);
  const label = `${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}`;
  const filename = `lessen-${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}.csv`;

  return (
    <Screen>
      <View style={styles.monthRow}>
        <Button
          label="Vorige"
          variant="secondary"
          fullWidth={false}
          icon={<ChevronLeft size={16} color={tennisColors.text} />}
          onPress={() => setMonth((m) => shift(m, -1))}
        />
        <Text style={styles.month}>{label}</Text>
        <Button
          label="Volgende"
          variant="secondary"
          fullWidth={false}
          icon={<ChevronRight size={16} color={tennisColors.text} />}
          onPress={() => setMonth((m) => shift(m, 1))}
        />
      </View>

      <Card>
        <Text style={styles.summary}>
          {rows.length === 1 ? '1 les' : `${rows.length} lessen`} · € {total.toFixed(2).replace('.', ',')}
        </Text>
      </Card>

      {rows.length === 0 ? (
        <Text style={styles.muted}>Geen lessen in deze maand.</Text>
      ) : (
        // De tabel is breder dan het scherm; hij schuift op zichzelf, het scherm blijft staan.
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={[styles.tr, styles.thead]}>
              {CSV_HEADER.map((h) => (
                <Text key={h} style={[styles.td, styles.th]}>{h}</Text>
              ))}
            </View>
            {rows.map((r) => (
              <View key={r.id} style={styles.tr}>
                <Text style={styles.td}>{r.date}</Text>
                <Text style={styles.td}>{r.time}</Text>
                <Text style={styles.td}>{r.coach}</Text>
                <Text style={styles.td}>{r.player}</Text>
                <Text style={styles.td}>{r.court}</Text>
                <Text style={styles.td}>{r.minutes}</Text>
                <Text style={styles.td}>{r.price.toFixed(2).replace('.', ',')}</Text>
                <Text style={styles.td}>{r.status}</Text>
                <Text style={styles.td}>{r.payment}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <Button
        label="Exporteren"
        variant="primary"
        disabled={rows.length === 0}
        icon={<Download size={16} color={tennisColors.white} />}
        onPress={() => { void shareCsv(filename, toCsv(rows)); }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  month: { ...typography.h3, color: tennisColors.text },
  summary: { ...typography.body, color: tennisColors.text, fontWeight: '600' },
  muted: { ...typography.body, color: tennisColors.textMuted },
  tr: { flexDirection: 'row' },
  thead: { borderBottomWidth: 1, borderBottomColor: tennisColors.border, marginBottom: spacing.xs },
  td: { width: 110, paddingVertical: spacing.xs, paddingRight: spacing.sm, fontSize: 13, color: tennisColors.text },
  th: { fontWeight: '700', color: tennisColors.textMuted },
});
