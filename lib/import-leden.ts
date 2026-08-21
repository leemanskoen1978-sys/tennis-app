// Een ledenlijst uit Excel omzetten naar leden van de club.
//
// Wat hier staat is alle regelgeving van de import en niets anders: geen databank, geen
// scherm, geen bestand. Het scherm geeft rijen tekst en de huidige ledenlijst, en krijgt
// een plan terug van wat er zou gebeuren. Dat is waarom de trainer het resultaat kan zien
// vóór er iets weggeschreven wordt — en waarom die belofte hier te testen valt.

import { isValidEmail, normalizeEmail, normalizePhone, normalizePhoneDigits } from './contact';
import { parseEuro } from './money';
import { nameExists, normalizeName } from './students';
import type { Role, User } from './types';

/**
 * De rolnamen zoals een trainer ze schrijft. Engels staat erbij omdat een export uit deze
 * app of uit een ander systeem ze zo kan opleveren; dat is geen reden om af te keuren.
 *
 * Een `Map` in plaats van een object-literal: een gewoon object erft van `Object.prototype`,
 * dus `{}['constructor']` levert de functie `Object` op in plaats van `undefined` en glipt
 * zo ongemerkt door een `?? null` heen. `Object.create(null)` dicht dat lek ook, maar
 * `Object.create()` geeft `any` terug — de `Record<string, Role>`-annotatie erboven toetst
 * de literal dan niet meer, en een tikfout als `speler: 'PLAYR'` compileert stilletjes. Een
 * `Map<string, Role>` heeft geen prototype én blijft volledig getypt.
 */
const ROLNAMEN = new Map<string, Role>([
  ['speler', 'player'],
  ['player', 'player'],
  ['leerling', 'player'],
  ['trainer', 'coach'],
  ['coach', 'coach'],
  ['ouder', 'parent'],
  ['parent', 'parent'],
]);

/**
 * De rol uit één cel. Leeg is een speler — dat is verreweg het vaakst waar, en een club die
 * alleen leerlingen invoert hoeft dan geen kolom `rol` te hebben. Onbekend is `null` en
 * geen speler: stil van "hoofdtrainer" een speler maken is precies het soort fout dat pas
 * opvalt als die persoon zijn agenda niet ziet.
 */
export function leesRol(waarde: string): Role | null {
  const schoon = waarde.trim().toLowerCase();
  if (!schoon) return 'player';
  return ROLNAMEN.get(schoon) ?? null;
}

/**
 * Een uurtarief uit één cel. Leeg is geen tarief en levert `undefined` op — dat verschil is
 * elders in de app zichtbaar (een trainer zonder tarief krijgt een waarschuwing, een trainer
 * met €0 niet). Al de rest gaat door `parseEuro`, de ene bedragregel van de app, die ook
 * negatief en meer dan twee decimalen tegenhoudt (een negatief tarief zou betekenen dat de
 * club geld toelegt). Wat daar niet doorheen komt, is onleesbaar en levert `null` op.
 */
export function leesUurtarief(waarde: string): number | undefined | null {
  if (!waarde.replace(/[€\s]/g, '')) return undefined;
  return parseEuro(waarde) ?? null;
}

/** Waar staat welke kolom? De index per veld; ontbrekende optionele kolommen staan er niet in. */
export interface Kolommen {
  naam: number;
  email: number;
  rol?: number;
  telefoon?: number;
  uurtarief?: number;
}

// Knoopt LEDEN_KOPPEN vast aan de velden van `Kolommen`: een kop die daar niet in past, is
// een tikfout in dit bestand en geeft een compilefout in plaats van een stille breuk bij het
// draaien van de import. Een gewone functie in plaats van `satisfies`, want Jest's
// Babel-transform (nog) niet overweg kan met dat trefwoord.
//
// Dit vangt alleen een kop die er niet hoort te zijn, niet een kop die vergeten is: `T` mag
// een deelverzameling van `keyof Kolommen` zijn, dus `metKolomvelden(['naam','email'] as const)`
// compileert ook prima. Voor "staan alle vijf velden erin" is dit dus geen bewijs — dat moet
// het voorbeeldbestand van taak 4 zelf met een test aantonen.
function metKolomvelden<T extends readonly (keyof Kolommen)[]>(koppen: T): T {
  return koppen;
}

/** De koppen van het voorbeeldbestand, in de volgorde waarin ze daar staan. */
export const LEDEN_KOPPEN = metKolomvelden(['naam', 'email', 'rol', 'telefoon', 'uurtarief'] as const);

