import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Home, CalendarDays, CalendarPlus, Users, GraduationCap, SlidersHorizontal,
  BookOpen, TrendingUp, type LucideIcon,
} from 'lucide-react-native';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, minTapTarget, webCursor, contentMaxWidth } from '../../constants/theme';
import { useT, type Translate } from '../../lib/i18n';

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
const coachTabs = (t: Translate): TabItem[] => [
  { label: t('Home'), href: '/', icon: Home, segment: '' },
  { label: t('Agenda'), href: '/agenda', icon: CalendarDays, segment: 'agenda' },
  { label: t('Spelers'), href: '/players', icon: Users, segment: 'players' },
  { label: t('Trainers'), href: '/coaches', icon: GraduationCap, segment: 'coaches' },
  { label: t('Beheer'), href: '/admin', icon: SlidersHorizontal, segment: 'admin' },
];

const playerTabs = (t: Translate): TabItem[] => [
  { label: t('Home'), href: '/', icon: Home, segment: '' },
  { label: t('Reserveren'), href: '/agenda/new', icon: CalendarPlus, segment: 'agenda' },
  { label: t('Mijn lessen'), href: '/coaches/lessons', icon: BookOpen, segment: 'coaches' },
  // Zelfde tekst als de tegel op het hoofdscherm: een tab die anders heet dan de tegel
  // waar hij naartoe gaat, laat je twijfelen of het wel dezelfde plek is.
  { label: t('Voortgang'), href: '/players/progress', icon: TrendingUp, segment: 'players' },
];

/**
 * De vaste tabbalk onderaan het scherm. Onderin is op een telefoon de plek waar je duim
 * al is, dus de secties staan daar in plaats van als tekstlinks bovenin. De balk hangt
 * niet aan de geschiedenis: na een deep link of een herlaadbeurt op het web is er dus
 * altijd nog een weg terug naar elke sectie.
 */
export function TabBar() {
  const t = useT();
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { currentUser } = useSimpleData();

  if (!currentUser) return null;

  const tabs = currentUser.role === 'coach' ? coachTabs(t) : playerTabs(t);
  const active = segments[0] ?? '';

  return (
    // De onderrand van het toestel (home-indicator) mag de tabs niet overlappen.
    <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.xs }]}>
      {/* De balk loopt over de volle breedte (anders zweeft hij), maar de rij tabs zelf
          krijgt dezelfde maximale breedte als de schermen en staat gecentreerd: op een
          breed venster gaan vijf tabs anders zo ver uit elkaar staan dat ze niet meer
          als één balk lezen. Op een telefoon is het venster smaller dan dat maximum,
          dus daar verandert er niets. */}
      <View style={styles.row}>
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
              {/* De pil staat er altijd, ook onzichtbaar: zo houdt elke tab dezelfde hoogte
                  en blijven icoon en label op hun plek zodra een tab actief wordt. De
                  gevulde vorm mét rand is het echte verschil — kleur alleen zou een tab
                  onvindbaar maken voor wie groen en grijs slecht uit elkaar houdt. */}
              <View style={[styles.pill, selected && styles.pillActive]}>
                <Icon size={22} color={color} />
              </View>
              <Text numberOfLines={1} style={[styles.label, { color }, selected && styles.labelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.xs,
    backgroundColor: tennisColors.surface,
    borderTopWidth: 1,
    borderTopColor: tennisColors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
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
  pill: {
    minWidth: 48,
    paddingVertical: 3,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    // Onzichtbaar bij een niet-actieve tab, maar wel even groot: geen verspringen.
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: tennisColors.primaryTint,
    borderColor: tennisColors.primary,
  },
  label: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  labelActive: { fontWeight: '700' },
});
