// HUB — the one starting screen. Four sections for a coach, four tasks for a player.
//
// Ordering rule (see docs/superpowers/specs/…-navigatie-herstructurering-design.md):
//   about a person -> Spelers or Trainers · about club/money/system -> Beheer · about time -> Agenda
// Tiles are ordered by how often you use them, not alphabetically.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import {
  CalendarDays, CalendarPlus, Users, BookOpen, TrendingUp, Wallet, ChevronRight,
  X, XCircle, BellRing, type LucideIcon,
} from 'lucide-react-native';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ActionTile, TileGrid } from '../components/ui/ActionTile';
import { Lesdag } from '../components/lesdag/Lesdag';
import { Lesdagspeler } from '../components/lesdag/Lesdagspeler';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { useKindkeuze } from '../providers/kindkeuze';
import { SpelerKiezer } from '../components/ui/SpelerKiezer';
import { bookingsToday } from '../lib/hub';
import { awaitingApprovalFor, awaitingApprovalOf, recentGeweigerd } from '../lib/inbox';
import { isCoach, magInElkeAgenda } from '../lib/rechten';
import { zonderWeggeklikt } from '../lib/weggeklikt';
import { useWeggeklikt } from '../providers/weggeklikt';
import { bookingsFor, filterPendingPayment, openBalanceFor } from '../lib/payments';
import { formatEuro } from '../lib/money';
import { formatDayTimeRange, formatDayTime } from '../lib/datetime';
import { groupSize, shortGroupLabel } from '../lib/groups';
import { dossierPad } from '../lib/dossier';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, typography } from '../constants/theme';
import { useT } from '../lib/i18n';

interface Tile {
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  onPress: () => void;
  primary?: boolean;
  badge?: number;
}

