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
import { GroepStip } from '../ui/GroepStip';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { lesdagVanSpeler } from '../../lib/lesdag';
import { bookingPaymentMeta } from '../../lib/payments';
import { formatDayTimeRange } from '../../lib/datetime';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';
import { useT } from '../../lib/i18n';

export function Lesdagspeler({ spelerId }: { spelerId: string }): React.JSX.Element | null {
  const t = useT();
  const { bookings, users, courts, lesGroepen } = useSimpleData();

  // Eén moment voor het hele blok: anders zou de ene les op een andere "nu" beoordeeld
  // worden dan de volgende.
  const dag = useMemo(
    () => lesdagVanSpeler(bookings, spelerId, new Date()),
    [bookings, spelerId],
  );

  const naamVan = (id: string): string => users.find((u) => u.id === id)?.name ?? t('Onbekend');
  const baanVan = (id: string): string => courts.find((c) => c.id === id)?.name ?? t('Onbekend');
  /**
   * De groep waar deze les bij hoort. Een les die los van een groep bestaat heeft er geen;
   * dan staat er niets.
   *
   * De groep en niet de les: het niveau is een blijvende eigenschap van de ploeg en staat
   * daarom op `LesGroep`, niet op elke boeking apart. Zie lib/types.
   */
  const groepVan = (groupId?: string) =>
    (groupId ? lesGroepen.find((g) => g.id === groupId) ?? null : null);

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
              {/* De datum staat er ook bij een les van vandaag. Hij stond er eerst niet —
                  de kop zegt immers "Vandaag" — maar dan las je op het scherm alleen
                  "09:00–10:00" en moest je de kop erboven erbij houden om te weten wélke
                  dag dat is. Eén regel die zichzelf uitlegt is dat woord dubbel waard. */}
              {formatDayTimeRange(b.start_time, b.end_time)}
              {' · '}
              {/* Je eigen naam hoef je niet te lezen: een speler ziet zijn trainer. */}
              {naamVan(b.coach_id)}
            </Text>
            <Text style={styles.baan}>{baanVan(b.court_id)}</Text>
            {/* Bij welke groep hij hoort, met de kleur ervoor. Onder de baan: eerst waar en
                bij wie, dan met welke ploeg. */}
            <GroepStip
              niveau={groepVan(b.group_id)?.level}
              naam={groepVan(b.group_id)?.name}
            />
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
