// Beheer → Clubkalender: de dagen waarop de club geen les geeft.
//
// Zonder deze lijst rekent de app door alsof er elke week les is. Een reeks van september
// tot mei zet dan lessen in de herfstvakantie en op 11 november, en Reserveren biedt op die
// dagen gewoon vrije uren aan — waarna iemand ze één voor één moet terugvinden en schrappen.
// Precies het werk dat een reeks moest besparen.
//
// De lijst hangt aan de clubinstellingen en niet aan een trainer: een vakantie geldt voor
// iedereen. Wat een enkele trainer niet werkt, staat in zijn eigen werkdagen.

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { CalendarOff, Plus, Trash2 } from 'lucide-react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { newId } from '../../providers/mockStore';
import { formatDayInput, parseDayInput } from '../../lib/period';
import {
  dagSleutel, sorteerVakanties, vakantieDagen, vakantieFout, vakantiePeriode,
} from '../../lib/vakanties';
import { isCoach } from '../../lib/rechten';
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, typography } from '../../constants/theme';
import type { Vakantie } from '../../lib/types';

export default function VakantiesScreen(): React.JSX.Element {
  const t = useT();
  const { currentUser, settings, saveSettings, error } = useSimpleData();

  const [naam, setNaam] = useState('');
  const [van, setVan] = useState('');
  const [tot, setTot] = useState('');
  const [fout, setFout] = useState<string | null>(null);

  const vakanties = useMemo(
    () => sorteerVakanties(settings.vakanties ?? []),
    [settings.vakanties],
  );

  if (!isCoach(currentUser)) {
    return (
      <Screen>
        <Text style={styles.muted}>{t('Beheer is alleen voor trainers.')}</Text>
      </Screen>
    );
  }

  const bewaar = (lijst: Vakantie[]): void => {
    void saveSettings({ ...settings, vakanties: lijst });
  };

  const voegToe = (): void => {
    const vanDag = parseDayInput(van);
    // Eén dag invullen mag: laat je "tot" leeg, dan is het die ene dag. Een feestdag is
    // vaker één dag dan een week, en twee keer dezelfde datum tikken is werk voor niets.
    const totDag = tot.trim().length === 0 ? vanDag : parseDayInput(tot);
    const melding = vakantieFout(
      naam,
      vanDag ? dagSleutel(vanDag) : '',
      totDag ? dagSleutel(totDag) : '',
    );
    if (melding || !vanDag || !totDag) {
      setFout(melding ?? t('Vul beide dagen in als dd/mm/jjjj.'));
      return;
    }
    setFout(null);
    bewaar([...vakanties, {
      id: newId('vak'),
      naam: naam.trim(),
      van: dagSleutel(vanDag),
      tot: dagSleutel(totDag),
    }]);
    setNaam('');
    setVan('');
    setTot('');
  };

  return (
    <Screen>
      <Text style={styles.uitleg}>
        {t('Op deze dagen geeft de club geen les. Een herhalende reeks stapt eroverheen, '
          + 'Reserveren biedt er geen uren aan en de weekagenda toont ze als gesloten. '
          + 'Lessen die er al staan blijven staan.')}
      </Text>

      <Card>
        <Text style={styles.label}>{t('Naam')}</Text>
        <TextInput
          style={styles.input}
          value={naam}
          onChangeText={setNaam}
          placeholder={t('bv. Herfstvakantie')}
          placeholderTextColor={tennisColors.textMuted}
        />

        <View style={styles.datumRij}>
          <View style={styles.veld}>
            <Text style={styles.label}>{t('Van')}</Text>
            <TextInput
              style={styles.input}
              value={van}
              onChangeText={setVan}
              placeholder={t('dd/mm/jjjj')}
              placeholderTextColor={tennisColors.textMuted}
              inputMode="numeric"
            />
          </View>
          <View style={styles.veld}>
            <Text style={styles.label}>{t('Tot en met')}</Text>
            <TextInput
              style={styles.input}
              value={tot}
              onChangeText={setTot}
              placeholder={t('leeg = dezelfde dag')}
              placeholderTextColor={tennisColors.textMuted}
              inputMode="numeric"
            />
          </View>
        </View>

        {fout ? <Text style={styles.fout}>{fout}</Text> : null}
        {error ? <Text style={styles.fout}>{error}</Text> : null}

        <Button
          label={t('Toevoegen')}
          onPress={voegToe}
          icon={<Plus size={16} color={tennisColors.onFill} />}
          style={styles.knop}
        />
      </Card>

      {vakanties.length === 0 ? (
        <Text style={styles.muted}>
          {t('Nog geen vakanties. Zolang deze lijst leeg is, rekent de app met les het hele '
            + 'jaar door.')}
        </Text>
      ) : (
        <Text style={styles.telling}>
          {vakanties.length === 1
            ? t('1 periode zonder les')
            : t('{n} periodes zonder les', { n: vakanties.length })}
        </Text>
      )}

      {vakanties.map((v) => (
        <Card key={v.id}>
          <View style={styles.rij}>
            <CalendarOff size={18} color={tennisColors.textMuted} />
            <View style={styles.rijTekst}>
              <Text style={styles.naam}>{v.naam}</Text>
              <Text style={styles.periode}>
                {vakantiePeriode(v)}
                {' · '}
                {vakantieDagen(v) === 1
                  ? t('1 dag')
                  : t('{n} dagen', { n: vakantieDagen(v) })}
              </Text>
            </View>
            <Button
              label={t('Weg')}
              variant="secondary"
              fullWidth={false}
              icon={<Trash2 size={14} color={tennisColors.text} />}
              onPress={() => bewaar(vakanties.filter((x) => x.id !== v.id))}
            />
          </View>
        </Card>
      ))}

      {/* Het invulveld verwacht dd/mm/jjjj, net als de eigen periode op Historiek — één
          schrijfwijze in de hele app. */}
      <Text style={styles.muted}>
        {t('Voorbeeld: {voorbeeld}', { voorbeeld: formatDayInput(new Date()) })}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  uitleg: { ...typography.body, color: tennisColors.textMuted },
  label: { ...typography.label, color: tennisColors.textMuted, marginTop: spacing.sm },
  input: {
    backgroundColor: tennisColors.background,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: tennisColors.text,
  },
  datumRij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  veld: { flexGrow: 1, flexBasis: 140 },
  knop: { marginTop: spacing.md },
  fout: { color: tennisColors.danger, fontSize: 14, marginTop: spacing.sm },
  telling: { ...typography.body, color: tennisColors.text, fontWeight: '600' },
  muted: { ...typography.body, color: tennisColors.textMuted },
  rij: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rijTekst: { flexShrink: 1, flexGrow: 1 },
  naam: { ...typography.h3, color: tennisColors.text },
  periode: { fontSize: 13, color: tennisColors.textMuted },
});
