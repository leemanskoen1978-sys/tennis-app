// Het weekraster: zeven dagkolommen naast een uren-as, met elke les als blok op zijn plek.
//
// De hoogte van een blok is zijn duur. Dat is het hele punt van deze tekening: in een lijst
// zien drie lessen op een rij en drie lessen met twee gaten ertussen er identiek uit, en
// juist dat verschil is wat je van je week wilt weten. Waar een blok komt te staan en wat
// er gebeurt bij twee lessen tegelijk rekent lib/week uit (`weekRooster`); hier staat alleen
// hoe het eruitziet.

import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';

import { BookingDetailSheet } from './BookingDetailSheet';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { useKindkeuze } from '../providers/kindkeuze';
import { formatDay, formatTime, formatTimeRange } from '../lib/datetime';
import { groupSize, shortGroupLabel } from '../lib/groups';
import { isCoach } from '../lib/rechten';
import { isAwaitingApproval } from '../lib/inbox';
import { formatUren, type Blok, type Rooster } from '../lib/week';
import type { Booking } from '../lib/types';
import { useT } from '../lib/i18n';
import { tennisColors } from '../constants/tennis-colors';
import { radius, spacing, typography, wideContentMaxWidth } from '../constants/theme';

/** De hoogte van één uur op de as. Lager werd een les van een half uur onleesbaar. */
const UUR_HOOGTE = 56;
/** De breedte van de uren-as links. */
const AS_BREEDTE = 46;
/** Zo smal mag een dagkolom worden voordat het raster liever zijwaarts schuift. */
const MIN_KOLOM = 96;
/** De hoogte van de kop met de dag en zijn uren. */
const KOP_HOOGTE = 46;

/** Valt deze dag op vandaag? De kolom van vandaag licht op. */
function isVandaag(dag: Date, now: Date): boolean {
  return dag.getFullYear() === now.getFullYear()
    && dag.getMonth() === now.getMonth()
    && dag.getDate() === now.getDate();
}

