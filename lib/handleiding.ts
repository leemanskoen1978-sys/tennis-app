// De gebruiksaanwijzing, als tekst en niet als scherm.
//
// Twee gidsen: één voor een trainer en één voor een speler. Ze staan hier en niet in het
// scherm, om twee redenen. De eerste is dat dezelfde tekst op twee plekken terechtkomt — in
// Beheer → Handleiding en op de deelbare webpagina — en een handleiding die op de ene plek
// al bijgewerkt is en op de andere nog niet, is erger dan geen handleiding.
//
// De tweede is dat het zo na te kijken valt. Een gids die naar een scherm verwijst dat niet
// meer bestaat, is stil kapot: niemand krijgt een foutmelding, de tekst klopt gewoon niet
// meer. De test ernaast controleert daarom dat elk stuk een kop en tekst heeft en dat er
// geen dubbele sleutels zijn.
//
// Schrijfregel: zeg wat er gebeurt en waarom, in de woorden van wie het scherm gebruikt.
// Geen "configureer", geen "systeem" — een trainer keurt een les goed, hij "valideert geen
// aanvraag".

import { t } from './i18n';

/**
 * Voor wie een gids geschreven is.
 *
 * Dit is met opzet geen `Role`. Beheerder is in deze app geen rol maar een vinkje op een
 * gebruiker (`is_admin`, zie lib/rechten): wie de club beheert is meestal óók gewoon trainer,
 * met zijn eigen agenda en zijn eigen spelers. De beheerdersgids gaat dan ook alleen over wat
 * dat vinkje erbij geeft — hij vervangt de trainersgids niet, hij komt erna.
 */
export type Gidssoort = 'coach' | 'player' | 'admin';

/** Eén blokje uitleg: waar het staat, wat het is, en wat je ermee doet. */
export interface Gidsdeel {
  /** Waar je het vindt — het pad in de app, kort. */
  waar: string;
  kop: string;
  /** Eén of meer alinea's. */
  tekst: string[];
}

/** Een waarschuwing die opvalt: iets dat je maar één keer verkeerd hoeft te doen. */
export interface Gidswaarschuwing {
  kop: string;
  tekst: string[];
}

/** Eén hoofdstuk van de gids. */
export interface Gidsstuk {
  id: string;
  /** Het tabblad of de plaats waar dit hoofdstuk over gaat. */
  plaats: string;
  titel: string;
  /** De regel onder de titel: waarvoor dit hoofdstuk er is. */
  leidraad?: string;
  delen: Gidsdeel[];
  waarschuwing?: Gidswaarschuwing;
}

// ---------------------------------------------------------------------------
// De trainer
// ---------------------------------------------------------------------------

