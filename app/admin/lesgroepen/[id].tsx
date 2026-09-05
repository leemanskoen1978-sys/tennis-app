// Beheer → Lesgroepen → één groep: wat er van de groep vastligt, wie erin zit, welke lessen
// eraan hangen, en hoe je hem aan het einde van het seizoen wegzet.
//
// De grens die dit scherm moet bewaken: `groep.roster` is "wie er nú in de groep zit". Het is
// nooit het antwoord op "wie stond er bij díe les". Dat antwoord blijft `participant_ids` van
// de boeking zelf, gelezen via lib/groups. Wie hier ooit `roster` zou gebruiken om een lesregel
// te vullen, laat de prijs en de aanwezigheid van een les van vorige maand meebewegen met een
// wijziging van vandaag — de club ziet dan haar eigen geschiedenis opschuiven (D-07, D-08).
// Daarom komt het woord `participant_ids` in dit bestand alleen in dit commentaar voor.
//
// Dit scherm rekent om diezelfde reden zelf niets uit over de lessen. Een roosterwijziging gaat
// naar `updateLesGroepRoster`, en de regel eronder — vanaf vandaag vooruit, wat geweest is
// blijft staan — ligt één keer vast in lib/lesgroepen, met een test eromheen (D-06). Een
// tweede versie van die regel hier zou stilletjes uit de pas gaan lopen.
//
// Datzelfde geldt voor het verzetten van de groep zelf. Wat een ander uur, een andere dag, een
// andere trainer of een andere baan met de al ingeplande lessen doet, staat in
// `planGroepWijziging` — één keer, met een test eromheen. Dit scherm roept die functie aan om
// de voorvertoning te tonen en geeft daarna dezelfde patch aan `updateLesGroep`, zodat wat de
// beheerder leest en wat er weggeschreven wordt gegarandeerd hetzelfde is. Wie hier ooit een
// eigen lus over de boekingen, een eigen overlapvergelijking of een eigen datumrekensom zet,
// laat het scherm iets beloven wat de opslag niet doet.

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Archive, ArchiveRestore, Save } from 'lucide-react-native';

import { Screen } from '../../../components/ui/Screen';
import { Card } from '../../../components/ui/Card';
import { Chip } from '../../../components/ui/Chip';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ParticipantPicker } from '../../../components/ParticipantPicker';
import { LessonCards } from '../../../components/LessonCards';
import { useSimpleData } from '../../../providers/SimpleDataProvider';
import { formatDayInput, parseDayInput } from '../../../lib/period';
import { dagSleutel, parseDag, periodeTekst } from '../../../lib/vakanties';
import { komendeLessen, lesGroepFout, lessenVanGroep, planGroepWijziging } from '../../../lib/lesgroepen';
import { formatDay } from '../../../lib/datetime';
import { keuzeUren } from '../../../lib/boekingstijd';
import { coachesOf, playersOf } from '../../../lib/hub';
import { isAdmin } from '../../../lib/rechten';
import { DAY_LABELS } from '../../../lib/slots';
import { useT } from '../../../lib/i18n';
import { tennisColors } from '../../../constants/tennis-colors';
import { spacing, radius, typography } from '../../../constants/theme';
import type { GeblokkeerdeLes } from '../../../lib/lesgroepen';
import type { LesGroep } from '../../../lib/types';

/** Lesdagen op leesvolgorde: maandag eerst, zondag laatst. De waarden blijven getDay(). */
const DAG_VOLGORDE = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * Wat er in het formulier staat terwijl de beheerder aan het wijzigen is. Dezelfde velden en
 * dezelfde schrijfwijzen als het aanmaakformulier op het lijstscherm: gaan de twee vormen uit
 * elkaar lopen, dan laten ze op termijn andere dingen toe voor hetzelfde begrip.
 */
interface Concept {
  naam: string;
  niveau: string;
  weekdag: number;
  /** Het beginuur als 'HH:MM', precies zoals keuzeUren() het aanlevert. */
  beginuur: string;
  trainerId: string | null;
  baanId: string | null;
  van: string;
  tot: string;
}