/**
 * Andere schrijfwijzen die we aannemen. De kop wordt eerst klein gemaakt en van spaties
 * ontdaan — ook de spaties er middenin, dus "Uur tarief" en "Telefoon nummer" komen hier
 * ook op uit — dus hier staan alleen de echt andere woorden. Het koppelteken in 'e-mail'
 * blijft staan: dat is geen spatie. 'e-mailadres' en varianten staan erbij omdat dat in een
 * Belgische ledenlijst minstens zo gangbaar is als 'mail'.
 *
 * Een `Map` in plaats van een object-literal, om dezelfde twee redenen als bij `ROLNAMEN`:
 * geen ingebouwde Object-eigenschap kan hier ooit een kolom lijken te zijn, en de
 * sleutel/waarde-typen blijven bij het compileren gecontroleerd.
 */
const KOPNAMEN = new Map<string, keyof Kolommen>([
  ['naam', 'naam'],
  ['name', 'naam'],
  ['email', 'email'],
  ['e-mail', 'email'],
  ['mail', 'email'],
  ['e-mailadres', 'email'],
  ['emailadres', 'email'],
  ['mailadres', 'email'],
  ['rol', 'rol'],
  ['role', 'rol'],
  ['telefoon', 'telefoon'],
  ['telefoonnummer', 'telefoon'],
  ['gsm', 'telefoon'],
  ['phone', 'telefoon'],
  ['uurtarief', 'uurtarief'],
  ['tarief', 'uurtarief'],
]);

/**
 * Het resultaat van het lezen van de kopregel: niet alleen waar de kolommen staan, maar ook
 * welke koppen er stonden en niets betekenden. Dat laatste is niet bijzaak: een kop die stil
 * wordt genegeerd (een trainer die "Tarief/uur" typt in plaats van "uurtarief") levert een
 * geïmporteerde lijst op die er goed uitziet en het toch mist — en dat valt pas op als iemand
 * weken later zijn tarief niet blijkt te hebben. Het scherm toont `nietHerkend` en `dubbel`
 * daarom aan de trainer, vóór er iets wordt weggeschreven.
 *
 * `kolommen` blijft ook `null` als naam of email ontbreekt — maar `nietHerkend` en `dubbel`
 * worden dan wél gevuld. Juist in dat geval is de foutmelding zonder die twee lijstjes
 * onbruikbaar: "verplichte kolom ontbreekt" zegt een trainer niets, "ik mis email, en ik zag
 * wel een kolom 'E-mailadres' die ik niet herken" wél.
 */
export interface Kopregel {
  /** `null` als naam of email ontbreekt: dan valt er niets te importeren. */
  kolommen: Kolommen | null;
  /** Koppen die er stonden en die we niet thuis konden brengen, precies zoals in het bestand. */
  nietHerkend: string[];
  /** Koppen die we herkenden, maar niet lazen omdat diezelfde kolom er al was. */
  dubbel: string[];
}

/**
 * De kopregel lezen. Naam en e-mailadres zijn verplicht — zonder adres valt een lid later
 * nooit aan zijn login te koppelen, en dan is de import zinloos werk geweest — maar zelfs
 * dan geven we terug wat we wél zagen, zodat het scherm kan zeggen wat er moet veranderen.
 */
export function leesKopregel(kopregel: readonly string[]): Kopregel {
  const gevonden: Partial<Record<keyof Kolommen, number>> = {};
  const nietHerkend: string[] = [];
  const dubbel: string[] = [];
  kopregel.forEach((kop, i) => {
    const schoon = kop.trim().toLowerCase().replace(/\s+/g, '');
    if (!schoon) return; // een lege kop is geen kop, en dus ook geen vergissing.
    const veld = KOPNAMEN.get(schoon);
    if (!veld) {
      nietHerkend.push(kop.trim());
      return;
    }
    if (gevonden[veld] === undefined) {
      gevonden[veld] = i;
    } else {
      // De eerste kolom met deze naam wint; een tweede is een vergissing, geen overschrijving.
      dubbel.push(kop.trim());
    }
  });
  const { naam, email } = gevonden;
  const kolommen = naam === undefined || email === undefined ? null : { ...gevonden, naam, email };
  return { kolommen, nietHerkend, dubbel };
}

// ---------------------------------------------------------------------------
// Het plan
// ---------------------------------------------------------------------------

