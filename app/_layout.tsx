import { Stack, Redirect, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { SimpleDataProvider, useSimpleData } from '../providers/SimpleDataProvider';
import { MenuBar } from '../components/ui/MenuBar';
import { tennisColors } from '../constants/tennis-colors';

// One plain stack, no tab bar. A MenuBar sits above the stack on every screen, so the
// sections are always one tap away; the stack header below it only says where you are.
//
// The stack's own back arrow is off: it disappears when the history is empty — after a
// deep link or a page reload on the web — and then the screen had no way out at all. The
// MenuBar does not depend on history.
const headerBase = {
  headerShown: true,
  headerTintColor: tennisColors.primary,
  headerStyle: { backgroundColor: tennisColors.background },
  headerTitleStyle: { color: tennisColors.text },
  headerBackVisible: false,
  headerLeft: () => null,
  headerShadowVisible: false,
} as const;

/** Screens in the order of the hub: Agenda, Spelers, Trainers, Beheer. */
const SCREENS: ReadonlyArray<{ name: string; title: string }> = [
  { name: 'profile', title: 'Profiel' },
  { name: 'agenda/index', title: 'Agenda' },
  { name: 'agenda/new', title: 'Nieuwe afspraak' },
  { name: 'players/index', title: 'Spelers' },
  { name: 'players/[id]', title: 'Speler-dossier' },
  { name: 'players/progress', title: 'Voortgang' },
  { name: 'coaches/index', title: 'Trainers' },
  { name: 'coaches/[id]', title: 'Trainer-dossier' },
  { name: 'coaches/lessons', title: 'Lesmateriaal' },
  { name: 'coaches/drawing', title: 'Tekenveld' },
  { name: 'admin/index', title: 'Beheer' },
  { name: 'admin/payments', title: 'Betalingen' },
  { name: 'admin/reports', title: 'Rapport' },
  { name: 'admin/courts', title: 'Banen' },
  { name: 'admin/settings', title: 'Instellingen' },
];

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

  // Every screen carries the bar except login, which has no navigation to offer yet.
  const showMenu = segments[0] !== 'login';

  return (
    <View style={{ flex: 1, backgroundColor: tennisColors.background }}>
      {showMenu ? <MenuBar /> : null}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        {SCREENS.map((s) => (
          <Stack.Screen key={s.name} name={s.name} options={{ ...headerBase, title: s.title }} />
        ))}
      </Stack>
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
