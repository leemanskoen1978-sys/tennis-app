// Beheer → Lessen beheren → Lesplanning: wat er wanneer aan wie is doorgestuurd.
//
// Alleen het overzicht. Doorsturen zelf gebeurt in de databank, bij de training — daar zoek je
// het materiaal toch al, en daar hoeft er dus geen kiezer voor te bestaan. Dit scherm hield die
// kiezer eerst wel, naast een kiezer voor 193 lesgroepen en een voor twaalf trainers, en dat was
// een muur van knoppen waarin niemand iets terugvond.
//
// Wat hier blijft is de andere helft: één plek waar je in één lijst ziet wat er loopt, en de
// enige plek waar je iets weghaalt. Twee plekken om iets weg te gooien is één te veel.
//
// Wat voorbij is blijft staan. Die rijen zijn de geschiedenis van wat er wanneer gegeven werd,
// en dat is de helft van waarom ze bestaan; wie ze opruimt, maakt van een planning een
// momentopname.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Screen } from '../../../components/ui/Screen';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useSimpleData } from '../../../providers/SimpleDataProvider';
import { periodeTekst } from '../../../lib/vakanties';
import { isAdmin } from '../../../lib/rechten';
import { useT } from '../../../lib/i18n';
import { tennisColors } from '../../../constants/tennis-colors';
import { spacing, typography } from '../../../constants/theme';

export default function LesplanningScreen(): React.JSX.Element {
  const t = useT();
  const { currentUser, users, lessons, lesGroepen, lesPlanning, verwijderLesplanning, error } =
    useSimpleData();

  // Welke rij om een bevestiging vraagt voor ze weggaat; null = geen. Eén tegelijk, zodat de
  // knop van de ene rij nooit de andere kan raken.
  const [weghalen, setWeghalen] = useState<string | null>(null);

  const rijen = useMemo(
    () => [...lesPlanning].sort((a, b) => b.van.localeCompare(a.van)),
    [lesPlanning],
  );

  // De grens staat op het scherm zelf en niet alleen op de tegel ernaartoe: een trainer kan deze
  // link intikken (TOEG-01, zie de werklijst van een ziekmelding).
  if (!isAdmin(currentUser)) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Lesplanning is alleen voor de beheerder.')}</Text>
      </Screen>
    );
  }

  const titelVan = (id: string): string =>
    lessons.find((l) => l.id === id)?.title ?? t('Onbekend lesmateriaal');
  const naamVan = (id: string): string => users.find((u) => u.id === id)?.name ?? t('Onbekend');
  const groepVan = (id: string): string =>
    lesGroepen.find((g) => g.id === id)?.name ?? t('Onbekende groep');

  return (
    <Screen>
      <Text style={styles.uitleg}>
        {t('Hier staat wat er aan wie is doorgestuurd, en voor welke periode. Doorsturen doe je '
          + 'in Lesmateriaal → Databank: zoek de training en gebruik "Doorsturen naar…".')}
      </Text>

      {error ? <Text style={styles.fout}>{error}</Text> : null}

      {rijen.length === 0 ? (
        <Text style={styles.muted}>{t('Er is nog niets doorgestuurd.')}</Text>
      ) : null}

      {rijen.map((p) => (
        <Card key={p.id}>
          <Text style={styles.titel}>{titelVan(p.lesson_id)}</Text>
          <Text style={styles.meta}>{periodeTekst(p.van, p.tot)}</Text>
          <Text style={styles.meta}>
            {p.coach_id && p.group_id
              ? t('{groep} bij {trainer}', {
                groep: groepVan(p.group_id), trainer: naamVan(p.coach_id),
              })
              : p.group_id
                ? groepVan(p.group_id)
                : naamVan(p.coach_id ?? '')}
          </Text>
          {weghalen === p.id ? (
            <View style={styles.knopRij}>
              <Button
                label={t('Ja, weghalen')}
                onPress={() => { setWeghalen(null); void verwijderLesplanning(p.id); }}
              />
              <Button
                label={t('Laat maar')}
                variant="secondary"
                onPress={() => setWeghalen(null)}
              />
            </View>
          ) : (
            <Button
              label={t('Weghalen')}
              variant="secondary"
              onPress={() => setWeghalen(p.id)}
            />
          )}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  uitleg: { ...typography.body, color: tennisColors.textMuted },
  titel: { ...typography.h3, color: tennisColors.text },
  meta: { fontSize: 13, color: tennisColors.textMuted },
  knopRij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fout: { color: tennisColors.danger, fontSize: 14, marginTop: spacing.sm },
  muted: { ...typography.body, color: tennisColors.textMuted },
});