export default function Hub() {
  const t = useT();
  const router = useRouter();
  const { currentUser, users, bookings, courts, approveBooking, rejectBooking, error } = useSimpleData();
  // Wiens gegevens dit scherm toont: jijzelf, of het kind dat je bovenaan koos. Zie
  // providers/kindkeuze.
  const { speler, kinderen, kijktNaarZichzelf } = useKindkeuze();
  // Een trainer die naar zijn kind kijkt, wil het beeld van een speler: de agenda van zijn
  // kind, niet zijn eigen lesrooster. Zodra hij terugwisselt naar Ikzelf is hij weer trainer.
  const coach = isCoach(currentUser) && kijktNaarZichzelf;

  if (!currentUser) return <Redirect href="/login" />;

  // Waar "mijn agenda" heen gaat: een trainer naar zijn trainersdossier, iedereen anders naar
  // zijn spelersdossier, en een ouder naar het kind dat hij koos. De regel staat in
  // lib/dossier, zodat elk scherm dezelfde bestemming kiest.
  const dossier = dossierPad(currentUser, speler);


  // `bookingsFor` en niet zelf filteren: zo ziet een speler ook de groepslessen waarin
  // hij meespeelt zonder te betalen.
  const myBookings = bookingsFor(speler, bookings);
  const today = bookingsToday(coach ? bookings : myBookings, new Date());
  // Dezelfde definitie van "staat nog open" als Beheer: een geannuleerde of nog niet
  // bevestigde les hoort niet op de badge, anders loopt die juist óp bij een annulering.
  const myOpen = filterPendingPayment(myBookings).length;
  // Wat er in euro's nog openstaat. Een teller zegt "2 lessen"; wat een speler wil weten is
  // hoeveel dat is, en dat staat daarom voluit op zijn hoofdscherm in plaats van als badge.
  const balance = openBalanceFor(speler, bookings, courts);
  // Niet langer alleen een getal: de lijst staat sinds vandaag hier, dus de kaarten hebben de
  // lessen zelf nodig.
  const teKeuren = coach
    ? awaitingApprovalFor(bookings, currentUser.id, magInElkeAgenda(currentUser))
    : [];
  // En andersom: waar de speler zelf nog op wacht.
  const gevraagd = coach ? [] : awaitingApprovalOf(bookings, speler?.id);

  const nameOf = (id: string): string => users.find((u) => u.id === id)?.name ?? t('Onbekend');
  const courtName = (id: string): string => courts.find((c) => c.id === id)?.name ?? t('Onbekende baan');
  // Een geweigerde aanvraag is het enige dat anders nergens te zien is: de les verdwijnt
  // en niemand zegt waarom. Een goedgekeurde les staat gewoon in zijn agenda.
  const geweigerd = coach ? [] : recentGeweigerd(bookings, speler?.id, new Date());
  // Wat je wegklikt blijft weg — op dit toestel. Zie lib/weggeklikt voor waarom dat niet in
  // de databank staat.
  const { weggeklikt, klikWeg, klikAllesWeg } = useWeggeklikt(geweigerd);
  const teTonen = zonderWeggeklikt(geweigerd, weggeklikt);

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? t(one) : t(many)}`;

  // Wat een trainer op Home overhoudt, is wat géén tabblad heeft. Spelers, Trainers en
  // Beheer stonden hier ook als tegel, maar die staan onderaan al in de balk: twee wegen
  // naar hetzelfde scherm maken het hoofdscherm langer zonder er iets aan toe te voegen.
  // Afvinken staat nu bij Spelers (het gaat over wie er is) en Mijn agenda bij Trainers.
  const coachTiles: Tile[] = [
    {
      key: 'new',
      title: t('Nieuwe afspraak'),
      subtitle: t('Les inplannen voor een speler'),
      icon: CalendarPlus,
      onPress: () => router.push('/agenda/new'),
    },
  ];

  const playerTiles: Tile[] = [
    { key: 'book', title: t('Reserveren'), subtitle: t('Boek je volgende les'), icon: CalendarPlus, onPress: () => router.push('/agenda/new'), primary: true },
    {
      key: 'mine',
      title: t('Mijn agenda'),
      // Wacht er nog een aanvraag op zijn trainer, dan is dát wat hij wil weten — niet
      // hoeveel lessen hij vandaag heeft.
      subtitle: gevraagd.length > 0
        ? plural(gevraagd.length, 'wacht op goedkeuring', 'wachten op goedkeuring')
        : plural(today, 'vandaag', 'vandaag'),
      icon: CalendarDays,
      onPress: () => { if (dossier) router.push(dossier); },
      badge: myOpen,
    },
    { key: 'les', title: t('Mijn lessen'), subtitle: t('Lesmateriaal van je trainers'), icon: BookOpen, onPress: () => router.push('/coaches/lessons') },
    // "Voortgang" en niet "Mijn voortgang": de tab onderaan heet zo, want daar past de
    // langere tekst niet op een telefoon. Tegel en tab moeten hetzelfde heten.
    { key: 'prog', title: t('Voortgang'), subtitle: t('Jouw beoordelingen'), icon: TrendingUp, onPress: () => router.push('/players/progress') },
  ];

  // Je kinderen aan de club. Voor iedereen, speler én trainer: ouderschap hangt niet aan een
  // rol. De tegel staat er ook als je er nog geen hebt — anders is er geen weg naartoe.
  const kinderenTile: Tile = {
    key: 'kinderen',
    title: t('Mijn kinderen'),
    subtitle: kinderen.length === 0
      ? t('Nog geen kind gekoppeld')
      : plural(kinderen.length, 'kind', 'kinderen'),
    icon: Users,
    onPress: () => router.push('/kinderen'),
  };

  const tiles = [...(coach ? coachTiles : playerTiles), kinderenTile];

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.hi}>{t('Hoi {naam} 👋', { naam: currentUser.name })}</Text>
          <Text style={styles.q}>{t('Wat wil je doen?')}</Text>
        </View>
      </View>

      {/* Heb je kinderen aan de club: gaat dit scherm over jou of over een van hen? Alles
          eronder volgt die keuze. Zie providers/kindkeuze. */}
      <SpelerKiezer />

      {/* Wat op een beslissing wacht, staat boven de lesdag: zolang de trainer niets zegt,
          gaat die les niet door. Vroeger stond deze lijst op de Agenda-tab terwijl de badge
          op Home stond — een melding die naar een ander scherm wijst dan waar je hem
          afhandelt, laat je zoeken. */}
      {teKeuren.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('Goed te keuren')}</Text>
          {teKeuren.map((b) => (
            <Card key={b.id} style={styles.newCard}>
              <View style={styles.newRow}>
                <View style={styles.newIcon}>
                  <BellRing size={20} color={tennisColors.warning} />
                </View>
                <View style={styles.newBody}>
                  <Text style={styles.lessonTime}>
                    {t('{naam} vraagt een les', {
                      naam: shortGroupLabel(nameOf(b.player_id), groupSize(b)),
                    })}
                  </Text>
                  <Text style={styles.lessonCourt}>
                    {formatDayTime(b.start_time)} · {courtName(b.court_id)}
                  </Text>
                  {/* Een beheerder ziet ook de aanvragen van collega's. Dan moet erbij
                      staan wiens agenda het is, anders keurt hij iets goed voor iemand
                      anders zonder het te weten. */}
                  {b.coach_id !== currentUser?.id ? (
                    <Text style={styles.lessonCourt}>
                      {t('In de agenda van {trainer}', { trainer: nameOf(b.coach_id) })}
                    </Text>
                  ) : null}
                </View>
              </View>
              {/* Goedkeuren is de knop die je meestal wilt, dus die is de nadrukkelijke;
                  weigeren annuleert de les en geeft het uur weer vrij. */}
              <View style={styles.decide}>
                <Button
                  label={t('Goedkeuren')}
                  variant="primary"
                  style={styles.decideButton}
                  onPress={() => {
                    void approveBooking(b.id).catch(() => undefined);
                  }}
                />
                <Button
                  label={t('Weigeren')}
                  variant="secondary"
                  style={styles.decideButton}
                  onPress={() => {
                    void rejectBooking(b.id).catch(() => undefined);
                  }}
                />
              </View>

              {/* Mislukt het opslaan, dan hoort dat hier te staan en niet alleen in de
                  console. Zonder deze regel drukte je op Goedkeuren, gebeurde er niets,
                  en was er niets dat je vertelde waarom. */}
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </Card>
          ))}
        </View>
      ) : null}

      {gevraagd.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('Wacht op goedkeuring')}</Text>
          {gevraagd.map((b) => (
            <Card key={b.id} style={styles.newCard}>
              <Text style={styles.lessonTime}>
                {formatDayTime(b.start_time)} · {nameOf(b.coach_id)}
              </Text>
              <Text style={styles.lessonCourt}>
                {t('{baan} — je trainer moet deze les nog bevestigen.', {
                  baan: courtName(b.court_id),
                })}
              </Text>
            </Card>
          ))}
        </View>
      ) : null}

      {/* De lesdag hoort bovenaan: wat een trainer om vijf voor vijf wil zien, is de les
          van vijf uur — niet een keuzemenu. Voor een speler is dat dezelfde vraag met een
          ander antwoord: hoe laat, bij wie, op welke baan. */}
      {coach
        ? <Lesdag coachId={currentUser.id} />
        : speler ? <Lesdagspeler spelerId={speler.id} /> : null}

      {/* Wat er met een aanvraag gebeurde. Staat bovenaan en verdwijnt na een week vanzelf:
          er valt niets weg te klikken, en een bericht van drie weken oud is geen bericht. */}
      {teTonen.map((les) => (
        <Card key={les.id} style={styles.geweigerd}>
          <View style={styles.geweigerdRij}>
            <View style={styles.geweigerdIcoon}>
              <XCircle size={22} color={tennisColors.danger} />
            </View>
            <View style={styles.geweigerdTekst}>
              <Text style={styles.geweigerdTitel}>{t('Je aanvraag is geweigerd')}</Text>
              <Text style={styles.geweigerdSub}>
                {formatDayTimeRange(les.start_time, les.end_time)}
              </Text>
              <Text style={styles.geweigerdSub}>
                {t('Vraag gerust een ander uur aan.')}
              </Text>
            </View>
            {/* Wegklikken kan meteen: gelezen is gelezen, en zeven dagen naar hetzelfde
                bericht kijken is geen bericht meer maar behang. */}
            <Pressable
              onPress={() => klikWeg(les.id)}
              accessibilityRole="button"
              accessibilityLabel={t('Bericht wegklikken')}
              style={styles.wegknop}
              hitSlop={8}
            >
              <X size={20} color={tennisColors.textMuted} />
            </Pressable>
          </View>
        </Card>
      ))}

      {/* Bij meer dan één bericht: alles in één keer weg. Ze stuk voor stuk wegtikken is
          werk dat niets oplevert — je hebt ze toch al gelezen. */}
      {teTonen.length > 1 ? (
        <Button
          label={t('Geweigerde aanvragen wissen')}
          variant="secondary"
          onPress={() => klikAllesWeg(teTonen.map((les) => les.id))}
        />
      ) : null}

      {/* Een speler die nog moet afrekenen, ziet dat vóór de tegels — met het bedrag erbij.
          Staat er niets open, dan staat er ook niets: een kaart met "€ 0,00" is ruis. */}
      {!coach && balance.amount > 0 ? (
        <Card
          onPress={() => { if (dossier) router.push(dossier); }}
          accessibilityLabel={t('Openstaand saldo € {bedrag}', { bedrag: formatEuro(balance.amount) })}
          style={styles.balance}
        >
          <View style={styles.balanceRow}>
            <View style={styles.balanceIcon}>
              <Wallet size={22} color={tennisColors.warning} />
            </View>
            <View style={styles.balanceText}>
              <Text style={styles.balanceLabel}>{t('Openstaand saldo')}</Text>
              <Text style={styles.balanceAmount}>€ {formatEuro(balance.amount)}</Text>
              <Text style={styles.balanceSub}>
                {balance.lessons === 1
                  ? t('1 les nog niet afgerekend')
                  : t('{n} lessen nog niet afgerekend', { n: balance.lessons })}
              </Text>
            </View>
            <ChevronRight size={20} color={tennisColors.textMuted} />
          </View>
        </Card>
      ) : null}

      <TileGrid>
        {tiles.map((tile) => (
          <ActionTile
            key={tile.key}
            title={tile.title}
            subtitle={tile.subtitle}
            icon={tile.icon}
            onPress={tile.onPress}
            primary={tile.primary}
            badge={tile.badge}
          />
        ))}
      </TileGrid>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerText: { flex: 1, gap: spacing.xs },
  hi: { ...typography.h1, color: tennisColors.text },
  q: { fontSize: 16, color: tennisColors.textMuted },
  // Een randje in de waarschuwingskleur in plaats van een volvlak: het vraagt aandacht,
  // maar een openstaand bedrag is geen fout en hoort de tegels eronder niet te overschreeuwen.
  // Een randje in de foutkleur: het vraagt aandacht, maar het is geen ramp en het hoort de
  // tegels eronder niet te overschreeuwen. Zelfde vorm als het openstaande saldo.
  geweigerd: { borderWidth: 1, borderColor: tennisColors.danger },
  geweigerdRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  geweigerdIcoon: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: tennisColors.dangerTint,
  },
  geweigerdTekst: { flex: 1 },
  wegknop: { padding: 4 },
  geweigerdTitel: { ...typography.h3, color: tennisColors.text },
  geweigerdSub: { fontSize: 13, color: tennisColors.textMuted },
  balance: { borderWidth: 1, borderColor: tennisColors.warning },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  balanceIcon: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: tennisColors.warningTint,
  },
  balanceText: { flex: 1 },
  balanceLabel: {
    ...typography.label,
    color: tennisColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceAmount: { ...typography.h1, color: tennisColors.text },
  balanceSub: { fontSize: 13, color: tennisColors.textMuted },
  error: { color: tennisColors.danger, fontSize: 13 },
  section: { gap: spacing.md },
  sectionLabel: {
    ...typography.label,
    color: tennisColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  decide: { flexDirection: 'row', gap: spacing.sm },
  decideButton: { flex: 1 },
  // Zelfde randje als het openstaande saldo op dit scherm: het vraagt aandacht zonder
  // de rest van het scherm te overschreeuwen.
  newCard: { borderWidth: 1, borderColor: tennisColors.warning },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  newIcon: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: tennisColors.warningTint,
  },
  newBody: { flex: 1 },
  lessonTime: { ...typography.h3, color: tennisColors.text },
  lessonCourt: { fontSize: 13, color: tennisColors.textMuted },
});
