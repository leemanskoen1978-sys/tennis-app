// De kinderen van een ouder: wie er gekoppeld is, wat er nog op goedkeuring wacht, en waar
// je er een aanvraagt.
//
// Een ouder kan hier niemand aanvinken en klaar zijn. Hij vraagt, en een trainer beslist —
// anders zou iedereen die zich als ouder aanmeldt het dossier van elk kind van de club
// kunnen openen door de naam te kiezen. De databank denkt er hetzelfde over: zie
// `ouder_kind_insert` in supabase-schema.sql.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { UserPlus, X } from 'lucide-react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { StudentCombobox } from '../../components/ui/StudentCombobox';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import {
  aanvraagLabel, geweigerdeAanvragen, kandidaten, kinderenVoor, eigenAanvragen,
} from '../../lib/ouderkind';
import { useT, useLanguage } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

export default function KinderenScreen(): React.JSX.Element {
  const t = useT();
  const lang = useLanguage();
  const { currentUser, users, relaties, vraagKindAan, wisRelatie, error } = useSimpleData();
  const [gekozen, setGekozen] = useState<string | null>(null);

  const ouderId = currentUser?.id ?? null;
  const kinderen = useMemo(
    () => kinderenVoor(ouderId, relaties, users, lang),
    [ouderId, relaties, users, lang],
  );
  const wachtend = useMemo(() => eigenAanvragen(ouderId, relaties), [ouderId, relaties]);
  const geweigerd = useMemo(() => geweigerdeAanvragen(ouderId, relaties), [ouderId, relaties]);
  const teKiezen = useMemo(
    () => kandidaten(ouderId, relaties, users, lang),
    [ouderId, relaties, users, lang],
  );

  // Alleen een ouder heeft hier iets te zoeken. Een trainer beslist over deze aanvragen in
  // Beheer, en een speler heeft geen kinderen aan de club.
  if (currentUser && currentUser.role !== 'parent') return <Redirect href="/" />;

  const naam = (id: string) => users.find((u) => u.id === id)?.name ?? t('Onbekend');

  const vraagAan = async (): Promise<void> => {
    if (!gekozen) return;
    await vraagKindAan(gekozen);
    setGekozen(null);
  };

  return (
    <Screen>
      <Card>
        <Text style={styles.kop}>{t('Kind toevoegen')}</Text>
        <Text style={styles.uitleg}>
          {t('Zoek je kind op naam. Een trainer keurt de koppeling goed; daarna zie je zijn '
            + 'lessen, zijn saldo en zijn voortgang.')}
        </Text>
        <StudentCombobox
          students={teKiezen}
          value={gekozen}
          onChange={setGekozen}
          placeholder={t('Typ de naam van je kind…')}
        />
        <Button
          label={t('Aanvragen')}
          variant="primary"
          icon={<UserPlus size={18} color={tennisColors.onFill} />}
          disabled={!gekozen}
          onPress={() => { void vraagAan(); }}
          style={styles.knop}
        />
        {error ? <Text style={styles.fout}>{error}</Text> : null}
      </Card>

      {kinderen.length > 0 ? (
        <>
          <Text style={styles.sectie}>{t('Gekoppeld')}</Text>
          {kinderen.map((kind) => (
            <Card key={kind.id} style={styles.rij}>
              <Text style={styles.naam}>{kind.name}</Text>
              <Badge label={t('Goedgekeurd')} color={tennisColors.primaryFill} />
            </Card>
          ))}
        </>
      ) : null}

      {wachtend.length > 0 ? (
        <>
          <Text style={styles.sectie}>{t('Aangevraagd')}</Text>
          {wachtend.map((r) => (
            <Card key={r.id} style={styles.rij}>
              <View style={styles.rijTekst}>
                <Text style={styles.naam}>{naam(r.child_id)}</Text>
                <Text style={styles.meta}>{aanvraagLabel(r)}</Text>
              </View>
              {/* Intrekken kan: een vraag die je niet meer wilt stellen hoort te kunnen
                  verdwijnen, en dan kun je hem later opnieuw stellen. */}
              <Button
                label={t('Intrekken')}
                variant="secondary"
                fullWidth={false}
                onPress={() => { void wisRelatie(r.id); }}
              />
            </Card>
          ))}
        </>
      ) : null}

      {geweigerd.length > 0 ? (
        <>
          <Text style={styles.sectie}>{t('Niet goedgekeurd')}</Text>
          {geweigerd.map((r) => (
            <Card key={r.id} style={styles.rij}>
              <View style={styles.icoon}><X size={18} color={tennisColors.danger} /></View>
              <View style={styles.rijTekst}>
                <Text style={styles.naam}>{naam(r.child_id)}</Text>
                <Text style={styles.meta}>
                  {t('Vraag het na bij de trainer als dit niet klopt.')}
                </Text>
              </View>
              {/* Weghalen maakt de weg vrij om het opnieuw te vragen: de databank laat maar
                  één aanvraag per paar toe. */}
              <Button
                label={t('Weghalen')}
                variant="secondary"
                fullWidth={false}
                onPress={() => { void wisRelatie(r.id); }}
              />
            </Card>
          ))}
        </>
      ) : null}

      {kinderen.length === 0 && wachtend.length === 0 && geweigerd.length === 0 ? (
        <Text style={styles.leeg}>{t('Je hebt nog geen kind gekoppeld.')}</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kop: { ...typography.h3, color: tennisColors.text },
  uitleg: {
    ...typography.body, fontSize: 14, color: tennisColors.textMuted,
    marginTop: spacing.xs, marginBottom: spacing.md,
  },
  knop: { marginTop: spacing.md },
  sectie: { ...typography.h2, color: tennisColors.text, marginTop: spacing.sm },
  rij: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rijTekst: { flex: 1 },
  icoon: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: tennisColors.dangerTint,
  },
  naam: { ...typography.h3, color: tennisColors.text },
  meta: { fontSize: 13, color: tennisColors.textMuted },
  leeg: { ...typography.body, color: tennisColors.textMuted },
  fout: { color: tennisColors.danger, fontSize: 13, marginTop: spacing.sm },
});
