// Het blad achter een tegel: een kop met een kruis en daaronder de inhoud die scrollt.
//
// Het maandoverzicht (components/LessonDetailSheet) en de doelen (components/GoalHorizonSheet)
// tekenden ditzelfde blad ieder apart. Het spelersdossier heeft er vijf nodig, dus staat de
// omhulling hier: één backdrop, één greepje, één kop, één body. Wie een blad opent bepaalt
// alleen nog wat erin staat.

import React from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';

import { tennisColors } from '../../constants/tennis-colors';
import {
  spacing, radius, typography, shadow, minTapTarget, webCursor, contentMaxWidth,
} from '../../constants/theme';

export function DetailSheet({ title, visible, onClose, children }: {
  title: string;
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Sluiten"
              style={[styles.close, webCursor]}
            >
              <X size={20} color={tennisColors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>{children}</ScrollView>
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
  title: { ...typography.h2, color: tennisColors.text, flexShrink: 1 },
  close: {
    minHeight: minTapTarget, minWidth: minTapTarget,
    alignItems: 'flex-end', justifyContent: 'center',
  },
  body: { gap: spacing.sm, paddingBottom: spacing.lg },
});
