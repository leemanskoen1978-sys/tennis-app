// De rij namen bovenaan: jijzelf en je kinderen. Dezelfde chips als de trainerfilter, want
// het is dezelfde handeling — aanwijzen waar dit scherm over gaat.
//
// Jijzelf staat erbij en niet alleen je kinderen: de mama die haar dochter brengt en daarna
// zelf een uur speelt, is de normale situatie. Zie providers/kindkeuze.
//
// De kiezer tekent zichzelf niet als er niets te kiezen valt — wie geen kinderen aan de club
// heeft, ziet hem nooit. Eén knop die al ingedrukt staat, vraagt om een beslissing die er
// niet is.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Chip } from './Chip';
import { useKindkeuze } from '../../providers/kindkeuze';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

export function SpelerKiezer(): React.JSX.Element | null {
  const t = useT();
  const { keuzes, speler, kies } = useKindkeuze();
  const { currentUser } = useSimpleData();

  if (keuzes.length < 2) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('Voor wie')}</Text>
      <View style={styles.chipRow}>
        {keuzes.map((wie) => (
          <Chip
            key={wie.id}
            // Je eigen naam op een knop lezen is raar; "Ikzelf" zegt hetzelfde en leest
            // als een keuze.
            label={wie.id === currentUser?.id ? t('Ikzelf') : wie.name}
            selected={speler?.id === wie.id}
            onPress={() => kies(wie.id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: {
    ...typography.label,
    color: tennisColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
