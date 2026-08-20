// Rapport: "hoe draait het". Bovenaan de periode en de trainer, daaronder de cijfers over
// precies die selectie — dezelfde twee filters en dezelfde volgorde als op Historiek, zodat
// je niet per scherm opnieuw hoeft te leren hoe je iets afbakent.
//
// Het scherm rekent zelf niets uit: alle cijfers komen uit lib/reports en lib/payments. Wat
// hier staat is opmaak.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertCircle, CalendarDays, Euro } from 'lucide-react-native';

import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { BarChart, type Bar } from '../../components/ui/BarChart';
import { CoachFilter } from '../../components/ui/CoachFilter';
import { PeriodPicker } from '../../components/ui/PeriodPicker';
import { StatCard, StatCardRow } from '../../components/ui/StatCard';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { formatEuro } from '../../lib/csv';
import {
  PAYMENT_METHODS,
  PAYMENT_LABELS,
  bookingsByCoach,
  filterPendingPayment,
  paymentMeta,
  totalRevenue,
  visibleBookings,
} from '../../lib/payments';
import {
  bookingsInPeriod, currentPeriod, periodLabel, shortMonthName, type Period,
} from '../../lib/period';
import { countByPaymentMethod, countedBookings, monthlySeries, revenueByPlayer } from '../../lib/reports';
import type { User } from '../../lib/types';

/**
 * Zes maanden verloop. Genoeg om een seizoen te zien aankomen en weer weg te zakken, en nog
 * net zoveel staafjes als er op een telefoon leesbaar naast elkaar passen.
 */
const CHART_MONTHS = 6;

