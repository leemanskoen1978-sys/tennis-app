// De lesdag: wat een trainer ziet als hij de app op de baan opent.
//
// Welke lessen dat zijn en welke opengeklapt hoort, rekent `lib/lesdag.ts` uit — dit
// bestand tekent alleen. De ene beslissing die hier wél valt, is dat een ingeklapte les
// opengaat als je hem aantikt: dat is een voorkeur van het moment en hoort niet in de
// opslag.

import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Card } from '../ui/Card';
import { MemoKnop } from './MemoKnop';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { lesdagVan } from '../../lib/lesdag';
import { heeftMemo, uitTeWerken } from '../../lib/memo';
import { formatTimeRange } from '../../lib/datetime';
import { tennisColors } from '../../constants/tennis-colors';
import { radius, spacing, typography, webCursor } from '../../constants/theme';
import { useT } from '../../lib/i18n';

export function Lesdag({ coachId }: { coachId: string }) {
  const t = useT();
  const router = useRouter();
  const { users, courts, bookings, memos, addMemo } = useSimpleData();

  // Eén moment voor het hele blok: anders zou de ene les op een andere "nu" beoordeeld
  // worden dan de volgende, en zouden er twee lessen tegelijk open kunnen staan.
  const dag = useMemo(
    () => lesdagVan(bookings, coachId, new Date()),
    [bookings, coachId],
  );

  // Welke les de trainer zelf openklapte. Niets gekozen = wat lesdagVan koos; een lege
  // tekst betekent "alles dicht", en dát verschil is waarom je een les kunt dichtklappen.
  const [gekozen, setGekozen] = useState<string | null>(null);
  const openId = gekozen ?? dag.find((l) => l.open)?.booking.id ?? null;

  const werk = uitTeWerken(memos, coachId);
  const naamVan = (id: string): string =>
    users.find((u) => u.id === id)?.name ?? t('Onbekend');
  const baanVan = (id: string): string =>
    courts.find((c) => c.id === id)?.name ?? t('Onbekend');

  const werkregel = werk.length > 0 ? (
    <Pressable
      onPress={() => router.push('/memos')}
      accessibilityRole="button"
      accessibilityLabel={t('{n} memos uit te werken', { n: werk.length })}
      style={[styles.werk, webCursor]}
    >
      <Text style={styles.werkTekst}>
        {werk.length === 1
          ? t('1 memo uit te werken')
          : t('{n} memos uit te werken', { n: werk.length })}
      </Text>
      <ChevronRight size={18} color={tennisColors.primary} />
    </Pressable>
  ) : null;

  if (dag.length === 0) {
    return (
      <View style={styles.blok}>
        <Text style={styles.leegTekst}>{t('Vandaag geen lessen.')}</Text>
        {werkregel}
      </View>
    );
  }

  return (
    <View style={styles.blok}>
      {dag.map((uur) => {
        const open = uur.booking.id === openId;
        return (
          <Card
            key={uur.booking.id}
            style={{ ...styles.les, ...(uur.voorbij ? styles.voorbij : {}) }}
          >
            <Pressable
              onPress={() => setGekozen(open ? '' : uur.booking.id)}
              accessibilityRole="button"
              accessibilityLabel={formatTimeRange(uur.booking.start_time, uur.booking.end_time)}
              accessibilityState={{ expanded: open }}
              style={[styles.kop, webCursor]}
            >
              {uur.loopt ? <View style={styles.nuStip} /> : null}
              <Text style={styles.tijd}>
                {formatTimeRange(uur.booking.start_time, uur.booking.end_time)}
              </Text>
              <Text style={styles.baan}>{baanVan(uur.booking.court_id)}</Text>
              <Text style={styles.aantal}>
                {uur.playerIds.length === 1
                  ? naamVan(uur.playerIds[0])
                  : t('{n} spelers', { n: uur.playerIds.length })}
              </Text>
            </Pressable>

            {open ? (
              <View style={styles.spelers}>
                {uur.playerIds.map((id) => (
                  <View key={id} style={styles.speler}>
                    <Text style={styles.naam} numberOfLines={1}>{naamVan(id)}</Text>
                    <MemoKnop
                      naam={naamVan(id)}
                      alGehad={heeftMemo(memos, uur.booking.id, id)}
                      // De belofte gaat terug naar de knop en wordt hier níét weggegooid:
                      // mislukt het wegschrijven, dan houdt de knop de opname vast.
                      onOpname={(audio_uri, duration_ms) => addMemo({
                        student_id: id,
                        coach_id: coachId,
                        booking_id: uur.booking.id,
                        audio_uri,
                        duration_ms,
                      })}
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        );
      })}

      {werkregel}
    </View>
  );
}

const styles = StyleSheet.create({
  blok: { gap: spacing.sm },
  les: { gap: spacing.sm },
  // Een gegeven les blijft staan maar vraagt geen aandacht meer.
  voorbij: { opacity: 0.6 },
  kop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  nuStip: { width: 8, height: 8, borderRadius: 4, backgroundColor: tennisColors.primary },
  tijd: { ...typography.h3, color: tennisColors.text },
  baan: { fontSize: 13, color: tennisColors.textMuted },
  aantal: { fontSize: 13, color: tennisColors.text, marginLeft: 'auto' },
  spelers: { gap: spacing.sm },
  speler: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing.md,
  },
  naam: { ...typography.h3, color: tennisColors.text, flexShrink: 1 },
  werk: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radius.sm, backgroundColor: tennisColors.primaryTint,
  },
  werkTekst: { color: tennisColors.primary, fontWeight: '700', fontSize: 14 },
  leegTekst: { color: tennisColors.textMuted, fontSize: 14 },
});
