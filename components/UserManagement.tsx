import React, { useState } from 'react';
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
import type { Role } from '../lib/types';
import { useSimpleData } from '../providers/SimpleDataProvider';

interface UserManagementProps {
  visible: boolean;
  onClose: () => void;
}

const ROLE_OPTIONS: ReadonlyArray<{ value: Role; label: string }> = [
  { value: 'player', label: 'Speler' },
  { value: 'parent', label: 'Ouder' },
];

const ROLE_LABELS: Record<Role, string> = {
  player: 'Speler',
  coach: 'Coach',
  parent: 'Ouder',
};

const ROLE_BADGE_COLORS: Record<Role, string> = {
  player: tennisColors.primary,
  coach: tennisColors.court,
  parent: tennisColors.clay,
};

export function UserManagement(props: UserManagementProps): JSX.Element {
  const { visible, onClose } = props;
  const { users, addUser, error } = useSimpleData();

  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<Role>('player');

  const canSubmit = name.trim().length > 0 && email.trim().length > 0;

  const handleAdd = async (): Promise<void> => {
    if (!canSubmit) {
      return;
    }
    await addUser({ name: name.trim(), email: email.trim(), role });
    setName('');
    setEmail('');
    setRole('player');
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
            <Text style={styles.title}>Spelers beheren</Text>
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

            <Text style={styles.label}>E-mail</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="E-mail"
              placeholderTextColor={tennisColors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />

            <Text style={styles.label}>Rol</Text>
            <View style={styles.chipRow}>
              {ROLE_OPTIONS.map((option) => {
                const selected = role === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setRole(option.value)}
                    style={[styles.chip, selected && styles.chipSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selected && styles.chipTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              onPress={handleAdd}
              disabled={!canSubmit}
              style={[styles.addButton, !canSubmit && styles.addButtonDisabled]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
            >
              <UserPlus size={18} color={tennisColors.white} />
              <Text style={styles.addButtonText}>Toevoegen</Text>
            </Pressable>
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
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: ROLE_BADGE_COLORS[user.role] },
                    ]}
                  >
                    <Text style={styles.badgeText}>
                      {ROLE_LABELS[user.role]}
                    </Text>
                  </View>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: tennisColors.text,
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
  },
  form: {
    backgroundColor: tennisColors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tennisColors.border,
    padding: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: tennisColors.textMuted,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: tennisColors.background,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: tennisColors.text,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.background,
  },
  chipSelected: {
    backgroundColor: tennisColors.primary,
    borderColor: tennisColors.primaryDark,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: tennisColors.text,
  },
  chipTextSelected: {
    color: tennisColors.white,
  },
  error: {
    color: tennisColors.danger,
    fontSize: 13,
    marginTop: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tennisColors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 18,
  },
  addButtonDisabled: {
    backgroundColor: tennisColors.textMuted,
    opacity: 0.6,
  },
  addButtonText: {
    color: tennisColors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: tennisColors.border,
    marginVertical: 18,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 8,
  },
  empty: {
    color: tennisColors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tennisColors.surface,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  userName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: tennisColors.text,
    marginRight: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    color: tennisColors.white,
    fontSize: 12,
    fontWeight: '700',
  },
});