const TRAINER: Gidsstuk[] = [
  {
    id: 'start',
    plaats: 'Om te beginnen',
    titel: 'De eerste keer',
    leidraad: 'Zet de app op je beginscherm, dan opent hij als een gewone app en blijf je ingelogd.',
    delen: [
      {
        waar: 'Inloggen',
        kop: 'Met je e-mailadres',
        tekst: [
          'Ben je nieuw, kies dan "Nieuwe login". Stond je al bij de club, dan wordt je '
          + 'account aan je bestaande dossier gehangen — met je lessen en je spelers erbij. '
          + 'Wachtwoord kwijt? "Wachtwoord vergeten" stuurt je een mail.',
        ],
      },
      {
        waar: 'Profiel → Mijn gegevens',
        kop: 'Je gegevens en je lesdagen',
        tekst: [
          'Eén formulier voor wie je bent: naam, e-mailadres, gsm-nummer en — als trainer — '
          + 'je lesdagen. Hetzelfde blad opent op je eigen dossier bij Trainers en, voor een '
          + 'beheerder, achter elke naam in Beheer → Leden. Wat je mag wijzigen hangt aan wie '
          + 'je bent, niet aan waar je het opende.',
          'Tussen welke uren er bij jou geboekt kan worden, staat er niet in maar één knop '
          + 'verder, bij Boekingstijden: dat is een rooster met periodes en geen veld.',
        ],
      },
    ],
  },
  {
    id: 'home',
    plaats: 'Tabblad 1 — Home',
    titel: 'Wat je op de baan nodig hebt',
    leidraad: 'Home is gemaakt voor het moment waarop je om vijf voor vijf je telefoon '
      + 'bovenhaalt: geen menu, maar meteen de les van vijf uur.',
    delen: [
      {
        waar: 'Bovenaan',
        kop: 'Je lesdag',
        tekst: [
          'Elke les van vandaag met het uur, de baan en wie erin staat. De les die nú bezig '
          + 'is staat open; wat geweest is blijft staan maar wordt grijs. Tik een les aan om '
          + 'hem open of dicht te klappen.',
          'Bij een les die aan een lesgroep hangt staat het niveau met een gekleurd bolletje '
          + 'ervoor — dezelfde kleur die je in de weekagenda als randje links van het blok '
          + 'ziet. Hangt de les aan geen enkele groep, dan staat er geen kleur.',
        ],
      },
      {
        waar: 'Bovenaan',
        kop: 'Aanvragen goedkeuren',
        tekst: [
          'Vraagt een speler een uur aan, dan staat die les bovenaan te wachten en gaat hij '
          + 'niet door tot jij ja zegt. Het uur blijft ondertussen bezet, zodat niemand hem '
          + 'inpikt.',
          'Weiger je, dan hoort de speler dat. Een les die zonder bericht verdwijnt, laat hem '
          + 'wachten op iets wat al beslist is.',
        ],
      },
      {
        waar: 'Bij een les',
        kop: 'Spraakmemo',
        tekst: [
          'Houd de knop ingedrukt en zeg wat je opvalt. Bedoeld voor één of twee zinnen — na '
          + 'een minuut kapt hij af, met een zichtbare aftelling.',
          'Die opname blijft van jou: een speler ziet hem niet, een collega ook niet, en '
          + 'zelfs een beheerder niet. Wat de speler wél ziet, is de notitie die je er '
          + "'s avonds van maakt.",
        ],
      },
      {
        waar: 'Tegels',
        kop: 'Wat er onder je lesdag staat',
        tekst: [
          'Voor een trainer twee tegels: Nieuwe afspraak, en Mijn kinderen als je zelf een '
          + 'kind aan de club hebt. Spelers, Trainers en Beheer stonden hier ook, maar die '
          + 'staan onderaan al in de balk — twee wegen naar hetzelfde scherm maken Home alleen '
          + 'maar langer.',
          'Staat er een getal op een tegel, dan is dat werk dat op je ligt te wachten. Is er '
          + 'niets, dan staat er niets.',
        ],
      },
    ],
  },
  {
    id: 'inplannen',
    plaats: 'Lessen inplannen',
    titel: 'Van aanvraag tot afvinken',
    leidraad: 'Je agenda is van jou. Een collega kan er niet in werken; alleen een beheerder '
      + 'kan in elke agenda inplannen, omdat hij het rooster van de club maakt. Er is geen '
      + 'tabblad Agenda meer: elk stuk staat nu waar je het nodig hebt.',
    delen: [
      {
        waar: 'Home → Nieuwe afspraak',
        kop: 'Eén les of een hele reeks',
        tekst: [
          'Kies dag, uur, baan en speler. Geef bij "Hoeveel lessen?" een aantal op en de app '
          + 'zet de hele reeks klaar; uren die al bezet zijn slaat hij over en meldt hij.',
          'Meer spelers op de baan? Voeg ze toe als deelnemer. Dat maakt er een groepsles van, '
          + 'en dat heeft gevolgen voor het geld.',
        ],
      },
      {
        waar: 'Spelers → Afvinken',
        kop: 'Wie is er vandaag?',
        tekst: [
          'Open dit bij het begin van de les en geef je gsm door: het scherm zoekt zelf de '
          + 'les die nu bezig is en zet de namen groot onder elkaar. Elk kind tikt op zijn '
          + 'eigen naam — één keer voor aanwezig, nog eens voor afwezig, nog eens om hem weer '
          + 'leeg te maken.',
          'Op dat scherm staan alleen de namen en een terugknop bovenaan links: een gsm die '
          + 'rondgaat in een groep komt anders overal terecht. Wie er stond kun je ook later '
          + 'nog bijstellen: open de les en zet het onder Aanwezigheid.',
        ],
      },
      {
        waar: 'Profiel → Boekingstijden',
        kop: 'Tussen welke uren er bij jou geboekt kan worden',
        tekst: [
          'Dezelfde plek als Beheer → Kalender: de gesloten dagen van de club en de uren per '
          + 'trainer staan op één scherm, want ze beantwoorden samen één vraag — wanneer kan '
          + 'er les zijn.',
          'Elke trainer zet er zijn eigen uren; een beheerder die van iedereen. Vul je '
          + 'niets in, dan geldt de tijd van de club (Beheer → Instellingen) — en anders '
          + 'gelden de jouwe, ook als je later doorgaat dan de club.',
          'Wijkt een stuk van het jaar af, zet er dan een periode bij: van datum tot datum '
          + 'andere uren, of helemaal geen les — bijvoorbeeld de week dat je er niet bent. '
          + 'Een periode gaat vóór je standaard, en Reserveren rekent er meteen mee.',
        ],
      },
      {
        waar: 'Een dossier → Weekagenda',
        kop: 'Je week in één beeld',
        tekst: [
          'Het weekraster staat in het dossier van een speler en in dat van een trainer — dus '
          + 'ook in dat van jezelf, via Trainers. Zeven dagkolommen met elke les als blok op '
          + 'zijn plek; de hoogte is de duur, en het randje links is de kleur van de lesgroep. '
          + 'Tik een blok aan en je hebt het lesdetail.',
          'Dat is meteen de kortste weg naar een oude les: blader naar zijn week en tik hem '
          + 'aan. Je hebt er geen lesgroep voor nodig.',
        ],
      },
      {
        waar: 'Beheer → Rapport',
        kop: 'Wat geweest is, en het bestand eronder',
        tekst: [
          'Het rapport kijkt terug over een periode die je zelf kiest, en heeft een knop om '
          + 'je selectie als Excel of CSV te downloaden — precies de lessen die je op het '
          + 'scherm ziet. De lijst per persoon staat in zijn dossier, onder Lesdagen.',
        ],
      },
    ],
  },
  {
    id: 'spelers',
    plaats: 'Tabblad 2 — Spelers',
    titel: 'Het dossier van een speler',
    leidraad: 'De lijst staat leeg tot je kiest wat je wil zien: iedereen, de spelers waar jij '
      + 'al mee werkte, of wie je vandaag op de baan hebt. Een tweede tik op dezelfde tegel '
      + 'sluit hem weer. Zoeken werkt wel meteen en gaat dan door de hele club — op naam of '
      + 'e-mailadres, in willekeurige volgorde van de woorden.',
    delen: [
      {
        waar: 'Dossier',
        kop: 'Vijf tegels',
        tekst: [
          'Lesdagen: wanneer je hem ziet en zag. Weekagenda: zijn week als raster. Lesplan & '
          + 'voortgang: het materiaal dat je hem toewees, met je notities eronder. Doelen: wat '
          + 'jullie afspraken, op drie horizonten. Administratie: zijn betaalwijze, '
          + 'beurtenkaart en sponsorbudget.',
          'Een dossier gaat alleen open voor wie erbij hoort: de trainers, de speler zelf en '
          + 'zijn gekoppelde ouder. Een medespeler uit een groepsles komt er niet in — hij '
          + 'ziet in het lesdetail wel diens naam, maar zonder doorklik.',
        ],
      },
      {
        waar: 'Dossier',
        kop: 'Mailen of een WhatsApp sturen',
        tekst: [
          'Het e-mailadres en het gsm-nummer op een dossier zijn knoppen. Tik op het adres '
          + 'en je mailprogramma opent met de geadresseerde al ingevuld; tik op het nummer '
          + 'en je zit in een WhatsApp-gesprek. Wil je bellen, houd het nummer dan ingedrukt '
          + 'en kopieer het.',
        ],
      },
      {
        waar: 'Voortgang',
        kop: 'Noteren en uitwerken',
        tekst: [
          'Type training, een score, notities en huiswerk. Sprak je een memo in, werk die dan '
          + "uit via Home → memo's: speler, opname en tijdstip staan al ingevuld en je hoeft "
          + 'alleen nog te typen wat je hoorde.',
        ],
      },
    ],
  },
  {
    id: 'trainers',
    plaats: 'Tabblad 3 — Trainers',
    titel: 'Lesmateriaal en tekenveld',
    leidraad: 'Hier staan ook de dossiers van je collega\'s en dat van jezelf: je week, je '
      + 'uren en — alleen in het jouwe — je uurtarief.',
    delen: [
      {
        waar: 'Lesmateriaal',
        kop: 'De databank',
        tekst: [
          'Alle lessen en losse oefeningen van de club, met filters op tag en een zoekveld. '
          + 'Het lessenboekje van de club staat er vanaf je eerste start in.',
        ],
      },
      {
        waar: 'Nieuw lesmateriaal',
        kop: 'Een les met een lesplan',
        tekst: [
          'Titel, link en beschrijving, en daaronder het volledige lesplan: duur, '
          + 'aandachtspunten, materiaal per terrein en een tabel met oefeningen. Pdf’s mogen '
          + 'erbij.',
          'Tags hoef je niet in te vullen: de app herkent zelf waar je tekst over gaat en toont '
          + 'dat live onder het veld. Vul alleen aan wat er niet in staat — "U9", de naam van '
          + 'een reeks.',
        ],
      },
      {
        waar: 'Tekenveld',
        kop: 'Een oefening uittekenen',
        tekst: [
          'Een leeg tennisveld waarop je lijnen trekt en kegels of spelers zet. Bewaar de '
          + 'tekening bij een oefening, zodat je hem terugvindt waar je hem nodig hebt.',
        ],
      },
    ],
  },
  {
    id: 'beheer',
    plaats: 'Tabblad 4 — Beheer',
    titel: 'De club, het geld en het systeem',
    leidraad: 'Vier groepen: Geld, Tennisschool, Club en Systeem. Een deel is alleen voor wie '
      + 'de club beheert; wat je niet mag, staat er niet — geen grijze tegel, geen melding. '
      + 'Zie de beheerdersgids voor wat dat vinkje erbij geeft.',
    delen: [
      {
        waar: 'Geld',
        kop: 'Betalingen, kaarten, rapport',
        tekst: [
          'Betalingen zijn de lessen waarvoor nog geen betaalwijze is gekozen; je bladert er '
          + 'met de pijltjes doorheen in plaats van ze op volgorde af te moeten werken. '
          + 'Beurtenkaarten staan op één plek, met wat er nog op staat. Het rapport toont hoe '
          + 'het loopt over een periode die je zelf kiest, met de knop om het te downloaden.',
        ],
      },
      {
        waar: 'Tennisschool',
        kop: 'Lessen beheren',
        tekst: [
          'Eén tegel met vier schermen erachter: lesgroepen, ziekmelding, en de import en '
          + 'export van het weekschema. Alleen voor een beheerder — de tennisschool is van de '
          + 'club, en een gewone trainer houdt zijn eigen agenda.',
        ],
      },
      {
        waar: 'Club',
        kop: 'Kalender, banen, leden',
        tekst: [
          'De kalender staat er voor iedereen: de gesloten dagen van de club en de uren '
          + 'waarop er bij jou geboekt kan worden. Blijft hij leeg, dan rekent de app met les '
          + 'het hele jaar door — dat merk je pas als er lessen in de kerstvakantie staan.',
          'Banen (namen en uurtarieven, met een staffel per groepsgrootte) en Leden (toevoegen, '
          + 'importeren en gegevens bijwerken) zijn voor een beheerder. Bij het importeren zie '
          + 'je eerst wat het bestand zou doen, en pas als je het herkent gebeurt er iets.',
        ],
      },
      {
        waar: 'Club',
        kop: 'Ouders en kinderen',
        tekst: [
          'Hier staan de aanvragen van ouders die het dossier van hun kind willen volgen, en '
          + 'de koppelingen die al gelegd zijn.',
        ],
      },
      {
        waar: 'Systeem',
        kop: 'Instellingen, doelen, handleiding',
        tekst: [
          'De lesduur van de club, het thema en de taal; de woordenlijst waaruit je kiest als '
          + 'je een doel op een speler zet; en deze gids, ook die van de speler en die van de '
          + 'beheerder.',
        ],
      },
    ],
    waarschuwing: {
      kop: 'Noodopruiming',
      tekst: [
        'Onderaan Instellingen staat de enige knop in de hele app die gegevens onherstelbaar '
        + 'wist. Hij vraagt altijd eerst om bevestiging en gebeurt nooit vanzelf. Gebruik hem '
        + 'niet om "even op te ruimen".',
      ],
    },
  },
  {
    id: 'geld',
    plaats: 'Regels',
    titel: 'Geld in het kort',
    leidraad: 'Vier regels die de app afdwingt. Ze staan niet alleen op het scherm maar ook in '
      + 'de databank, dus je kunt er niet per ongeluk omheen werken.',
    delen: [
      {
        waar: 'Groepsles',
        kop: 'Gaat altijd op factuur',
        tekst: [
          'Een beurt op een tienbeurtenkaart staat voor één privéles, en het sponsorbudget net '
          + 'zo. Cash of QR laat zich niet over vier spelers verdelen. Wat er nog te kiezen '
          + 'valt, is wie de factuur krijgt: de betaler alleen, of ieder zijn deel.',
        ],
      },
      {
        waar: 'Rapport',
        kop: 'Omzet en loon zijn twee bedragen',
        tekst: [
          'De omzet loopt op het uurtarief van de báán — dat is wat de spelers betalen. Je '
          + 'loon loopt op je eigen uurtarief. Het verschil houdt de club over.',
        ],
      },
      {
        waar: 'Betalingen',
        kop: '"Openstaand" betekent: nog niets gekozen',
        tekst: [
          'Zodra je een betaalwijze zet — cash, factuur, QR, kaart of sponsor — telt de les als '
          + 'afgesproken en verdwijnt hij uit de werklijst.',
        ],
      },
      {
        waar: 'Overal',
        kop: 'Een geannuleerde les telt nergens mee',
        tekst: [
          'Niet in de omzet, niet in je loon, en niet in het openstaande saldo van een speler.',
        ],
      },
    ],
  },
  {
    id: 'privacy',
    plaats: 'Regels',
    titel: 'Wat je niet ziet, en waarom',
    leidraad: 'Zoek je deze dingen en vind je ze niet, dan ligt het niet aan jou.',
    delen: [
      {
        waar: 'Rapport',
        kop: 'Je eigen cijfers',
        tekst: [
          'Je ziet je eigen lessen: jouw omzet, jouw loon, jouw spelers. De tabel "Per trainer" '
          + 'en de balk waarmee je naar een andere trainer kijkt, zijn er alleen voor wie de '
          + 'club beheert. Je eigen bedrag heet daarom "Mijn loon" en niet "Trainersloon".',
        ],
      },
      {
        waar: 'Rapport',
        kop: 'Bedragen horen bij je eigen lessen',
        tekst: [
          'Kijk je naar de lessen van een collega, dan zie je zijn lessen wel en zijn bedragen '
          + 'niet, en is er geen export. Dat is niet stuk — dat is de grens.',
        ],
      },
      {
        waar: 'Jouw dossier',
        kop: 'Je uurtarief zet je niet zelf',
        tekst: [
          'Het is wat de club je uitbetaalt, dus de beheerder zet het. Ook een ledenlijst met '
          + 'een kolom uurtarief laat die kolom liggen als je hem niet mag zetten, met een '
          + 'melding erbij.',
        ],
      },
    ],
    waarschuwing: {
      kop: 'Het loon van een collega',
      tekst: [
        'Het uurtarief en "verdiend deze maand" staan alleen in je eigen dossier. In het '
        + 'dossier van een collega staan die regels er niet — niet leeg, niet grijs: ze staan '
        + 'er niet. De databank geeft het bedrag ook niet mee.',
      ],
    },
  },
  {
    id: 'ouders',
    plaats: 'Regels',
    titel: 'Ouders en kinderen',
    leidraad: 'Een ouder kan de lessen, het saldo en de voortgang van zijn kind volgen. Dat is '
      + 'een heel dossier, geen formaliteit — daarom beslis jij erover.',
    delen: [
      {
        waar: 'De ouder',
        kop: 'Vraagt het aan',
        tekst: [
          'Bij Mijn kinderen zoekt hij zijn kind op naam en drukt op Aanvragen. Zolang jij '
          + 'niets zegt, ziet hij niets.',
        ],
      },
      {
        waar: 'Beheer',
        kop: 'Jij beslist',
        tekst: [
          'In Beheer → Ouders en kinderen staat de aanvraag met beide namen erbij. Kijk bij '
          + 'twijfel wie het is: eenmaal gekoppeld ziet hij alles. Losmaken kan later ook.',
        ],
      },
      {
        waar: 'Home',
        kop: 'Heb je zelf een kind aan de club?',
        tekst: [
          'Dan geldt dit ook voor jou: ouderschap hangt niet aan een rol. Koppel je kind bij '
          + 'Mijn kinderen en je krijgt bovenaan een balk "Voor wie".',
          'Let op wat er dan gebeurt: wissel je naar je kind, dan zie je overal het beeld van '
          + 'een speler — zijn agenda in plaats van jouw lesrooster, en de tabbalk van een '
          + 'speler. Je bent op dat moment de ouder van iemand, niet de trainer van iedereen. '
          + 'Terugwisselen doe je bovenaan Home.',
        ],
      },
    ],
  },
  {
    id: 'misgaat',
    plaats: 'Tot slot',
    titel: 'Als er iets misgaat',
    delen: [
      {
        waar: 'Oud scherm',
        kop: 'Ververs hard',
        tekst: [
          'Ctrl of Cmd + Shift + R. De app wordt regelmatig bijgewerkt en je browser houdt de '
          + 'vorige versie soms vast.',
        ],
      },
      {
        waar: 'Loon op nul',
        kop: 'Je uurtarief is nog niet ingevuld',
        tekst: ['Vraag de beheerder om het te zetten; jij kunt het zelf niet.'],
      },
      {
        waar: 'Betaalwijze weigert',
        kop: 'Er staat meer dan één speler in de les',
        tekst: [
          '"Een groepsles gaat altijd op factuur." Klopt dat niet, haal dan eerst de deelnemers '
          + 'weg.',
        ],
      },
      {
        waar: 'Speler ontbreekt',
        kop: 'Nog geen lid',
        tekst: [
          'Voeg hem rechtstreeks toe vanuit de keuzelijst waar je hem zocht: typ de naam en '
          + 'kies toevoegen. Ben je beheerder, dan kan het ook via Beheer → Leden.',
        ],
      },
      {
        waar: 'Geen kleur bij een les',
        kop: 'De les hangt aan geen enkele lesgroep',
        tekst: [
          'Het bolletje komt van de lesgroep, niet van de les. Open het lesdetail: staat er '
          + 'onder Lesgroep niets, dan is dat het. Een beheerder hangt hem daar alsnog aan '
          + 'zijn groep.',
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// De speler
// ---------------------------------------------------------------------------

const SPELER: Gidsstuk[] = [
  {
    id: 'start',
    plaats: 'Om te beginnen',
    titel: 'De eerste keer',
    leidraad: 'Zet de app op je beginscherm, dan opent hij als een gewone app en blijf je '
      + 'ingelogd.',
    delen: [
      {
        waar: 'Inloggen',
        kop: 'Met je e-mailadres',
        tekst: [
          'Kies "Nieuwe login". Stond je al bij de club — je trainer voerde je in — dan wordt '
          + 'je account aan je bestaande dossier gehangen, met je lessen erbij. Je hoeft niet '
          + 'te weten of dat zo is; het gaat vanzelf goed.',
        ],
      },
      {
        waar: 'Home',
        kop: 'Je les van vandaag, en de tegels eronder',
        tekst: [
          'Bovenaan staat je les van vandaag — en heb je er vandaag geen, dan je '
          + 'eerstvolgende, met de dag erbij. Bij een les die aan een lesgroep hangt staat het '
          + 'niveau met een gekleurd bolletje ervoor.',
          'Daaronder de tegels: Reserveren, Mijn agenda, Mijn lessen, Voortgang, en Mijn '
          + 'kinderen als je kinderen aan de club hebt. Op Mijn agenda staat ook wat je nog '
          + 'moet afrekenen, in euro’s en niet als een teller — je wilt weten hoeveel het is, '
          + 'niet hoeveel lessen het zijn.',
        ],
      },
    ],
  },
  {
    id: 'reserveren',
    plaats: 'Reserveren',
    titel: 'Een les aanvragen',
    leidraad: 'Je boekt niet zomaar: de agenda is die van je trainer, dus hij beslist of de '
      + 'les doorgaat.',
    delen: [
      {
        waar: 'Reserveren',
        kop: 'Kies je uur',
        tekst: [
          'Kies een trainer, een dag, een uur en een baan. Je aanvraag krijgt de stand "wacht '
          + 'op goedkeuring" en het uur blijft ondertussen voor je vrijgehouden — niemand kan '
          + 'hem intussen inpikken.',
        ],
      },
      {
        waar: 'Home',
        kop: 'Wat er daarna gebeurt',
        tekst: [
          'Keurt je trainer goed, dan staat de les gewoon in je agenda. Weigert hij, dan krijg '
          + 'je daar bericht van op je hoofdscherm — met een kruisje om het weg te klikken. Je '
          + 'mag gerust een ander uur aanvragen.',
        ],
      },
    ],
  },
  {
    id: 'mijnagenda',
    plaats: 'Mijn agenda',
    titel: 'Je eigen dossier',
    leidraad: 'De tegel Mijn agenda opent je dossier: alles wat de club over jou bijhoudt, op '
      + 'één plek.',
    delen: [
      {
        waar: 'Mijn agenda',
        kop: 'Wat erin staat',
        tekst: [
          'Lesdagen: wanneer je speelt en gespeeld hebt, met een knop om je aankomende lessen '
          + 'als agendabestand te bewaren. Weekagenda: je week als raster, met elke les als '
          + 'blok op zijn plek en de kleur van je lesgroep ernaast. Lesplan & voortgang, en '
          + 'Doelen.',
        ],
      },
      {
        waar: 'Een groepsles',
        kop: 'Wat je van je medespelers ziet',
        tekst: [
          'Hun naam, want je staat met hen op de baan. Verder niets: hun dossier gaat niet '
          + 'voor je open, en hun gsm-nummer of e-mailadres krijg je niet te zien. Omgekeerd '
          + 'geldt hetzelfde — jouw dossier is van jou, je ouder en je trainer.',
        ],
      },
    ],
  },
  {
    id: 'betalen',
    plaats: 'Bij een les',
    titel: 'Betalen',
    leidraad: 'Wie de rekening krijgt, kiest hoe hij betaalt. Voor je eigen les doe je dat dus '
      + 'zelf.',
    delen: [
      {
        waar: 'Je les',
        kop: 'De betaalwijze zetten',
        tekst: [
          'Open de les en tik op de badge met de betaalwijze. Je kunt kiezen uit cash, '
          + 'factuur, QR, je beurtenkaart of je sponsorbudget. Wat je verder niet kunt — het '
          + 'uur verzetten, van trainer wisselen — is met opzet: dat is het werk van je '
          + 'trainer.',
        ],
      },
      {
        waar: 'Groepsles',
        kop: 'Gaat altijd op factuur',
        tekst: [
          'Sta je met meer spelers op de baan, dan is factuur de enige mogelijkheid. Een beurt '
          + 'op je kaart staat voor één privéles, en je sponsorbudget net zo.',
        ],
      },
      {
        waar: 'Je les',
        kop: 'Aanwezigheid',
        tekst: [
          'Bij de les staat wie er die dag was. Op de baan vinkt de trainer af — of tikken de '
          + 'kinderen zelf op hun naam — maar je kunt je ook vooraf afmelden: bij je eigen '
          + 'naam (een ouder bij die van zijn kind) staan dezelfde twee knoppen.',
          'Alleen voor een les van vandaag of later. Wie er vorige week stond, is wat de '
          + 'trainer zag, en dat blijft van hem.',
        ],
      },
      {
        waar: 'Je dossier',
        kop: 'Een opmerking voor je trainer',
        tekst: [
          'Op je dossier staat een veld waarin je kwijt kunt wat je trainer moet weten: een '
          + 'blessure, een week waarin je er niet bent. Hij ziet het bovenaan staan zolang '
          + 'het er staat. Een ouder schrijft het voor zijn kind — dat is meteen het enige '
          + 'dat hij op het account van zijn kind kan wijzigen.',
          'De rest van je gegevens — je naam, je e-mailadres, je gsm-nummer — wijzig je op '
          + 'je eigen profiel, bij Mijn gegevens. Wat over de club gaat (lessen, tarieven, '
          + 'wie er bij wie hoort) kun je lezen maar niet aanpassen.',
        ],
      },
      {
        waar: 'Beurtenkaart',
        kop: 'Wat er nog op staat',
        tekst: [
          'Bij het kiezen van de betaalwijze zie je hoeveel beurten je nog hebt, en hoeveel er '
          + 'van je sponsorbudget over is. Wordt een les geannuleerd, dan komt je beurt terug.',
        ],
      },
    ],
  },
  {
    id: 'lessen',
    plaats: 'Mijn lessen',
    titel: 'Lesmateriaal van je trainer',
    delen: [
      {
        waar: 'Mijn lessen',
        kop: 'Wat voor jou klaarstaat',
        tekst: [
          'De lessen die je trainer aan jou toewees: een uitleg, soms een filmpje of een pdf, '
          + 'en het lesplan met de oefeningen. Materiaal dat de club voor iedereen bewaart '
          + 'staat er niet bij — dat is het gereedschap van de trainer.',
        ],
      },
    ],
  },
  {
    id: 'voortgang',
    plaats: 'Voortgang',
    titel: 'Wat je trainer over je noteert',
    delen: [
      {
        waar: 'Voortgang',
        kop: 'Beoordelingen en huiswerk',
        tekst: [
          'Per les: het type training, een score, wat er opviel en wat je huiswerk is. Je leest '
          + 'het; invullen doet je trainer.',
        ],
      },
      {
        waar: 'Doelen',
        kop: 'Wat jullie afspraken',
        tekst: [
          'Op drie horizonten: binnen tien lessen, binnen twintig, en dit seizoen. Ze staan in '
          + 'je dossier bij je trainer.',
        ],
      },
    ],
  },
  {
    id: 'kinderen',
    plaats: 'Mijn kinderen',
    titel: 'De lessen van je kind volgen',
    leidraad: 'Heb je een kind aan de club, dan kun je zijn agenda, zijn saldo en zijn '
      + 'voortgang zien. Dat hangt niet aan een aparte "ouder"-login: het is dezelfde als '
      + 'waarmee je zelf speelt.',
    delen: [
      {
        waar: 'Mijn kinderen',
        kop: 'Vraag de koppeling aan',
        tekst: [
          'Zoek je kind op naam en druk op Aanvragen. Een trainer keurt het goed — zonder die '
          + 'stap kon iedereen het dossier van elk kind van de club openen door de naam te '
          + 'kiezen.',
        ],
      },
      {
        waar: 'Bovenaan',
        kop: 'Voor wie',
        tekst: [
          'Na goedkeuring staat er bovenaan een balk met jouw naam ("Ikzelf") en die van je '
          + 'kinderen. Alles eronder volgt die keuze: agenda, saldo, lesmateriaal en '
          + 'voortgang.',
          'Je kunt namens je kind een les aanvragen en de betaalwijze zetten van een les '
          + 'waarvan jij de rekening krijgt.',
        ],
      },
    ],
  },
  {
    id: 'misgaat',
    plaats: 'Tot slot',
    titel: 'Als er iets misgaat',
    delen: [
      {
        waar: 'Oud scherm',
        kop: 'Ververs hard',
        tekst: ['Ctrl of Cmd + Shift + R. Je browser houdt de vorige versie soms vast.'],
      },
      {
        waar: 'Lege agenda',
        kop: 'Er staat nog niets ingepland',
        tekst: [
          'Vraag een les aan bij Reserveren, of vraag je trainer of hij je lessen al heeft '
          + 'ingevoerd.',
        ],
      },
      {
        waar: 'Geen kind te zien',
        kop: 'De koppeling is nog niet goedgekeurd',
        tekst: [
          'Bij Mijn kinderen staat of je aanvraag nog wacht of geweigerd is. Vraag het na bij '
          + 'je trainer als het lang duurt.',
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// De beheerder
// ---------------------------------------------------------------------------
//
// Deze gids vervangt de trainersgids niet, hij komt erna: een beheerder is bijna altijd ook
// trainer. Wat hier staat, is uitsluitend wat het vinkje `is_admin` erbij geeft — en waarom
// de app dat achter een vinkje houdt in plaats van achter een aparte login.

const BEHEERDER: Gidsstuk[] = [
  {
    id: 'wat',
    plaats: 'Om te beginnen',
    titel: 'Beheerder is geen aparte login',
    leidraad: 'Je blijft trainer, met je eigen agenda, je eigen spelers en je eigen lesdag. '
      + 'Het beheerdersvinkje voegt rechten toe; het neemt er geen af.',
    delen: [
      {
        waar: 'Overal',
        kop: 'Wat je merkt',
        tekst: [
          'Je logt in zoals iedereen en ziet dezelfde vier tabbladen. Op de plekken waar een '
          + 'gewone trainer stopt, loop jij door: in Beheer staan er meer tegels, in het '
          + 'rapport staat de hele club, en in de agenda van een collega mag je werken.',
          'Op je eigen dossier staat achter je rol "· beheerder". Dat is de enige plek waar '
          + 'het met zoveel woorden staat.',
        ],
      },
      {
        waar: 'Beheer → Leden',
        kop: 'Wie het vinkje krijgt',
        tekst: [
          'Jij zet het, bij een lid in Beheer → Leden. Doe het bewust en spaarzaam: wie het '
          + 'heeft, ziet wat elke collega verdient en kan elk lid verwijderen.',
        ],
      },
    ],
  },
  {
    id: 'tennisschool',
    plaats: 'Beheer → Tennisschool',
    titel: 'De lessen van de school',
    leidraad: 'Vier schermen achter één tegel, en ze zijn alle vier alleen van jou: het gaat '
      + 'over alle trainers samen, en dat is de club en niet één agenda.',
    delen: [
      {
        waar: 'Lesgroepen',
        kop: 'De vaste ploegen van het seizoen',
        tekst: [
          'Een lesgroep is dezelfde ploeg die een heel seizoen op hetzelfde moment traint: een '
          + 'naam, een niveau, een weekdag, een uur, een trainer, een baan en een seizoen. '
          + 'Uit die gegevens zet de app de lessen van het hele seizoen klaar.',
          'Het niveau is meteen de kleur die overal in de app bij die lessen verschijnt — '
          + '"Kidstennis blauw" geeft een blauw bolletje. Staat er geen kleurnaam in, dan '
          + 'staat er alleen de tekst.',
          'Aan het eind van het seizoen archiveer je een groep. Dat is één vinkje en raakt geen '
          + 'enkele boeking aan: de gegeven lessen en hun geschiedenis blijven staan.',
        ],
      },
      {
        waar: 'Ziekmelding',
        kop: 'Een trainer valt uit',
        tekst: [
          'Meld je hem ziek, dan komen zijn lessen op de lijst "zoekt vervanger" te staan — '
          + 'zichtbaar gemarkeerd tot ze geregeld of afgezegd zijn. Een les verdwijnt nooit '
          + 'stil: een les die er gewoon uitziet terwijl er niemand komt, is precies de fout '
          + 'die dit moet voorkomen.',
          'De vervanger komt náást de vaste trainer te staan, nooit in zijn plaats. Zo blijft '
          + 'achteraf leesbaar van wie de les was en wie hem gaf.',
        ],
      },
      {
        waar: 'Import en export',
        kop: 'Het weekschema uit de clublijst',
        tekst: [
          'Je leest het weekschema van de school in uit een bestand: per regel de doelgroep, '
          + 'de groep, de dag, het uur, het terrein, de trainers en de spelers. Je ziet eerst '
          + 'wat het bestand zou doen — welke groepen erbij komen, welke er wijzigen, welke '
          + 'regels hij niet begrijpt — en pas als je het herkent gebeurt er iets.',
          'Groepen worden herkend aan hun sleutel, niet aan hun volgorde in het bestand. Een '
          + 'tweede keer inlezen maakt dus geen dubbele groepen aan.',
        ],
      },
    ],
  },
  {
    id: 'geld',
    plaats: 'Beheer → Geld',
    titel: 'Wat jij ziet en een trainer niet',
    delen: [
      {
        waar: 'Rapport',
        kop: 'De hele club',
        tekst: [
          'Een trainer ziet zijn eigen lessen, zijn eigen omzet en zijn eigen loon. Jij ziet de '
          + 'tabel "Per trainer" en de balk waarmee je naar een andere trainer kijkt — met zijn '
          + 'bedragen erbij, en met de export.',
        ],
      },
      {
        waar: 'Banen',
        kop: 'De uurtarieven',
        tekst: [
          'Het uurtarief van een baan is wat een speler per uur betaalt, met een staffel per '
          + 'groepsgrootte. Dat is geld, dus dit scherm is van jou alleen.',
          'De omzet loopt op dat tarief; het loon van een trainer loopt op zíjn uurtarief, dat '
          + 'jij op zijn dossier zet. Het verschil houdt de club over.',
        ],
      },
      {
        waar: 'Een uurtarief zetten',
        kop: 'Alleen jij kunt het',
        tekst: [
          'Een trainer kan zijn eigen tarief niet zetten — het is wat de club hem uitbetaalt. '
          + 'Staat zijn loon op nul, dan is dit doorgaans de reden. Een ledenlijst die je '
          + 'importeert laat de kolom uurtarief liggen als je hem niet mag zetten.',
        ],
      },
    ],
  },
  {
    id: 'agendas',
    plaats: 'Agenda',
    titel: 'In elke agenda werken',
    delen: [
      {
        waar: 'Nieuwe afspraak',
        kop: 'Ook voor een collega',
        tekst: [
          'Jij kiest bij het inplannen welke trainer de les geeft; een gewone trainer plant '
          + 'alleen bij zichzelf. Dat is het verschil tussen het rooster van de club maken en '
          + 'je eigen week invullen.',
          'Een collega kan jouw lessen dus niet schrappen zonder dat je het merkt. Jij kunt dat '
          + 'wel — wees daar voorzichtig mee.',
        ],
      },
    ],
  },
  {
    id: 'leden',
    plaats: 'Beheer → Leden',
    titel: 'De ledenlijst',
    delen: [
      {
        waar: 'Leden',
        kop: 'Toevoegen, importeren, bijwerken',
        tekst: [
          'Eén lid met de hand, of een hele lijst uit een bestand met naam, e-mailadres, rol, '
          + 'telefoon en uurtarief — alleen naam en e-mailadres zijn verplicht. Wie zo is '
          + 'ingevoerd, stelt op het loginscherm zelf zijn wachtwoord in ("Eerste keer hier?") '
          + 'en krijgt zijn bestaande dossier en lessen mee.',
          'De import verwijdert nooit iemand. Een naam die uit het bestand valt, blijft gewoon '
          + 'lid van de club.',
        ],
      },
      {
        waar: 'Leden',
        kop: 'Een lid verwijderen',
        tekst: [
          'Dit is de enige plek waar een lid met zijn hele geschiedenis verdwijnt. Een gewone '
          + 'trainer maakt spelers aan en houdt het daarbij.',
        ],
      },
    ],
    waarschuwing: {
      kop: 'Zet "Confirm email" aan',
      tekst: [
        'Voordat je leden importeert: staat de e-mailbevestiging uit, dan kan iemand die het '
        + 'adres van een clublid kent dat account claimen voordat het lid zelf komt. Het staat '
        + 'in de instellingen van de databank, niet in deze app.',
      ],
    },
  },
  {
    id: 'grenzen',
    plaats: 'Regels',
    titel: 'Wat het vinkje níét doet',
    leidraad: 'Een paar grenzen gelden ook voor jou. Ze staan in de databank en niet alleen op '
      + 'het scherm, dus je kunt er niet per ongeluk omheen werken.',
    delen: [
      {
        waar: 'Spraakmemo',
        kop: 'Blijft van de trainer',
        tekst: [
          'De opname die een collega inspreekt, is van hem — een speler ziet hem niet, een '
          + 'collega niet, en jij ook niet. Wat de speler wél ziet, is de notitie die de '
          + 'trainer eruit uitwerkt.',
        ],
      },
      {
        waar: 'Groepsles',
        kop: 'Gaat altijd op factuur',
        tekst: [
          'Een beurt op een tienbeurtenkaart staat voor één privéles, en het sponsorbudget net '
          + 'zo. Cash of QR laat zich niet over vier spelers verdelen. Ook jij kunt daar niet '
          + 'omheen.',
        ],
      },
      {
        waar: 'Ouders en kinderen',
        kop: 'Een aanvraag blijft een beslissing',
        tekst: [
          'Een ouder die het ouderschap aanvraagt, ziet niets tot iemand ja zegt. Aanvragen '
          + 'alleen geeft geen enkel recht — anders volstond het aanvragen om aan het dossier '
          + 'van een kind te komen.',
        ],
      },
    ],
    waarschuwing: {
      kop: 'Noodopruiming',
      tekst: [
        'Onderaan Instellingen staat de enige knop in de hele app die gegevens onherstelbaar '
        + 'wist. Hij vraagt altijd eerst om bevestiging en gebeurt nooit vanzelf. Gebruik hem '
        + 'niet om "even op te ruimen".',
      ],
    },
  },
];

/**
 * De gids die bij een soort gebruiker hoort.
 *
 * Een trainer leest zijn eigen gids, maar hij moet ook die van een speler kunnen opslaan:
 * "wat ziet mijn speler eigenlijk" is een vraag die hij aan de baan krijgt, en dan is een
 * scherm waarop hij het kan laten zien meer waard dan een uitleg uit het hoofd. De
 * beheerdersgids staat er om dezelfde reden naast, en omdat wie het vinkje net gekregen
 * heeft nergens anders kan lezen wat het hem geeft.
 */
export function gidsVoor(soort: Gidssoort): Gidsstuk[] {
  if (soort === 'coach') return TRAINER;
  return soort === 'admin' ? BEHEERDER : SPELER;
}

/** Hoe de keuze tussen de gidsen heet op het scherm. */
export function gidsLabel(soort: Gidssoort): string {
  if (soort === 'coach') return t('Voor trainers');
  return soort === 'admin' ? t('Voor beheerders') : t('Voor spelers');
}

/**
 * De hele gids als platte tekst, om in een mail te plakken.
 *
 * Platte tekst en geen opmaak: een mail die met opmaak geplakt wordt, ziet er bij de
 * ontvanger anders uit dan bij de afzender, en een handleiding waarvan de koppen wegvallen
 * leest als één lange brij. Met streepjes en lege regels blijft de structuur staan in élk
 * mailprogramma.
 *
 * Bewust hier en niet in het scherm: het is dezelfde tekst als op het scherm en op de
 * webpagina, en dat blijft alleen zo als er één plek is waar hij vandaan komt.
 */
export function gidsAlsTekst(soort: Gidssoort): string {
  const regels: string[] = [gidsLabel(soort).toUpperCase(), ''];

  for (const stuk of gidsVoor(soort)) {
    regels.push(`${t(stuk.plaats).toUpperCase()} — ${t(stuk.titel)}`);
    // Een streep onder de kop, precies zo lang als de kop zelf.
    regels.push('='.repeat(`${t(stuk.plaats)} — ${t(stuk.titel)}`.length));
    if (stuk.leidraad) regels.push('', t(stuk.leidraad));

    for (const deel of stuk.delen) {
      regels.push('', `[${t(deel.waar)}] ${t(deel.kop)}`);
      for (const alinea of deel.tekst) regels.push(t(alinea));
    }

    if (stuk.waarschuwing) {
      regels.push('', `LET OP — ${t(stuk.waarschuwing.kop)}`);
      for (const alinea of stuk.waarschuwing.tekst) regels.push(t(alinea));
    }

    regels.push('', '');
  }

  return regels.join('\n').trimEnd() + '\n';
}
