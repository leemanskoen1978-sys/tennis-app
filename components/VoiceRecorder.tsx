import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Mic, Square, Trash2, Play } from 'lucide-react-native';
import { useOpname } from './useOpname';
import { memoDuur } from '../lib/memo';
import { useT } from '../lib/i18n';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, radius, webCursor } from '../constants/theme';

/**
 * Voice memo.
 * - Web: records via the browser MediaRecorder API and stores a base64 data URL
 *   (so it plays back and survives a reload in the mock store).
 * - Native (iOS/Android): placeholder for now. The native path is expo-av
 *   (Audio.Recording) + microphone permission — see docs/voice-memo-native.md.
 *
 * onRecorded receives the recorded audio URI (data URL on web); onClear removes it.
 */
export function VoiceRecorder({
  value,
  onRecorded,
  onClear,
}: {
  value?: string;
  onRecorded?: (uri: string) => void;
  onClear?: () => void;
}) {
  const t = useT();
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.placeholder}>
        <Mic size={20} color={tennisColors.textMuted} />
        <Text style={styles.placeholderText}>{t('Spraakopname — binnenkort (mobiele app)')}</Text>
      </View>
    );
  }
  return <WebVoiceRecorder value={value} onRecorded={onRecorded} onClear={onClear} />;
}

function WebVoiceRecorder({
  value, onRecorded, onClear,
}: { value?: string; onRecorded?: (uri: string) => void; onClear?: () => void }) {
  const t = useT();
  // Geen bovengrens hier: dit blad kende die nooit, en een blad waar je rustig bij zit is
  // niet dezelfde plek als een knop op een baan.
  const opname = useOpname((dataUrl) => onRecorded?.(dataUrl));
  const mmss = memoDuur(opname.ms);

  return (
    <View style={styles.box}>
      {opname.bezig ? (
        <Pressable onPress={opname.stop} style={[styles.btn, styles.stopBtn, webCursor]} accessibilityRole="button" accessibilityLabel={t('Stop opname')}>
          <Square size={18} color={tennisColors.onFill} />
          <Text style={styles.btnTextLight}>{t('Stop')} • {mmss}</Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => { void opname.start(); }} style={[styles.btn, styles.recBtn, webCursor]} accessibilityRole="button" accessibilityLabel={t('Start opname')}>
          <Mic size={18} color={tennisColors.onFill} />
          <Text style={styles.btnTextLight}>{value ? t('Opnieuw opnemen') : t('Opnemen')}</Text>
        </Pressable>
      )}

      {value && !opname.bezig ? (
        <>
          {/* Native <audio> element (web only). */}
          {React.createElement('audio', { src: value, controls: true, style: { height: 32 } })}
          <Pressable onPress={() => onClear?.()} style={[styles.iconBtn, webCursor]} accessibilityRole="button" accessibilityLabel={t('Verwijder opname')}>
            <Trash2 size={18} color={tennisColors.danger} />
          </Pressable>
        </>
      ) : null}

      {value && !opname.bezig ? null : (
        <View style={styles.hintWrap}><Play size={14} color={tennisColors.textMuted} /><Text style={styles.hint}>{t('Neem een korte memo op')}</Text></View>
      )}

      {opname.fout ? <Text style={styles.error}>{opname.fout}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.md },
  recBtn: { backgroundColor: tennisColors.primaryFill },
  stopBtn: { backgroundColor: tennisColors.danger },
  btnTextLight: { color: tennisColors.onFill, fontWeight: '700', fontSize: 14 },
  iconBtn: { padding: 8 },
  hintWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hint: { color: tennisColors.textMuted, fontSize: 12 },
  error: { color: tennisColors.danger, fontSize: 12, width: '100%' },
  placeholder: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderStyle: 'dashed', borderColor: tennisColors.border,
    backgroundColor: tennisColors.background, borderRadius: radius.sm,
    paddingVertical: 16, paddingHorizontal: 16,
  },
  placeholderText: { color: tennisColors.textMuted, fontSize: 14, flexShrink: 1 },
});
