import { Stack, Redirect, useSegments } from 'expo-router';
import { ThemeProvider, DefaultTheme, type Theme } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import { SimpleDataProvider, useSimpleData } from '../providers/SimpleDataProvider';
import { MenuBar } from '../components/ui/MenuBar';
import { TabBar } from '../components/ui/TabBar';
import { AppBackground } from '../components/ui/AppBackground';
import { tennisColors } from '../constants/tennis-colors';

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
const SCREENS: ReadonlyArray<{ name: string; title: string }> = [
  { name: 'profile', title: 'Profiel' },
  { name: 'agenda/index', title: 'Agenda' },
  { name: 'agenda/new', title: 'Nieuwe afspraak' },
  { name: 'agenda/export', title: 'Maandoverzicht' },
  { name: 'players/index', title: 'Spelers' },
  { name: 'players/[id]', title: 'Speler-dossier' },
  // Geen trainer bereikt dit scherm — een voortgangsverslag over een speler vult een
  // trainer in via de kaart in het spelersdossier. Hier komt alleen een speler, via het
  // tabblad Voortgang, dus de kop zou letterlijk herhalen wat die tab al zegt.
  { name: 'players/progress', title: 'Voortgang' },
  { name: 'coaches/index', title: 'Trainers' },
  { name: 'coaches/[id]', title: 'Trainer-dossier' },
  { name: 'coaches/lessons', title: 'Lesmateriaal' },
  { name: 'coaches/drawing', title: 'Tekenveld' },
  { name: 'admin/index', title: 'Beheer' },
  { name: 'admin/payments', title: 'Betalingen' },
  { name: 'admin/beurtenkaarten', title: 'Beurtenkaarten' },
  { name: 'admin/reports', title: 'Rapport' },
  { name: 'admin/courts', title: 'Banen' },
  { name: 'admin/goals', title: 'Doelen' },
  { name: 'admin/settings', title: 'Instellingen' },
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
  const { loading, currentUser } = useSimpleData();
  const segments = useSegments();

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
            {SCREENS.map((s) => (
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

export default function RootLayout() {
  return (
    <SimpleDataProvider>
      <Root />
    </SimpleDataProvider>
  );
}
