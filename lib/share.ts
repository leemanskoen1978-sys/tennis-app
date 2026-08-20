// Het enige platform-afhankelijke stukje: op web wordt een CSV een download, op een
// telefoon gaat hij het deelmenu in. Geen extra pakketten nodig.

import { Platform, Share } from 'react-native';

// De BOM vooraan zorgt dat Excel de accenten goed leest. Als escape geschreven zodat het
// in elke editor één onzichtbaar teken blijft en niet per ongeluk als tekst eindigt.
const BOM = '\uFEFF';

export async function shareCsv(filename: string, text: string): Promise<void> {
  // Alleen op web bestaan Blob, URL en document. In de test- en telefoonomgeving mag dit
  // bestand niet omvallen op ontbrekende browser-API's, vandaar de dubbele controle.
  if (Platform.OS === 'web' && typeof document !== 'undefined' && typeof Blob !== 'undefined') {
    const blob = new Blob([`${BOM}${text}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    // Wachten is nodig: de browser start de download pas ná deze taak. Trekken we de URL
    // meteen in, dan is de blob in Firefox en Safari al weg voor het downloaden begint en
    // gebeurt er niets. Een seconde later is de download onderweg en mag alles opgeruimd.
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);
    return;
  }
  await Share.share({ message: text, title: filename });
}
