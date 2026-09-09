// Welke kleur hoort bij een lesgroep.
//
// Deze club noemt haar groepen naar de kleuren van het jeugdtennis: "Kidstennis blauw",
// "Kidstennis rood", "Oranje". Zo praten trainers en ouders er ook over — "hij zit bij de
// blauwen". Op het scherm hoort die kleur er dus ook als kleur te staan, niet alleen als woord.
//
// De kleur komt uit `lesson_groups.level` — de kolom Doelgroep uit de clublijst. Ze staat vaak
// óók in `name` ("Blauw - Groep 1"), en die dient hier als terugval: noemt het niveau geen
// kleur, dan mag de naam hem nog leveren. Het niveau gaat voor omdat het de indeling van de
// club is; een naam is hoe één groep binnen dat niveau heet.
//
// De kleur wordt uit de tekst gelezen en staat niet als eigen kolom in de databank. Dat is met
// opzet: beide velden komen als vrije tekst uit de clublijst en er is geen scherm waar iemand
// een kleur zou kunnen kiezen. Een kolom erbij zou betekenen dat 192 groepen met de hand
// nagelopen moeten worden voor iets wat al in hun niveau staat.
//
// Staat er nergens een kleurnaam in, dan is het antwoord `null` en toont het scherm gewoon de
// tekst. "Volwassenen gevorderden" is een volwaardige groep; ze heeft alleen geen kleur.

/**
 * De kleurnamen die we herkennen, met de kleur die erbij hoort.
 *
 * Niet de kleur die de verf heeft maar de kleur die op een scherm werkt: een bolletje van
 * twaalf bij twaalf pixels moet leesbaar blijven op wit én op donkergrijs. Zuiver geel
 * (#FFFF00) verdwijnt op wit, zuiver blauw (#0000FF) verdwijnt op donker. Deze tinten zitten
 * daar telkens tussenin.
 *
 * Wit is de uitzondering die geen tint heeft: dat bolletje bestaat alleen dankzij zijn rand
 * (zie `components/ui/GroepStip`), want wit op een witte kaart is geen bolletje.
 */
const KLEUREN: ReadonlyArray<readonly [RegExp, string, string, string?]> = [
  // De patronen vangen de verbogen vormen mee: "rode groep", "witte les", "gele kaart".
  [/\brood\b|\brode\b/i, 'rood', '#D33A2C'],
  [/\boranje\b/i, 'oranje', '#E07B2A'],
  [/\bgroen(e)?\b/i, 'groen', '#3B9E45'],
  [/\bblauw(e)?\b/i, 'blauw', '#2F6FB5'],
  [/\bgeel\b|\bgele\b/i, 'geel', '#D9A400'],
  [/\bpaars(e)?\b/i, 'paars', '#7A4FB0'],
  [/\broze\b/i, 'roze', '#D9569B'],
  [/\bzwart(e)?\b/i, 'zwart', '#2B2B2B'],
  // Wit staat achteraan met opzet: een groep die zowel een echte kleur als het woord wit
  // draagt ("Wit-Rood") bedoelt die andere kleur.
  //
  // En wit is de enige met een tweede waarde. Een bolletje mag echt wit zijn — het heeft zijn
  // rand — maar een streep van drie pixels op een witte kaart heeft die niet en verdwijnt dan
  // gewoon. Daar staat een grijs dat als "wit" leest naast blauw en rood, in plaats van een
  // les die er als enige geen kleur lijkt te hebben.
  [/\bwit(te)?\b/i, 'wit', '#FFFFFF', '#B7BDB0'],
];

/** De kleur van een lesgroep: hoe hij heet en hoe hij eruitziet. */
export interface Groepskleur {
  /** De kleurnaam zoals wij hem kennen, altijd in kleine letters: "blauw". */
  naam: string;
  /** De kleur om een vlak mee te vullen dat zelf een rand heeft — het bolletje. */
  hex: string;
  /**
   * Dezelfde kleur om een lijn mee te trekken die géén rand heeft: het randje links van een
   * blok in het weekraster. Voor elke kleur is dat `hex`; alleen wit wijkt af, want wit op
   * een witte kaart is geen lijn.
   */
  lijnHex: string;
}

/**
 * De kleur die in deze tekst genoemd wordt, of `null` als er geen kleurnaam in staat.
 *
 * Zoekt op hele woorden. Zonder die grens zou "Witsel" wit opleveren en "Bordeaux" rood — en
 * dat is precies het soort fout dat niemand meldt omdat het bolletje er plausibel uitziet.
 *
 * Staat er meer dan één kleur in ("van blauw naar rood"), dan wint de eerste uit de lijst
 * hierboven en niet de eerste in de tekst. Dat is een willekeurige keuze, maar wel een vaste:
 * dezelfde groep krijgt zo altijd hetzelfde bolletje, ook als iemand haar anders opschrijft.
 */
export function kleurIn(tekst: string | null | undefined): Groepskleur | null {
  if (!tekst) return null;
  for (const [patroon, naam, hex, lijnHex] of KLEUREN) {
    if (patroon.test(tekst)) return { naam, hex, lijnHex: lijnHex ?? hex };
  }
  return null;
}

/**
 * De kleur van een lesgroep: uit haar niveau, en anders uit haar naam.
 *
 * Het niveau gaat voor: dat is de indeling van de club ("Kidstennis blauw") en het staat op
 * elke groep. De naam ("Blauw - Groep 1") zegt doorgaans hetzelfde en vangt de groepen op
 * waarvan het niveau de kleur niet noemt.
 */
export function groepskleur(
  niveau: string | null | undefined,
  naam?: string | null,
): Groepskleur | null {
  return kleurIn(niveau) ?? kleurIn(naam);
}
