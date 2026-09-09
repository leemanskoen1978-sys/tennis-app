// De weekagenda: hoe vol staat de week van deze persoon. Geen telling van lessen maar van
// uren — een les van een half uur en een les van twee uur zijn allebei "één les", en dat is
// precies wat je hier níet wilt weten. Geannuleerde lessen staan er niet tussen: die kosten
// geen uur op de baan.
//
// Het beeld is een kalender en geen lijst: zeven kolommen naast een uren-as, elke les een
// blok waarvan de hoogte zijn duur is. Een lijst zegt wel hoeveel uur er staat, maar niet
// hoe die uren liggen — en of je week vol is, zie je juist aan de gaten. Het raster zelf
// staat in components/WeekRaster, het rekenwerk in lib/week.
//
// De lessen komen van buiten: dit component vraagt niet wie mag kijken. Het dossier waarin
// het staat heeft die vraag al beantwoord, en dat is ook waarom de trainerbalk hier niet
// meer staat.
//
// De gekozen week woont buiten dit component. Het staat in een blad, en een blad wordt
// weggegooid zodra het sluit — dan zou je na het bekijken van één les weer op deze week
// staan terwijl je drie weken vooruit keek.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { WeekRaster } from './WeekRaster';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { shiftPeriod, periodLabel, type Period } from '../lib/period';
import {
  formatUren, isDezeWeek, weekAgenda, weekLessen, weekMinuten, weekPeriod, weekRooster,
} from '../lib/week';
import type { Booking } from '../lib/types';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, typography } from '../constants/theme';
import { useT } from '../lib/i18n';

export function Weekagenda({
  bookings,
  week,
  onWeek,
  onBookingPress,
}: {
  /** De lessen van de persoon over wie dit dossier gaat, geannuleerde eruit. */
  bookings: Booking[];
  week: Period;
  onWeek: (week: Period) => void;
  onBookingPress: (booking: Booking) => void;
}): React.JSX.Element {
  const t = useT();

  // Eén moment voor het hele blok, net als op Historiek: anders kan "deze week" tijdens het
  // kijken van betekenis veranderen.
  const now = useMemo(() => new Date(), []);

  const dagen = useMemo(() => weekAgenda(bookings, week), [bookings, week]);
  const rooster = useMemo(() => weekRooster(dagen), [dagen]);
  const minuten = weekMinuten(dagen);
  const lessen = weekLessen(dagen);

  return (
    <View style={styles.blok}>
      {/* De drie delen blijven als groep bij elkaar, zoals in de periodekiezer. */}
      <View style={styles.pagerRow}>
        <Button
          label={t('Vorige')}
          variant="secondary"
          fullWidth={false}
          icon={<ChevronLeft size={16} color={tennisColors.text} />}
          onPress={() => onWeek(shiftPeriod(week, -1))}
        />
        <Text style={styles.weekLabel}>{periodLabel(week)}</Text>
        <Button
          label={t('Volgende')}
          variant="secondary"
          fullWidth={false}
          icon={<ChevronRight size={16} color={tennisColors.text} />}
          onPress={() => onWeek(shiftPeriod(week, 1))}
        />
      </View>

      {/* Terug naar nu, zonder te tellen hoeveel weken je vooruit bent gebladerd. */}
      <View style={styles.chipRow}>
        <Chip
          label={t('Deze week')}
          selected={isDezeWeek(week, now)}
          onPress={() => onWeek(weekPeriod(now))}
        />
      </View>

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

      {/* Het raster tekent alle zeven dagen, ook de lege: juist het gat op donderdag is
          iets wat je wilt zien als je naar een week kijkt. */}
      <WeekRaster rooster={rooster} now={now} onBookingPress={onBookingPress} />

      {lessen === 0 ? (
        <Text style={styles.leeg}>{t('Geen lessen deze week.')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  blok: { gap: spacing.md },
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
});
