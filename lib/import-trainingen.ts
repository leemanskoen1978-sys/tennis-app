// Een seizoen trainingen uit Excel omzetten naar lesgroepen, spelers en lessen.
//
// Wat hier staat is alle regelgeving van de trainingenimport en niets anders: geen databank,
// geen scherm, geen bestand. Het scherm geeft rijen tekst plus de huidige lijsten van de club,
// en krijgt een plan terug van wat er zou gebeuren. Dat is waarom de beheerder het resultaat
// ziet vóór er iets weggeschreven wordt — en waarom die belofte hier te testen valt (D-10),
// op dezelfde manier als `lib/import-leden.ts` dat voor de ledenlijst doet.
//
// De kolommen liggen vast in `.planning/IMPORT-SJABLOON.md`; dit bestand is de enige plek waar
// ze in code staan. Ook het sjabloon dat de beheerder kan downloaden staat hier: dat is
// dezelfde kolomtabel van de andere kant bekeken, en die twee uit elkaar laten lopen zou
// betekenen dat de app haar eigen voorbeeldbestand niet meer leest.

/** Waar staat welke kolom? De index per veld; ontbrekende optionele kolommen staan er niet in. */
export interface KolommenLessen {
  datum: number;
  uur: number;
  groep: number;
  coach: number;
  leerling: number;
  groepId?: number;
  typeLes?: number;
  emailLeerling?: number;
  baan?: number;
}

// Knoopt LESSEN_KOPPEN vast aan de velden van `KolommenLessen`: een kop die daar niet in past,
// is een tikfout in dit bestand en geeft een compilefout in plaats van een stille breuk bij het
// draaien van de import. Een gewone functie in plaats van `satisfies`, want Jest's
// Babel-transform kan (nog) niet overweg met dat trefwoord.
//
// Dit vangt alleen een veld dat er niet hoort te zijn, niet een veld dat vergeten is: `T` mag
// een deelverzameling van `keyof KolommenLessen` zijn. Dat alle negen kolommen in het sjabloon
// staan, moet het voorbeeldbestand dus zelf met een test aantonen.
function metKolomvelden<T extends readonly (keyof KolommenLessen)[]>(koppen: T): T {
  return koppen;
}

/** De velden van een lesregel, in de volgorde waarin het sjabloon ze zet. */
export const LESSEN_KOPPEN = metKolomvelden([
  'datum', 'uur', 'typeLes', 'groep', 'groepId', 'coach', 'leerling', 'emailLeerling', 'baan',
] as const);

/**
 * De koppen die een kolom aanwijzen, met de schrijfwijzen die we aannemen. De kop wordt eerst
 * klein gemaakt en van spaties ontdaan — ook de spaties er middenin — dus `Type les`,
 * `type les` en `Typeles` komen alle drie op `typeles` uit en staan hier één keer.
 *
 * De negen koppen zoals ze in `.planning/IMPORT-SJABLOON.md` en in het sjabloon gespeld staan:
 * verplicht `Datum`, `Uur`, `Groep`, `Coach`, `Leerling`; optioneel `Groep-ID`, `Type les`,
 * `E-mail leerling`, `Baan`.
 *
 * Een `Map` in plaats van een object-literal, om dezelfde twee redenen als in
 * `lib/import-leden.ts`: een gewoon object erft van `Object.prototype`, dus `{}['constructor']`
 * levert de functie `Object` op in plaats van `undefined` — geen ingebouwde Object-eigenschap
 * kan hier ooit een kolom lijken te zijn. En de sleutel/waarde-typen blijven bij het compileren
 * gecontroleerd, wat `Object.create(null)` (dat `any` teruggeeft) niet doet.
 */
const KOPNAMEN_LESSEN = new Map<string, keyof KolommenLessen>([
  ['datum', 'datum'],
  ['date', 'datum'],
  ['uur', 'uur'],
  ['beginuur', 'uur'],
  ['startuur', 'uur'],
  ['tijd', 'uur'],
  ['groep', 'groep'],
  ['lesgroep', 'groep'],
  ['groepid', 'groepId'],
  ['groep-id', 'groepId'],
  ['groepsid', 'groepId'],
  ['typeles', 'typeLes'],
  ['lestype', 'typeLes'],
  ['soortles', 'typeLes'],
  ['niveau', 'typeLes'],
  ['coach', 'coach'],
  ['trainer', 'coach'],
  ['lesgever', 'coach'],
  ['leerling', 'leerling'],
  ['speler', 'leerling'],
  ['emailleerling', 'emailLeerling'],
  ['e-mailleerling', 'emailLeerling'],
  ['leerlingemail', 'emailLeerling'],
  ['leerlinge-mail', 'emailLeerling'],
  ['emailadresleerling', 'emailLeerling'],
  ['baan', 'baan'],
  ['terrein', 'baan'],
  ['court', 'baan'],
]);

/**
 * Koppen die we lezen en bewust laten liggen. Ze staan apart van "onbekend" omdat ze in
 * `koen.xlsx` staan (`Weekdag`, `Weeknr`, `Locatie`, `Indoor/Outdoor`) en in wat de export van
 * fase 4 schrijft (daar komen `Einduur`, `Gaf de les`, `Spelers` en `Status` bij). Zou de
 * import ze als "niet herkend" melden, dan opent élke echte import — ook de eigen export die er
 * ongewijzigd weer in moet kunnen — met een lijstje ruis, en dan leest niemand dat lijstje nog
 * op de dag dat er wél een echte tikfout in staat.
 *
 * Schoongemaakte vorm: klein, zonder spaties. `indoor/outdoor` houdt zijn schuine streep, want
 * dat is geen spatie.
 */
