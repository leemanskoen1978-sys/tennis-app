// De agenda beantwoordt twee vragen: wat staat er vandaag te gebeuren, en waar ga ik heen.
// De lessen zelf worden niet hier afgehandeld — betalen en annuleren doe je in het
// maandoverzicht, zodat er maar één plek is waar een les verandert.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CalendarPlus, CreditCard, CalendarDays, type LucideIcon,
} from 'lucide-react-native';

import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Screen, useIsWide } from '../../components/ui/Screen';
import { ActionTile, TileGrid } from '../../components/ui/ActionTile';
import { useSimpleData, usePendingPaymentBookings } from '../../providers/SimpleDataProvider';
import { bookingsOnDay } from '../../lib/hub';
import { bookingsFor, paymentMeta } from '../../lib/payments';
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

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
}

export default function BookingsScreen(): React.JSX.Element {
  const { currentUser, bookings, users, courts } = useSimpleData();
  const pending = usePendingPaymentBookings();
  const router = useRouter();
  const isWide = useIsWide();

  const isCoach = currentUser?.role === 'coach';

  // Vandaag in lokale tijd; `bookingsOnDay` bepaalt wat "deze dag" is, dezelfde regel
  // die de teller op het hoofdscherm gebruikt.
  const today = useMemo(
    () => bookingsOnDay(bookingsFor(currentUser ?? null, bookings), new Date()),
    [currentUser, bookings],
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
  // eigen lessen van een hele maand nog terugvindt.
  tiles.push({
    key: 'month',
    title: 'Maandoverzicht',
    subtitle: 'Alle lessen van een maand',
    icon: CalendarDays,
    onPress: () => router.push('/agenda/export'),
  });

  return (
    <Screen>
      {/* Op een breed venster naast elkaar (lessen links, tegels rechts), daaronder
          gewoon onder elkaar: dezelfde inhoud, alleen een andere indeling. */}
      <View style={isWide ? styles.columns : styles.stack}>
        {/* Vandaag staat boven (of links van) de tegels: het antwoord op "wat moet ik nu doen". */}
        <View style={[styles.section, isWide && styles.column]}>
          <Text style={styles.sectionLabel}>Vandaag</Text>
          {today.length === 0 ? (
            <Text style={styles.muted}>Geen lessen vandaag.</Text>
          ) : (
            today.map((b) => {
              const payment = paymentMeta(b.payment_method);
              // Je hoeft je eigen naam niet te lezen: een trainer ziet de speler,
              // een speler ziet de trainer.
              const other = isCoach ? nameOf(b.player_id) : nameOf(b.coach_id);
              return (
                <Card key={b.id}>
                  <Text style={styles.lessonTime}>
                    {timeLabel(b.start_time)} · {other}
                  </Text>
                  <Text style={styles.lessonCourt}>{courtName(b.court_id)}</Text>
                  <Badge label={payment.label} color={payment.color} subtle={payment.subtle} />
                </Card>
              );
            })
          )}
        </View>

        <View style={isWide ? styles.column : undefined}>
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Smal venster: de twee blokken onder elkaar met dezelfde tussenruimte als voorheen.
  stack: { gap: spacing.lg },
  // Breed venster: twee even brede kolommen; `alignItems: flex-start` houdt de tegels
  // bovenaan in plaats van uit te rekken over de hoogte van de lessenlijst.
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  column: { flex: 1, minWidth: 300 },
  section: { gap: spacing.md },
  sectionLabel: {
    ...typography.label,
    color: tennisColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  muted: { color: tennisColors.textMuted, fontSize: 14 },
  lessonTime: { ...typography.h3, color: tennisColors.text },
  lessonCourt: { fontSize: 13, color: tennisColors.textMuted },
});
