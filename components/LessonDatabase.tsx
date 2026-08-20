// De databank: zoeken in alles wat er aan lesmateriaal is.
//
// Twee weergaven, want een trainer stelt twee verschillende vragen. "Geef me een oefening
// op de backhand" gaat over de losse oefening — dat is de startweergave, en de reden dat
// deze databank bestaat. "Welke training was dat ook alweer" gaat over de hele sessie van
// anderhalf uur; dat is de tweede weergave.
//
// Filteren gebeurt op tags, en die worden afgeleid uit de tekst (zie lib/tags): niemand
// gaat 252 oefeningen met de hand van etiketten voorzien.

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import { BookOpen, ChevronRight, Search, X } from 'lucide-react-native';

import { Card } from './ui/Card';
import { Chip } from './ui/Chip';
import { DetailSheet } from './ui/DetailSheet';
import { Button } from './ui/Button';
import { LessonDetailModal } from './LessonDetailModal';
import { formatDuration } from './LessonTraining';
import {
  availableExerciseTags, availableTags, exerciseTags, filterExercises, filterLessons,
  lessonTags, type ExerciseHit,
} from '../lib/tags';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, radius, typography, minTapTarget, webCursor } from '../constants/theme';
import type { Lesson } from '../lib/types';

type Mode = 'oefening' | 'training';

/** Een tag zoals hij op een kaart staat: alleen om te lezen, niet om op te drukken. */
export function TagPill({ label }: { label: string }): React.JSX.Element {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

/**
 * De filterbalk. Hij scrollt horizontaal: er zijn meer tags dan er op een telefoon naast
 * elkaar passen, en ze in twee of drie rijen zetten duwt de resultaten van het scherm.
 */
function TagBar({
  tags, selected, onToggle,
}: {
  tags: string[];
  selected: string[];
  onToggle: (tag: string) => void;
}): React.JSX.Element | null {
  if (tags.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tagBar}
    >
      {tags.map((tag) => (
        <Chip
          key={tag}
          label={tag}
          selected={selected.includes(tag)}
          onPress={() => onToggle(tag)}
        />
      ))}
    </ScrollView>
  );
}

/**
 * Waar een oefening over gaat, in één regel: "Basislijnspel · AANVALLEN".
 *
 * Het boekje schrijft de situatie met een kleine letter en de bedoeling in hoofdletters;
 * als kop van een kaart begint die eerste letter hier wél groot, verder blijft de tekst
 * zoals de trainer hem kent.
 */
function exerciseHeading(hit: ExerciseHit): string {
  const parts = [hit.exercise.situation, hit.exercise.purpose]
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return 'Oefening';
  const line = parts.join(' · ');
  return line.charAt(0).toUpperCase() + line.slice(1);
}

