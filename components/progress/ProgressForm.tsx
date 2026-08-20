import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Star, X } from 'lucide-react-native';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { StudentCombobox } from '../ui/StudentCombobox';
import { UserManagement } from '../UserManagement';
import { VoiceRecorder } from '../VoiceRecorder';
import { AudioMemo, Stars, TRAINING_TYPES, TRAINING_LABELS, formatDate } from './ProgressViews';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, typography, shadow, webCursor, contentMaxWidth } from '../../constants/theme';
import type { StudentProgress, TrainingType } from '../../lib/types';

const RATINGS = [1, 2, 3, 4, 5] as const;

/**
 * Voortgang noteren én rechtzetten. Eén blad voor allebei: het zijn dezelfde velden, en
 * een tweede blad ernaast zou bij elke wijziging aan het formulier uit de pas gaan lopen.
 * Zonder `entry` is dit een nieuwe notitie, met `entry` bewerk je die ene.
 *
 * Staat in een blad en niet op het dossier zelf: een trainer vult dit hooguit na een les
 * in, terwijl hij het dossier de rest van de tijd leest.
 *
 * De speler komt van buiten mee (vanuit zijn dossier is die keuze al gemaakt) óf wordt
 * bovenin het blad gekozen. Dat tweede is er voor het Spelers-scherm: daar wil een trainer
 * na zijn lesdag een notitie kwijt zonder eerst het juiste dossier op te zoeken.
 */
