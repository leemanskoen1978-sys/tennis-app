import React, { useRef, useState } from 'react';
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
import {
  controleerWachtwoord, gaatOverEenBestaandAccount, magVersturen, aanmeldMelding,
  BESTAAT_AL_MELDING, type Stand,
} from '../lib/wachtwoord';

/** De vier standen van het loginscherm; 'vergeten' bestaat alleen op het scherm zelf (een
 *  e-mailadres versturen kent geen "klaar om te versturen"-regel die getest hoeft te worden). */
type SchermStand = Stand | 'vergeten';

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
 *
 * `signUp` gooit geen fout meer voor een bestaand adres — dat zou verklappen wie er al lid
 * is — maar geeft de uitkomst terug (`lib/wachtwoord.ts: aanmeldUitkomst`). Dit scherm kiest
 * daarop dezelfde melding voor "eerste keer hier" én "ik sta nog niet bij de club", zodat
 * wie de verkeerde knop koos niet een ander antwoord krijgt dan wie de juiste koos.
 */
function WachtwoordLogin(): React.JSX.Element {
  const t = useT();
  const { signIn, signUp, stuurHerstelmail } = useSimpleData();
  const [stand, setStand] = useState<SchermStand>('inloggen');
  const [email, setEmail] = useState<string>('');
  const [wachtwoord, setWachtwoord] = useState<string>('');
  const [herhaling, setHerhaling] = useState<string>('');
  const [naam, setNaam] = useState<string>('');
  const [melding, setMelding] = useState<{ tekst: string; soort: 'fout' | 'goed' } | null>(null);
  const [bezig, setBezig] = useState<boolean>(false);
  // Naast `bezig` (voor de knop): twee Enters vlak na elkaar zien allebei nog de oude
  // `bezig`-state uit de closure vóór React hem bijwerkt. Deze ref is meteen up-to-date.
  const bezigRef = useRef<boolean>(false);
  const herhalingRef = useRef<TextInput>(null);

  // "Vergeten" vraagt alleen een e-mailadres; de wachtwoordregels van `magVersturen` gaan
  // daar niet over.
  const klaar = stand === 'vergeten'
    ? email.trim().length > 0
    : magVersturen(stand, { email, wachtwoord, herhaling, naam });

  const wissel = (naarStand: SchermStand): void => {
    setStand(naarStand);
    setMelding(null);
    setHerhaling('');
  };

  const verstuur = async (): Promise<void> => {
    if (!klaar || bezigRef.current) return;
    setMelding(null);

    if (stand === 'eerste') {
      const klacht = controleerWachtwoord(wachtwoord, herhaling);
      if (klacht) { setMelding({ tekst: t(klacht), soort: 'fout' }); return; }
    }

    if (stand === 'vergeten') {
      bezigRef.current = true;
      setBezig(true);
      try {
        await stuurHerstelmail(email);
      } catch (e: unknown) {
        // Ook een technische misser (geen netwerk, te vaak geprobeerd) krijgt hier zijn
        // eigen melding — alleen "bestaat dit adres" blijft verborgen, niet elke fout.
        setMelding({
          tekst: e instanceof Error ? t(e.message) : t('Versturen is mislukt.'),
          soort: 'fout',
        });
        bezigRef.current = false;
        setBezig(false);
        return;
      }
      bezigRef.current = false;
      setBezig(false);
      // Dezelfde melding of het adres nu bestaat of niet: dat is geen vaagheid maar dezelfde
      // regel die Supabase zelf aanhoudt. Wie een adres intypt, hoort niet te weten te komen
      // wie er lid is van de club.
      setMelding({
        tekst: t('Als dit adres bij de club bekend is, staat er zo een mail in je mailbox.'),
        soort: 'goed',
      });
      return;
    }

    bezigRef.current = true;
    setBezig(true);
    try {
      if (stand === 'inloggen') {
        await signIn(email, wachtwoord);
      } else {
        // Geen naam bij "eerste": die staat al in de ledenlijst en hoort van de trainer te
        // blijven. Is dit adres onbekend, dan valt de databank terug op het deel vóór het
        // apenstaartje.
        const uitkomst = await signUp(email, wachtwoord, stand === 'eerste' ? '' : naam);
        const tekst = aanmeldMelding(uitkomst);
        if (tekst) setMelding({ tekst: t(tekst), soort: 'goed' });
        if (uitkomst === 'bestaat-al') setStand('inloggen');
        // Geen sessie nodig om verder te komen ("bevestig-je-mail"/"bestaat-al"): het
        // wachtwoord blijft leeg staan, anders levert nog eens klikken een tweede mail op.
        setWachtwoord('');
        setHerhaling('');
      }
    } catch (e: unknown) {
      const ruw = e instanceof Error ? e.message : '';
      // De belangrijkste fout van dit scherm: iemand die vorig seizoen al een wachtwoord
      // koos en dat vergeten is. Die hoort geen Engelse databankmelding te lezen. Dit is een
      // vangnet: normaal meldt `signUp` dit via de uitkomst hierboven, niet via een fout.
      if (stand !== 'inloggen' && gaatOverEenBestaandAccount(ruw)) {
        setMelding({ tekst: t(BESTAAT_AL_MELDING), soort: 'goed' });
        setStand('inloggen');
        setWachtwoord('');
        setHerhaling('');
      } else {
        // `ruw` is de Nederlandse zin uit `loginMessage` (providers/supabaseStore.ts) — die
        // gaat, net als elke andere tekst op dit scherm, door `t()` om ook in het Engels te
        // kunnen luiden.
        setMelding({ tekst: ruw ? t(ruw) : t('Inloggen mislukt.'), soort: 'fout' });
      }
    } finally {
      bezigRef.current = false;
      setBezig(false);
    }
  };

  const knopLabel = stand === 'inloggen'
    ? t('Inloggen')
    : stand === 'eerste' ? t('Wachtwoord instellen')
    : stand === 'vergeten' ? t('Herstelmail sturen') : t('Account aanmaken');

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
          onSubmitEditing={stand === 'vergeten' ? () => { void verstuur(); } : undefined}
        />

        {stand !== 'vergeten' ? (
          <>
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
                // Bij "eerste" staat de herhaling nog leeg: Enter springt daarheen in plaats
                // van stil niets te doen (de knop is dan nog grijs, zonder dat te verklaren).
                if (stand === 'eerste') {
                  herhalingRef.current?.focus();
                } else {
                  void verstuur();
                }
              }}
            />
          </>
        ) : null}

        {stand === 'eerste' ? (
          <>
            {/* Twee keer, want een typefout hier sluit je buiten zonder weg terug. */}
            <Text style={styles.label}>{t('Wachtwoord nog eens')}</Text>
            <TextInput
              ref={herhalingRef}
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

        {melding ? (
          <Text style={melding.soort === 'fout' ? styles.melding : styles.meldingGoed}>
            {melding.tekst}
          </Text>
        ) : null}

        <Button
          label={knopLabel}
          variant="primary"
          disabled={!klaar || bezig}
          onPress={() => {
            void verstuur();
          }}
          style={styles.knop}
        />

        {stand !== 'eerste' && stand !== 'vergeten' ? (
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

        {stand !== 'aanmelden' && stand !== 'vergeten' ? (
          <Text
            style={styles.wissel}
            accessibilityRole="button"
            accessibilityLabel={t('Ik sta nog niet bij de club')}
            onPress={() => wissel('aanmelden')}
          >
            {t('Ik sta nog niet bij de club')}
          </Text>
        ) : null}

        {stand === 'inloggen' ? (
          <Text
            style={styles.wissel}
            accessibilityRole="button"
            accessibilityLabel={t('Wachtwoord vergeten?')}
            onPress={() => wissel('vergeten')}
          >
            {t('Wachtwoord vergeten?')}
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
  // Zelfde plek als `melding`, maar in het groen: "Bijna klaar, kijk in je mailbox" is geen
  // fout, en hoort niet naast een knop met "Inloggen" te lezen als een mislukking.
  meldingGoed: {
    marginTop: spacing.md,
    fontSize: 14,
    color: tennisColors.success,
    fontWeight: '600',
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
