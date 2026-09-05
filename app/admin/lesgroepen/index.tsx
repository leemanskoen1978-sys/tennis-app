// Beheer → Lesgroepen: de vaste groepen van de tennisschool, met wie ze geeft en wanneer.
//
// Een lesgroep is geen les. Het is het blijvende gegeven eronder: "Kidstennis oranje, dinsdag
// 17:00, bij Tom, hele seizoen". De lessen zelf blijven gewone boekingen — zie de toelichting
// bovenaan lib/lesgroepen, die de grens bewaakt tussen wie er nú in de groep zit en wie er die
// dag bij stond.
//
// Wat dit scherm bewust nog niet doet: een heel seizoen aan lessen inplannen. Dat komt met de
// import van de planning (D-14). Een groep aanmaken zet dus nog geen enkele les in de agenda,
// en dat staat ook zo op het scherm — anders zoekt de beheerder zich rot naar lessen die er
// nooit waren.

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { GraduationCap, Plus } from 'lucide-react-native';

import { Screen } from '../../../components/ui/Screen';
import { Card } from '../../../components/ui/Card';
import { Chip } from '../../../components/ui/Chip';
import { Button } from '../../../components/ui/Button';
import { useSimpleData } from '../../../providers/SimpleDataProvider';
import { formatDayInput, parseDayInput } from '../../../lib/period';
import { dagSleutel, periodeTekst } from '../../../lib/vakanties';
import { actieveGroepen, gearchiveerdeGroepen, lesGroepFout } from '../../../lib/lesgroepen';
import { keuzeUren } from '../../../lib/boekingstijd';
import { coachesOf } from '../../../lib/hub';
import { isAdmin } from '../../../lib/rechten';
import { DAY_LABELS } from '../../../lib/slots';
import { useT } from '../../../lib/i18n';
import { tennisColors } from '../../../constants/tennis-colors';
import { spacing, radius, typography } from '../../../constants/theme';
import type { LesGroep } from '../../../lib/types';

/** Lesdagen op leesvolgorde: maandag eerst, zondag laatst. De waarden blijven getDay(). */
const DAG_VOLGORDE = [1, 2, 3, 4, 5, 6, 0] as const;

