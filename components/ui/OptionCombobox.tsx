import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { X, Check, ChevronDown } from 'lucide-react-native';
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, minTapTarget, webCursor } from '../../constants/theme';

/**
 * Pick one value from a list: type to filter, tap to choose, X to clear.
 *
 * Deliberately no free text. The choices are the club's vocabulary and are maintained in
 * Beheer; letting anyone type a new one here would quietly grow a second, unmanaged list.
 * A value that is no longer in the list still shows — a choice removed in Beheer should
 * not blank out what a coach already agreed with a player.
 */
export function OptionCombobox({
  options, value, onChange, placeholder, label,
}: {
  options: string[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  /** Used for the accessibility label, so two comboboxes in a row stay tellable apart. */
  label: string;
}) {
  const t = useT();
  const [query, setQuery] = useState(value ?? '');
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q === (value ?? '').toLowerCase()) return options.slice(0, 8);
    return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 8);
  }, [options, query, value]);

  const pick = (option: string) => {
    onChange(option);
    setQuery(option);
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery('');
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={(t) => { setQuery(t); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          placeholderTextColor={tennisColors.textMuted}
          accessibilityLabel={label}
        />
        {value ? (
          <Pressable
            onPress={clear}
            accessibilityRole="button"
            accessibilityLabel={`${label} wissen`}
            style={[styles.iconBtn, webCursor]}
          >
            <X size={18} color={tennisColors.textMuted} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityLabel={`${label} openen`}
            style={[styles.iconBtn, webCursor]}
          >
            <ChevronDown size={18} color={tennisColors.textMuted} />
          </Pressable>
        )}
      </View>

      {open && matches.length > 0 ? (
        <View style={styles.list}>
          {matches.map((option) => (
            <Pressable
              key={option}
              onPress={() => pick(option)}
              accessibilityRole="button"
              accessibilityLabel={option}
              accessibilityState={{ selected: option === value }}
              style={[styles.row, webCursor]}
            >
              <Text style={styles.rowText}>{option}</Text>
              {option === value ? <Check size={16} color={tennisColors.primary} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {open && matches.length === 0 ? (
        <Text style={styles.none}>{t('Geen keuze gevonden. Voeg hem toe bij Beheer → Doelen.')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', zIndex: 1 },
  field: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10, paddingRight: 40,
    fontSize: 15, color: tennisColors.text, backgroundColor: tennisColors.surface,
    minHeight: minTapTarget,
  },
  iconBtn: { position: 'absolute', right: 6, padding: 6 },
  list: {
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.sm,
    backgroundColor: tennisColors.surface, marginTop: 4, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, minHeight: minTapTarget,
  },
  rowText: { fontSize: 15, color: tennisColors.text },
  none: { fontSize: 12, color: tennisColors.textMuted, marginTop: 4 },
});