/** Het formulier zoals het eruitziet zolang niemand er iets aan veranderd heeft. */
function conceptVan(g: LesGroep): Concept {
  const alsInvoer = (sleutel: string): string => {
    const d = parseDag(sleutel);
    return d ? formatDayInput(d) : '';
  };
  return {
    naam: g.name,
    niveau: g.level,
    weekdag: g.weekday,
    beginuur: `${String(g.start_hour).padStart(2, '0')}:${String(g.start_minute).padStart(2, '0')}`,
    trainerId: g.coach_id ?? null,
    baanId: g.court_id ?? null,
    van: alsInvoer(g.season_start),
    tot: alsInvoer(g.season_end),
  };
}

/**
 * Het formulier als de wijziging die de groep zou ondergaan.
 *
 * Eén plek, want de voorvertoning en het bewaren moeten naar exact dezelfde wijziging kijken.
 * Twee plekken die elk hun eigen patch bouwen zouden een botsing kunnen tonen die er bij het
 * bewaren niet meer is — of erger, er een verzwijgen die er wel is.
 */
function patchVan(c: Concept) {
  const vanDag = parseDayInput(c.van);
  const totDag = parseDayInput(c.tot);
  const [uurTekst, minuutTekst] = c.beginuur.split(':');
  return {
    name: c.naam.trim(),
    level: c.niveau.trim(),
    weekday: c.weekdag,
    start_hour: Number(uurTekst),
    start_minute: Number(minuutTekst),
    // Uitdrukkelijk `undefined` en niet weglaten: kiest de beheerder "Geen baan", dan hoort
    // de baan die er stond ook echt weg te gaan.
    coach_id: c.trainerId ?? undefined,
    court_id: c.baanId ?? undefined,
    season_start: vanDag ? dagSleutel(vanDag) : '',
    season_end: totDag ? dagSleutel(totDag) : '',
  };
}

