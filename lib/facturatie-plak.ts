// De lijst uit het clubsysteem lezen.
//
// Wat erin komt is wat iemand uit een webpagina kopieert en in een tekstvak plakt: velden
// gescheiden door tabs, regels gescheiden door een nieuwe regel, met of zonder koprij.
//
// Eén regel hierover: wat niet gelezen kan worden, verdwijnt niet stilletjes. Het komt als
// overgeslagen regel met reden terug, en het scherm toont hem letterlijk. Een factuur die
// twee uur te weinig telt omdat één regel niet geparsed werd, is erger dan een melding.

import { rond2, schoon, sleutelVan, type Factuurles } from './facturatie';

/** Een gelezen regel: een `Factuurles` zonder de velden die pas bij het bewaren ontstaan. */
export type GeplakteLes =
  Omit<Factuurles, 'id' | 'uren_handmatig' | 'actief' | 'naam_prive' | 'type_prive'>;

export interface OvergeslagenRegel {
  regel: string;
  reden: string;
}

export interface PlakResultaat {
  lessen: GeplakteLes[];
  overgeslagen: OvergeslagenRegel[];
}

/**
 * De woorden van de koprij. Ze worden stilzwijgend overgeslagen, ook als ze elk op een eigen
 * regel staan — zo komt een koprij uit een webpagina vaak binnen.
 *
 * Waarom een lijst en geen "sla de eerste regel over": bij een plakbeurt zonder koprij zou
 * dat een echte les kosten, en die telt dan niet mee op de factuur zonder dat iemand het
 * merkt.
 */
const KOPWOORDEN = new Set([
  'CLUB', 'AANBOD', 'DOELGROEP', 'GROEP', 'DAG + UUR', 'TRAINER',
  'AANWEZIGH.', 'UUR/LOCATIE GEWIJZIGD?', 'STATUS', 'BEDRAG',
]);

/** `wo 09/09/2026 14:00 - 15:00` — de dagafkorting telt niet mee, de rest wel. */
const DAG_UUR = /^[a-z]{2,3}\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/i;

interface Gelezen {
  datum: string;
  uren: number;
}

/** Het dag-en-uurveld, of een reden waarom het niet te lezen is. */
function leesDagUur(veld: string): Gelezen | string {
  const m = DAG_UUR.exec(veld.trim().replace(/\s+/g, ' '));
  if (!m) return 'geen leesbaar dag- en uurveld';

  const [, dd, mm, jjjj, su, sm, eu, em] = m;
  const d = Number(dd), maand = Number(mm), jaar = Number(jjjj);
  const proef = new Date(jaar, maand - 1, d);
  if (proef.getFullYear() !== jaar || proef.getMonth() !== maand - 1 || proef.getDate() !== d) {
    return 'die dag bestaat niet';
  }

  const minuten = (Number(eu) * 60 + Number(em)) - (Number(su) * 60 + Number(sm));
  // Nul of minder is geen les van nul uur maar een regel die niet klopt. Nul uur zou
  // stilletjes goed gaan en op de factuur niets zijn; een melding is eerlijker.
  if (minuten <= 0) return 'de eindtijd ligt niet na de begintijd';

  const two = (n: number) => String(n).padStart(2, '0');
  return { datum: `${jaar}-${two(maand)}-${two(d)}`, uren: rond2(minuten / 60) };
}

/** Is dit de koprij — als volledige rij, of als los kopwoord op een eigen regel? */
function isKop(velden: string[]): boolean {
  return velden.every((v) => KOPWOORDEN.has(schoon(v)));
}

/**
 * De geplakte tekst uit elkaar halen.
 *
 * De kolom `Bedrag` wordt bewust niet gelezen: in de lijst van Gantoise staat daar 0 €, en
 * het echte tarief staat bij de klant. Een factuur die zijn tarief uit de plaktekst haalt,
 * zou voor Gantoise nul euro bedragen.
 */
export function leesPlaktekst(tekst: string): PlakResultaat {
  const lessen: GeplakteLes[] = [];
  const overgeslagen: OvergeslagenRegel[] = [];

  for (const ruw of tekst.split(/\r\n|\r|\n/)) {
    if (ruw.trim() === '') continue;

    const velden = ruw.split('\t').map((v) => v.trim());
    if (isKop(velden.filter((v) => v !== ''))) continue;

    if (velden.length < 5) {
      overgeslagen.push({ regel: ruw.trim(), reden: 'minder dan vijf velden' });
      continue;
    }

    const gelezen = leesDagUur(velden[4]);
    if (typeof gelezen === 'string') {
      overgeslagen.push({ regel: ruw.trim(), reden: gelezen });
      continue;
    }

    const [club_tekst, aanbod, doelgroep, groep, dag_uur] = velden;
    lessen.push({
      bron: 'geplakt',
      club_tekst,
      aanbod,
      doelgroep,
      groep,
      dag_uur,
      trainer: velden[5] ?? '',
      status: velden[8] ?? '',
      datum: gelezen.datum,
      uren: gelezen.uren,
      sleutel: sleutelVan(club_tekst, groep, dag_uur),
    });
  }

  return { lessen, overgeslagen };
}

export interface VerwerkResultaat {
  nieuw: GeplakteLes[];
  bekend: number;
}

/**
 * Wat van een plakbeurt er echt bij komt.
 *
 * Een bekende sleutel raakt niets aan — ook niet als die les geschrapt was of andere uren
 * had gekregen. Anders zou één plakbeurt het handwerk van vorige maand ongedaan maken, en
 * dat is precies het soort stille schade waar niemand achteraf nog op komt.
 */
export function verwerkPlak(
  bestaand: readonly Factuurles[],
  gelezen: readonly GeplakteLes[],
): VerwerkResultaat {
  const gezien = new Set(bestaand.map((l) => l.sleutel));
  const nieuw: GeplakteLes[] = [];
  let bekend = 0;

  for (const les of gelezen) {
    if (gezien.has(les.sleutel)) {
      bekend++;
      continue;
    }
    gezien.add(les.sleutel);
    nieuw.push(les);
  }

  return { nieuw, bekend };
}
