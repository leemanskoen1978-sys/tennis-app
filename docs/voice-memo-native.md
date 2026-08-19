# Spraakmemo op iPhone / Android (native)

De webversie neemt op via de browser (`MediaRecorder`) — zie `components/VoiceRecorder.tsx`.
Voor een echte iOS/Android-app doen we dit met **expo-av**.

## Stappen

1. Installeren: `npx expo install expo-av`
2. Rechten (`app.json`):
   - iOS: `NSMicrophoneUsageDescription` in `ios.infoPlist`
   - Android: `RECORD_AUDIO` permission
3. Opnemen:
   ```ts
   import { Audio } from 'expo-av';

   await Audio.requestPermissionsAsync();
   await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
   const { recording } = await Audio.Recording.createAsync(
     Audio.RecordingOptionsPresets.HIGH_QUALITY,
   );
   // ... later:
   await recording.stopAndUnloadAsync();
   const uri = recording.getURI(); // file:// pad op het toestel
   ```
4. Afspelen: `const { sound } = await Audio.Sound.createAsync({ uri }); await sound.playAsync();`
5. Opslag: de `uri` is een lokaal bestandspad. Voor online bewaren later uploaden naar
   Supabase Storage en de public URL in `student_progress.voice_memo_uri` zetten.

## Waarom nu nog niet

`expo-av` werkt alleen in een echte native build (niet in de browsertest). De web-opname
dekt de lokale test af; de native laag voegen we toe zodra we naar iOS/Android bouwen.
