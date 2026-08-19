import { Stack, Redirect, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { SimpleDataProvider, useSimpleData } from '../providers/SimpleDataProvider';
import { ProfileAvatar } from '../components/ui/ProfileAvatar';
import { tennisColors } from '../constants/tennis-colors';

// One plain stack, no tab bar. The section you are in comes from the header title and
// the back button, which follows the path you took rather than the folder tree.
const headerBase = {
  headerShown: true,
  headerTintColor: tennisColors.primary,
  headerStyle: { backgroundColor: tennisColors.surface },
  headerTitleStyle: { color: tennisColors.text },
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

  // Profile is not a task like the four tiles, so it sits in the header, not on the hub.
  const avatar = currentUser
    ? () => <ProfileAvatar name={currentUser.name} />
    : undefined;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      {SCREENS.map((s) => (
        <Stack.Screen
          key={s.name}
          name={s.name}
          options={{
            ...headerBase,
            title: s.title,
            // Profile itself does not need a shortcut back to profile.
            headerRight: s.name === 'profile' ? undefined : avatar,
          }}
        />
      ))}
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SimpleDataProvider>
      <Root />
    </SimpleDataProvider>
  );
}
