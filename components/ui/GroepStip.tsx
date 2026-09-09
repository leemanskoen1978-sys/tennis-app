// De lesgroep van een les, met haar kleur ervoor: ● Kidstennis blauw.
//
// Deze club deelt haar groepen in naar kleur, en zo praten trainers en ouders er ook over
// ("hij zit bij de blauwen"). Alleen het woord tonen laat je dat elke keer opnieuw lezen; het
// bolletje maakt er iets van dat je in één oogopslag herkent tussen drie lessen.
//
// Welke kleur bij welke groep hoort, staat in lib/groepskleur en is daar getest: uit het
// niveau, en anders uit de naam. Dit bestand tekent alleen — en tekent geen bolletje als er
// nergens een kleur in staat: "Volwassenen gevorderden" is een volwaardige groep en krijgt
// gewoon haar tekst, geen grijze plaatshouder.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { groepskleur } from '../../lib/groepskleur';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

export function GroepStip({
  niveau,
  naam,
}: {
  niveau: string | null | undefined;
  naam?: string | null;
}): React.JSX.Element | null {
  // Wat er te lezen valt is het niveau; de naam doet alleen mee voor de kleur. Staat er geen
  // niveau, dan is er niets te tonen — een los bolletje zegt niemand iets.
  const tekst = niveau?.trim();
  if (!tekst) return null;
  const kleur = groepskleur(niveau, naam);

  return (
    <View style={styles.rij}>
      {kleur ? (
        // De rand hoort er altijd bij en niet alleen bij wit: hij houdt een lichte kleur
        // zichtbaar op een witte kaart en tekent de rest netjes af. Een half doorzichtige
        // zwarte rand doet dat in beide thema's, want hij volgt de kleur eronder.
        <View style={[styles.stip, { backgroundColor: kleur.hex }]} />
      ) : null}
      <Text style={styles.tekst}>{tekst}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rij: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stip: {
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)',
  },
  tekst: { ...typography.label, color: tennisColors.textMuted },
});
