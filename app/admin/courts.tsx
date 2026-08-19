import { View, Text, StyleSheet } from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

/** Read-only for now: the rate drives the revenue sums, so editing it is not a layout change. */
export default function Courts() {
  const { courts } = useSimpleData();
  const sorted = [...courts].sort((a, b) => a.number - b.number);

  return (
    <Screen>
      {sorted.length === 0 ? (
        <Text style={styles.muted}>Nog geen banen.</Text>
      ) : (
        sorted.map((c) => (
          <Card key={c.id}>
            <View style={styles.row}>
              <Text style={styles.name}>{c.name}</Text>
              <Badge
                label={c.indoor ? 'Binnen' : 'Buiten'}
                color={c.indoor ? tennisColors.court : tennisColors.primary}
                subtle={!c.indoor}
              />
            </View>
            <Text style={styles.meta}>€{c.hourly_rate} per uur</Text>
          </Card>
        ))
      )}
      <Text style={styles.help}>
        Het uurtarief bepaalt de omzetberekening. Aanpassen kan nog niet in de app.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: tennisColors.textMuted, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { ...typography.h3, color: tennisColors.text },
  meta: { fontSize: 13, color: tennisColors.textMuted, marginTop: 2 },
  help: { fontSize: 13, color: tennisColors.textMuted },
});
