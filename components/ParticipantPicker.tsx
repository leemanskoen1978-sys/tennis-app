// De extra spelers van een groepsles kiezen. Eén component, gedeeld door het boekscherm en
// het detailblad: wie er meedoet is dezelfde vraag, of je de les nu aanmaakt of achteraf
// bijstelt, en twee keer overgeschreven zou het twee keer anders gaan werken.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';

import { StudentCombobox } from './ui/StudentCombobox';
import { useT } from '../lib/i18n';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, radius, minTapTarget, webCursor } from '../constants/theme';
import type { User } from '../lib/types';

export function ParticipantPicker({
  players,
  payerId,
  value,
  onChange,
  onRequestCreate,
}: {
  /** Alle spelers waaruit gekozen mag worden (dus geen trainers). */
  players: User[];
  /** De speler die betaalt. Hij staat al op de baan en kan er niet nóg eens bij. */
  payerId: string | undefined;
  value: string[];
  onChange: (ids: string[]) => void;
  /** De trainer wil een nog onbekende naam toevoegen; het scherm opent het invulscherm. */
  onRequestCreate?: (name: string) => void;
}): React.JSX.Element {
  const t = useT();
  const nameOf = (id: string): string =>
    players.find((p) => p.id === id)?.name ?? t('Onbekende speler');

  // Wie al meedoet en de betaler zelf vallen weg uit de keuzelijst: een naam twee keer op de
  // baan zetten kan niet, en zou de les een tariefstap duurder lijken te maken.
  const choosable = players.filter((p) => p.id !== payerId && !value.includes(p.id));

  return (
    <View style={styles.wrap}>
      {value.length > 0 ? (
        <View style={styles.pills}>
          {value.map((id) => (
            <View key={id} style={styles.pill}>
              <Text style={styles.pillText}>{nameOf(id)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${nameOf(id)} van de les halen`}
                onPress={() => onChange(value.filter((other) => other !== id))}
                style={[styles.remove, webCursor]}
              >
                <X size={14} color={tennisColors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {/* De keuzelijst staat na elke keuze weer leeg: hij voegt telkens één naam toe in
          plaats van er één vast te houden. Daarom `value={null}`. */}
      <StudentCombobox
        students={choosable}
        value={null}
        onChange={(id) => {
          if (id) onChange([...value, id]);
        }}
        placeholder={t('Naam van een medespeler…')}
        onRequestCreate={onRequestCreate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.primaryTint,
  },
  pillText: { fontSize: 14, color: tennisColors.text, fontWeight: '600' },
  // Het kruisje zelf is klein; het raakvlak eromheen houdt de app-brede maat aan.
  remove: {
    minHeight: minTapTarget - 12,
    minWidth: minTapTarget - 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
