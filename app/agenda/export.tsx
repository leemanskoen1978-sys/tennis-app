// Maandoverzicht: de lessen van één maand, elk op zijn eigen kaart — zien wat je uitvoert,
// dan pas uitvoeren, en ondertussen de betaalwijze zetten of de les annuleren.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { PaymentMethodSheet } from '../../components/PaymentMethodSheet';
import { Badge } from '../../components/ui/Badge';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { bookingsInMonth, monthRows, toCsv, formatEuro } from '../../lib/csv';
import { cardsFor, remaining } from '../../lib/beurtenkaart';
import { bookingsFor, paymentMeta, totalRevenue, type PaymentMeta } from '../../lib/payments';
import { shareCsv } from '../../lib/share';
import { BOOKING_STATUS_LABELS } from '../../lib/status';
import type { Booking, BookingStatus, PaymentMethod } from '../../lib/types';
import { tennisColors } from '../../constants/tennis-colors';
import { minTapTarget, spacing, typography, webCursor } from '../../constants/theme';

const MONTH_NAMES = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

interface BadgeMeta {
  color: string;
  label: string;
  subtle: boolean;
}

const STATUS_META: Record<BookingStatus, BadgeMeta> = {
  pending: { color: tennisColors.warning, label: BOOKING_STATUS_LABELS.pending, subtle: false },
  confirmed: { color: tennisColors.primary, label: BOOKING_STATUS_LABELS.confirmed, subtle: false },
  cancelled: { color: tennisColors.textMuted, label: BOOKING_STATUS_LABELS.cancelled, subtle: false },
  completed: { color: tennisColors.court, label: BOOKING_STATUS_LABELS.completed, subtle: false },
  synchronized: { color: tennisColors.court, label: BOOKING_STATUS_LABELS.synchronized, subtle: false },
};

