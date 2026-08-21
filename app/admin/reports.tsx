// Rapport: "hoe draait het". Bovenaan de periode en de trainer, daaronder de cijfers over
// precies die selectie — dezelfde twee filters en dezelfde volgorde als op Historiek, zodat
// je niet per scherm opnieuw hoeft te leren hoe je iets afbakent.
//
// Het scherm rekent zelf niets uit: alle cijfers komen uit lib/reports en lib/payments. Wat
// hier staat is opmaak.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertCircle, CalendarDays, Euro, Wallet } from 'lucide-react-native';

import { useT } from '../../lib/i18n';
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
  totalCoachPayout,
  totalRevenue,
  visibleBookings,
} from '../../lib/payments';
import {
  bookingsInPeriod, currentPeriod, periodLabel, shortMonthName, type Period,
} from '../../lib/period';
import {
  countByPaymentMethod, countedBookings, monthlySeries, payoutsByCoach, totalsByPlayer,
} from '../../lib/reports';
import type { User } from '../../lib/types';

/**
 * Zes maanden verloop. Genoeg om een seizoen te zien aankomen en weer weg te zakken, en nog
 * net zoveel staafjes als er op een telefoon leesbaar naast elkaar passen.
 */
const CHART_MONTHS = 6;

export default function ReportsScreen(): React.JSX.Element {
  const t = useT();
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
    () => totalsByPlayer(shown, users, courts),
    [shown, users, courts],
  );
  // Twee verschillende bedragen: `revenue` is wat de spelers betalen (uurtarief van de baan),
  // `payout` is wat de trainers krijgen (hun eigen uurtarief). Het verschil is wat de club
  // overhoudt; dat cijfer staat hier bewust niet als kaart — het rapport gaat over wat er
  // binnenkomt en wat eruit gaat, en de rest is een som die iedereen zelf kan maken.
  const payout = useMemo(() => totalCoachPayout(shown, users), [shown, users]);
  const perCoach = useMemo(() => payoutsByCoach(shown, users), [shown, users]);

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

  const chartLabel = `${t('Omzet per maand.')} ${series
    .map((p) => t('{maand} {jaar}: {bedrag} euro uit {lessen}', {
      maand: p.label,
      jaar: p.year,
      bedrag: formatEuro(p.amount),
      lessen: p.lessons === 1 ? t('1 les') : t('{n} lessen', { n: p.lessons }),
    }))
    .join('. ')}.`;

  const firstMonth = series.length > 0 ? series[0] : null;
  const lastMonth = series.length > 0 ? series[series.length - 1] : null;

  if (!currentUser) {
    return (
      <Screen scroll={false} contentStyle={styles.emptyInner}>
        <Text style={styles.emptyTitle}>{t('Rapport')}</Text>
        <Text style={styles.emptyText}>{t('Log in om je rapport te bekijken.')}</Text>
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
          <>
            <StatCard icon={Euro} value={`€${formatEuro(revenue)}`} label={t('Omzet')} />
            {/* Naast de omzet, niet erin: dit is wat er weer uitgaat naar de trainers. */}
            <StatCard icon={Wallet} value={`€${formatEuro(payout)}`} label={t('Trainersloon')} />
          </>
        ) : null}
        <StatCard icon={CalendarDays} value={lessons} label={t('Lessen')} />
        <StatCard icon={AlertCircle} value={pending} label={t('Openstaand')} tone="warning" />
      </StatCardRow>

      {isCoach ? (
        <Card>
          <Text style={styles.cardTitle}>{t('Per speler')}</Text>
          {perPlayer.length === 0 ? (
            <Text style={styles.emptyLine}>{t('Geen lessen in {periode}.', { periode: periodLabel(period) })}</Text>
          ) : (
            <>
              {/* Een kop, anders is niet te zien welk bedrag welk is. Hij hoort bij de
                  kolommen eronder, dus hij krijgt exact dezelfde breedtes. */}
              <View style={styles.playerHead}>
                <Text style={[styles.nameCol, styles.colHead]}>{t('Speler')}</Text>
                <Text style={[styles.amountCol, styles.colHead]}>{t('Betaald')}</Text>
                <Text style={[styles.amountCol, styles.colHead]}>{t('Openstaand')}</Text>
              </View>
              {perPlayer.map((row) => (
                <View key={row.playerId} style={styles.playerRow}>
                  <View style={styles.playerNameWrap}>
                    <Text style={styles.statLabel}>{row.name}</Text>
                    <Text style={styles.playerLessons}>
                      {row.lessons === 1 ? t('1 les') : t('{n} lessen', { n: row.lessons })}
                    </Text>
                  </View>
                  <Text style={[styles.amountCol, styles.playerAmount]}>
                    €{formatEuro(row.paid)}
                  </Text>
                  {/* Alleen kleuren als er echt iets openstaat: anders vraagt een rij vol
                      nullen om aandacht die er niet is. */}
                  <Text
                    style={[
                      styles.amountCol,
                      styles.playerAmount,
                      row.open > 0 ? styles.openAmount : null,
                    ]}
                  >
                    €{formatEuro(row.open)}
                  </Text>
                </View>
              ))}
            </>
          )}
          <Text style={styles.note}>
            {t('Op totaal aflopend. Betaald is het geld dat afgesproken is, openstaand zijn de '
              + 'lessen waarvoor nog niets gekozen is. Geannuleerde lessen tellen nergens mee, en '
              + 'een gesponsorde les staat bij betaald: het sponsorcontract is betaald geld.')}
          </Text>
        </Card>
      ) : null}

      {isCoach ? (
        <Card>
          <Text style={styles.cardTitle}>{t('Per trainer')}</Text>
          {perCoach.length === 0 ? (
            <Text style={styles.emptyLine}>{t('Geen lessen in {periode}.', { periode: periodLabel(period) })}</Text>
          ) : (
            <>
              {/* Dezelfde kolommenopzet als "Per speler", zodat de twee kaarten zich op
                  dezelfde manier laten lezen. Hier staat één bedrag, dus één kolom rechts. */}
              <View style={styles.playerHead}>
                <Text style={[styles.nameCol, styles.colHead]}>{t('Trainer')}</Text>
                <Text style={[styles.amountCol, styles.colHead]}>{t('Loon')}</Text>
              </View>
              {perCoach.map((row) => (
                <View key={row.coachId} style={styles.playerRow}>
                  <View style={styles.playerNameWrap}>
                    <Text style={styles.statLabel}>{row.name}</Text>
                    <Text style={styles.playerLessons}>
                      {row.lessons === 1 ? t('1 les') : t('{n} lessen', { n: row.lessons })}
                    </Text>
                    {/* Een vergeten uurtarief mag niet als een stille nul voorbijgaan: het
                        bedrag klopt pas als iemand het tarief invult. */}
                    {row.missingRate ? (
                      <Text style={styles.warnLine}>{t('Uurtarief nog niet ingesteld')}</Text>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.amountCol,
                      styles.playerAmount,
                      row.missingRate ? styles.openAmount : null,
                    ]}
                  >
                    €{formatEuro(row.amount)}
                  </Text>
                </View>
              ))}
            </>
          )}
          <Text style={styles.note}>
            {t('Op bedrag aflopend. Dit is wat de trainer krijgt: zijn eigen uurtarief naar rato '
              + 'van de duur, ongeacht de betaalwijze — het uur is gegeven. De omzet hierboven '
              + 'loopt op het uurtarief van de baan; het verschil houdt de club over. Geannuleerde '
              + 'lessen tellen nergens mee.')}
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.cardTitle}>{t('Per betaalwijze')}</Text>
        {PAYMENT_METHODS.map((method) => (
          <StatRow
            key={method}
            label={t(PAYMENT_LABELS[method])}
            value={breakdown[method]}
            color={paymentMeta(method).color}
          />
        ))}
        <Text style={styles.note}>{t('Lessen in {periode}.', { periode: periodLabel(period) })}</Text>
      </Card>

      {isCoach ? (
        <Card>
          <Text style={styles.cardTitle}>{t('Verloop')}</Text>
          <BarChart bars={bars} accessibilityLabel={chartLabel} />
          <Text style={styles.note}>
            {t('Omzet per maand{bereik}. Het verloop kijkt altijd {n} maanden terug, ook als je '
              + 'een kortere periode koos — één maand zegt niets zonder de maanden ervoor.', {
              bereik: firstMonth && lastMonth
                ? t(', {van} {vanJaar} tot en met {tot} {totJaar}', {
                  van: shortMonthName(firstMonth.month),
                  vanJaar: firstMonth.year,
                  tot: shortMonthName(lastMonth.month),
                  totJaar: lastMonth.year,
                })
                : '',
              n: CHART_MONTHS,
            })}
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
  // Drie kolommen naast elkaar, geen horizontale scroll: er staan maar twee bedragen en die
  // zijn kort, dus een vaste kolombreedte rechts is genoeg. De naam krijgt wat overblijft en
  // mag over twee regels afbreken — op een smalle telefoon zakt "Van der Steen" netjes door
  // in plaats van de bedragen weg te duwen.
  playerHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: tennisColors.border,
  },
  colHead: {
    ...typography.caption,
    color: tennisColors.textMuted,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tennisColors.border,
  },
  nameCol: { flex: 1, flexShrink: 1 },
  playerNameWrap: { flex: 1, flexShrink: 1, gap: 2 },
  // Breed genoeg voor "Openstaand" in de kop en voor een bedrag van vier cijfers eronder.
  amountCol: { width: 84, textAlign: 'right' },
  playerLessons: { ...typography.caption, color: tennisColors.textMuted },
  // Dezelfde kleur als een openstaand bedrag: allebei "hier moet nog iets gebeuren".
  warnLine: { ...typography.caption, color: tennisColors.warning },
  playerAmount: { fontSize: 16, fontWeight: '700', color: tennisColors.text },
  openAmount: { color: tennisColors.warning },
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
