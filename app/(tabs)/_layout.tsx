import { View } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { Home, CalendarDays, BookOpen, TrendingUp, BarChart3, Pencil, UserCircle } from 'lucide-react-native';
import { tennisColors } from '../../constants/tennis-colors';
import { PaymentGate } from '../../components/PaymentGate';
import { useSimpleData } from '../../providers/SimpleDataProvider';

export default function TabsLayout() {
  const { currentUser } = useSimpleData();
  if (!currentUser) return <Redirect href="/login" />;
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: tennisColors.primary,
          tabBarInactiveTintColor: tennisColors.textMuted,
          headerStyle: { backgroundColor: tennisColors.surface },
          headerTitleStyle: { color: tennisColors.text },
          tabBarStyle: { backgroundColor: tennisColors.surface, borderTopColor: tennisColors.border },
        }}
      >
        <Tabs.Screen name="home" options={{ title: 'Reserveren', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
        <Tabs.Screen name="bookings" options={{ title: 'Afspraken', tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} /> }} />
        <Tabs.Screen name="lessons" options={{ title: 'Lessen', tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} /> }} />
        <Tabs.Screen name="progress" options={{ title: 'Voortgang', tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size} /> }} />
        <Tabs.Screen name="reports" options={{ title: 'Rapport', tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} /> }} />
        <Tabs.Screen name="drawing" options={{ title: 'Tekenen', tabBarIcon: ({ color, size }) => <Pencil color={color} size={size} /> }} />
        <Tabs.Screen name="profile" options={{ title: 'Profiel', tabBarIcon: ({ color, size }) => <UserCircle color={color} size={size} /> }} />
      </Tabs>
      <PaymentGate />
    </View>
  );
}
