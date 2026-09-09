// Het verloop van één speler: hoe zijn scores lopen over de maanden heen.
//
// Waarom dit een beeld is en geen lijst: de scores stonden al per notitie in de tijdlijn, en
// juist dáár zag niemand een verloop in. Vijftig losse sterren over een half jaar lees je niet;
// zes staafjes naast elkaar wel.
//
// Wat er gerekend wordt, staat in lib/voortgangverloop — met tests, want een grafiek waarin een
// gemiddelde verkeerd staat ziet er volkomen normaal uit. Dit bestand tekent alleen.
//
// Dezelfde vorm als het omzetverloop in Beheer → Rapport, met opzet: twee grafieken die
// hetzelfde bedoelen ("hoe loopt het over de maanden") horen hetzelfde gelezen te worden.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { BarChart, type Bar } from '../ui/BarChart';
import { TRAINING_LABELS } from './ProgressViews';
import {
  gemiddeldePerSoort, voortgangPerMaand, voortgangSamenvatting,
} from '../../lib/voortgangverloop';
import { useT } from '../../lib/i18n';
import type { StudentProgress } from '../../lib/types';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

/** Hoeveel maanden het verloop terugkijkt. Een seizoen loopt van september tot juni. */
const MAANDEN = 10;

/** Een getal met een komma in plaats van een punt: 4,3 en niet 4.3. */
function score(n: number): string {
  return String(n).replace('.', ',');
}

export function VoortgangVerloop({
  progress,
  studentId,
}: {
  progress: StudentProgress[];
  studentId: string;
}): React.JSX.Element | null {
  const t = useT();

  const reeks = voortgangPerMaand(progress, studentId, new Date(), MAANDEN);
  const samen = voortgangSamenvatting(reeks);
  const soorten = gemiddeldePerSoort(progress, studentId);

  // Nog nergens een score: dan hoort er geen lege grafiek te staan. Tien lege staafjes met
  // "geen gegevens" eronder lezen als "deze speler doet het slecht", en dat staat er niet.
  if (samen.aantal === 0) {
    return (
      <Text style={styles.leeg}>
        {t('Nog geen scores. Zodra je bij een notitie sterren zet, verschijnt hier het verloop.')}
      </Text>
    );
  }

  // Een maand zonder scores krijgt hoogte 0 en geen opschrift: het staafje is er niet, en het
  // gat tussen de andere staafjes is precies wat je wilt zien.
  const bars: Bar[] = reeks.map((p) => ({
    label: p.label,
    value: p.gemiddelde ?? 0,
    caption: p.gemiddelde === null ? '' : score(p.gemiddelde),
  }));

  const gesproken = `${t('Gemiddelde score per maand.')} ${reeks
    .map((p) => (p.gemiddelde === null
      ? t('{maand}: geen notities', { maand: p.label })
      : t('{maand}: {score} uit {n}', {
        maand: p.label,
        score: score(p.gemiddelde),
        n: p.aantal === 1 ? t('1 notitie') : t('{n} notities', { n: p.aantal }),
      })))
    .join('. ')}.`;

  return (
    <View style={styles.blok}>
      <BarChart bars={bars} accessibilityLabel={gesproken} />

      <Text style={styles.samenvatting}>
        {t('Gemiddeld {score} uit {n}', {
          score: score(samen.gemiddelde ?? 0),
          n: samen.aantal === 1 ? t('1 notitie') : t('{n} notities', { n: samen.aantal }),
        })}
        {/* Het verschil staat er alleen als er in minstens twee maanden gescoord is — met één
            maand valt er geen verloop te zien. Geen oordeel erbij: wat een verschil van 0,3
            betekent, is een gesprek tussen trainer en speler en geen uitkomst van een som. */}
        {samen.verschil === null ? '' : ` · ${
          samen.verschil > 0
            ? t('{n} hoger dan bij de start', { n: score(samen.verschil) })
            : samen.verschil < 0
              ? t('{n} lager dan bij de start', { n: score(Math.abs(samen.verschil)) })
              : t('gelijk gebleven')
        }`}
      </Text>

      {/* Waar het aan ligt. Een gemiddelde van 3,2 zegt niet waaraan gewerkt moet worden;
          "techniek 4,1 en fysiek 2,4" wel. */}
      {soorten.length > 1 ? (
        <View style={styles.soorten}>
          {soorten.map((s) => (
            <Text key={s.soort} style={styles.soort}>
              {t(TRAINING_LABELS[s.soort])} {score(s.gemiddelde)}
              <Text style={styles.soortAantal}>
                {s.aantal === 1 ? t(' · 1 notitie') : t(' · {n} notities', { n: s.aantal })}
              </Text>
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={styles.note}>
        {t('De laatste {n} maanden. Een maand zonder notities blijft leeg staan — dat gat is '
          + 'zelf informatie.', { n: MAANDEN })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  blok: { gap: spacing.xs },
  leeg: { ...typography.label, color: tennisColors.textMuted },
  samenvatting: { ...typography.body, color: tennisColors.text, fontWeight: '600' },
  soorten: { gap: 2, marginTop: spacing.xs },
  soort: { ...typography.label, color: tennisColors.text },
  soortAantal: { color: tennisColors.textMuted },
  note: { ...typography.label, color: tennisColors.textMuted, marginTop: spacing.xs },
});
