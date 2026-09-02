// Profiel — wie je bent, twee cijfers over je dag, je gegevens en de weg naar de rest.
// De systeeminstellingen zelf staan in Beheer; hier staan alleen de snelkoppelingen.
//
// Let op wat hier bewust NIET staat: een schakelaar tussen Trainer en Speler. Een rol is
// bij ons een eigenschap van de gebruiker, geen knop — je wisselt van rol door als iemand
// anders in te loggen. Een schakelaar zou iets beloven wat de app niet doet.

import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  LogOut, Mail, Phone, Euro, CalendarDays, CreditCard, ChevronRight,
  Settings as SettingsIcon, BarChart3, SlidersHorizontal, Wallet, Clock, type LucideIcon,
} from 'lucide-react-native';

import { Screen, useIsWide } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatCard, StatCardRow } from '../components/ui/StatCard';
import { initials } from '../components/ui/ProfileAvatar';
import { spacing, radius, typography, webCursor, minTapTarget } from '../constants/theme';
import { tennisColors } from '../constants/tennis-colors';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { useActieveSpeler, useOpenstaandeBetalingen } from '../providers/kindkeuze';
import { bookingsToday } from '../lib/hub';
import { bookingsFor, openBalanceFor } from '../lib/payments';
import { coachPayoutThisMonth } from '../lib/reports';
import { formatEuro } from '../lib/money';
import { useT } from '../lib/i18n';
import { isAdmin, isCoach, roleLabel } from '../lib/rechten';
import { DetailSheet } from '../components/ui/DetailSheet';

interface Row {
  key: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress?: () => void;
}

/** Een kopje in de stijl die de rest van de app gebruikt, met de rijen eronder in één kaart. */
function Section({ label, rows }: { label: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Card style={styles.rowCard}>
        {rows.map((r, i) => (
          <InfoRow key={r.key} row={r} first={i === 0} />
        ))}
      </Card>
    </View>
  );
}

