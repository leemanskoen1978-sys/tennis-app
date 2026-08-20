// Eén bedrag-opmaak voor de hele app: twee decimalen en een komma, zoals men hier een bedrag
// schrijft. Een eigen bestandje, zodat zowel de export als het rekenwerk eromheen hem kan
// gebruiken zonder dat die twee elkaar hoeven te importeren.

export function formatEuro(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

/**
 * Wat iemand in een bedragveld typt, als getal. Leeg of onzin levert `undefined`: dan is er
 * geen bedrag, en dat is iets anders dan € 0,00. Een komma mag — zo schrijft men hier een
 * bedrag — en een euroteken of spatie storen niet.
 *
 * Negatief telt als onzin: een tarief onder nul zou betekenen dat de club geld toelegt, en
 * dat is nooit wat iemand bedoelde te typen.
 */
export function parseEuro(text: string): number | undefined {
  const cleaned = text.replace(/[€\s]/g, '').replace(',', '.');
  if (cleaned === '') return undefined;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value * 100) / 100;
}
