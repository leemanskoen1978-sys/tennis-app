// HUB — the one starting screen. Four sections for a coach, four tasks for a player.
//
// Ordering rule (see docs/superpowers/specs/…-navigatie-herstructurering-design.md):
//   about a person -> Spelers or Trainers · about club/money/system -> Beheer · about time -> Agenda
// Tiles are ordered by how often you use them, not alphabetically.

import { View, Text, StyleSheet } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import {
  CalendarDays, CalendarPlus, Users, GraduationCap, SlidersHorizontal,
  BookOpen, TrendingUp, type LucideIcon,
} from 'lucide-react-native';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useSimpleData, usePendingPaymentBookings } from '../providers/SimpleDataProvider';
import { bookingsToday, countPlayers, countCoaches } from '../lib/hub';
import { filterPendingPayment } from '../lib/payments';
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
  const { currentUser, users, bookings } = useSimpleData();
  const pending = usePendingPaymentBookings();

  if (!currentUser) return <Redirect href="/login" />;
  const isCoach = currentUser.role === 'coach';

  const myBookings = bookings.filter((b) => b.player_id === currentUser.id);
  const today = bookingsToday(isCoach ? bookings : myBookings, new Date());
  // Dezelfde definitie van "staat nog open" als Beheer: een geannuleerde of nog niet
  // bevestigde les hoort niet op de badge, anders loopt die juist óp bij een annulering.
  const myOpen = filterPendingPayment(myBookings).length;

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  const coachTiles: Tile[] = [
    { key: 'agenda', title: 'Agenda', subtitle: plural(today, 'vandaag', 'vandaag'), icon: CalendarDays, onPress: () => router.push('/agenda') },
    { key: 'spelers', title: 'Spelers', subtitle: plural(countPlayers(users), 'actief', 'actief'), icon: Users, onPress: () => router.push('/players') },
    { key: 'trainers', title: 'Trainers', subtitle: plural(countCoaches(users), 'trainer', 'trainers'), icon: GraduationCap, onPress: () => router.push('/coaches') },
    { key: 'beheer', title: 'Beheer', subtitle: plural(pending.length, 'openstaand', 'openstaand'), icon: SlidersHorizontal, onPress: () => router.push('/admin'), badge: pending.length },
  ];

  const playerTiles: Tile[] = [
    { key: 'book', title: 'Reserveren', subtitle: 'Boek je volgende les', icon: CalendarPlus, onPress: () => router.push('/agenda/new'), primary: true },
    { key: 'mine', title: 'Mijn agenda', subtitle: plural(today, 'vandaag', 'vandaag'), icon: CalendarDays, onPress: () => router.push('/agenda'), badge: myOpen },
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

      <View style={styles.grid}>
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Card
              key={t.key}
              onPress={t.onPress}
              accessibilityLabel={t.title}
              style={{ ...styles.tile, ...(t.primary ? styles.tilePrimary : {}) }}
            >
              <View style={styles.tileTop}>
                <View style={[styles.iconWrap, t.primary && styles.iconWrapPrimary]}>
                  <Icon color={t.primary ? tennisColors.white : tennisColors.primary} size={24} />
                </View>
                {t.badge && t.badge > 0 ? <Badge label={String(t.badge)} color={tennisColors.warning} /> : null}
              </View>
              <Text style={[styles.tileTitle, t.primary && styles.textOnPrimary]}>{t.title}</Text>
              <Text style={[styles.tileSub, t.primary && styles.subOnPrimary]}>{t.subtitle}</Text>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerText: { flex: 1, gap: spacing.xs },
  hi: { ...typography.h1, color: tennisColors.text },
  q: { fontSize: 16, color: tennisColors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { flexGrow: 1, flexBasis: 150, minHeight: 132, justifyContent: 'flex-start' },
  tilePrimary: { flexBasis: '100%', backgroundColor: tennisColors.primary },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: tennisColors.primaryTint,
  },
  iconWrapPrimary: { backgroundColor: 'rgba(255,255,255,0.2)' },
  tileTitle: { ...typography.h3, color: tennisColors.text, marginTop: spacing.sm },
  tileSub: { fontSize: 13, color: tennisColors.textMuted },
  textOnPrimary: { color: tennisColors.white },
  subOnPrimary: { color: 'rgba(255,255,255,0.85)' },
});
