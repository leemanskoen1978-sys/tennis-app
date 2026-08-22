// De rij kinderen bovenaan het scherm van een ouder. Dezelfde chips als de trainerfilter,
// want het is dezelfde handeling: aanwijzen waar dit scherm over gaat.
//
// Hij tekent zichzelf niet als er niets te kiezen valt: geen ouder, of één kind. Een kiezer
// met één knop die al ingedrukt staat, vraagt om een beslissing die er niet is.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Chip } from './Chip';
import { useKindkeuze } from '../../providers/kindkeuze';
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

export function KindKiezer(): React.JSX.Element | null {
  const t = useT();
  const { kinderen, speler, viaOuder, kies } = useKindkeuze();

  if (!viaOuder || kinderen.length < 2) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('Kind')}</Text>
      <View style={styles.chipRow}>
        {kinderen.map((kind) => (
          <Chip
            key={kind.id}
            label={kind.name}
            selected={speler?.id === kind.id}
            onPress={() => kies(kind.id)}
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
