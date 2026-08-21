import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { X, Check, Plus } from 'lucide-react-native';
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, minTapTarget, webCursor } from '../../constants/theme';
import { canCreateName } from '../../lib/students';
import type { User } from '../../lib/types';

/**
 * Autocomplete for picking a student: type a name, up to 5 matching students
 * appear, pick one. Clear (X) resets to none. value = selected id (or null).
 *
 * Staat een `onRequestCreate` klaar, dan biedt de lijst een onbekende naam aan om toe te voegen.
 * Dit component maakt zelf niemand aan: het geeft alleen door dát de trainer een nieuwe speler
 * wil, met de getypte naam erbij. Het scherm eromheen opent daarna het invulscherm waar alles
 * ingevuld kan worden. Zonder die prop gedraagt de lijst zich precies als voorheen.
 */
export function StudentCombobox({
  students,
  value,
  onChange,
  placeholder,
  onRequestCreate,
}: {
  students: User[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  /** De trainer wil deze (nog onbekende) naam toevoegen; het scherm opent het invulscherm. */
  onRequestCreate?: (name: string) => void;
}) {
  const t = useT();
  const selected = students.find((s) => s.id === value) ?? null;
  const [query, setQuery] = useState(selected ? selected.name : '');
  const [open, setOpen] = useState(false);
  // Onthoudt welke value het invoerveld nu weergeeft, zodat we alleen bijwerken als het
  // scherm eromheen naar een ándere speler wisselt (bv. na aanmaken + hernoemen) — anders
  // zou elke render, ook tijdens het typen, de getypte tekst overschrijven.
  const shownValueRef = useRef(value);
  useEffect(() => {
    if (value !== shownValueRef.current) {
      shownValueRef.current = value;
      if (value) {
        const s = students.find((u) => u.id === value);
        if (s) setQuery(s.name);
      }
    }
  }, [value, students]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students.slice(0, 5);
    return students.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 5);
  }, [students, query]);

  const pick = (s: User) => {
    onChange(s.id);
    setQuery(s.name);
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery('');
    setOpen(true);
  };

  const typedName = query.trim();
  const showCreate = canCreateName(students, query, onRequestCreate !== undefined);

  /**
   * Vraag het scherm om het invulscherm te openen. De lijst blijft openstaan: loopt het
   * invullen ergens vast of bedenkt de trainer zich, dan staat zijn getypte naam er nog en
   * kan hij alsnog een bestaande speler kiezen.
   */
  const requestCreate = () => {
    if (!onRequestCreate || !typedName) return;
    onRequestCreate(typedName);
  };

  const showList =
    open && (matches.length > 0 || showCreate) && !(selected && query === selected.name);

  return (
    <View>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setOpen(true);
            if (value) onChange(null); // editing invalidates the previous pick
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? t('Typ een naam…')}
          placeholderTextColor={tennisColors.textMuted}
        />
        {query.length > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('Wissen')} onPress={clear} style={[styles.clear, webCursor]}>
            <X size={18} color={tennisColors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {showList ? (
        <View style={styles.list}>
          {matches.map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={s.name}
              onPress={() => pick(s)}
              style={({ pressed }) => [styles.row, webCursor, pressed && styles.rowPressed]}
            >
              <Text style={styles.rowText}>{s.name}</Text>
              {value === s.id ? <Check size={16} color={tennisColors.primary} /> : null}
            </Pressable>
          ))}
          {showCreate ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`"${typedName}" toevoegen…`}
              onPress={requestCreate}
              style={({ pressed }) => [styles.row, styles.createRow, webCursor, pressed && styles.rowPressed]}
            >
              <Plus size={16} color={tennisColors.primary} />
              <Text style={styles.createText}>{`"${typedName}" toevoegen…`}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {selected ? (
        <Text style={styles.selectedHint}>{t('Gekozen')}: {selected.name}</Text>
      ) : (
        <Text style={styles.selectedHint}>{t('Geen speler gekozen (algemeen)')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: { position: 'relative', justifyContent: 'center' },
  input: {
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10, paddingRight: 40,
    fontSize: 15, color: tennisColors.text, backgroundColor: tennisColors.surface,
    minHeight: minTapTarget,
  },
  clear: { position: 'absolute', right: 8, padding: 6 },
  list: {
    marginTop: spacing.xs, borderWidth: 1, borderColor: tennisColors.border,
    borderRadius: radius.sm, backgroundColor: tennisColors.surface, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: minTapTarget, paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: tennisColors.border,
  },
  rowPressed: { backgroundColor: tennisColors.primaryTint },
  // Zelfde rijhoogte als de spelers erboven; alleen het plusje staat hier vooraan.
  createRow: { justifyContent: 'flex-start', gap: spacing.xs },
  createText: { fontSize: 15, color: tennisColors.primary },
  rowText: { fontSize: 15, color: tennisColors.text },
  selectedHint: { fontSize: 12, color: tennisColors.textMuted, marginTop: spacing.xs },
});
