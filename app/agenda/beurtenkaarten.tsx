// Kaartenbeheer: alle 10-beurtenkaarten op één plek, want een kaart wordt aangemaakt en
// nagekeken los van de les waarvoor hij toevallig geldt.

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Plus, Minus } from 'lucide-react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StudentCombobox } from '../../components/ui/StudentCombobox';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { remaining, SESSIONS_PER_CARD } from '../../lib/beurtenkaart';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, typography } from '../../constants/theme';
import type { Beurtenkaart, User } from '../../lib/types';

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('nl-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function BeurtenkaartenScreen(): React.JSX.Element {
  const {
    currentUser, users, beurtenkaarten,
    addBeurtenkaart, updateBeurtenkaart, addCardSession, removeCardSession, deleteBeurtenkaart,
  } = useSimpleData();

  const [newPlayerId, setNewPlayerId] = useState<string | null>(null);
  // Welke kaart om bevestiging vraagt voor verwijderen; null = geen.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const players: User[] = useMemo(() => users.filter((u) => u.role !== 'coach'), [users]);

  if (currentUser?.role !== 'coach') {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>Alleen een trainer beheert de beurtenkaarten.</Text>
      </Screen>
    );
  }

  const sorted: Beurtenkaart[] = [...beurtenkaarten].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );

  const nameOf = (id: string): string => users.find((u) => u.id === id)?.name ?? 'Onbekende speler';

  return (
    <Screen>
      <Text style={styles.sectionLabel}>Nieuwe kaart</Text>
      <StudentCombobox
        students={players}
        value={newPlayerId}
        onChange={setNewPlayerId}
        placeholder="Typ de naam van de speler…"
      />
      <Button
        label={`Kaart van ${SESSIONS_PER_CARD} beurten aanmaken`}
        variant="primary"
        disabled={newPlayerId === null}
        onPress={() => {
          if (!newPlayerId) return;
          void addBeurtenkaart(newPlayerId);
          setNewPlayerId(null);
        }}
      />

      {sorted.length === 0 ? (
        <Text style={styles.muted}>Nog geen beurtenkaarten.</Text>
      ) : null}

      {sorted.map((card) => {
        const left = remaining(card);
        const used = card.uses.length;
        const pct = Math.min(100, Math.round((used / card.total_sessions) * 100));
        return (
          <Card key={card.id}>
            <Text style={styles.cardName}>{nameOf(card.player_id)}</Text>
            <Text style={styles.cardMeta}>
              {left} van {card.total_sessions} beurten over · aangemaakt {fmt(card.created_at)}
            </Text>

            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${pct}%` }]} />
            </View>

            <View style={styles.stepRow}>
              <Button
                label="Beurt af"
                variant="secondary"
                fullWidth={false}
                icon={<Plus size={16} color={tennisColors.text} />}
                onPress={() => { void addCardSession(card.id); }}
              />
              <Button
                label="Beurt terug"
                variant="secondary"
                fullWidth={false}
                icon={<Minus size={16} color={tennisColors.text} />}
                onPress={() => { void removeCardSession(card.id); }}
              />
            </View>
            <Text style={styles.hint}>
              Handmatig bijstellen raakt alleen beurten zonder les; een beurt van een les komt
              terug door die les op een andere betaalwijze te zetten.
            </Text>

            <Text style={styles.subLabel}>Opmerking</Text>
            <TextInput
              style={styles.input}
              defaultValue={card.remarks ?? ''}
              placeholder="Bijvoorbeeld: betaald op 3 september"
              placeholderTextColor={tennisColors.textMuted}
              onEndEditing={(e) => {
                void updateBeurtenkaart(card.id, { remarks: e.nativeEvent.text.trim() || undefined });
              }}
            />

            {card.uses.length > 0 ? (
              <>
                <Text style={styles.subLabel}>Gebruikte beurten</Text>
                {card.uses.map((use, i) => (
                  <Text key={`${use.booking_id}-${i}`} style={styles.useLine}>
                    {i + 1}. {fmt(use.date)}{use.booking_id ? '' : ' (handmatig)'}
                  </Text>
                ))}
              </>
            ) : null}

            {confirmingId === card.id ? (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmText}>
                  Kaart verwijderen? {card.uses.filter((u) => u.booking_id).length} les(sen)
                  verliezen hun beurt en komen terug op Open.
                </Text>
                <View style={styles.stepRow}>
                  <Button
                    label="Ja, verwijderen"
                    variant="danger"
                    fullWidth={false}
                    onPress={() => { void deleteBeurtenkaart(card.id); setConfirmingId(null); }}
                  />
                  <Button
                    label="Nee"
                    variant="secondary"
                    fullWidth={false}
                    onPress={() => setConfirmingId(null)}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.stepRow}>
                <Button
                  label="Verwijderen"
                  variant="danger"
                  fullWidth={false}
                  onPress={() => setConfirmingId(card.id)}
                />
              </View>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    ...typography.label, color: tennisColors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  subLabel: { ...typography.label, color: tennisColors.text, marginTop: spacing.md },
  muted: { ...typography.body, color: tennisColors.textMuted },
  cardName: { ...typography.h3, color: tennisColors.text },
  cardMeta: { fontSize: 14, color: tennisColors.textMuted, marginTop: 2 },
  bar: {
    height: 10, borderRadius: radius.pill, backgroundColor: tennisColors.primaryTint,
    marginTop: spacing.sm, overflow: 'hidden',
  },
  barFill: { height: 10, backgroundColor: tennisColors.primary },
  stepRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  hint: { fontSize: 12, color: tennisColors.textMuted, fontStyle: 'italic', marginTop: spacing.xs },
  input: {
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: tennisColors.text, backgroundColor: tennisColors.background, marginTop: spacing.xs,
  },
  useLine: { fontSize: 14, color: tennisColors.text, marginTop: 2 },
  confirmBox: {
    marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: tennisColors.background, borderWidth: 1, borderColor: tennisColors.border,
  },
  confirmText: { fontSize: 14, color: tennisColors.text },
});
