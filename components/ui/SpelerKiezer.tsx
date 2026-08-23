// De rij namen bovenaan het scherm van een ouder: hijzelf en zijn kinderen. Dezelfde chips
// als de trainerfilter, want het is dezelfde handeling — aanwijzen waar dit scherm over gaat.
//
// Hijzelf staat erbij en niet alleen zijn kinderen: een ouder die zijn kind brengt en zelf
// een uur boekt, is geen uitzondering. Zie providers/kindkeuze.
//
// De kiezer tekent zichzelf niet als er niets te kiezen valt — geen ouder, of een ouder
// zonder kinderen. Eén knop die al ingedrukt staat, vraagt om een beslissing die er niet is.

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
  const { keuzes, speler, viaOuder, kies } = useKindkeuze();
  const { currentUser } = useSimpleData();

  if (!viaOuder || keuzes.length < 2) return null;

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
