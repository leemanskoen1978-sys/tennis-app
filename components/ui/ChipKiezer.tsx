// Een rij chips waaruit je er één kiest, met een bovengrens en een zoekregel erboven.
//
// Waarom de bovengrens er is: de club heeft 193 lesgroepen, waarvan tientallen letterlijk
// "Groep" of "Priveles" heten. Alles tegelijk tonen is een muur waarin niemand iets terugvindt.
// Zolang er niet gezocht wordt staan er hoogstens `MAX_CHIPS`, met eronder hoeveel er nog zijn —
// dat is geen stil wegfilteren: het aantal staat er, en de zoekregel haalt de rest binnen.
//
// Wordt er wél gezocht, dan staat alles wat past er ook echt. Dan heeft de gebruiker zelf
// afgebakend, en een grens erbovenop zou zijn eigen zoekterm tegenspreken.
//
// De gekozen chip staat er altijd bij, ook als hij buiten de zoekterm valt. Wie eerst kiest en
// daarna doortypt, zou anders zijn eigen keuze uit beeld zien verdwijnen terwijl ze nog wél
// meegaat bij het opslaan — en een keuze die je niet ziet, kan je niet terugnemen.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Chip } from './Chip';
import { Zoekregel } from './Zoekregel';
import { zoekOp } from '../../lib/zoeken';
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

const MAX_CHIPS = 12;

export function ChipKiezer<T extends { id: string }>({
  items, label, gekozen, onKies, zoek, onZoek, plaatshouder,
}: {
  items: readonly T[];
  label: (item: T) => string;
  /** Het id van de gekozen chip, of '' als er niets gekozen is. */
  gekozen: string;
  /** Wordt aangeroepen met het id; opnieuw op dezelfde chip drukken is de keuze wissen. */
  onKies: (id: string) => void;
  zoek: string;
  onZoek: (tekst: string) => void;
  plaatshouder: string;
}): React.JSX.Element {
  const t = useT();

  const treffers = zoekOp(items, zoek, label);
  const keuze = gekozen === '' ? undefined : items.find((i) => i.id === gekozen);
  const metKeuze = keuze && !treffers.some((i) => i.id === gekozen)
    ? [keuze, ...treffers]
    : treffers;

  const tonen = zoek === '' ? metKeuze.slice(0, MAX_CHIPS) : metKeuze;
  const verborgen = metKeuze.length - tonen.length;

  return (
    <>
      <Zoekregel waarde={zoek} onChange={onZoek} plaatshouder={plaatshouder} />
      <View style={styles.chipRij}>
        {tonen.map((item) => (
          <Chip
            key={item.id}
            label={label(item)}
            selected={gekozen === item.id}
            onPress={() => onKies(item.id)}
          />
        ))}
      </View>
      {metKeuze.length === 0 ? (
        <Text style={styles.muted}>{t('Niets gevonden. Probeer een andere zoekterm.')}</Text>
      ) : null}
      {verborgen > 0 ? (
        <Text style={styles.muted}>
          {t('Nog {n} van de {totaal} — typ om te zoeken.', { n: verborgen, totaal: items.length })}
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  chipRij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  muted: { ...typography.body, color: tennisColors.textMuted },
});
