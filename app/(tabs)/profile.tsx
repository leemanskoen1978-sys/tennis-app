// Profiel-scherm — toont gebruiker en instellingen.
//
// LET OP: de "Noodopruiming" (emergencyCleanup) is de ENIGE plek waar data
// onherstelbaar verwijderd wordt. Deze actie wordt ALTIJD eerst bevestigd
// via confirmDanger() en gebeurt NOOIT automatisch.

import React from 'react';
import {
  Platform,
  Alert,
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { LogOut, Trash2, Clock, Globe, Moon } from 'lucide-react-native';

import { tennisColors } from '../../constants/tennis-colors';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import type { Settings } from '../../lib/types';

function confirmDanger(message: string, onYes: () => void): void {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onYes();
    return;
  }
  Alert.alert('Bevestigen', message, [
    { text: 'Annuleren', style: 'cancel' },
    { text: 'Verwijderen', style: 'destructive', onPress: onYes },
  ]);
}

const BOOKING_END_TIMES: readonly string[] = [
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
];

const THEME_OPTIONS: ReadonlyArray<{ value: 'light' | 'dark'; label: string }> = [
  { value: 'light', label: 'Licht' },
  { value: 'dark', label: 'Donker' },
];

const LANGUAGE_OPTIONS: ReadonlyArray<{ value: 'nl' | 'en'; label: string }> = [
  { value: 'nl', label: 'Nederlands' },
  { value: 'en', label: 'Engels' },
];

const ROLE_LABELS: Record<string, string> = {
  player: 'Speler',
  coach: 'Coach',
  parent: 'Ouder',
};

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function Chip({ label, selected, onPress }: ChipProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : null]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
}

function SectionHeader({ icon, title }: SectionHeaderProps): React.JSX.Element {
  return (
    <View style={styles.sectionHeader}>
      {icon}
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

export default function ProfileScreen(): React.JSX.Element {
  const { currentUser, settings, saveSettings, logout, emergencyCleanup } =
    useSimpleData();

  const update = (patch: Partial<Settings>): void => {
    const next: Settings = { ...settings, ...patch };
    void saveSettings(next);
  };

  const roleLabel: string = currentUser
    ? ROLE_LABELS[currentUser.role] ?? currentUser.role
    : '';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Profiel</Text>

      {/* Gebruikersinformatie */}
      <View style={styles.card}>
        {currentUser ? (
          <>
            <Text style={styles.userName}>{currentUser.name}</Text>
            <Text style={styles.userEmail}>{currentUser.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.userEmail}>Niet ingelogd</Text>
        )}
      </View>

      {/* Instellingen */}
      <Text style={styles.sectionTitle}>Instellingen</Text>

      <View style={styles.card}>
        <SectionHeader
          icon={<Clock size={18} color={tennisColors.primary} />}
          title="Eindtijd reserveringen"
        />
        <Text style={styles.helpText}>
          Tot welk uur kunnen reserveringen worden gemaakt.
        </Text>
        <View style={styles.chipRow}>
          {BOOKING_END_TIMES.map((value) => (
            <Chip
              key={value}
              label={value}
              selected={settings.booking_end_time === value}
              onPress={() => update({ booking_end_time: value })}
            />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <SectionHeader
          icon={<Moon size={18} color={tennisColors.primary} />}
          title="Thema"
        />
        <View style={styles.chipRow}>
          {THEME_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              selected={settings.theme === opt.value}
              onPress={() => update({ theme: opt.value })}
            />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <SectionHeader
          icon={<Globe size={18} color={tennisColors.primary} />}
          title="Taal"
        />
        <View style={styles.chipRow}>
          {LANGUAGE_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              selected={settings.language === opt.value}
              onPress={() => update({ language: opt.value })}
            />
          ))}
        </View>
      </View>

      {/* Uitloggen */}
      <Pressable
        style={styles.logoutButton}
        onPress={() => {
          void logout();
        }}
        accessibilityRole="button"
      >
        <LogOut size={18} color={tennisColors.white} />
        <Text style={styles.logoutButtonText}>Uitloggen</Text>
      </Pressable>

      {/* Gevarenzone */}
      <Text style={styles.dangerTitle}>Gevarenzone</Text>
      <View style={styles.dangerCard}>
        <Text style={styles.dangerHelp}>
          Verwijdert onherstelbaar corrupte data. Gebruik dit alleen als de app
          niet meer normaal werkt.
        </Text>
        <Pressable
          style={styles.dangerButton}
          onPress={() =>
            confirmDanger(
              'Weet je het zeker? Dit verwijdert onherstelbaar corrupte data.',
              () => {
                void emergencyCleanup();
              },
            )
          }
          accessibilityRole="button"
        >
          <Trash2 size={18} color={tennisColors.white} />
          <Text style={styles.dangerButtonText}>Noodopruiming</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tennisColors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: tennisColors.text,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tennisColors.text,
    marginTop: 12,
    marginBottom: 2,
  },
  card: {
    backgroundColor: tennisColors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: tennisColors.border,
    gap: 8,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: tennisColors.text,
  },
  userEmail: {
    fontSize: 14,
    color: tennisColors.textMuted,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: tennisColors.accent,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: tennisColors.primaryDark,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: tennisColors.text,
  },
  helpText: {
    fontSize: 13,
    color: tennisColors.textMuted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.background,
  },
  chipSelected: {
    backgroundColor: tennisColors.primary,
    borderColor: tennisColors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: tennisColors.text,
  },
  chipTextSelected: {
    color: tennisColors.white,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: tennisColors.court,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: tennisColors.white,
  },
  dangerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tennisColors.danger,
    marginTop: 20,
    marginBottom: 2,
  },
  dangerCard: {
    backgroundColor: tennisColors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: tennisColors.danger,
    gap: 12,
  },
  dangerHelp: {
    fontSize: 13,
    color: tennisColors.textMuted,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: tennisColors.danger,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: tennisColors.white,
  },
});
