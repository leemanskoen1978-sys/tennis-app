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
import { useT } from '../lib/i18n';
import { roleLabel } from '../lib/rechten';
import type { Role } from '../lib/types';
import {
  controleerWachtwoord, gaatOverEenBestaandAccount, magVersturen, aanmeldMelding,
  BESTAAT_AL_MELDING, type Stand,
} from '../lib/wachtwoord';

/**
 * Role badge props: coach = primary, player = subtle, parent = court. De naam zelf komt uit
 * lib/rechten — dit scherm noemde een trainer eerder "Coach" terwijl de rest van de app hem
 * "Trainer" noemt, en dit is nu net het eerste scherm dat iemand ziet.
 */
function roleBadgeProps(role: Role): { label: string; color?: string; subtle?: boolean } {
  switch (role) {
    case 'coach':
      return { label: roleLabel('coach'), color: tennisColors.primaryFill };
    case 'parent':
      return { label: roleLabel('parent'), color: tennisColors.courtFill };
    case 'player':
    default:
      return { label: roleLabel('player'), subtle: true };
  }
}

/**
 * Inloggen met e-mailadres en wachtwoord — de weg zodra de club een databank heeft.
 *
 * Drie standen op één scherm: inloggen, een nieuwe login maken, en een wachtwoord
 * herstellen. Meer keuzes hoort dit scherm niet te hebben.
 *
 * Er stonden er ooit vier. Naast "eerste keer hier" — voor wie de trainer al had ingevoerd —
 * stond er "ik sta nog niet bij de club", voor wie er nog niet in stond. Dat vroeg de
 * bezoeker om iets te weten wat hij niet kán weten: of zijn adres al in de ledenlijst staat.
 * En het maakte niet uit ook, want onder water is het één handeling: `signUp` maakt de
 * login, en de trigger `link_auth_user` hangt hem aan de rij met datzelfde adres als die
 * bestaat — mét zijn lessen, zijn beurtenkaart en zijn dossier. Bestaat die rij niet, dan
 * komt er een speler bij. Eén knop dus: "Nieuwe login".
 *
 * `signUp` gooit geen fout voor een bestaand adres — dat zou verklappen wie er al lid is —
 * maar geeft de uitkomst terug (`lib/wachtwoord.ts: aanmeldUitkomst`).
 */
function WachtwoordLogin(): React.JSX.Element {
  const t = useT();
  const { signIn, signUp, stuurHerstelmail } = useSimpleData();
  const [stand, setStand] = useState<Stand>('inloggen');
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

  const klaar = magVersturen(stand, { email, wachtwoord, herhaling, naam });

  const wissel = (naarStand: Stand): void => {
    setStand(naarStand);
    setMelding(null);
    setWachtwoord('');
    setHerhaling('');
  };

  const verstuur = async (): Promise<void> => {
    if (!klaar || bezigRef.current) return;
    setMelding(null);

    if (stand === 'nieuw') {
      const klacht = controleerWachtwoord(wachtwoord, herhaling);
      if (klacht) { setMelding({ tekst: t(klacht), soort: 'fout' }); return; }
    }

    if (stand === 'vergeten') {
      bezigRef.current = true;
      setBezig(true);
      try {
        await stuurHerstelmail(email);
        // Dezelfde melding of het adres nu bestaat of niet: dat is geen vaagheid maar
        // dezelfde regel die Supabase zelf aanhoudt. Wie een adres intypt, hoort niet te
        // weten te komen wie er lid is van de club.
        setMelding({
          tekst: t('Als dit adres bij de club bekend is, staat er zo een mail in je mailbox.'),
          soort: 'goed',
        });
      } catch (e: unknown) {
        // Ook een technische misser (geen netwerk, te vaak geprobeerd) krijgt hier zijn
        // eigen melding — alleen "bestaat dit adres" blijft verborgen, niet elke fout.
        setMelding({
          tekst: e instanceof Error ? t(e.message) : t('Versturen is mislukt.'),
          soort: 'fout',
        });
      } finally {
        bezigRef.current = false;
        setBezig(false);
      }
      return;
    }

    bezigRef.current = true;
    setBezig(true);
    try {
      if (stand === 'inloggen') {
        await signIn(email, wachtwoord);
      } else {
        // De naam mag leeg zijn. Staat dit adres al in de ledenlijst, dan blijft de naam
        // die de trainer invoerde gelden — de trigger raakt hem niet aan. Is het adres
        // onbekend én de naam leeg, dan valt de databank terug op het deel vóór het
        // apenstaartje.
        const uitkomst = await signUp(email, wachtwoord, naam);
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
    : stand === 'vergeten' ? t('Herstelmail sturen')
    : t('Wachtwoord instellen');

  return (
    <View style={styles.listInner}>
      <Card>
        {stand === 'nieuw' ? (
          <>
            <Text style={styles.label}>{t('Naam (mag leeg)')}</Text>
            <TextInput
              style={styles.input}
              value={naam}
              onChangeText={setNaam}
              placeholder={t('Voor- en achternaam')}
              placeholderTextColor={tennisColors.textMuted}
              autoComplete="name"
            />
            {/* Wie al in de ledenlijst staat, hoeft hier niets: zijn naam blijft zoals de
                trainer hem invoerde. Dit veld is er voor wie nieuw is. */}
            <Text style={styles.hint}>
              {t('Staat je naam al in de ledenlijst, dan blijft die gewoon staan.')}
            </Text>
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
                if (stand === 'nieuw') {
                  herhalingRef.current?.focus();
                } else {
                  void verstuur();
                }
              }}
            />
          </>
        ) : null}

        {stand === 'nieuw' ? (
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

        {stand === 'inloggen' ? (
          <Text
            style={styles.wissel}
            accessibilityRole="button"
            accessibilityLabel={t('Nieuwe login')}
            onPress={() => wissel('nieuw')}
          >
            {t('Nieuwe login')}
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
              const badge = roleBadgeProps(u.role);
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
  // Onder een veld: uitleg die je alleen leest als je twijfelt.
  hint: { fontSize: 12, color: tennisColors.textMuted, marginTop: -4, marginBottom: 4 },
  wissel: {
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: tennisColors.primary,
  },
});