export default function ReportsScreen(): React.JSX.Element {
  const { currentUser, bookings, users, courts } = useSimpleData();

  const isCoach = currentUser?.role === 'coach';

  // Deze maand als beginstand: de vraag "hoe draait het" gaat over hoe het nú loopt, en het
  // is dezelfde stand waarin Historiek opent. Dat de maand aan het begin nog leeg kan zijn,
  // vangt de grafiek op: die kijkt altijd een half jaar terug, ongeacht de gekozen periode.
  const [period, setPeriod] = useState<Period>(() => currentPeriod());
  // Een trainer kijkt standaard naar zijn eigen lessen; bij een speler doet de filter er niet
  // toe, want hij ziet sowieso alleen zijn eigen lessen.
  const [coachId, setCoachId] = useState<string | null>(
    () => (currentUser?.role === 'coach' ? currentUser.id : null),
  );

  const coaches: User[] = useMemo(() => users.filter((u) => u.role === 'coach'), [users]);

  // Eerst wie wat mag zien, dan de trainerfilter: dezelfde volgorde als op Historiek, zodat
  // de regel "een speler ziet alleen zijn eigen lessen" nergens omzeild kan worden.
  const allowed = useMemo(
    () => bookingsByCoach(visibleBookings(currentUser ?? null, bookings), coachId),
    [currentUser, bookings, coachId],
  );

  const shown = useMemo(() => bookingsInPeriod(allowed, period), [allowed, period]);

  const revenue = useMemo(() => totalRevenue(shown, courts), [shown, courts]);
  const lessons = useMemo(() => countedBookings(shown).length, [shown]);
  const pending = useMemo(() => filterPendingPayment(shown).length, [shown]);
  const breakdown = useMemo(() => countByPaymentMethod(shown), [shown]);
  const perPlayer = useMemo(
    () => revenueByPlayer(shown, users, courts),
    [shown, users, courts],
  );

  // De grafiek loopt bewust langs `allowed` en niet langs `shown`: één maand omzet zegt niets
  // zonder de maanden ervoor, dus het verloop houdt zijn eigen venster van een half jaar tot
  // en met de maand waarin de gekozen periode eindigt.
  const series = useMemo(
    () => monthlySeries(allowed, courts, period.to, CHART_MONTHS),
    [allowed, courts, period],
  );

  // Op de staven staat de omzet, niet het aantal lessen: twee lessen van een uur en twee van
  // een half uur zijn evenveel lessen maar niet evenveel geld, en het is het geld waar de
  // vraag "hoe draait het" over gaat. Het aantal lessen staat in het gesproken label, zodat
  // het cijfer niet verdwijnt.
  const bars: Bar[] = series.map((p) => ({
    label: p.label,
    value: p.amount,
    caption: p.amount > 0 ? `€${formatEuro(p.amount)}` : '',
  }));

  const chartLabel = `Omzet per maand. ${series
    .map((p) => `${p.label} ${p.year}: ${formatEuro(p.amount)} euro uit ${p.lessons} ${p.lessons === 1 ? 'les' : 'lessen'}`)
    .join('. ')}.`;

  const firstMonth = series.length > 0 ? series[0] : null;
  const lastMonth = series.length > 0 ? series[series.length - 1] : null;

  if (!currentUser) {
    return (
      <Screen scroll={false} contentStyle={styles.emptyInner}>
        <Text style={styles.emptyTitle}>Rapport</Text>
        <Text style={styles.emptyText}>Log in om je rapport te bekijken.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <PeriodPicker value={period} onChange={setPeriod} />

      <CoachFilter coaches={coaches} value={coachId} onChange={setCoachId} />

      {/* Een speler krijgt geen omzet te zien: dat is het verhaal van de trainer. Hij houdt
          de twee kaarten die over hemzelf gaan. */}
      <StatCardRow>
        {isCoach ? (
          <StatCard icon={Euro} value={`€${formatEuro(revenue)}`} label="Omzet" />
        ) : null}
        <StatCard icon={CalendarDays} value={lessons} label="Lessen" />
        <StatCard icon={AlertCircle} value={pending} label="Openstaand" tone="warning" />
      </StatCardRow>

      {isCoach ? (
        <Card>
          <Text style={styles.cardTitle}>Per speler</Text>
          {perPlayer.length === 0 ? (
            <Text style={styles.emptyLine}>Geen lessen in {periodLabel(period)}.</Text>
          ) : (
            perPlayer.map((row) => (
              <View key={row.playerId} style={styles.playerRow}>
                <View style={styles.playerNameWrap}>
                  <Text style={styles.statLabel}>{row.name}</Text>
                  <Text style={styles.playerLessons}>
                    {row.lessons === 1 ? '1 les' : `${row.lessons} lessen`}
                  </Text>
                </View>
                <Text style={styles.playerAmount}>€{formatEuro(row.amount)}</Text>
              </View>
            ))
          )}
          <Text style={styles.note}>
            Op bedrag aflopend. Geannuleerde lessen tellen nergens mee; een les zonder
            afgesproken betaalwijze telt wel als les, maar nog niet als geld.
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.cardTitle}>Per betaalwijze</Text>
        {PAYMENT_METHODS.map((method) => (
          <StatRow
            key={method}
            label={PAYMENT_LABELS[method]}
            value={breakdown[method]}
            color={paymentMeta(method).color}
          />
        ))}
        <Text style={styles.note}>Lessen in {periodLabel(period)}.</Text>
      </Card>

      {isCoach ? (
        <Card>
          <Text style={styles.cardTitle}>Verloop</Text>
          <BarChart bars={bars} accessibilityLabel={chartLabel} />
          <Text style={styles.note}>
            Omzet per maand
            {firstMonth && lastMonth
              ? `, ${shortMonthName(firstMonth.month)} ${firstMonth.year} tot en met `
                + `${shortMonthName(lastMonth.month)} ${lastMonth.year}`
              : ''}
            . Het verloop kijkt altijd {CHART_MONTHS} maanden terug, ook als je een kortere
            periode koos — één maand zegt niets zonder de maanden ervoor.
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}

interface StatRowProps {
  label: string;
  value: number;
  color: string;
}

function StatRow({ label, value, color }: StatRowProps): React.JSX.Element {
  return (
    <View style={styles.statRow}>
      <View style={styles.statLabelWrap}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...typography.h1,
    color: tennisColors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: tennisColors.textMuted,
    textAlign: 'center',
  },
  emptyLine: {
    ...typography.body,
    color: tennisColors.textMuted,
  },
  cardTitle: {
    ...typography.h2,
    color: tennisColors.text,
    marginBottom: spacing.xs,
  },
  note: {
    ...typography.body,
    fontSize: 13,
    color: tennisColors.textMuted,
    marginTop: spacing.xs,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tennisColors.border,
  },
  playerNameWrap: { flexShrink: 1, gap: 2 },
  playerLessons: { ...typography.caption, color: tennisColors.textMuted },
  playerAmount: { fontSize: 17, fontWeight: '700', color: tennisColors.text },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  statLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statLabel: {
    ...typography.body,
    color: tennisColors.text,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
  },
});
