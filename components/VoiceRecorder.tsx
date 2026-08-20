import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Mic, Square, Trash2, Play } from 'lucide-react-native';
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
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.placeholder}>
        <Mic size={20} color={tennisColors.textMuted} />
        <Text style={styles.placeholderText}>Spraakopname — binnenkort (mobiele app)</Text>
      </View>
    );
  }
  return <WebVoiceRecorder value={value} onRecorded={onRecorded} onClear={onClear} />;
}

function WebVoiceRecorder({
  value, onRecorded, onClear,
}: { value?: string; onRecorded?: (uri: string) => void; onClear?: () => void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
  }, []);

  const start = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => { if (typeof reader.result === 'string') onRecorded?.(reader.result); };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setErrorMsg('Microfoon niet beschikbaar of geweigerd.');
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <View style={styles.box}>
      {recording ? (
        <Pressable onPress={stop} style={[styles.btn, styles.stopBtn, webCursor]} accessibilityRole="button" accessibilityLabel="Stop opname">
          <Square size={18} color={tennisColors.onFill} />
          <Text style={styles.btnTextLight}>Stop • {mmss}</Text>
        </Pressable>
      ) : (
        <Pressable onPress={start} style={[styles.btn, styles.recBtn, webCursor]} accessibilityRole="button" accessibilityLabel="Start opname">
          <Mic size={18} color={tennisColors.onFill} />
          <Text style={styles.btnTextLight}>{value ? 'Opnieuw opnemen' : 'Opnemen'}</Text>
        </Pressable>
      )}

      {value && !recording ? (
        <>
          {/* Native <audio> element (web only). */}
          {React.createElement('audio', { src: value, controls: true, style: { height: 32 } })}
          <Pressable onPress={() => onClear?.()} style={[styles.iconBtn, webCursor]} accessibilityRole="button" accessibilityLabel="Verwijder opname">
            <Trash2 size={18} color={tennisColors.danger} />
          </Pressable>
        </>
      ) : null}

      {value && !recording ? null : (
        <View style={styles.hintWrap}><Play size={14} color={tennisColors.textMuted} /><Text style={styles.hint}>Neem een korte memo op</Text></View>
      )}

      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
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
