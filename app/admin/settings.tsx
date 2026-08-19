// Systeeminstellingen — verhuisd uit Profiel. Boekingseindtijd, thema, taal en de
// noodopruiming gaan over de club en het systeem, niet over jouw persoonsgegevens.
//
// LET OP: de "Noodopruiming" (emergencyCleanup) is de ENIGE plek waar data
// onherstelbaar verwijderd wordt. Deze actie wordt ALTIJD eerst bevestigd
// via confirmDanger() en gebeurt NOOIT automatisch.

import React from 'react';
import { Platform, Alert, View, Text, StyleSheet } from 'react-native';
import { Trash2, Clock, Globe, Moon } from 'lucide-react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { spacing, typography } from '../../constants/theme';
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

const BOOKING_END_TIMES: readonly string[] = ['18:00', '19:00', '20:00', '21:00', '22:00'];

const THEME_OPTIONS: ReadonlyArray<{ value: 'light' | 'dark'; label: string }> = [
  { value: 'light', label: 'Licht' },
  { value: 'dark', label: 'Donker' },
];

const LANGUAGE_OPTIONS: ReadonlyArray<{ value: 'nl' | 'en'; label: string }> = [
  { value: 'nl', label: 'Nederlands' },
  { value: 'en', label: 'Engels' },
];

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }): React.JSX.Element {
  return (
    <View style={styles.sectionHeader}>
      {icon}
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

export default function SettingsScreen(): React.JSX.Element {
  const { settings, saveSettings, emergencyCleanup } = useSimpleData();

  const update = (patch: Partial<Settings>): void => {
    void saveSettings({ ...settings, ...patch });
  };

  return (
    <Screen>
      <Card>
        <SectionHeader icon={<Clock size={18} color={tennisColors.primary} />} title="Eindtijd reserveringen" />
        <Text style={styles.helpText}>Tot welk uur kunnen reserveringen worden gemaakt.</Text>
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
      </Card>

      <Card>
        <SectionHeader icon={<Moon size={18} color={tennisColors.primary} />} title="Thema" />
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
      </Card>

      <Card>
        <SectionHeader icon={<Globe size={18} color={tennisColors.primary} />} title="Taal" />
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
      </Card>

      <Text style={styles.dangerTitle}>Gevarenzone</Text>
      <Card>
        <Text style={styles.helpText}>
          Zet alle gegevens terug naar de begininstellingen en logt je uit.
          Gebruik dit alleen als de app niet meer normaal werkt.
        </Text>
        <Button
          label="Noodopruiming"
          variant="danger"
          icon={<Trash2 size={18} color={tennisColors.white} />}
          onPress={() =>
            confirmDanger(
              'Weet je het zeker? Dit zet alle gegevens terug naar de begininstellingen en je wordt uitgelogd.',
              () => {
                void emergencyCleanup();
              },
            )
          }
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionHeaderText: { fontSize: 16, fontWeight: '600', color: tennisColors.text },
  helpText: { fontSize: 13, color: tennisColors.textMuted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  dangerTitle: {
    ...typography.h2, color: tennisColors.danger, marginTop: spacing.xl, marginBottom: spacing.xs,
  },
});
