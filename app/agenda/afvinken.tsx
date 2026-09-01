// Afvinken: het scherm dat de trainer bij het begin van de les opent en dan uit handen
// geeft. De kinderen tikken zelf op hun naam.
//
// Daarom staat er verder weinig op: geen menubalk, geen tabbalk, alleen de namen en één
// terugknop bovenaan links. Een gsm die rondgaat in een groep van acht komt anders overal
// terecht. Dat de balken hier wegblijven regelt `app/_layout.tsx`, op dezelfde plek waar
// het loginscherm ze al weglaat.
//
// Die ene knop was eerst een lange druk, zodat een kind er niet uit kon. Zie `Terug`
// onderaan waarom dat niet gebleven is.
//
// De les zoekt het scherm zelf op (zie lib/afvinken): wie eerst een datum en een uur moet
// aanwijzen, vinkt sneller zelf af.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, X, Circle, ArrowLeft } from 'lucide-react-native';

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
import { radius, spacing, typography, minTapTarget, webCursor, noSelect } from '../../constants/theme';
import { useT } from '../../lib/i18n';

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
        <Terug label={t('Terug naar de agenda')} onPress={sluiten} />
        <Text style={styles.leeg}>{t('Afvinken doet de trainer van de les.')}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Terug label={t('Terug naar de agenda')} onPress={sluiten} />

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
                  noSelect,
                  pressed && styles.gedrukt,
                ]}
              >
                <View style={styles.naamIcoon}>{standIcoon(stand)}</View>
                <Text
                  style={[styles.naam, noSelect, stand ? styles.naamOpVulling : null]}
                  numberOfLines={1}
                >
                  {naam}
                </Text>
                <Text style={[styles.stand, noSelect, stand ? styles.naamOpVulling : null]}>
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
    </Screen>
  );
}

/**
 * De weg terug, bovenaan links waar hij op elk ander scherm ook staat.
 *
 * Dit was eerst een lange druk op Klaar, om te beletten dat een kind met de gsm in de rest
 * van de app belandt. Dat bleek in de praktijk niet te doen: een browser op een telefoon
 * leest een lange druk als "selecteer deze tekst", en wie de knop niet aan de praat krijgt,
 * zit vast op zijn eigen scherm. Een knop die werkt weegt zwaarder dan een slot dat de
 * trainer buitensluit.
 */
function Terug({ label, onPress }: { label: string; onPress: () => void }): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.terug, webCursor, noSelect, pressed && styles.gedrukt]}
    >
      <ArrowLeft size={20} color={tennisColors.primary} />
      <Text style={[styles.terugTekst, noSelect]}>{label}</Text>
    </Pressable>
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
  terug: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    alignSelf: 'flex-start', minHeight: minTapTarget, paddingRight: spacing.md,
    marginBottom: spacing.sm,
  },
  terugTekst: { ...typography.body, color: tennisColors.primary, fontWeight: '600' },
});
