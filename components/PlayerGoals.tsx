import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Target, ChevronRight } from 'lucide-react-native';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { GoalHorizonSheet } from './GoalHorizonSheet';
import { useSimpleData } from '../providers/SimpleDataProvider';
import {
  GOAL_HORIZONS, HORIZON_LABELS, goalsFor, horizonSummary, filledGoalCount, goalCountLabel,
  newGoalId, shotTypeOptions, changeTypeOptions,
} from '../lib/goals';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, typography, minTapTarget } from '../constants/theme';
import type { GoalHorizon } from '../lib/types';

/**
 * What a player is working towards, over three horizons — with as many goals per horizon
 * as the coach wants. A backhand grip change and more regularity on the serve are two
 * goals for the same ten lessons, not one.
 *
 * Elke horizon is hier één korte regel: de naam, en daarnaast wat er is afgesproken. Zo zie
 * je in één oogopslag welke horizon al gevuld is en welke nog leeg. De velden zelf staan in
 * het blad dat een tik erop opent — zelfde patroon als het maandoverzicht met zijn leskaarten.
 */
export function PlayerGoals({ studentId, canEdit }: { studentId: string; canEdit: boolean }) {
  const { goals, settings, saveGoal, deleteGoal } = useSimpleData();
  const shots = shotTypeOptions(settings);
  const changes = changeTypeOptions(settings);
  // Welke horizon zijn doelen laat zien; null = blad dicht.
  const [openHorizon, setOpenHorizon] = useState<GoalHorizon | null>(null);

  const openGoals = openHorizon ? goalsFor(goals, studentId, openHorizon) : [];

  return (
    <>
      <View style={styles.heading}>
        <Target size={18} color={tennisColors.primary} />
        <Text style={styles.headingText}>Doelen</Text>
      </View>

      {GOAL_HORIZONS.map((horizon) => {
        // Alleen ingevulde doelen halen de regel: een zojuist toegevoegd, nog leeg doel zegt
        // niets over wat er is afgesproken — voor de trainer niet en voor de speler niet.
        const horizonGoals = goalsFor(goals, studentId, horizon);
        const summary = horizonSummary(horizonGoals);
        const filled = summary !== '';
        const count = filledGoalCount(horizonGoals);
        return (
          <Card
            key={horizon}
            style={styles.card}
            onPress={() => setOpenHorizon(horizon)}
            accessibilityLabel={
              filled
                ? `${HORIZON_LABELS[horizon]}: ${goalCountLabel(count)}, ${summary}, doelen openen`
                : `${HORIZON_LABELS[horizon]}: nog geen doel, doelen openen`
            }
          >
            <View style={styles.row}>
              <View style={styles.rowText}>
                <View style={styles.horizonRow}>
                  <Text style={styles.horizon}>{HORIZON_LABELS[horizon]}</Text>
                  {/* Het aantal staat als badge naast de naam: dat leest rustiger dan een cijfer
                      vooraan de zin, en houdt de samenvatting zelf bij het eerste doel. */}
                  {filled ? <Badge label={goalCountLabel(count)} subtle /> : null}
                </View>
                <Text style={filled ? styles.summary : styles.empty} numberOfLines={1}>
                  {filled ? summary : 'Nog geen doel afgesproken.'}
                </Text>
              </View>
              <ChevronRight size={18} color={tennisColors.textMuted} />
            </View>
          </Card>
        );
      })}

      {openHorizon ? (
        <GoalHorizonSheet
          horizon={openHorizon}
          goals={openGoals}
          shots={shots}
          changes={changes}
          canEdit={canEdit}
          visible
          onClose={() => setOpenHorizon(null)}
          onSave={(goal) => void saveGoal(goal)}
          onDelete={(id) => void deleteGoal(id)}
          onAdd={() =>
            void saveGoal({ id: newGoalId(), student_id: studentId, horizon: openHorizon })
          }
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  // Zelfde kopstijl als de andere secties van het dossier, anders leest het als een los scherm.
  headingText: {
    ...typography.label,
    color: tennisColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Krapper dan een gewone kaart: dit is een regel om aan te tikken, geen blok om te lezen.
  card: { paddingVertical: spacing.md, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: minTapTarget },
  rowText: { flex: 1 },
  horizonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  horizon: { fontSize: 15, fontWeight: '800', color: tennisColors.primaryDark },
  summary: { fontSize: 14, color: tennisColors.text, marginTop: 2 },
  empty: { fontSize: 14, color: tennisColors.textMuted, marginTop: 2 },
});
