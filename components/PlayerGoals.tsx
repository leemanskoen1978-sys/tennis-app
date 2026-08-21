import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { GoalHorizonSheet } from './GoalHorizonSheet';
import { useSimpleData } from '../providers/SimpleDataProvider';
import {
  GOAL_HORIZONS, horizonLabel, goalsFor, horizonSummary, filledGoalCount, goalCountLabel,
  newGoalId, shotTypeOptions, changeTypeOptions,
} from '../lib/goals';
import { useT } from '../lib/i18n';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, minTapTarget } from '../constants/theme';
import type { GoalHorizon } from '../lib/types';

/**
 * What a player is working towards, over three horizons — with as many goals per horizon
 * as the coach wants. A backhand grip change and more regularity on the serve are two
 * goals for the same ten lessons, not one.
 *
 * Elke horizon is hier één korte regel: de naam, en daarnaast wat er is afgesproken. Zo zie
 * je in één oogopslag welke horizon al gevuld is en welke nog leeg. De velden zelf staan in
 * het blad dat een tik erop opent — zelfde patroon als het maandoverzicht met zijn leskaarten.
 *
 * De rijen en het blad zijn met opzet twee losse onderdelen. Het dossier toont de rijen in
 * een blad (achter de tegel Doelen), en een blad binnen een blad bestaat niet: React Native
 * hangt de inhoud van een gesloten Modal helemaal weg. Daarom hangt de aanroeper het blad
 * naast de rijen op, op het scherm zelf.
 */
export function GoalHorizonRows({ studentId, onOpen }: {
  studentId: string;
  onOpen: (horizon: GoalHorizon) => void;
}): React.JSX.Element {
  const t = useT();
  const { goals } = useSimpleData();

  return (
    <>
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
            onPress={() => onOpen(horizon)}
            accessibilityLabel={
              filled
                ? t('{horizon}: {aantal}, {samenvatting}, doelen openen', {
                  horizon: horizonLabel(horizon),
                  aantal: goalCountLabel(count),
                  samenvatting: summary,
                })
                : t('{horizon}: nog geen doel, doelen openen', { horizon: horizonLabel(horizon) })
            }
          >
            <View style={styles.row}>
              <View style={styles.rowText}>
                <View style={styles.horizonRow}>
                  <Text style={styles.horizon}>{horizonLabel(horizon)}</Text>
                  {/* Het aantal staat als badge naast de naam: dat leest rustiger dan een cijfer
                      vooraan de zin, en houdt de samenvatting zelf bij het eerste doel. */}
                  {filled ? <Badge label={goalCountLabel(count)} subtle /> : null}
                </View>
                <Text style={filled ? styles.summary : styles.empty} numberOfLines={1}>
                  {filled ? summary : t('Nog geen doel afgesproken.')}
                </Text>
              </View>
              <ChevronRight size={18} color={tennisColors.textMuted} />
            </View>
          </Card>
        );
      })}
    </>
  );
}

/**
 * Het blad met de doelen van één horizon, aangesloten op de opslag: toevoegen, opslaan en
 * verwijderen gaan hier langs, zodat de aanroeper alleen hoeft te zeggen welke horizon open
 * staat. `horizon` is null als er niets openstaat.
 */
export function PlayerGoalSheet({ studentId, horizon, canEdit, onClose }: {
  studentId: string;
  horizon: GoalHorizon | null;
  canEdit: boolean;
  onClose: () => void;
}): React.JSX.Element | null {
  const { goals, settings, saveGoal, deleteGoal } = useSimpleData();
  if (!horizon) return null;
  return (
    <GoalHorizonSheet
      horizon={horizon}
      goals={goalsFor(goals, studentId, horizon)}
      shots={shotTypeOptions(settings)}
      changes={changeTypeOptions(settings)}
      canEdit={canEdit}
      visible
      onClose={onClose}
      onSave={(goal) => void saveGoal(goal)}
      onDelete={(id) => void deleteGoal(id)}
      onAdd={() => void saveGoal({ id: newGoalId(), student_id: studentId, horizon })}
    />
  );
}

const styles = StyleSheet.create({
  // Krapper dan een gewone kaart: dit is een regel om aan te tikken, geen blok om te lezen.
  card: { paddingVertical: spacing.md, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: minTapTarget },
  rowText: { flex: 1 },
  horizonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  horizon: { fontSize: 15, fontWeight: '800', color: tennisColors.primaryDark },
  summary: { fontSize: 14, color: tennisColors.text, marginTop: 2 },
  empty: { fontSize: 14, color: tennisColors.textMuted, marginTop: 2 },
});
