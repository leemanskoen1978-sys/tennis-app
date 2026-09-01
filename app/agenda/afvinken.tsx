// Afvinken: het scherm dat de trainer bij het begin van de les opent en dan uit handen
// geeft. De kinderen tikken zelf op hun naam.
//
// Daarom staat er niets anders op. Geen menubalk, geen tabbalk, geen weg naar de agenda of
// de betalingen — een gsm die rondgaat in een groep van acht komt anders overal terecht.
// Dat de balken hier wegblijven regelt `app/_layout.tsx`, op dezelfde plek waar het
// loginscherm ze al weglaat; terug gaat alleen met een lange druk op Klaar.
//
// De les zoekt het scherm zelf op (zie lib/afvinken): wie eerst een datum en een uur moet
// aanwijzen, vinkt sneller zelf af.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, X, Circle } from 'lucide-react-native';

import { Screen } from '../../components/ui/Screen';
import { Chip } from '../../components/ui/Chip';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { lessenNu } from '../../lib/afvinken';
import {
  aanwezigheidRegel, aanwezigheidVan, volgendeStand, type Aanwezigheid,
} from '../../lib/aanwezigheid';
import { lessonPlayerIds } from '../../lib/groups';
import { formatTimeRange } from '../../lib/datetime';
import { isCoach } from '../../lib/rechten';
import { tennisColors } from '../../constants/tennis-colors';
import { radius, spacing, typography, webCursor } from '../../constants/theme';
import { useT } from '../../lib/i18n';

/** Hoe lang je Klaar moet vasthouden. Lang genoeg dat een kind er niet per ongeluk uit valt. */
const KLAAR_MS = 2000;

