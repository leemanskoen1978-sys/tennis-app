// Beheer → Ziekmelding: een trainer ziek melden over een periode, en zien welke meldingen er
// lopen.
//
// Een ziekmelding is geen afwijkende boekingsperiode (`users.booking_periods`, het scherm
// Boekingstijden). Die laatste is vooruit gepland — "hij geeft die weken geen les" — en er
// staat nog niets in de agenda dat eronder lijdt. Een ziekmelding is een gebeurtenis: de
// lessen stonden er al, ze staan er nog, en ze moeten vandaag opgelost worden. Wie de twee in
// elkaar schuift, laat de club lessen ongemerkt zonder trainer staan omdat ze "al buiten zijn
// uren vielen". Zie de toelichting bovenaan lib/ziekmelding, die diezelfde grens bewaakt.
//
// Wat dit scherm bewust NIET doet: iemand verwittigen. Er gaat geen bericht naar de zieke
// trainer, niet naar de vervanger en niet naar de spelers — de app verstuurt niets. Het
// bellen en appen blijft mensenwerk; dit scherm zorgt alleen dat de beheerder in één oogopslag
// weet wíe hij moet bellen. Wie hier een mail- of pushknop bij bouwt, bouwt buiten wat deze
// fase beloofd heeft.
//
// De beheerdersgrens staat op het scherm zelf en niet alleen op de tegel in Beheer (D-12).

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Thermometer } from 'lucide-react-native';

import { Screen } from '../../../components/ui/Screen';
import { Card } from '../../../components/ui/Card';
import { Chip } from '../../../components/ui/Chip';
import { Button } from '../../../components/ui/Button';
import { useSimpleData } from '../../../providers/SimpleDataProvider';
import { formatDayInput, parseDayInput } from '../../../lib/period';
import { dagSleutel, periodeTekst } from '../../../lib/vakanties';
import { openZiekmeldingen, ziekmeldingFout } from '../../../lib/ziekmelding';
import { coachesOf } from '../../../lib/hub';
import { isAdmin } from '../../../lib/rechten';
import { useT } from '../../../lib/i18n';
import { tennisColors } from '../../../constants/tennis-colors';
import { spacing, radius, typography } from '../../../constants/theme';
import type { SickLeave } from '../../../lib/types';

/**
 * De meest recente melding bovenaan. Dat is de melding waarvoor de beheerder dit scherm
 * opende: iemand belde vanochtend, niet in maart.
 */
const nieuwsteEerst = (a: SickLeave, b: SickLeave): number => (a.van < b.van ? 1 : a.van > b.van ? -1 : 0);

