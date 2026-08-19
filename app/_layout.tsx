import { Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { SimpleDataProvider, useSimpleData } from '../providers/SimpleDataProvider';
import { tennisColors } from '../constants/tennis-colors';

function Root() {
  const { loading } = useSimpleData();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: tennisColors.background }}>
        <ActivityIndicator color={tennisColors.primary} size="large" />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
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
