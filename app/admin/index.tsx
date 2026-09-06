import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CreditCard, BarChart3, LayoutGrid, Settings as SettingsIcon, Target, Ticket,
  Users, UserCog, BookOpen, CalendarOff, GraduationCap, FileSpreadsheet,
  Thermometer, FileUp,
  type LucideIcon,
} from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { ActionTile, TileGrid } from '../../components/ui/ActionTile';
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
  const { currentUser, relaties, settings } = useSimpleData();
  const pending = usePendingPaymentBookings();

  if (!isCoach(currentUser)) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Beheer is alleen voor trainers.')}</Text>
      </Screen>
    );
  }

  // Het aantal op de tegel is er om het lege geval op te merken: zolang de clubkalender
  // leeg is, rekent de app met les het hele jaar door — en dat merk je pas als er lessen in
  // de kerstvakantie blijken te staan.
  const vakanties = settings.vakanties ?? [];
  const vakantieSubtitel = vakanties.length === 0
    ? t('Nog geen vakanties ingevuld')
    : vakanties.length === 1
      ? t('1 periode zonder les')
      : t('{n} periodes zonder les', { n: vakanties.length });

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
        // Alleen voor een beheerder: het uurtarief van een baan is wat een speler per uur
        // betaalt, dus dit is geld, en geld is van de beheerder. Dat de tegel hier wegblijft
        // is wellevendheid en geen bewaking — het scherm zelf en de policy `courts_write`
        // doen dat werk.
        ...(isAdmin(currentUser)
          ? [{ key: 'courts', title: t('Banen'), subtitle: t('Namen en uurtarieven'), icon: LayoutGrid, onPress: () => router.push('/admin/courts') } as Tile]
          : []),
        { key: 'goals', title: t('Doelen'), subtitle: t('Woordenlijst voor spelersdoelen'), icon: Target, onPress: () => router.push('/admin/goals') },
        // De gesloten dagen van de club en de uren per trainer beantwoorden samen één vraag —
        // wanneer kan er les zijn — en staan daarom op één scherm. De kalender hoort bij de
        // club en niet bij het systeem: het is hetzelfde papier dat anders aan de muur van de
        // kantine hangt.
        { key: 'kalender', title: t('Kalender'), subtitle: vakantieSubtitel, icon: CalendarOff, onPress: () => router.push('/admin/kalender') },
        // Alleen voor een beheerder: hier zit het beheerdersvinkje, en hier verdwijnt een lid
        // met zijn hele geschiedenis. Een gewone trainer maakt spelers aan en houdt het
        // daarbij.
        // Ook alleen voor een beheerder: de tennisschool is van de club, en een gewone trainer
        // houdt zijn eigen agenda (D-09). Dat de tegel hier wegblijft is wellevendheid en geen
        // bewaking — het scherm zelf en de policies op lesson_groups doen dat werk.
        ...(isAdmin(currentUser)
          ? [{ key: 'lesgroepen', title: t('Lesgroepen'), subtitle: t('Naam, niveau, rooster en spelers'), icon: GraduationCap, onPress: () => router.push('/admin/lesgroepen') } as Tile]
          : []),
        // Een zieke trainer is een zaak van de club en niet van de trainer zelf: hij meldt
        // zich in deze versie niet zelf ziek (D-12). Dat de tegel hier wegblijft voor een
        // gewone trainer is wellevendheid en geen bewaking — het scherm zelf en de policies
        // op sick_leaves doen dat werk.
        ...(isAdmin(currentUser)
          ? [{ key: 'ziekmelding', title: t('Ziekmelding'), subtitle: t('Werklijst en vervangers'), icon: Thermometer, onPress: () => router.push('/admin/ziekmelding') } as Tile]
          : []),
        ...(isAdmin(currentUser)
          ? [{ key: 'leden', title: t('Leden'), subtitle: t('Toevoegen, importeren en gegevens bijwerken'), icon: UserCog, onPress: () => router.push('/admin/leden') } as Tile]
          : []),
        // Het bestand gaat over de hele club — alle trainers, alle groepen — en dat is niet
        // wat een gewone trainer van zijn collega's hoort mee te nemen. Dat de tegel hier
        // wegblijft is wellevendheid en geen bewaking: het scherm zelf doet dat werk (D-06),
        // en het is deze fase de enige grens, want er is geen tabel en dus geen policy achter.
        ...(isAdmin(currentUser)
          ? [{ key: 'export', title: t('Trainingen exporteren'), subtitle: t('Eén Excel-bestand per periode'), icon: FileSpreadsheet, onPress: () => router.push('/admin/export') } as Tile]
          : []),
        // De tegenhanger van de export, en om dezelfde reden alleen voor de beheerder: dit
        // bestand gaat over de hele club en maakt in één beurt lesgroepen, spelers en lessen
        // aan. Het scherm zelf bewaakt die grens ook (D-06); dit is de wellevendheid.
        ...(isAdmin(currentUser)
          ? [{ key: 'import-trainingen', title: t('Trainingen importeren'), subtitle: t('Een seizoen uit Excel'), icon: FileUp, onPress: () => router.push('/admin/trainingen-import') } as Tile]
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
