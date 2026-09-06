// Beheer → Banen. Per baan het uurtarief en de groepstaffel.
//
// Het uurtarief geldt voor een privéles. De staffel eronder zegt wat een groep kost: "tot 2
// spelers € 30, tot 4 spelers € 45". Elk bedrag is het TOTAAL voor de les en niet per speler —
// dat staat er ook op het scherm bij, want dat is precies wat iemand verkeerd gokt.
//
// Zonder staffel werkt alles zoals vroeger: dan geldt het uurtarief voor elke groepsgrootte.
//
// De vorm van dit scherm: één keuzelijst met daaronder de baan die gekozen is. Eerder stond
// er een altijd openstaand toevoegformulier met daarachter elke baan als volle kaart. Bij elf
// banen was dat elf keer dezelfde vier opschriften, waarvan negen keer drie regels om te
// zeggen dat er géén staffel is. Een baan wordt één keer gemaakt en daarna nooit meer, en er
// wordt aan één baan tegelijk gerekend — dus staat het toevoegen achter een knop en de rest
// achter de keuze.

import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Check, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Chip } from '../../components/ui/Chip';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { groupRateSteps } from '../../lib/payments';
import { baanFout, type NieuweBaan } from '../../lib/banen';
import { isAdmin } from '../../lib/rechten';
import { formatEuro, parseEuro } from '../../lib/money';
import { useT, type Translate } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, typography, minTapTarget, webCursor } from '../../constants/theme';
import type { Court, CourtGroupRate } from '../../lib/types';

/** Wat er in een aantal-spelersveld getypt wordt, als geheel getal. Onzin telt als niets. */
function parsePlayers(text: string): number | undefined {
  const value = Number(text.trim());
  if (!Number.isFinite(value) || value < 1) return undefined;
  return Math.floor(value);
}

/**
 * Hoe een baan in de keuzelijst staat: "7 · Terrein 7 · Binnen".
 *
 * Het nummer staat vooraan omdat de club zo over haar banen praat ("baan 3"), en de ligging
 * staat erbij omdat dat het enige is wat twee banen met bijna dezelfde naam uit elkaar houdt.
 */
function baanLabel(t: Translate, baan: Court): string {
  return `${baan.number} · ${baan.name} · ${baan.indoor ? t('Binnen') : t('Buiten')}`;
}

/**
 * Welke baan je aan het bijstellen bent.
 *
 * Waarom een uitklaplijst en geen rij chips, terwijl chips elders in Beheer wél de huisvorm
 * zijn om een trainer of een baan te kiezen: die lijsten zijn kort. Elf chips met
 * "7 · Terrein 7" erop vullen op een telefoon vier regels, en dan is het kiezen zelf weer het
 * halve scherm — precies wat hier weg moest. Dichtgeklapt is dit één regel, hoeveel banen er
 * ook bij komen.
 *
 * Bewust geen vrij tekstveld zoals OptionCombobox: er valt hier niets te typen dat geen baan
 * is, en een baan bijmaken hoort in het formulier erboven en niet per ongeluk hier.
 */
