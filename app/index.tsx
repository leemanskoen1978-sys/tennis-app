// HUB — the one starting screen. Four sections for a coach, four tasks for a player.
//
// Ordering rule (see docs/superpowers/specs/…-navigatie-herstructurering-design.md):
//   about a person -> Spelers or Trainers · about club/money/system -> Beheer · about time -> Agenda
// Tiles are ordered by how often you use them, not alphabetically.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import {
  CalendarDays, CalendarPlus, Users, GraduationCap, SlidersHorizontal,
  BookOpen, TrendingUp, Wallet, ChevronRight, X, XCircle, type LucideIcon,
} from 'lucide-react-native';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ActionTile, TileGrid } from '../components/ui/ActionTile';
import { Lesdag } from '../components/lesdag/Lesdag';
import { useSimpleData, usePendingPaymentBookings } from '../providers/SimpleDataProvider';
import { bookingsToday, countPlayers, countCoaches } from '../lib/hub';
import { awaitingApprovalFor, awaitingApprovalOf, recentGeweigerd } from '../lib/inbox';
import { isCoach, magInElkeAgenda } from '../lib/rechten';
import { zonderWeggeklikt } from '../lib/weggeklikt';
import { useWeggeklikt } from '../providers/weggeklikt';
import { bookingsFor, filterPendingPayment, openBalanceFor } from '../lib/payments';
import { formatEuro } from '../lib/money';
import { formatDayTimeRange } from '../lib/datetime';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, typography } from '../constants/theme';
import { useT } from '../lib/i18n';

interface Tile {
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  onPress: () => void;
  primary?: boolean;
  badge?: number;
}

