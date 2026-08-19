import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { ProfileAvatar } from './ProfileAvatar';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { appConfig } from '../../constants/app-config';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, minTapTarget, webCursor } from '../../constants/theme';

interface MenuItem {
  label: string;
  href: string;
  /** First path segment that marks this item as the one you are in. */
  segment: string;
}

// The same split as the hub tiles: a coach navigates sections, a player navigates tasks.
const COACH_ITEMS: MenuItem[] = [
  { label: 'Agenda', href: '/agenda', segment: 'agenda' },
  { label: 'Spelers', href: '/players', segment: 'players' },
  { label: 'Trainers', href: '/coaches', segment: 'coaches' },
  { label: 'Beheer', href: '/admin', segment: 'admin' },
];

const PLAYER_ITEMS: MenuItem[] = [
  { label: 'Reserveren', href: '/agenda/new', segment: 'agenda' },
  { label: 'Mijn lessen', href: '/coaches/lessons', segment: 'coaches' },
  { label: 'Mijn voortgang', href: '/players/progress', segment: 'players' },
];

/**
 * The bar that never changes. Every screen can be reached by link or reloaded on the web,
 * and the stack's own back arrow disappears when there is no history — which left screens
 * with no way out at all. These links do not depend on history, so there is always one.
 */
export function MenuBar() {
  const router = useRouter();
  const segments = useSegments();
  const { currentUser } = useSimpleData();

  if (!currentUser) return null;

  const items = currentUser.role === 'coach' ? COACH_ITEMS : PLAYER_ITEMS;
  const active = segments[0] ?? '';
  const canGoBack = router.canGoBack();

  return (
    <View style={styles.bar}>
      <Pressable
        // Replace rather than push: going home ends the trip, it does not extend it.
        onPress={() => router.replace('/')}
        accessibilityRole="button"
        accessibilityLabel="Naar het hoofdscherm"
        style={[styles.brandBtn, webCursor]}
      >
        <Text style={styles.brand}>{appConfig.name}</Text>
      </Pressable>

      {canGoBack ? (
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Terug"
          style={[styles.backBtn, webCursor]}
        >
          <ChevronLeft size={18} color={tennisColors.textMuted} />
          <Text style={styles.backText}>Terug</Text>
        </Pressable>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.linksWrap}
        contentContainerStyle={styles.links}
      >
        {items.map((item) => {
          const selected = active === item.segment;
          return (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href)}
              accessibilityRole="link"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              style={[styles.link, webCursor]}
            >
              <Text style={[styles.linkText, selected && styles.linkTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ProfileAvatar is a button already — wrapping it nests one button inside another,
          which is invalid HTML and breaks hydration on the web. */}
      <ProfileAvatar name={currentUser.name} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: tennisColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tennisColors.border,
  },
  brandBtn: { minHeight: minTapTarget, justifyContent: 'center' },
  brand: { fontSize: 17, fontWeight: '700', color: tennisColors.text },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    minHeight: minTapTarget, paddingRight: spacing.xs, justifyContent: 'center',
  },
  backText: { fontSize: 14, fontWeight: '600', color: tennisColors.textMuted },
  // flexShrink lets the links scroll instead of pushing the avatar off a narrow screen.
  linksWrap: { flexGrow: 1, flexShrink: 1 },
  links: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  link: {
    minHeight: minTapTarget, justifyContent: 'center',
    paddingHorizontal: spacing.md, borderRadius: radius.md,
  },
  linkText: { fontSize: 15, fontWeight: '600', color: tennisColors.textMuted },
  linkTextActive: { color: tennisColors.text, fontWeight: '800' },
});
