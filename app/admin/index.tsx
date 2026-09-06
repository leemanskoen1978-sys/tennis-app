import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CreditCard, BarChart3, LayoutGrid, Settings as SettingsIcon, Target, Ticket,
  Users, UserCog, BookOpen, CalendarOff, GraduationCap,
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

  // Zeventien tegels waarvan twaalf onder "Club" is geen indeling maar een bak. Vier
  // groepen van drie of vier, en één tegel die de tennisschool achter zich verbergt: zo
  // zie je in één oogopslag waar je moet zijn — gaat het over geld, over de lessen van de
  // school, over de club zelf, of over de app.
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
      key: 'tennisschool',
      label: t('Tennisschool'),
      tiles: [
        // Alleen voor een beheerder, en om dezelfde redenen als de vier schermen die
        // erachter zitten: de tennisschool is van de club, een gewone trainer houdt zijn
        // eigen agenda (D-09), een zieke trainer is een zaak van de club (D-12) en het
        // bestand achter de import en de export gaat over alle trainers samen (D-06). Dat
        // de tegel hier wegblijft is wellevendheid en geen bewaking — het scherm erachter
        // doet dat werk zelf.
        //
        // De ondertitel noemt de vier schermen bij naam: een tegel die alleen naar een
        // volgend keuzescherm leidt, moet zeggen wat daar te halen valt, anders is één tik
        // extra puur verlies.
        ...(isAdmin(currentUser)
          ? [{ key: 'tennisschool', title: t('Lessen beheren'), subtitle: t('Lesgroepen, ziekmelding, import en export'), icon: GraduationCap, onPress: () => router.push('/admin/tennisschool') } as Tile]
          : []),
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
        // De gesloten dagen van de club en de uren per trainer beantwoorden samen één vraag —
        // wanneer kan er les zijn — en staan daarom op één scherm. De kalender hoort bij de
        // club en niet bij het systeem: het is hetzelfde papier dat anders aan de muur van de
        // kantine hangt.
        { key: 'kalender', title: t('Kalender'), subtitle: vakantieSubtitel, icon: CalendarOff, onPress: () => router.push('/admin/kalender') },
        // Alleen voor een beheerder: hier zit het beheerdersvinkje, en hier verdwijnt een lid
        // met zijn hele geschiedenis. Een gewone trainer maakt spelers aan en houdt het
        // daarbij.
        ...(isAdmin(currentUser)
          ? [{ key: 'leden', title: t('Leden'), subtitle: t('Toevoegen, importeren en gegevens bijwerken'), icon: UserCog, onPress: () => router.push('/admin/leden') } as Tile]
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
        // De ondertitel noemde "Boekingstijden", en die staan sinds de samenvoeging op de
        // Kalender. Een tegel die de inhoud van een andere tegel opsomt, stuurt je precies
        // verkeerd. De clubbrede eindtijd staat hier nog wel, maar alleen als terugval voor
        // een trainer die zelf niets invulde — hem hier noemen zou weer dezelfde reis
        // uitlokken.
        { key: 'set', title: t('Instellingen'), subtitle: t('Lesduur, thema en taal'), icon: SettingsIcon, onPress: () => router.push('/admin/settings') },
        // De doelenlijst is geen clubgegeven zoals een baan of een lid: het zijn de woorden
        // waaruit een trainer kiest als hij een doel op een speler zet. Dat is de app zelf
        // instellen, en daarom staat hij hier.
        { key: 'goals', title: t('Doelen'), subtitle: t('Woordenlijst voor spelersdoelen'), icon: Target, onPress: () => router.push('/admin/goals') },
        // Ook de gids voor spelers staat erin: "wat ziet mijn speler eigenlijk" is een vraag
        // die je aan de baan krijgt, en dan wil je het kunnen laten zien.
        { key: 'help', title: t('Handleiding'), subtitle: t('Voor trainers en voor spelers'), icon: BookOpen, onPress: () => router.push('/admin/handleiding') },
      ],
    },
  ];

  return (
    <Screen>
      {/* Een groep zonder tegels is voor een gewone trainer alleen nog een kopje boven een
          gat: "TENNISSCHOOL" met niets eronder. Weglaten dus. */}
      {groups.filter((g) => g.tiles.length > 0).map((g) => (
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
