import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, NotebookPen, User as UserIcon } from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { ActionTile, TileGrid } from '../../components/ui/ActionTile';
import { ProgressForm } from '../../components/progress/ProgressForm';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { nextBookingFor, playerListLine } from '../../lib/relations';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

/**
 * De spelerslijst is ook de plek waar een trainer na zijn lesdag zijn notities kwijt kan:
 * één knop bovenaan opent hetzelfde voortgangsblad als in een dossier, alleen kies je de
 * speler daar zelf. Zo hoef je niet eerst het juiste dossier op te zoeken.
 *
 * Onder elke naam staat één regel — wanneer je deze speler weer ziet en hoeveel er al over
 * hem genoteerd is. Dat is wat je nodig hebt om te kiezen; de rest staat in zijn dossier.
 */
export default function Players() {
  const router = useRouter();
  const { currentUser, users, bookings, progress } = useSimpleData();
  const players = users.filter((u) => u.role !== 'coach');
  const isCoach = currentUser?.role === 'coach';
  const [progressOpen, setProgressOpen] = useState(false);

  // Eén moment voor de hele lijst: anders zou de ene speler op een andere "nu" beoordeeld
  // worden dan de volgende.
  const now = new Date();

  return (
    <Screen>
      {/* Een speler noteert geen voortgang; voor hem is dit gewoon een lijst. */}
      {isCoach ? (
        <TileGrid>
          <ActionTile
            title="Voortgang toevoegen"
            subtitle="Notitie na de les, voor eender welke speler"
            icon={NotebookPen}
            primary
            onPress={() => setProgressOpen(true)}
          />
        </TileGrid>
      ) : null}

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
                <Text style={styles.line}>
                  {playerListLine(
                    nextBookingFor(p.id, bookings, now),
                    progress.filter((entry) => entry.student_id === p.id).length,
                  )}
                </Text>
              </View>
              <ChevronRight size={20} color={tennisColors.textMuted} />
            </View>
          </Card>
        ))
      )}

      {/* Hetzelfde blad als in het dossier, alleen zonder speler: die kies je bovenin. */}
      <ProgressForm visible={progressOpen} onClose={() => setProgressOpen(false)} />
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
  // De regel die zegt waar deze speler staat; iets donkerder dan het e-mailadres, want
  // dit is waar een trainer op kiest.
  line: { fontSize: 13, color: tennisColors.text, marginTop: 2 },
});
