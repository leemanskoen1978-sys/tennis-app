// De rij trainers waarop je een lijst lessen filtert. Dezelfde chips als op het
// boekingsscherm: één manier om een trainer aan te wijzen, anders leert iedereen twee.
// "Alle trainers" staat er voor beide rollen bij — een speler kijkt zo naar de agenda's van
// alle trainers samen, een trainer zet zijn eigen filter even opzij.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Chip } from './Chip';
import type { User } from '../../lib/types';
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

export function CoachFilter({
  coaches,
  value,
  onChange,
}: {
  coaches: User[];
  /** De gekozen trainer, of null voor "Alle trainers". */
  value: string | null;
  onChange: (coachId: string | null) => void;
}): React.JSX.Element {
  const t = useT();
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('Trainer')}</Text>
      <View style={styles.chipRow}>
        <Chip label={t('Alle trainers')} selected={value === null} onPress={() => onChange(null)} />
        {coaches.map((coach) => (
          <Chip
            key={coach.id}
            label={coach.name}
            selected={value === coach.id}
            onPress={() => onChange(coach.id)}
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
