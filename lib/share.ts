// Het enige platform-afhankelijke stukje: op web wordt een export een download, op een
// telefoon gaat hij het deelmenu in. Geen extra pakketten nodig.

import { Platform, Share } from 'react-native';

// De BOM vooraan zorgt dat Excel de accenten goed leest. Als escape geschreven zodat het
// in elke editor één onzichtbaar teken blijft en niet per ongeluk als tekst eindigt.
const BOM = '\uFEFF';

/** Draait dit op een browser die zelf een bestand kan wegschrijven? */
function kanDownloaden(): boolean {
  return Platform.OS === 'web'
    && typeof document !== 'undefined'
    && typeof Blob !== 'undefined';
}

/**
 * Een bestand aan de browser geven.
 *
 * De opruiming gebeurt met vertraging: de browser start de download pas ná deze taak.
 * Trekken we de URL meteen in, dan is de blob in Firefox en Safari al weg voor het
 * downloaden begint en gebeurt er niets. Een seconde later is de download onderweg.
 */
function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1000);
}

export async function shareCsv(filename: string, text: string): Promise<void> {
  // Alleen op web bestaan Blob, URL en document. In de test- en telefoonomgeving mag dit
  // bestand niet omvallen op ontbrekende browser-API's, vandaar de dubbele controle.
  if (kanDownloaden()) {
    download(filename, new Blob([`${BOM}${text}`], { type: 'text/csv;charset=utf-8;' }));
    return;
  }
  await Share.share({ message: text, title: filename });
}

/**
 * Kan dit toestel een Excel-bestand aannemen?
 *
 * Op een telefoon niet, en dat is geen vergetelheid. `Share.share` neemt alleen tekst mee;
 * een xlsx is een zip vol bytes en overleeft dat niet. Het echt kunnen delen vraagt
 * `expo-file-system` en `expo-sharing` — twee pakketten erbij voor een knop die op de
 * website, waar de club de app gebruikt, allang werkt. Het scherm verbergt de knop dus op
 * een telefoon in plaats van hem te tonen en dan te falen; de CSV blijft daar staan.
 */
export const xlsxWordtOndersteund = kanDownloaden();

/** Hetzelfde, maar voor het werkblad: bytes in plaats van tekst. */
export async function shareXlsx(filename: string, bytes: Uint8Array): Promise<void> {
  if (!kanDownloaden()) {
    throw new Error('Een Excel-bestand delen kan alleen op het web.');
  }
  // Een kopie in een eigen ArrayBuffer: `bytes.buffer` kan groter zijn dan `bytes` zelf
  // (een deel-view), en dan zou de blob er bytes bij krijgen die er niet in horen.
  const kopie = new Uint8Array(bytes);
  download(filename, new Blob([kopie], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
}

/**
 * Tekst klaarzetten om ergens anders in te plakken — een mail, een bericht.
 *
 * Op web gaat hij naar het klembord: dat is één toets verder dan een bestand downloaden en
 * daarna weer openen. Op een telefoon bestaat er geen klembord-API die overal werkt, dus
 * daar gaat hij het deelmenu in — dan kies je zelf Mail, WhatsApp of Notities.
 *
 * Geeft terug wat er gebeurd is, zodat het scherm het juiste kan zeggen. Een knop die
 * "Gekopieerd" meldt terwijl er een deelmenu opengaat, laat je zoeken naar iets dat op je
 * klembord had moeten staan.
 */
export async function kopieerOfDeel(
  titel: string,
  tekst: string,
): Promise<'klembord' | 'gedeeld'> {
  const klembord = Platform.OS === 'web'
    && typeof navigator !== 'undefined'
    && navigator.clipboard !== undefined;

  if (klembord) {
    await navigator.clipboard.writeText(tekst);
    return 'klembord';
  }
  await Share.share({ message: tekst, title: titel });
  return 'gedeeld';
}
