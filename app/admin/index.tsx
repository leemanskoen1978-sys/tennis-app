import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CreditCard, BarChart3, LayoutGrid, Settings as SettingsIcon, UserPlus, Target, Ticket,
  Upload, Users, UserCog, BookOpen, type LucideIcon,
} from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { ActionTile, TileGrid } from '../../components/ui/ActionTile';
import { UserManagement } from '../../components/UserManagement';
import { useSimpleData, usePendingPaymentBookings } from '../../providers/SimpleDataProvider';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';
import { useT } from '../../lib/i18n';
import { isAdmin, isCoach } from '../../lib/rechten';
import { openAanvragen } from '../../lib/ouderkind';

interface Tile {
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  onPress: () => void;
  badge?: number;
}

/** The club, the money and the system. Everything here used to hide in a bottom sheet. */
export default function Admin() {
  const t = useT();
  const router = useRouter();
  const { currentUser, relaties } = useSimpleData();
  const pending = usePendingPaymentBookings();
  const [addOpen, setAddOpen] = useState(false);

  if (!isCoach(currentUser)) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Beheer is alleen voor trainers.')}</Text>
      </Screen>
    );
  }

  // Zes gelijkwaardige tegels op een rij zeggen niets. Gegroepeerd zie je in één oogopslag
  // waar je moet zijn: gaat het over geld, over de club zelf, of over de app.
  const groups: Array<{ key: string; label: string; tiles: Tile[] }> = [
    {
      key: 'geld',
      label: t('Geld'),
      tiles: [
        { key: 'pay', title: t('Betalingen'), subtitle: t('Openstaande lessen afhandelen'), icon: CreditCard, onPress: () => router.push('/admin/payments'), badge: pending.length },
        { key: 'cards', title: t('Beurtenkaarten'), subtitle: t('Kaarten en resterende beurten'), icon: Ticket, onPress: () => router.push('/admin/beurtenkaarten') },
        { key: 'rep', title: t('Rapport'), subtitle: t('Omzet en aantallen'), icon: BarChart3, onPress: () => router.push('/admin/reports') },
      ],
    },
    {
      key: 'club',
      label: t('Club'),
      tiles: [
        { key: 'courts', title: t('Banen'), subtitle: t('Namen en uurtarieven'), icon: LayoutGrid, onPress: () => router.push('/admin/courts') },
        { key: 'goals', title: t('Doelen'), subtitle: t('Woordenlijst voor spelersdoelen'), icon: Target, onPress: () => router.push('/admin/goals') },
        { key: 'add', title: t('Speler toevoegen'), subtitle: t('Nieuw lid aanmaken'), icon: UserPlus, onPress: () => setAddOpen(true) },
        { key: 'import', title: t('Leden importeren'), subtitle: t('Uit een Excel-lijst'), icon: Upload, onPress: () => router.push('/admin/leden-import') },
        // Alleen voor een beheerder: hier zit het beheerdersvinkje, en hier verdwijnt een lid
        // met zijn hele geschiedenis. Een gewone trainer maakt spelers aan en houdt het
        // daarbij.
        ...(isAdmin(currentUser)
          ? [{ key: 'leden', title: t('Leden'), subtitle: t('Gegevens, type account en beheerders'), icon: UserCog, onPress: () => router.push('/admin/leden') } as Tile]
          : []),
        // Het aantal op de tegel is het aantal beslissingen dat op iemand ligt te wachten:
        // zolang er niets gebeurt, ziet een ouder een lege app.
        { key: 'ouders', title: t('Ouders en kinderen'), subtitle: openAanvragen(relaties).length > 0 ? t('{n} wacht op goedkeuring', { n: openAanvragen(relaties).length }) : t('Koppelingen nakijken'), icon: Users, onPress: () => router.push('/admin/ouders'), badge: openAanvragen(relaties).length },
      ],
    },
    {
      key: 'systeem',
      label: t('Systeem'),
      tiles: [
        { key: 'set', title: t('Instellingen'), subtitle: t('Boekingstijden, thema en taal'), icon: SettingsIcon, onPress: () => router.push('/admin/settings') },
        // Ook de gids voor spelers staat erin: "wat ziet mijn speler eigenlijk" is een vraag
        // die je aan de baan krijgt, en dan wil je het kunnen laten zien.
        { key: 'help', title: t('Handleiding'), subtitle: t('Voor trainers en voor spelers'), icon: BookOpen, onPress: () => router.push('/admin/handleiding') },
      ],
    },
  ];

  return (
    <Screen>
      {groups.map((g) => (
        <View key={g.key} style={styles.group}>
          <Text style={styles.sectionLabel}>{g.label}</Text>
          <TileGrid>
            {g.tiles.map((tile) => (
              <ActionTile
                key={tile.key}
                title={tile.title}
                subtitle={tile.subtitle}
                icon={tile.icon}
                onPress={tile.onPress}
                badge={tile.badge}
              />
            ))}
          </TileGrid>
        </View>
      ))}
      <UserManagement visible={addOpen} onClose={() => setAddOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: tennisColors.textMuted, fontSize: 14 },
  group: { gap: spacing.md },
  sectionLabel: {
    ...typography.label,
    color: tennisColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
