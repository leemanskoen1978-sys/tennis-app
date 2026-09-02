import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Save } from 'lucide-react-native';
import { Chip } from './ui/Chip';
import { Button } from './ui/Button';
import { DetailSheet } from './ui/DetailSheet';
import { useT } from '../lib/i18n';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, typography, radius } from '../constants/theme';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { isAdmin } from '../lib/rechten';
import { DAY_LABELS } from '../lib/slots';
import type { User } from '../lib/types';

/** Reading order for the day toggles: Monday first, Sunday last. Values stay getDay(). */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * A coach edits their own details. Only ever opened for the logged-in coach — the caller
 * decides that; this sheet does not check it a second time.
 */
export function CoachDetailsModal({
  coach, visible, onClose,
}: {
  coach: User;
  visible: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const { currentUser, updateUser } = useSimpleData();

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [rate, setRate] = useState('');

  // Refill from the stored coach every time the sheet opens, so a cancelled edit
  // does not leak into the next one.
  useEffect(() => {
    if (!visible) return;
    setEmail(coach.email);
    setPhone(coach.phone ?? '');
    setDays(coach.working_days ?? []);
    setRate(coach.hourly_rate !== undefined ? String(coach.hourly_rate) : '');
  }, [visible, coach]);

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const parsedRate = Number(rate.replace(',', '.'));
  const rateOk = rate.trim() === '' || (Number.isFinite(parsedRate) && parsedRate >= 0);
  const canSave = email.trim().length > 0 && rateOk;

  // Zijn eigen tarief zetten mag een trainer niet: het is wat de club hem uitbetaalt, en
  // wie het zelf kan zetten kan zijn eigen loon verhogen. Beheer → gebruikers doet dit. De
  // databank denkt er hetzelfde over (`rates_write`), dus het veld hier laten staan zou
  // alleen een foutmelding opleveren bij het opslaan.
  const magTarief = isAdmin(currentUser);

  const save = async () => {
    if (!canSave) return;
    await updateUser(coach.id, {
      email: email.trim(),
      phone: phone.trim() || undefined,
      working_days: days.length > 0 ? [...days].sort((a, b) => a - b) : undefined,
      // Alleen meesturen als het veld er stond; anders zou een trainer die zijn nummer
      // bijwerkt zijn eigen tarief "opnieuw zetten" en daarop stuklopen.
      ...(magTarief ? { hourly_rate: rate.trim() === '' ? undefined : parsedRate } : {}),
    });
    onClose();
  };

  return (
    <DetailSheet title={t('Mijn gegevens')} visible={visible} onClose={onClose}>
      <Text style={styles.label}>{t('E-mailadres')}</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder={t('naam@club.be')}
        placeholderTextColor={tennisColors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text style={styles.label}>{t('Gsm')}</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder={t('0470 12 34 56')}
        placeholderTextColor={tennisColors.textMuted}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>{t('Lesdagen')}</Text>
      <View style={styles.chipRow}>
        {DAY_ORDER.map((d) => (
          <Chip
            key={d}
            label={t(DAY_LABELS[d])}
            selected={days.includes(d)}
            onPress={() => toggleDay(d)}
          />
        ))}
      </View>
      <Text style={styles.helper}>
        Niets aangevinkt betekent: elke dag beschikbaar.
      </Text>

      {/* De lesuren stonden hier ooit ook, maar dan begrensd door de tijd van de club: wie
          tot tien uur 's avonds lesgaf, kon dat niet invullen. Ze wonen nu op een eigen
          scherm, samen met de periodes waarin ze afwijken. Twee plekken die hetzelfde veld
          zetten met verschillende regels is erger dan één klik extra. */}
      <Text style={styles.label}>{t('Boekingstijden')}</Text>
      <Text style={styles.helper}>
        {t('Tussen welke uren er bij jou geboekt kan worden — en de periodes waarin dat '
          + 'anders is — staat op een eigen scherm.')}
      </Text>
      <Button
        label={t('Naar boekingstijden')}
        variant="secondary"
        fullWidth={false}
        onPress={() => {
          onClose();
          router.push('/admin/boekingstijden');
        }}
      />

      {magTarief ? (
        <>
          <Text style={styles.label}>{t('Uurtarief (€)')}</Text>
          <TextInput
            style={styles.input}
            value={rate}
            onChangeText={setRate}
            placeholder="45"
            placeholderTextColor={tennisColors.textMuted}
            keyboardType="decimal-pad"
          />
          {!rateOk ? (
            <Text style={styles.error}>{t('Vul een getal in, of laat leeg.')}</Text>
          ) : null}
        </>
      ) : null}

      <Button
        label={t('Opslaan')}
        variant="primary"
        icon={<Save size={18} color={tennisColors.onFill} />}
        disabled={!canSave}
        onPress={() => { void save(); }}
        style={styles.saveButton}
      />
    </DetailSheet>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.label, color: tennisColors.textMuted,
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: tennisColors.surface,
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: 15, color: tennisColors.text,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  helper: { ...typography.caption, color: tennisColors.textMuted, marginTop: spacing.sm },
  error: { color: tennisColors.danger, fontSize: 13, marginTop: spacing.sm },
  saveButton: { marginTop: spacing.xl },
});
