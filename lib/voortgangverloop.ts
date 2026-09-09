// Hoe een speler ervoor staat over de maanden heen.
//
// WAAROM DIT BESTAAT. De trainer zet bij elke notitie een score van één tot vijf sterren, en
// die stonden alleen per notitie in de tijdlijn. Om te zien of een speler vooruitgaat moest je
// een half jaar notities naast elkaar lezen en de sterren uit je hoofd optellen — dus deed
// niemand het, en werd het cijfer alleen gezet, nooit gelezen. Een verloop maakt van vijftig
// losse sterren één zin: het gaat beter, of het gaat niet beter.
//
// WAT ER MEETELT. Alleen notities mét een score. Een notitie zonder sterren zegt iets anders
// ("huiswerk meegegeven", "was er niet"), en die als nul meerekenen zou de lijn omlaag trekken
// om een reden die niets met tennis te maken heeft. Ze telt daarom niet mee in het gemiddelde
// en ook niet in het aantal.
//
// EEN LEGE MAAND BLIJFT STAAN. Met `gemiddelde: null`, en dat is niet hetzelfde als nul. Een
// score is één tot vijf, dus nul bestaat niet als score — een maand zonder notities is een gat
// in het verloop, en dat gat is zelf informatie ("in juli lag alles stil"). Zou je die maanden
// weglaten, dan kwamen de staafjes ongelijk verdeeld naast elkaar te staan en zou een pauze van
// drie maanden eruitzien als een vlotte reeks lessen.
//
// Zelfde vorm als `monthlySeries` in lib/reports, met opzet: dat is het verloop van de omzet en
// dit is het verloop van een speler, en twee grafieken die hetzelfde bedoelen horen hetzelfde
// gelezen te worden.

import { shortMonthName } from './period';
import type { StudentProgress, TrainingType } from './types';

/** Eén maand in het verloop van een speler. */
export interface VoortgangPunt {
  year: number;
  /** 0 = januari, zoals `Date#getMonth`. */
  month: number;
  /** "aug" — kort genoeg om onder een staafje te passen. */
  label: string;
  /** Het aantal notities mét een score in die maand. */
  aantal: number;
  /**
   * De gemiddelde score, op één cijfer na de komma. `null` = die maand geen enkele notitie
   * met een score, en dat is iets anders dan nul: nul bestaat niet als score.
   */
  gemiddelde: number | null;
}