export function LessonDatabase({
  lessons, canEdit, emptyLabel = 'Nog geen lesmateriaal.',
}: {
  lessons: Lesson[];
  canEdit: boolean;
  /** Wat er staat als er niets te doorzoeken valt. Voor een speler is dat iets anders
   *  dan voor een trainer: hij kan er zelf niets aan doen. */
  emptyLabel?: string;
}): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('oefening');
  const [query, setQuery] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);

  // De les die als hele training open staat, en de losse oefening die open staat. Twee
  // aparte dingen: vanuit een oefening kun je doorklikken naar de training eromheen.
  const [openLesson, setOpenLesson] = useState<Lesson | null>(null);
  const [openHit, setOpenHit] = useState<ExerciseHit | null>(null);

  // De tags van de andere weergave zeggen niets over deze, dus ze gaan mee uit bij het
  // wisselen. Een filter dat blijft hangen op iets wat je niet meer ziet, lijkt kapot.
  const switchMode = (next: Mode): void => {
    setMode(next);
    setTags([]);
  };

  const toggleTag = (tag: string): void => {
    setTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );
  };

  // Heeft dit materiaal überhaupt oefeningen? Bij een speler staat er vaak alleen een PDF of
  // een veldsituatie klaar; dan is de keuze "Oefeningen of trainingen" een keuze tussen iets
  // en niets, en die hoort er niet te staan.
  const exerciseCount = useMemo(
    () => lessons.reduce((sum, l) => sum + (l.exercises?.length ?? 0), 0),
    [lessons],
  );
  const hasExercises = exerciseCount > 0;
  const view: Mode = hasExercises ? mode : 'training';

  const exerciseTagOptions = useMemo(() => availableExerciseTags(lessons), [lessons]);
  const lessonTagOptions = useMemo(() => availableTags(lessons), [lessons]);

  const hits = useMemo(
    () => (view === 'oefening' ? filterExercises(lessons, { query, tags }) : []),
    [view, lessons, query, tags],
  );
  const found = useMemo(
    () => (view === 'training' ? filterLessons(lessons, { query, tags }) : []),
    [view, lessons, query, tags],
  );

  const total = view === 'oefening' ? exerciseCount : lessons.length;
  const count = view === 'oefening' ? hits.length : found.length;
  const filtering = query.trim().length > 0 || tags.length > 0;
  // "3 trainingen" klopt voor het boekje van de club, maar niet voor de PDF die een speler
  // van zijn trainer kreeg. Zonder oefeningen erin heet het gewoon een les.
  const noun = view === 'oefening'
    ? (count === 1 ? 'oefening' : 'oefeningen')
    : hasExercises
      ? (count === 1 ? 'training' : 'trainingen')
      : (count === 1 ? 'les' : 'lessen');

  return (
    <View style={styles.wrap}>
      {/* Eerst de keuze wát je zoekt, dan pas waarop: anders filter je in de verkeerde lijst. */}
      {hasExercises ? (
        <View style={styles.modes}>
          <Chip
            label="Oefeningen"
            selected={view === 'oefening'}
            onPress={() => switchMode('oefening')}
          />
          <Chip
            label="Trainingen"
            selected={view === 'training'}
            onPress={() => switchMode('training')}
          />
        </View>
      ) : null}

      {/* Zoeken in niets is een knop die niets doet: bij leeg materiaal blijft alleen de
          uitleg staan. */}
      {total > 0 ? (
        <>
        <View style={styles.searchRow}>
          <Search size={18} color={tennisColors.textMuted} />
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder={view === 'oefening' ? 'Zoek een oefening…' : 'Zoek lesmateriaal…'}
            placeholderTextColor={tennisColors.textMuted}
            autoCapitalize="none"
            accessibilityLabel="Zoeken"
          />
          {query.length > 0 ? (
            <Text
              style={styles.clear}
              accessibilityRole="button"
              accessibilityLabel="Zoekterm wissen"
              onPress={() => setQuery('')}
            >
              <X size={18} color={tennisColors.textMuted} />
            </Text>
          ) : null}
        </View>

        <TagBar
          tags={view === 'oefening' ? exerciseTagOptions : lessonTagOptions}
          selected={tags}
          onToggle={toggleTag}
        />

        <View style={styles.countRow}>
          <Text style={styles.count}>
            {filtering ? `${count} van ${total} ${noun}` : `${total} ${noun}`}
          </Text>
          {filtering ? (
            <Text
              style={styles.reset}
              accessibilityRole="button"
              accessibilityLabel="Filters wissen"
              onPress={() => {
                setQuery('');
                setTags([]);
              }}
            >
              Wis filters
            </Text>
          ) : null}
        </View>
        </>
      ) : null}

      {count === 0 ? (
        <Text style={styles.empty}>
          {total === 0 ? emptyLabel : 'Niets gevonden. Probeer een andere tag of zoekterm.'}
        </Text>
      ) : null}

      {view === 'oefening'
        ? hits.map((hit) => (
            <Card
              key={`${hit.lesson.id}-${hit.exercise.nr}-${hit.exercise.description.slice(0, 12)}`}
              onPress={() => setOpenHit(hit)}
              accessibilityLabel={exerciseHeading(hit)}
            >
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{exerciseHeading(hit)}</Text>
                {hit.exercise.duration.trim().length > 0 ? (
                  <Text style={styles.duration}>{hit.exercise.duration}</Text>
                ) : null}
              </View>
              <Text style={styles.source}>
                {hit.lesson.training_number !== undefined
                  ? `Training ${hit.lesson.training_number} · ${hit.lesson.title}`
                  : hit.lesson.title}
              </Text>
              <Text style={styles.body} numberOfLines={3}>
                {hit.exercise.description}
              </Text>
              {hit.tags.length > 0 ? (
                <View style={styles.pills}>
                  {hit.tags.map((t) => (
                    <TagPill key={t} label={t} />
                  ))}
                </View>
              ) : null}
            </Card>
          ))
        : found.map((lesson) => {
            const own = lessonTags(lesson);
            return (
              <Card
                key={lesson.id}
                onPress={() => setOpenLesson(lesson)}
                accessibilityLabel={lesson.title}
                style={styles.row}
              >
                <View style={styles.rowIcon}>
                  <BookOpen size={22} color={tennisColors.primary} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.cardTitle}>
                    {lesson.training_number !== undefined
                      ? `${lesson.training_number}. ${lesson.title}`
                      : lesson.title}
                  </Text>
                  <Text style={styles.source}>
                    {lesson.duration_minutes !== undefined
                      ? formatDuration(lesson.duration_minutes)
                      : 'Lesmateriaal'}
                    {lesson.exercises !== undefined && lesson.exercises.length > 0
                      ? ` · ${lesson.exercises.length} oefeningen`
                      : ''}
                    {lesson.attachments !== undefined && lesson.attachments.length > 0
                      ? ` · ${lesson.attachments.length} PDF`
                      : ''}
                    {lesson.drawing ? ' · veldsituatie' : ''}
                  </Text>
                  {own.length > 0 ? (
                    <View style={styles.pills}>
                      {own.slice(0, 6).map((t) => (
                        <TagPill key={t} label={t} />
                      ))}
                      {own.length > 6 ? <TagPill label={`+${own.length - 6}`} /> : null}
                    </View>
                  ) : null}
                </View>
                <ChevronRight size={20} color={tennisColors.textMuted} />
              </Card>
            );
          })}

      {/* De oefening zelf: alle kolommen van het boekje, plus de weg naar de hele training. */}
      <DetailSheet
        title={openHit ? exerciseHeading(openHit) : ''}
        visible={openHit !== null}
        onClose={() => setOpenHit(null)}
      >
        {openHit ? (
          <View style={styles.sheetBody}>
            <Text style={styles.source}>
              {openHit.lesson.training_number !== undefined
                ? `Training ${openHit.lesson.training_number} · ${openHit.lesson.title}`
                : openHit.lesson.title}
              {openHit.exercise.duration.trim().length > 0 ? ` · ${openHit.exercise.duration}` : ''}
            </Text>
            {openHit.tags.length > 0 ? (
              <View style={styles.pills}>
                {openHit.tags.map((t) => (
                  <TagPill key={t} label={t} />
                ))}
              </View>
            ) : null}
            <Field label="Omschrijving" value={openHit.exercise.description} />
            <Field label="Kwaliteit" value={openHit.exercise.quality} />
            <Field label="Organisatie / materiaal" value={openHit.exercise.organisation} />
            <Button
              label="Hele training openen"
              variant="secondary"
              onPress={() => {
                const lesson = openHit.lesson;
                setOpenHit(null);
                setOpenLesson(lesson);
              }}
            />
          </View>
        ) : null}
      </DetailSheet>

      <LessonDetailModal
        lesson={openLesson}
        visible={openLesson !== null}
        onClose={() => setOpenLesson(null)}
        canEdit={canEdit}
      />
    </View>
  );
}