export default function AfvinkenScreen(): React.JSX.Element {
  const t = useT();
  const router = useRouter();
  const { currentUser, bookings, users, courts, setAanwezigheid, error } = useSimpleData();

  // De klok loopt door terwijl het scherm openstaat: begint de volgende groep, dan hoort
  // die er te staan zonder dat de trainer het scherm eerst dicht en weer open doet.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Welke les de trainer koos toen er meer dan één tegelijk liep. Leeg = de eerste.
  const [gekozen, setGekozen] = useState<string | null>(null);
  // Een korte tik op Klaar doet niets; zonder deze regel lijkt dat een kapotte knop.
  const [klaarHint, setKlaarHint] = useState(false);

  const coach = isCoach(currentUser);
  const lessen = useMemo(
    () => (coach && currentUser ? lessenNu(bookings, currentUser.id, now) : []),
    [coach, currentUser, bookings, now],
  );

  // Verdwijnt de gekozen les uit de lijst (ze is voorbij, of geannuleerd), dan valt het
  // scherm terug op de eerste die er nog is in plaats van leeg te blijven staan.
  const les = lessen.find((b) => b.id === gekozen) ?? lessen[0] ?? null;

  const nameOf = (id: string): string => users.find((u) => u.id === id)?.name ?? t('Onbekend');
  const courtName = (id: string): string =>
    courts.find((c) => c.id === id)?.name ?? t('Onbekend terrein');

  // Op naam gesorteerd, en niet in de volgorde van de boeking: hier zoekt een kind zijn
  // eigen naam op, en dan is het alfabet de enige volgorde die het zelf kan volgen.
  const spelers = useMemo(
    () => (les ? lessonPlayerIds(les).map((id) => ({ id, naam: nameOf(id) }))
      .sort((a, b) => a.naam.localeCompare(b.naam)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [les, users],
  );

  const sluiten = (): void => router.replace('/agenda');

  if (!coach) {
    // Een speler of ouder hoort hier niet: afvinken doet de trainer die erbij stond.
    return (
      <Screen>
        <Text style={styles.leeg}>{t('Afvinken doet de trainer van de les.')}</Text>
        <View style={styles.klaarRij}>
          <Chip label={t('Terug')} selected={false} onPress={sluiten} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {les ? (
        <>
          {/* Twee groepen tegelijk op de baan gebeurt; dan is dit het enige dat er te
              kiezen valt, en anders staat er niets. */}
          {lessen.length > 1 ? (
            <View style={styles.keuzeRij}>
              {lessen.map((b) => (
                <Chip
                  key={b.id}
                  label={`${formatTimeRange(b.start_time, b.end_time)} · ${courtName(b.court_id)}`}
                  selected={b.id === les.id}
                  onPress={() => setGekozen(b.id)}
                />
              ))}
            </View>
          ) : null}

          <Text style={styles.titel}>{formatTimeRange(les.start_time, les.end_time)}</Text>
          <Text style={styles.onder}>{courtName(les.court_id)}</Text>
          <Text style={styles.telling}>{aanwezigheidRegel(les)}</Text>

          {spelers.map(({ id, naam }) => {
            const stand = aanwezigheidVan(les, id);
            return (
              <Pressable
                key={id}
                onPress={() => {
                  void setAanwezigheid(les.id, id, volgendeStand(stand));
                }}
                accessibilityRole="button"
                accessibilityLabel={`${naam}, ${standLabel(stand, t)}`}
                accessibilityState={{ selected: stand === 'aanwezig' }}
                style={({ pressed }) => [
                  styles.naamRij,
                  standStijl(stand),
                  webCursor,
                  pressed && styles.gedrukt,
                ]}
              >
                <View style={styles.naamIcoon}>{standIcoon(stand)}</View>
                <Text style={[styles.naam, stand ? styles.naamOpVulling : null]} numberOfLines={1}>
                  {naam}
                </Text>
                <Text style={[styles.stand, stand ? styles.naamOpVulling : null]}>
                  {standLabel(stand, t)}
                </Text>
              </Pressable>
            );
          })}

          <Text style={styles.uitleg}>
            {t('Tik op je naam: één keer voor aanwezig, nog eens voor afwezig, nog eens om '
              + 'hem leeg te maken.')}
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.titel}>{t('Geen les op dit moment')}</Text>
          <Text style={styles.leeg}>
            {t('Dit scherm toont de les die nu bezig is. Open het bij het begin van de les '
              + 'en geef je gsm door.')}
          </Text>
        </>
      )}

      {error ? <Text style={styles.fout}>{error}</Text> : null}

      {/* De enige weg terug, en met opzet een lange druk: dit scherm is open terwijl de gsm
          van hand tot hand gaat. */}
      <View style={styles.klaarRij}>
        <Pressable
          onPress={() => setKlaarHint(true)}
          onLongPress={sluiten}
          delayLongPress={KLAAR_MS}
          accessibilityRole="button"
          accessibilityLabel={t('Klaar, houd twee tellen vast')}
          style={({ pressed }) => [styles.klaar, webCursor, pressed && styles.gedrukt]}
        >
          <Text style={styles.klaarTekst}>{t('Klaar')}</Text>
        </Pressable>
        <Text style={styles.uitleg}>
          {klaarHint
            ? t('Houd Klaar twee tellen vast om terug te gaan.')
            : t('Twee tellen vasthouden.')}
        </Text>
      </View>
    </Screen>
  );
}

/** Wat er rechts op de rij staat, en wat een schermlezer voorleest. */
function standLabel(stand: Aanwezigheid | null, t: (nl: string) => string): string {
  if (stand === 'aanwezig') return t('Aanwezig');
  if (stand === 'afwezig') return t('Afwezig');
  return t('Nog niet afgevinkt');
}

function standIcoon(stand: Aanwezigheid | null): React.JSX.Element {
  if (stand === 'aanwezig') return <Check size={28} color={tennisColors.onFill} />;
  if (stand === 'afwezig') return <X size={28} color={tennisColors.onFill} />;
  return <Circle size={28} color={tennisColors.textMuted} />;
}

function standStijl(stand: Aanwezigheid | null): object {
  if (stand === 'aanwezig') return styles.rijAanwezig;
  if (stand === 'afwezig') return styles.rijAfwezig;
  return styles.rijLeeg;
}

const styles = StyleSheet.create({
  keuzeRij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  titel: { ...typography.h2, color: tennisColors.text },
  onder: { ...typography.body, color: tennisColors.textMuted },
  telling: { fontSize: 13, color: tennisColors.textMuted, marginTop: spacing.xs, marginBottom: spacing.sm },
  // Een rij van 64 px: groot genoeg om met een vinger te raken zonder te kijken, en groot
  // genoeg dat een groep van acht nog op één telefoonscherm past.
  naamRij: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    minHeight: 64, paddingHorizontal: spacing.lg, marginTop: spacing.sm,
    borderRadius: radius.lg, borderWidth: 1,
  },
  rijLeeg: { backgroundColor: tennisColors.surface, borderColor: tennisColors.border },
  rijAanwezig: { backgroundColor: tennisColors.successFill, borderColor: tennisColors.successFill },
  rijAfwezig: { backgroundColor: tennisColors.warningFill, borderColor: tennisColors.warningFill },
  gedrukt: { opacity: 0.85 },
  naamIcoon: { width: 28, alignItems: 'center' },
  naam: { ...typography.h3, color: tennisColors.text, flex: 1 },
  naamOpVulling: { color: tennisColors.onFill },
  stand: { fontSize: 13, color: tennisColors.textMuted },
  uitleg: { fontSize: 13, color: tennisColors.textMuted, fontStyle: 'italic', marginTop: spacing.md },
  leeg: { ...typography.body, color: tennisColors.textMuted, marginTop: spacing.sm },
  fout: { color: tennisColors.danger, fontSize: 14, marginTop: spacing.md },
  klaarRij: { marginTop: spacing.xl, alignItems: 'center' },
  klaar: {
    minHeight: 56, minWidth: 200, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: spacing.xl, borderRadius: radius.pill,
    backgroundColor: tennisColors.surface, borderWidth: 1, borderColor: tennisColors.border,
  },
  klaarTekst: { ...typography.h3, color: tennisColors.text },
});
