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
import type { Role } from './types';

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
        waar: 'Trainers → jouw naam',
        kop: 'Zet je lesdagen',
        tekst: [
          'Klik op Bewerken en geef op welke dagen en tussen welke uren je lesgeeft. De app '
          + 'gebruikt dat bij het inplannen, dus het scheelt je later werk.',
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
        kop: 'De vier ingangen, met tellers',
        tekst: [
          'Het getal op een tegel is werk dat op je ligt te wachten: lessen die je moet '
          + 'goedkeuren, betalingen die openstaan. Is er niets, dan staat er niets.',
        ],
      },
    ],
  },
  {
    id: 'agenda',
    plaats: 'Tabblad 2 — Agenda',
    titel: 'Lessen inplannen en nakijken',
    leidraad: 'Je agenda is van jou. Een collega kan er niet in werken; alleen een beheerder '
      + 'kan in elke agenda inplannen, omdat hij het rooster van de club maakt.',
    delen: [
      {
        waar: 'Agenda',
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
        waar: 'Nieuwe afspraak',
        kop: 'Eén les of een hele reeks',
        tekst: [
          'Kies dag, uur, baan en speler. Geef bij "Hoeveel lessen?" een aantal op en de app '
          + 'zet de hele reeks klaar; uren die al bezet zijn slaat hij over en meldt hij.',
          'Meer spelers op de baan? Voeg ze toe als deelnemer. Dat maakt er een groepsles van, '
          + 'en dat heeft gevolgen voor het geld.',
        ],
      },
      {
        waar: 'Overzicht',
        kop: 'Geweest en nog te komen',
        tekst: [
          'Historiek kijkt terug per periode en heeft een knop om je selectie als Excel of CSV '
          + 'te downloaden — precies de lessen die je op het scherm ziet. Nog te komen kijkt '
          + 'vooruit, zonder periode, want daar wil je juist niets missen.',
        ],
      },
    ],
  },
  {
    id: 'spelers',
    plaats: 'Tabblad 3 — Spelers',
    titel: 'Het dossier van een speler',
    leidraad: 'De lijst opent op drie stapels: iedereen, de spelers waar jij al mee werkte, en '
      + 'wie je vandaag op de baan hebt. Zoeken mag op naam of e-mailadres, in willekeurige '
      + 'volgorde van de woorden.',
    delen: [
      {
        waar: 'Dossier',
        kop: 'Vier bladen',
        tekst: [
          'Lesdagen: wanneer je hem ziet en zag. Lesplan & voortgang: het materiaal dat je hem '
          + 'toewees, met je notities eronder. Doelen: wat jullie afspraken, op drie '
          + 'horizonten. Administratie: zijn betaalwijze, beurtenkaart en sponsorbudget.',
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
    plaats: 'Tabblad 4 — Trainers',
    titel: 'Lesmateriaal en tekenveld',
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
    plaats: 'Tabblad 5 — Beheer',
    titel: 'De club, het geld en het systeem',
    leidraad: 'Een deel hiervan is alleen voor wie de club beheert; wat je niet mag, staat er '
      + 'niet.',
    delen: [
      {
        waar: 'Geld',
        kop: 'Betalingen, kaarten, rapport',
        tekst: [
          'Betalingen zijn de lessen waarvoor nog geen betaalwijze is gekozen; je bladert er '
          + 'met de pijltjes doorheen in plaats van ze op volgorde af te moeten werken. '
          + 'Beurtenkaarten staan op één plek, met wat er nog op staat. Het rapport toont hoe '
          + 'het loopt over een periode die je zelf kiest.',
        ],
      },
      {
        waar: 'Club',
        kop: 'Banen, doelen, leden',
        tekst: [
          'Baannamen en uurtarieven met een staffel per groepsgrootte, de woordenlijst voor '
          + 'spelersdoelen, een speler toevoegen, en een hele ledenlijst importeren uit Excel. '
          + 'Bij het importeren zie je eerst wat het bestand zou doen, en pas als je het '
          + 'herkent gebeurt er iets.',
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
        waar: 'Historiek',
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
          'Voeg hem toe via Beheer → Speler toevoegen, of rechtstreeks vanuit de keuzelijst '
          + 'waar je hem zocht: typ de naam en kies toevoegen.',
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
        kop: 'Vier tegels',
        tekst: [
          'Reserveren, Mijn agenda, Mijn lessen en Voortgang. Op Mijn agenda staat ook wat je '
          + 'nog moet afrekenen, in euro’s en niet als een teller — je wilt weten hoeveel '
          + 'het is, niet hoeveel lessen het zijn.',
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

/**
 * De gids die bij een rol hoort.
 *
 * Een trainer leest zijn eigen gids, maar hij moet ook die van een speler kunnen opslaan:
 * "wat ziet mijn speler eigenlijk" is een vraag die hij aan de baan krijgt, en dan is een
 * scherm waarop hij het kan laten zien meer waard dan een uitleg uit het hoofd.
 */
export function gidsVoor(rol: Role): Gidsstuk[] {
  return rol === 'coach' ? TRAINER : SPELER;
}

/** Hoe de keuze tussen de twee gidsen heet op het scherm. */
export function gidsLabel(rol: Role): string {
  return rol === 'coach' ? t('Voor trainers') : t('Voor spelers');
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
export function gidsAlsTekst(rol: Role): string {
  const regels: string[] = [gidsLabel(rol).toUpperCase(), ''];

  for (const stuk of gidsVoor(rol)) {
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
