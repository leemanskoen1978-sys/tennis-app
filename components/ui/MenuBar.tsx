import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { ProfileAvatar } from './ProfileAvatar';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { appConfig } from '../../constants/app-config';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, minTapTarget, webCursor } from '../../constants/theme';

/**
 * De balk bovenin: waar je bent (de naam van de app, die naar het hoofdscherm gaat),
 * hoe je een stap terug gaat, en wie je bent. De secties zitten in de tabbalk onderaan
 * het scherm; ze hier herhalen zou twee plekken geven die hetzelfde doen.
 */
export function MenuBar() {
  const router = useRouter();
  const { currentUser } = useSimpleData();

  if (!currentUser) return null;

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

      {/* Duwt de avatar naar rechts, ook als de Terug-knop er niet is. */}
      <View style={styles.spacer} />

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
  spacer: { flexGrow: 1, flexShrink: 1 },
});
