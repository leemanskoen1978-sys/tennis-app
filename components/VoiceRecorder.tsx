import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Mic } from 'lucide-react-native';
import { tennisColors } from '../constants/tennis-colors';

export function VoiceRecorder(props: { onRecorded?: (uri: string) => void }): JSX.Element {
  // onRecorded is reserved for the native mobile implementation and unused here.
  void props.onRecorded;

  return (
    <View style={styles.container}>
      <Mic size={20} color={tennisColors.textMuted} />
      <Text style={styles.label}>Spraakopname — binnenkort (alleen mobiele app)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    flexShrink: 1,
  },
});