export default function Hub() {
  const t = useT();
  const router = useRouter();
  const { currentUser, users, bookings, courts } = useSimpleData();
  const coach = isCoach(currentUser);
  const pending = usePendingPaymentBookings();

  if (!currentUser) return <Redirect href="/login" />;

  // `bookingsFor` en niet zelf filteren: zo ziet een speler ook de groepslessen waarin
  // hij meespeelt zonder te betalen.
  const myBookings = bookingsFor(currentUser, bookings);
  const today = bookingsToday(coach ? bookings : myBookings, new Date());
  // Dezelfde definitie van "staat nog open" als Beheer: een geannuleerde of nog niet
  // bevestigde les hoort niet op de badge, anders loopt die juist óp bij een annulering.
  const myOpen = filterPendingPayment(myBookings).length;
  // Wat er in euro's nog openstaat. Een teller zegt "2 lessen"; wat een speler wil weten is
  // hoeveel dat is, en dat staat daarom voluit op zijn hoofdscherm in plaats van als badge.
  const balance = openBalanceFor(currentUser, bookings, courts);
  // Wat op een beslissing van deze trainer wacht. De badge staat op Agenda, want daar staat
  // de lijst zelf ook — een melding die naar een ander scherm wijst dan waar je hem
  // afhandelt, laat je zoeken.
  const teKeuren = coach
    ? awaitingApprovalFor(bookings, currentUser.id, magInElkeAgenda(currentUser)).length
    : 0;
  // En andersom: waar de speler zelf nog op wacht.
  const gevraagd = coach ? 0 : awaitingApprovalOf(bookings, currentUser.id).length;
  // Een geweigerde aanvraag is het enige dat anders nergens te zien is: de les verdwijnt
  // en niemand zegt waarom. Een goedgekeurde les staat gewoon in zijn agenda.
  const geweigerd = coach ? [] : recentGeweigerd(bookings, currentUser.id, new Date());
  // Wat je wegklikt blijft weg — op dit toestel. Zie lib/weggeklikt voor waarom dat niet in
  // de databank staat.
  const { weggeklikt, klikWeg, klikAllesWeg } = useWeggeklikt(geweigerd);
  const teTonen = zonderWeggeklikt(geweigerd, weggeklikt);

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? t(one) : t(many)}`;

  const coachTiles: Tile[] = [
    {
      key: 'agenda',
      title: t('Agenda'),
      subtitle: teKeuren > 0
        ? plural(teKeuren, 'les goed te keuren', 'lessen goed te keuren')
        : plural(today, 'vandaag', 'vandaag'),
      icon: CalendarDays,
      onPress: () => router.push('/agenda'),
      badge: teKeuren,
    },
    { key: 'spelers', title: t('Spelers'), subtitle: plural(countPlayers(users), 'actief', 'actief'), icon: Users, onPress: () => router.push('/players') },
    { key: 'trainers', title: t('Trainers'), subtitle: plural(countCoaches(users), 'trainer', 'trainers'), icon: GraduationCap, onPress: () => router.push('/coaches') },
    { key: 'beheer', title: t('Beheer'), subtitle: plural(pending.length, 'openstaand', 'openstaand'), icon: SlidersHorizontal, onPress: () => router.push('/admin'), badge: pending.length },
  ];

  const playerTiles: Tile[] = [
    { key: 'book', title: t('Reserveren'), subtitle: t('Boek je volgende les'), icon: CalendarPlus, onPress: () => router.push('/agenda/new'), primary: true },
    {
      key: 'mine',
      title: t('Mijn agenda'),
      // Wacht er nog een aanvraag op zijn trainer, dan is dát wat hij wil weten — niet
      // hoeveel lessen hij vandaag heeft.
      subtitle: gevraagd > 0
        ? plural(gevraagd, 'wacht op goedkeuring', 'wachten op goedkeuring')
        : plural(today, 'vandaag', 'vandaag'),
      icon: CalendarDays,
      onPress: () => router.push('/agenda'),
      badge: myOpen,
    },
    { key: 'les', title: t('Mijn lessen'), subtitle: t('Lesmateriaal van je trainers'), icon: BookOpen, onPress: () => router.push('/coaches/lessons') },
    // "Voortgang" en niet "Mijn voortgang": de tab onderaan heet zo, want daar past de
    // langere tekst niet op een telefoon. Tegel en tab moeten hetzelfde heten.
    { key: 'prog', title: t('Voortgang'), subtitle: t('Jouw beoordelingen'), icon: TrendingUp, onPress: () => router.push('/players/progress') },
  ];

  const tiles = coach ? coachTiles : playerTiles;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.hi}>{t('Hoi {naam} 👋', { naam: currentUser.name })}</Text>
          <Text style={styles.q}>{t('Wat wil je doen?')}</Text>
        </View>
      </View>

      {/* De lesdag hoort bovenaan: wat een trainer om vijf voor vijf wil zien, is de les
          van vijf uur — niet een keuzemenu. De tegels blijven eronder staan. */}
      {coach ? <Lesdag coachId={currentUser.id} /> : null}

      {/* Wat er met een aanvraag gebeurde. Staat bovenaan en verdwijnt na een week vanzelf:
          er valt niets weg te klikken, en een bericht van drie weken oud is geen bericht. */}
      {teTonen.map((les) => (
        <Card key={les.id} style={styles.geweigerd}>
          <View style={styles.geweigerdRij}>
            <View style={styles.geweigerdIcoon}>
              <XCircle size={22} color={tennisColors.danger} />
            </View>
            <View style={styles.geweigerdTekst}>
              <Text style={styles.geweigerdTitel}>{t('Je aanvraag is geweigerd')}</Text>
              <Text style={styles.geweigerdSub}>
                {formatDayTimeRange(les.start_time, les.end_time)}
              </Text>
              <Text style={styles.geweigerdSub}>
                {t('Vraag gerust een ander uur aan.')}
              </Text>
            </View>
            {/* Wegklikken kan meteen: gelezen is gelezen, en zeven dagen naar hetzelfde
                bericht kijken is geen bericht meer maar behang. */}
            <Pressable
              onPress={() => klikWeg(les.id)}
              accessibilityRole="button"
              accessibilityLabel={t('Bericht wegklikken')}
              style={styles.wegknop}
              hitSlop={8}
            >
              <X size={20} color={tennisColors.textMuted} />
            </Pressable>
          </View>
        </Card>
      ))}

      {/* Bij meer dan één bericht: alles in één keer weg. Ze stuk voor stuk wegtikken is
          werk dat niets oplevert — je hebt ze toch al gelezen. */}
      {teTonen.length > 1 ? (
        <Button
          label={t('Geweigerde aanvragen wissen')}
          variant="secondary"
          onPress={() => klikAllesWeg(teTonen.map((les) => les.id))}
        />
      ) : null}

      {/* Een speler die nog moet afrekenen, ziet dat vóór de tegels — met het bedrag erbij.
          Staat er niets open, dan staat er ook niets: een kaart met "€ 0,00" is ruis. */}
      {!coach && balance.amount > 0 ? (
        <Card
          onPress={() => router.push('/agenda/overzicht')}
          accessibilityLabel={t('Openstaand saldo € {bedrag}', { bedrag: formatEuro(balance.amount) })}
          style={styles.balance}
        >
          <View style={styles.balanceRow}>
            <View style={styles.balanceIcon}>
              <Wallet size={22} color={tennisColors.warning} />
            </View>
            <View style={styles.balanceText}>
              <Text style={styles.balanceLabel}>{t('Openstaand saldo')}</Text>
              <Text style={styles.balanceAmount}>€ {formatEuro(balance.amount)}</Text>
              <Text style={styles.balanceSub}>
                {balance.lessons === 1
                  ? t('1 les nog niet afgerekend')
                  : t('{n} lessen nog niet afgerekend', { n: balance.lessons })}
              </Text>
            </View>
            <ChevronRight size={20} color={tennisColors.textMuted} />
          </View>
        </Card>
      ) : null}

      <TileGrid>
        {tiles.map((tile) => (
          <ActionTile
            key={tile.key}
            title={tile.title}
            subtitle={tile.subtitle}
            icon={tile.icon}
            onPress={tile.onPress}
            primary={tile.primary}
            badge={tile.badge}
          />
        ))}
      </TileGrid>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerText: { flex: 1, gap: spacing.xs },
  hi: { ...typography.h1, color: tennisColors.text },
  q: { fontSize: 16, color: tennisColors.textMuted },
  // Een randje in de waarschuwingskleur in plaats van een volvlak: het vraagt aandacht,
  // maar een openstaand bedrag is geen fout en hoort de tegels eronder niet te overschreeuwen.
  // Een randje in de foutkleur: het vraagt aandacht, maar het is geen ramp en het hoort de
  // tegels eronder niet te overschreeuwen. Zelfde vorm als het openstaande saldo.
  geweigerd: { borderWidth: 1, borderColor: tennisColors.danger },
  geweigerdRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  geweigerdIcoon: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: tennisColors.dangerTint,
  },
  geweigerdTekst: { flex: 1 },
  wegknop: { padding: 4 },
  geweigerdTitel: { ...typography.h3, color: tennisColors.text },
  geweigerdSub: { fontSize: 13, color: tennisColors.textMuted },
  balance: { borderWidth: 1, borderColor: tennisColors.warning },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  balanceIcon: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: tennisColors.warningTint,
  },
  balanceText: { flex: 1 },
  balanceLabel: {
    ...typography.label,
    color: tennisColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceAmount: { ...typography.h1, color: tennisColors.text },
  balanceSub: { fontSize: 13, color: tennisColors.textMuted },
});
