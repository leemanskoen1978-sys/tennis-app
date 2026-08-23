// Keuze van de slag waarvan je de keymoments wilt zien.
//
// Er staat er voorlopig één (forehand). Toch is dit een eigen scherm en geen snelkoppeling
// naar de forehand: backhand en opslag komen erbij, en dan verhuist niemand een tegel.

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera } from 'lucide-react-native';

import { Screen } from '../../../../components/ui/Screen';
import { ActionTile, TileGrid } from '../../../../components/ui/ActionTile';
import { SLAGEN } from '../../../../lib/keymoments';
import { useT } from '../../../../lib/i18n';
import { tennisColors } from '../../../../constants/tennis-colors';
import { spacing, typography } from '../../../../constants/theme';

export default function KeymomentsScreen(): React.JSX.Element {
  const t = useT();
  const router = useRouter();

  return (
    <Screen>
      <Text style={styles.intro}>
        {t('De vaste ijkpunten van een slag, telkens bij twee spelers — zo zie je wat er hetzelfde blijft.')}
      </Text>

      <TileGrid>
        {SLAGEN.map((slag) => (
          <ActionTile
            key={slag.id}
            title={t(slag.naam)}
            subtitle={t('{n} keymoments', { n: slag.keymoments.length })}
            icon={Camera}
            onPress={() => router.push(`/coaches/lessons/keymoments/${slag.id}`)}
          />
        ))}
      </TileGrid>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { ...typography.body, color: tennisColors.textMuted, marginBottom: spacing.xs },
});
