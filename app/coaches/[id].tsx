import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays, CalendarRange, ChevronRight, Pencil, Users, type LucideIcon } from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { ContactRegels } from '../../components/ui/ContactRegels';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ActionTile, TileGrid } from '../../components/ui/ActionTile';
import { DetailSheet } from '../../components/ui/DetailSheet';
import { LidBewerken } from '../../components/LidBewerken';
import { BookingDetailSheet } from '../../components/BookingDetailSheet';
import { Weekagenda } from '../../components/Weekagenda';

import { useSimpleData } from '../../providers/SimpleDataProvider';
import { useKindkeuze } from '../../providers/kindkeuze';
import { groupSize, shortGroupLabel } from '../../lib/groups';
import { playersForCoach } from '../../lib/relations';
import { formatWorkingDays } from '../../lib/slots';
import { sorteerPeriodes } from '../../lib/boekingstijd';
import { useT, useLanguage } from '../../lib/i18n';
import { isAdmin, isCoach, magContactZien, magLoonZien, rolLabel } from '../../lib/rechten';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography, webCursor } from '../../constants/theme';
import { formatDay, formatTimeRange } from '../../lib/datetime';
import { coachPayoutThisMonth } from '../../lib/reports';
import { formatEuro } from '../../lib/money';
import { formatUren, weekAgenda, weekMinuten, weekPeriod } from '../../lib/week';
import type { Period } from '../../lib/period';
import type { Booking } from '../../lib/types';

/**
 * Zelfde opbouw als het spelersdossier: de kop-kaart met de trainer blijft altijd staan, en
 * daaronder staan de onderdelen als tegels met hun telling erbij. Een tik opent het
 * onderdeel in een blad. Dezelfde iconen als elders in de app: de kalender van Agenda en de
 * mensen van Spelers.
 */

