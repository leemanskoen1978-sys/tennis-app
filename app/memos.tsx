// De memo's die nog uitgewerkt moeten worden. Oudste bovenaan, want die vergeet je het snelst.
//
// Uitwerken hergebruikt het gewone voortgangsblad: het zijn dezelfde velden, en een tweede
// blad ernaast zou bij elke wijziging aan het formulier uit de pas gaan lopen. De speler,
// de opname en het tijdstip staan al ingevuld; er valt alleen nog te typen wat je hoorde.

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressForm } from '../components/progress/ProgressForm';
import { AudioMemo } from '../components/progress/ProgressViews';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { memoDuur, memoNaarNotitie, uitTeWerken } from '../lib/memo';
import { formatDayTime } from '../lib/datetime';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, typography, webCursor } from '../constants/theme';
import { useT } from '../lib/i18n';
import type { Memo } from '../lib/types';

export default function Memos() {
  const t = useT();
  const { currentUser, users, memos, deleteMemo, werkMemoUit } = useSimpleData();
  const [bezig, setBezig] = useState<Memo | null>(null);
  // Weggooien is onomkeerbaar, dus het gebeurt nooit met één tik.
  const [weg, setWeg] = useState<string | null>(null);

  const lijst = currentUser ? uitTeWerken(memos, currentUser.id) : [];
  const naamVan = (id: string): string =>
    users.find((u) => u.id === id)?.name ?? t('Onbekend');
  const preset = bezig ? memoNaarNotitie(bezig) : null;

  return (
    <Screen>
      <Text style={styles.titel}>{t('Nog uit te werken')}</Text>

      {lijst.length === 0 ? (
        <Text style={styles.leeg}>{t('Niets meer uit te werken. Netjes.')}</Text>
      ) : (
        lijst.map((memo) => (
          <Card key={memo.id} style={styles.rij}>
            <View style={styles.kop}>
              <Text style={styles.naam}>{naamVan(memo.student_id)}</Text>
              <Text style={styles.duur}>{memoDuur(memo.duration_ms)}</Text>
              <Text style={styles.wanneer}>{formatDayTime(memo.created_at)}</Text>
            </View>

            <AudioMemo uri={memo.audio_uri} />

            <View style={styles.knoppen}>
              <Button label={t('Uitwerken')} onPress={() => setBezig(memo)} />
              <Pressable
                onPress={() => setWeg(weg === memo.id ? null : memo.id)}
                accessibilityRole="button"
                accessibilityLabel={t('Memo weggooien')}
                style={[styles.weg, webCursor]}
              >
                <Trash2 size={18} color={tennisColors.danger} />
              </Pressable>
            </View>

            {weg === memo.id ? (
              <View style={styles.bevestig}>
                <Text style={styles.bevestigTekst}>
                  {t('Weggooien? De opname is niet terug te halen.')}
                </Text>
                <Button
                  label={t('Weggooien')}
                  variant="danger"
                  onPress={() => { setWeg(null); void deleteMemo(memo.id); }}
                />
              </View>
            ) : null}
          </Card>
        ))
      )}

      {/* Hetzelfde blad als overal, alleen met de speler, de opname en de dag al ingevuld. */}
      {bezig && preset ? (
        <ProgressForm
          visible
          studentId={preset.student_id}
          preset={{ voice_memo_uri: preset.voice_memo_uri, created_at: preset.created_at }}
          onCreate={(notitie) => werkMemoUit(bezig.id, notitie)}
          onClose={() => setBezig(null)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titel: { ...typography.h1, color: tennisColors.text },
  leeg: { color: tennisColors.textMuted, fontSize: 14 },
  rij: { gap: spacing.sm },
  kop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  naam: { ...typography.h3, color: tennisColors.text },
  duur: { fontSize: 13, color: tennisColors.text },
  wanneer: { fontSize: 13, color: tennisColors.textMuted, marginLeft: 'auto' },
  knoppen: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  weg: { padding: 8 },
  bevestig: { gap: spacing.sm },
  bevestigTekst: { fontSize: 13, color: tennisColors.text },
});