function statusMeta(status: BookingStatus): BadgeMeta {
  return STATUS_META[status];
}

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
    updateBooking,
    setPaymentMethod,
    error,
    clearError,
  } = useSimpleData();
  const router = useRouter();
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  // Eigen state: een mislukte download is geen opslagfout, dus hij hoort niet in de
  // globale error van de provider thuis.
  const [exportError, setExportError] = useState<string | null>(null);
  // Welke afspraak zijn betaalwijze laat kiezen; null = blad dicht.
  const [payingBooking, setPayingBooking] = useState<Booking | null>(null);

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

  const canCancel = (status: BookingStatus): boolean =>
    status !== 'cancelled' && status !== 'completed';

  const handleCancel = (booking: Booking): void => {
    void updateBooking(booking.id, { status: 'cancelled' });
  };

  const cardHintFor = (booking: Booking | null): string | undefined => {
    if (!booking) return undefined;
    const cards = cardsFor(beurtenkaarten, booking.player_id);
    if (cards.length === 0) return 'Deze speler heeft nog geen beurtenkaart.';
    const left = cards.reduce((sum, c) => sum + remaining(c), 0);
    return left === 1 ? 'Nog 1 beurt over.' : `Nog ${left} beurten over.`;
  };

  /**
   * Het label op de betaal-badge. Bij een les die op een beurtenkaart staat hoort het
   * saldo van die kaart erbij; hangt er geen kaart aan, dan blijft het bij het label.
   */
  const paymentLabelFor = (booking: Booking, meta: PaymentMeta): string => {
    if (booking.payment_method !== 'beurtenkaart' || !booking.beurtenkaart_id) {
      return meta.label;
    }
    const card = beurtenkaarten.find((c) => c.id === booking.beurtenkaart_id);
    if (!card) return meta.label;
    return `${meta.label} · nog ${remaining(card)}`;
  };

  // De fout is één globale bak: wis bij binnenkomst wat een ander scherm achterliet.
  // Alleen bij het openen, zodat een melding van dit scherm zelf blijft staan.
  useEffect(() => {
    clearError();
  }, []);

  const pickMethod = async (method: PaymentMethod): Promise<void> => {
    if (!payingBooking) return;
    clearError();
    try {
      const ok = await setPaymentMethod(payingBooking.id, method);
      // Bij een geweigerde keuze blijft het blad open: daar, onder de chips die de
      // trainer net aantikte, staat de melding waar hij kijkt.
      if (!ok) return;
      setPayingBooking(null);
    } catch {
      // `commit` zette de foutregel al; het blad blijft open zodat die te lezen is.
    }
  };

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

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {monthBookings.length === 0 ? (
        <Text style={styles.muted}>Geen lessen in deze maand.</Text>
      ) : (
        monthBookings.map((booking) => {
          const status = statusMeta(booking.status);
          const payment: PaymentMeta = paymentMeta(booking.payment_method);
          const paymentLabel = paymentLabelFor(booking, payment);
          const playerName = nameOf(booking.player_id);
          const coachName = nameOf(booking.coach_id);
          return (
            <Card key={booking.id}>
              <Text style={styles.cardDate}>
                {new Date(booking.start_time).toLocaleString('nl-BE')}
              </Text>
              <Text style={styles.cardCourt}>{courtName(booking.court_id)}</Text>

              {/* Both names click through: a lesson is the meeting point of the two
                  sections, so it is the natural jump between Spelers and Trainers. */}
              <View style={styles.partyRow}>
                {isCoach ? (
                  <Pressable
                    onPress={() => router.push(`/players/${booking.player_id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open dossier van ${playerName}`}
                    style={[styles.partyLine, webCursor]}
                  >
                    <Text style={styles.cardPartyLink}>Speler: {playerName}</Text>
                    <ChevronRight size={16} color={tennisColors.textMuted} />
                  </Pressable>
                ) : (
                  <Text style={styles.cardParty}>Speler: {playerName}</Text>
                )}
                <Pressable
                  onPress={() => router.push(`/coaches/${booking.coach_id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open dossier van trainer ${coachName}`}
                  style={[styles.partyLine, webCursor]}
                >
                  <Text style={styles.cardPartyLink}>Trainer: {coachName}</Text>
                  <ChevronRight size={16} color={tennisColors.textMuted} />
                </Pressable>
              </View>

              <View style={styles.badgeRow}>
                <Badge label={status.label} color={status.color} subtle={status.subtle} />
                {/* Een speler kijkt alleen; een geannuleerde les krijgt geen betaalwijze
                    meer, dus daar blijft het een gewone badge. */}
                {isCoach && booking.status !== 'cancelled' ? (
                  <Pressable
                    onPress={() => {
                      clearError();
                      setPayingBooking(booking);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Betaalwijze wijzigen, nu ${paymentLabel}`}
                    style={[styles.paymentTap, webCursor]}
                  >
                    <Badge label={paymentLabel} color={payment.color} subtle={payment.subtle} />
                  </Pressable>
                ) : (
                  <Badge label={paymentLabel} color={payment.color} subtle={payment.subtle} />
                )}
              </View>

              {canCancel(booking.status) ? (
                <View style={styles.cancelRow}>
                  <Button
                    label="Annuleren"
                    variant="danger"
                    fullWidth={false}
                    onPress={() => handleCancel(booking)}
                  />
                </View>
              ) : null}
            </Card>
          );
        })
      )}

      {exportError ? <Text style={styles.error}>{exportError}</Text> : null}

      <Button
        label="Exporteren"
        variant="primary"
        disabled={rows.length === 0}
        icon={<Download size={16} color={tennisColors.white} />}
        onPress={() => { void onExport(); }}
      />

      <PaymentMethodSheet
        visible={payingBooking !== null}
        current={payingBooking?.payment_method ?? 'open'}
        cardHint={cardHintFor(payingBooking)}
        error={error}
        onPick={(m) => {
          void pickMethod(m);
        }}
        onClose={() => {
          clearError();
          setPayingBooking(null);
        }}
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
  cardDate: { ...typography.h3, color: tennisColors.text },
  cardCourt: { ...typography.body, color: tennisColors.textMuted },
  partyRow: { marginTop: spacing.xs },
  partyLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 },
  cardParty: { ...typography.body, color: tennisColors.text },
  cardPartyLink: { ...typography.body, color: tennisColors.primary, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  // De badge zelf is maar ~22 px hoog; het raakvlak eromheen houdt de app-brede 44 px aan.
  paymentTap: { minHeight: minTapTarget, justifyContent: 'center' },
  cancelRow: { marginTop: spacing.sm, alignItems: 'flex-start' },
});
