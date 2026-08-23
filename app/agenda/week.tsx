// Weekagenda: hoe vol staat mijn week echt. Geen telling van lessen maar van uren — een les
// van een half uur en een les van twee uur zijn allebei "één les", en dat is precies wat je
// hier níet wilt weten. Geannuleerde lessen staan er niet tussen: die kosten geen uur op de
// baan, dus ze horen niet in een agenda die "effectief" heet.
//
// Het beeld is een kalender en geen lijst: zeven kolommen naast een uren-as, elke les een
// blok waarvan de hoogte zijn duur is. Een lijst zegt wel hoeveel uur er staat, maar niet
// hoe die uren liggen — en of je week vol is, zie je juist aan de gaten. Het raster zelf
// staat in components/WeekRaster, het rekenwerk in lib/week; dit bestand kiest de week.
//
// Bladeren gaat per week, met dezelfde knoppen en dezelfde volgorde als de periodekiezer op
// Historiek en Rapport.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { WeekRaster } from '../../components/WeekRaster';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { CoachFilter } from '../../components/ui/CoachFilter';
import { useSchoneLei, useSimpleData } from '../../providers/SimpleDataProvider';
import { useAgendaScope } from '../../providers/agendaScope';
import { periodLabel, shiftPeriod, type Period } from '../../lib/period';
import {
  formatUren, isDezeWeek, weekAgenda, weekLessen, weekMinuten, weekPeriod, weekRooster,
} from '../../lib/week';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';
import { useT } from '../../lib/i18n';

export default function WeekScreen(): React.JSX.Element {
  const t = useT();
  const { error } = useSimpleData();
  const { coachId, setCoachId, coaches, bookings } = useAgendaScope();
  useSchoneLei();

  // Eén moment voor het hele scherm, net als op Historiek: anders kan "deze week" tijdens
  // het kijken van betekenis veranderen.
  const now = useMemo(() => new Date(), []);
  const [week, setWeek] = useState<Period>(() => weekPeriod(now));

  // `bookings` is al afgebakend op wie mag kijken en op de gekozen trainer; hier komt
  // alleen de week er nog overheen.
  const dagen = useMemo(() => weekAgenda(bookings, week), [bookings, week]);
  const rooster = useMemo(() => weekRooster(dagen), [dagen]);
  const minuten = weekMinuten(dagen);
  const lessen = weekLessen(dagen);

  return (
    <Screen>
      {/* De drie delen blijven als groep bij elkaar, zoals in de periodekiezer. */}
      <View style={styles.pagerRow}>
        <Button
          label={t('Vorige')}
          variant="secondary"
          fullWidth={false}
          icon={<ChevronLeft size={16} color={tennisColors.text} />}
          onPress={() => setWeek(shiftPeriod(week, -1))}
        />
        <Text style={styles.weekLabel}>{periodLabel(week)}</Text>
        <Button
          label={t('Volgende')}
          variant="secondary"
          fullWidth={false}
          icon={<ChevronRight size={16} color={tennisColors.text} />}
          onPress={() => setWeek(shiftPeriod(week, 1))}
        />
      </View>

      {/* Terug naar nu, zonder te tellen hoeveel weken je vooruit bent gebladerd. */}
      <View style={styles.chipRow}>
        <Chip
          label={t('Deze week')}
          selected={isDezeWeek(week, now)}
          onPress={() => setWeek(weekPeriod(now))}
        />
      </View>

      <CoachFilter coaches={coaches} value={coachId} onChange={setCoachId} />

      <Card>
        <Text style={styles.total}>
          {t('{uren} geboekt', { uren: formatUren(minuten) })}
          {' · '}
          {lessen === 1 ? t('1 les') : t('{n} lessen', { n: lessen })}
        </Text>
        <Text style={styles.totalNote}>
          {t('Geannuleerde lessen tellen niet mee en staan er niet tussen.')}
        </Text>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Het raster tekent alle zeven dagen, ook de lege: juist het gat op donderdag is
          iets wat je wilt zien als je naar je week kijkt. */}
      <WeekRaster rooster={rooster} now={now} />

      {lessen === 0 ? (
        <Text style={styles.leeg}>{t('Geen lessen deze week.')}</Text>
      ) : null}

    </Screen>
  );
}

const styles = StyleSheet.create({
  pagerRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    justifyContent: 'center', gap: spacing.md,
  },
  // Een minimumbreedte, zodat de knoppen niet verspringen als "1 sep – 7 sep 2026" korter
  // uitvalt dan "28 dec 2026 – 3 jan 2027".
  weekLabel: { ...typography.h3, color: tennisColors.text, minWidth: 190, textAlign: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  total: { ...typography.body, color: tennisColors.text, fontWeight: '600' },
  totalNote: { ...typography.label, color: tennisColors.textMuted, marginTop: spacing.xs },
  leeg: { ...typography.body, color: tennisColors.textMuted, textAlign: 'center' },
  error: { color: tennisColors.danger, fontSize: 14 },
});
