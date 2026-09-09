// Beheer → Lessen beheren → Lesplanning: welk lesmateriaal er wanneer aan de orde is.
//
// Waarom dit scherm bestaat: de tennisschool werkt met een lessenboekje, en tot nu leefde die
// afspraak buiten de app. Een trainer die op zijn lesdag keek, zag niet wat hij hoorde te geven.
//
// Dit scherm rekent zelf niets uit. Of de invoer deugt weet `lesplanningFout`, en welk materiaal
// er voor een les geldt weet `materiaalVoor` — beide in lib/lesplanning, met tests eromheen.
// Hier staat alleen hoe het eruitziet en welke knop welke schrijfweg aanroept.
//
// Wat voorbij is blijft in de lijst staan. Die rijen zijn de geschiedenis van wat er wanneer
// gegeven werd, en dat is de helft van waarom ze bestaan; wie ze opruimt, maakt van een planning
// een momentopname.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Screen } from '../../../components/ui/Screen';
import { Card } from '../../../components/ui/Card';
import { Chip } from '../../../components/ui/Chip';
import { Button } from '../../../components/ui/Button';
import { DatumVeld } from '../../../components/ui/DatumVeld';
import { useSimpleData } from '../../../providers/SimpleDataProvider';
import { lesplanningFout } from '../../../lib/lesplanning';
import { dagSleutel, periodeTekst } from '../../../lib/vakanties';
import { parseDayInput } from '../../../lib/period';
import { coachesOf } from '../../../lib/hub';
import { isAdmin } from '../../../lib/rechten';
import { useT } from '../../../lib/i18n';
import { tennisColors } from '../../../constants/tennis-colors';
import { spacing, typography } from '../../../constants/theme';

export default function LesplanningScreen(): React.JSX.Element {
  const t = useT();
  const {
    currentUser, users, lessons, lesGroepen, lesPlanning,
    voegLesplanningToe, verwijderLesplanning, error,
  } = useSimpleData();

  const [lessonId, setLessonId] = useState('');
  const [coachId, setCoachId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [van, setVan] = useState('');
  const [tot, setTot] = useState('');
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

  // De bibliotheek: materiaal dat niet aan één speler hangt. Zelfde filter als
  // `AssignLessonModal` — persoonlijk materiaal stuur je niet naar een hele groep door.
  const bibliotheek = lessons.filter((l) => !l.student_id);
  const trainers = coachesOf(users);
  const groepen = lesGroepen.filter((g) => !g.archived);

  // `DatumVeld` levert dd/mm/jjjj; `lesplanningFout` en `Lesplanning` rekenen met jjjj-mm-dd.
  // Een half getypte datum wordt een lege sleutel, en `lesplanningFout` maakt daar de ene
  // melding van die overal in de app hetzelfde luidt — hier staat met opzet geen tweede versie
  // van diezelfde regel. Zelfde omzetting als in het ziekmeldingscherm.
  const vanDatum = parseDayInput(van);
  const totDatum = parseDayInput(tot);
  const vanSleutel = vanDatum ? dagSleutel(vanDatum) : '';
  const totSleutel = totDatum ? dagSleutel(totDatum) : '';

  const fout = lesplanningFout(lessonId, coachId, groupId, vanSleutel, totSleutel);

  const titelVan = (id: string): string =>
    lessons.find((l) => l.id === id)?.title ?? t('Onbekend lesmateriaal');
  const naamVan = (id: string): string => users.find((u) => u.id === id)?.name ?? t('Onbekend');
  const groepVan = (id: string): string =>
    lesGroepen.find((g) => g.id === id)?.name ?? t('Onbekende groep');

  const stuurDoor = async (): Promise<void> => {
    if (fout !== null) return;
    await voegLesplanningToe({
      lesson_id: lessonId,
      // Leeg is `undefined` op het type en niet een lege tekst: zo leest `geldtVoor` het, en zo
      // komt er ook geen lege verwijzing in de databank.
      coach_id: coachId === '' ? undefined : coachId,
      group_id: groupId === '' ? undefined : groupId,
      van: vanSleutel,
      tot: totSleutel,
    });
    setLessonId(''); setCoachId(''); setGroupId(''); setVan(''); setTot('');
  };

  return (
    <Screen>
      <Text style={styles.uitleg}>
        {t('Kies lesmateriaal en een periode, en zeg voor wie het geldt: een trainer, een '
          + 'groep, of een groep bij een trainer. De trainer ziet het bij zijn les staan.')}
      </Text>

      <Card>
        <Text style={styles.label}>{t('Lesmateriaal')}</Text>
        {bibliotheek.length === 0 ? (
          <Text style={styles.muted}>
            {t('Er staat nog geen lesmateriaal in de bibliotheek.')}
          </Text>
        ) : (
          <View style={styles.chipRij}>
            {bibliotheek.map((l) => (
              <Chip
                key={l.id}
                label={l.title}
                selected={lessonId === l.id}
                onPress={() => setLessonId(lessonId === l.id ? '' : l.id)}
              />
            ))}
          </View>
        )}

        <Text style={styles.label}>{t('Trainer')}</Text>
        <View style={styles.chipRij}>
          {trainers.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={coachId === c.id}
              onPress={() => setCoachId(coachId === c.id ? '' : c.id)}
            />
          ))}
        </View>

        <Text style={styles.label}>{t('Groep')}</Text>
        <View style={styles.chipRij}>
          {groepen.map((g) => (
            <Chip
              key={g.id}
              label={g.name}
              selected={groupId === g.id}
              onPress={() => setGroupId(groupId === g.id ? '' : g.id)}
            />
          ))}
        </View>

        <View style={styles.datumRij}>
          <View style={styles.veld}>
            <Text style={styles.label}>{t('Van')}</Text>
            <DatumVeld waarde={van} onChange={setVan} />
          </View>
          <View style={styles.veld}>
            <Text style={styles.label}>{t('Tot en met')}</Text>
            <DatumVeld waarde={tot} onChange={setTot} />
          </View>
        </View>

        {/* De melding staat bij het formulier en niet in een alert: die blokkeert op web, en je
            wil hem kunnen lezen terwijl je het veld verbetert. Hij komt pas als er iets
            ingevuld is — een leeg formulier verwijten dat het leeg is, helpt niemand. */}
        {fout !== null && (lessonId !== '' || van !== '' || tot !== '') ? (
          <Text style={styles.fout}>{fout}</Text>
        ) : null}
        {error ? <Text style={styles.fout}>{error}</Text> : null}

        <Button
          label={t('Doorsturen')}
          disabled={fout !== null}
          onPress={() => { void stuurDoor(); }}
          style={styles.knop}
        />
      </Card>

      <Text style={styles.section}>{t('Doorgestuurd')}</Text>
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
  section: { ...typography.h2, color: tennisColors.text, marginTop: spacing.sm },
  label: { ...typography.label, color: tennisColors.textMuted, marginTop: spacing.sm },
  chipRij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  datumRij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  veld: { flexGrow: 1, flexBasis: 140 },
  knop: { marginTop: spacing.md },
  knopRij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  titel: { ...typography.h3, color: tennisColors.text },
  meta: { fontSize: 13, color: tennisColors.textMuted },
  fout: { color: tennisColors.danger, fontSize: 14, marginTop: spacing.sm },
  muted: { ...typography.body, color: tennisColors.textMuted },
});
