import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { User as UserIcon } from 'lucide-react-native';
import { tennisColors } from '../constants/tennis-colors';
import { appConfig } from '../constants/app-config';
import { spacing, typography, minTapTarget } from '../constants/theme';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { useT, type Translate } from '../lib/i18n';
import { controleerWachtwoord, gaatOverEenBestaandAccount } from '../lib/wachtwoord';

type Role = 'player' | 'coach' | 'parent';

const ROLE_LABELS: Record<Role, string> = {
  coach: 'Coach',
  player: 'Speler',
  parent: 'Ouder',
};

/** Role badge props: coach = primary, player = subtle, parent = court. */
function roleBadgeProps(t: Translate, role: string): { label: string; color?: string; subtle?: boolean } {
  switch (role) {
    case 'coach':
      return { label: t(ROLE_LABELS.coach), color: tennisColors.primaryFill };
    case 'parent':
      return { label: t(ROLE_LABELS.parent), color: tennisColors.courtFill };
    case 'player':
    default:
      return { label: t(ROLE_LABELS.player ?? role), subtle: true };
  }
}

/**
 * Inloggen met e-mailadres en wachtwoord — de weg zodra de club een databank heeft.
 *
 * Drie standen op één scherm, en dat is met opzet. Een speler die de trainer al heeft
 * ingevoerd, bestáát: hij heeft lessen, een beurtenkaart en een dossier, en mist alleen nog
 * een wachtwoord. "Maak een account aan" is voor hem een leugen en "eerste keer hier" niet.
 * Onder water is het hetzelfde: `signUp` maakt de login, en de trigger `link_auth_user` in
 * de databank hangt hem aan de rij met datzelfde adres.
 */
type Stand = 'inloggen' | 'eerste' | 'aanmelden';

