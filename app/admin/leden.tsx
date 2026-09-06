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
//
// Een lid erbij en een hele lijst erbij horen hier ook thuis en niet als losse tegels: het is
// hetzelfde onderwerp, en je wil ze bij de hand hebben terwijl je naar de ledenlijst kijkt.
// Toevoegen gebeurt in een blad op dit scherm; importeren blijft een eigen scherm, want dat is
// een flow met een proefronde die niet in een lijst te persen valt.

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { UserPlus, Upload, ChevronRight } from 'lucide-react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LidBewerken } from '../../components/LidBewerken';
import { UserManagement } from '../../components/UserManagement';
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
  // Het blad om een speler aan te maken stond eerder op de tegelpagina. Die hield daarmee de
  // state vast van een scherm dat ze niet toont; hier hoort ze, naast de lijst waarin de nieuwe
  // speler meteen verschijnt.
  const [toevoegenOpen, setToevoegenOpen] = useState(false);

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

      <View style={styles.acties}>
        <Button
          label={t('Speler toevoegen')}
          icon={<UserPlus size={16} color={tennisColors.onFill} />}
          fullWidth={false}
          onPress={() => setToevoegenOpen(true)}
        />
      </View>

      {/* Een eigen scherm en geen blad: importeren gaat in stappen, met een proefronde die je
          eerst wil nalezen. */}
      <Card
        onPress={() => router.push('/admin/leden-import')}
        accessibilityLabel={t('Leden importeren')}
      >
        <View style={styles.rij}>
          <Upload size={18} color={tennisColors.textMuted} />
          <View style={styles.naamKolom}>
            <Text style={styles.naam}>{t('Leden importeren')}</Text>
            <Text style={styles.mail}>{t('Uit een Excel-lijst')}</Text>
          </View>
          <ChevronRight size={18} color={tennisColors.textMuted} />
        </View>
      </Card>

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

      <UserManagement visible={toevoegenOpen} onClose={() => setToevoegenOpen(false)} />
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
  acties: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  telling: { ...typography.body, color: tennisColors.text, fontWeight: '600' },
  leeg: { ...typography.body, color: tennisColors.textMuted },
  geenRecht: { ...typography.body, color: tennisColors.textMuted },
  rij: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  naamKolom: { flexShrink: 1, gap: 2 },
  naam: { ...typography.h3, color: tennisColors.text },
  mail: { fontSize: 13, color: tennisColors.textMuted },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
