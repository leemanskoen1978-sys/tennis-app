import React, { useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { FileText, Paperclip, Trash2 } from 'lucide-react-native';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, radius, webCursor } from '../constants/theme';
import type { LessonAttachment } from '../lib/types';

/**
 * PDF attachments on a lesson.
 * - Web: pick a file with the browser file input and store it as a base64 data URL
 *   (survives a reload in the mock store, same trick as the voice memo).
 * - Native (iOS/Android): placeholder for now — the native path is expo-document-picker.
 *
 * Later the files move to Google Drive: an attachment then gets source 'drive',
 * a drive_file_id and a webViewLink as uri, and nothing else in the UI changes.
 * See docs/lesson-attachments.md.
 */

/** Browser localStorage is ~5MB total and base64 adds ~33%, so keep single files small. */
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function newAttachmentId(): string {
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Opens an attachment: a Drive link directly, a local data URL via a blob tab on web. */
export function openAttachment(att: LessonAttachment): void {
  if (att.source === 'drive' || !att.uri.startsWith('data:')) {
    void Linking.openURL(att.uri);
    return;
  }
  if (Platform.OS !== 'web') {
    void Linking.openURL(att.uri);
    return;
  }
  // Browsers block navigating to a data: URL, so hand over a blob URL instead.
  const [meta, base64] = att.uri.split(',');
  const mime = meta.slice(meta.indexOf(':') + 1, meta.indexOf(';'));
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime || att.mime }));
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Read-only list — used in the lesson details view. */
export function AttachmentList({ attachments }: { attachments?: LessonAttachment[] }) {
  if (!attachments || attachments.length === 0) {
    return <Text style={styles.muted}>Geen PDF-bijlagen.</Text>;
  }
  return (
    <View style={styles.list}>
      {attachments.map((att) => (
        <Pressable
          key={att.id}
          onPress={() => openAttachment(att)}
          style={[styles.item, webCursor]}
          accessibilityRole="button"
          accessibilityLabel={`Open ${att.name}`}
        >
          <FileText size={18} color={tennisColors.primary} />
          <View style={styles.itemBody}>
            <Text style={styles.itemName} numberOfLines={1}>{att.name}</Text>
            <Text style={styles.itemMeta}>
              {formatBytes(att.size)}{att.source === 'drive' ? ' • Google Drive' : ''}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

/** Editable picker + list — used in the add form and when editing a lesson. */
export function LessonAttachments({
  attachments,
  onChange,
}: {
  attachments: LessonAttachment[];
  onChange: (next: LessonAttachment[]) => void;
}) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const remove = (id: string) => onChange(attachments.filter((a) => a.id !== id));

  const pick = () => {
    setErrorMsg(null);
    inputRef.current?.click();
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const chosen = Array.from(files);
    chosen.forEach((file) => {
      if (file.type !== 'application/pdf') {
        setErrorMsg('Alleen PDF-bestanden kunnen worden geüpload.');
        return;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setErrorMsg(`"${file.name}" is te groot (max ${formatBytes(MAX_ATTACHMENT_BYTES)}).`);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result !== 'string') return;
        onChange([
          ...attachments,
          {
            id: newAttachmentId(),
            name: file.name,
            mime: 'application/pdf',
            size: file.size,
            source: 'local',
            uri: reader.result,
          },
        ]);
      };
      reader.onerror = () => setErrorMsg(`"${file.name}" kon niet worden gelezen.`);
      reader.readAsDataURL(file);
    });
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <View style={styles.box}>
      {attachments.length > 0 ? (
        <View style={styles.list}>
          {attachments.map((att) => (
            <View key={att.id} style={styles.item}>
              <FileText size={18} color={tennisColors.primary} />
              <Pressable
                onPress={() => openAttachment(att)}
                style={[styles.itemBody, webCursor]}
                accessibilityRole="button"
                accessibilityLabel={`Open ${att.name}`}
              >
                <Text style={styles.itemName} numberOfLines={1}>{att.name}</Text>
                <Text style={styles.itemMeta}>
                  {formatBytes(att.size)}{att.source === 'drive' ? ' • Google Drive' : ''}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => remove(att.id)}
                style={[styles.iconBtn, webCursor]}
                accessibilityRole="button"
                accessibilityLabel={`Verwijder ${att.name}`}
              >
                <Trash2 size={18} color={tennisColors.danger} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {Platform.OS === 'web' ? (
        <>
          <Pressable
            onPress={pick}
            style={[styles.pickBtn, webCursor]}
            accessibilityRole="button"
            accessibilityLabel="PDF uploaden"
          >
            <Paperclip size={18} color={tennisColors.primary} />
            <Text style={styles.pickText}>PDF uploaden</Text>
          </Pressable>
          {/* Hidden native file input (web only). */}
          {React.createElement('input', {
            ref: inputRef,
            type: 'file',
            accept: 'application/pdf',
            multiple: true,
            style: { display: 'none' },
            onChange: (e: { target: { files: FileList | null } }) => handleFiles(e.target.files),
          })}
          <Text style={styles.hint}>Max {formatBytes(MAX_ATTACHMENT_BYTES)} per bestand.</Text>
        </>
      ) : (
        <View style={styles.placeholder}>
          <Paperclip size={20} color={tennisColors.textMuted} />
          <Text style={styles.placeholderText}>PDF uploaden — binnenkort (mobiele app)</Text>
        </View>
      )}

      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm },
  list: { gap: spacing.sm },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.sm,
    backgroundColor: tennisColors.background, paddingHorizontal: 12, paddingVertical: 10,
  },
  itemBody: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: tennisColors.text },
  itemMeta: { fontSize: 12, color: tennisColors.textMuted, marginTop: 2 },
  iconBtn: { padding: 4 },
  pickBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8,
    borderWidth: 1, borderStyle: 'dashed', borderColor: tennisColors.primary,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 10,
  },
  pickText: { color: tennisColors.primary, fontWeight: '700', fontSize: 14 },
  hint: { color: tennisColors.textMuted, fontSize: 12 },
  muted: { fontSize: 14, color: tennisColors.textMuted, marginVertical: spacing.sm },
  error: { color: tennisColors.danger, fontSize: 12 },
  placeholder: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderStyle: 'dashed', borderColor: tennisColors.border,
    backgroundColor: tennisColors.background, borderRadius: radius.sm,
    paddingVertical: 16, paddingHorizontal: 16,
  },
  placeholderText: { color: tennisColors.textMuted, fontSize: 14, flexShrink: 1 },
});
