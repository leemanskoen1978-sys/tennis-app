// Beheer → Kalender: wanneer er les kan zijn. Twee lagen die dezelfde vraag beantwoorden en
// daarom niet langer twee tegels zijn.
//
// Boven staat de clubkalender: de dagen waarop de club geen les geeft. Zonder die lijst rekent
// de app door alsof er elke week les is. Een reeks van september tot mei zet dan lessen in de
// herfstvakantie en op 11 november, en Reserveren biedt op die dagen gewoon vrije uren aan —
// waarna iemand ze één voor één moet terugvinden en schrappen. Precies het werk dat een reeks
// moest besparen. De lijst hangt aan de clubinstellingen en niet aan een trainer: een vakantie
// geldt voor iedereen.
//
// Onder staat wat per trainer verschilt: tussen welke uren er bij hém geboekt kan worden, en de
// periodes waarin daar iets anders geldt. Dat stond eerder verspreid: de club had één eindtijd
// voor iedereen, en een trainer kon in zijn eigen gegevens alleen bínnen die tijd schuiven. Wie
// tot tien uur 's avonds lesgaf terwijl de club op negen stond, kon dat nergens kwijt — en een
// zomerrooster van een paar weken al helemaal niet. De clubtijd (Beheer → Instellingen) is nog
// wat je krijgt zolang een trainer zelf niets invult. Welke van de drie op een bepaalde dag
// wint, rekent lib/boekingstijd uit — hier staat alleen hoe je het invult.
//
// Een trainer regelt zijn eigen tijden; een beheerder die van iedereen, want hij maakt het
// rooster van de club.
//
// De twee helften houden hun eigen state en hun eigen stijlen, elk in een eigen component: ze
// staan op één scherm omdat ze bij elkaar horen, niet omdat ze hetzelfde formulier zijn.

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { CalendarOff, Clock, Plus, Trash2 } from 'lucide-react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { Button } from '../../components/ui/Button';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { newId } from '../../providers/mockStore';
import { formatDayInput, parseDayInput } from '../../lib/period';
import {
  dagSleutel, periodeTekst, sorteerVakanties, vakantieDagen, vakantieFout, vakantiePeriode,
} from '../../lib/vakanties';
import {
  keuzeUren, periodeFout, sorteerPeriodes, urenTekst, CLUB_START, type Uren,
} from '../../lib/boekingstijd';
import { coachesOf } from '../../lib/hub';
import { isAdmin, isCoach } from '../../lib/rechten';
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, typography } from '../../constants/theme';
import type { Boekingsperiode, User, Vakantie } from '../../lib/types';
import { DatumVeld } from '../../components/ui/DatumVeld';

/**
 * Kop boven een helft van het scherm. Twee formulieren onder elkaar zonder zo'n streep worden
 * één muur; met de streep zie je waar het ene onderwerp ophoudt.
 */
function SectieKop({ titel, icoon }: { titel: string; icoon: React.ReactNode }): React.JSX.Element {
  return (
    <View style={styles.sectieKop}>
      <View style={styles.sectieRij}>
        {icoon}
        <Text style={styles.sectieTitel}>{titel}</Text>
      </View>
      <View style={styles.streep} />
    </View>
  );
}

export default function KalenderScreen(): React.JSX.Element {
  const t = useT();
  const { currentUser } = useSimpleData();

  // Beide helften waren voor een trainer; de tegel staat er alleen voor hem, maar een adres is
  // te typen. Wie hier buiten zijn recht komt, krijgt te lezen waarom.
  if (!isCoach(currentUser)) {
    return (
      <Screen>
        <Text style={styles.muted}>{t('Beheer is alleen voor trainers.')}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <SectieKop
        titel={t('Clubkalender')}
        icoon={<CalendarOff size={18} color={tennisColors.primary} />}
      />
      <Clubkalender />

      <SectieKop
        titel={t('Boekingstijden')}
        icoon={<Clock size={18} color={tennisColors.primary} />}
      />
      <Boekingstijden />
    </Screen>
  );
}

/** De dagen waarop de club geen les geeft. Geldt voor iedereen. */
function Clubkalender(): React.JSX.Element {
  const t = useT();
  const { settings, saveSettings, error } = useSimpleData();

  const [naam, setNaam] = useState('');
  const [van, setVan] = useState('');
  const [tot, setTot] = useState('');
  const [fout, setFout] = useState<string | null>(null);

  const vakanties = useMemo(
    () => sorteerVakanties(settings.vakanties ?? []),
    [settings.vakanties],
  );

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
    <>
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
            <DatumVeld
              waarde={van}
              onChange={setVan}
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
    </>
  );
}

