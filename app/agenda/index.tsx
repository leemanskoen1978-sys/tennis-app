// De agenda beantwoordt twee vragen: wat staat er vandaag te gebeuren, en waar ga ik heen.
// De lessen zelf worden niet hier afgehandeld — betalen en annuleren doe je in het
// maandoverzicht, zodat er maar één plek is waar een les verandert.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CalendarPlus, CreditCard, CalendarDays, BellRing, type LucideIcon,
} from 'lucide-react-native';

import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Screen } from '../../components/ui/Screen';
import { ActionTile, TileGrid } from '../../components/ui/ActionTile';
import { useSimpleData, usePendingPaymentBookings } from '../../providers/SimpleDataProvider';
import { bookingsOnDay } from '../../lib/hub';
import { awaitingApprovalFor, awaitingApprovalOf } from '../../lib/inbox';
import { formatDayTime } from '../../lib/datetime';
import { formatTimeRange } from '../../lib/datetime';
import { groupSize, shortGroupLabel } from '../../lib/groups';
import { bookingsFor, bookingPaymentMeta } from '../../lib/payments';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

interface Tile {
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  onPress: () => void;
  badge?: number;
}

export default function BookingsScreen(): React.JSX.Element {
  const { currentUser, bookings, users, courts, approveBooking, rejectBooking } =
    useSimpleData();
  const pending = usePendingPaymentBookings();
  const router = useRouter();

  const isCoach = currentUser?.role === 'coach';

  // Vandaag in lokale tijd; `bookingsOnDay` bepaalt wat "deze dag" is, dezelfde regel
  // die de teller op het hoofdscherm gebruikt.
  const today = useMemo(
    () => bookingsOnDay(bookingsFor(currentUser ?? null, bookings), new Date()),
    [currentUser, bookings],
  );

  // Wat een speler aanvroeg en nog op een beslissing wacht. Staat bovenaan: zolang de
  // trainer niets zegt, gaat die les niet door.
  const teKeuren = useMemo(
    () => (isCoach ? awaitingApprovalFor(bookings, currentUser?.id) : []),
    [isCoach, bookings, currentUser],
  );
  // Aan de andere kant van dezelfde vraag: waar de speler zelf nog op wacht.
  const gevraagd = useMemo(
    () => (isCoach ? [] : awaitingApprovalOf(bookings, currentUser?.id)),
    [isCoach, bookings, currentUser],
  );

  const nameOf = (id: string): string => users.find((u) => u.id === id)?.name ?? 'Onbekend';
  const courtName = (id: string): string => courts.find((c) => c.id === id)?.name ?? 'Onbekende baan';

  const tiles: Tile[] = [];
  if (isCoach) {
    tiles.push(
      { key: 'new', title: 'Nieuwe afspraak', subtitle: 'Les inplannen voor een speler', icon: CalendarPlus, onPress: () => router.push('/agenda/new') },
      { key: 'pay', title: 'Betalingen', subtitle: 'Openstaande lessen afhandelen', icon: CreditCard, onPress: () => router.push('/admin/payments'), badge: pending.length },
    );
  }
  // Voor iedereen, want dit is sinds de verhuizing de enige plek waar een speler zijn
  // eigen lessen terugvindt — die van vroeger én die van straks.
  tiles.push({
    key: 'overview',
    title: 'Overzicht',
    subtitle: 'Historiek en wat er nog komt',
    icon: CalendarDays,
    onPress: () => router.push('/agenda/overzicht'),
  });

  return (
    <Screen>
      {/* Eén kolom, op elk venster: Vandaag boven, de tegels daaronder. Twee kolomen naast
          elkaar leverde op een rustige dag links één regel met een zee van wit op, en
          drukte de drie tegels rechts in een scheve 2+1. Over de volle breedte staan ze
          op een breed venster wél naast elkaar — daar was die bredere kolom voor bedoeld. */}
      <View style={styles.stack}>
        {teKeuren.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Goed te keuren</Text>
            {teKeuren.map((b) => (
              <Card key={b.id} style={styles.newCard}>
                <View style={styles.newRow}>
                  <View style={styles.newIcon}>
                    <BellRing size={20} color={tennisColors.warning} />
                  </View>
                  <View style={styles.newBody}>
                    <Text style={styles.lessonTime}>
                      {shortGroupLabel(nameOf(b.player_id), groupSize(b))} vraagt een les
                    </Text>
                    <Text style={styles.lessonCourt}>
                      {formatDayTime(b.start_time)} · {courtName(b.court_id)}
                    </Text>
                  </View>
                </View>
                {/* Goedkeuren is de knop die je meestal wilt, dus die is de nadrukkelijke;
                    weigeren annuleert de les en geeft het uur weer vrij. */}
                <View style={styles.decide}>
                  <Button
                    label="Goedkeuren"
                    variant="primary"
                    style={styles.decideButton}
                    onPress={() => {
                      void approveBooking(b.id);
                    }}
                  />
                  <Button
                    label="Weigeren"
                    variant="secondary"
                    style={styles.decideButton}
                    onPress={() => {
                      void rejectBooking(b.id);
                    }}
                  />
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {gevraagd.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Wacht op goedkeuring</Text>
            {gevraagd.map((b) => (
              <Card key={b.id} style={styles.newCard}>
                <Text style={styles.lessonTime}>
                  {formatDayTime(b.start_time)} · {nameOf(b.coach_id)}
                </Text>
                <Text style={styles.lessonCourt}>
                  {courtName(b.court_id)} — je trainer moet deze les nog bevestigen.
                </Text>
              </Card>
            ))}
          </View>
        ) : null}

        {/* Vandaag staat boven de tegels: het antwoord op "wat moet ik nu doen". */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Vandaag</Text>
          {today.length === 0 ? (
            <Text style={styles.muted}>Geen lessen vandaag.</Text>
          ) : (
            today.map((b) => {
              const payment = bookingPaymentMeta(b);
              // Je hoeft je eigen naam niet te lezen: een trainer ziet de speler,
              // een speler ziet de trainer.
              // Zelfde vorm als op de leskaarten: "Mathis +2" bij een groepsles.
              const other = isCoach
                ? shortGroupLabel(nameOf(b.player_id), groupSize(b))
                : nameOf(b.coach_id);
              return (
                <Card key={b.id}>
                  <Text style={styles.lessonTime}>
                    {formatTimeRange(b.start_time, b.end_time)} · {other}
                  </Text>
                  <Text style={styles.lessonCourt}>{courtName(b.court_id)}</Text>
                  <Badge label={payment.label} color={payment.color} subtle={payment.subtle} />
                </Card>
              );
            })
          )}
        </View>

        <TileGrid>
          {tiles.map((t) => (
            <ActionTile
              key={t.key}
              title={t.title}
              subtitle={t.subtitle}
              icon={t.icon}
              onPress={t.onPress}
              badge={t.badge}
            />
          ))}
        </TileGrid>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // De twee blokken onder elkaar met dezelfde tussenruimte als de rest van het scherm.
  stack: { gap: spacing.lg },
  section: { gap: spacing.md },
  sectionLabel: {
    ...typography.label,
    color: tennisColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  muted: { color: tennisColors.textMuted, fontSize: 14 },
  decide: { flexDirection: 'row', gap: spacing.sm },
  decideButton: { flex: 1 },
  // Zelfde randje als het openstaande saldo op het hoofdscherm: het vraagt aandacht zonder
  // de rest van het scherm te overschreeuwen.
  newCard: { borderWidth: 1, borderColor: tennisColors.warning },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  newIcon: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: tennisColors.warningTint,
  },
  newBody: { flex: 1 },
  lessonTime: { ...typography.h3, color: tennisColors.text },
  lessonCourt: { fontSize: 13, color: tennisColors.textMuted },
});