export function WeekRaster({
  rooster,
  now,
}: {
  rooster: Rooster;
  now: Date;
}): React.JSX.Element {
  const t = useT();
  const { currentUser, users, courts, clearError } = useSimpleData();
  const { kijktNaarZichzelf } = useKindkeuze();
  const { width } = useWindowDimensions();
  const [openBooking, setOpenBooking] = useState<Booking | null>(null);

  const nameOf = (id: string): string => users.find((u) => u.id === id)?.name ?? t('Onbekend');
  const courtName = (id: string): string =>
    courts.find((c) => c.id === id)?.name ?? t('Onbekend terrein');

  // De kolommen vullen de breedte zodra dat kan; is er te weinig ruimte, dan houden ze hun
  // minimum en schuift het raster zijwaarts. Een week die in zeven onleesbare reepjes wordt
  // geperst is geen kalender meer.
  const beschikbaar = Math.min(width, wideContentMaxWidth) - spacing.lg * 2 - AS_BREEDTE;
  const kolomBreedte = Math.max(MIN_KOLOM, Math.floor(beschikbaar / 7));

  const uren = Array.from(
    { length: rooster.totUur - rooster.vanUur },
    (_, i) => rooster.vanUur + i,
  );
  const hoogte = uren.length * UUR_HOOGTE;

  /** Waar een blok staat en hoe hoog het is, in pixels op de as. */
  function plaats(blok: Blok): { top: number; height: number; left: string; width: string } {
    const top = ((blok.van - rooster.vanUur * 60) / 60) * UUR_HOOGTE;
    return {
      top,
      // Een les van een kwartier moet nog een leesbaar blokje zijn, ook als de as krap staat.
      height: Math.max(22, ((blok.tot - blok.van) / 60) * UUR_HOOGTE),
      left: `${(blok.baan / blok.banen) * 100}%`,
      width: `${100 / blok.banen}%`,
    };
  }

  return (
    <>
      <View style={styles.raster}>
        {/* De uren-as staat buiten het zijwaartse schuiven: schuif je naar zondag, dan wil
            je nog steeds kunnen zien hoe laat het daar is. */}
        <View style={styles.as}>
          <View style={{ height: KOP_HOOGTE }} />
          {uren.map((u) => (
            <View key={u} style={styles.asCel}>
              <Text style={styles.asTekst}>{formatTime(new Date(2000, 0, 1, u))}</Text>
            </View>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.kopRij}>
              {rooster.dagen.map((d) => (
                <View
                  key={d.dag.toISOString()}
                  style={[
                    styles.kop,
                    { width: kolomBreedte },
                    isVandaag(d.dag, now) && styles.vandaag,
                  ]}
                >
                  <Text style={styles.kopDag} numberOfLines={1}>{formatDay(d.dag)}</Text>
                  <Text style={d.minuten === 0 ? styles.kopUrenLeeg : styles.kopUren}>
                    {formatUren(d.minuten)}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.kolomRij}>
              {rooster.dagen.map((d) => (
                <View
                  key={d.dag.toISOString()}
                  style={[
                    styles.kolom,
                    { width: kolomBreedte, height: hoogte },
                    isVandaag(d.dag, now) && styles.vandaag,
                  ]}
                >
                  {/* De uurlijnen. Zonder die strepen zweeft een blok en lees je zijn hoogte
                      niet meer als tijd. */}
                  {uren.map((u) => (
                    <View key={u} style={[styles.uurLijn, { top: (u - rooster.vanUur) * UUR_HOOGTE }]} />
                  ))}

                  {d.blokken.map((blok) => {
                    const b = blok.booking;
                    // Je eigen naam hoef je niet te lezen: een trainer ziet de speler, een
                    // speler de trainer. Dezelfde regel als op de leskaarten.
                    const ander = isCoach(currentUser)
                      ? shortGroupLabel(nameOf(b.player_id), groupSize(b))
                      : nameOf(b.coach_id);
                    return (
                      <Pressable
                        key={b.id}
                        accessibilityRole="button"
                        accessibilityLabel={t('Les van {dag} {tijd} met {ander}, details openen', {
                          dag: formatDay(b.start_time),
                          tijd: formatTimeRange(b.start_time, b.end_time),
                          ander,
                        })}
                        onPress={() => {
                          clearError();
                          setOpenBooking(b);
                        }}
                        style={[
                          styles.blok,
                          plaats(blok) as object,
                          // Zolang de trainer niet beslist heeft, is dát het enige wat er
                          // over deze les te zeggen valt — dus krijgt hij de kleur ervan.
                          isAwaitingApproval(b) && styles.blokWacht,
                        ]}
                      >
                        <Text style={styles.blokTijd} numberOfLines={1}>
                          {formatTime(b.start_time)}
                        </Text>
                        <Text style={styles.blokNaam} numberOfLines={2}>{ander}</Text>
                        <Text style={styles.blokBaan} numberOfLines={1}>
                          {courtName(b.court_id)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      <BookingDetailSheet
        booking={openBooking}
        visible={openBooking !== null}
        canManage={isCoach(currentUser) && kijktNaarZichzelf}
        onClose={() => {
          clearError();
          setOpenBooking(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  raster: { flexDirection: 'row' },
  as: { width: AS_BREEDTE },
  // De tekst staat op de lijn zelf, dus hij schuift een halve regel omhoog.
  asCel: { height: UUR_HOOGTE, alignItems: 'flex-end', paddingRight: spacing.sm },
  asTekst: { ...typography.label, color: tennisColors.textMuted, marginTop: -7 },
  kopRij: { flexDirection: 'row' },
  kop: {
    height: KOP_HOOGTE,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: tennisColors.border,
  },
  kopDag: { ...typography.label, color: tennisColors.text, fontWeight: '600' },
  kopUren: { ...typography.label, color: tennisColors.text },
  // Een lege dag zegt "0 u" in dezelfde vorm, maar vraagt geen aandacht.
  kopUrenLeeg: { ...typography.label, color: tennisColors.textMuted },
  kolomRij: { flexDirection: 'row' },
  kolom: {
    borderLeftWidth: 1,
    borderLeftColor: tennisColors.border,
    borderTopWidth: 1,
    borderTopColor: tennisColors.border,
  },
  vandaag: { backgroundColor: tennisColors.primaryTint },
  uurLijn: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: tennisColors.border,
  },
  blok: {
    position: 'absolute',
    // Een haartje lucht rondom, zodat twee blokken naast of onder elkaar niet aan elkaar
    // vastplakken en als één blok gaan lezen.
    padding: spacing.xs,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: tennisColors.primary,
    backgroundColor: tennisColors.surface,
    overflow: 'hidden',
  },
  blokWacht: { borderLeftColor: tennisColors.warningFill },
  blokTijd: { ...typography.label, color: tennisColors.text, fontWeight: '600' },
  blokNaam: { fontSize: 12, color: tennisColors.text },
  blokBaan: { fontSize: 11, color: tennisColors.textMuted },
});
