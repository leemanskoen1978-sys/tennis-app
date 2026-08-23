// De acht keymoments van één slag, in de volgorde van de beweging.
//
// Twee foto's per moment, naast elkaar op een breed venster en onder elkaar op een telefoon:
// het punt is juist de vergelijking tussen de twee spelers, dus ze horen samen in beeld.
// De foto's zitten in de app zelf (zie lib/keymoments), want op de baan is er vaak geen net.

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Screen, useIsWide } from '../../../../components/ui/Screen';
import { Card } from '../../../../components/ui/Card';
import { slagMet } from '../../../../lib/keymoments';
import { useT } from '../../../../lib/i18n';
import { tennisColors } from '../../../../constants/tennis-colors';
import { spacing, radius, typography } from '../../../../constants/theme';

export default function SlagScreen(): React.JSX.Element {
  const t = useT();
  const isWide = useIsWide();
  const { slag: id } = useLocalSearchParams<{ slag: string }>();
  const slag = slagMet(id);

  if (!slag) {
    return (
      <Screen>
        <Text style={styles.leeg}>{t('Voor deze slag staan er nog geen keymoments klaar.')}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      {slag.keymoments.map((km) => (
        <Card key={km.nummer}>
          <Text style={styles.nummer}>{t('Keymoment {n}', { n: km.nummer })}</Text>
          <Text style={styles.titel}>{t(km.titel)}</Text>
          <View style={[styles.fotos, isWide && styles.fotosNaast]}>
            {km.fotos.map((foto, i) => (
              <Image
                key={i}
                source={foto}
                style={styles.foto}
                // De hele speler moet in beeld blijven; bijsnijden kost net het racket.
                resizeMode="contain"
                accessibilityLabel={t('Keymoment {n}, speler {i}', { n: km.nummer, i: i + 1 })}
              />
            ))}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

// De foto's zijn 1528 op 1108, dus net iets breder dan hoog: die verhouding houdt het vak
// even hoog als het beeld en laat geen band boven en onder staan.
const VERHOUDING = 1528 / 1108;

const styles = StyleSheet.create({
  nummer: { ...typography.label, color: tennisColors.primary, textTransform: 'uppercase' },
  titel: { ...typography.h3, color: tennisColors.text },
  fotos: { gap: spacing.md },
  fotosNaast: { flexDirection: 'row' },
  foto: {
    flex: 1,
    width: '100%',
    aspectRatio: VERHOUDING,
    borderRadius: radius.md,
    backgroundColor: tennisColors.border,
  },
  leeg: { ...typography.body, color: tennisColors.textMuted },
});
