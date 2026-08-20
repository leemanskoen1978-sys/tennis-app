import { View, Image, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tennisColors } from '../../constants/tennis-colors';

/**
 * The COACH artwork behind the whole app.
 *
 * It is stored as a transparent PNG in the app's own green rather than as the original
 * picture, so no pale rectangle is laid over everything. The colour is baked in: Image
 * tintColor is not painted reliably by react-native-web, and this colour never changes.
 * Kept faint on purpose — cards and forms sit on opaque white, so the mark reads in the
 * margins without ever competing with a line of text.
 */
export function AppBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[tennisColors.background, tennisColors.primaryTint, tennisColors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.markArea}>
        <Image
          source={require('../../assets/coach-mark.png')}
          style={styles.mark}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel=""
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // A box that owns the lower half of the screen; the image fills it. Sizing the image
  // itself with left/right plus width collapsed it to nothing on the web.
  markArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '6%',
    height: '46%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  // De dekking komt uit het thema: op donker moet het teken sterker staan om even
  // aanwezig te zijn (zie `decor` in constants/tennis-colors).
  mark: {
    width: '92%',
    height: '100%',
    opacity: Platform.OS === 'web' ? ('var(--tc-mark-opacity)' as unknown as number) : 0.16,
  },
});