/** Eén regel die niet verwerkt wordt, met de reden in gewone taal. */
export interface ImportFout {
  /** Het regelnummer zoals de trainer het in Excel ziet: de kopregel is regel 1. */
  regel: number;
  /**
   * De reden, als vaste zin met eventuele plaatshouders van de vorm `{naam}` — nooit als
   * kant-en-klare tekst met een waarde er al in geplakt. Drie redenen hebben een waarde uit
   * het bestand nodig (welke rol, welk bedrag, welke regel eerder); plakte deze functie die
   * er zelf in, dan kreeg elke regel een eigen, unieke sleutel die nooit vertaald kan worden.
   * Het scherm doet `t(reden, vars)`, precies zoals `lib/i18n.ts` bedoeld is.
   */
  reden: string;
  /** De waarden voor de plaatshouders in `reden`. Ontbreekt bij een reden zonder plaatshouder. */
  vars?: Record<string, string | number>;
}

/** Eén bestaand lid, en wat dit bestand aan hem verandert. */
export interface ImportBijwerking {
  bestaand: User;
  wijzigingen: Partial<Omit<User, 'id' | 'role'>>;
}

export interface ImportPlan {
  nieuw: Omit<User, 'id'>[];
  bijgewerkt: ImportBijwerking[];
  fouten: ImportFout[];
  /**
   * Kolomkoppen die in het bestand stonden en die we niet thuis konden brengen, in hun
   * oorspronkelijke schrijfwijze. Het scherm toont ze: een kolom "Tarief/uur" die stil
   * wegvalt kost een trainer alle tarieven zonder dat hij ooit een melding zag.
   */
  nietHerkend: string[];
  /**
   * Koppen die we wél herkenden maar niet lezen omdat dezelfde kolom er al was. Een ander
   * bericht dan `nietHerkend`: "die kolom hebben we al" tegenover "die ken ik niet".
   */
  dubbel: string[];
  /**
   * Wat wel doorgaat maar de trainer beter even kan nakijken. Anders dan `fouten`: een
   * waarschuwing houdt de regel niet tegen — het plan neemt hem gewoon op in `nieuw`.
   */
  waarschuwingen: ImportFout[];
}

/**
 * Wat verandert dit bestand aan een bestaand lid?
 *
 * Alleen velden die in het bestand ingevuld zijn én, na normalisatie, iets anders zeggen dan
 * wat er al staat: "JONAS PEETERS" tegenover "Jonas Peeters" is dezelfde naam in een andere
 * schrijfwijze, en "0470 12 34 56" tegenover "0470123456" hetzelfde nummer — vergelijk je
 * letterlijk, dan is bij een export in hoofdletters ineens élke rij "gewijzigd" en verzuipt
 * de ene échte wijziging in de ruis. Blijft er een échte wijziging over, dan is de
 * schrijfwijze uit het bestand de voorgestelde waarde. Een lege cel betekent "hier weet ik
 * niets van" en nooit "maak dit leeg" — anders wist een bestand met alleen namen erin alle
 * telefoonnummers van de club.
 *
 * `name`, `phone` en `hourly_rate` zijn de enige velden die uit een importbestand kunnen
 * komen — zie `Kolommen` hierboven. Breidt een latere taak `Kolommen` uit met een nieuw
 * veld, dan hoort deze functie mee te groeien.
 */
function verschillen(bestaand: User, regel: Omit<User, 'id'>): Partial<Omit<User, 'id' | 'role'>> {
  const wijzigingen: Partial<Omit<User, 'id' | 'role'>> = {};
  if (regel.name && normalizeName(regel.name) !== normalizeName(bestaand.name)) {
    wijzigingen.name = regel.name;
  }
  if (
    regel.phone
    && normalizePhoneDigits(regel.phone) !== normalizePhoneDigits(bestaand.phone ?? '')
  ) {
    wijzigingen.phone = regel.phone;
  }
  if (regel.hourly_rate !== undefined && regel.hourly_rate !== bestaand.hourly_rate) {
    wijzigingen.hourly_rate = regel.hourly_rate;
  }
  return wijzigingen;
}

/**
 * Hoe de velden die `verschillen` hierboven kan opleveren heten voor een trainer. Dit mapje
 * moet meegroeien met `verschillen` — vandaar ernaast, en niet in het scherm, dat anders zelf
 * een vertaling zou moeten verzinnen voor een sleutel uit de databank (`hourly_rate`) die een
 * trainer nooit te zien hoort te krijgen.
 */
