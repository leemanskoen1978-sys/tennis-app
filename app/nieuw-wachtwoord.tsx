import React, { useState } from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { useT } from '../lib/i18n';
import { controleerWachtwoord, magNieuwWachtwoordVersturen } from '../lib/wachtwoord';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, typography } from '../constants/theme';

/**
 * Kies een nieuw wachtwoord, na een klik op de link uit een herstelmail.
 *
 * Dit scherm bestaat apart en niet als vijfde stand op het loginscherm, omdat je hier ál
 * ingelogd bent: de link opende een sessie. Zonder eigen scherm zou de indeling je meteen
 * naar de hub sturen en was je de volgende keer weer buiten, zonder ooit een wachtwoord te
 * hebben gekozen.
 */
export default function NieuwWachtwoord(): React.JSX.Element {
  const t = useT();
  const { zetNieuwWachtwoord, logout } = useSimpleData();
  const [wachtwoord, setWachtwoord] = useState<string>('');
  const [herhaling, setHerhaling] = useState<string>('');
  const [melding, setMelding] = useState<string | null>(null);
  const [bezig, setBezig] = useState<boolean>(false);

  const verstuur = async (): Promise<void> => {
    if (bezig) return;
    const klacht = controleerWachtwoord(wachtwoord, herhaling);
    if (klacht) { setMelding(t(klacht)); return; }
    setBezig(true);
    setMelding(null);
    try {
      // De provider zet de herstelvlag uit; de indeling brengt je daarna vanzelf naar de hub.
      await zetNieuwWachtwoord(wachtwoord);
    } catch (e: unknown) {
      // Dezelfde vertaalstap als op het loginscherm: de melding komt Nederlands terug uit
      // `loginMessage` en gaat pas hier, waar hij getoond wordt, door `t()`.
      setMelding(e instanceof Error ? t(e.message) : t('Het wachtwoord instellen is mislukt.'));
    } finally {
      setBezig(false);
    }
  };

  return (
    <Screen reading>
      <Card>
        <Text style={styles.kop}>{t('Kies een nieuw wachtwoord')}</Text>
        <Text style={styles.uitleg}>
          {t('Je bent binnen via de link uit je mail. Kies hier je nieuwe wachtwoord.')}
        </Text>

        <Text style={styles.label}>{t('Nieuw wachtwoord')}</Text>
        <TextInput
          style={styles.input}
          value={wachtwoord}
          onChangeText={setWachtwoord}
          placeholder={t('Minstens zes tekens')}
          placeholderTextColor={tennisColors.textMuted}
          secureTextEntry
          autoComplete="new-password"
        />

        <Text style={styles.label}>{t('Wachtwoord nog eens')}</Text>
        <TextInput
          style={styles.input}
          value={herhaling}
          onChangeText={setHerhaling}
          placeholder={t('Dezelfde als hierboven')}
          placeholderTextColor={tennisColors.textMuted}
          secureTextEntry
          autoComplete="new-password"
          onSubmitEditing={() => { void verstuur(); }}
        />

        {melding ? <Text style={styles.melding}>{melding}</Text> : null}

        <Button
          label={bezig ? t('Bezig…') : t('Wachtwoord opslaan')}
          variant="primary"
          disabled={bezig || !magNieuwWachtwoordVersturen(wachtwoord, herhaling)}
          onPress={() => { void verstuur(); }}
          style={styles.knop}
        />

        {/* De uitweg voor wie hier niets meer mee wil, of wiens sessie is weggevallen (een
            verlopen token bijvoorbeeld): uitloggen zet de herstelvlag zelf uit, via dezelfde
            `onAuthChange` die ook een gewone uitlog-actie afhandelt. */}
        <Text
          style={styles.terug}
          accessibilityRole="button"
          accessibilityLabel={t('Terug naar inloggen')}
          onPress={() => { void logout(); }}
        >
          {t('Terug naar inloggen')}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kop: { ...typography.h3, color: tennisColors.text },
  uitleg: {
    fontSize: 14,
    color: tennisColors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: tennisColors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: tennisColors.background,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: tennisColors.text,
  },
  melding: { marginTop: spacing.md, fontSize: 14, color: tennisColors.danger },
  knop: { marginTop: spacing.lg },
  terug: {
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: tennisColors.primary,
  },
});
