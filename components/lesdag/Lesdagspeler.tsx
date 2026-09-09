// De lesdag van een speler: wat hij ziet als hij de app opent.
//
// Zijn tegenhanger `Lesdag.tsx` is gemaakt voor een trainer op de baan — namen, memoknoppen,
// afvinken. Daar heeft een speler niets aan: hij wil weten hoe laat, bij wie en op welke
// baan. Vandaar een eigen, korter blok in plaats van een tweede stand in hetzelfde bestand.
//
// Welke lessen dat zijn rekent lib/lesdag uit (`lesdagVanSpeler`); dit bestand tekent alleen.
// Staat er vandaag niets, dan komt daar zijn eerstvolgende les uit — en dan zegt de kop dat
// ook, want "Vandaag" boven een les van volgende week is een leugen.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { lesdagVanSpeler } from '../../lib/lesdag';
import { bookingPaymentMeta } from '../../lib/payments';
import { formatTimeRange, formatDayTimeRange } from '../../lib/datetime';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';
import { useT } from '../../lib/i18n';

export function Lesdagspeler({ spelerId }: { spelerId: string }): React.JSX.Element | null {
  const t = useT();
  const { bookings, users, courts } = useSimpleData();

  // Eén moment voor het hele blok: anders zou de ene les op een andere "nu" beoordeeld
  // worden dan de volgende.
  const dag = useMemo(
    () => lesdagVanSpeler(bookings, spelerId, new Date()),
    [bookings, spelerId],
  );

  const naamVan = (id: string): string => users.find((u) => u.id === id)?.name ?? t('Onbekend');
  const baanVan = (id: string): string => courts.find((c) => c.id === id)?.name ?? t('Onbekend');

  // Niets vandaag en niets in het vooruitzicht: dan hoort er ook geen kop te staan. Een lege
  // sectie op het hoofdscherm suggereert dat er iets stuk is.
  if (dag.vandaag.length === 0 && dag.volgende === null) return null;

  const vandaag = dag.vandaag.length > 0;
  const lessen = vandaag ? dag.vandaag : (dag.volgende ? [dag.volgende] : []);

  return (
    <View style={styles.blok}>
      <Text style={styles.kop}>{vandaag ? t('Vandaag') : t('Je volgende les')}</Text>
      {lessen.map((b) => {
        const betaling = bookingPaymentMeta(b);
        return (
          <Card key={b.id} style={styles.les}>
            <Text style={styles.tijd}>
              {/* Bij een les van vandaag is de dag overbodig; bij de volgende les is hij
                  juist het enige wat telt. */}
              {vandaag
                ? formatTimeRange(b.start_time, b.end_time)
                : formatDayTimeRange(b.start_time, b.end_time)}
              {' · '}
              {/* Je eigen naam hoef je niet te lezen: een speler ziet zijn trainer. */}
              {naamVan(b.coach_id)}
            </Text>
            <Text style={styles.baan}>{baanVan(b.court_id)}</Text>
            <Badge label={betaling.label} color={betaling.color} subtle={betaling.subtle} />
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  blok: { gap: spacing.sm },
  kop: {
    ...typography.label, color: tennisColors.textMuted,
    textTransform: 'uppercase', fontWeight: '700',
  },
  les: { gap: spacing.xs },
  tijd: { ...typography.h3, color: tennisColors.text },
  baan: { ...typography.label, color: tennisColors.textMuted },
});
