import React, { type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { Badge } from './Badge';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography, webCursor, minTapTarget } from '../../constants/theme';

/**
 * Eén sectie van een dossier, dichtgeklapt tot één regel.
 *
 * Een dossier heeft vijf secties die allemaal lang kunnen worden; alles tegelijk open
 * betekent eindeloos scrollen. Dichtgeklapt is elke sectie één aantikbare regel: de naam,
 * en daarnaast in het kort wat erin zit ("2 aankomend", "3 doelen"). Zo zie je in één
 * scherm waar dit dossier vol zit, en klap je alleen open wat je nu nodig hebt.
 *
 * De samenvatting staat als subtiele badge naast de naam — zelfde idee als de badge naast
 * een horizon in PlayerGoals, zodat hetzelfde er niet twee keer anders uitziet. De kopstijl
 * is dezelfde `sectionLabel` die het dossier al gebruikte, dus het scherm verandert van
 * indeling, niet van uiterlijk.
 *
 * De open/dicht-stand leeft alleen zolang je op het scherm bent: die onthouden zou state
 * zijn die niemand beheert, en die na een week terugkomen niets meer over jouw bedoeling zegt.
 */
export function CollapsibleSection({ title, summary, open, onToggle, children }: {
  title: string;
  /** Wat er dichtgeklapt over deze sectie te zeggen valt, bv. "2 aankomend". */
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Pressable
        onPress={onToggle}
        style={[styles.header, webCursor]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={
          summary
            ? `${title}: ${summary}. ${open ? 'Dichtklappen' : 'Openklappen'}`
            : `${title}. ${open ? 'Dichtklappen' : 'Openklappen'}`
        }
      >
        <Text style={styles.label}>{title}</Text>
        {summary ? <Badge label={summary} subtle /> : null}
        <View style={styles.spacer} />
        {/* Eén chevron die meedraait: dezelfde pijl wijst naar beneden als de sectie
            openstaat, zodat je ziet dat het om dezelfde knop gaat. */}
        <View style={open ? styles.chevronOpen : undefined}>
          <ChevronDown size={18} color={tennisColors.textMuted} />
        </View>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Geen marge hierboven: Screen zet de afstand tussen zijn kinderen al, en twee keer
  // ruimte maakt van een dichtgeklapte lijst weer een lange lijst.
  section: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTapTarget,
  },
  label: {
    ...typography.label,
    color: tennisColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  spacer: { flex: 1 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  body: { gap: spacing.sm },
});
