// Trainers → Lessen zonder trainer: wat er openstaat, en wat de kijker zelf overnam.
//
// Waarom dit scherm bestaat: een les die zonder trainer in de agenda blijft staan, is precies de
// fout die deze module moet voorkomen — er staan spelers voor een dichte baan. Tot nu loste
// alleen de beheerder dat op vanaf de werklijst van een ziekmelding, en bij een uitval van
// vandaag voor morgen is dat te traag.
//
// Er wordt hier niets weggefilterd. Een les die niet bij de uren van de kijker past staat er ook,
// met de reden eronder — dezelfde afspraak als `vervangersVoor` aan de beheerderskant. Een lijst
// waar iets zonder uitleg uit verdwijnt, laat de trainer twijfelen of de app het wel goed ziet,
// en een les die niemand ziet blijft zonder trainer staan.
//
// Dit scherm rekent zelf niets uit. Wat er openstaat weet `openstaandeLessen`, of het mag weet
// `claimBezwaar` (langs `claimLes` in de provider), en wie wanneer kan weet `kanVervangen` — alle
// drie in lib/, met tests eromheen.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { formatDay, formatTimeRange } from '../../lib/datetime';
import { groupSize, groupSizeLabel } from '../../lib/groups';
import { openstaandeLessen } from '../../lib/openstaand';
import { kanVervangen } from '../../lib/vervanger';
import { openZiekmeldingen } from '../../lib/ziekmelding';
import { isCoach } from '../../lib/rechten';
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';
import type { VervangerReden } from '../../lib/vervanger';
import type { Booking } from '../../lib/types';

