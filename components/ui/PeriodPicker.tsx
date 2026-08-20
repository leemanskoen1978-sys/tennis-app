// Kiezen naar welke periode je kijkt: eerst de snelkeuzes (deze maand, vorige maand, dit
// kwartaal, dit jaar, eigen periode), dan bladeren binnen die soort. De soort blijft bij het
// bladeren staan, zodat "Vorige" bij een kwartaal ook echt een kwartaal terug gaat.

import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { Button } from './Button';
import { Chip } from './Chip';
import {
  currentPeriod, customPeriod, formatDayInput, parseDayInput, periodLabel, previousMonthPeriod,
  quarterPeriod, shiftPeriod, yearPeriod, type Period,
} from '../../lib/period';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, typography } from '../../constants/theme';

/** Twee periodes zijn dezelfde keuze als soort én grenzen gelijk zijn. */
function sameChoice(a: Period, b: Period): boolean {
  return a.kind === b.kind && a.from.getTime() === b.from.getTime()
    && a.to.getTime() === b.to.getTime();
}

export function PeriodPicker({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}): React.JSX.Element {
  const now = new Date();
  // De velden van de eigen periode staan alleen open als je erom vraagt; ze beginnen op de
  // periode die je nu ziet, zodat je er alleen nog een dag in hoeft te verschuiven.
  const [customOpen, setCustomOpen] = useState<boolean>(value.kind === 'custom');
  const [fromText, setFromText] = useState<string>(formatDayInput(value.from));
  const [toText, setToText] = useState<string>(formatDayInput(value.to));
  const [customError, setCustomError] = useState<string | null>(null);

  const quick: ReadonlyArray<{ key: string; label: string; make: () => Period }> = [
    { key: 'this-month', label: 'Deze maand', make: () => currentPeriod(now) },
    { key: 'prev-month', label: 'Vorige maand', make: () => previousMonthPeriod(now) },
    { key: 'quarter', label: 'Dit kwartaal', make: () => quarterPeriod(now) },
    { key: 'year', label: 'Dit jaar', make: () => yearPeriod(now) },
  ];

  function applyCustom(): void {
    const from = parseDayInput(fromText);
    const to = parseDayInput(toText);
    if (!from || !to) {
      setCustomError('Vul beide datums in als dd/mm/jjjj.');
      return;
    }
    setCustomError(null);
    onChange(customPeriod(from, to));
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.chipRow}>
        {quick.map((q) => (
          <Chip
            key={q.key}
            label={q.label}
            // Na het bladeren staat geen enkele snelkeuze meer aan: je kijkt dan naar een
            // andere maand dan "deze maand", en dat mag de rij ook laten zien.
            selected={!customOpen && sameChoice(value, q.make())}
            onPress={() => {
              setCustomOpen(false);
              onChange(q.make());
            }}
          />
        ))}
        <Chip
          label="Eigen periode"
          selected={customOpen}
          onPress={() => {
            setFromText(formatDayInput(value.from));
            setToText(formatDayInput(value.to));
            setCustomError(null);
            setCustomOpen(true);
          }}
        />
      </View>

      {customOpen ? (
        <View style={styles.customBox}>
          <View style={styles.customRow}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Van</Text>
              <TextInput
                style={styles.input}
                value={fromText}
                onChangeText={setFromText}
                placeholder="dd/mm/jjjj"
                placeholderTextColor={tennisColors.textMuted}
                accessibilityLabel="Begindatum van de periode"
                inputMode="numeric"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Tot en met</Text>
              <TextInput
                style={styles.input}
                value={toText}
                onChangeText={setToText}
                placeholder="dd/mm/jjjj"
                placeholderTextColor={tennisColors.textMuted}
                accessibilityLabel="Einddatum van de periode"
                inputMode="numeric"
              />
            </View>
          </View>
          {customError ? <Text style={styles.error}>{customError}</Text> : null}
          <Button label="Toon deze periode" variant="secondary" onPress={applyCustom} />
        </View>
      ) : null}

      {/* De drie delen blijven bij elkaar en staan als groep gecentreerd. Uit elkaar
          getrokken over de volle breedte oogde dit als drie losse dingen; het is er één. */}
      <View style={styles.pagerRow}>
        <Button
          label="Vorige"
          variant="secondary"
          fullWidth={false}
          icon={<ChevronLeft size={16} color={tennisColors.text} />}
          onPress={() => onChange(shiftPeriod(value, -1))}
        />
        <Text style={styles.periodLabel}>{periodLabel(value)}</Text>
        <Button
          label="Volgende"
          variant="secondary"
          fullWidth={false}
          icon={<ChevronRight size={16} color={tennisColors.text} />}
          onPress={() => onChange(shiftPeriod(value, 1))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  customBox: { gap: spacing.sm },
  // `wrap` als vangnet: op een smalle telefoon staan de twee velden onder elkaar in plaats
  // van samengeknepen naast elkaar.
  customRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  field: { flexGrow: 1, flexBasis: 140, gap: spacing.xs },
  fieldLabel: { ...typography.label, color: tennisColors.textMuted },
  input: {
    backgroundColor: tennisColors.background,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: tennisColors.text,
  },
  error: { color: tennisColors.danger, fontSize: 14 },
  pagerRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    justifyContent: 'center', gap: spacing.md,
  },
  // Een minimumbreedte voor het label: zonder dat verspringen de knoppen bij elke periode,
  // want "mei 2026" is korter dan "3e kwartaal 2026".
  periodLabel: { ...typography.h3, color: tennisColors.text, minWidth: 170, textAlign: 'center' },
});
