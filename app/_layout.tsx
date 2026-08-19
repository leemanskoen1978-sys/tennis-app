import { Stack, Redirect, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { SimpleDataProvider, useSimpleData } from '../providers/SimpleDataProvider';
import { tennisColors } from '../constants/tennis-colors';

function Gate() {
  const { currentUser, loading } = useSimpleData();
  const segments = useSegments();
  const inTabs = segments[0] === '(tabs)';

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: tennisColors.background }}>
        <ActivityIndicator color={tennisColors.primary} size="large" />
      </View>
    );
  }
  if (!currentUser && inTabs) return <Redirect href="/login" />;
  if (currentUser && !inTabs) return <Redirect href="/(tabs)/home" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SimpleDataProvider>
      <Gate />
    </SimpleDataProvider>
  );
}
