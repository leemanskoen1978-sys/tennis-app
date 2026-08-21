// De opnamemotor, los van elke knop.
//
// Hij wordt door twee knoppen gebruikt: het voortgangsblad (start- en stopknop) en de
// memoknop op de baan (indrukken en loslaten). Ze verschillen alleen in hoe ze eruitzien —
// wat eronder gebeurt is hetzelfde, en dat hoort dus één keer te bestaan.
//
// Alleen web. Op een telefoon-app is `MediaRecorder` er niet; `kanOpnemen` is dan false en
// de knop hoort iets anders te tonen in plaats van niets te doen. Zie
// docs/voice-memo-native.md voor de weg daarheen.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useT } from '../lib/i18n';

export interface Opname {
  /** Loopt er op dit moment een opname? */
  bezig: boolean;
  /** Hoe lang die loopt, in milliseconden. Nul zodra hij gestopt is. */
  ms: number;
  /** Wat er misging, in een zin die op de knop past. */
  fout: string | null;
  /** Kan dit toestel überhaupt opnemen? */
  kanOpnemen: boolean;
  start: () => Promise<void>;
  stop: () => void;
}

/** Hoe fijn de teller loopt. Fijn genoeg voor een aftelling, grof genoeg om niets te kosten. */
const TIK_MS = 100;

/**
 * `onKlaar` krijgt de opname als data-URL, met hoe lang hij duurde. Wat er daarna mee
 * gebeurt — bewaren, weggooien omdat hij te kort was — beslist de knop; deze haak oordeelt
 * niet over de inhoud.
 *
 * `maxMs` kapt de opname vanzelf af. Weglaten betekent: geen grens, zoals het
 * voortgangsblad zich altijd al gedroeg.
 */
export function useOpname(
  onKlaar: (dataUrl: string, durationMs: number) => void,
  maxMs?: number,
): Opname {
  const t = useT();
  const [bezig, setBezig] = useState(false);
  const [ms, setMs] = useState(0);
  const [fout, setFout] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beginRef = useRef<number>(0);
  // De laatste versie van de terugroep, zonder de haak opnieuw op te bouwen bij elke render.
  const klaarRef = useRef(onKlaar);
  klaarRef.current = onKlaar;

  const kanOpnemen = Platform.OS === 'web'
    && typeof navigator !== 'undefined'
    && typeof MediaRecorder !== 'undefined';

  const stopTimer = (): void => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  // Een venster dat sluit terwijl de microfoon nog aanstaat, laat het lampje branden.
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const stop = useCallback((): void => {
    recorderRef.current?.stop();
    setBezig(false);
    stopTimer();
  }, []);

  const start = useCallback(async (): Promise<void> => {
    setFout(null);
    if (!kanOpnemen) {
      setFout(t('Opnemen kan hier niet.'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      beginRef.current = Date.now();

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const duur = Date.now() - beginRef.current;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') klaarRef.current(reader.result, duur);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
        setMs(0);
      };

      recorderRef.current = rec;
      rec.start();
      setBezig(true);
      setMs(0);
      timerRef.current = setInterval(() => {
        const gelopen = Date.now() - beginRef.current;
        setMs(gelopen);
        // De afkap zit hier en niet in de knop: een knop die je loslaat op het moment dat
        // de grens valt, zou hem anders missen.
        if (maxMs !== undefined && gelopen >= maxMs) stop();
      }, TIK_MS);
    } catch {
      setFout(t('Microfoon niet beschikbaar of geweigerd.'));
    }
  }, [kanOpnemen, maxMs, stop, t]);

  return { bezig, ms, fout, kanOpnemen, start, stop };
}
