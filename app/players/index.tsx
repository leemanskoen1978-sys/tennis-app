import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, User as UserIcon } from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

export default function Players() {
  const router = useRouter();
  const { users } = useSimpleData();
  const players = users.filter((u) => u.role !== 'coach');

  return (
    <Screen>
      {players.length === 0 ? (
        <Text style={styles.muted}>Nog geen spelers.</Text>
      ) : (
        players.map((p) => (
          <Card key={p.id} onPress={() => router.push(`/players/${p.id}`)} accessibilityLabel={p.name} style={styles.row}>
            <View style={styles.rowContent}>
              <View style={styles.avatar}><UserIcon size={20} color={tennisColors.primary} /></View>
              <View style={styles.info}>
                <Text style={styles.name}>{p.name}</Text>
                {p.email ? <Text style={styles.email}>{p.email}</Text> : null}
              </View>
              <ChevronRight size={20} color={tennisColors.textMuted} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: tennisColors.textMuted, fontSize: 14 },
  row: {},
  rowContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: tennisColors.primaryTint,
  },
  info: { flex: 1 },
  name: { ...typography.h3, color: tennisColors.text },
  email: { fontSize: 13, color: tennisColors.textMuted },
});