function BaanKiezer({ banen, gekozen, onKies }: {
  banen: Court[];
  gekozen: Court;
  onKies: (id: string) => void;
}): React.JSX.Element {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Text style={styles.label}>{t('Welke baan')}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Baan kiezen, nu {baan}', { baan: baanLabel(t, gekozen) })}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={[styles.kiezer, webCursor]}
      >
        <Text style={styles.kiezerTekst} numberOfLines={1}>{baanLabel(t, gekozen)}</Text>
        {open
          ? <ChevronUp size={18} color={tennisColors.textMuted} />
          : <ChevronDown size={18} color={tennisColors.textMuted} />}
      </Pressable>

      {open ? (
        <View style={styles.lijst}>
          {banen.map((baan) => (
            <Pressable
              key={baan.id}
              accessibilityRole="button"
              accessibilityLabel={baanLabel(t, baan)}
              accessibilityState={{ selected: baan.id === gekozen.id }}
              onPress={() => { onKies(baan.id); setOpen(false); }}
              style={[styles.lijstRij, webCursor]}
            >
              <Text style={styles.lijstTekst} numberOfLines={1}>{baanLabel(t, baan)}</Text>
              {baan.id === gekozen.id ? <Check size={16} color={tennisColors.primary} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Alle banen onder elkaar, alleen om te lezen.
 *
 * De kiezer erboven maakt het scherm rustig, maar neemt één ding weg: het overzicht. Naast
 * elkaar gezet valt een baan die op 55 staat terwijl de rest op 60 staat meteen op; achter
 * een uitklaplijst moet je hem gaan zoeken. Vandaar deze lijst — en vandaar dat er geen
 * invoervelden in staan: die maken er een tweede editor van, en dan is het scherm weer even
 * log als vóór deze verbouwing.
 *
 * De staffel staat er als aantal stappen en niet uitgeschreven: "tot 2 spelers € 30, tot 4
 * spelers € 45" past niet op een regel, en de vraag die deze lijst beantwoordt is "heeft
 * deze baan er een", niet "wat staat erin". Dat laatste leest hij in het blok erboven.
 *
 * Tikken kiest de baan hierboven: dat is sneller dan de lijst openklappen, en het is meteen
 * waarom een baan die opvalt ook aan te klikken is.
 */
function BanenOverzicht({ banen, gekozenId, onKies }: {
  banen: Court[];
  gekozenId: string;
  onKies: (id: string) => void;
}): React.JSX.Element {
  const t = useT();
  return (
    <View>
      <Text style={styles.label}>{t('Alle banen')}</Text>
      <View style={styles.lijst}>
        {banen.map((baan) => {
          const stappen = groupRateSteps(baan).length;
          const tarief = `€ ${formatEuro(baan.hourly_rate)}`;
          const staffel = stappen === 0
            ? ''
            : stappen === 1 ? t('1 staffelstap') : t('{n} staffelstappen', { n: stappen });
          return (
            <Pressable
              key={baan.id}
              accessibilityRole="button"
              // Uit stukken die al vertaald zijn: een schermlezer hoort nummer, naam,
              // ligging, tarief en of er een staffel op staat — precies de regel zelf.
              accessibilityLabel={
                [baanLabel(t, baan), tarief, staffel].filter((deel) => deel !== '').join(' · ')
              }
              accessibilityState={{ selected: baan.id === gekozenId }}
              onPress={() => onKies(baan.id)}
              style={[
                styles.lijstRij,
                webCursor,
                baan.id === gekozenId && styles.lijstRijGekozen,
              ]}
            >
              <Text style={styles.overzichtNummer}>{baan.number}</Text>
              <Text style={styles.overzichtNaam} numberOfLines={1}>{baan.name}</Text>
              {/* Als er iets moet wijken op een smal scherm is het de ligging en niet het
                  bedrag: het bedrag is waarvoor deze lijst bestaat. Vandaar een hogere
                  `flexShrink` hier en een vaste breedte op het tarief. */}
              <Text style={styles.overzichtLigging} numberOfLines={1}>
                {baan.indoor ? t('Binnen') : t('Buiten')}
              </Text>
              {staffel !== '' ? (
                <Text style={styles.overzichtStaffel} numberOfLines={1}>{staffel}</Text>
              ) : null}
              <Text style={styles.overzichtTarief}>{tarief}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * De tarieven van de gekozen baan. De velden schrijven meteen weg zodra ze een bruikbare
 * waarde hebben: een aparte bewaarknop per baan zou betekenen dat de trainer een half
 * ingevulde staffel achter kan laten, en die rekent dan mee.
 */
function BaanTarieven({ court }: { court: Court }): React.JSX.Element {
  const t = useT();
  const { updateCourt } = useSimpleData();
  // Wat er in de velden staat terwijl er getypt wordt. Zonder dit springt "4" tijdens het
  // wissen van "45" even naar het opgeslagen bedrag terug.
  const [typed, setTyped] = useState<Record<string, string>>({});

  const steps = groupRateSteps(court);
  const value = (key: string, stored: string): string => typed[key] ?? stored;
  const setTypedValue = (key: string, text: string): void =>
    setTyped((current) => ({ ...current, [key]: text }));

  const saveSteps = (next: CourtGroupRate[]): void => {
    // Leeg wegschrijven en niet een lege lijst laten staan: geen staffel is een toestand,
    // en `undefined` is hoe de rest van de app dat leest.
    void updateCourt(court.id, { group_rates: next.length > 0 ? next : undefined });
    setTyped({});
  };

  const patchStep = (index: number, patch: Partial<CourtGroupRate>): void => {
    saveSteps(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const addStep = (): void => {
    const last = steps[steps.length - 1];
    // Een nieuwe stap begint één speler groter en op hetzelfde bedrag: zo hoeft de trainer
    // alleen het bedrag te veranderen, en staat er nooit een stap die niets betekent.
    saveSteps([
      ...steps,
      {
        max_players: (last?.max_players ?? 2) + 2,
        rate: last?.rate ?? court.hourly_rate,
      },
    ]);
  };

  return (
    <Card>
      <View style={styles.row}>
        <Text style={styles.name} numberOfLines={1}>{`${court.number} · ${court.name}`}</Text>
        <Badge
          label={court.indoor ? t('Binnen') : t('Buiten')}
          color={court.indoor ? tennisColors.courtFill : tennisColors.primaryFill}
          subtle={!court.indoor}
        />
      </View>

      <Text style={styles.label}>{t('Uurtarief privéles')}</Text>
      <View style={styles.field}>
        <Text style={styles.euro}>€</Text>
        <TextInput
          style={styles.input}
          value={value(`rate-${court.id}`, formatEuro(court.hourly_rate))}
          onChangeText={(t) => {
            setTypedValue(`rate-${court.id}`, t);
            const parsed = parseEuro(t);
            if (parsed !== undefined) void updateCourt(court.id, { hourly_rate: parsed });
          }}
          onBlur={() => setTyped({})}
          keyboardType="decimal-pad"
          accessibilityLabel={t('Uurtarief van {baan}', { baan: court.name })}
          placeholderTextColor={tennisColors.textMuted}
        />
        <Text style={styles.perHour}>{t('per uur')}</Text>
      </View>

      <Text style={styles.label}>{t('Groepstarief')}</Text>
      {steps.length === 0 ? (
        <Text style={styles.help}>
          {t('Geen staffel: ook een groepsles rekent dan het uurtarief hierboven.')}
        </Text>
      ) : null}

      {steps.map((step, index) => (
        <View key={`${court.id}-${index}`} style={styles.stepRow}>
          <Text style={styles.stepText}>{t('tot')}</Text>
          <TextInput
            style={[styles.input, styles.small]}
            value={value(`p-${court.id}-${index}`, String(step.max_players))}
            onChangeText={(t) => {
              setTypedValue(`p-${court.id}-${index}`, t);
              const parsed = parsePlayers(t);
              if (parsed !== undefined) patchStep(index, { max_players: parsed });
            }}
            onBlur={() => setTyped({})}
            keyboardType="number-pad"
            accessibilityLabel={t('Tot hoeveel spelers, stap {nr} van {baan}', { nr: index + 1, baan: court.name })}
          />
          <Text style={styles.stepText}>{t('spelers')} · €</Text>
          <TextInput
            style={[styles.input, styles.small]}
            value={value(`r-${court.id}-${index}`, formatEuro(step.rate))}
            onChangeText={(t) => {
              setTypedValue(`r-${court.id}-${index}`, t);
              const parsed = parseEuro(t);
              if (parsed !== undefined) patchStep(index, { rate: parsed });
            }}
            onBlur={() => setTyped({})}
            keyboardType="decimal-pad"
            accessibilityLabel={t('Bedrag van stap {nr} van {baan}', { nr: index + 1, baan: court.name })}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Stap {nr} van {baan} verwijderen', { nr: index + 1, baan: court.name })}
            onPress={() => saveSteps(steps.filter((_, i) => i !== index))}
            style={[styles.remove, webCursor]}
          >
            <Trash2 size={18} color={tennisColors.danger} />
          </Pressable>
        </View>
      ))}

      <View style={styles.addRow}>
        <Button
          label={t('Stap toevoegen')}
          variant="secondary"
          fullWidth={false}
          icon={<Plus size={16} color={tennisColors.text} />}
          onPress={addStep}
        />
      </View>
    </Card>
  );
}

export default function Courts(): React.JSX.Element {
  const t = useT();
  const { currentUser } = useSimpleData();

  // De grens staat hier, en niet alleen op de tegel in Beheer: een verborgen tegel is geen
  // toegangscontrole, want een trainer kan de link gewoon intikken. Waarom de beheerder en
  // niet elke trainer: het uurtarief van een baan is wat een speler per uur betaalt, en dat
  // is geld. De databank weigert het schrijven daarna ook — `courts_write` staat op
  // `is_admin()` — maar dan zag de trainer het scherm al wel.
  if (!isAdmin(currentUser)) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Banen zijn alleen voor de beheerder.')}</Text>
      </Screen>
    );
  }

  return <BanenInhoud />;
}

/**
 * Alles achter de grens.
 *
 * Apart, omdat de hooks van dit scherm niet vóór de vroege `return` hierboven mogen staan —
 * en die `return` hoort nu juist vóór alle andere schermlogica te komen. Dezelfde oplossing
 * als op het exportscherm.
 */
function BanenInhoud(): React.JSX.Element {
  const t = useT();
  const { courts, addCourt, error } = useSimpleData();
  const sorted = [...courts].sort((a, b) => a.number - b.number);

  const [naam, setNaam] = useState('');
  const [nummer, setNummer] = useState('');
  const [uurtarief, setUurtarief] = useState('');
  const [binnen, setBinnen] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  // Een baan maak je één keer en daarna nooit meer. Dichtgeklapt kost dat één knop; open
  // stond het scherm een half venster lang in de weg van waar het echt over gaat.
  const [formulierOpen, setFormulierOpen] = useState(false);
  // Welke baan er onder de kiezer staat. `null` betekent: nog niet gekozen, en dan valt de
  // keuze op de eerste baan terug. Niets tonen zou een scherm opleveren dat niets doet, en
  // de laagste baan is de baan waar iemand toch begint.
  const [gekozenId, setGekozenId] = useState<string | null>(null);
  const gekozen = sorted.find((c) => c.id === gekozenId) ?? sorted[0];

  const voegToe = async (): Promise<void> => {
    const concept: NieuweBaan = { naam, nummer, uurtarief, indoor: binnen };
    // Eén plek waar de regels staan: lib/banen. Hier alleen de melding tonen. Een tweede
    // kopie in dit scherm zou vroeg of laat iets doorlaten dat de provider daarna weigert.
    const melding = baanFout(concept, courts);
    if (melding) {
      setFout(melding);
      return;
    }
    setFout(null);
    const gemaakt = await addCourt(concept);
    // Alleen leegmaken als de baan er echt staat: mislukt het wegschrijven, dan blijft wat
    // ingetypt was staan en hoeft niemand het opnieuw te typen. Om dezelfde reden klapt het
    // formulier ook alleen dicht als de baan er is.
    if (!gemaakt) return;
    setNaam('');
    setNummer('');
    setUurtarief('');
    setBinnen(false);
    setFormulierOpen(false);
    // Meteen naar de verse baan: wie er net een maakte, wil er een tarief op zetten.
    setGekozenId(gemaakt.id);
  };

  return (
    <Screen>
      {formulierOpen ? (
        <Card>
          <Text style={styles.name}>{t('Baan toevoegen')}</Text>

          <Text style={styles.label}>{t('Naam')}</Text>
          <TextInput
            style={styles.input}
            value={naam}
            onChangeText={setNaam}
            placeholder={t('bv. Gravel 3')}
            placeholderTextColor={tennisColors.textMuted}
          />

          <View style={styles.formRij}>
            <View style={styles.veld}>
              <Text style={styles.label}>{t('Nummer')}</Text>
              <TextInput
                style={styles.input}
                value={nummer}
                onChangeText={setNummer}
                placeholder={t('bv. 3')}
                placeholderTextColor={tennisColors.textMuted}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.veld}>
              <Text style={styles.label}>{t('Uurtarief privéles')}</Text>
              <View style={styles.field}>
                <Text style={styles.euro}>€</Text>
                <TextInput
                  style={[styles.input, styles.groeit]}
                  value={uurtarief}
                  onChangeText={setUurtarief}
                  placeholder={t('bv. 30')}
                  placeholderTextColor={tennisColors.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>

          <Text style={styles.label}>{t('Ligging')}</Text>
          <View style={styles.chipRij}>
            <Chip label={t('Buiten')} selected={!binnen} onPress={() => setBinnen(false)} />
            <Chip label={t('Binnen')} selected={binnen} onPress={() => setBinnen(true)} />
          </View>

          {fout ? <Text style={styles.fout}>{fout}</Text> : null}

          <Button
            label={t('Toevoegen')}
            onPress={() => { void voegToe(); }}
            icon={<Plus size={16} color={tennisColors.onFill} />}
            style={styles.knop}
          />
          <Button
            label={t('Annuleren')}
            variant="secondary"
            onPress={() => { setFormulierOpen(false); setFout(null); }}
          />

          <Text style={styles.help}>
            {t('Een nieuwe baan begint zonder staffel: tot je er een instelt, geldt dit '
              + 'uurtarief ook voor een groepsles.')}
          </Text>
        </Card>
      ) : (
        <View style={styles.addRow}>
          <Button
            label={t('Baan toevoegen')}
            variant="secondary"
            fullWidth={false}
            icon={<Plus size={16} color={tennisColors.text} />}
            onPress={() => setFormulierOpen(true)}
          />
        </View>
      )}

      {/* Buiten het formulier, want het formulier staat er meestal niet: een mislukt tarief
          zou anders zonder melding verdwijnen. */}
      {error ? <Text style={styles.fout}>{error}</Text> : null}

      {gekozen === undefined ? (
        <Text style={styles.muted}>{t('Nog geen banen.')}</Text>
      ) : (
        <>
          <BaanKiezer banen={sorted} gekozen={gekozen} onKies={setGekozenId} />
          {/* `key` op de baan: zo begint het getypte veld van de volgende baan leeg in
              plaats van met het bedrag dat je bij de vorige aan het typen was. */}
          <BaanTarieven key={gekozen.id} court={gekozen} />
          <BanenOverzicht banen={sorted} gekozenId={gekozen.id} onKies={setGekozenId} />
        </>
      )}

      <Text style={styles.help}>
        {t('Elk bedrag is het totaal voor de hele les, niet per speler: "tot 4 spelers € 45" '
          + 'betekent dat een les met vier spelers samen € 45 per uur kost. Een groepsles gaat '
          + 'altijd op factuur — een beurtenkaart en het sponsorbudget gelden alleen voor een '
          + 'privéles. Deze tarieven bepalen de omzetberekening.')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: tennisColors.textMuted, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { ...typography.h3, color: tennisColors.text, flexShrink: 1 },
  label: {
    ...typography.label,
    color: tennisColors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
    flexWrap: 'wrap',
  },
  stepText: { fontSize: 14, color: tennisColors.text },
  euro: { fontSize: 15, color: tennisColors.text },
  perHour: { fontSize: 13, color: tennisColors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: minTapTarget,
    minWidth: 90,
    fontSize: 15,
    color: tennisColors.text,
    backgroundColor: tennisColors.surface,
  },
  small: { minWidth: 64, maxWidth: 84 },
  remove: {
    minHeight: minTapTarget,
    minWidth: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: { marginTop: spacing.sm, alignItems: 'flex-start' },
  help: { fontSize: 13, color: tennisColors.textMuted },
  formRij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  veld: { flexGrow: 1, flexBasis: 140 },
  groeit: { flexGrow: 1 },
  chipRij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  knop: { marginTop: spacing.md, marginBottom: spacing.sm },
  fout: { color: tennisColors.danger, fontSize: 14, marginTop: spacing.sm },
  kiezer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    backgroundColor: tennisColors.surface,
    paddingHorizontal: 12,
    minHeight: minTapTarget,
  },
  // `flexShrink` en niet `flex`: op een smal scherm krimpt de naam en blijft het pijltje
  // staan, in plaats van dat het pijltje van het scherm geduwd wordt.
  kiezerTekst: { fontSize: 15, color: tennisColors.text, flexShrink: 1 },
  lijst: {
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    backgroundColor: tennisColors.surface,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  lijstRij: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: 12,
    minHeight: minTapTarget,
  },
  lijstTekst: { fontSize: 15, color: tennisColors.text, flexShrink: 1 },
  lijstRijGekozen: { backgroundColor: tennisColors.primaryTint },
  // Vaste breedte op het nummer: zo staan de namen onder elkaar en lees je de lijst als een
  // kolom in plaats van als elf losse regels.
  overzichtNummer: {
    width: 24,
    fontSize: 15,
    fontWeight: '700',
    color: tennisColors.textMuted,
  },
  overzichtNaam: { flexGrow: 1, flexShrink: 1, fontSize: 15, color: tennisColors.text },
  overzichtLigging: { flexShrink: 4, fontSize: 13, color: tennisColors.textMuted },
  overzichtStaffel: { flexShrink: 2, fontSize: 13, color: tennisColors.textMuted },
  overzichtTarief: { flexShrink: 0, fontSize: 15, color: tennisColors.text, fontWeight: '600' },
});
