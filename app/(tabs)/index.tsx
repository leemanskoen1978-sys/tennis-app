import { useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CalendarPlus, CalendarDays, BookOpen, TrendingUp, CreditCard,
  UserPlus, BarChart3, SlidersHorizontal, ChevronRight, X, Users, type LucideIcon,
} from 'lucide-react-native';
import { useSimpleData, usePendingPaymentBookings } from '../../providers/SimpleDataProvider';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { PaymentStatusModal } from '../../components/PaymentStatusModal';
import { UserManagement } from '../../components/UserManagement';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography, radius, shadow, minTapTarget, webCursor } from '../../constants/theme';

interface Action {
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
  const { currentUser, bookings } = useSimpleData();
  const pending = usePendingPaymentBookings();
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  if (!currentUser) return null;
  const isCoach = currentUser.role === 'coach';

  const myOpen = bookings.filter(
    (b) => b.player_id === currentUser.id && (b.payment_status === null || b.payment_status === 'unpaid'),
  ).length;

  const coachActions: Action[] = [
    { key: 'agenda', title: 'Mijn agenda', subtitle: 'Bekijk je afspraken', icon: CalendarDays, onPress: () => router.push('/(tabs)/bookings'), primary: true },
    { key: 'beheer', title: 'Beheer', subtitle: 'Betalingen, spelers, lessen', icon: SlidersHorizontal, onPress: () => setManageOpen(true), badge: pending.length },
    { key: 'prog', title: 'Voortgang noteren', subtitle: 'Beoordeel een speler', icon: TrendingUp, onPress: () => router.push('/(tabs)/progress') },
    { key: 'rap', title: 'Rapport', subtitle: 'Inkomsten & overzicht', icon: BarChart3, onPress: () => router.push('/(tabs)/reports') },
  ];

  const playerActions: Action[] = [
    { key: 'book', title: 'Reserveer een baan', subtitle: 'Boek je volgende les', icon: CalendarPlus, onPress: () => router.push('/(tabs)/home'), primary: true },
    { key: 'mine', title: 'Mijn afspraken', subtitle: 'Bekijk je boekingen', icon: CalendarDays, onPress: () => router.push('/(tabs)/bookings'), badge: myOpen },
    { key: 'les', title: 'Mijn lessen', subtitle: 'Lesmateriaal van je coach', icon: BookOpen, onPress: () => router.push('/(tabs)/lessons') },
    { key: 'prog', title: 'Mijn voortgang', subtitle: 'Jouw beoordelingen', icon: TrendingUp, onPress: () => router.push('/(tabs)/progress') },
  ];

  const actions = isCoach ? coachActions : playerActions;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.hi}>Hoi {currentUser.name} 👋</Text>
        <Text style={styles.q}>Wat wil je doen?</Text>
      </View>

      <View style={styles.grid}>
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Card
              key={a.key}
              onPress={a.onPress}
              accessibilityLabel={a.title}
              style={{ ...styles.tile, ...(a.primary ? styles.tilePrimary : {}) }}
            >
              <View style={styles.tileTop}>
                <View style={[styles.iconWrap, a.primary && styles.iconWrapPrimary]}>
                  <Icon color={a.primary ? tennisColors.white : tennisColors.primary} size={24} />
                </View>
                {a.badge && a.badge > 0 ? <Badge label={String(a.badge)} color={tennisColors.warning} /> : null}
              </View>
              <Text style={[styles.tileTitle, a.primary && styles.textOnPrimary]}>{a.title}</Text>
              <Text style={[styles.tileSub, a.primary && styles.subOnPrimary]}>{a.subtitle}</Text>
            </Card>
          );
        })}
      </View>

      {/* Beheer-menu (coach) */}
      <Modal visible={manageOpen} transparent animationType="slide" onRequestClose={() => setManageOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setManageOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Beheer</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Sluiten" onPress={() => setManageOpen(false)} style={webCursor}>
                <X color={tennisColors.textMuted} size={22} />
              </Pressable>
            </View>
            <MenuRow
              icon={CreditCard}
              label="Openstaande betalingen"
              badge={pending.length}
              onPress={() => { setManageOpen(false); setPaymentsOpen(true); }}
            />
            <MenuRow
              icon={Users}
              label="Spelers"
              onPress={() => { setManageOpen(false); router.push('/players'); }}
            />
            <MenuRow
              icon={UserPlus}
              label="Speler toevoegen"
              onPress={() => { setManageOpen(false); setUsersOpen(true); }}
            />
            <MenuRow
              icon={BookOpen}
              label="Les toevoegen"
              onPress={() => { setManageOpen(false); router.push('/(tabs)/lessons'); }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <PaymentStatusModal visible={paymentsOpen} onClose={() => setPaymentsOpen(false)} />
      <UserManagement visible={usersOpen} onClose={() => setUsersOpen(false)} />
    </Screen>
  );
}

function MenuRow({ icon: Icon, label, onPress, badge }: {
  icon: LucideIcon; label: string; onPress: () => void; badge?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, webCursor, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.menuIcon}><Icon color={tennisColors.primary} size={22} /></View>
      <Text style={styles.menuLabel}>{label}</Text>
      {badge && badge > 0 ? <Badge label={String(badge)} color={tennisColors.warning} /> : null}
      <ChevronRight color={tennisColors.textMuted} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
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

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: tennisColors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, gap: spacing.sm, ...shadow('lg'),
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sheetTitle: { ...typography.h2, color: tennisColors.text },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    minHeight: minTapTarget + 8, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderRadius: radius.md, backgroundColor: tennisColors.surfaceAlt,
    borderWidth: 1, borderColor: tennisColors.border,
  },
  menuIcon: {
    width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: tennisColors.primaryTint,
  },
  menuLabel: { flex: 1, ...typography.h3, color: tennisColors.text },
});
