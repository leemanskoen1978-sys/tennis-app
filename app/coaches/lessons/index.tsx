// Lesmateriaal: twee tegels voor een trainer — iets nieuws maken, of zoeken in wat er is.
//
// Een speler krijgt geen tegels: hij kan niets toevoegen, dus zou de keuze uit één tegel
// alleen een extra tik zijn voor de lijst die hij komt halen. Hij ziet de databank meteen.

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Library } from 'lucide-react-native';

import { Screen } from '../../../components/ui/Screen';
import { ActionTile, TileGrid } from '../../../components/ui/ActionTile';
import { LessonDatabase } from '../../../components/LessonDatabase';
import { useSimpleData } from '../../../providers/SimpleDataProvider';
import { visibleLessonsFor } from '../../../lib/lessons';
import { tennisColors } from '../../../constants/tennis-colors';
import { spacing, typography } from '../../../constants/theme';

export default function LessonsScreen(): React.JSX.Element {
  const router = useRouter();
  const { currentUser, lessons, error } = useSimpleData();
  const isCoach = currentUser?.role === 'coach';

  if (!isCoach) {
    return (
      <Screen>
        {error !== undefined && error !== null && error.length > 0 ? (
          <Text style={styles.error}>{error}</Text>
        ) : null}
        <LessonDatabase
          lessons={visibleLessonsFor(lessons, currentUser)}
          canEdit={false}
          emptyLabel="Je trainer heeft nog geen lesmateriaal voor je klaargezet."
        />
      </Screen>
    );
  }

  const exercises = lessons.reduce((sum, l) => sum + (l.exercises?.length ?? 0), 0);

  return (
    <Screen>
      {error !== undefined && error !== null && error.length > 0 ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      <Text style={styles.intro}>
        Materiaal maken of terugvinden — de databank doorzoekt elke oefening op tags.
      </Text>

      <TileGrid>
        <ActionTile
          title="Nieuw lesmateriaal"
          subtitle="Titel, link, PDF of veldsituatie"
          icon={Plus}
          onPress={() => router.push('/coaches/lessons/new')}
        />
        <ActionTile
          title="Databank"
          subtitle={
            exercises > 0
              ? `${exercises} oefeningen doorzoeken`
              : `${lessons.length} stuks lesmateriaal`
          }
          icon={Library}
          onPress={() => router.push('/coaches/lessons/databank')}
        />
      </TileGrid>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: tennisColors.danger, fontSize: 14 },
  intro: { ...typography.body, color: tennisColors.textMuted, marginBottom: spacing.xs },
});
