// Het e-mailadres en het gsm-nummer op een dossier, maar dan als knop.
//
// Ze stonden er als tekst, en dan is een nummer op een telefoon precies zo bruikbaar als op
// papier: overtikken in een andere app. Eén tik hoort genoeg te zijn — de mail opent met het
// adres al ingevuld, het nummer opent een WhatsApp-gesprek.
//
// Waarom WhatsApp en niet bellen: zo praat een club met haar ouders. Wie wil bellen, houdt
// het nummer ingedrukt en kopieert het — dat kan een telefoon zelf.
//
// Wat er niet in de link staat: een onderwerp of een begin van een bericht. Wat de trainer
// wil schrijven weet hij zelf, en een half ingevulde tekst is lastiger weg te krijgen dan
// een lege.

import React from 'react';
import { View, Text, Pressable, Linking, StyleSheet } from 'react-native';
import { Mail, MessageCircle } from 'lucide-react-native';

import { mailtoLink, whatsappLink } from '../../lib/contact';
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography, minTapTarget, webCursor } from '../../constants/theme';

function Regel({
  tekst, link, label, icoon,
}: {
  tekst: string;
  /** Waar de tik heen gaat, of `null`: dan blijft het gewone tekst. */
  link: string | null;
  label: string;
  icoon: React.JSX.Element;
}): React.JSX.Element {
  if (link === null) return <Text style={styles.tekst}>{tekst}</Text>;
  return (
    <Pressable
      onPress={() => { void Linking.openURL(link); }}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.regel, webCursor, pressed && styles.gedrukt]}
    >
      {icoon}
      <Text style={styles.link}>{tekst}</Text>
    </Pressable>
  );
}

/** De contactregels van één lid. Wat leeg is, komt er niet te staan. */
export function ContactRegels({
  email, phone,
}: {
  email?: string;
  phone?: string;
}): React.JSX.Element | null {
  const t = useT();
  if (!email && !phone) return null;
  return (
    <View>
      {email ? (
        <Regel
          tekst={email}
          link={mailtoLink(email)}
          label={t('Mail naar {adres}', { adres: email })}
          icoon={<Mail size={16} color={tennisColors.primary} />}
        />
      ) : null}
      {phone ? (
        <Regel
          tekst={phone}
          link={whatsappLink(phone)}
          label={t('WhatsApp naar {nummer}', { nummer: phone })}
          icoon={<MessageCircle size={16} color={tennisColors.primary} />}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  regel: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    minHeight: minTapTarget, alignSelf: 'flex-start',
  },
  link: { ...typography.body, color: tennisColors.primary, fontWeight: '600' },
  tekst: { ...typography.body, color: tennisColors.textMuted, marginTop: spacing.xs },
  gedrukt: { opacity: 0.7 },
});