export default function LesgroepDetailScreen(): React.JSX.Element {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    currentUser, users, courts, bookings, lesGroepen, settings,
    updateLesGroep, updateLesGroepRoster, archiveLesGroep, error,
  } = useSimpleData();

  const groep = lesGroepen.find((g) => g.id === id) ?? null;

  // `null` betekent: nog niets aangeraakt, dan komen de waarden uit de groep zelf. Zo blijft
  // een wijziging die iemand anders wegschreef zichtbaar zolang dit scherm niet aan het
  // typen is.
  const [concept, setConcept] = useState<Concept | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const trainers = useMemo(() => coachesOf(users), [users]);
  const spelers = useMemo(() => playersOf(users), [users]);

  // Eén moment voor het hele scherm. Zou "nu" bij elke tekening opnieuw gelezen worden, dan
  // kon een les tijdens het kijken van "komt nog" naar "geweest" springen.
  const now = useMemo(() => new Date(), []);

  // Wélke lessen dit zijn wordt hier niet bedacht: lessenVanGroep en komendeLessen staan in
  // lib/lesgroepen, met dezelfde "vanaf vandaag"-grens als de roosterwijziging eronder. Twee
  // antwoorden op dezelfde vraag is precies wat die module moet voorkomen.
  const { alle, komend, eerder } = useMemo(() => {
    const groepId = groep?.id ?? '';
    const alles = lessenVanGroep(bookings, groepId);
    const komt = komendeLessen(bookings, groepId, now);
    const komtIds = new Set(komt.map((b) => b.id));
    // Wat overblijft is niet alleen "al geweest": een afgezegde les van volgende week valt er
    // ook in. Die hoort de beheerder te blijven zien in plaats van tussen twee lijsten weg te
    // vallen — vandaar dat dit blok "Eerder en afgezegd" heet en niet "Geweest".
    return { alle: alles, komend: komt, eerder: alles.filter((b) => !komtIds.has(b.id)) };
  }, [bookings, groep?.id, now]);

  // Wat er zou gebeuren als de beheerder nú op Bewaren drukt. Niets aangeraakt (`concept` is
  // null) betekent niets te melden. Het scherm rekent hier zelf niets uit: het enige antwoord
  // komt uit lib/lesgroepen, en het bewaren eronder stuurt dezelfde patch weg.
  const voorvertoning = useMemo(() => (
    concept === null || groep === null
      ? null
      : planGroepWijziging(groep, patchVan(concept), bookings, now, settings.vakanties ?? [])
  ), [concept, groep, bookings, now, settings.vakanties]);

  // De grens staat hier, en niet alleen op het lijstscherm: een scherm dat zijn grens erft van
  // waar je vandaan kwam heeft er geen, want een trainer kan deze link gewoon intikken
  // (TOEG-01). De databank weigert hem daarna ook — dit zorgt dat hij het scherm niet eens te
  // zien krijgt.
  if (!isAdmin(currentUser)) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Lesgroepen zijn alleen voor de beheerder.')}</Text>
      </Screen>
    );
  }

  if (!groep) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Lesgroep niet gevonden.')}</Text>
      </Screen>
    );
  }

  const uren = keuzeUren();
  const huidig = concept ?? conceptVan(groep);
  const zet = (patch: Partial<Concept>): void => setConcept({ ...huidig, ...patch });

  /** "1 les" / "5 lessen" — dezelfde vorm als de reeksmelding van het boekingsvenster. */
  const lessenTelling = (n: number): string => (n === 1 ? t('1 les') : t('{n} lessen', { n }));

  /** De geblokkeerde lessen met één bepaalde reden; elke reden krijgt zijn eigen regel. */
  const geblokkeerd = (reden: GeblokkeerdeLes['reden']): GeblokkeerdeLes[] =>
    voorvertoning?.geblokkeerd.filter((g) => g.reden === reden) ?? [];

  /** De dagen van die lessen op een rij, met dezelfde datumopmaak als overal elders. */
  const dagenVan = (lessen: GeblokkeerdeLes[]): string =>
    lessen.map((g) => formatDay(g.start_time)).join(', ');

  const bewaar = (): void => {
    const vanDag = parseDayInput(huidig.van);
    const totDag = parseDayInput(huidig.tot);
    const patch = patchVan(huidig);
    // Valideren doet uitsluitend lib/lesgroepen, net als op het aanmaakscherm. Het rooster en
    // het archiefvinkje gaan alleen mee om de controle een hele groep te laten zien; ze staan
    // niet in de patch, want ze hebben elk hun eigen weg.
    const melding = lesGroepFout({ ...patch, roster: groep.roster, archived: groep.archived });
    if (melding || !vanDag || !totDag) {
      setFout(melding ?? t('Vul beide dagen in als dd/mm/jjjj.'));
      return;
    }
    setFout(null);
    void updateLesGroep(groep.id, patch);
    setConcept(null);
  };

  return (
    <Screen>
      <Card>
        <Text style={styles.naam}>{groep.name}</Text>
        <Text style={styles.onder}>
          {`${groep.level} · ${periodeTekst(groep.season_start, groep.season_end)}`}
        </Text>
        {/* Een gearchiveerde groep hoort aan het scherm te zien te zijn: anders zit je erin te
            wijzigen zonder te weten dat de club hem niet meer inplant. */}
        {groep.archived ? (
          <Badge label={t('Gearchiveerd')} color={tennisColors.primaryFill} />
        ) : null}
      </Card>

      <Card>
        <Text style={styles.label}>{t('Naam')}</Text>
        <TextInput
          style={styles.input}
          value={huidig.naam}
          onChangeText={(v) => zet({ naam: v })}
          placeholder={t('bv. Woensdag 16u groep 3')}
          placeholderTextColor={tennisColors.textMuted}
        />

        <Text style={styles.label}>{t('Niveau')}</Text>
        <TextInput
          style={styles.input}
          value={huidig.niveau}
          onChangeText={(v) => zet({ niveau: v })}
          placeholder={t('bv. Kidstennis oranje')}
          placeholderTextColor={tennisColors.textMuted}
        />

        <Text style={styles.label}>{t('Lesdag')}</Text>
        <View style={styles.chipRij}>
          {DAG_VOLGORDE.map((d) => (
            <Chip
              key={d}
              label={t(DAY_LABELS[d])}
              selected={huidig.weekdag === d}
              onPress={() => zet({ weekdag: d })}
            />
          ))}
        </View>

        <Text style={styles.label}>{t('Beginuur')}</Text>
        <View style={styles.chipRij}>
          {uren.map((u) => (
            <Chip
              key={u}
              label={u}
              selected={huidig.beginuur === u}
              onPress={() => zet({ beginuur: u })}
            />
          ))}
        </View>

        <Text style={styles.label}>{t('Trainer')}</Text>
        <View style={styles.chipRij}>
          {trainers.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={huidig.trainerId === c.id}
              onPress={() => zet({ trainerId: c.id })}
            />
          ))}
        </View>

        {/* De baan mag leeg blijven, net als bij een gewone les (D-13). */}
        <Text style={styles.label}>{t('Baan (mag leeg)')}</Text>
        <View style={styles.chipRij}>
          <Chip
            label={t('Geen baan')}
            selected={huidig.baanId === null}
            onPress={() => zet({ baanId: null })}
          />
          {courts.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={huidig.baanId === c.id}
              onPress={() => zet({ baanId: c.id })}
            />
          ))}
        </View>

        <View style={styles.datumRij}>
          <View style={styles.veld}>
            <Text style={styles.label}>{t('Seizoen van')}</Text>
            <TextInput
              style={styles.input}
              value={huidig.van}
              onChangeText={(v) => zet({ van: v })}
              placeholder={t('dd/mm/jjjj')}
              placeholderTextColor={tennisColors.textMuted}
              inputMode="numeric"
            />
          </View>
          <View style={styles.veld}>
            <Text style={styles.label}>{t('Tot en met')}</Text>
            <TextInput
              style={styles.input}
              value={huidig.tot}
              onChangeText={(v) => zet({ tot: v })}
              placeholder={t('dd/mm/jjjj')}
              placeholderTextColor={tennisColors.textMuted}
              inputMode="numeric"
            />
          </View>
        </View>

        {fout ? <Text style={styles.fout}>{fout}</Text> : null}
        {error ? <Text style={styles.fout}>{error}</Text> : null}

        {/* Wat er gaat gebeuren, vóór het bewaren. Eerst wat er wél meeverzet, dan per reden
            wat er blijft staan — met de dagen erbij, want "2 blijven staan" zonder te zeggen
            welke laat de beheerder met een raadsel achter. */}
        {voorvertoning ? (
          <>
            {voorvertoning.bookingPatches.length > 0 ? (
              <Text style={styles.uitleg}>
                {t('{lessen} van vandaag en later verzetten mee. De lessen die al geweest '
                  + 'zijn blijven staan waar ze stonden.', {
                  lessen: lessenTelling(voorvertoning.bookingPatches.length),
                })}
              </Text>
            ) : null}
            {geblokkeerd('bezet').length > 0 ? (
              <Text style={styles.uitleg}>
                {t('{lessen} blijven staan: de trainer of de baan is dan al bezet: {dagen}.', {
                  lessen: lessenTelling(geblokkeerd('bezet').length),
                  dagen: dagenVan(geblokkeerd('bezet')),
                })}
              </Text>
            ) : null}
            {geblokkeerd('vakantie').length > 0 ? (
              <Text style={styles.uitleg}>
                {t('{lessen} zouden in een vakantie vallen en blijven staan: {dagen}.', {
                  lessen: lessenTelling(geblokkeerd('vakantie').length),
                  dagen: dagenVan(geblokkeerd('vakantie')),
                })}
              </Text>
            ) : null}
            {geblokkeerd('verleden').length > 0 ? (
              <Text style={styles.uitleg}>
                {t('{lessen} zouden hierdoor in het verleden komen te staan en blijven '
                  + 'staan: {dagen}.', {
                  lessen: lessenTelling(geblokkeerd('verleden').length),
                  dagen: dagenVan(geblokkeerd('verleden')),
                })}
              </Text>
            ) : null}
            {voorvertoning.bookingPatches.length === 0
              && voorvertoning.geblokkeerd.length === 0 ? (
                <Text style={styles.uitleg}>
                  {t('Naam, niveau en seizoen raken de lessen niet; er verzet niets mee.')}
                </Text>
              ) : null}
          </>
        ) : null}

        {/* Dezelfde geest als de zin bij de spelers: de regel onder de knop hoort leesbaar te
            zijn zonder de code erbij. De staart gaat over wie de les echt gaf: dat veld
            beweegt niet mee met de groep (D-04, D-05). */}
        <Text style={styles.uitleg}>
          {t('Een ander uur, een andere dag, een andere trainer of een andere baan werkt door '
            + 'in de lessen van vandaag en later. Een les die iemand anders al gaf, blijft van '
            + 'hem.')}
        </Text>

        <Button
          label={t('Bewaren')}
          onPress={bewaar}
          icon={<Save size={16} color={tennisColors.onFill} />}
          style={styles.knop}
        />
      </Card>

      <Card>
        <Text style={styles.label}>{t('Spelers')}</Text>
        {/* Deze zin is geen versiering. Wie midden in een seizoen iemand toevoegt, hoort te
            weten wat er dan met de lessen gebeurt — anders is het een onzichtbare regel die
            iemand later per ongeluk omdraait (GROEP-05, GROEP-06). */}
        <Text style={styles.uitleg}>
          {t('Wie je hier toevoegt of weghaalt, staat vanaf vandaag op de lessen van deze '
            + 'groep. De lessen die al geweest zijn houden hun eigen deelnemerslijst en '
            + 'veranderen niet mee.')}
        </Text>
        {/* Dezelfde keuzelijst als op het boekscherm en in het lesdetail; zie het kopcommentaar
            van ParticipantPicker waarom die niet overgeschreven wordt. Een groep heeft geen
            betaler — dat begrip hoort bij één les — dus `payerId` is undefined. */}
        <ParticipantPicker
          players={spelers}
          payerId={undefined}
          value={groep.roster}
          onChange={(ids) => { void updateLesGroepRoster(groep.id, ids); }}
        />
        <Text style={styles.onder}>
          {groep.roster.length === 1
            ? t('1 speler')
            : t('{n} spelers', { n: groep.roster.length })}
        </Text>
      </Card>

      <Card>
        <Text style={styles.label}>{t('Lessen')}</Text>
        {alle.length === 0 ? (
          // De eerlijke zin in plaats van een knop die er bewust niet is: een heel seizoen
          // inplannen komt met de import (D-14). Laat de beheerder niet zoeken naar lessen die
          // er nooit waren.
          <Text style={styles.uitleg}>
            {t('Er hangt nog geen enkele les aan deze groep. Het inplannen van een heel '
              + 'seizoen komt met de import van de planning; tot dan hang je een les zelf '
              + 'aan deze groep.')}
          </Text>
        ) : (
          <Text style={styles.telling}>
            {komend.length === 1
              ? t('Nog 1 les te gaan')
              : t('Nog {n} lessen te gaan', { n: komend.length })}
          </Text>
        )}
      </Card>

      {/* Dezelfde leskaarten als in de agenda, met hetzelfde detailblad eraan vast: wie er bij
          die ene les stond leest dat blad uit de boeking zelf, en niet uit het rooster van de
          groep. Een eigen lijstvorm hier zou dezelfde les er per scherm anders uit laten zien. */}
      {alle.length > 0 ? (
        <>
          <LessonCards
            bookings={komend}
            empty={t('Er komt geen les van deze groep meer aan.')}
          />
          {eerder.length > 0 ? (
            <View style={styles.eerder}>
              <Text style={styles.eerderKop}>{t('Eerder en afgezegd')}</Text>
              <LessonCards
                bookings={eerder}
                empty={t('Er is nog geen les van deze groep geweest.')}
              />
            </View>
          ) : null}
        </>
      ) : null}

      <Card>
        <Text style={styles.label}>{t('Archiveren')}</Text>
        <Text style={styles.uitleg}>
          {t('Archiveren haalt de groep uit de actieve lijst, en verder gebeurt er niets: de '
            + 'lessen die gegeven zijn en hun geschiedenis blijven onaangeroerd, en het '
            + 'rooster blijft staan zodat je later nog ziet wie erin zat.')}
        </Text>
        {/* Geen gevaarknop: archiveren wist niets en is met dezelfde knop terug te draaien. */}
        <Button
          label={groep.archived ? t('Terug in de actieve lijst') : t('Groep archiveren')}
          variant="secondary"
          icon={groep.archived
            ? <ArchiveRestore size={16} color={tennisColors.text} />
            : <Archive size={16} color={tennisColors.text} />}
          onPress={() => { void archiveLesGroep(groep.id, !groep.archived); }}
          style={styles.knop}
        />
      </Card>
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
  muted: { ...typography.body, color: tennisColors.textMuted },
  telling: { ...typography.body, color: tennisColors.text, fontWeight: '600' },
  eerder: { gap: spacing.md, opacity: 0.7 },
  eerderKop: {
    ...typography.label,
    color: tennisColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  naam: { ...typography.h3, color: tennisColors.text },
  onder: { fontSize: 13, color: tennisColors.textMuted },
});
