// Beheer → Leden: de ledenlijst van de club, en achter elke naam een blad om alles aan te
// passen. Alleen voor een beheerder.
//
// Waarom alleen hij: hier staat het beheerdersvinkje, hier verdwijnt een lid met zijn hele
// geschiedenis, en hier verandert het e-mailadres waarmee iemand inlogt. Dat zijn precies de
// dingen waarvan het bestaan van een beheerder de reden is. Een gewone trainer houdt wat hij
// had — hij maakt spelers aan en werkt zijn eigen gegevens bij.
//
// Wat je hier NIET vindt: werkuren en werkdagen van een trainer. Die staan in zijn eigen
// dossier, waar ze bij de agenda horen die ze bepalen.

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LidBewerken } from '../../components/LidBewerken';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { ledenLijst } from '../../lib/leden';
import { isAdmin, isCoach, roleLabel } from '../../lib/rechten';
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, typography } from '../../constants/theme';
import type { User } from '../../lib/types';

export default function LedenScreen(): React.JSX.Element {
  const t = useT();
  const router = useRouter();
  const { currentUser, users } = useSimpleData();

  const [zoek, setZoek] = useState('');
  const [open, setOpen] = useState<User | null>(null);

  const lijst = useMemo(() => ledenLijst(users, zoek), [users, zoek]);

  // De tegel staat er alleen voor een beheerder, maar een adres is te typen. Wie hier
  // buiten zijn recht komt, krijgt geen lege lijst maar te lezen waarom.
  if (!isAdmin(currentUser)) {
    return (
      <Screen>
        <Text style={styles.geenRecht}>
          {t('Dit scherm is voor een beheerder. Vraag er een om je het vinkje te geven.')}
        </Text>
      </Screen>
    );
  }

  // Het lid uit de opslag en niet de kopie van toen je hem aantikte: wijzigt er iets in het
  // blad, dan hoort het blad dat zelf ook te zien.
  const geopend = open ? users.find((u) => u.id === open.id) ?? null : null;

  return (
    <Screen>
      <TextInput
        style={styles.zoek}
        value={zoek}
        onChangeText={setZoek}
        placeholder={t('Zoek op naam of e-mailadres')}
        placeholderTextColor={tennisColors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.telling}>
        {lijst.length === 1 ? t('1 lid') : t('{n} leden', { n: lijst.length })}
      </Text>

      {lijst.length === 0 ? (
        <Text style={styles.leeg}>{t('Geen lid gevonden.')}</Text>
      ) : null}

      {lijst.map((lid) => (
        <Card key={lid.id} onPress={() => setOpen(lid)} accessibilityLabel={lid.name}>
          <View style={styles.rij}>
            <View style={styles.naamKolom}>
              <Text style={styles.naam} numberOfLines={1}>{lid.name}</Text>
              <Text style={styles.mail} numberOfLines={1}>{lid.email}</Text>
            </View>
            <View style={styles.badges}>
              {isAdmin(lid) ? (
                <Badge label={t('Beheerder')} color={tennisColors.warningFill} />
              ) : null}
              <Badge
                label={roleLabel(lid.role)}
                color={tennisColors.primaryFill}
                subtle={!isCoach(lid)}
              />
            </View>
          </View>
        </Card>
      ))}

      {geopend ? (
        <LidBewerken lid={geopend} visible onClose={() => setOpen(null)} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  zoek: {
    backgroundColor: tennisColors.surface,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: tennisColors.text,
  },
  telling: { ...typography.body, color: tennisColors.text, fontWeight: '600' },
  leeg: { ...typography.body, color: tennisColors.textMuted },
  geenRecht: { ...typography.body, color: tennisColors.textMuted },
  rij: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  naamKolom: { flexShrink: 1, gap: 2 },
  naam: { ...typography.h3, color: tennisColors.text },
  mail: { fontSize: 13, color: tennisColors.textMuted },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