/** De maand van een notitie, als sleutel. Zonder leesbare datum valt ze weg. */
function maandSleutel(p: StudentProgress): string | null {
  if (!p.created_at) return null;
  const d = new Date(p.created_at);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${d.getMonth()}`;
}

/** Telt deze notitie mee? Alleen met een score, en die moet binnen de sterren vallen. */
function heeftScore(p: StudentProgress): p is StudentProgress & { rating: number } {
  return typeof p.rating === 'number' && p.rating >= 1 && p.rating <= 5;
}

/**
 * Het verloop van één speler over de laatste `months` maanden tot en met de maand waarin
 * `until` valt.
 *
 * Filtert zelf op de speler: het scherm geeft gewoon alle notities door die het heeft, net
 * zoals `monthlySeries` alle zichtbare lessen krijgt. Zo staat de vraag "welke notities zijn
 * van hem" op één plek en niet in elk scherm opnieuw.
 */
export function voortgangPerMaand(
  progress: StudentProgress[],
  studentId: string,
  until: Date,
  months: number,
): VoortgangPunt[] {
  const count = Math.max(0, Math.floor(months));

  const punten: VoortgangPunt[] = [];
  const index = new Map<string, { punt: VoortgangPunt; som: number }>();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(until.getFullYear(), until.getMonth() - i, 1);
    const punt: VoortgangPunt = {
      year: d.getFullYear(),
      month: d.getMonth(),
      label: shortMonthName(d.getMonth()),
      aantal: 0,
      gemiddelde: null,
    };
    punten.push(punt);
    index.set(`${punt.year}-${punt.month}`, { punt, som: 0 });
  }

  for (const p of progress) {
    if (p.student_id !== studentId) continue;
    if (!heeftScore(p)) continue;
    const sleutel = maandSleutel(p);
    const vak = sleutel === null ? undefined : index.get(sleutel);
    // Notities buiten de reeks tellen niet mee: de grafiek toont wat er onder de staafjes staat.
    if (!vak) continue;
    vak.punt.aantal += 1;
    vak.som += p.rating;
  }

  for (const { punt, som } of index.values()) {
    if (punt.aantal === 0) continue;
    // Eén cijfer na de komma. Twee suggereert een nauwkeurigheid die vijf sterren niet hebben.
    punt.gemiddelde = Math.round((som / punt.aantal) * 10) / 10;
  }

  return punten;
}

/** Wat het verloop in het kort zegt. */
export interface VoortgangSamenvatting {
  /** Het gemiddelde over de hele reeks, of `null` als er nergens een score staat. */
  gemiddelde: number | null;
  /** Hoeveel notities met een score er in de reeks zitten. */
  aantal: number;
  /**
   * Het verschil tussen de eerste en de laatste maand mét scores, op één cijfer na de komma.
   * `null` zolang er niet in minstens twee verschillende maanden gescoord is — met één maand
   * valt er geen verloop te zien, en dan hoort er ook geen pijl te staan.
   */
  verschil: number | null;
}

/**
 * De reeks in één zin: hoe het gemiddeld gaat, en of het beter of minder gaat.
 *
 * Het verschil kijkt naar de eerste en de laatste maand waarin gescoord is, niet naar de
 * eerste en laatste maand van de reeks. Anders zou een lege januari het verloop bepalen van
 * een speler die pas in maart begon.
 *
 * Bewust geen oordeel: dit geeft een getal terug en geen "gaat vooruit". Wat een verschil van
 * 0,3 betekent, hangt af van hoeveel lessen erachter zitten en van de speler — dat is een
 * gesprek tussen trainer en speler, geen conclusie van een rekensom.
 */
export function voortgangSamenvatting(reeks: VoortgangPunt[]): VoortgangSamenvatting {
  const metScore = reeks.filter((p) => p.gemiddelde !== null && p.aantal > 0);
  const aantal = metScore.reduce((som, p) => som + p.aantal, 0);
  if (aantal === 0) return { gemiddelde: null, aantal: 0, verschil: null };

  // Gewogen op het aantal notities: een maand met zeven notities weegt zwaarder dan een maand
  // met één. Het gemiddelde van de maandgemiddelden zou die ene notitie even zwaar maken.
  const som = metScore.reduce((s, p) => s + (p.gemiddelde as number) * p.aantal, 0);
  const gemiddelde = Math.round((som / aantal) * 10) / 10;

  const eerste = metScore[0];
  const laatste = metScore[metScore.length - 1];
  const verschil = metScore.length < 2
    ? null
    : Math.round(((laatste.gemiddelde as number) - (eerste.gemiddelde as number)) * 10) / 10;

  return { gemiddelde, aantal, verschil };
}

/** Het gemiddelde per soort training, voor wie wil zien waar het aan ligt. */
export interface SoortGemiddelde {
  soort: TrainingType;
  aantal: number;
  gemiddelde: number;
}

/**
 * Waar de scores vandaan komen: per soort training, van hoog naar laag.
 *
 * Een gemiddelde van 3,2 zegt niet waaraan gewerkt moet worden; "techniek 4,1 en fysiek 2,4"
 * wel. Soorten zonder score komen er niet in — een lege regel "mentaal: —" vult het scherm
 * zonder iets te zeggen.
 */
export function gemiddeldePerSoort(
  progress: StudentProgress[],
  studentId: string,
): SoortGemiddelde[] {
  const per = new Map<TrainingType, { som: number; aantal: number }>();

  for (const p of progress) {
    if (p.student_id !== studentId) continue;
    if (!heeftScore(p)) continue;
    const vak = per.get(p.training_type) ?? { som: 0, aantal: 0 };
    vak.som += p.rating;
    vak.aantal += 1;
    per.set(p.training_type, vak);
  }

  return [...per.entries()]
    .map(([soort, vak]) => ({
      soort,
      aantal: vak.aantal,
      gemiddelde: Math.round((vak.som / vak.aantal) * 10) / 10,
    }))
    // Hoogste eerst, en bij gelijke score de meest genoteerde: zo staat bovenaan waar het
    // meeste over te zeggen valt, en onderaan waar het werk ligt.
    .sort((a, b) => b.gemiddelde - a.gemiddelde || b.aantal - a.aantal);
}
