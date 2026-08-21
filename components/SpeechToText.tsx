import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useT } from '../lib/i18n';
import { tennisColors } from '../constants/tennis-colors';

export function SpeechToText(props: { onText?: (text: string) => void }): JSX.Element {
  const t = useT();
  // onText is reserved for the native mobile implementation and unused here.
  void props.onText;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('Spraak-naar-tekst — binnenkort (alleen mobiele app)')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.background,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  label: {
    color: tennisColors.textMuted,
    fontSize: 14,
  },
});