export const VELD_NAMEN: Partial<Record<keyof Omit<User, 'id' | 'role'>, string>> = {
  name: 'Naam',
  phone: 'Telefoonnummer',
  hourly_rate: 'Uurtarief',
};

/**
 * Is dit hele bestand afgekeurd, in plaats van een paar regels erin?
 *
 * Zo'n plan heeft precies één fout, op regel 1 (de kopregel), en geen enkele regel die wél
 * doorging: dat gebeurt alleen bij een leeg bestand of een kopregel zonder "naam" of "email".
 * Het scherm moet dat lezen als "dit bestand deugt niet" en niet als "deze ene regel wordt
 * overgeslagen" — de twee gevallen vragen om een ander soort melding.
 */
export function bestandAfgekeurd(plan: ImportPlan): boolean {
  return (
    plan.nieuw.length === 0
    && plan.bijgewerkt.length === 0
    && plan.waarschuwingen.length === 0
    && plan.fouten.length === 1
    && plan.fouten[0].regel === 1
  );
}

/**
 * Wat zou dit bestand doen met de club? Schrijft niets weg — dat is het hele punt: het
 * scherm toont dit plan eerst, en pas als de trainer het herkent gebeurt er iets.
 */
export function planImport(
  rijen: ReadonlyArray<readonly string[]>,
  bestaande: readonly User[],
): ImportPlan {
  const plan: ImportPlan = {
    nieuw: [], bijgewerkt: [], fouten: [], nietHerkend: [], dubbel: [], waarschuwingen: [],
  };
  if (rijen.length === 0) {
    plan.fouten.push({ regel: 1, reden: 'Dit bestand is leeg.' });
    return plan;
  }

  // Eerst overnemen, dán pas afhaken: juist als de kopregel niet deugt, heeft de trainer
  // die lijstjes nodig — dat is het geval waarin hij zijn bestand moet aanpassen.
  const kop = leesKopregel(rijen[0]);
  plan.nietHerkend = kop.nietHerkend;
  plan.dubbel = kop.dubbel;
  const { kolommen } = kop;
  if (!kolommen) {
    plan.fouten.push({ regel: 1, reden: 'De kopregel mist de kolom "naam" of "email".' });
    return plan;
  }

  // Bestaande leden per adres, mét hun aantal: een lokale opslag kan (anders dan de databank,
  // waar `users.email` `unique` is) twee leden met hetzelfde adres bevatten. `new Map(...)`
  // zou daar stilzwijgend de laatste van laten winnen — een import mag zoiets niet zomaar
  // negeren, en meldt het in plaats daarvan als fout op de regel die het treft.
  const bekend = new Map<string, User[]>();
  for (const u of bestaande) {
    const k = normalizeEmail(u.email);
    const lijst = bekend.get(k);
    if (lijst) lijst.push(u); else bekend.set(k, [u]);
  }
  // Waar in het bestand we een adres eerder zagen — voor de melding "staat al op regel 2".
  const gezien = new Map<string, number>();
  // Namen die dit bestand zelf al als nieuw lid heeft goedgekeurd: twee nieuwe rijen met
  // dezelfde naam zijn in een keuzelijst al even onherkenbaar als een nieuwe rij die een
  // bestaande naam herhaalt, dus telt dit lijstje mee in dezelfde controle als `nameExists`.
  const nieuweNamen = new Set<string>();

  for (let i = 1; i < rijen.length; i++) {
    const rij = rijen[i];
    const regel = i + 1;
    const cel = (index: number | undefined): string =>
      index === undefined ? '' : (rij[index] ?? '').trim();

    // Een rij waarvan alle cellen leeg zijn, is geen vergissing: een trainer zet weleens
    // een lege scheidingsregel tussen twee groepen in zijn bestand. Zo'n regel slaan we
    // stil over, in plaats van er een foutmelding aan te hangen.
    if (rij.every((c) => !c || !c.trim())) continue;

    const naam = cel(kolommen.naam);
    const email = cel(kolommen.email);
    if (!naam) { plan.fouten.push({ regel, reden: 'Geen naam ingevuld.' }); continue; }
    if (!email) { plan.fouten.push({ regel, reden: 'Geen e-mailadres ingevuld.' }); continue; }
    if (!isValidEmail(email)) {
      plan.fouten.push({ regel, reden: 'Dit is geen geldig e-mailadres.' });
      continue;
    }
    const key = normalizeEmail(email);

    // Deze controle hangt aan de club, niet aan de rij, en hoort dus vóór alles wat over
    // déze rij gaat — óók vóór `gezien.set` hieronder. Stond hij erna, dan zou een latere
    // rij met hetzelfde adres "eerder in het bestand" te horen krijgen en verwijzen naar
    // een regel die zelf al was afgekeurd; nu meldt elke rij die dit adres treft hetzelfde,
    // op zichzelf staande probleem.
    const bestaandeMetDitAdres = bekend.get(key);
    if (bestaandeMetDitAdres && bestaandeMetDitAdres.length > 1) {
      plan.fouten.push({
        regel,
        reden: 'Er staan twee leden met dit adres in de club; los dat eerst op in Beheer.',
      });
      continue;
    }
    const bestaandLid = bestaandeMetDitAdres?.[0];

    const eerder = gezien.get(key);
    if (eerder !== undefined) {
      plan.fouten.push({
        regel,
        reden: 'Dit adres staat eerder in het bestand, op regel {vorigeRegel}.',
        vars: { vorigeRegel: eerder },
      });
      continue;
    }

    const rolCel = cel(kolommen.rol);
    const role = leesRol(rolCel);
    if (role === null) {
      plan.fouten.push({
        regel,
        reden: 'Onbekende rol "{rol}". Kies speler, trainer of ouder.',
        vars: { rol: rolCel },
      });
      continue;
    }

    const tariefCel = cel(kolommen.uurtarief);
    const hourly_rate = leesUurtarief(tariefCel);
    if (hourly_rate === null) {
      plan.fouten.push({
        regel,
        reden: 'Het uurtarief "{tarief}" is geen geldig bedrag.',
        vars: { tarief: tariefCel },
      });
      continue;
    }

    // Pas hier, en niet vóór de controles hierboven, geldt een adres als "gezien": een rij
    // die op zijn rol of tarief strandt telt niet mee, en een latere rij met hetzelfde adres
    // komt dan gewoon door als nieuw — de eerste poging is immers nooit doorgegaan.
    gezien.set(key, regel);

    if (bestaandLid) {
      // De rol van iemand die er al is, verandert de import nooit: `updateUser` sluit `role`
      // uit van zijn type, en dat is met opzet — trainer word je in Beheer, bewust. Een
      // bestand dat iets anders beweert, wordt afgekeurd en niet half doorgevoerd. De cel is
      // hier bewust `rolCel` en niet `role`: een lege cel zegt niets en mag niets afkeuren.
      if (rolCel && role !== bestaandLid.role) {
        plan.fouten.push({
          regel,
          reden: 'Staat al in de club met een andere rol; dat wijzig je in Beheer.',
        });
        continue;
      }
    }

    // De rol waarop het tarief beoordeeld wordt: voor een bestaand lid is dat zíjn rol, niet
    // wat een lege of ontbrekende rolcel toevallig oplevert. `leesRol('')` geeft altijd
    // 'player' terug — zonder deze correctie leek een bestand zonder kolom `rol` elke
    // bestaande trainer een speler te maken, en verdween zijn tarief geruisloos. Voor een
    // écht nieuw lid is er geen bestaande rol, en beslist het bestand dus zoals voorheen.
    const effectieveRol = bestaandLid?.role ?? role;

    // Een leeg optioneel veld hoort niet als sleutel met `undefined` in het object te staan:
    // dat is het verschil tussen "niet ingevuld" en "leeggemaakt", en de tests zien het.
    // Het adres komt genormaliseerd binnen: zo niet, dan komt "JONAS@Club.be" in willekeurige
    // kapitalisatie in de databank terecht, en mist elke latere opzoeker die zelf niet
    // normaliseert (een Supabase `eq('email', …)`, de koppeling met een login) dit lid.
    const lid: Omit<User, 'id'> = { name: naam, email: key, role: effectieveRol };
    const phone = normalizePhone(cel(kolommen.telefoon));
    if (phone) lid.phone = phone;
    if (hourly_rate !== undefined && effectieveRol === 'coach') lid.hourly_rate = hourly_rate;

    // Pas hier waarschuwen, ná elke `continue` hierboven: een rij die toch al wordt
    // afgekeurd (dubbel adres, verkeerde rol) mag niet ook nog "kijk het tarief na" te horen
    // krijgen over een regel die sowieso niet wordt overgenomen.
    if (hourly_rate !== undefined && effectieveRol !== 'coach') {
      plan.waarschuwingen.push({
        regel,
        reden: 'Een uurtarief hoort bij een trainer; voor een speler laat ik het weg.',
      });
    }

    if (!bestaandLid) {
      // Twee echte naamgenoten kunnen bestaan — dat hard weigeren zou te streng zijn — maar
      // in elke latere keuzelijst zijn ze niet meer uit elkaar te houden, dus de trainer
      // krijgt het te zien vóór hij bevestigt, net als bij `canCreateName` in lib/students.
      // Ook een naam die dit bestand zelf al eerder goedkeurde telt mee: een import van
      // 200 rijen is juist de plek waar twee identieke, nog onbekende namen ontstaan.
      if (nameExists(bestaande, naam) || nieuweNamen.has(normalizeName(naam))) {
        plan.waarschuwingen.push({
          regel,
          reden: 'Er staat al een lid met deze naam; kijk even of dit niet dezelfde persoon is.',
        });
      }
      nieuweNamen.add(normalizeName(naam));
      plan.nieuw.push(lid);
      continue;
    }

    const wijzigingen = verschillen(bestaandLid, lid);
    if (Object.keys(wijzigingen).length > 0) {
      plan.bijgewerkt.push({ bestaand: bestaandLid, wijzigingen });
    }
  }

  return plan;
}

