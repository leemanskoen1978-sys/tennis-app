// Profiel — jouw gegevens en uitloggen. De systeeminstellingen staan in Beheer.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LogOut } from 'lucide-react-native';

import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { spacing, typography } from '../constants/theme';
import { tennisColors } from '../constants/tennis-colors';
import { useSimpleData } from '../providers/SimpleDataProvider';

const ROLE_LABELS: Record<string, string> = {
  player: 'Speler',
  coach: 'Trainer',
  parent: 'Ouder',
};

export default function ProfileScreen(): React.JSX.Element {
  const { currentUser, logout } = useSimpleData();

  const roleLabel: string = currentUser
    ? ROLE_LABELS[currentUser.role] ?? currentUser.role
    : '';

  return (
    <Screen>
      <Card>
        {currentUser ? (
          <>
            <Text style={styles.userName}>{currentUser.name}</Text>
            <Text style={styles.userEmail}>{currentUser.email}</Text>
            {currentUser.phone ? <Text style={styles.userEmail}>{currentUser.phone}</Text> : null}
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
            {currentUser.role === 'coach' && currentUser.hourly_rate ? (
              <Text style={styles.rate}>Uurtarief: €{currentUser.hourly_rate}</Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.userEmail}>Niet ingelogd</Text>
        )}
      </Card>

      <Button
        label="Uitloggen"
        variant="secondary"
        icon={<LogOut size={18} color={tennisColors.text} />}
        onPress={() => {
          void logout();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  userName: { ...typography.h2, color: tennisColors.text },
  userEmail: { fontSize: 14, color: tennisColors.textMuted },
  roleBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: tennisColors.accent,
  },
  roleBadgeText: { fontSize: 12, fontWeight: '700', color: tennisColors.primaryDark },
  rate: { fontSize: 14, color: tennisColors.textMuted, marginTop: spacing.sm },
});
