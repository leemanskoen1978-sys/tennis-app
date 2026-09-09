// Dit lesmateriaal doorsturen: aan welke trainer en/of groep, en voor welke periode.
//
// Staat waar je het materiaal al gevonden hebt — in het lesdetail van een training, vanuit de
// databank. Dat scheelt de hele materiaalkiezer: de training die je open hebt ís het materiaal.
// Het beheerscherm hield eerst ook een kiezer voor materiaal, en dat was een muur van chips
// naast de twee andere muren; zoeken doe je in de databank, dus daar hoort het te gebeuren.
//
// Dit onderdeel beslist niets zelf. Of de invoer deugt weet `lesplanningFout` en het
// wegschrijven doet `voegLesplanningToe` — hier staat alleen hoe het eruitziet.

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Button } from './ui/Button';
import { ChipKiezer } from './ui/ChipKiezer';
import { DatumVeld } from './ui/DatumVeld';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { lesplanningFout } from '../lib/lesplanning';
import { dagSleutel } from '../lib/vakanties';
import { parseDayInput } from '../lib/period';
import { coachesOf } from '../lib/hub';
import { DAY_LABELS } from '../lib/slots';
import { useT } from '../lib/i18n';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, typography } from '../constants/theme';

export function LesplanningToevoegen({ lessonId, onKlaar }: {
  lessonId: string;
  /** Wordt aangeroepen na een geslaagde doorsturing, zodat het blad zich kan sluiten. */
  onKlaar: () => void;
}): React.JSX.Element {
  const t = useT();
  const { users, lesGroepen, voegLesplanningToe, error } = useSimpleData();

  const [coachId, setCoachId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [van, setVan] = useState('');
  const [tot, setTot] = useState('');
  const [zoekTrainer, setZoekTrainer] = useState('');
  const [zoekGroep, setZoekGroep] = useState('');

  const trainers = coachesOf(users);
  const groepen = lesGroepen.filter((g) => !g.archived);

  /**
   * Wat er op de chip van een groep staat: de naam, en daarachter de dag en het uur. Zonder die
   * twee zijn de groepen van deze club niet van elkaar te houden — er zijn er tientallen die
   * letterlijk "Groep" of "Priveles" heten. Dezelfde opbouw als in Beheer → Lesgroepen.
   */
  const groepLabel = (g: (typeof groepen)[number]): string => {
    const dag = g.weekday >= 0 && g.weekday <= 6 ? t(DAY_LABELS[g.weekday]) : '';
    const uur = `${String(g.start_hour).padStart(2, '0')}:${String(g.start_minute).padStart(2, '0')}`;
    return `${g.name} · ${dag} ${uur}`;
  };

  // `DatumVeld` levert dd/mm/jjjj; `lesplanningFout` en `Lesplanning` rekenen met jjjj-mm-dd.
  // Een half getypte datum wordt een lege sleutel, en `lesplanningFout` maakt daar de ene
  // melding van die overal in de app hetzelfde luidt — hier staat met opzet geen tweede versie
  // van diezelfde regel. Zelfde omzetting als in het ziekmeldingscherm.
  const vanDatum = parseDayInput(van);
  const totDatum = parseDayInput(tot);
  const vanSleutel = vanDatum ? dagSleutel(vanDatum) : '';
  const totSleutel = totDatum ? dagSleutel(totDatum) : '';

  const fout = lesplanningFout(lessonId, coachId, groupId, vanSleutel, totSleutel);

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
    setCoachId(''); setGroupId(''); setVan(''); setTot('');
    setZoekTrainer(''); setZoekGroep('');
    onKlaar();
  };

  return (
    <View style={styles.blok}>
      <Text style={styles.label}>{t('Trainer')}</Text>
      <ChipKiezer
        items={trainers}
        label={(c) => c.name}
        gekozen={coachId}
        onKies={(id) => setCoachId(coachId === id ? '' : id)}
        zoek={zoekTrainer}
        onZoek={setZoekTrainer}
        plaatshouder={t('Zoek een trainer…')}
      />

      <Text style={styles.label}>{t('Groep')}</Text>
      <ChipKiezer
        items={groepen}
        label={groepLabel}
        gekozen={groupId}
        onKies={(id) => setGroupId(groupId === id ? '' : id)}
        zoek={zoekGroep}
        onZoek={setZoekGroep}
        plaatshouder={t('Zoek een groep…')}
      />

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

      {/* De melding komt pas als er iets ingevuld is: een leeg formulier verwijten dat het leeg
          is, helpt niemand. Geen `Alert` — die blokkeert op web, en je wil de melding kunnen
          lezen terwijl je het veld verbetert. */}
      {fout !== null && (coachId !== '' || groupId !== '' || van !== '' || tot !== '') ? (
        <Text style={styles.fout}>{fout}</Text>
      ) : null}
      {error ? <Text style={styles.fout}>{error}</Text> : null}

      <Button
        label={t('Doorsturen')}
        disabled={fout !== null}
        onPress={() => { void stuurDoor(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blok: { gap: spacing.xs, marginTop: spacing.sm },
  label: { ...typography.label, color: tennisColors.textMuted, marginTop: spacing.sm },
  datumRij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  veld: { flexGrow: 1, flexBasis: 140 },
  fout: { color: tennisColors.danger, fontSize: 14, marginTop: spacing.sm },
});