/**
 * Het voorbeeldbestand. Twee regels en niet één: een speler zonder tarief en een trainer
 * mét, zodat een trainer ziet dat een lege cel gewoon mag. Puntkomma's, want dat is wat
 * Nederlandse Excel zelf schrijft en dus wat er straks terugkomt.
 */
export function voorbeeldLedenCsv(): string {
  return [
    LEDEN_KOPPEN.join(';'),
    'Jonas Peeters;jonas@voorbeeld.be;speler;0470 12 34 56;',
    'Sofie Maes;sofie@voorbeeld.be;trainer;;45',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Het plan uitvoeren
// ---------------------------------------------------------------------------

/** Wat een aangeroepen actie van dit type teruggeeft — precies het stukje `useSimpleData` dat de import nodig heeft. */
export interface ImportActies {
  addUser: (u: Omit<User, 'id'>) => Promise<User | null>;
  updateUser: (id: string, patch: Partial<Omit<User, 'id' | 'role'>>) => Promise<void>;
}

/** Hoeveel van elke soort actie geslaagd is. */
export interface ImportUitslag {
  toegevoegd: number;
  bijgewerkt: number;
  mislukt: number;
}

/**
 * Voert een eerder getoond plan uit: eerst alle nieuwe leden, dan alle bijwerkingen, en dat
 * één voor één in plaats van in één klap. Zo loopt elke wijziging over dezelfde bewaakte weg
 * als een trainer die met de hand een lid toevoegt of aanpast — en zo is met twee simpele
 * spies te toetsen of de telling nog klopt als lid 30 van de 50 faalt.
 *
 * `addUser` geeft `null` terug als de opslag nog niet geladen was — dat telt hier als
 * mislukt en niet als succes, anders leest een trainer "50 toegevoegd" terwijl er niets
 * gebeurde. `updateUser` geeft niets terug om op te controleren: een `commit` die faalt
 * gooit een fout, en die vangt de `try/catch` hieronder op dezelfde manier op.
 *
 * `voortgang`, als hij is meegegeven, wordt na elke afgehandelde regel aangeroepen met hoeveel
 * er klaar zijn en hoeveel er in totaal te doen zijn — voor een scherm dat "lid 12 van 50"
 * wil tonen zodat een trainer bij een grote lijst niet denkt dat de app is blijven hangen.
 */
export async function pasImportToe(
  plan: ImportPlan,
  acties: ImportActies,
  voortgang?: (klaar: number, totaal: number) => void,
): Promise<ImportUitslag> {
  const totaal = plan.nieuw.length + plan.bijgewerkt.length;
  let klaar = 0;
  let toegevoegd = 0;
  let bijgewerkt = 0;
  let mislukt = 0;

  for (const lid of plan.nieuw) {
    try {
      if (await acties.addUser(lid)) toegevoegd++; else mislukt++;
    } catch {
      mislukt++;
    }
    klaar++;
    voortgang?.(klaar, totaal);
  }
  for (const b of plan.bijgewerkt) {
    try {
      await acties.updateUser(b.bestaand.id, b.wijzigingen);
      bijgewerkt++;
    } catch {
      mislukt++;
    }
    klaar++;
    voortgang?.(klaar, totaal);
  }

  return { toegevoegd, bijgewerkt, mislukt };
}
