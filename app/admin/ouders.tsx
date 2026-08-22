// Ouders en kinderen: wie er wacht op goedkeuring, en welke koppelingen er staan.
//
// Een koppeling geeft een ouder toegang tot het hele dossier van een kind — zijn lessen,
// zijn saldo, zijn voortgang. Dat is geen formaliteit, en daarom beslist een trainer erover
// in plaats van de ouder zelf. Kijk bij twijfel wie het is voor je goedkeurt: eenmaal
// gekoppeld ziet hij alles.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, X } from 'lucide-react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { openAanvragen } from '../../lib/ouderkind';
import { isCoach } from '../../lib/rechten';
import { formatDay } from '../../lib/datetime';
import { useT, useLanguage } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

export default function OudersScreen(): React.JSX.Element {
  const t = useT();
  const lang = useLanguage();
  const { currentUser, users, relaties, beslisOverKind, wisRelatie, error } = useSimpleData();

  const wachtend = useMemo(() => openAanvragen(relaties), [relaties]);
  const gekoppeld = useMemo(
    () => relaties
      .filter((r) => r.status === 'approved')
      .sort((a, b) => {
        const na = users.find((u) => u.id === a.child_id)?.name ?? '';
        const nb = users.find((u) => u.id === b.child_id)?.name ?? '';
        return na.localeCompare(nb, lang);
      }),
    [relaties, users, lang],
  );

  if (!isCoach(currentUser)) {
    return (
      <Screen scroll={false}>
        <Text style={styles.leeg}>{t('Beheer is alleen voor trainers.')}</Text>
      </Screen>
    );
  }

  const naam = (id: string) => users.find((u) => u.id === id)?.name ?? t('Onbekend');

  return (
    <Screen>
      {error ? <Text style={styles.fout}>{error}</Text> : null}

      <Text style={styles.sectie}>{t('Wacht op goedkeuring')}</Text>
      {wachtend.length === 0 ? (
        <Text style={styles.leeg}>{t('Er wacht geen aanvraag.')}</Text>
      ) : (
        wachtend.map((r) => (
          <Card key={r.id}>
            <Text style={styles.regel}>
              {t('{ouder} vraagt {kind} te mogen volgen.', {
                ouder: naam(r.parent_id),
                kind: naam(r.child_id),
              })}
            </Text>
            {r.created_at ? (
              <Text style={styles.meta}>{t('Gevraagd op {dag}', { dag: formatDay(r.created_at) })}</Text>
            ) : null}
            {/* Wat je goedkeurt, met zoveel woorden. Een knop "Goedkeuren" zonder deze regel
                laat je denken dat het over één les gaat. */}
            <Text style={styles.meta}>
              {t('Na goedkeuring ziet deze ouder de lessen, het saldo en de voortgang van '
                + 'dit kind.')}
            </Text>
            <View style={styles.knoppen}>
              <Button
                label={t('Goedkeuren')}
                variant="primary"
                fullWidth={false}
                icon={<Check size={16} color={tennisColors.onFill} />}
                onPress={() => { void beslisOverKind(r.id, true); }}
              />
              <Button
                label={t('Weigeren')}
                variant="secondary"
                fullWidth={false}
                icon={<X size={16} color={tennisColors.text} />}
                onPress={() => { void beslisOverKind(r.id, false); }}
              />
            </View>
          </Card>
        ))
      )}

      <Text style={styles.sectie}>{t('Gekoppeld')}</Text>
      {gekoppeld.length === 0 ? (
        <Text style={styles.leeg}>{t('Nog geen ouder aan een kind gekoppeld.')}</Text>
      ) : (
        gekoppeld.map((r) => (
          <Card key={r.id} style={styles.rij}>
            <View style={styles.rijTekst}>
              <Text style={styles.naam}>{naam(r.child_id)}</Text>
              <Text style={styles.meta}>{t('Ouder: {naam}', { naam: naam(r.parent_id) })}</Text>
            </View>
            <Badge label={t('Goedgekeurd')} color={tennisColors.primaryFill} />
            {/* Losmaken en niet weigeren: de vraag is ooit met ja beantwoord, dit is het
                terugdraaien daarvan. De ouder ziet daarna niets meer van dit kind. */}
            <Button
              label={t('Losmaken')}
              variant="secondary"
              fullWidth={false}
              onPress={() => { void wisRelatie(r.id); }}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectie: { ...typography.h2, color: tennisColors.text, marginTop: spacing.sm },
  regel: { ...typography.body, color: tennisColors.text, fontWeight: '600' },
  meta: { fontSize: 13, color: tennisColors.textMuted, marginTop: spacing.xs },
  knoppen: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  rij: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rijTekst: { flex: 1 },
  naam: { ...typography.h3, color: tennisColors.text },
  leeg: { ...typography.body, color: tennisColors.textMuted },
  fout: { color: tennisColors.danger, fontSize: 13 },
});
