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
import { csvRows, toCsv, formatEuro } from '../../lib/csv';
import {
  bookingsInPeriod, currentPeriod, pastBookings, periodFilename, periodLabel, type Period,
} from '../../lib/period';
import { bookingsByCoach, totalRevenue, visibleBookings } from '../../lib/payments';
import { shareCsv } from '../../lib/share';
import type { User } from '../../lib/types';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';
import { useT } from '../../lib/i18n';

export default function HistoriekScreen(): React.JSX.Element {
  const t = useT();
  const { currentUser, bookings, users, courts, error, clearError } = useSimpleData();

  const isCoach = currentUser?.role === 'coach';

  const [period, setPeriod] = useState<Period>(() => currentPeriod());
  // Een trainer kijkt standaard naar zijn eigen lessen; een speler naar die van alle
  // trainers, want het zijn sowieso alleen zijn eigen lessen.
  const [coachId, setCoachId] = useState<string | null>(
    () => (currentUser?.role === 'coach' ? currentUser.id : null),
  );
  // Eigen state: een mislukte download is geen opslagfout, dus hij hoort niet in de
  // globale error van de provider thuis.
  const [exportError, setExportError] = useState<string | null>(null);

  const coaches: User[] = useMemo(() => users.filter((u) => u.role === 'coach'), [users]);

  // Eén moment voor het hele scherm: zou "nu" bij elke tekening opnieuw gelezen worden, dan
  // kon een les tijdens het kijken van de historiek naar "nog te komen" springen.
  const now = useMemo(() => new Date(), []);

  // De volgorde is bewust deze: eerst wie wat mag zien (een speler blijft bij zijn eigen
  // lessen), dan de trainerfilter, dan de periode, en pas dan "al geweest".
  const shown = useMemo(() => {
    const allowed = bookingsByCoach(visibleBookings(currentUser ?? null, bookings), coachId);
    return pastBookings(bookingsInPeriod(allowed, period), now);
  }, [currentUser, bookings, coachId, period, now]);

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

  const filename = periodFilename(period);

  // De fout is één globale bak: wis bij binnenkomst wat een ander scherm achterliet.
  // Alleen bij het openen, zodat een melding van dit scherm zelf blijft staan.
  useEffect(() => {
    clearError();
  }, []);

  async function onExport(): Promise<void> {
    try {
      await shareCsv(filename, toCsv(rows));
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
            {isCoach ? (
              <>
                {' · '}{t('€ {bedrag} geboekt', { bedrag: formatEuro(booked) })}
                {' · '}{t('€ {bedrag} afgehandeld', { bedrag: formatEuro(handled) })}
              </>
            ) : null}
          </Text>
          {isCoach ? (
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
        <Button
          label={t('Exporteren')}
          variant="primary"
          disabled={rows.length === 0}
          icon={<Download size={16} color={tennisColors.onFill} />}
          onPress={() => { void onExport(); }}
        />
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
  exportNote: { fontSize: 13, color: tennisColors.textMuted, textAlign: 'center' },
});
