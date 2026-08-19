import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tennisColors } from '../constants/tennis-colors';

export function SpeechToText(props: { onText?: (text: string) => void }): JSX.Element {
  // onText is reserved for the native mobile implementation and unused here.
  void props.onText;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Spraak-naar-tekst — binnenkort (alleen mobiele app)</Text>
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
