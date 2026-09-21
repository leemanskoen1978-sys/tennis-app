// Waar de afbeeldingen bij de oefeningen per kleur bewaard worden.
//
// Bij de club is dat de Storage-bucket "oefeningen" in Supabase (zie OEFENAFBEELDINGEN.sql):
// alleen de beheerder schrijft, elke trainer leest. Zonder sleutels in .env — de demo, of een
// scherm bouwen zonder project — bewaart de browser ze zelf, net als de rest van de gegevens
// dan (providers/mockStore). Twee toestellen zien elkaars afbeeldingen dan niet, en dat is ook
// hier de afspraak van de lokale kant.
//
// Deze keuze staat hier en niet in het scherm, om dezelfde reden als in providers/backend: het
// scherm praat met één vorm en merkt niet welke van de twee eronder zit.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase, supabaseConfigured } from '../lib/supabase';
import {
  OEFENONDERDELEN, oefenpad, perOnderdeel, type Onderdeelnaam,
} from '../lib/oefenafbeeldingen';

const BUCKET = 'oefeningen';
const LOKAAL = 'oefenafbeeldingen';
/** Een uur: langer dan iemand naar dit scherm kijkt, en het scherm laadt bij elk bezoek opnieuw. */
const GELDIG_SECONDEN = 3600;

export type OefenAfbeelding = {
  /** Map en bestandsnaam samen: waarmee je hem weer verwijdert. */
  pad: string;
  /** Waar het beeld op te halen valt: een tijdelijke link, of de data-URL zelf. */
  url: string;
};
export type OefenAfbeeldingen = Record<Onderdeelnaam, OefenAfbeelding[]>;

function leeg(): OefenAfbeeldingen {
  return { opwarming: [], leskern: [], tussenspel: [], wedstrijdvorm: [] };
}

async function lokaleOpslag(): Promise<Record<string, string>> {
  try {
    const ruw = await AsyncStorage.getItem(LOKAAL);
    return ruw ? (JSON.parse(ruw) as Record<string, string>) : {};
  } catch {
    // Een leesfout is hier "er staat niets"; schrijven overschrijft dan een stuk dat toch al
    // onleesbaar was.
    return {};
  }
}

/** Alle afbeeldingen in één map (één kleur, één week), per onderdeel. */
export async function laadAfbeeldingen(map: string): Promise<OefenAfbeeldingen> {
  const uit = leeg();

  if (!supabaseConfigured) {
    const opslag = await lokaleOpslag();
    const namen = Object.keys(opslag)
      .filter((pad) => pad.startsWith(`${map}/`))
      .map((pad) => pad.slice(map.length + 1));
    const groepen = perOnderdeel(namen);
    for (const o of OEFENONDERDELEN) {
      uit[o] = groepen[o].map((naam) => ({ pad: `${map}/${naam}`, url: opslag[`${map}/${naam}`] }));
    }
    return uit;
  }

  const bucket = supabase.storage.from(BUCKET);
  const { data: bestanden, error } = await bucket.list(map, { limit: 100 });
  if (error) throw error;
  const groepen = perOnderdeel((bestanden ?? []).map((b) => b.name));
  const paden = OEFENONDERDELEN.flatMap((o) => groepen[o].map((naam) => `${map}/${naam}`));
  if (paden.length === 0) return uit;

  const { data: links, error: linkFout } = await bucket.createSignedUrls(paden, GELDIG_SECONDEN);
  if (linkFout) throw linkFout;
  const urlVan = new Map((links ?? []).map((l) => [l.path, l.signedUrl]));
  for (const o of OEFENONDERDELEN) {
    uit[o] = groepen[o].flatMap((naam) => {
      const pad = `${map}/${naam}`;
      const url = urlVan.get(pad);
      return url ? [{ pad, url }] : [];
    });
  }
  return uit;
}

/** Een afbeelding (JPEG-data-URL) bij een onderdeel bewaren. Gooit een fout als het niet lukt. */
export async function bewaarAfbeelding(
  map: string,
  onderdeel: Onderdeelnaam,
  dataUrl: string,
): Promise<void> {
  const pad = oefenpad(map, onderdeel, Date.now());

  if (!supabaseConfigured) {
    const opslag = await lokaleOpslag();
    await AsyncStorage.setItem(LOKAAL, JSON.stringify({ ...opslag, [pad]: dataUrl }));
    return;
  }

  const blob = await (await fetch(dataUrl)).blob();
  const { error } = await supabase.storage.from(BUCKET).upload(pad, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
}

/** Een afbeelding weghalen. */
export async function verwijderAfbeelding(pad: string): Promise<void> {
  if (!supabaseConfigured) {
    const { [pad]: _weg, ...rest } = await lokaleOpslag();
    await AsyncStorage.setItem(LOKAAL, JSON.stringify(rest));
    return;
  }
  const { error } = await supabase.storage.from(BUCKET).remove([pad]);
  if (error) throw error;
}
