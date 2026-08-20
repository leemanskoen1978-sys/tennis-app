// Maandoverzicht: eerst zien wat je uitvoert, dan pas uitvoeren.

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { monthRows, toCsv, formatEuro, CSV_COLUMNS } from '../../lib/csv';
import { totalRevenue } from '../../lib/payments';
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
  // Eigen state: een mislukte download is geen opslagfout, dus hij hoort niet in de
  // globale error van de provider thuis.
  const [exportError, setExportError] = useState<string | null>(null);

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

  // Dezelfde maand als de tabel, maar dan de boekingen zelf: het bedrag mag niet uit een
  // eigen kopie van de regel komen, anders spreken twee schermen elkaar weer tegen.
  const monthBookings = useMemo(() => {
    const ids = new Set(rows.map((r) => r.id));
    return mine.filter((b) => ids.has(b.id));
  }, [mine, rows]);

  const cancelledIds = useMemo(
    () => new Set(monthBookings.filter((b) => b.status === 'cancelled').map((b) => b.id)),
    [monthBookings],
  );

  // Geboekt: alles wat er nog staat. Een geannuleerde les blijft in de tabel en in het
  // bestand staan, maar telt in geen van beide bedragen mee.
  const booked = rows
    .filter((r) => !cancelledIds.has(r.id))
    .reduce((sum, r) => sum + r.price, 0);
  // Afgehandeld: exact wat Beheer → Rapport als omzet toont, uit dezelfde functie.
  const handled = totalRevenue(monthBookings, courts);

  const label = `${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}`;
  const filename = `lessen-${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}.csv`;
  const isCurrentMonth = month.getTime() === startOfMonth(new Date()).getTime();

  async function onExport(): Promise<void> {
    try {
      await shareCsv(filename, toCsv(rows));
      setExportError(null);
    } catch {
      setExportError('Exporteren is niet gelukt. Probeer het opnieuw.');
    }
  }

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

      {isCurrentMonth ? null : (
        <View style={styles.todayRow}>
          <Button
            label="Deze maand"
            variant="secondary"
            fullWidth={false}
            onPress={() => setMonth(startOfMonth(new Date()))}
          />
        </View>
      )}

      {rows.length === 0 ? null : (
        <Card>
          <Text style={styles.summary}>
            {rows.length === 1 ? '1 les' : `${rows.length} lessen`}
            {' · € '}{formatEuro(booked)} geboekt
            {' · € '}{formatEuro(handled)} afgehandeld
          </Text>
          <Text style={styles.summaryNote}>
            Geannuleerde lessen tellen in geen van beide bedragen mee. “Afgehandeld” is
            hetzelfde bedrag als de omzet in Beheer → Rapport.
          </Text>
        </Card>
      )}

      {rows.length === 0 ? (
        <Text style={styles.muted}>Geen lessen in deze maand.</Text>
      ) : (
        // De tabel is breder dan het scherm; hij schuift op zichzelf, het scherm blijft staan.
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={[styles.tr, styles.thead]}>
              {CSV_COLUMNS.map((c) => (
                <Text key={c.label} style={[styles.td, styles.th]}>{c.label}</Text>
              ))}
            </View>
            {rows.map((r) => (
              <View key={r.id} style={styles.tr}>
                {CSV_COLUMNS.map((c) => (
                  <Text key={c.label} style={styles.td}>{c.value(r)}</Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {exportError ? <Text style={styles.error}>{exportError}</Text> : null}

      <Button
        label="Exporteren"
        variant="primary"
        disabled={rows.length === 0}
        icon={<Download size={16} color={tennisColors.white} />}
        onPress={() => { void onExport(); }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  month: { ...typography.h3, color: tennisColors.text },
  summary: { ...typography.body, color: tennisColors.text, fontWeight: '600' },
  summaryNote: { ...typography.body, fontSize: 13, color: tennisColors.textMuted, marginTop: spacing.xs },
  muted: { ...typography.body, color: tennisColors.textMuted },
  todayRow: { alignItems: 'center' },
  error: { color: tennisColors.danger, fontSize: 14 },
  tr: { flexDirection: 'row' },
  thead: { borderBottomWidth: 1, borderBottomColor: tennisColors.border, marginBottom: spacing.xs },
  td: { width: 110, paddingVertical: spacing.xs, paddingRight: spacing.sm, fontSize: 13, color: tennisColors.text },
  th: { fontWeight: '700', color: tennisColors.textMuted },
});
