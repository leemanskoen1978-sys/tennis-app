import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { User as UserIcon } from 'lucide-react-native';
import { tennisColors } from '../constants/tennis-colors';
import { appConfig } from '../constants/app-config';
import { spacing, typography, minTapTarget } from '../constants/theme';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useSimpleData } from '../providers/SimpleDataProvider';

type Role = 'player' | 'coach' | 'parent';

const ROLE_LABELS: Record<Role, string> = {
  coach: 'Coach',
  player: 'Speler',
  parent: 'Ouder',
};

/** Role badge props: coach = primary, player = subtle, parent = court. */
function roleBadgeProps(role: string): { label: string; color?: string; subtle?: boolean } {
  switch (role) {
    case 'coach':
      return { label: ROLE_LABELS.coach, color: tennisColors.primary };
    case 'parent':
      return { label: ROLE_LABELS.parent, color: tennisColors.court };
    case 'player':
    default:
      return { label: ROLE_LABELS.player ?? role, subtle: true };
  }
}

export default function Login(): React.JSX.Element {
  const { users, login, error, currentUser } = useSimpleData();

  // Once logged in, leave the login screen for the hub.
  if (currentUser) return <Redirect href="/" />;

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
        <Text style={styles.title}>{appConfig.name}</Text>
        <Text style={styles.subtitle}>Kies je profiel om te starten</Text>
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
        <View style={styles.listInner}>
          {users.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Geen gebruikers gevonden.</Text>
            </View>
          ) : (
            users.map((u) => {
              const badge = roleBadgeProps(u.role);
              return (
                <Card
                  key={u.id}
                  onPress={() => handleLogin(u.id)}
                  accessibilityLabel={`Log in als ${u.name}`}
                  style={styles.row}
                >
                  <View style={styles.rowContent}>
                    <View style={styles.avatar}>
                      <UserIcon size={22} color={tennisColors.primary} />
                    </View>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {u.name}
                    </Text>
                    <Badge label={badge.label} color={badge.color} subtle={badge.subtle} />
                  </View>
                </Card>
              );
            })
          )}
        </View>
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
    padding: spacing.xl,
  },
  // Center the list below the full-width gradient without capping the header.
  listInner: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: spacing.md,
  },
  row: {
    minHeight: minTapTarget,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
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
  rowName: {
    ...typography.h3,
    flex: 1,
    color: tennisColors.text,
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
});
