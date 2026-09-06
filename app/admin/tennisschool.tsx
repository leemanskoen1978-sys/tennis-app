// Beheer → Lessen beheren: de ingang van de tennisschool.
//
// Deze vier schermen stonden los tussen de tegels van Beheer, in de groep "Club", waar ze
// samen met de banen, de leden en de ouders één bak vormden van twaalf. Ze horen bij elkaar
// om één reden: ze gaan allemaal over de lessen van de school en niet over de club eromheen.
// Wie de groepen indeelt, is dezelfde die een zieke trainer vervangt en die het seizoen in
// en uit Excel haalt.
//
// Alles hier is van de beheerder — daarom staat de grens één keer bovenaan dit scherm in
// plaats van vier keer op een tegel.

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { GraduationCap, Thermometer, FileUp, FileSpreadsheet } from 'lucide-react-native';

import { Screen } from '../../components/ui/Screen';
import { ActionTile, TileGrid } from '../../components/ui/ActionTile';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { isAdmin } from '../../lib/rechten';
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { typography } from '../../constants/theme';

export default function TennisschoolScreen(): React.JSX.Element {
  const t = useT();
  const router = useRouter();
  const { currentUser } = useSimpleData();

  // De grens staat hier, en niet alleen op de tegel in Beheer: een verborgen tegel is geen
  // toegangscontrole, want een trainer kan de link gewoon intikken (TOEG-01). De databank
  // weigert hem daarna ook — dit zorgt dat hij het scherm niet eens te zien krijgt.
  if (!isAdmin(currentUser)) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Lessen beheren is alleen voor de beheerder.')}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.uitleg}>
        {t('Alles wat de lessen van de tennisschool draaiende houdt: wie in welke groep zit, '
          + 'wie een les overneemt als een trainer uitvalt, en het seizoen dat in en uit '
          + 'Excel gaat.')}
      </Text>

      <TileGrid>
        <ActionTile
          title={t('Lesgroepen')}
          subtitle={t('Naam, niveau, rooster en spelers')}
          icon={GraduationCap}
          onPress={() => router.push('/admin/lesgroepen')}
        />
        <ActionTile
          title={t('Ziekmelding')}
          subtitle={t('Werklijst en vervangers')}
          icon={Thermometer}
          onPress={() => router.push('/admin/ziekmelding')}
        />
        <ActionTile
          title={t('Trainingen importeren')}
          subtitle={t('Een seizoen uit Excel')}
          icon={FileUp}
          onPress={() => router.push('/admin/trainingen-import')}
        />
        <ActionTile
          title={t('Trainingen exporteren')}
          subtitle={t('Eén Excel-bestand per periode')}
          icon={FileSpreadsheet}
          onPress={() => router.push('/admin/export')}
        />
      </TileGrid>
    </Screen>
  );
}

const styles = StyleSheet.create({
  uitleg: { ...typography.body, color: tennisColors.textMuted },
  muted: { ...typography.body, color: tennisColors.textMuted },
});