/** Tussen welke uren er bij een trainer geboekt kan worden, en zijn afwijkende periodes. */
function Boekingstijden(): React.JSX.Element {
  const t = useT();
  const { currentUser, users, settings, updateUser, error } = useSimpleData();

  // Welke trainer je aan het bijstellen bent. Een gewone trainer heeft hier niets te kiezen:
  // dat is hijzelf.
  const [gekozenId, setGekozenId] = useState<string | null>(null);
  const [naam, setNaam] = useState('');
  const [van, setVan] = useState('');
  const [tot, setTot] = useState('');
  // De uren van de nieuwe periode. `null` betekent: die dagen geeft deze trainer geen les.
  const [nieuweUren, setNieuweUren] = useState<Uren | null>({ start: '09:00', end: '21:00' });
  const [fout, setFout] = useState<string | null>(null);

  const beheerder = isAdmin(currentUser);
  const trainers = useMemo(() => coachesOf(users), [users]);
  const trainer: User | null = beheerder
    ? trainers.find((c) => c.id === gekozenId) ?? currentUser ?? null
    : currentUser ?? null;

  if (!isCoach(currentUser) || trainer === null) {
    return <Text style={styles.muted}>{t('Boekingstijden zijn er voor trainers.')}</Text>;
  }

  const periodes = sorteerPeriodes(trainer.booking_periods ?? []);
  const standaard = trainer.working_hours ?? null;
  const uren = keuzeUren();

  const bewaarPeriodes = (lijst: Boekingsperiode[]): void => {
    void updateUser(trainer.id, { booking_periods: lijst.length > 0 ? lijst : undefined });
  };

  const zetStandaard = (patch: Partial<Uren>): void => {
    const basis = standaard ?? { start: CLUB_START, end: settings.booking_end_time };
    const nieuw = { ...basis, ...patch };
    // Een eindtijd vóór de begintijd levert een trainer op bij wie niets te boeken valt.
    // Dan schuift het andere uur mee in plaats van de keuze te weigeren: wie op 20:00 klikt
    // terwijl er 21:00 – 22:00 staat, bedoelt "vanaf 20:00" en niet "niets meer".
    if (nieuw.start >= nieuw.end) {
      if (patch.start !== undefined) nieuw.end = uren[Math.min(uren.indexOf(nieuw.start) + 1, uren.length - 1)];
      else nieuw.start = uren[Math.max(uren.indexOf(nieuw.end) - 1, 0)];
    }
    void updateUser(trainer.id, { working_hours: nieuw });
  };

  const voegToe = (): void => {
    const vanDag = parseDayInput(van);
    // Eén dag invullen mag: laat je "tot" leeg, dan is het die ene dag — dezelfde afspraak
    // als bij de clubkalender hierboven.
    const totDag = tot.trim().length === 0 ? vanDag : parseDayInput(tot);
    const melding = periodeFout(
      vanDag ? dagSleutel(vanDag) : '',
      totDag ? dagSleutel(totDag) : '',
      nieuweUren,
      t,
    );
    if (melding || !vanDag || !totDag) {
      setFout(melding ?? t('Vul beide dagen in als dd/mm/jjjj.'));
      return;
    }
    setFout(null);
    bewaarPeriodes([...(trainer.booking_periods ?? []), {
      id: newId('per'),
      ...(naam.trim() ? { naam: naam.trim() } : {}),
      van: dagSleutel(vanDag),
      tot: dagSleutel(totDag),
      ...(nieuweUren ? { uren: nieuweUren } : {}),
    }]);
    setNaam('');
    setVan('');
    setTot('');
  };

  return (
    <>
      <Text style={styles.uitlegTijden}>
        {t('Hier staat tussen welke uren er bij een trainer geboekt kan worden. Vult hij '
          + 'niets in, dan geldt de tijd van de club. Een periode gaat vóór de standaard.')}
      </Text>

      {/* Een beheerder werkt in de tijden van elke trainer; een trainer ziet alleen zichzelf
          en heeft dus niets te kiezen. */}
      {beheerder && trainers.length > 1 ? (
        <View style={styles.chipRow}>
          {trainers.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={c.id === trainer.id}
              onPress={() => setGekozenId(c.id)}
            />
          ))}
        </View>
      ) : null}

      <Card>
        <View style={styles.kop}>
          <Clock size={18} color={tennisColors.primary} />
          <Text style={styles.kopTekst}>{t('Standaard')}</Text>
        </View>
        <Text style={styles.help}>
          {standaard
            ? t('Elke dag waarop {naam} lesgeeft, tenzij een periode hieronder iets anders '
              + 'zegt.', { naam: trainer.name })
            : t('Nu geldt de tijd van de club: {van} – {tot}. Kies hieronder eigen uren.', {
              van: CLUB_START, tot: settings.booking_end_time,
            })}
        </Text>

        <Text style={styles.labelTijden}>{t('Van')}</Text>
        <View style={styles.chipRow}>
          {uren.map((u) => (
            <Chip
              key={`van-${u}`}
              label={u}
              selected={(standaard?.start ?? CLUB_START) === u}
              onPress={() => zetStandaard({ start: u })}
            />
          ))}
        </View>

        <Text style={styles.labelTijden}>{t('Tot')}</Text>
        <View style={styles.chipRow}>
          {uren.map((u) => (
            <Chip
              key={`tot-${u}`}
              label={u}
              selected={(standaard?.end ?? settings.booking_end_time) === u}
              onPress={() => zetStandaard({ end: u })}
            />
          ))}
        </View>

        {standaard ? (
          <Button
            label={t('Terug naar de tijd van de club')}
            variant="secondary"
            fullWidth={false}
            onPress={() => {
              void updateUser(trainer.id, { working_hours: undefined });
            }}
          />
        ) : null}
      </Card>

      <Card>
        <View style={styles.kop}>
          <Plus size={18} color={tennisColors.primary} />
          <Text style={styles.kopTekst}>{t('Afwijkende periode')}</Text>
        </View>
        <Text style={styles.help}>
          {t('Van datum tot datum andere uren — of helemaal geen les, bijvoorbeeld een week '
            + 'waarin deze trainer er niet is.')}
        </Text>

        <Text style={styles.labelTijden}>{t('Naam (mag leeg)')}</Text>
        <TextInput
          style={styles.inputTijden}
          value={naam}
          onChangeText={setNaam}
          placeholder={t('bv. Zomerrooster')}
          placeholderTextColor={tennisColors.textMuted}
        />

        <View style={styles.datumRij}>
          <View style={styles.veld}>
            <Text style={styles.labelTijden}>{t('Van')}</Text>
            <DatumVeld
              waarde={van}
              onChange={setVan}
            />
          </View>
          <View style={styles.veld}>
            <Text style={styles.labelTijden}>{t('Tot en met')}</Text>
            <TextInput
              style={styles.inputTijden}
              value={tot}
              onChangeText={setTot}
              placeholder={t('leeg = dezelfde dag')}
              placeholderTextColor={tennisColors.textMuted}
              inputMode="numeric"
            />
          </View>
        </View>

        <Text style={styles.labelTijden}>{t('In die periode')}</Text>
        <View style={styles.chipRow}>
          <Chip
            label={t('Andere uren')}
            selected={nieuweUren !== null}
            onPress={() => setNieuweUren({ start: '09:00', end: '21:00' })}
          />
          <Chip
            label={t('Geen les')}
            selected={nieuweUren === null}
            onPress={() => setNieuweUren(null)}
          />
        </View>

        {nieuweUren ? (
          <>
            <Text style={styles.labelTijden}>{t('Van')}</Text>
            <View style={styles.chipRow}>
              {uren.map((u) => (
                <Chip
                  key={`pvan-${u}`}
                  label={u}
                  selected={nieuweUren.start === u}
                  onPress={() => setNieuweUren({ ...nieuweUren, start: u })}
                />
              ))}
            </View>
            <Text style={styles.labelTijden}>{t('Tot')}</Text>
            <View style={styles.chipRow}>
              {uren.map((u) => (
                <Chip
                  key={`ptot-${u}`}
                  label={u}
                  selected={nieuweUren.end === u}
                  onPress={() => setNieuweUren({ ...nieuweUren, end: u })}
                />
              ))}
            </View>
          </>
        ) : null}

        {fout ? <Text style={styles.fout}>{fout}</Text> : null}
        <Button label={t('Periode toevoegen')} variant="primary" onPress={voegToe} />
      </Card>

      {periodes.length === 0 ? (
        <Text style={styles.muted}>{t('Nog geen afwijkende periodes.')}</Text>
      ) : (
        periodes.map((p) => (
          <Card key={p.id}>
            <View style={styles.regel}>
              <View style={styles.regelTekst}>
                <Text style={styles.periodeTijden}>{periodeTekst(p.van, p.tot)}</Text>
                <Text style={styles.periodeOnder}>
                  {p.naam ? `${p.naam} · ` : ''}{urenTekst(p.uren ?? null, t)}
                </Text>
              </View>
              <Button
                label={t('Weg')}
                variant="danger"
                fullWidth={false}
                icon={<Trash2 size={16} color={tennisColors.onFill} />}
                onPress={() => bewaarPeriodes(
                  (trainer.booking_periods ?? []).filter((x) => x.id !== p.id),
                )}
              />
            </View>
          </Card>
        ))
      )}

      {error ? <Text style={styles.fout}>{error}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  // --- de streep tussen de twee helften ------------------------------------
  sectieKop: { gap: spacing.xs, marginTop: spacing.sm },
  sectieRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectieTitel: { ...typography.h2, color: tennisColors.text },
  streep: { height: 1, backgroundColor: tennisColors.border },

  // --- clubkalender --------------------------------------------------------
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
  knop: { marginTop: spacing.md },
  telling: { ...typography.body, color: tennisColors.text, fontWeight: '600' },
  rij: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rijTekst: { flexShrink: 1, flexGrow: 1 },
  naam: { ...typography.h3, color: tennisColors.text },
  periode: { fontSize: 13, color: tennisColors.textMuted },

  // --- boekingstijden ------------------------------------------------------
  uitlegTijden: { ...typography.body, color: tennisColors.textMuted, marginBottom: spacing.md },
  kop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  kopTekst: { ...typography.h3, color: tennisColors.text },
  help: { fontSize: 13, color: tennisColors.textMuted, marginBottom: spacing.sm },
  labelTijden: {
    fontSize: 13, fontWeight: '600', color: tennisColors.textMuted, marginTop: spacing.sm,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  inputTijden: {
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: tennisColors.text, backgroundColor: tennisColors.surface, marginTop: spacing.xs,
  },
  regel: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md,
  },
  regelTekst: { flexShrink: 1 },
  periodeTijden: { ...typography.body, fontWeight: '600', color: tennisColors.text },
  periodeOnder: { fontSize: 13, color: tennisColors.textMuted },

  // --- gedeeld -------------------------------------------------------------
  datumRij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  veld: { flexGrow: 1, flexBasis: 140 },
  muted: { ...typography.body, color: tennisColors.textMuted },
  fout: { color: tennisColors.danger, fontSize: 14, marginTop: spacing.sm },
});