const KOPPEN_GENEGEERD = new Set([
  'weekdag',
  'weeknr',
  'weeknummer',
  'einduur',
  'locatie',
  'indoor/outdoor',
  'gafdeles',
  'spelers',
  'status',
]);

/**
 * Het resultaat van het lezen van de koprij: niet alleen waar de kolommen staan, maar ook welke
 * koppen er stonden en niets betekenden. Dat laatste is geen bijzaak: een kop die stil genegeerd
 * wordt (een beheerder die `Groepsnaam` typt in plaats van `Groep`) levert een import op die er
 * goed uitziet en toch elke groep verkeerd samenstelt. Het scherm toont `nietHerkend` en
 * `dubbel` daarom vóór er iets wordt weggeschreven.
 *
 * `kolommen` blijft ook `null` als een verplichte kolom ontbreekt — maar `nietHerkend` en
 * `dubbel` worden dan wél gevuld. Juist in dat geval is de melding zonder die lijstjes
 * onbruikbaar: "verplichte kolom ontbreekt" zegt een beheerder niets, "ik mis Coach, en ik zag
 * wel een kolom Trainer die ik niet herken" wél.
 */
export interface KopregelLessen {
  /** `null` als een van de vijf verplichte kolommen ontbreekt: dan valt er niets te importeren. */
  kolommen: KolommenLessen | null;
  /** Koppen die er stonden en die we niet thuis konden brengen, precies zoals in het bestand. */
  nietHerkend: string[];
  /** Koppen die we herkenden, maar niet lazen omdat diezelfde kolom er al was. */
  dubbel: string[];
}

/** De schoongemaakte vorm van een kop: klein, zonder spaties eromheen en zonder spaties erin. */
function schoneKop(kop: string): string {
  return kop.trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * De koprij lezen. `Datum`, `Uur`, `Groep`, `Coach` en `Leerling` zijn verplicht (D-04) — zonder
 * een van die vijf valt er geen les te bouwen — maar zelfs dan geven we terug wat we wél zagen,
 * zodat het scherm kan zeggen wat er moet veranderen.
 */
export function leesKopregelLessen(kopregel: readonly string[]): KopregelLessen {
  const gevonden: Partial<Record<keyof KolommenLessen, number>> = {};
  const nietHerkend: string[] = [];
  const dubbel: string[] = [];
  kopregel.forEach((kop, i) => {
    const schoon = schoneKop(kop);
    if (!schoon) return; // een lege kop is geen kop, en dus ook geen vergissing.
    if (KOPPEN_GENEGEERD.has(schoon)) return;
    const veld = KOPNAMEN_LESSEN.get(schoon);
    if (!veld) {
      nietHerkend.push(kop.trim());
      return;
    }
    if (gevonden[veld] === undefined) {
      gevonden[veld] = i;
    } else {
      // De eerste kolom met deze naam wint; een tweede is een vergissing, geen overschrijving.
      // Zo kan een kolomkop die op een andere lijkt nooit stilzwijgend een eerdere kolom
      // overnemen (T-05-08).
      dubbel.push(kop.trim());
    }
  });
  const { datum, uur, groep, coach, leerling } = gevonden;
  const compleet = datum !== undefined && uur !== undefined && groep !== undefined
    && coach !== undefined && leerling !== undefined;
  const kolommen = compleet
    ? { ...gevonden, datum, uur, groep, coach, leerling }
    : null;
  return { kolommen, nietHerkend, dubbel };
}

/** Eén regel die niet verwerkt wordt, met de reden in gewone taal. */
export interface ImportFoutLessen {
  /** Het regelnummer zoals de beheerder het in Excel ziet: de koprij is regel 1. */
  regel: number;
  /**
   * De reden, als vaste zin met eventuele plaatshouders van de vorm `{waarde}` — nooit als
   * kant-en-klare tekst met een waarde er al in geplakt. Plakte deze module de waarde er zelf
   * in, dan kreeg elke regel een eigen, unieke sleutel die nooit vertaald kan worden. Het scherm
   * doet `t(reden, vars)`, precies zoals `lib/i18n.ts` bedoeld is.
   */
  reden: string;
  /** De waarden voor de plaatshouders in `reden`. Ontbreekt bij een reden zonder plaatshouder. */
  vars?: Record<string, string | number>;
}

/**
 * Is dit hele bestand afgekeurd, in plaats van een paar regels erin?
 *
 * Zo'n uitkomst heeft precies één fout, op regel 1 (de koprij), en geen enkele regel die wél
 * doorging: dat gebeurt alleen bij een leeg bestand of een koprij zonder een van de vijf
 * verplichte kolommen. Het scherm moet dat lezen als "dit bestand deugt niet" en niet als "deze
 * ene regel wordt overgeslagen" — de twee gevallen vragen om een ander soort melding.
 */
export function bestandAfgekeurdLessen(
  uitkomst: { regels: readonly unknown[]; fouten: readonly ImportFoutLessen[] },
): boolean {
  return (
    uitkomst.regels.length === 0
    && uitkomst.fouten.length === 1
    && uitkomst.fouten[0].regel === 1
  );
}
