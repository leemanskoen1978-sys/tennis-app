// Een lijst korte leskaarten met het detailblad eraan vast. Historiek en Nog te komen tonen
// dezelfde les; stond dit op beide schermen los overgeschreven, dan zou dezelfde les er per
// scherm anders uit gaan zien — en dat is precies wat het detailblad ooit kwam oplossen.

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { BookingDetailSheet, paymentLabelFor } from './BookingDetailSheet';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { useIsWide } from './ui/Screen';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { formatDay, formatTimeRange } from '../lib/datetime';
import { groupSize, shortGroupLabel } from '../lib/groups';
import { bookingPaymentMeta, type PaymentMeta } from '../lib/payments';
import { isAwaitingApproval } from '../lib/inbox';
import { openZiekmeldingen, zoektVervanger } from '../lib/ziekmelding';
import { BOOKING_STATUS_LABELS } from '../lib/status';
import type { Booking } from '../lib/types';
import { useT } from '../lib/i18n';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, typography } from '../constants/theme';
import { isCoach } from '../lib/rechten';
import { useKindkeuze } from '../providers/kindkeuze';

export function LessonCards({
  bookings,
  empty,
}: {
  bookings: Booking[];
  /** Wat er staat als er niets te tonen valt. */
  empty: string;
}): React.JSX.Element {
  const t = useT();
  const { currentUser, users, courts, beurtenkaarten, sickLeaves, clearError } = useSimpleData();
  // Een trainer die naar zijn eigen kind kijkt, leest mee als ouder: hij ziet de les, maar
  // niet de knoppen waarmee een trainer hem verzet of annuleert.
  const { kijktNaarZichzelf } = useKindkeuze();
  const isWide = useIsWide();
  // Welke les zijn details laat zien; null = blad dicht.
  const [openBooking, setOpenBooking] = useState<Booking | null>(null);

  // Welke meldingen nog meetellen is één vraag voor de hele lijst, dus die staat hier en niet
  // in de lus. Het antwoord per les — zoekt díe les nog een vervanger — wordt wél per kaart
  // vers gesteld: het hangt van de dag en van de lesgever van die ene les af.
  const openMeldingen = openZiekmeldingen(sickLeaves);

  const nameOf = (id?: string): string => users.find((u) => u.id === id)?.name ?? t('Onbekend');
  const courtName = (id: string): string =>
    courts.find((c) => c.id === id)?.name ?? t('Onbekend terrein');

  if (bookings.length === 0) {
    return <Text style={styles.muted}>{empty}</Text>;
  }

  return (
    <>
      {/* Boven het omslagpunt twee kolommen: één korte kaart per rij liet op 960 px een
          halve rij wit achter. Daaronder blijft het één kolom, zoals op een telefoon. */}
      <View style={isWide ? styles.grid : styles.stack}>
        {bookings.map((booking) => {
          const payment: PaymentMeta = bookingPaymentMeta(booking);
          const paymentLabel = paymentLabelFor(booking, payment, beurtenkaarten);
          // Je eigen naam hoef je niet te lezen: een trainer ziet de speler, een speler de
          // trainer. Kijkt een trainer naar de agenda van een collega, dan zegt de speler
          // hem het meest — de trainer staat dan al in de filter erboven.
          // Bij een groepsles staat er "Mathis +2": de speler die de les op zijn naam heeft,
          // en hoeveel er nog bij stonden. De namen zelf staan in het detailblad — daar is
          // ruimte voor, op een korte kaart niet.
          // Gaf iemand anders de les, dan blijft de naam van de vaste trainer staan met een
          // korte markering erachter — nooit alleen de naam van de vervanger (D-07). Op een
          // korte kaart passen geen twee volledige namen; het detailblad, één tik verder,
          // toont ze allebei. De kaart is een samenvatting, het detailblad de bron.
          const other = isCoach(currentUser)
            ? shortGroupLabel(nameOf(booking.player_id), groupSize(booking))
            : booking.taught_by_id
              ? `${nameOf(booking.coach_id)} (${t('vervangen')})`
              : nameOf(booking.coach_id);
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
                  {/* Een les waarvan de trainer ziek is en die nog geen vervanger heeft,
                      blijft hier zichtbaar gemarkeerd staan tot hij geregeld of afgezegd is
                      (D-06 / VERV-07). Hij verdwijnt nooit stil: een les die er gewoon uitziet
                      terwijl er niemand komt, is precies de fout waarvoor deze module bestaat.

                      Het is een afgeleid feit en geen kolom of status: er staat nergens een
                      vlaggetje dat iemand kan vergeten uit te zetten. Wordt de ziekmelding
                      ingetrokken, dan is deze markering vanzelf weg — zonder dat er ook maar
                      één boeking bijgewerkt hoeft te worden.

                      De markering ernaast, "(vervangen)" bij de naam hierboven, gaat over iets
                      anders: dáár stond iemand anders. De twee sluiten elkaar uit, want
                      `zoektVervanger` zegt nee zodra er een lesgever op de les staat. */}
                  {zoektVervanger(booking, openMeldingen) ? (
                    <Badge
                      label={t('Zoekt vervanger')}
                      color={tennisColors.warningFill}
                    />
                  ) : null}
                  {/* Zolang de trainer niet beslist heeft, is dát het enige wat er over deze
                      les te zeggen valt — vandaar vóór de betaalwijze. */}
                  {isAwaitingApproval(booking) ? (
                    <Badge
                      label={BOOKING_STATUS_LABELS.pending}
                      color={tennisColors.warningFill}
                    />
                  ) : null}
                  <Badge label={paymentLabel} color={payment.color} subtle={payment.subtle} />
                </View>
              </Card>
            </View>
          );
        })}
      </View>

      <BookingDetailSheet
        booking={openBooking}
        visible={openBooking !== null}
        canManage={isCoach(currentUser) && kijktNaarZichzelf}
        onClose={() => {
          clearError();
          setOpenBooking(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  muted: { ...typography.body, color: tennisColors.textMuted },
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
