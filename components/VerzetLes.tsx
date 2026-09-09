// Een les verzetten: kies een dag, een uur en eventueel een andere baan.
//
// Waarom een eigen blad en geen velden in het lesdetail: verzetten is een handeling met een
// voorvertoning. Je wilt de botsing zien vóór je bevestigt, en dat is een gesprekje van drie
// stappen — dat hoort niet tussen de leesbare gegevens van een les in te staan.
//
// Wat er hier níét gebeurt: rekenen. Of het nieuwe moment kan, wat de nieuwe eindtijd wordt en
// waarmee het botst, beantwoordt `verzetPlan` in lib/verzetten. Dit bestand tekent dat antwoord
// en geeft de patch door aan wie hem opslaat.

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { DatumVeld } from './ui/DatumVeld';
import { DetailSheet } from './ui/DetailSheet';
import { botsingTekst } from '../lib/botsingen';
import { keuzeUren } from '../lib/boekingstijd';
import { formatDayInput, parseDayInput } from '../lib/period';
import { formatDayTimeRange } from '../lib/datetime';
import { verzetPlan, type TeVerzettenLes } from '../lib/verzetten';
import { useT } from '../lib/i18n';
import type { BezetBoeking } from '../lib/recurrence';
import type { Court, User, Vakantie } from '../lib/types';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, typography } from '../constants/theme';

interface Props {
  visible: boolean;
  les: TeVerzettenLes;
  bookings: BezetBoeking[];
  vakanties: Vakantie[];
  courts: Court[];
  /** Voor de zin die zegt waarmee het botst; alleen naam en id worden gelezen. */
  trainers: User[];
  error?: string | null;
  onVerzet: (patch: { start_time: string; end_time: string; court_id?: string }) => void;
  onClose: () => void;
}

/** 'jjjj-mm-dd' van een dag, op de klok van hier — de vorm waar `verzetPlan` mee rekent. */
function dagSleutel(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 'HH:MM' van een moment, op de klok van hier. */
function uurVan(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function VerzetLes({
  visible,
  les,
  bookings,
  vakanties,
  courts,
  trainers,
  error,
  onVerzet,
  onClose,
}: Props): React.JSX.Element {
  const t = useT();

  // Het blad begint op het moment waar de les nú staat. Zo hoef je bij "een half uur later"
  // maar één ding te veranderen, en zie je meteen waar je vandaan komt.
  const [dagTekst, setDagTekst] = useState(() => formatDayInput(new Date(les.start_time)));
  const [beginuur, setBeginuur] = useState(() => uurVan(les.start_time));
  const [courtId, setCourtId] = useState<string | undefined>(les.court_id);

  // `DatumVeld` levert dd/mm/jjjj; `verzetPlan` rekent met jjjj-mm-dd — zelfde vertaling als
  // in LesplanningToevoegen.
  const gekozenDag = parseDayInput(dagTekst);
  const dag = gekozenDag ? dagSleutel(gekozenDag) : '';
  const uitkomst = verzetPlan(les, { dag, beginuur, courtId }, { bookings, vakanties });

  // Halve uren, want deze club heeft groepen van dertig minuten: een les van 14:30 moet naar
  // 15:30 kunnen en niet alleen naar 15:00.
  const uren = keuzeUren(30);

  return (
    <DetailSheet title={t('Les verzetten')} visible={visible} onClose={onClose}>
      <Text style={styles.hint}>
        {t('Nu: {moment}', { moment: formatDayTimeRange(les.start_time, les.end_time) })}
      </Text>
      {/* Dit is de belofte van het verzetten en die hoort er te staan: het blijft dezelfde
          les. Wie annuleert en opnieuw boekt, verliest de betaalwijze, de beurt en de
          aanwezigheid — daar is dit scherm voor. */}
      <Text style={styles.hint}>
        {t('Het blijft dezelfde les: de betaalwijze, de deelnemers en de aanwezigheid gaan mee.')}
      </Text>

      <Text style={styles.label}>{t('Nieuwe dag')}</Text>
      <DatumVeld waarde={dagTekst} onChange={setDagTekst} />

      <Text style={styles.label}>{t('Nieuw beginuur')}</Text>
      <View style={styles.chipRij}>
        {uren.map((u) => (
          <Chip key={u} label={u} selected={beginuur === u} onPress={() => setBeginuur(u)} />
        ))}
      </View>

      {courts.length > 0 ? (
        <>
          <Text style={styles.label}>{t('Baan')}</Text>
          <View style={styles.chipRij}>
            {courts.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                selected={courtId === c.id}
                onPress={() => setCourtId(c.id)}
              />
            ))}
          </View>
        </>
      ) : null}

      {/* Drie soorten antwoord, en ze horen er verschillend uit te zien: het kan niet, het kan
          maar let op, of het kan gewoon. */}
      {!uitkomst.ok ? (
        <Text style={styles.fout}>{uitkomst.reden}</Text>
      ) : uitkomst.botsing ? (
        // Rood, en het zegt wáármee het botst — want op Terrein 7 delen blauw en rood een
        // halve baan en dan is het gewoon goed. Alleen de trainer kan dat onderscheid maken.
        // Het houdt niets tegen; de knop blijft werken.
        <Text style={styles.fout}>
          {t('Deze les komt tegelijk met een andere te staan. {wat}', {
            wat: botsingTekst(
              uitkomst.botsing,
              { coachId: les.coach_id, courtId },
              { trainers, banen: courts },
            ),
          })}
        </Text>
      ) : uitkomst.ongewijzigd ? (
        <Text style={styles.hint}>{t('Dit is het moment waar de les nu al staat.')}</Text>
      ) : (
        <Text style={styles.hint}>
          {t('Wordt: {moment}', {
            moment: formatDayTimeRange(uitkomst.patch.start_time, uitkomst.patch.end_time),
          })}
        </Text>
      )}

      {/* De foutmelding van het opslaan zelf, als die er is. Staat boven de knop, want daar
          kijk je nadat je erop drukte. */}
      {error ? <Text style={styles.fout}>{error}</Text> : null}

      <Button
        label={t('Verzetten')}
        disabled={!uitkomst.ok || uitkomst.ongewijzigd}
        onPress={() => { if (uitkomst.ok) onVerzet(uitkomst.patch); }}
      />
    </DetailSheet>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: tennisColors.textMuted, marginTop: spacing.md },
  chipRij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  hint: { ...typography.label, color: tennisColors.textMuted, marginTop: spacing.xs },
  fout: { ...typography.label, color: tennisColors.danger, marginTop: spacing.sm },
});
