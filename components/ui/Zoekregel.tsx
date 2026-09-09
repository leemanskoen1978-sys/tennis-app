// Eén zoekregel: het invoerveld met het vergrootglas en het kruisje om te wissen.
//
// Staat hier en niet in het scherm dat hem toevallig als eerste nodig had: zoeken hoort er
// overal hetzelfde uit te zien, net zoals het zich overal hetzelfde hoort te gedragen (zie
// lib/zoeken). Dezelfde vorm als de zoekregel van de lesmateriaaldatabank.

import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Search } from 'lucide-react-native';

import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { minTapTarget, radius, spacing, webCursor } from '../../constants/theme';

export function Zoekregel({ waarde, onChange, plaatshouder }: {
  waarde: string;
  onChange: (tekst: string) => void;
  plaatshouder: string;
}): React.JSX.Element {
  const t = useT();
  return (
    <View style={styles.rij}>
      <Search size={18} color={tennisColors.textMuted} />
      <TextInput
        style={styles.veld}
        value={waarde}
        onChangeText={onChange}
        placeholder={plaatshouder}
        placeholderTextColor={tennisColors.textMuted}
        autoCapitalize="none"
        accessibilityLabel={plaatshouder}
      />
      {waarde.length > 0 ? (
        <Text
          style={styles.wis}
          accessibilityRole="button"
          accessibilityLabel={t('Zoekterm wissen')}
          onPress={() => onChange('')}
        >
          ×
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: tennisColors.surface,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    minHeight: minTapTarget,
    marginTop: spacing.xs,
  },
  veld: { flex: 1, fontSize: 15, color: tennisColors.text, paddingVertical: spacing.sm },
  wis: { ...webCursor, paddingHorizontal: spacing.xs, fontSize: 18, color: tennisColors.textMuted },
});