function InfoRow({ row, first }: { row: Row; first: boolean }) {
  const Icon = row.icon;
  const body = (
    <>
      <View style={styles.rowIcon}>
        <Icon size={18} color={tennisColors.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{row.title}</Text>
        <Text style={styles.rowSub}>{row.subtitle}</Text>
      </View>
      {row.onPress ? <ChevronRight size={18} color={tennisColors.textMuted} /> : null}
    </>
  );

  // Een rij zonder onPress is alleen informatie; die krijgt geen knoprol en geen pijl,
  // zodat je niet gaat tikken op iets wat niets doet.
  if (!row.onPress) {
    return <View style={[styles.row, !first && styles.rowDivider]}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={row.title}
      onPress={row.onPress}
      style={(state) => [
        styles.row,
        !first && styles.rowDivider,
        webCursor,
        (state as { hovered?: boolean }).hovered && styles.rowHovered,
        state.pressed && styles.rowPressed,
      ]}
    >
      {body}
    </Pressable>
  );
}

export default function ProfileScreen(): React.JSX.Element {
  const t = useT();
  const router = useRouter();
  const { currentUser, logout, bookings, courts, updateUser, error } = useSimpleData();
  // Het uurloon bijstellen, voor wie het mag. Een eigen blaadje en geen scherm: het is één
  // getal, en ervoor naar Beheer → Leden moeten is precies waarom niemand het terugvond.
  const [tariefOpen, setTariefOpen] = useState(false);
  const [tarief, setTarief] = useState('');
  const coach = isCoach(currentUser);
  const pending = useOpenstaandeBetalingen();
  // Het profiel gaat over het account — naam, adres, rol — maar de twee getallen eronder
  // gaan over lessen. Een ouder heeft die zelf niet; die van zijn kind zijn wat hij zoekt,
  // en het is ook zijn rekening. Zie providers/kindkeuze.
  const speler = useActieveSpeler();
  const isWide = useIsWide();

  if (!currentUser) {
    return (
      <Screen>
        <Card>
          <Text style={styles.rowSub}>{t('Niet ingelogd')}</Text>
        </Card>
      </Screen>
    );
  }

  const rol = roleLabel(currentUser.role);

  // Dezelfde twee getallen als op het hoofdscherm, en langs dezelfde weg berekend: een
  // trainer kijkt naar de agenda van de dag, een speler naar zijn eigen lessen.
  // `bookingsFor` en niet zelf filteren: zo ziet een speler ook de groepslessen waarin
  // hij meespeelt zonder te betalen.
  const myBookings = bookingsFor(speler, bookings);
  const today = bookingsToday(coach ? bookings : myBookings, new Date());

  // Wat een trainer deze maand verdiende: zijn eigen uurtarief over zijn eigen lessen. Dus
  // niet de omzet — die loopt op het uurtarief van de baan en is wat de spelers betalen.
  // Zonder ingevuld tarief is dat 0, en dat zeggen we er hieronder met zoveel woorden bij.
  // Wat een speler nog moet afrekenen — hetzelfde bedrag als op zijn hoofdscherm.
  const balance = openBalanceFor(speler, bookings, courts);

  const rateMissing = currentUser.hourly_rate === undefined;
  const magTarief = isAdmin(currentUser);
  const earnedThisMonth = coachPayoutThisMonth(currentUser, bookings);

  const contactRows: Row[] = [
    { key: 'mail', icon: Mail, title: currentUser.email, subtitle: t('E-mailadres') },
    {
      key: 'phone',
      icon: Phone,
      title: currentUser.phone ?? t('Niet ingevuld'),
      subtitle: t('Telefoonnummer'),
    },
  ];
  // De rij staat er bij een trainer altijd, ook zonder tarief: zolang hij leeg is, is zijn
  // loon nul, en dat hoort te zien te zijn in plaats van weg te vallen met de rij.
  //
  // Een beheerder wijzigt hem hier ook. Dat het uurloon alleen in Beheer te zetten was,
  // klopte wel met de regel — een trainer hoort zijn eigen loon niet te kunnen verhogen —
  // maar niet met wat je hier ziet staan: het bedrag stond op je eigen profiel zonder één
  // aanwijzing waar je het dan wél verandert. Wie het niet mag, leest dat nu in de rij.
  if (coach) {
    contactRows.push({
      key: 'rate',
      icon: Euro,
      title: rateMissing ? t('Nog niet ingesteld') : `€ ${currentUser.hourly_rate}`,
      subtitle: magTarief ? t('Jouw uurtarief · tik om te wijzigen') : t('Jouw uurtarief · je beheerder stelt dit in'),
      ...(magTarief ? { onPress: () => { setTarief(rateMissing ? '' : String(currentUser.hourly_rate)); setTariefOpen(true); } } : {}),
    });
  }

  // Alleen schermen die echt bestaan, en alleen de stukken uit Beheer die over jouw eigen
  // werk gaan. De rest van Beheer blijft één rij lager bereikbaar.
  const settingRows: Row[] = coach
    ? [
        {
          key: 'set',
          icon: SettingsIcon,
          title: t('Instellingen'),
          subtitle: t('Boekingstijden, thema en taal'),
          onPress: () => router.push('/admin/settings'),
        },
        {
          key: 'tijden',
          icon: Clock,
          title: t('Boekingstijden'),
          subtitle: t('Jouw uren, en afwijkende periodes'),
          onPress: () => router.push('/admin/boekingstijden'),
        },
        {
          key: 'rep',
          icon: BarChart3,
          title: t('Rapport'),
          subtitle: t('Jouw boekingen per betaalwijze'),
          onPress: () => router.push('/admin/reports'),
        },
        {
          key: 'pay',
          icon: CreditCard,
          title: t('Betalingen'),
          subtitle: t('Openstaande lessen afhandelen'),
          onPress: () => router.push('/admin/payments'),
        },
        {
          key: 'admin',
          icon: SlidersHorizontal,
          title: t('Beheer'),
          subtitle: t('Banen, doelen, beurtenkaarten en leden'),
          onPress: () => router.push('/admin'),
        },
      ]
    : [];

  return (
    <Screen contentStyle={styles.screenContent}>
      <LinearGradient
        colors={[tennisColors.primaryFill, tennisColors.primaryFillDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, isWide && styles.heroWide]}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(currentUser.name)}</Text>
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroName} numberOfLines={2}>
            {currentUser.name}
          </Text>
          <Text style={styles.heroRole}>{rol}</Text>
        </View>
      </LinearGradient>

      {/* De kaartjes vallen over de onderrand van de band; de band houdt daar extra
          ruimte vrij zodat de naam er nooit achter verdwijnt. */}
      <View style={styles.statsWrap}>
        <StatCardRow>
          <StatCard icon={CalendarDays} value={today} label={t('Lessen vandaag')} />
          {/* Een trainer telt lessen die hij nog moet afhandelen; een speler wil weten
              hoeveel hij nog moet betalen. Zelfde plek, ander getal. */}
          {coach ? (
            <StatCard
              icon={CreditCard}
              value={pending.length}
              label={t('Openstaande betalingen')}
              tone={pending.length > 0 ? 'warning' : 'primary'}
            />
          ) : (
            <StatCard
              icon={CreditCard}
              value={`€${formatEuro(balance.amount)}`}
              label={t('Openstaand saldo')}
              tone={balance.amount > 0 ? 'warning' : 'primary'}
            />
          )}
          {coach ? (
            <StatCard
              icon={Wallet}
              value={`€${formatEuro(earnedThisMonth)}`}
              label={t('Verdiend deze maand')}
              tone={rateMissing ? 'warning' : 'primary'}
            />
          ) : null}
        </StatCardRow>
        {coach && rateMissing ? (
          <Text style={styles.rateWarning}>
            {t('Je uurtarief is nog niet ingesteld, dus je verdiensten blijven op €0,00 staan.')}
          </Text>
        ) : null}
      </View>

      <View style={styles.body}>
        <Section label={t('Contact')} rows={contactRows} />
        <Section label={t('Instellingen')} rows={settingRows} />
        <Button
          label={t('Uitloggen')}
          variant="secondary"
          icon={<LogOut size={18} color={tennisColors.text} />}
          onPress={() => {
            void logout();
          }}
        />
      </View>

      <DetailSheet
        title={t('Jouw uurtarief')}
        visible={tariefOpen}
        onClose={() => setTariefOpen(false)}
      >
        <Text style={styles.tariefHelp}>
          {t('Wat de club jou per uur uitbetaalt. Alleen ter informatie — de omzet loopt op '
            + 'het tarief van de baan. Leeg laten mag: dan staat er "nog niet ingesteld".')}
        </Text>
        <TextInput
          style={styles.tariefInput}
          value={tarief}
          onChangeText={setTarief}
          keyboardType="numeric"
          placeholder={t('bv. 35')}
          placeholderTextColor={tennisColors.textMuted}
        />
        {error ? <Text style={styles.tariefFout}>{error}</Text> : null}
        <Button
          label={t('Bewaren')}
          variant="primary"
          onPress={() => {
            const bedrag = Number(tarief.replace(',', '.'));
            const leeg = tarief.trim() === '';
            // Een onleesbaar bedrag laat het blad open staan: zo blijft zichtbaar wat er
            // getypt is, in plaats van het stilzwijgend weg te gooien.
            if (!leeg && !Number.isFinite(bedrag)) return;
            void updateUser(currentUser.id, { hourly_rate: leeg ? undefined : bedrag })
              .then(() => setTariefOpen(false), () => {});
          }}
        />
      </DetailSheet>
    </Screen>
  );
}

