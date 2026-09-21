// De oefeningen per kleur: kies blauw, rood, oranje of groen en een week, en je krijgt de
// opzet van die les — opwarming, leskern, tussenspel, wedstrijdvorm.
//
// Twee rijen keuzes bovenaan en daaronder één verhaal. Alles staat in de app zelf
// (lib/oefeningen), want op de baan is er vaak geen net. Een speler ziet dit scherm niet:
// het is de opzet voor de trainer.

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Screen } from '../../../components/ui/Screen';
import { Card } from '../../../components/ui/Card';
import { Chip } from '../../../components/ui/Chip';
import { NIVEAUS, type Oefenblok, type Oefenonderdeel } from '../../../lib/oefeningen';
import { kleurIn } from '../../../lib/groepskleur';
import { isCoach } from '../../../lib/rechten';
import { useSimpleData } from '../../../providers/SimpleDataProvider';
import { useT } from '../../../lib/i18n';
import { tennisColors } from '../../../constants/tennis-colors';
import { spacing, radius, typography } from '../../../constants/theme';

export default function OefeningenScreen(): React.JSX.Element {
  const t = useT();
  const { currentUser } = useSimpleData();
  const [niveauIndex, setNiveauIndex] = useState(0);
  const [weekIndex, setWeekIndex] = useState(0);

  if (!isCoach(currentUser)) {
    return (
      <Screen>
        <Text style={styles.leeg}>{t('Alleen een trainer kan de oefeningen per kleur bekijken.')}</Text>
      </Screen>
    );
  }

  const niveau = NIVEAUS[niveauIndex];
  const week = niveau.weken[weekIndex];
  // Het randje links van elk blok: de kleur van het niveau, zodat je ziet welk niveau open
  // staat ook als je ver naar beneden gescrold bent.
  const lijn = { borderLeftWidth: 4, borderLeftColor: kleurIn(niveau.kleur)?.lijnHex };

  return (
    <Screen reading>
      <View style={styles.keuze}>
        {NIVEAUS.map((n, i) => (
          <Chip
            key={n.kleur}
            label={t(kleurNaam(n.kleur))}
            selected={i === niveauIndex}
            onPress={() => setNiveauIndex(i)}
          />
        ))}
      </View>
      <View style={styles.keuze}>
        {niveau.weken.map((_, i) => (
          <Chip
            key={i}
            label={t('Week {n}', { n: i + 1 })}
            selected={i === weekIndex}
            onPress={() => setWeekIndex(i)}
          />
        ))}
      </View>

      <Card style={lijn}>
        <Text style={styles.label}>
          {t('Week {n}', { n: weekIndex + 1 })} · {t(niveau.doel)}
        </Text>
        <Text style={styles.titel}>{week.titel}</Text>
        <View style={styles.woorden}>
          {week.kernwoorden.map((woord) => (
            <Text key={woord} style={styles.woord}>{woord}</Text>
          ))}
        </View>
      </Card>

      <Card style={lijn}>
        <Kop titel={week.opwarming.duur ? t('Opwarming') : t('Opwarming + coördinatie')} duur={week.opwarming.duur} />
        {week.opwarming.regels.map((regel, i) => (
          <Punt key={i} tekst={regel} />
        ))}
      </Card>

      <Onderdeel titel={t('Leskern')} onderdeel={week.leskern} lijn={lijn} />

      {week.tussenspel ? (
        <Card style={lijn}>
          <Kop titel={t('Tussenspel')} duur={week.tussenspel.duur} />
          <Text style={styles.tekst}>{week.tussenspel.tekst}</Text>
        </Card>
      ) : null}

      <Onderdeel titel={t('Wedstrijdvorm')} onderdeel={week.wedstrijdvorm} lijn={lijn} />
    </Screen>
  );
}

function kleurNaam(kleur: string): string {
  return kleur.charAt(0).toUpperCase() + kleur.slice(1);
}

function Onderdeel({
  titel,
  onderdeel,
  lijn,
}: {
  titel: string;
  onderdeel: Oefenonderdeel;
  lijn: { borderLeftWidth: number; borderLeftColor: string | undefined };
}): React.JSX.Element {
  const t = useT();
  return (
    <Card style={lijn}>
      <Kop titel={titel} duur={onderdeel.duur} />
      {onderdeel.materiaal ? (
        <Text style={styles.tekst}>
          <Text style={styles.vet}>{t('Materiaal')}: </Text>
          {onderdeel.materiaal}
        </Text>
      ) : null}
      {onderdeel.kop ? <Text style={[styles.tekst, styles.vet]}>{onderdeel.kop}</Text> : null}
      {onderdeel.blokken.map((blok, i) => (
        <Blok key={i} blok={blok} />
      ))}
    </Card>
  );
}

function Blok({ blok }: { blok: Oefenblok }): React.JSX.Element {
  return (
    <View style={styles.blok}>
      {blok.titel ? <Text style={[styles.tekst, styles.vet]}>{blok.titel}</Text> : null}
      {blok.punten.map((punt, i) => (
        <Punt key={i} tekst={punt} />
      ))}
      {blok.noot ? <Text style={styles.noot}>{blok.noot}</Text> : null}
    </View>
  );
}

function Kop({ titel, duur }: { titel: string; duur?: string }): React.JSX.Element {
  return (
    <View style={styles.kop}>
      <Text style={styles.kopTitel}>{titel}</Text>
      {duur ? <Text style={styles.duur}>{duur}</Text> : null}
    </View>
  );
}

function Punt({ tekst }: { tekst: string }): React.JSX.Element {
  return (
    <View style={styles.punt}>
      <Text style={styles.bolletje}>•</Text>
      <Text style={[styles.tekst, styles.puntTekst]}>{tekst}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  leeg: { ...typography.body, color: tennisColors.textMuted },
  keuze: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  label: { ...typography.label, color: tennisColors.primary, textTransform: 'uppercase' },
  titel: { ...typography.h2, color: tennisColors.text },
  woorden: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  woord: {
    ...typography.caption,
    color: tennisColors.text,
    backgroundColor: tennisColors.primaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  kop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.md },
  kopTitel: { ...typography.h3, color: tennisColors.text, flexShrink: 1 },
  duur: { ...typography.label, color: tennisColors.textMuted },
  tekst: { ...typography.body, color: tennisColors.text },
  vet: { fontWeight: '700' },
  blok: {
    gap: spacing.xs,
    backgroundColor: tennisColors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  punt: { flexDirection: 'row', gap: spacing.sm },
  bolletje: { ...typography.body, color: tennisColors.textMuted },
  puntTekst: { flex: 1 },
  noot: { ...typography.caption, color: tennisColors.textMuted, fontStyle: 'italic' },
});
