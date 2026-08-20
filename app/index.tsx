// HUB — the one starting screen. Four sections for a coach, four tasks for a player.
//
// Ordering rule (see docs/superpowers/specs/…-navigatie-herstructurering-design.md):
//   about a person -> Spelers or Trainers · about club/money/system -> Beheer · about time -> Agenda
// Tiles are ordered by how often you use them, not alphabetically.

import { View, Text, StyleSheet } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import {
  CalendarDays, CalendarPlus, Users, GraduationCap, SlidersHorizontal,
  BookOpen, TrendingUp, Wallet, ChevronRight, type LucideIcon,
} from 'lucide-react-native';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { ActionTile, TileGrid } from '../components/ui/ActionTile';
import { useSimpleData, usePendingPaymentBookings } from '../providers/SimpleDataProvider';
import { bookingsToday, countPlayers, countCoaches } from '../lib/hub';
import { awaitingApprovalFor, awaitingApprovalOf } from '../lib/inbox';
import { bookingsFor, filterPendingPayment, openBalanceFor } from '../lib/payments';
import { formatEuro } from '../lib/money';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, typography } from '../constants/theme';

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
  const router = useRouter();
  const { currentUser, users, bookings, courts } = useSimpleData();
  const pending = usePendingPaymentBookings();

  if (!currentUser) return <Redirect href="/login" />;
  const isCoach = currentUser.role === 'coach';

  // `bookingsFor` en niet zelf filteren: zo ziet een speler ook de groepslessen waarin
  // hij meespeelt zonder te betalen.
  const myBookings = bookingsFor(currentUser, bookings);
  const today = bookingsToday(isCoach ? bookings : myBookings, new Date());
  // Dezelfde definitie van "staat nog open" als Beheer: een geannuleerde of nog niet
  // bevestigde les hoort niet op de badge, anders loopt die juist óp bij een annulering.
  const myOpen = filterPendingPayment(myBookings).length;
  // Wat er in euro's nog openstaat. Een teller zegt "2 lessen"; wat een speler wil weten is
  // hoeveel dat is, en dat staat daarom voluit op zijn hoofdscherm in plaats van als badge.
  const balance = openBalanceFor(currentUser, bookings, courts);
  // Wat op een beslissing van deze trainer wacht. De badge staat op Agenda, want daar staat
  // de lijst zelf ook — een melding die naar een ander scherm wijst dan waar je hem
  // afhandelt, laat je zoeken.
  const teKeuren = isCoach ? awaitingApprovalFor(bookings, currentUser.id).length : 0;
  // En andersom: waar de speler zelf nog op wacht.
  const gevraagd = isCoach ? 0 : awaitingApprovalOf(bookings, currentUser.id).length;

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  const coachTiles: Tile[] = [
    {
      key: 'agenda',
      title: 'Agenda',
      subtitle: teKeuren > 0
        ? plural(teKeuren, 'les goed te keuren', 'lessen goed te keuren')
        : plural(today, 'vandaag', 'vandaag'),
      icon: CalendarDays,
      onPress: () => router.push('/agenda'),
      badge: teKeuren,
    },
    { key: 'spelers', title: 'Spelers', subtitle: plural(countPlayers(users), 'actief', 'actief'), icon: Users, onPress: () => router.push('/players') },
    { key: 'trainers', title: 'Trainers', subtitle: plural(countCoaches(users), 'trainer', 'trainers'), icon: GraduationCap, onPress: () => router.push('/coaches') },
    { key: 'beheer', title: 'Beheer', subtitle: plural(pending.length, 'openstaand', 'openstaand'), icon: SlidersHorizontal, onPress: () => router.push('/admin'), badge: pending.length },
  ];

  const playerTiles: Tile[] = [
    { key: 'book', title: 'Reserveren', subtitle: 'Boek je volgende les', icon: CalendarPlus, onPress: () => router.push('/agenda/new'), primary: true },
    {
      key: 'mine',
      title: 'Mijn agenda',
      // Wacht er nog een aanvraag op zijn trainer, dan is dát wat hij wil weten — niet
      // hoeveel lessen hij vandaag heeft.
      subtitle: gevraagd > 0
        ? plural(gevraagd, 'wacht op goedkeuring', 'wachten op goedkeuring')
        : plural(today, 'vandaag', 'vandaag'),
      icon: CalendarDays,
      onPress: () => router.push('/agenda'),
      badge: myOpen,
    },
    { key: 'les', title: 'Mijn lessen', subtitle: 'Lesmateriaal van je trainers', icon: BookOpen, onPress: () => router.push('/coaches/lessons') },
    // "Voortgang" en niet "Mijn voortgang": de tab onderaan heet zo, want daar past de
    // langere tekst niet op een telefoon. Tegel en tab moeten hetzelfde heten.
    { key: 'prog', title: 'Voortgang', subtitle: 'Jouw beoordelingen', icon: TrendingUp, onPress: () => router.push('/players/progress') },
  ];

  const tiles = isCoach ? coachTiles : playerTiles;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.hi}>Hoi {currentUser.name} 👋</Text>
          <Text style={styles.q}>Wat wil je doen?</Text>
        </View>
      </View>

      {/* Een speler die nog moet afrekenen, ziet dat vóór de tegels — met het bedrag erbij.
          Staat er niets open, dan staat er ook niets: een kaart met "€ 0,00" is ruis. */}
      {!isCoach && balance.amount > 0 ? (
        <Card
          onPress={() => router.push('/agenda/overzicht')}
          accessibilityLabel={`Openstaand saldo € ${formatEuro(balance.amount)}`}
          style={styles.balance}
        >
          <View style={styles.balanceRow}>
            <View style={styles.balanceIcon}>
              <Wallet size={22} color={tennisColors.warning} />
            </View>
            <View style={styles.balanceText}>
              <Text style={styles.balanceLabel}>Openstaand saldo</Text>
              <Text style={styles.balanceAmount}>€ {formatEuro(balance.amount)}</Text>
              <Text style={styles.balanceSub}>
                {balance.lessons === 1
                  ? '1 les nog niet afgerekend'
                  : `${balance.lessons} lessen nog niet afgerekend`}
              </Text>
            </View>
            <ChevronRight size={20} color={tennisColors.textMuted} />
          </View>
        </Card>
      ) : null}

      <TileGrid>
        {tiles.map((t) => (
          <ActionTile
            key={t.key}
            title={t.title}
            subtitle={t.subtitle}
            icon={t.icon}
            onPress={t.onPress}
            primary={t.primary}
            badge={t.badge}
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
});
