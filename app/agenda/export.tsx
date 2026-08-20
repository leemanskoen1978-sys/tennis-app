// Maandoverzicht: de lessen van één maand, elk op zijn eigen kaart — zien wat je uitvoert,
// dan pas uitvoeren. De kaart draagt alleen wat je nodig hebt om een les te herkennen;
// alles erover, en de handelingen erop, staan in het detailblad dat een tik erop opent.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react-native';

import { LessonDetailSheet, paymentLabelFor } from '../../components/LessonDetailSheet';
import { Badge } from '../../components/ui/Badge';
import { Screen, useIsWide } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { bookingsInMonth, monthRows, toCsv, formatEuro } from '../../lib/csv';
import { formatDay, formatTimeRange } from '../../lib/datetime';
import { bookingsFor, paymentMeta, totalRevenue, type PaymentMeta } from '../../lib/payments';
import { shareCsv } from '../../lib/share';
import type { Booking } from '../../lib/types';
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
  const {
    currentUser,
    bookings,
    users,
    courts,
    beurtenkaarten,
    error,
    clearError,
  } = useSimpleData();
  const isWide = useIsWide();
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  // Eigen state: een mislukte download is geen opslagfout, dus hij hoort niet in de
  // globale error van de provider thuis.
  const [exportError, setExportError] = useState<string | null>(null);
  // Welke les zijn details laat zien; null = blad dicht.
  const [openBooking, setOpenBooking] = useState<Booking | null>(null);

  const isCoach = currentUser?.role === 'coach';

  // Een trainer voert zijn eigen lessen uit, een speler die van hemzelf: geld en dossiers
  // blijven per persoon, ook in een export. Gedeelde regel uit lib/payments.
  const mine = useMemo(
    () => bookingsFor(currentUser, bookings),
    [bookings, currentUser],
  );

  const rows = useMemo(
    () => monthRows(mine, users, courts, month),
    [mine, users, courts, month],
  );

  // Dezelfde maand als het bestand, maar dan de boekingen zelf: de kaarten hebben status,
  // betaalwijze en id nodig. Eén gedeelde maandfilter, zodat scherm en bestand niet uit
  // elkaar kunnen lopen.
  const monthBookings = useMemo(() => bookingsInMonth(mine, month), [mine, month]);

  const cancelledIds = useMemo(
    () => new Set(monthBookings.filter((b) => b.status === 'cancelled').map((b) => b.id)),
    [monthBookings],
  );

  // Geboekt: alles wat er nog staat. Een geannuleerde les blijft op het scherm en in het
  // bestand staan, maar telt in geen van beide bedragen mee.
  const booked = rows
    .filter((r) => !cancelledIds.has(r.id))
    .reduce((sum, r) => sum + r.price, 0);
  // Afgehandeld: exact wat Beheer → Rapport als omzet toont, uit dezelfde functie.
  const handled = totalRevenue(monthBookings, courts);

  const label = `${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}`;
  const filename = `lessen-${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}.csv`;
  const isCurrentMonth = month.getTime() === startOfMonth(new Date()).getTime();

  const courtName = (courtId: string): string => {
    const court = courts.find((c) => c.id === courtId);
    return court ? court.name : 'Onbekend terrein';
  };

  const nameOf = (id?: string): string => {
    const user = users.find((u) => u.id === id);
    return user ? user.name : 'Onbekend';
  };

  // De fout is één globale bak: wis bij binnenkomst wat een ander scherm achterliet.
  // Alleen bij het openen, zodat een melding van dit scherm zelf blijft staan.
  useEffect(() => {
    clearError();
  }, []);

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
      {/* De drie delen blijven bij elkaar en staan als groep gecentreerd. Uit elkaar
          getrokken over de volle breedte oogde dit als drie losse dingen; het is er één. */}
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

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {monthBookings.length === 0 ? (
        <Text style={styles.muted}>Geen lessen in deze maand.</Text>
      ) : (
        // Boven het omslagpunt twee kolommen: één korte kaart per rij liet op 960 px een
        // halve rij wit achter. Daaronder blijft het één kolom, zoals op een telefoon.
        <View style={isWide ? styles.grid : styles.stack}>
          {monthBookings.map((booking) => {
            const payment: PaymentMeta = paymentMeta(booking.payment_method);
            const paymentLabel = paymentLabelFor(booking, payment, beurtenkaarten);
            // Je eigen naam hoef je niet te lezen: een trainer ziet de speler, een speler
            // de trainer. Dezelfde regel als de Vandaag-lijst op de agenda, zodat dezelfde
            // les op beide schermen hetzelfde oogt.
            const other = isCoach ? nameOf(booking.player_id) : nameOf(booking.coach_id);
            return (
              <View key={booking.id} style={isWide ? styles.cell : undefined}>
                <Card
                  onPress={() => {
                    clearError();
                    setOpenBooking(booking);
                  }}
                  accessibilityLabel={`Les van ${formatDay(booking.start_time)} met ${other}, details openen`}
                >
                  <Text style={styles.cardDate}>
                    {formatTimeRange(booking.start_time, booking.end_time)} · {other}
                  </Text>
                  <Text style={styles.cardCourt}>
                    {formatDay(booking.start_time)} · {courtName(booking.court_id)}
                  </Text>
                  <View style={styles.badgeRow}>
                    <Badge label={paymentLabel} color={payment.color} subtle={payment.subtle} />
                  </View>
                </Card>
              </View>
            );
          })}
        </View>
      )}

      {exportError ? <Text style={styles.error}>{exportError}</Text> : null}

      <Button
        label="Exporteren"
        variant="primary"
        disabled={rows.length === 0}
        icon={<Download size={16} color={tennisColors.white} />}
        onPress={() => { void onExport(); }}
      />

      <LessonDetailSheet
        booking={openBooking}
        visible={openBooking !== null}
        canManage={isCoach}
        onClose={() => {
          clearError();
          setOpenBooking(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // `wrap` als vangnet: op een smalle telefoon zakt het label anders niet netjes af maar
  // duwt het de knoppen buiten beeld.
  monthRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    justifyContent: 'center', gap: spacing.md,
  },
  // Een minimumbreedte voor het label: zonder dat verspringen de knoppen bij elke maand,
  // want "mei 2026" is korter dan "september 2026".
  month: { ...typography.h3, color: tennisColors.text, minWidth: 150, textAlign: 'center' },
  summary: { ...typography.body, color: tennisColors.text, fontWeight: '600' },
  summaryNote: { ...typography.body, fontSize: 13, color: tennisColors.textMuted, marginTop: spacing.xs },
  muted: { ...typography.body, color: tennisColors.textMuted },
  todayRow: { alignItems: 'center' },
  error: { color: tennisColors.danger, fontSize: 14 },
  // Het raster om de leskaarten. `gap` doet het werk; de cellen zelf zijn net onder de
  // helft breed zodat er op een breed venster twee naast elkaar passen.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  // Onder het omslagpunt: gewoon onder elkaar, elk over de volle breedte.
  stack: { gap: spacing.md },
  cell: { flexGrow: 1, flexBasis: '48%', maxWidth: '49%' },
  cardDate: { ...typography.h3, color: tennisColors.text },
  cardCourt: { fontSize: 13, color: tennisColors.textMuted },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
});
