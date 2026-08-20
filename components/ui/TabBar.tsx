import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Home, CalendarDays, CalendarPlus, Users, GraduationCap, SlidersHorizontal,
  BookOpen, TrendingUp, type LucideIcon,
} from 'lucide-react-native';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, minTapTarget, webCursor } from '../../constants/theme';

interface TabItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** First path segment that marks this tab as the one you are in; leeg = het hoofdscherm. */
  segment: string;
}

// Dezelfde rolsplitsing als de tegels op het hoofdscherm, met Home ervoor: een trainer
// navigeert langs secties, een speler langs taken. Iconen zijn gelijk aan die van de
// tegels, zodat tegel en tab hetzelfde beeld oproepen.
const COACH_TABS: TabItem[] = [
  { label: 'Home', href: '/', icon: Home, segment: '' },
  { label: 'Agenda', href: '/agenda', icon: CalendarDays, segment: 'agenda' },
  { label: 'Spelers', href: '/players', icon: Users, segment: 'players' },
  { label: 'Trainers', href: '/coaches', icon: GraduationCap, segment: 'coaches' },
  { label: 'Beheer', href: '/admin', icon: SlidersHorizontal, segment: 'admin' },
];

const PLAYER_TABS: TabItem[] = [
  { label: 'Home', href: '/', icon: Home, segment: '' },
  { label: 'Reserveren', href: '/agenda/new', icon: CalendarPlus, segment: 'agenda' },
  { label: 'Mijn lessen', href: '/coaches/lessons', icon: BookOpen, segment: 'coaches' },
  { label: 'Voortgang', href: '/players/progress', icon: TrendingUp, segment: 'players' },
];

/**
 * De vaste tabbalk onderaan het scherm. Onderin is op een telefoon de plek waar je duim
 * al is, dus de secties staan daar in plaats van als tekstlinks bovenin. De balk hangt
 * niet aan de geschiedenis: na een deep link of een herlaadbeurt op het web is er dus
 * altijd nog een weg terug naar elke sectie.
 */
export function TabBar() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { currentUser } = useSimpleData();

  if (!currentUser) return null;

  const tabs = currentUser.role === 'coach' ? COACH_TABS : PLAYER_TABS;
  const active = segments[0] ?? '';

  return (
    // De onderrand van het toestel (home-indicator) mag de tabs niet overlappen.
    <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.xs }]}>
      {tabs.map((tab) => {
        const selected = active === tab.segment;
        const color = selected ? tennisColors.primary : tennisColors.textMuted;
        const Icon = tab.icon;
        return (
          <Pressable
            key={tab.href}
            // Naar Home replace je: thuiskomen beëindigt de reis, het verlengt hem niet.
            onPress={() => (tab.href === '/' ? router.replace('/') : router.push(tab.href))}
            accessibilityRole="link"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            style={[styles.tab, webCursor]}
          >
            <Icon size={22} color={color} />
            <Text numberOfLines={1} style={[styles.label, { color }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.xs,
    backgroundColor: tennisColors.surface,
    borderTopWidth: 1,
    borderTopColor: tennisColors.border,
  },
  tab: {
    // Gelijke breedte per tab, ongeacht de lengte van het label.
    flex: 1,
    minHeight: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
    paddingHorizontal: 2,
  },
  label: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
