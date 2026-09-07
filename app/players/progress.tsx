import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { byDateDesc, ProgressEntryCard, ReportSummary } from '../../components/progress/ProgressViews';
import { spacing } from '../../constants/theme';
import { tennisColors } from '../../constants/tennis-colors';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { ProgressForm } from '../../components/progress/ProgressForm';
import { useT } from '../../lib/i18n';
import type { StudentProgress } from '../../lib/types';
import { useKindkeuze } from '../../providers/kindkeuze';
import { SpelerKiezer } from '../../components/ui/SpelerKiezer';

/**
 * Het rapport van één speler, gelezen door de speler zelf of door zijn ouder.
 *
 * Alleen lezen, met opzet. Hier stond ooit ook de trainerskant — een invulformulier voor
 * een nieuwe beoordeling, een lijst "waar je mee bezig bent" en een rapport per speler —
 * maar geen enkele trainer kwam hier ooit: zijn tabbalk en zijn tegels op het hoofdscherm
 * gaan naar Agenda, Spelers, Trainers en Beheer, en nergens naar Voortgang. Die honderd
 * regels waren dus een tweede versie van `components/progress/ProgressForm` die niemand
 * te zien kreeg en die bij elke wijziging aan het echte formulier stiller uit de pas ging
 * lopen. Een trainer noteert voortgang waar hij toch al kijkt: in het dossier van de
 * speler (app/players/[id]) en op het Spelers-scherm.
 *
 * Wie welke speler leest, beslist `SpelerKiezer` hierboven: een ouder met meer dan één
 * kind wisselt daar, en een trainer die naar zijn eigen kind kijkt leest hier mee als
 * ouder. Zie providers/kindkeuze.
 */
export default function ProgressScreen(): React.JSX.Element {
  const t = useT();
  const { progress, users, error } = useSimpleData();
  const { speler } = useKindkeuze();

  // Welke beoordeling openklapt; null = blad dicht. Zelfde blad als in het dossier van de
  // trainer (app/players/[id]), maar op slot: hier wordt gelezen.
  const [openEntry, setOpenEntry] = useState<StudentProgress | null>(null);

  const studentName = (id: string): string => users.find((x) => x.id === id)?.name ?? t('Onbekend');
  const coachName = (id?: string): string => users.find((x) => x.id === id)?.name ?? t('Onbekend');

  // Bij een ouder gaat "jouw beoordelingen" over zijn kind: hij krijgt zelf geen les.
  const eigenBeoordelingen = speler
    ? progress.filter((p) => p.student_id === speler.id).sort(byDateDesc)
    : [];

  return (
    <Screen>
      {/* Voor een ouder met meer dan één kind: wiens voortgang lees je? */}
      <SpelerKiezer />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.sectionTitle}>{t('Mijn rapport')}</Text>
      {eigenBeoordelingen.length === 0 ? (
        <Text style={styles.muted}>{t('Nog geen voortgang.')}</Text>
      ) : (
        <>
          <ReportSummary entries={eigenBeoordelingen} />
          {eigenBeoordelingen.map((p) => (
            <ProgressEntryCard
              key={p.id}
              p={p}
              studentName={studentName(p.student_id)}
              showStudent={false}
              coachName={coachName(p.coach_id)}
              onPress={() => setOpenEntry(p)}
            />
          ))}
        </>
      )}

      {/* Wat op de kaart niet past: de hele notitie, het huiswerk en de spraakmemo om af te
          spelen. `canEdit` blijft uit — een speler leest zijn dossier, wijzigen doet de
          trainer. */}
      {speler ? (
        <ProgressForm
          visible={openEntry !== null}
          onClose={() => setOpenEntry(null)}
          studentId={speler.id}
          entry={openEntry}
          canEdit={false}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: tennisColors.danger, marginBottom: spacing.md, fontSize: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: tennisColors.text, marginTop: spacing.sm, marginBottom: spacing.sm },
  muted: { color: tennisColors.textMuted, fontSize: 14 },
});
