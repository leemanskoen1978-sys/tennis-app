import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CalendarDays, CalendarSearch, ChevronRight, GraduationCap, Pencil, BookOpen, UserPlus,
} from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { UserManagement } from '../../components/UserManagement';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { playersForCoach } from '../../lib/relations';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';
import { useT, useLanguage } from '../../lib/i18n';
import { coachesOf } from '../../lib/hub';
import { dossierPad } from '../../lib/dossier';
import { useActieveSpeler } from '../../providers/kindkeuze';
import { openstaandeLessen } from '../../lib/openstaand';
import { openZiekmeldingen } from '../../lib/ziekmelding';
import { isCoach } from '../../lib/rechten';

export default function Coaches() {
  const t = useT();
  const lang = useLanguage();
  const router = useRouter();
  const {
    currentUser, users, bookings, lessons, progress, sickLeaves, settings,
  } = useSimpleData();
  const speler = useActieveSpeler();
  // Je eigen dossier: je agenda, je week en je spelers staan daar bij elkaar. Stond eerder
  // als tegel op Home, maar dat scherm droeg tegels naar plekken die ook al in de tabbalk
  // stonden; wat over jezelf gaat hoort bij de trainers.
  const dossier = dossierPad(currentUser, speler);
  const [addOpen, setAddOpen] = useState(false);

  const coaches = coachesOf(users)
    .sort((a, b) => a.name.localeCompare(b.name, lang));

  // Alleen voor wie zelf lesgeeft. Een ouder die leest dat de les van zijn kind geen trainer
  // heeft, belt de club over iets wat binnen het uur opgelost is.
  const mijnOpenstaand = isCoach(currentUser)
    ? openstaandeLessen(
      bookings, openZiekmeldingen(sickLeaves), settings.vakanties ?? [], new Date(),
      currentUser.id,
    ).length
    : 0;

  return (
    <Screen>
      {/* Boven het gereedschap en niet erin: dat kopje gaat over materiaal, en dit gaat
          over jou. */}
      {dossier ? (
        <Card onPress={() => router.push(dossier)} accessibilityLabel={t('Mijn agenda')} style={styles.row}>
          <View style={styles.rowContent}>
            <View style={styles.icon}><CalendarDays size={20} color={tennisColors.primary} /></View>
            <Text style={styles.rowLabel}>{t('Mijn agenda')}</Text>
            <ChevronRight size={20} color={tennisColors.textMuted} />
          </View>
        </Card>
      ) : null}

      {/* A coach's tools belong with Trainers, not as separate main entrances. */}
      <Text style={styles.section}>{t('Gereedschap')}</Text>
      {isCoach(currentUser) && (
        <Card
          onPress={() => router.push('/coaches/openstaand')}
          accessibilityLabel={t('Lessen zonder trainer')}
          style={styles.row}
        >
          <View style={styles.rowContent}>
            <View style={styles.icon}>
              <CalendarSearch size={20} color={tennisColors.primary} />
            </View>
            <Text style={styles.rowLabel}>{t('Lessen zonder trainer')}</Text>
            {/* Staat er niets open, dan staat er "geen" en verdwijnt de regel niet: een regel
                die weggaat laat je twijfelen of je hem wel goed onthouden had. */}
            <Text style={styles.meta}>
              {mijnOpenstaand === 0 ? t('geen') : String(mijnOpenstaand)}
            </Text>
            <ChevronRight size={20} color={tennisColors.textMuted} />
          </View>
        </Card>
      )}
      <Card onPress={() => router.push('/coaches/lessons')} accessibilityLabel={t('Lesmateriaal')} style={styles.row}>
        <View style={styles.rowContent}>
          <View style={styles.icon}><BookOpen size={20} color={tennisColors.primary} /></View>
          <Text style={styles.rowLabel}>{t('Lesmateriaal')}</Text>
          <ChevronRight size={20} color={tennisColors.textMuted} />
        </View>
      </Card>
      <Card onPress={() => router.push('/coaches/drawing')} accessibilityLabel={t('Tekenveld')} style={styles.row}>
        <View style={styles.rowContent}>
          <View style={styles.icon}><Pencil size={20} color={tennisColors.primary} /></View>
          <Text style={styles.rowLabel}>{t('Tekenveld')}</Text>
          <ChevronRight size={20} color={tennisColors.textMuted} />
        </View>
      </Card>

      <Text style={styles.section}>{t('Trainers')}</Text>
      {coaches.map((c) => {
        const n = playersForCoach(c.id, bookings, lessons, progress).length;
        return (
          <Card key={c.id} onPress={() => router.push(`/coaches/${c.id}`)} accessibilityLabel={c.name} style={styles.row}>
            <View style={styles.rowContent}>
              <View style={styles.icon}><GraduationCap size={20} color={tennisColors.primary} /></View>
              <View style={styles.info}>
                <Text style={styles.name}>{c.name}</Text>
                {/* Alleen hoeveel spelers hij heeft. Het uurloon stond hier ook, maar deze
                    lijst staat open voor iedereen die de app opent, en wat een trainer
                    verdient hoort niet bij het kiezen van een trainer. Het staat nog waar
                    het thuishoort: in zijn eigen dossier en in Beheer. */}
                <Text style={styles.meta}>
                  {n === 1 ? t('1 speler') : t('{n} spelers', { n })}
                </Text>
              </View>
              <ChevronRight size={20} color={tennisColors.textMuted} />
            </View>
          </Card>
        );
      })}

      <Button
        label={t('Trainer toevoegen')}
        variant="secondary"
        icon={<UserPlus size={18} color={tennisColors.text} />}
        onPress={() => setAddOpen(true)}
      />
      <UserManagement visible={addOpen} onClose={() => setAddOpen(false)} defaultRole="coach" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { ...typography.h2, color: tennisColors.text, marginTop: spacing.sm },
  row: {},
  rowContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: tennisColors.primaryTint,
  },
  info: { flex: 1 },
  rowLabel: { flex: 1, ...typography.h3, color: tennisColors.text },
  name: { ...typography.h3, color: tennisColors.text },
  meta: { fontSize: 13, color: tennisColors.textMuted },
});
