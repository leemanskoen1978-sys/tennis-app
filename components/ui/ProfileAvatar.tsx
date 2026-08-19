import { Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { tennisColors } from '../../constants/tennis-colors';
import { webCursor } from '../../constants/theme';

/** Initials from a display name: "Koen Leemans" -> "KL", "Koen" -> "KO". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Profile entry point, top right of every section screen. Profile is not a task like the
 * four tiles on the hub, so it gets no tile of its own — it lives in the header instead.
 */
export function ProfileAvatar({ name }: { name: string }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/profile')}
      accessibilityRole="button"
      accessibilityLabel={`Profiel van ${name}`}
      style={[styles.avatar, webCursor]}
    >
      <Text style={styles.text}>{initials(name)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 34, height: 34, borderRadius: 17, marginRight: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: tennisColors.primaryTint,
  },
  text: { fontSize: 13, fontWeight: '700', color: tennisColors.primaryDark },
});
