// Beheer → Ziekmelding → één melding: de werklijst. Elke les die deze zieke trainer die dagen
// zou geven, met per les de drie dingen die de beheerder ermee kan doen.
//
// Waarom dit scherm bestaat: een les die zonder trainer stil in de agenda blijft staan is
// precies de fout die deze module moet voorkomen. Er staan spelers voor een dichte baan, en
// niemand die het merkte. Daarom staat hier álles wat de melding raakt op één scherm — met
// genoeg gegevens per regel om te beslissen zonder door te klikken (D-04) — en verdwijnt een
// les nooit stil uit deze lijst: hij blijft staan tot er een vervanger op staat of tot hij
// afgezegd is (D-06).
//
// De regel die hier het makkelijkst sneuvelt: elke rij staat op zichzelf. Een les uit een
// reeks (`series_id`) of uit een lesgroep (`group_id`) die hier een vervanger krijgt, raakt de
// rest van de reeks of de groep niet (D-07). Wie dit "handig" wil maken en de hele reeks in
// één keer aan de vervanger geeft, laat een half seizoen aan lessen stil van eigenaar
// wisselen — voor lessen waar helemaal niemand ziek voor was. Daarom staat er in dit bestand
// geen enkele helper die de hele reeks of de hele groep bij elkaar zoekt, en schrijft geen
// enkele lus hier iets weg: elke handeling raakt precies de boeking van die ene regel.
//
// De drie keuzes per les staan er alle drie, en het scherm kiest er nooit zelf een (D-05).
// Een vervanger koppelen is niet altijd het juiste antwoord: soms is er niemand en laat je de
// les staan zodat de club hem blijft zien, en soms weet je meteen dat hij niet doorgaat en zeg
// je hem af. Wie hier ooit automatisch een vervanger toewijst, zet trainers op lessen waar
// niemand ze over gebeld heeft.
//
// Dit scherm rekent zelf niets uit. Welke lessen geraakt zijn weet `lessenVoorZiekmelding`,
// of een les nog een vervanger zoekt weet `zoektVervanger`, en wie kan invallen weet
// `vervangersVoor` — alle drie in lib/, met een test eromheen. Hier staat alleen hoe het
// eruitziet en welke knop welke bestaande schrijfweg aanroept.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Screen } from '../../../components/ui/Screen';
import { Card } from '../../../components/ui/Card';
import { Chip } from '../../../components/ui/Chip';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { useSimpleData } from '../../../providers/SimpleDataProvider';
import { formatDay, formatTimeRange } from '../../../lib/datetime';
import { groupSize, groupSizeLabel } from '../../../lib/groups';
import { periodeTekst } from '../../../lib/vakanties';
import { vervangersVoor } from '../../../lib/vervanger';
import { coachesOf } from '../../../lib/hub';
import { lessenVoorZiekmelding, openZiekmeldingen, zoektVervanger } from '../../../lib/ziekmelding';
import { isAdmin } from '../../../lib/rechten';
import { useT } from '../../../lib/i18n';
import { tennisColors } from '../../../constants/tennis-colors';
import { spacing, typography } from '../../../constants/theme';
import type { VervangerReden } from '../../../lib/vervanger';
import type { Booking } from '../../../lib/types';

/**
 * Hoe een regel ervoor staat. Drie toestanden, en het scherm bedenkt er geen vierde bij:
 * afgezegd komt uit de boeking zelf, geregeld betekent dat er een lesgever op staat, en
 * "zoekt" is het antwoord van `zoektVervanger` en van niets anders.
 */
type Toestand = 'afgezegd' | 'geregeld' | 'zoekt';