export default function OpenstaandScreen(): React.JSX.Element {
  const t = useT();
  const {
    currentUser, users, courts, bookings, lesGroepen, sickLeaves, settings,
    claimLes, geefLesTerug,
  } = useSimpleData();

  // Wat de laatste handeling opleverde: de reden waarom het niet mocht, of de bevestiging dat
  // het gelukt is. Blijft staan tot de volgende handeling — stil niets doen is hier de
  // gevaarlijkste uitkomst, want dan drukt de trainer nog eens en gaat hij daarna bellen.
  const [melding, setMelding] = useState<string | null>(null);
  // Welke les om een bevestiging vraagt omdat hij niet bij de uren van de kijker past. Eén
  // tegelijk, want de vraag gaat over díé ene les.
  const [bevestigen, setBevestigen] = useState<string | null>(null);

  const openMeldingen = useMemo(() => openZiekmeldingen(sickLeaves), [sickLeaves]);

  const rijen = useMemo(() => (
    currentUser === null ? [] : openstaandeLessen(
      bookings, openMeldingen, settings.vakanties ?? [], new Date(), currentUser.id,
    )
  ), [bookings, openMeldingen, settings.vakanties, currentUser]);

  // Wat de kijker zelf overnam, of wat de beheerder aan hem gaf: alles waar hij als lesgever op
  // staat en dat nog moet komen. Op tijd, net als de lijst erboven.
  const mijne = useMemo(() => (
    currentUser === null ? [] : bookings
      .filter((b) => b.taught_by_id === currentUser.id && b.status !== 'cancelled')
      .filter((b) => Date.parse(b.start_time) > Date.now())
      .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))
  ), [bookings, currentUser]);

  // De grens staat hier en niet alleen op de regel die hiernaartoe wijst: een scherm dat zijn
  // grens erft van waar je vandaan kwam heeft er geen, want een speler kan deze link intikken
  // (TOEG-01, zie de werklijst van een ziekmelding).
  if (!isCoach(currentUser)) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Deze lijst is voor trainers.')}</Text>
      </Screen>
    );
  }

  const nameOf = (id: string): string => users.find((u) => u.id === id)?.name ?? t('Onbekend');
  const baanNaam = (id: string): string =>
    courts.find((c) => c.id === id)?.name ?? t('Onbekend terrein');

  /**
   * De groep als de les eraan hangt, anders de naam van de speler. Dezelfde opzoeking als op het
   * lesdetailblad en op de werklijst; een tweede manier om een groepsnaam af te leiden gaat op
   * termijn een andere naam tonen voor dezelfde les.
   */
  const wieVan = (b: Booking): string => {
    const groep = b.group_id ? (lesGroepen.find((g) => g.id === b.group_id) ?? null) : null;
    return groep ? groep.name : nameOf(b.player_id);
  };

  /**
   * Waarom de kijker dit uur niet kan, als zin die hij kan navertellen. Een `Record` over alle
   * redenen en geen `switch` met een `default`: komt er ooit een reden bij, dan is dat hier een
   * typefout die niemand kan overslaan, in plaats van een lege regel op het scherm waar de
   * trainer de reden verwacht.
   */
  const redenZin: Record<VervangerReden, string> = {
    // 'kan' staat hier alleen om de lijst volledig te houden; wie kan, leest geen uitleg.
    kan: '',
    eigen_les: t('Je geeft dan zelf al les.'),
    buiten_uren: t('Dit valt buiten je uren.'),
    afwijkende_periode: t('Je bent die periode afwezig.'),
    clubvakantie: t('De club is die dag dicht.'),
    zelf_ziek: t('Je bent zelf ziek gemeld.'),
  };

  const kanHij = (b: Booking): VervangerReden => kanVervangen(
    currentUser,
    { start_time: b.start_time, end_time: b.end_time },
    bookings,
    settings.vakanties ?? [],
    openMeldingen,
    settings.booking_end_time,
  ).reden;

  const neem = async (b: Booking): Promise<void> => {
    setBevestigen(null);
    const bezwaar = await claimLes(b.id);
    setMelding(bezwaar ?? t('De les staat nu op jouw naam.'));
  };

  const terug = async (b: Booking): Promise<void> => {
    const bezwaar = await geefLesTerug(b.id);
    setMelding(bezwaar ?? t('De les staat weer open.'));
  };

  return (
    <Screen>
      {melding !== null && <Text style={styles.melding}>{melding}</Text>}

      <Text style={styles.section}>{t('Nog zonder trainer')}</Text>
      {rijen.length === 0 && (
        <Text style={styles.muted}>{t('Er staat op dit moment geen les zonder trainer.')}</Text>
      )}
      {rijen.map(({ les, reden }) => {
        const kan = kanHij(les);
        const groot = groupSize(les);
        return (
          <Card key={les.id}>
            <Text style={styles.titel}>
              {formatDay(les.start_time)} · {formatTimeRange(les.start_time, les.end_time)}
            </Text>
            <Text style={styles.meta}>
              {baanNaam(les.court_id)} · {wieVan(les)}
              {groot > 1 ? ` · ${groupSizeLabel(groot)}` : ''}
            </Text>
            <Text style={styles.meta}>
              {reden === 'ziek'
                ? t('{naam} is ziek gemeld.', { naam: nameOf(les.coach_id) })
                : t('Vrijgegeven door {naam}.', { naam: nameOf(les.coach_id) })}
            </Text>
            {kan !== 'kan' && <Text style={styles.waarschuwing}>{redenZin[kan]}</Text>}
            {bevestigen === les.id ? (
              <View style={styles.knoppen}>
                <Button label={t('Toch nemen')} onPress={() => { void neem(les); }} />
                <Button
                  label={t('Laat maar')}
                  variant="secondary"
                  onPress={() => setBevestigen(null)}
                />
              </View>
            ) : (
              <Button
                label={t('Ik neem deze les')}
                onPress={() => {
                  // Past het uur niet, dan eerst een vraag in het scherm zelf — geen `Alert`,
                  // die blokkeert op web. Zelfde bevestigingsvak als bij de beurtenkaarten.
                  if (kan === 'kan') { void neem(les); } else { setBevestigen(les.id); }
                }}
              />
            )}
          </Card>
        );
      })}

      {mijne.length > 0 && (
        <>
          <Text style={styles.section}>{t('Door mij overgenomen')}</Text>
          {mijne.map((b) => (
            <Card key={b.id}>
              <Text style={styles.titel}>
                {formatDay(b.start_time)} · {formatTimeRange(b.start_time, b.end_time)}
              </Text>
              <Text style={styles.meta}>{baanNaam(b.court_id)} · {wieVan(b)}</Text>
              <Text style={styles.meta}>
                {t('Vaste trainer: {naam}', { naam: nameOf(b.coach_id) })}
              </Text>
              <Button
                label={t('Teruggeven')}
                variant="secondary"
                onPress={() => { void terug(b); }}
              />
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { ...typography.h2, color: tennisColors.text, marginTop: spacing.sm },
  titel: { ...typography.h3, color: tennisColors.text },
  meta: { fontSize: 13, color: tennisColors.textMuted },
  waarschuwing: { fontSize: 13, color: tennisColors.warning },
  melding: { fontSize: 14, color: tennisColors.text },
  muted: { fontSize: 14, color: tennisColors.textMuted },
  knoppen: { flexDirection: 'row', gap: spacing.sm },
});
