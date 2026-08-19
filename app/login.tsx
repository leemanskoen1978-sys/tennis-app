import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { User as UserIcon, Award } from 'lucide-react-native';
import { tennisColors } from '../constants/tennis-colors';
import { useSimpleData } from '../providers/SimpleDataProvider';

export default function Login(): React.JSX.Element {
  const { users, login, error } = useSimpleData();

  const handleLogin = (userId: string): void => {
    // Root layout auto-redirects na succesvolle login — geen handmatige navigatie.
    void login(userId);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[tennisColors.primary, tennisColors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.title}>Tennisclub Racso</Text>
        <Text style={styles.subtitle}>Kies je profiel</Text>
      </LinearGradient>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {users.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Geen gebruikers gevonden.</Text>
          </View>
        ) : (
          users.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => handleLogin(u.id)}
              style={({ pressed }) => [
                styles.row,
                pressed ? styles.rowPressed : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Log in als ${u.name}`}
            >
              <View style={styles.avatar}>
                <UserIcon size={22} color={tennisColors.primary} />
              </View>

              <View style={styles.rowInfo}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {u.name}
                </Text>
                <View style={styles.badge}>
                  <Award size={12} color={tennisColors.primaryDark} />
                  <Text style={styles.badgeText}>{u.role}</Text>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tennisColors.background,
  },
  header: {
    paddingTop: 72,
    paddingBottom: 40,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: tennisColors.white,
    letterSpacing: 0.3,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 16,
    color: tennisColors.white,
    opacity: 0.9,
  },
  errorBox: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FDECEA',
    borderWidth: 1,
    borderColor: tennisColors.danger,
  },
  errorText: {
    color: tennisColors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    gap: 12,
  },
  emptyState: {
    marginTop: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: tennisColors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: tennisColors.surface,
    borderWidth: 1,
    borderColor: tennisColors.border,
    gap: 14,
  },
  rowPressed: {
    backgroundColor: tennisColors.background,
    borderColor: tennisColors.primary,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tennisColors.background,
    borderWidth: 1,
    borderColor: tennisColors.border,
  },
  rowInfo: {
    flex: 1,
    gap: 6,
  },
  rowName: {
    fontSize: 17,
    fontWeight: '700',
    color: tennisColors.text,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: tennisColors.accent,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: tennisColors.primaryDark,
    textTransform: 'capitalize',
  },
});