export default function ZiekmeldingScreen(): React.JSX.Element {
  const t = useT();
  const router = useRouter();
  const {
    currentUser, users, sickLeaves, meldZiek, verwijderZiekmelding, error,
  } = useSimpleData();

  // `null` betekent: nog niets gekozen. `ziekmeldingFout` zegt er dan zelf iets over, in
  // plaats van dat het scherm stilzwijgend de eerste trainer in de lijst invult.
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [van, setVan] = useState('');
  const [totDag, setTotDag] = useState('');
  const [reden, setReden] = useState('');
  const [fout, setFout] = useState<string | null>(null);

  const trainers = useMemo(() => coachesOf(users), [users]);

  // Welke melding nog meetelt, beslist `openZiekmeldingen` en niemand anders — dit scherm
  // leest zelf nergens of een melding ingetrokken is.
  //
  // Er is geen archief meer. Sinds 6 september 2026 wordt een melding verwijderd in plaats van
  // ingetrokken, dus er kan er geen meer bij komen. Wat er nog aan ingetrokken meldingen in de
  // databank staat, valt hier weg — `openZiekmeldingen` laat ze eruit. Ze weer tonen zou een
  // lijst opleveren die alleen maar krimpt en nooit meer groeit.
  const lopend = useMemo(
    () => [...openZiekmeldingen(sickLeaves)].sort(nieuwsteEerst),
    [sickLeaves],
  );

  /**
   * Welke melding er om een bevestiging vraagt, of `null`.
   *
   * Verwijderen is onomkeerbaar en intrekken was dat niet: die knop mocht daarom in één klik.
   * Eén misklik in een lijst wist hier een melding die nog nodig was, en er is geen weg terug —
   * vandaar de tweede klik. De vraag staat per melding en niet als één scherm-brede toestand,
   * zodat de knop van de ene melding nooit de andere kan raken.
   */
  const [teVerwijderen, setTeVerwijderen] = useState<string | null>(null);

  // De grens staat hier, en niet alleen op de tegel in Beheer: een verborgen tegel is geen
  // toegangscontrole, want een trainer kan de link gewoon intikken (TOEG-01). De databank
  // weigert hem daarna ook — dit zorgt dat hij het scherm niet eens te zien krijgt.
  if (!isAdmin(currentUser)) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Ziekmeldingen zijn alleen voor de beheerder.')}</Text>
      </Screen>
    );
  }

  const naamVanTrainer = (id: string): string =>
    users.find((u) => u.id === id)?.name ?? t('Onbekende trainer');

  const meldAan = async (): Promise<void> => {
    const vanDatum = parseDayInput(van);
    const totDatum = parseDayInput(totDag);
    // Een half getypte datum wordt een lege sleutel; `ziekmeldingFout` maakt daar de ene
    // melding van die overal in de app hetzelfde luidt. Hier staat met opzet geen tweede
    // versie van diezelfde regel.
    const vanSleutel = vanDatum ? dagSleutel(vanDatum) : '';
    const totSleutel = totDatum ? dagSleutel(totDatum) : '';
    const melding = ziekmeldingFout(trainerId ?? '', vanSleutel, totSleutel);
    if (melding) {
      setFout(melding);
      return;
    }
    setFout(null);
    const nieuw = await meldZiek(
      trainerId ?? '', vanSleutel, totSleutel, reden.trim() || undefined,
    );
    // Geen rij terug: er is niets bewaard. Doorgaan zou een werklijst openen van een melding
    // die niet bestaat — een leeg scherm dat eruitziet alsof er geen enkele les geraakt is,
    // en dat is de gevaarlijkste vorm van stil verdwijnen.
    if (!nieuw) {
      setFout(t('De ziekmelding is niet bewaard. Probeer het zo nog eens.'));
      return;
    }
    setTrainerId(null);
    setVan('');
    setTotDag('');
    setReden('');
    // Meteen door naar de werklijst, zonder tussenscherm. Het fasedoel is "binnen een
    // minuut": een overzicht dat de beheerder eerst nog moet aanklikken kost precies die
    // minuut, terwijl de zieke trainer nog aan de lijn hangt.
    router.push(`/admin/ziekmelding/${nieuw.id}`);
  };

  const periodeVan = (z: SickLeave): string => periodeTekst(z.van, z.tot);

  return (
    <Screen>
      {/* Elke zin apart, en niet aan elkaar geplakt: een vertaalsleutel die over drie regels
          loopt is in lib/i18n-en niet terug te vinden, en dan blijft de zin er Engels uitzien
          terwijl hij Nederlands is. */}
      <Text style={styles.uitleg}>
        {t('Meld hier een trainer ziek over een periode van dag tot en met dag.')}
      </Text>
      <Text style={styles.uitleg}>
        {t('Je komt daarna meteen op de werklijst van die melding: elke les die eronder valt, met wie hem kan overnemen.')}
      </Text>
      <Text style={styles.uitleg}>
        {t('De app verwittigt niemand — bellen en appen blijft mensenwerk.')}
      </Text>

      <Card>
        <Text style={styles.label}>{t('Wie is er ziek?')}</Text>
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

        <View style={styles.datumRij}>
          <View style={styles.veld}>
            <Text style={styles.label}>{t('Ziek van')}</Text>
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
              value={totDag}
              onChangeText={setTotDag}
              placeholder={t('dd/mm/jjjj')}
              placeholderTextColor={tennisColors.textMuted}
              inputMode="numeric"
            />
          </View>
        </View>

        {/* De reden mag leeg blijven, en dat staat er ook zo: het kan gezondheidsinformatie
            over een collega zijn, en niemand hoort zich verplicht te voelen die in te tikken
            om verder te kunnen. */}
        <Text style={styles.label}>{t('Reden (mag leeg)')}</Text>
        <TextInput
          style={styles.input}
          value={reden}
          onChangeText={setReden}
          placeholder={t('bv. griep')}
          placeholderTextColor={tennisColors.textMuted}
        />

        {fout ? <Text style={styles.fout}>{fout}</Text> : null}
        {error ? <Text style={styles.fout}>{error}</Text> : null}

        <Button
          label={t('Ziek melden')}
          onPress={() => { void meldAan(); }}
          icon={<Plus size={16} color={tennisColors.onFill} />}
          style={styles.knop}
        />
      </Card>

      {lopend.length === 0 ? (
        <Text style={styles.muted}>
          {t('Er loopt op dit moment geen enkele ziekmelding.')}
        </Text>
      ) : (
        <Text style={styles.telling}>
          {lopend.length === 1
            ? t('1 lopende ziekmelding')
            : t('{n} lopende ziekmeldingen', { n: lopend.length })}
        </Text>
      )}

      {lopend.map((z) => (
        <Card key={z.id}>
          <View style={styles.rij}>
            <Thermometer size={18} color={tennisColors.primary} />
            <View style={styles.rijTekst}>
              <Text style={styles.naam}>{naamVanTrainer(z.coach_id)}</Text>
              <Text style={styles.onder}>{periodeVan(z)}</Text>
              {z.reden ? <Text style={styles.onder}>{z.reden}</Text> : null}
            </View>
          </View>
          {teVerwijderen === z.id ? (
            <>
              <Text style={styles.waarschuwing}>
                {t('Deze ziekmelding wordt verwijderd. De lessen blijven staan; een vervanger die je al koos ook.')}
              </Text>
              <View style={styles.knopRij}>
                <Button
                  label={t('Definitief verwijderen')}
                  variant="danger"
                  onPress={() => {
                    setTeVerwijderen(null);
                    void verwijderZiekmelding(z.id);
                  }}
                  fullWidth={false}
                  style={styles.knop}
                />
                <Button
                  label={t('Toch niet')}
                  variant="secondary"
                  onPress={() => setTeVerwijderen(null)}
                  fullWidth={false}
                  style={styles.knop}
                />
              </View>
            </>
          ) : (
            <View style={styles.knopRij}>
              <Button
                label={t('Werklijst openen')}
                onPress={() => router.push(`/admin/ziekmelding/${z.id}`)}
                fullWidth={false}
                style={styles.knop}
              />
              <Button
                label={t('Verwijderen')}
                variant="secondary"
                onPress={() => setTeVerwijderen(z.id)}
                fullWidth={false}
                style={styles.knop}
              />
            </View>
          )}
        </Card>
      ))}

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
  knopRij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fout: { color: tennisColors.danger, fontSize: 14, marginTop: spacing.sm },
  telling: { ...typography.body, color: tennisColors.text, fontWeight: '600' },
  muted: { ...typography.body, color: tennisColors.textMuted },
  rij: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rijTekst: { flexShrink: 1, flexGrow: 1 },
  naam: { ...typography.h3, color: tennisColors.text },
  onder: { fontSize: 13, color: tennisColors.textMuted },
  // De zin bij de bevestiging. In de kleur van een waarschuwing en niet van een fout: er is
  // niets misgegaan, er staat iets op het punt te gebeuren.
  waarschuwing: {
    ...typography.body,
    color: tennisColors.danger,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
});
