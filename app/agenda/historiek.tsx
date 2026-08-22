// Historiek: de lessen die geweest zijn, binnen een periode die je zelf kiest en eventueel
// van één trainer. Wat je hier ziet is ook precies wat de export meeneemt — één selectie,
// twee vormen, zodat scherm en bestand niet uit elkaar kunnen lopen.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Download } from 'lucide-react-native';

import { LessonCards } from '../../components/LessonCards';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CoachFilter } from '../../components/ui/CoachFilter';
import { PeriodPicker } from '../../components/ui/PeriodPicker';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { useAgendaScope } from '../../providers/agendaScope';
import { csvRows, toCsv, toXlsx } from '../../lib/csv';
import { formatEuro } from '../../lib/money';
import {
  bookingsInPeriod, currentPeriod, pastBookings, periodFilename, periodLabel, type Period,
} from '../../lib/period';
import { totalRevenue } from '../../lib/payments';
import { shareCsv, shareXlsx, xlsxWordtOndersteund } from '../../lib/share';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';
import { useT } from '../../lib/i18n';
import { isCoach } from '../../lib/rechten';

export default function HistoriekScreen(): React.JSX.Element {
  const t = useT();
  const { currentUser, users, courts, error, clearError } = useSimpleData();
  const { coachId, setCoachId, coaches, bookings } = useAgendaScope();

  const [period, setPeriod] = useState<Period>(() => currentPeriod());
  // Eigen state: een mislukte download is geen opslagfout, dus hij hoort niet in de
  // globale error van de provider thuis.
  const [exportError, setExportError] = useState<string | null>(null);

  // Eén moment voor het hele scherm: zou "nu" bij elke tekening opnieuw gelezen worden, dan
  // kon een les tijdens het kijken van de historiek naar "nog te komen" springen.
  const now = useMemo(() => new Date(), []);

  // `bookings` uit de hook is al afgebakend op wie mag kijken en op de gekozen trainer;
  // hier komt alleen de periode en "al geweest" er nog overheen.
  const shown = useMemo(
    () => pastBookings(bookingsInPeriod(bookings, period), now),
    [bookings, period, now],
  );

  const rows = useMemo(() => csvRows(shown, users, courts), [shown, users, courts]);

  const cancelledIds = useMemo(
    () => new Set(shown.filter((b) => b.status === 'cancelled').map((b) => b.id)),
    [shown],
  );

  // Geboekt: alles wat er nog staat. Een geannuleerde les blijft op het scherm en in het
  // bestand staan, maar telt in geen van beide bedragen mee.
  const booked = rows
    .filter((r) => !cancelledIds.has(r.id))
    .reduce((sum, r) => sum + r.price, 0);
  // Afgehandeld: exact wat Beheer → Rapport als omzet toont, uit dezelfde functie.
  const handled = totalRevenue(shown, courts);

  const csvNaam = periodFilename(period, 'csv');
  const xlsxNaam = periodFilename(period, 'xlsx');

  // De fout is één globale bak: wis bij binnenkomst wat een ander scherm achterliet.
  // Alleen bij het openen, zodat een melding van dit scherm zelf blijft staan.
  useEffect(() => {
    clearError();
  }, []);

  // Twee vormen van dezelfde selectie, dus ook één plek waar het misgaan opgevangen wordt.
  async function exporteer(maak: () => Promise<void>): Promise<void> {
    try {
      await maak();
      setExportError(null);
    } catch {
      setExportError(t('Exporteren is niet gelukt. Probeer het opnieuw.'));
    }
  }

  return (
    <Screen>
      <PeriodPicker value={period} onChange={setPeriod} />

      <CoachFilter coaches={coaches} value={coachId} onChange={setCoachId} />

      {shown.length === 0 ? null : (
        <Card>
          <Text style={styles.summary}>
            {shown.length === 1 ? t('1 les') : t('{n} lessen', { n: shown.length })}
            {/* De bedragen gaan over geld dat binnenkomt; dat is het verhaal van de trainer.
                Een speler krijgt de telling, niet de omzet. */}
            {isCoach(currentUser) ? (
              <>
                {' · '}{t('€ {bedrag} geboekt', { bedrag: formatEuro(booked) })}
                {' · '}{t('€ {bedrag} afgehandeld', { bedrag: formatEuro(handled) })}
              </>
            ) : null}
          </Text>
          {isCoach(currentUser) ? (
            <Text style={styles.summaryNote}>
              {t('Geannuleerde lessen tellen in geen van beide bedragen mee. “Afgehandeld” is '
                + 'hetzelfde bedrag als de omzet in Beheer → Rapport.')}
              {/* Bij "Alle trainers" gaat het bedrag niet meer over de trainer zelf maar over de
                  hele club; dat mag niet stilzwijgend gebeuren. */}
              {' '}
              {coachId === null
                ? t('Dit zijn de bedragen van de hele club.')
                : t('Dit zijn de bedragen van {trainer}.', {
                  trainer: coaches.find((c) => c.id === coachId)?.name ?? t('deze trainer'),
                })}
            </Text>
          ) : null}
        </Card>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <LessonCards
        bookings={shown}
        empty={t('Geen lessen die geweest zijn in {periode}.', { periode: periodLabel(period) })}
      />

      {exportError ? <Text style={styles.error}>{exportError}</Text> : null}

      <View style={styles.exportBlock}>
        {/* Excel voorop: dat is wat een trainer opent. De CSV blijft ernaast staan voor wie
            het bestand ergens anders in laadt — een boekhoudpakket vraagt er nog vaak om. */}
        <View style={styles.exportRow}>
          {xlsxWordtOndersteund ? (
            <Button
              label={t('Excel (.xlsx)')}
              variant="primary"
              style={styles.exportButton}
              disabled={rows.length === 0}
              icon={<Download size={16} color={tennisColors.onFill} />}
              onPress={() => { void exporteer(() => shareXlsx(xlsxNaam, toXlsx(rows))); }}
            />
          ) : null}
          <Button
            label={t('CSV')}
            variant={xlsxWordtOndersteund ? 'secondary' : 'primary'}
            style={styles.exportButton}
            disabled={rows.length === 0}
            icon={(
              <Download
                size={16}
                color={xlsxWordtOndersteund ? tennisColors.text : tennisColors.onFill}
              />
            )}
            onPress={() => { void exporteer(() => shareCsv(csvNaam, toCsv(rows))); }}
          />
        </View>
        <Text style={styles.exportNote}>
          {t('Het bestand bevat precies de lessen die je hier ziet: {periode}, {trainer}.', {
            periode: periodLabel(period),
            trainer: coachId === null
              ? t('alle trainers')
              : coaches.find((c) => c.id === coachId)?.name ?? t('één trainer'),
          })}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { ...typography.body, color: tennisColors.text, fontWeight: '600' },
  summaryNote: { ...typography.body, fontSize: 13, color: tennisColors.textMuted, marginTop: spacing.xs },
  error: { color: tennisColors.danger, fontSize: 14 },
  exportBlock: { gap: spacing.xs },
  exportRow: { flexDirection: 'row', gap: spacing.sm },
  // Allebei de knoppen even breed: de ene is niet belangrijker dan de andere qua ruimte,
  // alleen qua nadruk (gevuld tegenover omlijnd).
  exportButton: { flex: 1 },
  exportNote: { fontSize: 13, color: tennisColors.textMuted, textAlign: 'center' },
});
