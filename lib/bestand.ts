// Een tekstbestand van de gebruiker inlezen. De tegenhanger van lib/share.ts, dat een
// bestand wegschrijft, en met dezelfde keuze erin: op web bestaat een bestandskiezer, op
// een telefoon niet zonder `expo-document-picker` erbij. Eén pakket voor één knop die op de
// website — waar de club de app gebruikt — allang werkt, is het niet waard. Het scherm
// verbergt de knop daar dus en zet er een plakvak neer, in plaats van hem te tonen en dan
// te falen.

import { Platform } from 'react-native';

/** Kan dit toestel de gebruiker een bestand laten kiezen? */
export const kanBestandKiezen: boolean =
  Platform.OS === 'web' && typeof document !== 'undefined' && typeof FileReader !== 'undefined';

/**
 * Vraag de gebruiker om een CSV en geef de inhoud terug. `null` betekent: hij heeft het
 * venster weggeklikt, of het lezen mislukte. Dat is geen fout om een melding over te tonen —
 * er is dan gewoon niets gebeurd.
 *
 * De belofte lost nooit op als de gebruiker het bestandsvenster wegklikt zonder te kiezen;
 * dat is hoe `input type=file` werkt en het scherm kan daar niets zinnigs mee. Het scherm
 * blijft in dat geval staan waar het stond, en dat klopt.
 */
export function kiesTekstbestand(): Promise<string | null> {
  if (!kanBestandKiezen) return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv,text/plain';
    input.onchange = () => {
      const bestand = input.files?.[0];
      if (!bestand) { resolve(null); return; }
      const lezer = new FileReader();
      lezer.onload = () => resolve(typeof lezer.result === 'string' ? lezer.result : null);
      lezer.onerror = () => resolve(null);
      // UTF-8 met de BOM erin die Excel schrijft; `parseCsv` haalt die er weer af.
      lezer.readAsText(bestand, 'utf-8');
    };
    input.click();
  });
}