const OVERLAP = 44;

const styles = StyleSheet.create({
  tariefHelp: { fontSize: 13, color: tennisColors.textMuted },
  tariefInput: {
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: tennisColors.text, backgroundColor: tennisColors.surface, marginTop: spacing.sm,
  },
  tariefFout: { color: tennisColors.danger, fontSize: 14, marginTop: spacing.sm },
  // De band loopt tot aan de rand van de kolom, dus Screen mag hier zelf niet padden;
  // de secties eronder nemen die marge weer op zich.
  screenContent: { padding: 0, gap: 0 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    // Onderaan de overlap van de kaartjes plus lucht, anders raken ze de naam.
    paddingBottom: OVERLAP + spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  // Op een breed venster zweeft de kolom midden op de pagina; dan hoort de band een
  // afgeronde doos te zijn en geen band die nergens aan vastzit.
  heroWide: {
    borderRadius: radius.xl,
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tennisColors.onFillWash,
    borderWidth: 3,
    borderColor: tennisColors.onFill,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: tennisColors.onFill },
  heroText: { flex: 1, gap: spacing.xs },
  heroName: { ...typography.h1, color: tennisColors.onFill },
  heroRole: { fontSize: 15, color: tennisColors.onFillMuted },
  statsWrap: { marginTop: -OVERLAP, paddingHorizontal: spacing.lg, gap: spacing.sm },
  rateWarning: { fontSize: 13, color: tennisColors.warning },
  body: { padding: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionLabel: {
    ...typography.label,
    color: tennisColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // De kaart tekent zelf geen ruimte tussen de rijen: de scheidingslijnen doen dat.
  rowCard: { paddingVertical: 0, paddingHorizontal: 0, gap: 0, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTapTarget + spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: tennisColors.border },
  rowHovered: { backgroundColor: tennisColors.primaryTint },
  rowPressed: { opacity: 0.9 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tennisColors.primaryTint,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...typography.h3, color: tennisColors.text },
  rowSub: { fontSize: 13, color: tennisColors.textMuted },
});
