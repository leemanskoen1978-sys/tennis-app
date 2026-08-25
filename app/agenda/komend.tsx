// Nog te komen: alle lessen die nog moeten plaatsvinden, op tijd oplopend. Geen
// periodekiezer — je wilt hier juist niets missen. Geannuleerde lessen staan er niet bij;
// die komen niet meer.
//
// Wél een export, en precies één soort: een agendabestand. Een afrekening hoort op
// Historiek — daar staan de bedragen — maar je lessen in je eigen agenda zetten gaat over
// wat er nog komt, en dat is dit scherm. Het bestand is dubbelvrij: zie lib/ics.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CalendarPlus } from 'lucide-react-native';

import { LessonCards } from '../../components/LessonCards';
import { Screen } from '../../components/ui/Screen';
import { Button } from '../../components/ui/Button';
import { CoachFilter } from '../../components/ui/CoachFilter';
import { useSchoneLei, useSimpleData } from '../../providers/SimpleDataProvider';
import { useAgendaScope } from '../../providers/agendaScope';
import { upcomingBookings } from '../../lib/period';
import { icsFilename, toIcs } from '../../lib/ics';
import { shareIcs } from '../../lib/share';
import { isCoach } from '../../lib/rechten';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';
import { useT } from '../../lib/i18n';

export default function KomendScreen(): React.JSX.Element {
  const t = useT();
  const { currentUser, users, courts, error } = useSimpleData();
  const { coachId, setCoachId, coaches, bookings } = useAgendaScope();
  useSchoneLei();

  // Eigen state: een mislukte download is geen opslagfout, dus hij hoort niet in de
  // globale error van de provider thuis. Dezelfde keuze als op Historiek.
  const [exportError, setExportError] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);

  const shown = useMemo(() => upcomingBookings(bookings, now), [bookings, now]);

  async function exporteerAgenda(): Promise<void> {
    try {
      // Het moment van exporteren zit in het bestand (DTSTAMP en het volgnummer), dus dat
      // is `new Date()` en niet de `now` van dit scherm: dat is het moment waarop je
      // binnenkwam, en een bestand dat een uur oud zegt te zijn wint het niet van wat er
      // al in de agenda staat.
      await shareIcs(icsFilename(), toIcs(shown, {
        users,
        courts,
        // Een trainer leest de naam van zijn speler in de titel, een speler die van zijn
        // trainer — dezelfde regel als op de leskaarten.
        viewerIsCoach: isCoach(currentUser),
      }));
      setExportError(null);
    } catch {
      setExportError(t('Exporteren is niet gelukt. Probeer het opnieuw.'));
    }
  }


  return (
    <Screen>
      <CoachFilter coaches={coaches} value={coachId} onChange={setCoachId} />

      {shown.length === 0 ? null : (
        <Text style={styles.count}>
          {shown.length === 1 ? t('1 geplande les') : t('{n} geplande lessen', { n: shown.length })}
        </Text>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <LessonCards bookings={shown} empty={t('Er staan geen lessen meer gepland.')} />

      {exportError ? <Text style={styles.error}>{exportError}</Text> : null}

      <View style={styles.exportBlock}>
        <Button
          label={t('Agenda-bestand (.ics)')}
          variant="secondary"
          disabled={shown.length === 0}
          icon={<CalendarPlus size={16} color={tennisColors.text} />}
          onPress={() => { void exporteerAgenda(); }}
        />
        <Text style={styles.exportNote}>
          {t('Het bestand bevat precies de lessen die je hier ziet, klaar om in Outlook, '
            + 'Google Agenda of Apple Agenda te openen. Exporteer je later opnieuw, dan '
            + 'werkt je agenda dezelfde afspraken bij in plaats van ze een tweede keer '
            + 'toe te voegen.')}
        </Text>
        <Text style={styles.exportNote}>
          {t('Een les die na je export geannuleerd wordt, verdwijnt niet vanzelf uit je '
            + 'agenda — die haal je daar zelf weg.')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  count: { ...typography.body, color: tennisColors.text, fontWeight: '600' },
  error: { color: tennisColors.danger, fontSize: 14 },
  exportBlock: { gap: spacing.sm },
  exportNote: { ...typography.label, color: tennisColors.textMuted },
});
