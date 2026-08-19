import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { X, Check } from 'lucide-react-native';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, minTapTarget, webCursor } from '../../constants/theme';
import type { User } from '../../lib/types';

/**
 * Autocomplete for picking a student: type a name, up to 5 matching students
 * appear, pick one. Clear (X) resets to none. value = selected id (or null).
 */
export function StudentCombobox({
  students,
  value,
  onChange,
  placeholder = 'Typ een naam…',
}: {
  students: User[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
}) {
  const selected = students.find((s) => s.id === value) ?? null;
  const [query, setQuery] = useState(selected ? selected.name : '');
  const [open, setOpen] = useState(false);

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

  const showList = open && matches.length > 0 && !(selected && query === selected.name);

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
          placeholder={placeholder}
          placeholderTextColor={tennisColors.textMuted}
        />
        {query.length > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Wissen" onPress={clear} style={[styles.clear, webCursor]}>
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
        </View>
      ) : null}

      {selected ? (
        <Text style={styles.selectedHint}>Gekozen: {selected.name}</Text>
      ) : (
        <Text style={styles.selectedHint}>Geen speler gekozen (algemeen)</Text>
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
  rowText: { fontSize: 15, color: tennisColors.text },
  selectedHint: { fontSize: 12, color: tennisColors.textMuted, marginTop: spacing.xs },
});
