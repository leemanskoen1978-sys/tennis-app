// Het blad achter een tegel: een kop met een kruis en daaronder de inhoud die scrollt.
//
// Negen bladen tekenden dit ieder apart — hetzelfde `Modal`, dezelfde backdrop, hetzelfde
// greepje, dezelfde kop met kruisje. Dat was niet alleen negen keer hetzelfde werk: de
// backdrop had onderweg drie verschillende kleuren gekregen, dus je zág aan een blad uit
// welk bestand het kwam. Nu woont de omhulling hier en bepaalt wie een blad opent alleen
// nog wat erin staat.
//
// Drie dingen mogen verschillen, want dat is waar de negen echt in uiteenliepen:
//  - `subtitle` — een tweede regel onder de titel (de dag en het uur van een boeking).
//  - `footer`   — een rij die onder de inhoud vastgepind blijft. Knoppen horen daar: staan
//                 ze in het scrollende deel, dan druk je op Bevestigen terwijl de foutregel
//                 buiten beeld valt.
//  - `scroll`   — uit voor een blad dat altijd op één scherm past. Een korte lijst in een
//                 ScrollView krijgt anders een scrollbalk voor niets.

import React from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';

import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import {
  spacing, radius, typography, shadow, minTapTarget, webCursor, contentMaxWidth,
} from '../../constants/theme';

export function DetailSheet({
  title, subtitle, visible, onClose, footer, scroll = true, children,
}: {
  title: string;
  /** Een tweede regel onder de titel. Tekst of eigen opmaak; leeg laat de regel weg. */
  subtitle?: React.ReactNode;
  visible: boolean;
  onClose: () => void;
  /** Blijft onder de inhoud staan, ook als die scrolt. Bedoeld voor knoppen. */
  footer?: React.ReactNode;
  /** Standaard aan. Uit voor een blad dat altijd op één scherm past. */
  scroll?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const t = useT();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>{title}</Text>
              {typeof subtitle === 'string'
                ? <Text style={styles.subtitle}>{subtitle}</Text>
                : subtitle}
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('Sluiten')}
              style={[styles.close, webCursor]}
            >
              <X size={20} color={tennisColors.textMuted} />
            </Pressable>
          </View>

          {scroll
            ? <ScrollView contentContainerStyle={styles.body}>{children}</ScrollView>
            : <View style={[styles.body, styles.staticBody]}>{children}</View>}

          {footer}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  // De breedte-cap is er voor het web: zonder cap plakt een blad in een venster van 1500 px
  // over de volle breedte, terwijl de rest van de app gecentreerd op zijn maximum staat.
  // Een blad hoort bij het scherm eronder, dus het houdt dezelfde maat aan.
  sheet: {
    width: '100%',
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
    backgroundColor: tennisColors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
    ...shadow('lg'),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.sm,
    backgroundColor: tennisColors.border,
    marginBottom: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // De titel en zijn ondertitel krimpen samen, zodat een lange dagnaam het kruisje niet
  // van het scherm duwt.
  titleWrap: { flexShrink: 1 },
  title: { ...typography.h2, color: tennisColors.text },
  subtitle: { ...typography.body, fontSize: 14, color: tennisColors.textMuted },
  close: {
    minHeight: minTapTarget, minWidth: minTapTarget,
    alignItems: 'flex-end', justifyContent: 'center',
  },
  body: { gap: spacing.sm, paddingBottom: spacing.lg },
  // Een View krimpt in React Native niet uit zichzelf. Zonder dit loopt een blad met een
  // eigen scrollende lijst erin (het boekvenster, het ledenblad) buiten de 85% van het
  // scherm die `sheet` toestaat, en scrolt die lijst dus nooit.
  staticBody: { flexShrink: 1 },
});
