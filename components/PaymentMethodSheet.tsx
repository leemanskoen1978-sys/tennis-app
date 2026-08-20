import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';

import { tennisColors } from '../constants/tennis-colors';
import { spacing, radius, typography, shadow, contentMaxWidth } from '../constants/theme';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { PAYMENT_METHODS, PAYMENT_LABELS } from '../lib/payments';
import { GROEPSLES_ALLEEN_FACTUUR, GROEPSLES_METHOD } from '../lib/beurtenkaart';
import type { PaymentMethod } from '../lib/types';

interface Props {
  visible: boolean;
  current: PaymentMethod;
  /** Getoond bij '10-beurtenkaart', bijvoorbeeld "nog 4 beurten". */
  cardHint?: string;
  /** Hetzelfde voor 'Sponsor', in euro's: wat er van het sponsorbudget over is. */
  sponsorHint?: string;
  error?: string | null;
  /**
   * Bij een groepsles valt er niets te kiezen: die gaat altijd op factuur. De andere
   * betaalwijzen staan er dan uitgeschakeld bij, met de reden eronder — een keuze die
   * gewoon weigert als je erop tikt is erger dan een keuze die je ziet dat niet kan.
   */
  groupLesson?: boolean;
  onPick: (method: PaymentMethod) => void;
  onClose: () => void;
}

/** Eén blad met de zes betaalwijzen, gedeeld door elk scherm dat er een moet kiezen. */
export function PaymentMethodSheet({
  visible,
  current,
  cardHint,
  sponsorHint,
  error,
  groupLesson = false,
  onPick,
  onClose,
}: Props): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Betaalwijze</Text>

          <View style={styles.chipRow}>
            {PAYMENT_METHODS.map((method) => (
              <Chip
                key={method}
                label={PAYMENT_LABELS[method]}
                selected={method === current}
                disabled={groupLesson && method !== GROEPSLES_METHOD}
                onPress={() => onPick(method)}
              />
            ))}
          </View>

          {groupLesson ? (
            <Text style={styles.hint}>
              {GROEPSLES_ALLEEN_FACTUUR} Een beurtenkaart en het sponsorbudget gelden alleen
              voor een privéles.
            </Text>
          ) : null}
          {!groupLesson && cardHint ? <Text style={styles.hint}>{cardHint}</Text> : null}
          {/* Twee saldo's onder elkaar: beurten voor de kaart, euro's voor de sponsor.
              Allebei het antwoord op dezelfde vraag — kan deze les hier nog bij? */}
          {!groupLesson && sponsorHint ? <Text style={styles.hint}>{sponsorHint}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Sluiten" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  // Zelfde breedte-cap als de andere bladen: gecentreerd, niet over de volle breedte.
  sheet: {
    width: '100%',
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
    backgroundColor: tennisColors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    ...shadow('lg'),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.sm,
    backgroundColor: tennisColors.border,
    marginBottom: spacing.sm,
  },
  title: { ...typography.h2, color: tennisColors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { ...typography.body, fontSize: 14, color: tennisColors.textMuted, fontStyle: 'italic' },
  error: { color: tennisColors.danger, fontSize: 14 },
});
