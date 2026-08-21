// Kaartenbeheer: alle 10-beurtenkaarten op één plek, want een kaart wordt aangemaakt en
// nagekeken los van de les waarvoor hij toevallig geldt.

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Plus, Minus } from 'lucide-react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StudentCombobox } from '../../components/ui/StudentCombobox';
import { UserManagement } from '../../components/UserManagement';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { remaining, SESSIONS_PER_CARD } from '../../lib/beurtenkaart';
import { formatDayTime } from '../../lib/datetime';
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, typography } from '../../constants/theme';
import type { Beurtenkaart, User } from '../../lib/types';

/**
 * Eén kaartrij. Staat apart zodat de opmerking zijn eigen tekst kan bijhouden: met één map in
 * het bovenliggende scherm zou die omvallen zodra de lijst met kaarten verandert.
 */
function CardRow({
  card, playerName, confirming, onConfirm, onCancelConfirm,
  onSaveRemarks, onAddSession, onRemoveSession, onDelete,
}: {
  card: Beurtenkaart;
  playerName: string;
  confirming: boolean;
  onConfirm: () => void;
  onCancelConfirm: () => void;
  onSaveRemarks: (remarks: string | undefined) => void;
  onAddSession: () => void;
  onRemoveSession: () => void;
  onDelete: () => void;
}): React.JSX.Element {
  const t = useT();
  // Het opmerkingenveld houdt zijn eigen tekst bij, zodat typen niet vecht met de bewaarde waarde.
  const [remarks, setRemarks] = useState(card.remarks ?? '');

  const total = card.total_sessions;
  const used = card.uses.length;
  const left = remaining(card);
  // Een kaart zonder beurten zou anders NaN% breed worden.
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  // "Beurt terug" raakt alleen handmatige beurten; zonder zo'n beurt valt er niets terug te halen.
  const hasManual = card.uses.some((u) => !u.booking_id);
  // Op een volle kaart doet "Beurt af" niets: dan hoort de knop ook uit te staan.
  const isFull = left === 0;
  const progressLabel = t('{gebruikt} van {totaal} beurten gebruikt, nog {rest} over', {
    gebruikt: used, totaal: total, rest: left,
  });

  return (
    <Card>
      <Text style={styles.cardName}>{playerName}</Text>
      <Text style={styles.cardMeta}>
        {t('{gebruikt} van {totaal} gebruikt · nog {rest} over · aangemaakt {moment}', {
          gebruikt: used, totaal: total, rest: left, moment: formatDayTime(card.created_at),
        })}
      </Text>

      <View
        style={styles.bar}
        accessibilityRole="progressbar"
        accessibilityLabel={progressLabel}
        accessibilityValue={{ min: 0, max: total, now: used, text: progressLabel }}
      >
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>

      <View style={styles.stepRow}>
        <Button
          label={t('Beurt af')}
          variant="secondary"
          fullWidth={false}
          disabled={isFull}
          icon={<Plus size={16} color={tennisColors.text} />}
          onPress={onAddSession}
        />
        <Button
          label={t('Beurt terug')}
          variant="secondary"
          fullWidth={false}
          disabled={!hasManual}
          icon={<Minus size={16} color={tennisColors.text} />}
          onPress={onRemoveSession}
        />
      </View>
      <Text style={styles.hint}>
        {t('Handmatig bijstellen raakt alleen beurten zonder les; een beurt van een les komt '
          + 'terug door die les op een andere betaalwijze te zetten.')}
      </Text>

      <Text style={styles.subLabel}>{t('Opmerking')}</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={remarks}
        onChangeText={setRemarks}
        onBlur={() => { onSaveRemarks(remarks.trim() || undefined); }}
        placeholder={t('Bijvoorbeeld: betaald op 3 september')}
        placeholderTextColor={tennisColors.textMuted}
        accessibilityLabel={t('Opmerking bij de kaart van {naam}', { naam: playerName })}
        multiline
      />

      {card.uses.length > 0 ? (
        <>
          <Text style={styles.subLabel}>{t('Gebruikte beurten')}</Text>
          {card.uses.map((use, i) => (
            <Text key={`${use.booking_id}-${i}`} style={styles.useLine}>
              {i + 1}. {formatDayTime(use.date)}{use.booking_id ? '' : ` (${t('handmatig')})`}
            </Text>
          ))}
        </>
      ) : null}

      {confirming ? (
        <View style={styles.confirmBox}>
          <Text style={styles.confirmText}>
            {t('Kaart verwijderen? {n} les(sen) verliezen hun beurt en komen terug op Open.', {
              n: card.uses.filter((u) => u.booking_id).length,
            })}
          </Text>
          <View style={styles.stepRow}>
            <Button
              label={t('Ja, verwijderen')}
              variant="danger"
              fullWidth={false}
              onPress={onDelete}
            />
            <Button
              label={t('Nee')}
              variant="secondary"
              fullWidth={false}
              onPress={onCancelConfirm}
            />
          </View>
        </View>
      ) : (
        <View style={styles.stepRow}>
          <Button
            label={t('Verwijderen')}
            variant="danger"
            fullWidth={false}
            onPress={onConfirm}
          />
        </View>
      )}
    </Card>
  );
}