export function ProgressForm({ visible, onClose, studentId, entry = null, canEdit = true }: {
  visible: boolean;
  onClose: () => void;
  /** De speler waarover het gaat. Ontbreekt hij, dan kiest het blad zelf een speler. */
  studentId?: string;
  /** De notitie die bewerkt wordt; `null` betekent een nieuwe. */
  entry?: StudentProgress | null;
  /** Alleen een trainer wijzigt of verwijdert; een speler mag wel lezen wat er staat. */
  canEdit?: boolean;
}) {
  const { currentUser, users, lessons, addProgress, updateProgress, deleteProgress } = useSimpleData();

  // De speler die in het blad gekozen wordt. Alleen in beeld als er van buiten geen speler
  // meekwam; anders blijft dit ongebruikt en staat het blad er precies zo bij als voorheen.
  const [pickedId, setPickedId] = useState<string | null>(entry?.student_id ?? null);
  // De getypte naam van een nog onbekende speler; is die er, dan staat het invulscherm open.
  const [newPlayerName, setNewPlayerName] = useState<string | null>(null);

  const [type, setType] = useState<TrainingType>(entry?.training_type ?? 'techniek');
  const [rating, setRating] = useState(entry?.rating ?? 0);
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [homework, setHomework] = useState(entry?.homework ?? '');
  const [voiceUri, setVoiceUri] = useState<string | undefined>(entry?.voice_memo_uri);
  const [linkLessonId, setLinkLessonId] = useState<string | null>(entry?.lesson_id ?? null);
  // Verwijderen is onomkeerbaar, dus het gebeurt nooit met één tik: eerst deze vraag.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Een blad dat opengaat begint bij wat er is opgeslagen. Zonder dit zou een tweede
  // notitie de velden van de eerste tonen, en een nieuwe notitie die van de vorige.
  useEffect(() => {
    if (!visible) return;
    setType(entry?.training_type ?? 'techniek');
    setRating(entry?.rating ?? 0);
    setNotes(entry?.notes ?? '');
    setHomework(entry?.homework ?? '');
    setVoiceUri(entry?.voice_memo_uri);
    setLinkLessonId(entry?.lesson_id ?? null);
    setConfirmingDelete(false);
    setPickedId(entry?.student_id ?? null);
    setNewPlayerName(null);
  }, [visible, entry?.id]);

  // Wie de notitie krijgt: van buiten meegegeven, anders wat er in het blad gekozen is.
  const targetId = studentId ?? pickedId;
  const players = users.filter((u) => u.role !== 'coach');
  const playerLessons = targetId ? lessons.filter((l) => l.student_id === targetId) : [];

  /** Wat er in de velden staat, in de vorm waarin het bewaard wordt. */
  const fields = () => ({
    training_type: type,
    rating: rating > 0 ? rating : undefined,
    notes: notes.trim() || undefined,
    homework: homework.trim() || undefined,
    voice_memo_uri: voiceUri,
    lesson_id: linkLessonId ?? undefined,
  });

  const persist = async (): Promise<void> => {
    // `created_at` gaat niet mee: een rechtgezette notitie hoort op zijn eigen datum
    // te blijven staan, anders springt hij bij elke correctie bovenaan het dossier.
    if (!targetId) return;
    if (entry) {
      await updateProgress(entry.id, fields());
      return;
    }
    if (!currentUser) return;
    await addProgress({ ...fields(), student_id: targetId, coach_id: currentUser.id });
  };

  const save = async (): Promise<void> => {
    await persist();
    onClose();
  };

  /**
   * Sluiten bewaart wat er getypt is. Op een telefoon sluit je het blad met de kruisknop
   * of met de terugknop terwijl de cursor nog in het notitieveld staat; zonder dit zou die
   * correctie weg zijn. Alleen bij bewerken: een nieuwe notitie die je wegklikt hoort niet
   * alsnog te verschijnen, daar is de knop Opslaan voor.
   */
  const closeAndSave = (): void => {
    if (entry && canEdit) {
      void persist();
    }
    onClose();
  };

  const title = entry ? 'Voortgang bewerken' : 'Nieuwe voortgang';
  const lessonTitle = entry?.lesson_id
    ? lessons.find((l) => l.id === entry.lesson_id)?.title
    : undefined;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeAndSave}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{canEdit ? title : 'Voortgang'}</Text>
            <Pressable onPress={closeAndSave} style={webCursor} accessibilityRole="button" accessibilityLabel="Sluiten">
              <X size={22} color={tennisColors.textMuted} />
            </Pressable>
          </View>

          {/* Een speler leest zijn dossier; wijzigen doet de trainer. Dezelfde regel als
              bij de doelen, waar het blad ook opengaat maar de velden dichtblijven. */}
          {!canEdit && entry ? (
            <ScrollView contentContainerStyle={styles.sheetBody}>
              <Text style={styles.readType}>{TRAINING_LABELS[entry.training_type]}</Text>
              <Stars count={entry.rating ?? 0} />
              {entry.created_at ? <Text style={styles.readMuted}>{formatDate(entry.created_at)}</Text> : null}
              {lessonTitle ? <Text style={styles.readMuted}>Les: {lessonTitle}</Text> : null}
              {entry.notes ? (
                <>
                  <Text style={styles.label}>Notities</Text>
                  <Text style={styles.readValue}>{entry.notes}</Text>
                </>
              ) : null}
              {entry.homework ? (
                <>
                  <Text style={styles.label}>Huiswerk</Text>
                  <Text style={styles.readValue}>{entry.homework}</Text>
                </>
              ) : null}
              {entry.voice_memo_uri ? (
                <>
                  <Text style={styles.label}>Spraakmemo</Text>
                  <AudioMemo uri={entry.voice_memo_uri} />
                </>
              ) : null}
            </ScrollView>
          ) : (
            <>
              <ScrollView contentContainerStyle={styles.sheetBody}>
                {/* Alleen als de speler nog niet vastligt. Vanuit een dossier is die keuze al
                    gemaakt en zou een keuzeveld alleen maar uitnodigen om hem te verzetten. */}
                {studentId === undefined ? (
                  <>
                    <Text style={styles.label}>Speler</Text>
                    <StudentCombobox
                      students={players}
                      value={pickedId}
                      onChange={(id) => {
                        setPickedId(id);
                        // Een les van de vorige speler hoort niet aan deze notitie te blijven hangen.
                        setLinkLessonId(null);
                      }}
                      placeholder="Typ de naam van de speler…"
                      onRequestCreate={setNewPlayerName}
                    />
                  </>
                ) : null}

                <Text style={styles.label}>Type training</Text>
                <View style={styles.chipRow}>
                  {TRAINING_TYPES.map((t) => (
                    <Chip key={t} label={TRAINING_LABELS[t]} selected={t === type} onPress={() => setType(t)} />
                  ))}
                </View>

                <Text style={styles.label}>Beoordeling</Text>
                <View style={styles.starRow}>
                  {RATINGS.map((r) => {
                    const active = r <= rating;
                    return (
                      <Pressable key={r} onPress={() => setRating(r === rating ? 0 : r)} style={styles.star} accessibilityRole="button" accessibilityLabel={`${r} sterren`}>
                        <Star size={28} fill={active ? tennisColors.warning : 'transparent'} color={active ? tennisColors.warning : tennisColors.border} />
                      </Pressable>
                    );
                  })}
                </View>

                {playerLessons.length > 0 ? (
                  <>
                    <Text style={styles.label}>Koppel aan les (optioneel)</Text>
                    <View style={styles.chipRow}>
                      <Chip label="Geen" selected={linkLessonId === null} onPress={() => setLinkLessonId(null)} />
                      {playerLessons.map((l) => (
                        <Chip key={l.id} label={l.title} selected={linkLessonId === l.id} onPress={() => setLinkLessonId(l.id)} />
                      ))}
                    </View>
                  </>
                ) : null}

                <Text style={styles.label}>Notities</Text>
                {/* De voorbeeldtekst zegt wát er verwacht wordt; "Notities" alleen liet een
                    trainer raden of hier de les of de speler beschreven moet worden. */}
                <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} placeholder="Beschrijf waar jullie deze les aan gewerkt hebben…" placeholderTextColor={tennisColors.textMuted} accessibilityLabel="Notities" multiline />
                <Text style={styles.label}>Huiswerk</Text>
                <TextInput style={styles.input} value={homework} onChangeText={setHomework} placeholder="Huiswerk" placeholderTextColor={tennisColors.textMuted} accessibilityLabel="Huiswerk" />
                <Text style={styles.label}>Spraakmemo</Text>
                <VoiceRecorder value={voiceUri} onRecorded={setVoiceUri} onClear={() => setVoiceUri(undefined)} />

                {/* Verwijderen staat onderaan en achter een vraag: het is het einde van
                    deze notitie, niet iets wat je in het voorbijgaan aantikt. */}
                {entry ? (
                  confirmingDelete ? (
                    <View style={styles.confirmBox}>
                      <Text style={styles.confirmText}>
                        Deze voortgangsnotitie verwijderen? Dat kan niet ongedaan gemaakt worden.
                      </Text>
                      <View style={styles.confirmRow}>
                        <Button
                          label="Ja, verwijderen"
                          variant="danger"
                          fullWidth={false}
                          onPress={() => {
                            void deleteProgress(entry.id);
                            setConfirmingDelete(false);
                            onClose();
                          }}
                        />
                        <Button
                          label="Nee"
                          variant="secondary"
                          fullWidth={false}
                          onPress={() => setConfirmingDelete(false)}
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.confirmRow}>
                      <Button
                        label="Verwijderen"
                        variant="danger"
                        fullWidth={false}
                        onPress={() => setConfirmingDelete(true)}
                      />
                    </View>
                  )
                ) : null}
              </ScrollView>

              {/* De twee knoppen staan vast onderaan het blad en scrollen niet mee: bij een
                  lange notitie zocht je anders eerst de knop Opslaan terug. De linkerknop
                  moet hetzelfde doen als de kruisknop, anders staan er twee wegen naast
                  elkaar die het tegenovergestelde beloven. Bij bewerken bewaart de
                  kruisknop dus heet de knop "Sluiten", niet "Annuleren" — er valt niets te
                  annuleren. Bij een nieuwe notitie bewaart de kruisknop juist niets (zie
                  closeAndSave), dus daar klopt "Annuleren" wél en doet hij hetzelfde. */}
              <View style={styles.footer}>
                <Button
                  label={entry ? 'Sluiten' : 'Annuleren'}
                  variant="secondary"
                  fullWidth={false}
                  onPress={closeAndSave}
                  style={styles.footerBtn}
                />
                <Button
                  label="Opslaan"
                  variant="primary"
                  fullWidth={false}
                  // Zonder speler is er niets om de notitie aan te hangen.
                  disabled={!targetId}
                  onPress={() => { void save(); }}
                  style={styles.footerBtn}
                />
              </View>
            </>
          )}
        </View>
      </View>

      {/* Het volledige invulscherm voor een speler die nog niet bestaat. Zodra hij bewaard
          is, is hij ook meteen de speler van deze notitie. */}
      <UserManagement
        visible={newPlayerName !== null}
        initialName={newPlayerName ?? ''}
        onClose={() => setNewPlayerName(null)}
        onCreated={(u) => {
          setPickedId(u.id);
          setLinkLessonId(null);
          setNewPlayerName(null);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  // Zonder breedte-cap plakt een blad in een breed venster over de volle breedte, terwijl
  // de rest van de app gecentreerd op zijn maximum staat. Een blad hoort bij het scherm
  // eronder, dus het houdt dezelfde maat aan.
  sheet: {
    width: '100%',
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
    backgroundColor: tennisColors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl, maxHeight: '85%', ...shadow('lg'),
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sheetTitle: { ...typography.h2, color: tennisColors.text },
  sheetBody: { paddingBottom: spacing.lg },
  label: { fontSize: 13, fontWeight: '600', color: tennisColors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  starRow: { flexDirection: 'row', flexWrap: 'wrap' },
  star: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  input: {
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: tennisColors.text,
    backgroundColor: tennisColors.surface, marginBottom: spacing.sm,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  // De vaste rij onderaan: een lijntje erboven zodat hij niet in de velden lijkt te staan.
  footer: {
    flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: tennisColors.border,
  },
  footerBtn: { flex: 1 },
  readType: { fontSize: 15, fontWeight: '700', color: tennisColors.primaryDark },
  readMuted: { fontSize: 13, color: tennisColors.textMuted, marginTop: 2 },
  readValue: { fontSize: 14, color: tennisColors.text, lineHeight: 20 },
  confirmBox: {
    marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: tennisColors.background, borderWidth: 1, borderColor: tennisColors.border,
  },
  confirmText: { fontSize: 14, color: tennisColors.text },
  confirmRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
});
