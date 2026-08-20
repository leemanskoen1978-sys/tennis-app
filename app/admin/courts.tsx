// Beheer → Banen. Per baan het uurtarief en de groepstaffel.
//
// Het uurtarief geldt voor een privéles. De staffel eronder zegt wat een groep kost: "tot 2
// spelers € 30, tot 4 spelers € 45". Elk bedrag is het TOTAAL voor de les en niet per speler —
// dat staat er ook op het scherm bij, want dat is precies wat iemand verkeerd gokt.
//
// Zonder staffel werkt alles zoals vroeger: dan geldt het uurtarief voor elke groepsgrootte.

import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { groupRateSteps } from '../../lib/payments';
import { formatEuro, parseEuro } from '../../lib/money';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, typography, minTapTarget, webCursor } from '../../constants/theme';
import type { Court, CourtGroupRate } from '../../lib/types';

/** Wat er in een aantal-spelersveld getypt wordt, als geheel getal. Onzin telt als niets. */
function parsePlayers(text: string): number | undefined {
  const value = Number(text.trim());
  if (!Number.isFinite(value) || value < 1) return undefined;
  return Math.floor(value);
}

/**
 * Eén baan met zijn tarieven. De velden schrijven meteen weg zodra ze een bruikbare waarde
 * hebben: een aparte bewaarknop per baan zou betekenen dat de trainer een half ingevulde
 * staffel achter kan laten, en die rekent dan mee.
 */
function CourtCard({ court }: { court: Court }): React.JSX.Element {
  const { updateCourt } = useSimpleData();
  // Wat er in de velden staat terwijl er getypt wordt. Zonder dit springt "4" tijdens het
  // wissen van "45" even naar het opgeslagen bedrag terug.
  const [typed, setTyped] = useState<Record<string, string>>({});

  const steps = groupRateSteps(court);
  const value = (key: string, stored: string): string => typed[key] ?? stored;
  const setTypedValue = (key: string, text: string): void =>
    setTyped((current) => ({ ...current, [key]: text }));

  const saveSteps = (next: CourtGroupRate[]): void => {
    // Leeg wegschrijven en niet een lege lijst laten staan: geen staffel is een toestand,
    // en `undefined` is hoe de rest van de app dat leest.
    void updateCourt(court.id, { group_rates: next.length > 0 ? next : undefined });
    setTyped({});
  };

  const patchStep = (index: number, patch: Partial<CourtGroupRate>): void => {
    saveSteps(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const addStep = (): void => {
    const last = steps[steps.length - 1];
    // Een nieuwe stap begint één speler groter en op hetzelfde bedrag: zo hoeft de trainer
    // alleen het bedrag te veranderen, en staat er nooit een stap die niets betekent.
    saveSteps([
      ...steps,
      {
        max_players: (last?.max_players ?? 2) + 2,
        rate: last?.rate ?? court.hourly_rate,
      },
    ]);
  };

  return (
    <Card>
      <View style={styles.row}>
        <Text style={styles.name}>{court.name}</Text>
        <Badge
          label={court.indoor ? 'Binnen' : 'Buiten'}
          color={court.indoor ? tennisColors.court : tennisColors.primary}
          subtle={!court.indoor}
        />
      </View>

      <Text style={styles.label}>Uurtarief privéles</Text>
      <View style={styles.field}>
        <Text style={styles.euro}>€</Text>
        <TextInput
          style={styles.input}
          value={value(`rate-${court.id}`, formatEuro(court.hourly_rate))}
          onChangeText={(t) => {
            setTypedValue(`rate-${court.id}`, t);
            const parsed = parseEuro(t);
            if (parsed !== undefined) void updateCourt(court.id, { hourly_rate: parsed });
          }}
          onBlur={() => setTyped({})}
          keyboardType="decimal-pad"
          accessibilityLabel={`Uurtarief van ${court.name}`}
          placeholderTextColor={tennisColors.textMuted}
        />
        <Text style={styles.perHour}>per uur</Text>
      </View>

      <Text style={styles.label}>Groepstarief</Text>
      {steps.length === 0 ? (
        <Text style={styles.help}>
          Geen staffel: ook een groepsles rekent dan het uurtarief hierboven.
        </Text>
      ) : null}

      {steps.map((step, index) => (
        <View key={`${court.id}-${index}`} style={styles.stepRow}>
          <Text style={styles.stepText}>tot</Text>
          <TextInput
            style={[styles.input, styles.small]}
            value={value(`p-${court.id}-${index}`, String(step.max_players))}
            onChangeText={(t) => {
              setTypedValue(`p-${court.id}-${index}`, t);
              const parsed = parsePlayers(t);
              if (parsed !== undefined) patchStep(index, { max_players: parsed });
            }}
            onBlur={() => setTyped({})}
            keyboardType="number-pad"
            accessibilityLabel={`Tot hoeveel spelers, stap ${index + 1} van ${court.name}`}
          />
          <Text style={styles.stepText}>spelers · €</Text>
          <TextInput
            style={[styles.input, styles.small]}
            value={value(`r-${court.id}-${index}`, formatEuro(step.rate))}
            onChangeText={(t) => {
              setTypedValue(`r-${court.id}-${index}`, t);
              const parsed = parseEuro(t);
              if (parsed !== undefined) patchStep(index, { rate: parsed });
            }}
            onBlur={() => setTyped({})}
            keyboardType="decimal-pad"
            accessibilityLabel={`Bedrag van stap ${index + 1} van ${court.name}`}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Stap ${index + 1} van ${court.name} verwijderen`}
            onPress={() => saveSteps(steps.filter((_, i) => i !== index))}
            style={[styles.remove, webCursor]}
          >
            <Trash2 size={18} color={tennisColors.danger} />
          </Pressable>
        </View>
      ))}

      <View style={styles.addRow}>
        <Button
          label="Stap toevoegen"
          variant="secondary"
          fullWidth={false}
          icon={<Plus size={16} color={tennisColors.text} />}
          onPress={addStep}
        />
      </View>
    </Card>
  );
}

export default function Courts(): React.JSX.Element {
  const { courts } = useSimpleData();
  const sorted = [...courts].sort((a, b) => a.number - b.number);

  return (
    <Screen>
      {sorted.length === 0 ? (
        <Text style={styles.muted}>Nog geen banen.</Text>
      ) : (
        sorted.map((c) => <CourtCard key={c.id} court={c} />)
      )}
      <Text style={styles.help}>
        Elk bedrag is het totaal voor de hele les, niet per speler: "tot 4 spelers € 45"
        betekent dat een les met vier spelers samen € 45 per uur kost. Een groepsles gaat
        altijd op factuur — een beurtenkaart en het sponsorbudget gelden alleen voor een
        privéles. Deze tarieven bepalen de omzetberekening.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: tennisColors.textMuted, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { ...typography.h3, color: tennisColors.text },
  label: {
    ...typography.label,
    color: tennisColors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
    flexWrap: 'wrap',
  },
  stepText: { fontSize: 14, color: tennisColors.text },
  euro: { fontSize: 15, color: tennisColors.text },
  perHour: { fontSize: 13, color: tennisColors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: minTapTarget,
    minWidth: 90,
    fontSize: 15,
    color: tennisColors.text,
    backgroundColor: tennisColors.surface,
  },
  small: { minWidth: 64, maxWidth: 84 },
  remove: {
    minHeight: minTapTarget,
    minWidth: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: { marginTop: spacing.sm, alignItems: 'flex-start' },
  help: { fontSize: 13, color: tennisColors.textMuted },
});