export default function BeurtenkaartenScreen(): React.JSX.Element {
  const t = useT();
  const {
    currentUser, users, beurtenkaarten, error,
    addBeurtenkaart, updateBeurtenkaart, addCardSession, removeCardSession, deleteBeurtenkaart,
  } = useSimpleData();

  const [newPlayerId, setNewPlayerId] = useState<string | null>(null);
  // Welke kaart om bevestiging vraagt voor verwijderen; null = geen.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // De naam die in de keuzelijst getypt werd voor een speler die nog niet bestaat; null zolang
  // de trainer daar niet om vroeg. Zo staat het invulscherm meteen met die naam klaar.
  const [newPlayerName, setNewPlayerName] = useState<string | null>(null);

  const players: User[] = useMemo(() => users.filter((u) => u.role !== 'coach'), [users]);

  if (currentUser?.role !== 'coach') {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Alleen een trainer beheert de beurtenkaarten.')}</Text>
      </Screen>
    );
  }

  const sorted: Beurtenkaart[] = [...beurtenkaarten].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );

  const nameOf = (id: string): string => users.find((u) => u.id === id)?.name ?? t('Onbekende speler');

  return (
    <Screen>
      <Text style={styles.sectionLabel}>{t('Nieuwe kaart')}</Text>
      <StudentCombobox
        students={players}
        value={newPlayerId}
        onChange={setNewPlayerId}
        placeholder={t('Typ de naam van de speler…')}
        onRequestCreate={setNewPlayerName}
      />
      <Button
        label={t('Kaart van {n} beurten aanmaken', { n: SESSIONS_PER_CARD })}
        variant="primary"
        disabled={newPlayerId === null}
        onPress={() => {
          if (!newPlayerId) return;
          void addBeurtenkaart(newPlayerId);
          setNewPlayerId(null);
        }}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {sorted.length === 0 ? (
        <Text style={styles.muted}>{t('Nog geen beurtenkaarten.')}</Text>
      ) : null}

      {sorted.map((card) => (
        <CardRow
          key={card.id}
          card={card}
          playerName={nameOf(card.player_id)}
          confirming={confirmingId === card.id}
          onConfirm={() => setConfirmingId(card.id)}
          onCancelConfirm={() => setConfirmingId(null)}
          onSaveRemarks={(r) => { void updateBeurtenkaart(card.id, { remarks: r }); }}
          onAddSession={() => { void addCardSession(card.id); }}
          onRemoveSession={() => { void removeCardSession(card.id); }}
          onDelete={() => { void deleteBeurtenkaart(card.id); setConfirmingId(null); }}
        />
      ))}

      {/* Het volledige invulscherm voor een nieuwe speler. Zodra hij bewaard is, is hij ook
          meteen de speler van de nieuwe kaart — daarvoor was de trainer hier tenslotte. */}
      <UserManagement
        visible={newPlayerName !== null}
        initialName={newPlayerName ?? ''}
        onClose={() => setNewPlayerName(null)}
        onCreated={(u) => {
          setNewPlayerId(u.id);
          setNewPlayerName(null);
        }}
      />
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
  barFill: { height: 10, backgroundColor: tennisColors.primaryFill },
  stepRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  hint: { fontSize: 12, color: tennisColors.textMuted, fontStyle: 'italic', marginTop: spacing.xs },
  input: {
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: tennisColors.text, backgroundColor: tennisColors.background, marginTop: spacing.xs,
  },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  error: { color: tennisColors.danger, fontSize: 14 },
  useLine: { fontSize: 14, color: tennisColors.text, marginTop: 2 },
  confirmBox: {
    marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: tennisColors.background, borderWidth: 1, borderColor: tennisColors.border,
  },
  confirmText: { fontSize: 14, color: tennisColors.text },
});