/** Eén kolom uit het boekje; leeg is geen kopje zonder tekst maar helemaal niets. */
function Field({ label, value }: { label: string; value: string }): React.JSX.Element | null {
  if (value.trim().length === 0) return null;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  modes: { flexDirection: 'row', gap: spacing.sm },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: tennisColors.surface,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    minHeight: minTapTarget,
  },
  search: { flex: 1, fontSize: 15, color: tennisColors.text, paddingVertical: spacing.sm },
  clear: { ...webCursor, paddingHorizontal: spacing.xs },
  tagBar: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { fontSize: 13, color: tennisColors.textMuted },
  reset: { fontSize: 13, fontWeight: '600', color: tennisColors.primary, ...webCursor },
  empty: {
    fontSize: 15,
    color: tennisColors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { ...typography.h3, color: tennisColors.text, flexShrink: 1 },
  duration: { fontSize: 13, fontWeight: '700', color: tennisColors.primary },
  source: { fontSize: 13, color: tennisColors.textMuted },
  body: { fontSize: 14, color: tennisColors.text, lineHeight: 20 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  pill: {
    backgroundColor: tennisColors.primaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pillText: { fontSize: 11, fontWeight: '700', color: tennisColors.primaryDark },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowIcon: {},
  rowBody: { flex: 1, gap: spacing.xs },
  sheetBody: { gap: spacing.md },
  field: { gap: spacing.xs },
  fieldLabel: {
    ...typography.label,
    color: tennisColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
