// Een datum invullen: typen of uit een maandrooster kiezen.
//
// WAAROM ALLEBEI. De gebruiker vroeg om een kalender omdat `dd/mm/jjjj` typen te veel werk was.
// Het tekstveld weghalen zou dat werk verplaatsen in plaats van wegnemen: een datum ver weg —
// juni volgend jaar — kost dan tien keer bladeren, terwijl "15/06/2027" in twee tellen getypt is.
// Wie de datum weet typt hem, wie moet zoeken welke woensdag het is klikt. Allebei de wegen
// vullen hetzelfde veld en er is er geen die de andere blokkeert.
//
// WAAROM ER GEEN BIBLIOTHEEK ONDER ZIT. De datumkiezer van React Native werkt op het web slecht,
// en deze app draait op het web — dat is waar de club hem gebruikt. Een eigen maandrooster is
// een handvol vakjes en ziet er op de telefoon en in de browser hetzelfde uit. Het rekenwerk
// staat in lib/kalenderrooster, met tests: een rooster waarin één dag op de verkeerde plek staat
// ziet er op het scherm volkomen normaal uit.
//
// Dit component beslist niets over de datum zelf. Het geeft de tekst door zoals elk ander
// tekstveld dat doet, en de schermen eromheen houden hun eigen controle (`ziekmeldingFout`,
// `vakantieFout`, `lesGroepFout`). Zo blijft er één plek per scherm die zegt of een periode deugt.

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';

import { useT } from '../../lib/i18n';
import { formatDayInput, parseDayInput } from '../../lib/period';
import {
  beginmaand, maandLabel, maandRooster, verschuifMaand, zelfdeDag, type Maand,
} from '../../lib/kalenderrooster';
import { tennisColors } from '../../constants/tennis-colors';
import { minTapTarget, radius, spacing, typography, webCursor } from '../../constants/theme';

/** De kolomkoppen, maandag vooraan — dezelfde leesvolgorde als de weekagenda. */
const KOPPEN = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'] as const;

export function DatumVeld({
  waarde,
  onChange,
  vandaag = new Date(),
}: {
  waarde: string;
  onChange: (tekst: string) => void;
  /** Alleen voor de tests en het voorbeeldscherm; standaard is het echt vandaag. */
  vandaag?: Date;
}): React.JSX.Element {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [maand, setMaand] = useState<Maand>(() => beginmaand(waarde, vandaag));

  const gekozen = parseDayInput(waarde);

  // Openen zet de maand opnieuw: wie het veld intussen typte, hoort de kalender te zien
  // beginnen bij wat er staat. Sluiten laat hem staan — dat scheelt niets en voorkomt een
  // sprong in beeld tijdens het dichtklappen.
  const wissel = (): void => {
    if (!open) setMaand(beginmaand(waarde, vandaag));
    setOpen(!open);
  };

  const kies = (dag: Date): void => {
    onChange(formatDayInput(dag));
    setOpen(false);
  };

  return (
    <View>
      <View style={styles.rij}>
        <TextInput
          style={styles.input}
          value={waarde}
          onChangeText={onChange}
          placeholder={t('dd/mm/jjjj')}
          placeholderTextColor={tennisColors.textMuted}
          inputMode="numeric"
        />
        <Pressable
          onPress={wissel}
          style={styles.knop}
          accessibilityRole="button"
          accessibilityLabel={t('Kies een datum uit de kalender')}
        >
          <CalendarDays size={20} color={tennisColors.primary} />
        </Pressable>
      </View>

      {open ? (
        <View style={styles.kalender}>
          <View style={styles.maandRij}>
            <Pressable
              onPress={() => setMaand(verschuifMaand(maand, -1))}
              style={styles.pijl}
              accessibilityRole="button"
              accessibilityLabel={t('Maand terug')}
            >
              <ChevronLeft size={20} color={tennisColors.text} />
            </Pressable>
            <Text style={styles.maandNaam}>{maandLabel(maand)}</Text>
            <Pressable
              onPress={() => setMaand(verschuifMaand(maand, 1))}
              style={styles.pijl}
              accessibilityRole="button"
              accessibilityLabel={t('Maand verder')}
            >
              <ChevronRight size={20} color={tennisColors.text} />
            </Pressable>
          </View>

          <View style={styles.weekRij}>
            {KOPPEN.map((kop) => (
              <Text key={kop} style={styles.kopVakje}>{t(kop)}</Text>
            ))}
          </View>

          {maandRooster(maand).map((week, i) => (
            // De index als sleutel mag hier: de rijen van een maand hebben geen eigen
            // identiteit en verschuiven nooit onderling.
            <View key={i} style={styles.weekRij}>
              {week.map((dag, j) => {
                if (dag === null) return <View key={j} style={styles.vakje} />;
                const isGekozen = zelfdeDag(dag, gekozen);
                const isVandaag = zelfdeDag(dag, vandaag);
                return (
                  <Pressable
                    key={j}
                    onPress={() => kies(dag)}
                    style={[
                      styles.vakje,
                      styles.dag,
                      isVandaag && styles.vandaag,
                      isGekozen && styles.gekozen,
                    ]}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.dagTekst, isGekozen && styles.gekozenTekst]}>
                      {dag.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}

          {/* Terug naar vandaag, want dat is waar de meeste keuzes vandaan komen en het is de
              enige sprong die je anders met bladeren moet maken. */}
          <Pressable onPress={() => kies(vandaag)} style={styles.vandaagKnop}>
            <Text style={styles.vandaagTekst}>{t('Vandaag')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rij: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: tennisColors.background,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: tennisColors.text,
  },
  knop: {
    minWidth: minTapTarget,
    minHeight: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    backgroundColor: tennisColors.background,
    ...webCursor,
  },
  kalender: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    backgroundColor: tennisColors.background,
  },
  maandRij: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  maandNaam: { ...typography.body, fontWeight: '600', color: tennisColors.text },
  pijl: {
    minWidth: minTapTarget,
    minHeight: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    ...webCursor,
  },
  weekRij: { flexDirection: 'row' },
  vakje: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  kopVakje: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: tennisColors.textMuted,
    paddingVertical: spacing.xs,
  },
  dag: { borderRadius: radius.sm, ...webCursor },
  // Vandaag krijgt een rand en geen vulling: de vulling is voor de dag die gekozen ís, en twee
  // gevulde vakjes naast elkaar laten je twijfelen welke van de twee je koos.
  vandaag: { borderWidth: 1, borderColor: tennisColors.primary },
  gekozen: { backgroundColor: tennisColors.primary },
  dagTekst: { fontSize: 14, color: tennisColors.text },
  gekozenTekst: { color: tennisColors.background, fontWeight: '600' },
  vandaagKnop: { alignItems: 'center', paddingVertical: spacing.sm, ...webCursor },
  vandaagTekst: { ...typography.body, color: tennisColors.primary, fontWeight: '600' },
});
