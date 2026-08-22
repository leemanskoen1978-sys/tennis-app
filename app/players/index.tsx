import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CalendarDays, ChevronRight, NotebookPen, Search, Users, UserCheck,
  User as UserIcon, X,
} from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { ActionTile, TileGrid } from '../../components/ui/ActionTile';
import { ProgressForm } from '../../components/progress/ProgressForm';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import {
  emptyScopeLine, nextBookingFor, playerCountLabel, playerListLine, playersInScope,
  searchPlayers, type PlayerScope,
} from '../../lib/relations';
import { tennisColors } from '../../constants/tennis-colors';
import { radius, minTapTarget, spacing, typography, webCursor } from '../../constants/theme';
import { useT } from '../../lib/i18n';
import { isCoach } from '../../lib/rechten';
import { playersOf } from '../../lib/hub';

/**
 * De spelerslijst is ook de plek waar een trainer na zijn lesdag zijn notities kwijt kan:
 * één knop bovenaan opent hetzelfde voortgangsblad als in een dossier, alleen kies je de
 * speler daar zelf. Zo hoef je niet eerst het juiste dossier op te zoeken.
 *
 * Daaronder staan drie tegels, want "de spelerslijst" is voor een trainer eigenlijk drie
 * lijsten: iedereen, de spelers waar hij al mee werkte, en wie hij vandaag op de baan
 * heeft. Die laatste twee zijn wat hij doorgaans zoekt; de hele club is de uitzondering.
 * Wie ze telt en wie erin hoort staat in `playersInScope` — het scherm kiest alleen.
 *
 * De zoekregel werkt bínnen de gekozen tegel: je zoekt in de stapel die je bekijkt, en de
 * telling op de tegels blijft zeggen hoe groot die stapels zijn.
 *
 * Onder elke naam staat één regel — wanneer je deze speler weer ziet en hoeveel er al over
 * hem genoteerd is. Dat is wat je nodig hebt om te kiezen; de rest staat in zijn dossier.
 */
export default function Players() {
  const t = useT();
  const router = useRouter();
  const { currentUser, users, bookings, lessons, progress } = useSimpleData();
  const coach = isCoach(currentUser);
  const players = playersOf(users);
  const [progressOpen, setProgressOpen] = useState(false);
  const [scope, setScope] = useState<PlayerScope>('all');
  const [query, setQuery] = useState('');

  // Eén moment voor de hele lijst: anders zou de ene speler op een andere "nu" beoordeeld
  // worden dan de volgende, en zou "vandaag" halverwege kunnen omslaan.
  const now = new Date();

  // De drie stapels worden alle drie uitgerekend, ook de twee die je niet bekijkt: hun
  // aantal staat op de tegel, en dat is juist waar je op kiest.
  const scoped = useMemo(() => {
    const input = { players, coachId: currentUser?.id ?? null, bookings, lessons, progress, now };
    return {
      all: playersInScope('all', input),
      mine: playersInScope('mine', input),
      today: playersInScope('today', input),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, currentUser?.id, bookings, lessons, progress]);

  // Een speler of ouder heeft geen "mijn spelers": voor hem is dit gewoon de ledenlijst.
  const shown = coach ? scoped[scope] : scoped.all;
  const visible = searchPlayers(shown, query);

  return (
    <Screen>
      {/* Een speler noteert geen voortgang; voor hem is dit gewoon een lijst. */}
      {coach ? (
        <>
          <TileGrid>
            <ActionTile
              title={t('Voortgang toevoegen')}
              subtitle={t('Notitie na de les, voor eender welke speler')}
              icon={NotebookPen}
              primary
              onPress={() => setProgressOpen(true)}
            />
          </TileGrid>

          <TileGrid>
            <ActionTile
              title={t('Alle spelers')}
              subtitle={playerCountLabel(scoped.all.length)}
              icon={Users}
              selected={scope === 'all'}
              onPress={() => setScope('all')}
            />
            <ActionTile
              title={t('Mijn spelers')}
              subtitle={playerCountLabel(scoped.mine.length)}
              icon={UserCheck}
              selected={scope === 'mine'}
              onPress={() => setScope('mine')}
            />
            <ActionTile
              title={t('Spelers vandaag')}
              subtitle={playerCountLabel(scoped.today.length)}
              icon={CalendarDays}
              selected={scope === 'today'}
              onPress={() => setScope('today')}
            />
          </TileGrid>
        </>
      ) : null}

      {/* Zoeken in de stapel die je bekijkt. Staat onder de tegels, want de tegel bepaalt
          waarin je zoekt en niet andersom. */}
      <View style={styles.searchField}>
        <Search size={18} color={tennisColors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t('Zoek een speler op naam of e-mail')}
          placeholderTextColor={tennisColors.textMuted}
          accessibilityLabel={t('Zoek een speler')}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query !== '' ? (
          <Pressable
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel={t('Zoekregel wissen')}
            style={[styles.clear, webCursor]}
          >
            <X size={18} color={tennisColors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {visible.length === 0 ? (
        <Text style={styles.muted}>
          {/* Twee redenen om niets te zien, en ze vragen om een ander antwoord: de stapel is
              leeg, of je zoekterm past op niemand in die stapel. */}
          {query !== ''
            ? t('Geen speler gevonden voor "{q}".', { q: query.trim() })
            : emptyScopeLine(coach ? scope : 'all')}
        </Text>
      ) : (
        visible.map((p) => (
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
  searchField: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.sm,
    backgroundColor: tennisColors.surface, paddingHorizontal: 12,
    minHeight: minTapTarget,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: tennisColors.text },
  clear: { padding: 6 },
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