/** De onderdelen van het trainersdossier; elk krijgt een tegel en een blad. */
type SectionKey = 'agenda' | 'week' | 'spelers';
export default function CoachDossier() {
  const t = useT();
  const lang = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { users, bookings, courts, lessons, progress, currentUser, relaties } = useSimpleData();
  const { kijktNaarZichzelf } = useKindkeuze();
  const [editOpen, setEditOpen] = useState(false);
  // Welk onderdeel openstaat; null = je kijkt naar het raster. Niet onthouden tussen
  // bezoeken: een stand van vorige week zegt niets over vandaag.
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  // De week woont hier en niet in het blad: een blad wordt weggegooid als het sluit, en het
  // sluit zodra je een les opent. Anders stond je daarna weer op deze week.
  const [week, setWeek] = useState<Period>(() => weekPeriod(new Date()));
  const [gekozenLes, setGekozenLes] = useState<Booking | null>(null);

  const coach = users.find((u) => u.id === id && u.role === 'coach') ?? null;

  if (!coach) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Trainer niet gevonden.')}</Text>
      </Screen>
    );
  }

  const courtName = (cid: string) => courts.find((c) => c.id === cid)?.name ?? '';
  const now = Date.now();

  const coachBookings = bookings
    .filter((b) => b.coach_id === coach.id && b.status !== 'cancelled');
  const upcoming = coachBookings
    .filter((b) => new Date(b.end_time).getTime() >= now)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const past = coachBookings
    .filter((b) => new Date(b.end_time).getTime() < now)
    .sort((a, b) => b.start_time.localeCompare(a.start_time));

  const playerName = (pid: string) => users.find((u) => u.id === pid)?.name ?? t('Onbekend');

  // Wat deze trainer deze maand verdient: zijn eigen uurtarief over zijn eigen lessen, langs
  // dezelfde weg als op zijn profiel. Geen tarief ingevuld geeft 0, met een melding erbij.
  // Wat een trainer verdient is van hem. Een collega ziet die twee regels niet — niet
  // leeg, niet grijs: ze staan er niet. De databank geeft het bedrag ook niet mee (zie
  // `coach_rates` in supabase-schema.sql), dus wat hier stond zou toch leeg blijven.
  const loonZichtbaar = magLoonZien(currentUser, coach);
  const rateMissing = coach.hourly_rate === undefined;
  const periodes = sorteerPeriodes(coach.booking_periods ?? []);
  // Hetzelfde blad als in Beheer → Leden en op je profiel: één formulier voor wie iemand is.
  const magBewerken = currentUser?.id === coach.id || isAdmin(currentUser);
  const earnedThisMonth = coachPayoutThisMonth(coach, bookings);

  // Derived from bookings/lessons/progress — see lib/relations.ts. No assignment screen.
  const players = playersForCoach(coach.id, bookings, lessons, progress)
    .map((pid) => ({ id: pid, name: playerName(pid) }))
    .sort((a, b) => a.name.localeCompare(b.name, lang));

  // Wat er op de tegel staat, geteld op dezelfde lijsten als de inhoud van het blad.
  const agendaSummary = upcoming.length > 0
    ? t('{n} aankomend', { n: upcoming.length })
    : past.length > 0 ? t('niets aankomend') : t('geen afspraken');
  const spelersSummary = players.length === 0
    ? t('nog geen')
    : players.length === 1 ? t('1 speler') : t('{n} spelers', { n: players.length });
  // Dezelfde som als in het blad erachter (lib/week): een tegel mag geen ander aantal uren
  // beloven dan wat je erachter vindt.
  const weekUren = formatUren(weekMinuten(weekAgenda(coachBookings, week)));

  const tiles: Array<{ key: SectionKey; title: string; subtitle: string; icon: LucideIcon }> = [
    { key: 'agenda', title: t('Agenda'), subtitle: agendaSummary, icon: CalendarDays },
    { key: 'week', title: t('Weekagenda'), subtitle: t('{uren} deze week', { uren: weekUren }), icon: CalendarRange },
    { key: 'spelers', title: t('Spelers'), subtitle: spelersSummary, icon: Users },
  ];

  // Een blad dat iets bovenop zich opent, sluit zolang dat openstaat: twee bladen over
  // elkaar is rommelig, en op Android sluit één druk op terug ze allebei. `openSection`
  // blijft ondertussen staan, dus je komt terug in het blad waar je vandaan kwam. Zelfde
  // truc als in het spelersdossier.
  //
  // Zowel de agendalijst als de weekagenda openen datzelfde lesdetail, en daarom heet dit
  // `gekozenLes` en niet naar één van de twee: één blad, één toestand. Wie er een tweede
  // naast zet, krijgt twee lesdetails die elkaar kunnen overlappen.
  const stacked = gekozenLes !== null;
  const sheetOpen = (key: SectionKey) => openSection === key && !stacked;
  const closeSheet = () => setOpenSection(null);
  /**
   * Wat een regel in de agendalijst voorleest. Letterlijk dezelfde zin als in het weekraster,
   * want het is dezelfde handeling met hetzelfde gevolg: het lesdetail gaat open. Twee
   * verschillende zinnen voor één handeling laten een schermlezer twee dingen beloven.
   */
  const lesLabel = (b: Booking): string => t('Les van {dag} {tijd} met {ander}, details openen', {
    dag: formatDay(b.start_time),
    tijd: formatTimeRange(b.start_time, b.end_time),
    ander: shortGroupLabel(playerName(b.player_id), groupSize(b)),
  });
  /** Een blad verlaten om ergens anders heen te gaan: eerst dicht, dan pas navigeren. */
  const goTo = (path: string) => { closeSheet(); router.push(path); };

  return (
    // Geen `reading`: het scherm zelf is een raster tegels, en dat mag op een breed venster
    // dezelfde ruimte gebruiken als de andere tegelschermen. De lijsten zitten in de bladen,
    // en die houden hun eigen, smallere maximumbreedte aan.
    <Screen>
      <Card>
        <Text style={styles.name}>{coach.name}</Text>
        <Badge label={rolLabel(coach)} color={tennisColors.primaryFill} />
        {/* Eén tik opent de mail of een WhatsApp-gesprek; zie components/ui/ContactRegels.
            Alleen voor wie het aangaat: een trainer is voor iedereen bereikbaar via de club,
            niet via zijn privénummer. Zie `magContactZien`. */}
        {magContactZien(currentUser, coach, relaties)
          ? <ContactRegels email={coach.email} phone={coach.phone} />
          : null}

        <Text style={styles.fieldLabel}>{t('Geeft les')}</Text>
        <Text style={styles.fieldValue}>{formatWorkingDays(coach)}</Text>
        <Text style={styles.fieldValue}>
          {coach.working_hours
            ? `${coach.working_hours.start} – ${coach.working_hours.end}`
            : t('De tijd van de club')}
        </Text>
        {/* Staat er een afwijkende periode, dan zegt de regel hierboven niet het hele
            verhaal. Hoeveel het er zijn is genoeg om te weten dat je moet gaan kijken. */}
        {periodes.length > 0 ? (
          <Text style={styles.fieldValue}>
            {periodes.length === 1
              ? t('1 afwijkende periode')
              : t('{n} afwijkende periodes', { n: periodes.length })}
          </Text>
        ) : null}

        {/* Het uurtarief van de trainer is wat híj krijgt; wat de speler betaalt loopt op het
            uurtarief van de baan. Twee verschillende bedragen — zie lib/payments. */}
        {loonZichtbaar ? (
          <>
            <Text style={styles.fieldLabel}>{t('Uurtarief')}</Text>
            <Text style={rateMissing ? styles.warnValue : styles.fieldValue}>
              {rateMissing
                ? t('Nog niet ingesteld')
                : t('€{bedrag} per uur', { bedrag: coach.hourly_rate ?? 0 })}
            </Text>

            <Text style={styles.fieldLabel}>{t('Verdiend deze maand')}</Text>
            <Text style={styles.fieldValue}>€{formatEuro(earnedThisMonth)}</Text>
            {/* Zonder tarief is dat bedrag nul, en dat mag niet als een gewone nul overkomen. */}
            {rateMissing ? (
              <Text style={styles.warnValue}>
                {t('Zolang het uurtarief leeg is, blijft dit op €0,00 staan.')}
              </Text>
            ) : null}
          </>
        ) : null}

        {/* Je eigen gegevens, en voor de beheerder ook die van een collega. Een trainer die
            bij een collega kijkt, krijgt geen knop: een knop die je toch niet mag gebruiken
            hoort er niet grijs bij te staan. */}
        {magBewerken ? (
          <Button
            label={t('Bewerken')}
            variant="secondary"
            icon={<Pencil size={16} color={tennisColors.text} />}
            onPress={() => setEditOpen(true)}
            style={styles.editButton}
          />
        ) : null}
      </Card>

      {magBewerken ? (
        <LidBewerken lid={coach} visible={editOpen} onClose={() => setEditOpen(false)} />
      ) : null}

      <TileGrid>
        {tiles.map((tile) => (
          <ActionTile
            key={tile.key}
            title={tile.title}
            subtitle={tile.subtitle}
            icon={tile.icon}
            onPress={() => setOpenSection(tile.key)}
          />
        ))}
      </TileGrid>

      <DetailSheet title={t('Agenda')} visible={sheetOpen('agenda')} onClose={closeSheet}>
        {upcoming.length === 0 && past.length === 0 ? (
          <Text style={styles.muted}>{t('Nog geen afspraken.')}</Text>
        ) : (
          <>
            {upcoming.length > 0 ? <Text style={styles.subLabel}>{t('Aankomend')}</Text> : null}
            {upcoming.map((b) => (
              <Card key={b.id} style={styles.rowCard}>
                <Pressable
                  onPress={() => setGekozenLes(b)}
                  accessibilityRole="button"
                  accessibilityLabel={lesLabel(b)}
                  style={webCursor}
                >
                  <View style={styles.rowLine}>
                    <Text style={styles.rowDay}>{formatDay(b.start_time)}</Text>
                    <Text style={styles.rowTime}>{formatTimeRange(b.start_time, b.end_time)}</Text>
                  </View>
                  <Text style={styles.rowMeta}>{courtName(b.court_id)} · {shortGroupLabel(playerName(b.player_id), groupSize(b))}</Text>
                </Pressable>
              </Card>
            ))}
            {past.length > 0 ? <Text style={styles.subLabel}>{t('Geweest')}</Text> : null}
            {past.slice(0, 6).map((b) => (
              <Card key={b.id} style={styles.rowCard}>
                <Pressable
                  onPress={() => setGekozenLes(b)}
                  accessibilityRole="button"
                  accessibilityLabel={lesLabel(b)}
                  style={webCursor}
                >
                  <View style={styles.rowLine}>
                    <Text style={styles.rowDay}>{formatDay(b.start_time)}</Text>
                    <Text style={styles.rowTime}>{formatTimeRange(b.start_time, b.end_time)}</Text>
                  </View>
                  <Text style={styles.rowMeta}>{courtName(b.court_id)} · {shortGroupLabel(playerName(b.player_id), groupSize(b))}</Text>
                </Pressable>
              </Card>
            ))}
          </>
        )}
      </DetailSheet>

      {/* De week zoals ze ligt. Een les aantikken opent het lesdetail — net als een regel in
          de agendalijst hierboven; dit blad sluit daarvoor, zie `stacked`. */}
      <DetailSheet title={t('Weekagenda')} visible={sheetOpen('week')} onClose={closeSheet}>
        <Weekagenda
          bookings={coachBookings}
          week={week}
          onWeek={setWeek}
          onBookingPress={setGekozenLes}
        />
      </DetailSheet>

      <DetailSheet title={t('Spelers')} visible={sheetOpen('spelers')} onClose={closeSheet}>
        {players.length === 0 ? (
          <Text style={styles.muted}>{t('Nog geen spelers.')}</Text>
        ) : (
          players.map((p) => (
            <Card key={p.id} style={styles.rowCard}>
              <Pressable
                onPress={() => goTo(`/players/${p.id}`)}
                style={[styles.playerRow, webCursor]}
                accessibilityRole="button"
                accessibilityLabel={`Open dossier van ${p.name}`}
              >
                <Text style={styles.playerName}>{p.name}</Text>
                <ChevronRight size={18} color={tennisColors.textMuted} />
              </Pressable>
            </Card>
          ))
        )}
      </DetailSheet>

      {/* Op schermniveau en niet in het blad: een Modal binnen een gesloten Modal wordt
          niet meer getekend. */}
      <BookingDetailSheet
        booking={gekozenLes}
        visible={gekozenLes !== null}
        canManage={isCoach(currentUser) && kijktNaarZichzelf}
        onClose={() => setGekozenLes(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { ...typography.h1, color: tennisColors.text },
  warnValue: { fontSize: 14, color: tennisColors.warning, marginTop: 2 },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: tennisColors.textMuted,
    textTransform: 'uppercase', marginTop: spacing.md,
  },
  fieldValue: { fontSize: 14, color: tennisColors.text, marginTop: 2 },
  editButton: { marginTop: spacing.lg },
  subLabel: { fontSize: 12, fontWeight: '700', color: tennisColors.textMuted, textTransform: 'uppercase', marginTop: spacing.sm, marginBottom: spacing.xs },
  muted: { fontSize: 14, color: tennisColors.textMuted },
  rowCard: { marginBottom: spacing.sm },
  rowLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowDay: { fontSize: 15, fontWeight: '600', color: tennisColors.text },
  rowTime: { fontSize: 14, color: tennisColors.textMuted },
  rowMeta: { fontSize: 13, color: tennisColors.textMuted, marginTop: 2 },
  playerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playerName: { fontSize: 15, fontWeight: '600', color: tennisColors.text },
});