export default function LesgroepenScreen(): React.JSX.Element {
  const t = useT();
  const router = useRouter();
  const { currentUser, users, courts, lesGroepen, addLesGroep, error } = useSimpleData();

  const [naam, setNaam] = useState('');
  const [niveau, setNiveau] = useState('');
  // `null` betekent: nog niets gekozen. De validatie in lib/lesgroepen zegt er dan zelf iets
  // over, in plaats van dat het scherm stilzwijgend maandag of het eerste uur invult.
  const [weekdag, setWeekdag] = useState<number | null>(null);
  const [beginuur, setBeginuur] = useState<string | null>(null);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [baanId, setBaanId] = useState<string | null>(null);
  const [van, setVan] = useState('');
  const [tot, setTot] = useState('');
  const [fout, setFout] = useState<string | null>(null);

  const trainers = useMemo(() => coachesOf(users), [users]);
  const { actief, archief } = useMemo(
    () => ({ actief: actieveGroepen(lesGroepen), archief: gearchiveerdeGroepen(lesGroepen) }),
    [lesGroepen],
  );

  // De grens staat hier, en niet alleen op de tegel in Beheer: een verborgen tegel is geen
  // toegangscontrole, want een trainer kan de link gewoon intikken (TOEG-01). De databank
  // weigert hem daarna ook — dit zorgt dat hij het scherm niet eens te zien krijgt.
  if (!isAdmin(currentUser)) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Lesgroepen zijn alleen voor de beheerder.')}</Text>
      </Screen>
    );
  }

  const uren = keuzeUren();
  const naamVanTrainer = (id?: string): string =>
    users.find((u) => u.id === id)?.name ?? t('Geen trainer');
  const naamVanBaan = (id?: string): string =>
    courts.find((c) => c.id === id)?.name ?? t('Geen baan');

  const maakAan = (): void => {
    const vanDag = parseDayInput(van);
    const totDag = parseDayInput(tot);
    // Het uur komt als 'HH:MM' van de chips; de groep bewaart uur en minuut apart.
    const [uurTekst, minuutTekst] = (beginuur ?? '').split(':');
    const kandidaat: Omit<LesGroep, 'id'> = {
      name: naam.trim(),
      level: niveau.trim(),
      // -1 is geen geldige weekdag: zo komt "kies een lesdag" uit de ene validatie in
      // lib/lesgroepen, in plaats van dat hier een tweede versie van diezelfde regel staat.
      weekday: weekdag ?? -1,
      start_hour: beginuur === null ? -1 : Number(uurTekst),
      start_minute: beginuur === null ? -1 : Number(minuutTekst),
      ...(trainerId ? { coach_id: trainerId } : {}),
      ...(baanId ? { court_id: baanId } : {}),
      season_start: vanDag ? dagSleutel(vanDag) : '',
      season_end: totDag ? dagSleutel(totDag) : '',
      roster: [],
      archived: false,
    };
    const melding = lesGroepFout(kandidaat);
    if (melding || !vanDag || !totDag) {
      setFout(melding ?? t('Vul beide dagen in als dd/mm/jjjj.'));
      return;
    }
    setFout(null);
    void addLesGroep(kandidaat);
    setNaam('');
    setNiveau('');
    setWeekdag(null);
    setBeginuur(null);
    setTrainerId(null);
    setBaanId(null);
    setVan('');
    setTot('');
  };

  const regel = (g: LesGroep): string => {
    const dag = g.weekday >= 0 && g.weekday <= 6 ? t(DAY_LABELS[g.weekday]) : '';
    const uur = `${String(g.start_hour).padStart(2, '0')}:${String(g.start_minute).padStart(2, '0')}`;
    const spelers = g.roster.length === 1
      ? t('1 speler')
      : t('{n} spelers', { n: g.roster.length });
    return `${dag} ${uur} · ${naamVanTrainer(g.coach_id)} · ${spelers}`;
  };

  return (
    <Screen>
      <Text style={styles.uitleg}>
        {t('Een lesgroep is het blijvende gegeven onder de lessen: dezelfde spelers, dezelfde '
          + 'dag, hetzelfde uur, het hele seizoen. Wijzig je hem later, dan gaan de lessen van '
          + 'vandaag en later mee; wat al gegeven is blijft staan zoals het was.')}
      </Text>

      <Card>
        <Text style={styles.label}>{t('Naam')}</Text>
        <TextInput
          style={styles.input}
          value={naam}
          onChangeText={setNaam}
          placeholder={t('bv. Woensdag 16u groep 3')}
          placeholderTextColor={tennisColors.textMuted}
        />

        <Text style={styles.label}>{t('Niveau')}</Text>
        <TextInput
          style={styles.input}
          value={niveau}
          onChangeText={setNiveau}
          placeholder={t('bv. Kidstennis oranje')}
          placeholderTextColor={tennisColors.textMuted}
        />

        <Text style={styles.label}>{t('Lesdag')}</Text>
        <View style={styles.chipRij}>
          {DAG_VOLGORDE.map((d) => (
            <Chip
              key={d}
              label={t(DAY_LABELS[d])}
              selected={weekdag === d}
              onPress={() => setWeekdag(d)}
            />
          ))}
        </View>

        <Text style={styles.label}>{t('Beginuur')}</Text>
        <View style={styles.chipRij}>
          {uren.map((u) => (
            <Chip key={u} label={u} selected={beginuur === u} onPress={() => setBeginuur(u)} />
          ))}
        </View>

        <Text style={styles.label}>{t('Trainer')}</Text>
        <View style={styles.chipRij}>
          {trainers.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={trainerId === c.id}
              onPress={() => setTrainerId(c.id)}
            />
          ))}
        </View>

        {/* De baan mag leeg blijven, net als bij een gewone les: een groep waarvan de baan nog
            niet vastligt is een bestaande, aanvaarde toestand (D-13). */}
        <Text style={styles.label}>{t('Baan (mag leeg)')}</Text>
        <View style={styles.chipRij}>
          <Chip
            label={t('Geen baan')}
            selected={baanId === null}
            onPress={() => setBaanId(null)}
          />
          {courts.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={baanId === c.id}
              onPress={() => setBaanId(c.id)}
            />
          ))}
        </View>

        <View style={styles.datumRij}>
          <View style={styles.veld}>
            <Text style={styles.label}>{t('Seizoen van')}</Text>
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
              placeholder={t('dd/mm/jjjj')}
              placeholderTextColor={tennisColors.textMuted}
              inputMode="numeric"
            />
          </View>
        </View>

        {fout ? <Text style={styles.fout}>{fout}</Text> : null}
        {error ? <Text style={styles.fout}>{error}</Text> : null}

        <Button
          label={t('Lesgroep aanmaken')}
          onPress={maakAan}
          icon={<Plus size={16} color={tennisColors.onFill} />}
          style={styles.knop}
        />
      </Card>

      {actief.length === 0 ? (
        <Text style={styles.muted}>
          {t('Nog geen lesgroepen. Een groep die je hier aanmaakt zet nog geen lessen in de '
            + 'agenda: het inplannen van een heel seizoen komt met de import van de planning. '
            + 'Tot dan hang je een les zelf aan een groep.')}
        </Text>
      ) : (
        <Text style={styles.telling}>
          {actief.length === 1
            ? t('1 lesgroep')
            : t('{n} lesgroepen', { n: actief.length })}
        </Text>
      )}

      {actief.map((g) => (
        <Card key={g.id} onPress={() => router.push(`/admin/lesgroepen/${g.id}`)} accessibilityLabel={g.name}>
          <View style={styles.rij}>
            <GraduationCap size={18} color={tennisColors.primary} />
            <View style={styles.rijTekst}>
              <Text style={styles.naam}>{g.name}</Text>
              <Text style={styles.onder}>{regel(g)}</Text>
              <Text style={styles.onder}>
                {`${g.level} · ${naamVanBaan(g.court_id)} · ${periodeTekst(g.season_start, g.season_end)}`}
              </Text>
            </View>
          </View>
        </Card>
      ))}

      {/* Gearchiveerde groepen verdwijnen niet: hun lessen staan er nog, en wie er volgend
          seizoen naar terugkijkt hoort te zien bij welke groep ze hoorden. */}
      {archief.length > 0 ? (
        <View style={styles.archief}>
          <Text style={styles.archiefKop}>{t('Gearchiveerd')}</Text>
          {archief.map((g) => (
            <Card key={g.id} onPress={() => router.push(`/admin/lesgroepen/${g.id}`)} accessibilityLabel={g.name}>
              <Text style={styles.archiefNaam}>{g.name}</Text>
              <Text style={styles.onder}>{regel(g)}</Text>
            </Card>
          ))}
        </View>
      ) : null}

      {/* Het invulveld verwacht dd/mm/jjjj, net als de clubkalender — één schrijfwijze in de
          hele app. */}
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
  chipRij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  datumRij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  veld: { flexGrow: 1, flexBasis: 140 },
  knop: { marginTop: spacing.md },
  fout: { color: tennisColors.danger, fontSize: 14, marginTop: spacing.sm },
  telling: { ...typography.body, color: tennisColors.text, fontWeight: '600' },
  muted: { ...typography.body, color: tennisColors.textMuted },
  rij: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rijTekst: { flexShrink: 1, flexGrow: 1 },
  naam: { ...typography.h3, color: tennisColors.text },
  onder: { fontSize: 13, color: tennisColors.textMuted },
  archief: { gap: spacing.md, opacity: 0.7 },
  archiefKop: {
    ...typography.label,
    color: tennisColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  archiefNaam: { ...typography.body, fontWeight: '600', color: tennisColors.text },
});
