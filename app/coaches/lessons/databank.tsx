// De databank: zoeken in alle oefeningen en trainingen. Het scherm is niet meer dan de
// omlijsting — het zoeken zelf staat in components/LessonDatabase, want een speler krijgt
// dezelfde databank te zien op /coaches/lessons.

import React from 'react';
import { Text, StyleSheet } from 'react-native';

import { Screen } from '../../../components/ui/Screen';
import { LessonDatabase } from '../../../components/LessonDatabase';
import { useSimpleData } from '../../../providers/SimpleDataProvider';
import { visibleLessonsFor } from '../../../lib/lessons';
import { tennisColors } from '../../../constants/tennis-colors';
import { isCoach } from '../../../lib/rechten';

export default function DatabankScreen(): React.JSX.Element {
  const { currentUser, lessons, error } = useSimpleData();

  return (
    <Screen>
      {error !== undefined && error !== null && error.length > 0 ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}
      <LessonDatabase
        lessons={visibleLessonsFor(lessons, currentUser)}
        canEdit={isCoach(currentUser)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: tennisColors.danger, fontSize: 14 },
});
