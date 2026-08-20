// De keuzes die een trainer krijgt bij het doel van een speler. Hier onderhoudt de club
// zijn eigen woordenlijst, zodat er geen code aan te pas komt om een slag toe te voegen.

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import {
  shotTypeOptions, changeTypeOptions, addOption, removeOption,
} from '../../lib/goals';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, typography, minTapTarget, webCursor } from '../../constants/theme';

export default function GoalOptions(): React.JSX.Element {
  const { currentUser, settings, saveSettings } = useSimpleData();

  if (currentUser?.role !== 'coach') {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>Beheer is alleen voor trainers.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.intro}>
        Deze keuzes staan in de comboboxen bij het doel van een speler.
      </Text>

      <OptionList
        title="Type slag"
        options={shotTypeOptions(settings)}
        placeholder="bv. Lob"
        onChange={(shot_types) => void saveSettings({ ...settings, shot_types })}
      />

      <OptionList
        title="Type wijziging"
        options={changeTypeOptions(settings)}
        placeholder="bv. Beenwerk"
        onChange={(change_types) => void saveSettings({ ...settings, change_types })}
      />

      <Text style={styles.note}>
        Een keuze verwijderen haalt hem alleen uit deze lijst. Doelen die hem al gebruiken
        houden hun tekst — een afspraak met een speler hoort niet stilletjes leeg te lopen.
      </Text>
    </Screen>
  );
}

function OptionList({
  title, options, placeholder, onChange,
}: {
  title: string;
  options: string[];
  placeholder: string;
  onChange: (options: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const next = addOption(options, draft);
    setDraft('');
    if (next !== options) onChange(next);
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{title}</Text>

      {options.length === 0 ? (
        <Text style={styles.muted}>Geen keuzes. Voeg er minstens één toe.</Text>
      ) : (
        options.map((option) => (
          <View key={option} style={styles.row}>
            <Text style={styles.rowText}>{option}</Text>
            <Pressable
              onPress={() => onChange(removeOption(options, option))}
              accessibilityRole="button"
              accessibilityLabel={`${option} verwijderen uit ${title}`}
              style={[styles.iconBtn, webCursor]}
            >
              <Trash2 size={16} color={tennisColors.danger} />
            </Pressable>
          </View>
        ))
      )}

      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, styles.grow]}
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor={tennisColors.textMuted}
          accessibilityLabel={`Nieuwe keuze voor ${title}`}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <Pressable
          onPress={add}
          disabled={draft.trim().length === 0}
          accessibilityRole="button"
          accessibilityLabel={`Toevoegen aan ${title}`}
          accessibilityState={{ disabled: draft.trim().length === 0 }}
          style={[styles.addBtn, draft.trim().length === 0 && styles.addBtnOff, webCursor]}
        >
          <Plus size={18} color={draft.trim() ? tennisColors.white : tennisColors.textMuted} />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 14, color: tennisColors.textMuted },
  note: { fontSize: 12, color: tennisColors.textMuted, lineHeight: 18 },
  card: { gap: spacing.xs },
  title: { ...typography.h3, color: tennisColors.text, marginBottom: spacing.xs },
  muted: { color: tennisColors.textMuted, fontSize: 14 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: tennisColors.border,
  },
  rowText: { fontSize: 15, color: tennisColors.text },
  iconBtn: { padding: 6, borderRadius: radius.sm },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  grow: { flex: 1 },
  input: {
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    color: tennisColors.text, backgroundColor: tennisColors.surface,
    minHeight: minTapTarget,
  },
  addBtn: {
    width: 44, height: 44, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: tennisColors.primary,
  },
  addBtnOff: { backgroundColor: tennisColors.border },
});