export default function WerklijstScreen(): React.JSX.Element {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    currentUser, users, courts, bookings, lesGroepen, sickLeaves, settings,
    setTaughtBy, updateBooking, error,
  } = useSimpleData();

  // Welke regel zijn vervangerslijst open heeft staan; null = allemaal dicht. Eén tegelijk,
  // want de keuze gaat over díé ene les.
  const [kiezerVoor, setKiezerVoor] = useState<string | null>(null);

  const ziekmelding = sickLeaves.find((z) => z.id === id) ?? null;

  // Welke meldingen nog meetellen beslist `openZiekmeldingen`, hier net zo goed als op het
  // lijstscherm. Eén keer per lijst uitgerekend — maar `zoektVervanger` wordt per boeking vers
  // gesteld, zodat een regel niet met een oud antwoord blijft staan.
  const openMeldingen = useMemo(() => openZiekmeldingen(sickLeaves), [sickLeaves]);

  // De geraakte lessen, al op tijd gesorteerd door lib/ziekmelding — zo werkt de beheerder de
  // lijst van boven naar beneden af. Hier staat met opzet geen tweede sortering.
  const rijen = useMemo(() => (
    ziekmelding === null
      ? []
      : lessenVoorZiekmelding(bookings, ziekmelding, settings.vakanties ?? [])
  ), [ziekmelding, bookings, settings.vakanties]);

  // De grens staat hier, en niet alleen op het lijstscherm: een scherm dat zijn grens erft van
  // waar je vandaan kwam heeft er geen, want een trainer kan deze link gewoon intikken
  // (TOEG-01). De databank weigert hem daarna ook — dit zorgt dat hij het scherm niet eens te
  // zien krijgt.
  if (!isAdmin(currentUser)) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Ziekmeldingen zijn alleen voor de beheerder.')}</Text>
      </Screen>
    );
  }

  // Bestaat de melding niet, dan staat er een zin en geen lege lijst. Een leeg scherm leest als
  // "er zijn geen lessen geraakt", en dat is hier de gevaarlijkste leugen die de app kan
  // vertellen: de beheerder gaat ervan uit dat er niets te doen valt.
  if (!ziekmelding) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Deze ziekmelding bestaat niet meer.')}</Text>
      </Screen>
    );
  }

  const nameOf = (id2: string): string => users.find((u) => u.id === id2)?.name ?? t('Onbekend');
  const baanNaam = (baanId: string): string =>
    courts.find((c) => c.id === baanId)?.name ?? t('Onbekend terrein');

  /**
   * Waarom een collega dit uur niet kan, als zin die de beheerder kan navertellen. Een
   * `Record` over alle redenen en geen `switch` met een `default`: komt er ooit een reden bij,
   * dan is dat hier een typefout die niemand kan overslaan, in plaats van een lege regel op
   * het scherm waar de beheerder de reden verwacht.
   */
  const redenZin: Record<VervangerReden, string> = {
    // 'kan' staat hier alleen om de lijst volledig te houden; wie kan, staat in de andere
    // groep en heeft geen uitleg nodig.
    kan: t('kan invallen'),
    eigen_les: t('geeft dan zelf al les'),
    buiten_uren: t('geeft dan geen les'),
    afwijkende_periode: t('is die periode afwezig'),
    clubvakantie: t('de club is dan dicht'),
    zelf_ziek: t('is zelf ziek gemeld'),
  };

  /**
   * De groep als de les aan een lesgroep hangt, anders de naam van de speler. Dezelfde
   * opzoeking als op het lesdetailblad; een tweede manier om een groepsnaam af te leiden zou
   * op termijn een andere naam gaan tonen voor dezelfde les.
   */
  const wieVan = (booking: Booking): string => {
    const groep = booking.group_id
      ? (lesGroepen.find((g) => g.id === booking.group_id) ?? null)
      : null;
    return groep ? groep.name : nameOf(booking.player_id);
  };

  const toestandVan = (booking: Booking): Toestand => {
    if (booking.status === 'cancelled') return 'afgezegd';
    if (booking.taught_by_id) return 'geregeld';
    // Niet zelf uitrekenen uit `taught_by_id` en de melding: dat is precies de tweede plek die
    // ooit uit de pas gaat lopen met de agenda en het detailblad.
    return zoektVervanger(booking, openMeldingen) ? 'zoekt' : 'geregeld';
  };

  const nogTeDoen = rijen.filter((b) => toestandVan(b) === 'zoekt').length;

  return (
    <Screen>
      <Card>
        <Text style={styles.kop}>{nameOf(ziekmelding.coach_id)}</Text>
        <Text style={styles.onder}>{periodeTekst(ziekmelding.van, ziekmelding.tot)}</Text>
        {ziekmelding.reden ? <Text style={styles.onder}>{ziekmelding.reden}</Text> : null}
        {/* Dit getal is de "binnen een minuut" van het fasedoel: de beheerder ziet in één blik
            hoeveel er nog te bellen valt, zonder de lijst af te gaan. */}
        <Text style={styles.telling}>
          {nogTeDoen === 0
            ? t('Geen enkele les zoekt nog een vervanger.')
            : nogTeDoen === 1
              ? t('1 les zoekt nog een vervanger')
              : t('{n} lessen zoeken nog een vervanger', { n: nogTeDoen })}
        </Text>
        {error ? <Text style={styles.fout}>{error}</Text> : null}
      </Card>

      {rijen.length === 0 ? (
        <Text style={styles.muted}>{t('Deze ziekmelding raakt geen enkele les.')}</Text>
      ) : null}

      {rijen.map((booking) => {
        const toestand = toestandVan(booking);
        // De kandidaten zijn de collega's, zonder de trainer van de les zelf: hij vervangt
        // zichzelf niet, en dat is de vraagstelling en geen stille filtering. Wie hierna wél
        // of niet kan, wordt door niemand weggelaten — dat is het verschil met de regel
        // hieronder, waar iedereen zichtbaar blijft.
        const kandidaten = coachesOf(users).filter((u) => u.id !== booking.coach_id);
        // Alleen voor de regel die openstaat. Beschikbaarheid wordt hier niet uitgerekend:
        // `vervangersVoor` stelt de vijf vragen, in een vaste volgorde, met een test eromheen.
        const uitkomsten = kiezerVoor === booking.id
          ? vervangersVoor(
            kandidaten,
            { start_time: booking.start_time, end_time: booking.end_time },
            bookings,
            settings.vakanties ?? [],
            openMeldingen,
            settings.booking_end_time,
          )
          : [];
        const kunnen = uitkomsten.filter((u) => u.reden === 'kan');
        const kunnenNiet = uitkomsten.filter((u) => u.reden !== 'kan');
        return (
          <Card key={booking.id}>
            {/* De vijf gegevens van D-04 op twee regels: datum en uur, dan baan, groep of
                speler en hoeveel spelers er staan. Genoeg om te beslissen zonder de les te
                openen — een beheerder met een zieke trainer aan de lijn klikt niet door. */}
            <Text style={styles.lesKop}>
              {formatDay(booking.start_time)} · {formatTimeRange(booking.start_time, booking.end_time)}
            </Text>
            <Text style={styles.onder}>
              {baanNaam(booking.court_id)} · {wieVan(booking)} · {groupSizeLabel(groupSize(booking))}
            </Text>

            <View style={styles.badgeRij}>
              {toestand === 'afgezegd' ? (
                <Badge label={t('Afgezegd')} color={tennisColors.mutedFill} />
              ) : toestand === 'geregeld' ? (
                <Badge label={t('Geregeld')} color={tennisColors.courtFill} />
              ) : (
                <Badge label={t('Zoekt vervanger')} color={tennisColors.warningFill} />
              )}
            </View>

            {/* Beide namen blijven staan. Wie hier alleen de vervanger zou tonen, maakt
                achteraf onnavolgbaar wat er gebeurd is: dan is niet meer te zien aan wie de
                les was toegewezen én wie hem uiteindelijk gaf. */}
            {booking.taught_by_id ? (
              <>
                <Text style={styles.onder}>
                  {t('Vaste trainer')}: {nameOf(booking.coach_id)}
                </Text>
                <Text style={styles.onder}>
                  {t('Vervanger')}: {nameOf(booking.taught_by_id)}
                </Text>
              </>
            ) : (
              <Text style={styles.onder}>
                {t('Trainer')}: {nameOf(booking.coach_id)}
              </Text>
            )}

            {toestand === 'afgezegd' ? null : (
              <View style={styles.knopRij}>
                <Button
                  label={booking.taught_by_id ? t('Andere vervanger') : t('Vervanger koppelen')}
                  onPress={() => setKiezerVoor(kiezerVoor === booking.id ? null : booking.id)}
                  fullWidth={false}
                  style={styles.knop}
                />
                {/* "Laten staan" schrijft niets weg, en dat is geen vergetelheid. De markering
                    "zoekt vervanger" is afgeleid (D-16): er is geen kolom en geen status om te
                    zetten. De regel blijft gewoon in deze lijst staan en blijft in de agenda
                    gemarkeerd — dat is D-06, hij verdwijnt nooit stil. Wie hier later een
                    vlaggetje bij bouwt, bouwt iets dat kan blijven hangen. */}
                {toestand === 'zoekt' ? (
                  <Button
                    label={t('Laten staan')}
                    variant="secondary"
                    onPress={() => setKiezerVoor(null)}
                    fullWidth={false}
                    style={styles.knop}
                  />
                ) : null}
                {/* Afzeggen loopt over de bestaande afzegweg, dezelfde die het lesdetailblad
                    gebruikt. Precies deze ene boeking (D-07). */}
                <Button
                  label={t('Afzeggen')}
                  variant="secondary"
                  onPress={() => { void updateBooking(booking.id, { status: 'cancelled' }); }}
                  fullWidth={false}
                  style={styles.knop}
                />
              </View>
            )}

            {kiezerVoor === booking.id ? (
              <View style={styles.kiezer}>
                <Text style={styles.label}>{t('Wie kan deze les overnemen?')}</Text>

                {uitkomsten.length === 0 ? (
                  <Text style={styles.muted}>{t('Er is geen andere trainer om uit te kiezen.')}</Text>
                ) : null}

                {uitkomsten.length > 0 ? (
                  <>
                    <Text style={styles.groepKop}>{t('Kan invallen')}</Text>
                    {kunnen.length === 0 ? (
                      <Text style={styles.muted}>{t('Geen enkele collega kan dit uur.')}</Text>
                    ) : (
                      <View style={styles.chipRij}>
                        {kunnen.map((u) => (
                          <Chip
                            key={u.coach.id}
                            label={u.coach.name}
                            selected={booking.taught_by_id === u.coach.id}
                            onPress={() => {
                              void setTaughtBy(booking.id, u.coach.id);
                              setKiezerVoor(null);
                            }}
                          />
                        ))}
                      </View>
                    )}
                  </>
                ) : null}

                {/* Wie niet kan blijft staan, mét zijn reden, en blijft aanklikbaar. De
                    reflex is om deze knoppen uit te schakelen, en precies dat mag niet: de
                    beheerder mag bewust afwijken — hij belt een collega die eigenlijk vrij
                    was, en die zegt ja. Dat kan alleen als de knop er is. Een lijst waar
                    iemand zonder uitleg uit verdwijnt, is een lijst waarin de beheerder gaat
                    twijfelen of de app het wel goed ziet, en dan belt hij toch maar zelf de
                    hele club rond (D-09). */}
                {kunnenNiet.length > 0 ? (
                  <View style={styles.kanNiet}>
                    <Text style={styles.groepKop}>{t('Kan niet, tenzij je het toch wil')}</Text>
                    {kunnenNiet.map((u) => (
                      <View key={u.coach.id} style={styles.kanNietRij}>
                        <Chip
                          label={u.coach.name}
                          selected={booking.taught_by_id === u.coach.id}
                          onPress={() => {
                            void setTaughtBy(booking.id, u.coach.id);
                            setKiezerVoor(null);
                          }}
                        />
                        <Text style={styles.onder}>{redenZin[u.reden]}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { ...typography.body, color: tennisColors.textMuted },
  kop: { ...typography.h3, color: tennisColors.text },
  lesKop: { ...typography.body, fontWeight: '600', color: tennisColors.text },
  onder: { fontSize: 13, color: tennisColors.textMuted },
  telling: { ...typography.body, color: tennisColors.text, fontWeight: '600', marginTop: spacing.sm },
  label: { ...typography.label, color: tennisColors.textMuted, marginTop: spacing.sm },
  fout: { color: tennisColors.danger, fontSize: 14, marginTop: spacing.sm },
  badgeRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  knopRij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  knop: { marginTop: spacing.md },
  kiezer: { marginTop: spacing.md, gap: spacing.xs },
  groepKop: { ...typography.label, color: tennisColors.textMuted, marginTop: spacing.sm },
  chipRij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  // Gedempt, maar niet weg en niet uitgeschakeld: de namen blijven leesbaar en aanklikbaar.
  kanNiet: { opacity: 0.7, gap: spacing.xs },
  kanNietRij: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
});
