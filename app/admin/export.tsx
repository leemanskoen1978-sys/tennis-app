// Beheer → Trainingen exporteren: één periode, één Excel-bestand met vier bladen.
//
// Anders dan Historiek gaat dit bestand over de héle club en niet over één trainer (D-01):
// de import van fase 5 leest een heel seizoen terug, en een bestand dat maar de helft van de
// trainers bevat zou die geschiedenis stilzwijgend halveren. Vandaar geen trainerfilter hier.
//
// Het scherm rekent niets uit. Het kiest een periode, geeft die aan lib/export-trainingen en
// legt de bytes bij lib/share neer.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Download } from 'lucide-react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PeriodPicker } from '../../components/ui/PeriodPicker';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { exportWerkmap } from '../../lib/export-trainingen';
import { shareXlsx, xlsxWordtOndersteund } from '../../lib/share';
import { isAdmin } from '../../lib/rechten';
import {
  bookingsInPeriod, currentPeriod, periodFilename, periodLabel, type Period,
} from '../../lib/period';
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

export default function ExportScreen(): React.JSX.Element {
  const t = useT();
  const { currentUser } = useSimpleData();

  // De grens staat hier, en niet alleen op de tegel in Beheer: een verborgen tegel is geen
  // toegangscontrole, want een trainer kan de link gewoon intikken (D-06). En anders dan bij
  // Lesgroepen vangt de databank de fout hier níet alsnog op: deze fase voegt geen tabel toe
  // en dus ook geen policy die erachter staat. Dit is de enige grens die er is.
  if (!isAdmin(currentUser)) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Exporteren is alleen voor de beheerder.')}</Text>
      </Screen>
    );
  }

  return <ExportInhoud />;
}

/**
 * Alles achter de grens.
 *
 * Apart, omdat de hooks van dit scherm niet vóór de vroege `return` hierboven mogen staan —
 * en die `return` hoort nu juist vóór alle andere schermlogica te komen.
 */
function ExportInhoud(): React.JSX.Element {
  const t = useT();
  const { users, courts, bookings, lesGroepen, error } = useSimpleData();

  const [period, setPeriod] = useState<Period>(() => currentPeriod());
  // Eigen state: een mislukte download is geen opslagfout, dus hij hoort niet in de globale
  // error van de provider thuis.
  const [exportError, setExportError] = useState<string | null>(null);

  // Dezelfde periodefilter als Historiek en Rapport, zodat wat hier geteld wordt en wat in
  // het bestand komt niet uit elkaar kunnen lopen.
  const inPeriode = useMemo(() => bookingsInPeriod(bookings, period), [bookings, period]);

  async function exporteer(): Promise<void> {
    try {
      await shareXlsx(
        periodFilename(period, 'xlsx'),
        exportWerkmap({ bookings: inPeriode, users, courts, groepen: lesGroepen }),
      );
      setExportError(null);
    } catch {
      setExportError(t('Exporteren is niet gelukt. Probeer het opnieuw.'));
    }
  }

  return (
    <Screen>
      <PeriodPicker value={period} onChange={setPeriod} />

      {/* Zien wat je meeneemt vóór je klikt: een lege maand levert anders een bestand met
          vier lege bladen op, en dat merk je pas in Excel. */}
      <Card>
        <Text style={styles.summary}>
          {inPeriode.length === 1 ? t('1 les') : t('{n} lessen', { n: inPeriode.length })}
          {' · '}
          {lesGroepen.length === 1
            ? t('1 lesgroep')
            : t('{n} lesgroepen', { n: lesGroepen.length })}
        </Text>
        {/* De lesgroepen zelf horen bij geen periode — ze staan er het hele seizoen. Wat de
            periode wél afbakent, is hoeveel lessen er per groep in het bestand komen. */}
        <Text style={styles.summaryNote}>
          {t('De lessen zijn die van {periode}; de lesgroepen staan er allemaal in, met hun '
            + 'lessen binnen die periode.', { periode: periodLabel(period) })}
        </Text>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {exportError ? <Text style={styles.error}>{exportError}</Text> : null}

      <View style={styles.exportBlock}>
        {xlsxWordtOndersteund ? (
          <Button
            label={t('Excel (.xlsx)')}
            variant="primary"
            disabled={inPeriode.length === 0}
            icon={<Download size={16} color={tennisColors.onFill} />}
            onPress={() => { void exporteer(); }}
          />
        ) : (
          // Geen knop die het toch niet kan: op een telefoon kan een xlsx het deelmenu niet
          // in — zie het commentaar bij `xlsxWordtOndersteund` in lib/share.
          <Text style={styles.muted}>
            {t('Een Excel-bestand maken kan alleen op de website.')}
          </Text>
        )}
        <Text style={styles.exportNote}>
          {t('Het bestand krijgt vier bladen: Lessen, Uren per trainer, Aanwezigheid en '
            + 'Groepen, over {periode}. Blad “Aanwezigheid” is ook leeg uit te printen als '
            + 'invullijst voor een vervanger die de app niet heeft.', {
            periode: periodLabel(period),
          })}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: tennisColors.textMuted, fontSize: 14 },
  summary: { ...typography.body, color: tennisColors.text, fontWeight: '600' },
  summaryNote: {
    ...typography.body, fontSize: 13, color: tennisColors.textMuted, marginTop: spacing.xs,
  },
  error: { color: tennisColors.danger, fontSize: 14 },
  exportBlock: { gap: spacing.xs },
  exportNote: { fontSize: 13, color: tennisColors.textMuted, textAlign: 'center' },
});
