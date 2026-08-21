// Indrukken, praten, loslaten. De hele notitie op de baan zit in deze ene knop.
//
// Waarom vasthouden en niet aan/uit: een knop die aanblijft, blijft aan. Op een baan leg je
// je telefoon neer en dan neemt hij nog een kwartier op. Vasthouden kan niet per ongeluk
// blijven doorlopen, en loslaten is dezelfde beweging als ophouden met praten.

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Check, Mic, RefreshCw } from 'lucide-react-native';
import { useOpname } from '../useOpname';
import { MAX_MEMO_MS, memoDuur, opnameDeugt, resterend } from '../../lib/memo';
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { radius, minTapTarget, spacing, webCursor } from '../../constants/theme';

export function MemoKnop({ naam, alGehad, onOpname }: {
  /** Voor de schermlezer: om welke speler gaat deze knop? */
  naam: string;
  /** Staat er al een memo voor deze speler in deze les? Dan het vinkje ernaast. */
  alGehad: boolean;
  /**
   * Een geldige opname bewaren. Te korte opnames komen hier niet aan.
   *
   * Geeft een belofte terug die kapotgaat als het wegschrijven mislukt — en dán houdt deze
   * knop de opname vast in plaats van hem te laten verdampen. Een memo die stil verdwijnt,
   * kost meer vertrouwen dan een memo die niet gemaakt kon worden.
   */
  onOpname: (audioUri: string, durationMs: number) => Promise<void>;
}) {
  const t = useT();
  const [teKort, setTeKort] = useState(false);
  // Een opname die er wel is maar nog niet bewaard. Blijft staan tot het lukt.
  const [blijftHangen, setBlijftHangen] = useState<{ uri: string; ms: number } | null>(null);

  const bewaar = async (uri: string, ms: number): Promise<void> => {
    try {
      await onOpname(uri, ms);
      setBlijftHangen(null);
    } catch {
      setBlijftHangen({ uri, ms });
    }
  };

  const opname = useOpname((dataUrl, durationMs) => {
    // Een misgreep verdwijnt zonder mededeling — maar wel met een kort teken, anders denkt
    // een trainer dat hij iets bewaard heeft.
    if (!opnameDeugt(durationMs)) {
      setTeKort(true);
      setTimeout(() => setTeKort(false), 2000);
      return;
    }
    void bewaar(dataUrl, durationMs);
  }, MAX_MEMO_MS);

  if (!opname.kanOpnemen) {
    return <Text style={styles.kanNiet}>{t('Opnemen kan hier niet')}</Text>;
  }

  const nogSeconden = resterend(opname.ms);

  return (
    <View style={styles.rij}>
      <Pressable
        onPressIn={() => { void opname.start(); }}
        onPressOut={opname.stop}
        accessibilityRole="button"
        accessibilityLabel={t('Memo opnemen voor {naam}', { naam })}
        style={[styles.knop, opname.bezig && styles.knopBezig, webCursor]}
      >
        <Mic size={20} color={opname.bezig ? tennisColors.onFill : tennisColors.primary} />
        {opname.bezig ? <Text style={styles.teller}>{memoDuur(opname.ms)}</Text> : null}
      </Pressable>

      {/* Het aftellen staat naast de knop en niet erin: je duim ligt op de knop. */}
      {nogSeconden !== null ? (
        <Text style={styles.aftellen}>{t('nog {n}s', { n: nogSeconden })}</Text>
      ) : null}
      {teKort ? <Text style={styles.teKort}>{t('te kort')}</Text> : null}
      {opname.fout ? <Text style={styles.fout}>{opname.fout}</Text> : null}

      {/* De opname is er wel, maar staat nog nergens. Hij blijft in beeld tot dat lukt. */}
      {blijftHangen ? (
        <Pressable
          onPress={() => { void bewaar(blijftHangen.uri, blijftHangen.ms); }}
          accessibilityRole="button"
          accessibilityLabel={t('Nog niet bewaard — opnieuw proberen')}
          style={[styles.opnieuw, webCursor]}
        >
          <RefreshCw size={16} color={tennisColors.danger} />
          <Text style={styles.fout}>{t('niet bewaard — opnieuw')}</Text>
        </Pressable>
      ) : null}

      {alGehad && !opname.bezig && !blijftHangen
        ? <Check size={18} color={tennisColors.success} />
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rij: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // Ruim boven minTapTarget: dit wordt aangeraakt door iemand die ergens anders naar kijkt.
  knop: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minWidth: minTapTarget, minHeight: minTapTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: tennisColors.primaryTint,
    justifyContent: 'center',
  },
  knopBezig: { backgroundColor: tennisColors.danger },
  teller: { color: tennisColors.onFill, fontWeight: '700', fontSize: 14 },
  aftellen: { color: tennisColors.danger, fontSize: 12, fontWeight: '700' },
  teKort: { color: tennisColors.textMuted, fontSize: 12 },
  opnieuw: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fout: { color: tennisColors.danger, fontSize: 12, flexShrink: 1 },
  kanNiet: { color: tennisColors.textMuted, fontSize: 12 },
});