function WachtwoordLogin(): React.JSX.Element {
  const t = useT();
  const { signIn, signUp } = useSimpleData();
  const [stand, setStand] = useState<Stand>('inloggen');
  const [email, setEmail] = useState<string>('');
  const [wachtwoord, setWachtwoord] = useState<string>('');
  const [herhaling, setHerhaling] = useState<string>('');
  const [naam, setNaam] = useState<string>('');
  const [melding, setMelding] = useState<string | null>(null);
  const [bezig, setBezig] = useState<boolean>(false);

  const klaar = email.trim().length > 0 && wachtwoord.length > 0
    && (stand !== 'aanmelden' || naam.trim().length > 0)
    && (stand !== 'eerste' || herhaling.length > 0);

  const wissel = (naarStand: Stand): void => {
    setStand(naarStand);
    setMelding(null);
    setHerhaling('');
  };

  const verstuur = async (): Promise<void> => {
    if (!klaar || bezig) return;
    setMelding(null);

    if (stand === 'eerste') {
      const klacht = controleerWachtwoord(wachtwoord, herhaling);
      if (klacht) { setMelding(t(klacht)); return; }
    }

    setBezig(true);
    try {
      if (stand === 'inloggen') {
        await signIn(email, wachtwoord);
      } else if (stand === 'eerste') {
        // Geen naam: die staat al in de ledenlijst en hoort van de trainer te blijven.
        // Is dit adres onbekend, dan valt de databank terug op het deel vóór het apenstaartje.
        await signUp(email, wachtwoord, '');
        setMelding(t('Klaar. Log in met je nieuwe wachtwoord.'));
        setStand('inloggen');
      } else {
        await signUp(email, wachtwoord, naam);
        // Staat "bevestig je e-mailadres" aan in Supabase, dan gebeurt er nu nog niets
        // zichtbaars; zonder dit bericht lijkt de knop kapot.
        setMelding(t('Account aangemaakt. Kijk in je mailbox als er om bevestiging gevraagd wordt.'));
      }
    } catch (e: unknown) {
      const ruw = e instanceof Error ? e.message : '';
      // De belangrijkste fout van dit scherm: iemand die vorig seizoen al een wachtwoord
      // koos en dat vergeten is. Die hoort geen Engelse databankmelding te lezen.
      setMelding(
        stand !== 'inloggen' && gaatOverEenBestaandAccount(ruw)
          ? t('Er bestaat al een wachtwoord voor dit adres. Log gewoon in.')
          : (ruw || t('Inloggen mislukt.')),
      );
    } finally {
      setBezig(false);
    }
  };

  const knopLabel = stand === 'inloggen'
    ? t('Inloggen')
    : stand === 'eerste' ? t('Wachtwoord instellen') : t('Account aanmaken');

  return (
    <View style={styles.listInner}>
      <Card>
        {stand === 'aanmelden' ? (
          <>
            <Text style={styles.label}>{t('Naam')}</Text>
            <TextInput
              style={styles.input}
              value={naam}
              onChangeText={setNaam}
              placeholder={t('Voor- en achternaam')}
              placeholderTextColor={tennisColors.textMuted}
              autoComplete="name"
            />
          </>
        ) : null}

        <Text style={styles.label}>{t('E-mailadres')}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder={t('jij@voorbeeld.be')}
          placeholderTextColor={tennisColors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <Text style={styles.label}>{t('Wachtwoord')}</Text>
        <TextInput
          style={styles.input}
          value={wachtwoord}
          onChangeText={setWachtwoord}
          placeholder={t('Minstens zes tekens')}
          placeholderTextColor={tennisColors.textMuted}
          secureTextEntry
          autoComplete={stand === 'inloggen' ? 'current-password' : 'new-password'}
          onSubmitEditing={() => {
            void verstuur();
          }}
        />

        {stand === 'eerste' ? (
          <>
            {/* Twee keer, want een typefout hier sluit je buiten zonder weg terug. */}
            <Text style={styles.label}>{t('Wachtwoord nog eens')}</Text>
            <TextInput
              style={styles.input}
              value={herhaling}
              onChangeText={setHerhaling}
              placeholder={t('Dezelfde als hierboven')}
              placeholderTextColor={tennisColors.textMuted}
              secureTextEntry
              autoComplete="new-password"
              onSubmitEditing={() => {
                void verstuur();
              }}
            />
          </>
        ) : null}

        {melding ? <Text style={styles.melding}>{melding}</Text> : null}

        <Button
          label={knopLabel}
          variant="primary"
          disabled={!klaar || bezig}
          onPress={() => {
            void verstuur();
          }}
          style={styles.knop}
        />

        {stand !== 'eerste' ? (
          <Text
            style={styles.wissel}
            accessibilityRole="button"
            accessibilityLabel={t('Eerste keer hier? Stel je wachtwoord in')}
            onPress={() => wissel('eerste')}
          >
            {t('Eerste keer hier? Stel je wachtwoord in')}
          </Text>
        ) : null}

        {stand !== 'inloggen' ? (
          <Text
            style={styles.wissel}
            accessibilityRole="button"
            accessibilityLabel={t('Ik heb al een account')}
            onPress={() => wissel('inloggen')}
          >
            {t('Ik heb al een account')}
          </Text>
        ) : null}

        {stand !== 'aanmelden' ? (
          <Text
            style={styles.wissel}
            accessibilityRole="button"
            accessibilityLabel={t('Ik sta nog niet bij de club')}
            onPress={() => wissel('aanmelden')}
          >
            {t('Ik sta nog niet bij de club')}
          </Text>
        ) : null}
      </Card>
    </View>
  );
}

export default function Login(): React.JSX.Element {
  const t = useT();
  const { users, login, error, currentUser, authMode } = useSimpleData();

  // Once logged in, leave the login screen for the hub.
  if (currentUser) return <Redirect href="/" />;

  const handleLogin = (userId: string): void => {
    // Root layout auto-redirects na succesvolle login — geen handmatige navigatie.
    void login(userId);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[tennisColors.primaryFill, tennisColors.primaryFillDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.title}>{appConfig.name}</Text>
        <Text style={styles.subtitle}>
          {authMode === 'wachtwoord' ? t('Log in om verder te gaan') : t('Kies je profiel om te starten')}
        </Text>
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
        {authMode === 'wachtwoord' ? <WachtwoordLogin /> : (
        <View style={styles.listInner}>
          {users.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('Geen gebruikers gevonden.')}</Text>
            </View>
          ) : (
            users.map((u) => {
              const badge = roleBadgeProps(t, u.role);
              return (
                <Card
                  key={u.id}
                  onPress={() => handleLogin(u.id)}
                  accessibilityLabel={t('Log in als {naam}', { naam: u.name })}
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
    color: tennisColors.onFill,
    letterSpacing: 0.3,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 16,
    color: tennisColors.onFill,
    opacity: 0.9,
  },
  errorBox: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: tennisColors.dangerTint,
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
  melding: {
    marginTop: spacing.md,
    fontSize: 14,
    color: tennisColors.danger,
  },
  knop: { marginTop: spacing.lg },
  wissel: {
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: tennisColors.primary,
  },
});
