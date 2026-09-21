// Dit lesmateriaal doorsturen: aan welke trainer en/of groep, en voor welke periode.
//
// Staat waar je het materiaal al gevonden hebt — in het lesdetail van een training, vanuit de
// databank. Dat scheelt de hele materiaalkiezer: de training die je open hebt ís het materiaal.
// Het beheerscherm hield eerst ook een kiezer voor materiaal, en dat was een muur van chips
// naast de twee andere muren; zoeken doe je in de databank, dus daar hoort het te gebeuren.
//
// Dit onderdeel beslist niets zelf. Of de invoer deugt weet `lesplanningFout` en het
// wegschrijven doet `voegLesplanningenToe` — hier staat alleen hoe het eruitziet.

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';

import { Button } from './ui/Button';
import { Combobox } from './ui/Combobox';
import { DatumVeld } from './ui/DatumVeld';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { lesplanningFout, type Oefeningkeuze } from '../lib/lesplanning';
import { dagSleutel } from '../lib/vakanties';
import { parseDayInput } from '../lib/period';
import { coachesOf } from '../lib/hub';
import { DAY_LABELS } from '../lib/slots';
import { useT } from '../lib/i18n';
import { tennisColors } from '../constants/tennis-colors';
import { radius, spacing, typography, webCursor } from '../constants/theme';

export function LesplanningToevoegen({ lessonId, oefening, onKlaar }: {
  /** Het lesmateriaal dat doorgestuurd wordt. Óf dit, óf `oefening`. */
  lessonId?: string;
  /** Oefeningen per kleur in plaats van een les: welke kleur en welke week. */
  oefening?: Oefeningkeuze;
  /** Wordt aangeroepen na een geslaagde doorsturing, zodat het blad zich kan sluiten. */
  onKlaar: () => void;
}): React.JSX.Element {
  const t = useT();
  const { users, lesGroepen, voegLesplanningenToe, error } = useSimpleData();

  // `null` en niet '': dat is wat `Combobox` teruggeeft als er niets gekozen is. Naar de lib en
  // naar de databank gaat het als een lege tekst respectievelijk `undefined` — zie hieronder.
  // (Voor de groepen geldt dat niet: die staan als lijst hieronder.)
  const [coachId, setCoachId] = useState<string | null>(null);
  // Meerdere groepen mogen: de kiezer hieronder werkt als "voeg toe" en de gekozen groepen staan
  // eronder als labels. Elke groep wordt bij het doorsturen een eigen rij (zie `stuurDoor`).
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [van, setVan] = useState('');
  const [tot, setTot] = useState('');

  const trainers = coachesOf(users);
  const groepen = lesGroepen.filter((g) => !g.archived);
  // Wie al gekozen is, staat niet meer in de lijst: twee keer dezelfde groep is één rij te veel.
  const nogTeKiezen = groepen.filter((g) => !groupIds.includes(g.id));
  // In de volgorde van kiezen. Een groep die intussen gearchiveerd is valt hier weg, en dus ook
  // uit wat er doorgestuurd wordt.
  const gekozenGroepen = groupIds.flatMap((id) => {
    const g = groepen.find((x) => x.id === id);
    return g ? [g] : [];
  });

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

  // `lesplanningFout` wil één tekst voor "wat wordt er doorgestuurd"; bij oefeningen is dat de
  // kleur en de week, en bij een leeg formulier (geen van beide) blijft het leeg.
  const wat = lessonId ?? (oefening ? `${oefening.kleur}-week${oefening.week}` : '');
  // Voor de controle telt alleen of er een groep is; welke maakt niet uit.
  const fout = lesplanningFout(wat, coachId ?? '', gekozenGroepen[0]?.id ?? '', vanSleutel, totSleutel);

  const stuurDoor = async (): Promise<void> => {
    if (fout !== null) return;
    const basis = {
      // Een les, of een kleur mét een week: nooit allebei (`les_planning_wat` in de databank).
      ...(lessonId !== undefined
        ? { lesson_id: lessonId }
        : { oefening_kleur: oefening?.kleur, oefening_week: oefening?.week }),
      // Leeg is `undefined` op het type en niet een lege tekst: zo leest `geldtVoor` het, en zo
      // komt er ook geen lege verwijzing in de databank.
      coach_id: coachId ?? undefined,
      van: vanSleutel,
      tot: totSleutel,
    };
    // Eén rij per groep, elk met dezelfde trainer en periode. Zonder groep één rij voor de
    // trainer alleen.
    await voegLesplanningenToe(
      gekozenGroepen.length > 0
        ? gekozenGroepen.map((g) => ({ ...basis, group_id: g.id }))
        : [{ ...basis, group_id: undefined }],
    );
    setCoachId(null); setGroupIds([]); setVan(''); setTot('');
    onKlaar();
  };

  return (
    <View style={styles.blok}>
      <Text style={styles.label}>{t('Trainer')}</Text>
      <Combobox
        items={trainers}
        label={(c) => c.name}
        value={coachId}
        onChange={setCoachId}
        plaatshouder={t('Zoek een trainer…')}
        leeghint={t('Geen trainer gekozen')}
      />

      <Text style={styles.label}>{t('Groepen')}</Text>
      {/* De kiezer is hier een "voeg toe": hij kiest één groep, die eronder als label komt te
          staan, en begint dan weer leeg (de `key` zet hem terug). Zo blijft het zoeken door de
          tientallen groepen hetzelfde als altijd, en kun je er meer dan één kiezen. */}
      <Combobox
        key={gekozenGroepen.length}
        items={nogTeKiezen}
        label={groepLabel}
        value={null}
        onChange={(id) => { if (id !== null) setGroupIds([...groupIds, id]); }}
        plaatshouder={t('Zoek een groep…')}
        leeghint={gekozenGroepen.length === 0 ? t('Geen groep gekozen') : t('Nog een groep erbij zoeken')}
      />
      {gekozenGroepen.length > 0 ? (
        <View style={styles.groepen}>
          {gekozenGroepen.map((g) => (
            <Pressable
              key={g.id}
              accessibilityRole="button"
              accessibilityLabel={t('Groep weghalen: {naam}', { naam: groepLabel(g) })}
              onPress={() => setGroupIds(groupIds.filter((id) => id !== g.id))}
              style={[styles.groepChip, webCursor]}
            >
              <Text style={styles.groepTekst}>{groepLabel(g)}</Text>
              <X size={14} color={tennisColors.textMuted} />
            </Pressable>
          ))}
        </View>
      ) : null}

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
      {fout !== null && (coachId !== null || gekozenGroepen.length > 0 || van !== '' || tot !== '') ? (
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
  groepen: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  groepChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.pill,
    backgroundColor: tennisColors.primaryTint, paddingVertical: 6, paddingHorizontal: spacing.md,
  },
  groepTekst: { fontSize: 13, color: tennisColors.text },
  datumRij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  veld: { flexGrow: 1, flexBasis: 140 },
  fout: { color: tennisColors.danger, fontSize: 14, marginTop: spacing.sm },
});
