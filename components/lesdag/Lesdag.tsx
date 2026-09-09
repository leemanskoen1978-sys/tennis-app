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
import { GroepStip } from '../ui/GroepStip';
import { MemoKnop } from './MemoKnop';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { materiaalVoor } from '../../lib/lesplanning';
import { LessonDetailModal } from '../LessonDetailModal';
import { lesdagVan } from '../../lib/lesdag';
import { heeftMemo, uitTeWerken } from '../../lib/memo';
import { formatTimeRange } from '../../lib/datetime';
import { tennisColors } from '../../constants/tennis-colors';
import { radius, spacing, typography, webCursor } from '../../constants/theme';
import type { Lesson } from '../../lib/types';
import { useT } from '../../lib/i18n';

export function Lesdag({ coachId }: { coachId: string }) {
  const t = useT();
  const router = useRouter();
  const {
    users, courts, bookings, memos, lessons, lesPlanning, lesGroepen, addMemo,
  } = useSimpleData();

  // Welk doorgestuurd lesmateriaal er open staat; null = niets. Dit blok zit niet in een blad,
  // dus dit blad mag er gewoon bovenop — anders dan op het lesdetail, dat zelf al een blad is.
  const [openMateriaal, setOpenMateriaal] = useState<Lesson | null>(null);

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
  /**
   * De groep waar een les bij hoort. Een trainer draait op één dag verschillende niveaus na
   * elkaar, en met vier lessen onder elkaar is de kleur wat je zoekt: welke van deze uren is
   * de blauwe. Een les die los van een groep bestaat heeft er geen; dan staat er niets.
   */
  const groepVan = (groupId?: string) =>
    (groupId ? lesGroepen.find((g) => g.id === groupId) ?? null : null);

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
        const groep = groepVan(uur.booking.group_id);
        // De groep hoort in de voorgelezen regel mee: een schermlezer krijgt het bolletje
        // niet te zien, en "09:00–10:00" alleen zegt niet welke van de vier lessen dit is.
        const tijd = formatTimeRange(uur.booking.start_time, uur.booking.end_time);
        const label = groep?.level ? `${tijd} · ${groep.level}` : tijd;
        return (
          <Card
            key={uur.booking.id}
            style={{ ...styles.les, ...(uur.voorbij ? styles.voorbij : {}) }}
          >
            <Pressable
              onPress={() => setGekozen(open ? '' : uur.booking.id)}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ expanded: open }}
              style={[styles.kop, webCursor]}
            >
              {uur.loopt ? <View style={styles.nuStip} /> : null}
              <Text style={styles.tijd}>{tijd}</Text>
              <Text style={styles.baan}>{baanVan(uur.booking.court_id)}</Text>
              {/* Dezelfde stip als op het spelersblok. De kop wikkelt (`flexWrap`), dus op een
                  telefoon zakt de groep naar de tweede regel in plaats van het aantal spelers
                  weg te duwen. */}
              <GroepStip niveau={groep?.level} naam={groep?.name} />
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
                    {/* De trainer heeft het kind voor zich staan en wil bij zijn doelen,
                        zijn voortgang of zijn week. Zonder deze tik is dat: terug naar
                        Home, naar Spelers, en de naam opzoeken in een lijst van 555. */}
                    <Pressable
                      onPress={() => router.push(`/players/${id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={t('Dossier van {naam}', { naam: naamVan(id) })}
                      style={[styles.naamKnop, webCursor]}
                    >
                      <Text style={styles.naam} numberOfLines={1}>{naamVan(id)}</Text>
                    </Pressable>
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

                {/* Onder de namen, niet in plaats van het openklappen: de memoknoppen
                    hierboven zijn de enige plek in de app waar een opname gemaakt kan
                    worden, en die mogen niet onbereikbaar worden. */}
                <Pressable
                  onPress={() => router.push(`/afvinken?lesId=${uur.booking.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={t('Deze les afvinken')}
                  style={[styles.afvinken, webCursor]}
                >
                  <Text style={styles.afvinkenTekst}>{t('Afvinken')}</Text>
                  <ChevronRight size={18} color={tennisColors.primary} />
                </Pressable>
              </View>
            ) : null}

            {/* Wat de tennisschool voor deze periode doorstuurde. Welk materiaal dat is weet
                `materiaalVoor` in lib/lesplanning en niets anders; gelden er twee, dan staan ze
                er beide met de bijzonderste bovenaan.

                Geldt er niets, dan staat er niets — ook geen kop. Een kop zonder inhoud leest
                als "er is niets gepland", en dat is iets anders dan "er is nooit iets
                ingevuld". */}
            {materiaalVoor(uur.booking, lesPlanning, lessons).map((l) => (
              <Pressable
                key={l.id}
                onPress={() => setOpenMateriaal(l)}
                accessibilityRole="button"
                accessibilityLabel={t('Lesmateriaal {titel} openen', { titel: l.title })}
                style={[styles.periode, webCursor]}
              >
                <Text style={styles.periodeTekst}>
                  {t('Deze periode: {titel}', { titel: l.title })}
                </Text>
                <ChevronRight size={16} color={tennisColors.primary} />
              </Pressable>
            ))}
          </Card>
        );
      })}

      {werkregel}

      {/* Op blokniveau en niet per les: één blad voor alle lessen van de dag, zodat er nooit
          twee over elkaar staan. `canEdit` is false — dit is de leeskant; materiaal wijzigen
          doet de trainer in Lesmateriaal, en niet per ongeluk vanaf zijn lesdag. */}
      <LessonDetailModal
        lesson={openMateriaal}
        visible={openMateriaal !== null}
        onClose={() => setOpenMateriaal(null)}
        canEdit={false}
      />
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
  periode: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: spacing.xs,
  },
  periodeTekst: { fontSize: 13, fontWeight: '600', color: tennisColors.primary },
  speler: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing.md,
  },
  naam: { ...typography.h3, color: tennisColors.text, flexShrink: 1 },
  // De tik moet ook naast de letters raak zijn; de naam mag krimpen als de memoknop breed is.
  naamKnop: { flexShrink: 1, paddingVertical: spacing.xs, paddingRight: spacing.sm },
  afvinken: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: spacing.sm, marginTop: spacing.xs,
  },
  afvinkenTekst: { fontSize: 14, fontWeight: '700', color: tennisColors.primary },
  werk: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radius.sm, backgroundColor: tennisColors.primaryTint,
  },
  werkTekst: { color: tennisColors.primary, fontWeight: '700', fontSize: 14 },
  leegTekst: { color: tennisColors.textMuted, fontSize: 14 },
});
