import React, { useEffect } from 'react';
import { Stack, Redirect, useSegments } from 'expo-router';
import { ThemeProvider, DefaultTheme, type Theme } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import { SimpleDataProvider, useSimpleData } from '../providers/SimpleDataProvider';
import { MenuBar } from '../components/ui/MenuBar';
import { TabBar } from '../components/ui/TabBar';
import { AppBackground } from '../components/ui/AppBackground';
import { tennisColors } from '../constants/tennis-colors';
import { applyThemeMode, rememberedThemeMode } from '../lib/theme-mode';
import { LanguageProvider, useT, type Translate } from '../lib/i18n';

// Nog vóór er iets getekend wordt: het thema van de vorige keer. De echte keuze staat in de
// instellingen van de club en komt pas mee met de databank; zonder deze regel zie je bij
// elke start eerst een wit scherm dat daarna omslaat naar donker.
applyThemeMode(rememberedThemeMode() ?? 'light');

// One plain stack. Bovenin staat de MenuBar (naam, terug, profiel), onderin de TabBar met
// de secties — daar is op een telefoon je duim al. De stack zit ertussen; de stack header
// zegt alleen waar je bent.
//
// The stack's own back arrow is off: it disappears when the history is empty — after a
// deep link or a page reload on the web — and then the screen had no way out at all. The
// MenuBar does not depend on history.
const headerBase = {
  headerShown: true,
  headerTintColor: tennisColors.primary,
  headerStyle: { backgroundColor: 'transparent' },
  contentStyle: { backgroundColor: 'transparent' },
  headerTitleStyle: { color: tennisColors.text },
  headerBackVisible: false,
  headerLeft: () => null,
  headerShadowVisible: false,
} as const;

// Wie het scherm ook opent, de tabbalk zegt al "Agenda" / "Spelers" / "Trainers" / "Beheer";
// een kop met precies dezelfde tekst erboven is dan alleen nog verspilde ruimte. Dieper dan
// dat hoofdscherm is de kop juist het enige dat nog zegt waar je bent, dus die blijft staan.
//
// agenda/new en coaches/lessons zijn voor een speler wél een eigen tabblad (Reserveren,
// Mijn lessen) maar voor een trainer een scherm ónder Agenda resp. Trainers. De titel op die
// schermen ("Nieuwe afspraak", "Lesmateriaal") is geen letterlijke herhaling van het tabblad
// waar hij vandaan komt, en een trainer heeft daar juist wél houvast aan nodig — dus de kop
// blijft op deze twee staan, voor beide rollen.
const HEADLESS = new Set([
  'agenda/index',
  'players/index',
  'players/progress',
  'coaches/index',
  'admin/index',
]);

/** Screens in the order of the hub: Agenda, Spelers, Trainers, Beheer. */
const screens = (t: Translate): ReadonlyArray<{ name: string; title: string }> => [
  { name: 'profile', title: t('Profiel') },
  { name: 'agenda/index', title: t('Agenda') },
  { name: 'agenda/new', title: t('Nieuwe afspraak') },
  { name: 'agenda/overzicht', title: t('Overzicht') },
  { name: 'agenda/historiek', title: t('Historiek') },
  { name: 'agenda/komend', title: t('Nog te komen') },
  { name: 'players/index', title: t('Spelers') },
  { name: 'players/[id]', title: t('Speler-dossier') },
  // Geen trainer bereikt dit scherm — een voortgangsverslag over een speler vult een
  // trainer in via de kaart in het spelersdossier. Hier komt alleen een speler, via het
  // tabblad Voortgang, dus de kop zou letterlijk herhalen wat die tab al zegt.
  { name: 'players/progress', title: t('Voortgang') },
  { name: 'coaches/index', title: t('Trainers') },
  { name: 'coaches/[id]', title: t('Trainer-dossier') },
  { name: 'coaches/lessons/index', title: t('Lesmateriaal') },
  { name: 'coaches/lessons/new', title: t('Nieuw lesmateriaal') },
  { name: 'coaches/lessons/databank', title: t('Databank') },
  { name: 'coaches/drawing', title: t('Tekenveld') },
  { name: 'admin/index', title: t('Beheer') },
  { name: 'admin/payments', title: t('Betalingen') },
  { name: 'admin/beurtenkaarten', title: t('Beurtenkaarten') },
  { name: 'admin/reports', title: t('Rapport') },
  { name: 'admin/courts', title: t('Banen') },
  { name: 'admin/goals', title: t('Doelen') },
  { name: 'admin/settings', title: t('Instellingen') },
];

/**
 * React Navigation paints its own theme background (#f2f2f2) over everything, which both
 * hid the app background and was the wrong grey. Transparent hands the surface back.
 */
const transparentTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: 'transparent',
    card: 'transparent',
    text: tennisColors.text,
    primary: tennisColors.primary,
    border: tennisColors.border,
  },
};

function Root() {
  const t = useT();
  const { loading, currentUser, settings } = useSimpleData();
  const segments = useSegments();

  // De enige plek waar het thema uit de instellingen op het scherm terechtkomt. Verder
  // rendert er niets opnieuw: dit zet één attribuut op de pagina en de browser verft de
  // rest (zie lib/theme-mode).
  useEffect(() => {
    applyThemeMode(settings.theme ?? 'light');
  }, [settings.theme]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: tennisColors.background }}>
        <ActivityIndicator color={tennisColors.primary} size="large" />
      </View>
    );
  }

  // Without a tab bar every screen is directly linkable, so the guard lives here instead
  // of in a tabs layout.
  if (!currentUser && segments[0] !== 'login') {
    return <Redirect href="/login" />;
  }

  // Every screen carries the bars except login, which has no navigation to offer yet.
  const showMenu = segments[0] !== 'login';

  return (
    <View style={{ flex: 1, backgroundColor: tennisColors.background }}>
      <AppBackground />
      {showMenu ? <MenuBar /> : null}
      {/* flex:1 om de stack: zo vult hij precies de hoogte tussen de twee balken en
          schuift de inhoud niet ónder de tabbalk door. */}
      <View style={{ flex: 1 }}>
        <ThemeProvider value={transparentTheme}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            {screens(t).map((s) => (
              <Stack.Screen
                key={s.name}
                name={s.name}
                // Een scherm met een eigen tabblad heeft de kop niet nodig: de tabbalk
                // zegt al waar je bent. options={{}} laat screenOptions (headerShown: false)
                // gewoon gelden.
                options={HEADLESS.has(s.name) ? {} : { ...headerBase, title: s.title }}
              />
            ))}
          </Stack>
        </ThemeProvider>
      </View>
      {showMenu ? <TabBar /> : null}
    </View>
  );
}

/**
 * De taal uit de instellingen doorgeven aan de rest van de app.
 *
 * Dit is een eigen laagje tussen de databank en de schermen, want de taal komt uít de
 * instellingen en moet dus bóven elk scherm staan dat een zin op het scherm zet — ook
 * boven `Root`, dat zelf de titels van de schermen samenstelt.
 */
function LanguageFromSettings({ children }: { children: React.ReactNode }) {
  const { settings } = useSimpleData();
  return <LanguageProvider lang={settings.language ?? 'nl'}>{children}</LanguageProvider>;
}

export default function RootLayout() {
  return (
    <SimpleDataProvider>
      <LanguageFromSettings>
        <Root />
      </LanguageFromSettings>
    </SimpleDataProvider>
  );
}
