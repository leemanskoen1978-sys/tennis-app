import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Button } from './ui/Button';
import { DetailSheet } from './ui/DetailSheet';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { useT } from '../lib/i18n';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, radius } from '../constants/theme';

/** Een les aan een speler hangen: nieuw aanmaken, of er een uit de gedeelde bibliotheek kiezen. */
export function AssignLessonModal({ visible, onClose, playerId }: {
  visible: boolean;
  onClose: () => void;
  playerId: string;
}) {
  const t = useT();
  const { currentUser, users, lessons, addLesson, updateLesson } = useSimpleData();
  const ownerName = (uid?: string) => users.find((u) => u.id === uid)?.name ?? t('Onbekend');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');

  // The whole library, not just your own material: coaches share what they make. The
  // !student_id check stays — that hides lessons already assigned to a player.
  const library = lessons.filter((l) => !l.student_id);

  const assign = (lessonId: string) => updateLesson(lessonId, { student_id: playerId, status: 'gepland' });

  const create = async () => {
    if (!currentUser || !title.trim()) return;
    await addLesson({
      title: title.trim(),
      url: url.trim() || undefined,
      uploaded_by: currentUser.id,
      coach_id: currentUser.id,
      student_id: playerId,
      status: 'gepland',
    });
    setTitle(''); setUrl('');
    onClose();
  };

  return (
    <DetailSheet title={t('Les toewijzen')} visible={visible} onClose={onClose}>
      <Text style={styles.label}>{t('Nieuwe les')}</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder={t('Titel')} placeholderTextColor={tennisColors.textMuted} />
      <TextInput style={styles.input} value={url} onChangeText={setUrl} placeholder={t('Video-URL (optioneel)')} placeholderTextColor={tennisColors.textMuted} autoCapitalize="none" />
      <Button label={t('Aanmaken & toewijzen')} variant="primary" onPress={create} disabled={!title.trim()} />

      {library.length > 0 ? (
        <>
          <Text style={[styles.label, { marginTop: spacing.lg }]}>{t('Uit bibliotheek')}</Text>
          {library.map((l) => (
            <View key={l.id} style={styles.libRow}>
              <View style={styles.libTitleWrap}>
                <Text style={styles.libTitle} numberOfLines={1}>{l.title}</Text>
                <Text style={styles.libOwner}>van {ownerName(l.coach_id ?? l.uploaded_by)}</Text>
              </View>
              <Button label={t('Toewijzen')} variant="secondary" fullWidth={false} onPress={() => { assign(l.id); onClose(); }} />
            </View>
          ))}
        </>
      ) : null}
    </DetailSheet>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: tennisColors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: tennisColors.text,
    backgroundColor: tennisColors.surface, marginBottom: spacing.sm,
  },
  libRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: tennisColors.border },
  libTitleWrap: { flex: 1 },
  libTitle: { fontSize: 14, color: tennisColors.text },
  libOwner: { fontSize: 12, color: tennisColors.textMuted, marginTop: 1 },
});
