import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { UserPlus, X } from 'lucide-react-native';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, typography, radius } from '../constants/theme';
import { appConfig } from '../constants/app-config';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import type { Role } from '../lib/types';
import { useSimpleData } from '../providers/SimpleDataProvider';

interface UserManagementProps {
  visible: boolean;
  onClose: () => void;
}

const ROLE_LABELS: Record<Role, string> = {
  player: 'Speler',
  coach: 'Coach',
  parent: 'Ouder',
};

const ROLE_BADGE_COLORS: Record<Role, string> = {
  player: tennisColors.primary,
  coach: tennisColors.primary,
  parent: tennisColors.court,
};

/** Coach uses primary badge, parent uses court, player is subtle. */
function isSubtleRole(role: Role): boolean {
  return role === 'player';
}

/**
 * Turn a display name into an email local-part:
 * lowercase, strip diacritics, spaces → dots, keep only [a-z0-9.].
 * "Jan De Vries" → "jan.de.vries".
 */
function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '');
}

export function UserManagement(props: UserManagementProps): JSX.Element {
  const { visible, onClose } = props;
  const { users, addUser, error } = useSimpleData();

  const [name, setName] = useState<string>('');

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0;

  const generatedEmail = useMemo<string>(() => {
    const slug = slugify(name);
    const local = slug.length > 0 ? slug : `speler${Date.now().toString(36)}`;
    return `${local}@${appConfig.emailDomain}`;
  }, [name]);

  const handleAdd = async (): Promise<void> => {
    if (!canSubmit) {
      return;
    }
    await addUser({ name: trimmedName, email: generatedEmail, role: 'player' });
    setName('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Speler toevoegen</Text>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Sluiten"
              accessibilityRole="button"
            >
              <X size={22} color={tennisColors.text} />
            </Pressable>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Naam</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Naam"
              placeholderTextColor={tennisColors.textMuted}
              style={styles.input}
            />
            <Text style={styles.helper}>E-mailadres: {generatedEmail}</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              label="Toevoegen"
              onPress={handleAdd}
              disabled={!canSubmit}
              icon={<UserPlus size={18} color={tennisColors.white} />}
              style={styles.addButton}
            />
          </View>

          <View style={styles.divider} />

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
          >
            {users.length === 0 ? (
              <Text style={styles.empty}>Nog geen gebruikers.</Text>
            ) : (
              users.map((user) => (
                <View key={user.id} style={styles.userRow}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {user.name}
                  </Text>
                  <Badge
                    label={ROLE_LABELS[user.role]}
                    color={ROLE_BADGE_COLORS[user.role]}
                    subtle={isSubtleRole(user.role)}
                  />
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28, 43, 30, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: tennisColors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: tennisColors.text,
  },
  closeButton: {
    padding: spacing.xs,
    borderRadius: radius.sm,
  },
  form: {
    backgroundColor: tennisColors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: tennisColors.border,
    padding: spacing.lg,
  },
  label: {
    ...typography.label,
    color: tennisColors.textMuted,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: tennisColors.background,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: tennisColors.text,
  },
  helper: {
    ...typography.caption,
    color: tennisColors.textMuted,
    marginTop: spacing.sm,
  },
  error: {
    color: tennisColors.danger,
    fontSize: 13,
    marginTop: spacing.md,
  },
  addButton: {
    marginTop: spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: tennisColors.border,
    marginVertical: spacing.lg,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: spacing.sm,
  },
  empty: {
    color: tennisColors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tennisColors.surface,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  userName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: tennisColors.text,
    marginRight: spacing.md,
  },
});
