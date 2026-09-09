// Past dit bij wat iemand intypte?
//
// Eén plek voor het zoekgedrag van de hele app, want dat gedrag hoort overal hetzelfde te zijn:
// wie in de ledenlijst leert dat "de mathis" ook "Mathis De Vos" vindt, verwacht datzelfde in
// een groepenlijst. Stond het per scherm los uitgeschreven, dan zou het ene scherm accenten
// negeren en het andere niet, en dan lijkt de app kapot terwijl elk stuk voor zich klopt.
//
// `fold` stond op drie plekken los in de codebase (lib/relations, lib/tags, lib/import-trainingen).
// De tagversie blijft waar hij is — die doet meer dan alleen accenten (zie lib/tags) — maar de
// twee identieke kopieën horen hier.
//
// Puur rekenwerk: geen store, geen scherm.

/**
 * Een tekst zoals je hem vergelijkt en niet zoals je hem schrijft: kleine letters, zonder
 * accenten. Anders vindt "priveles" de groep "Privéles" niet, terwijl niemand dat accent
 * intypt — en op een telefoon al helemaal niet.
 */
export function fold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Past deze tekst bij deze zoekregel?
 *
 * Elk woord uit de zoekregel moet ergens in de tekst terugkomen, maar de volgorde doet er niet
 * toe: "groep rood" vindt "Kidstennis rood - Groep 3" net zo goed als "rood groep". Zo hoef je
 * niet te onthouden hoe iets geschreven staat.
 *
 * Een lege zoekregel past bij alles. Dat is geen gemakzucht maar de enige zinnige uitkomst: een
 * leeg veld is geen vraag, en een lijst die leegloopt zodra je het zoekveld aanraakt, leest als
 * "er is niets".
 */
export function pastBij(tekst: string, zoek: string): boolean {
  const woorden = fold(zoek).split(/\s+/).filter((w) => w !== '');
  if (woorden.length === 0) return true;
  const hooiberg = fold(tekst);
  return woorden.every((w) => hooiberg.includes(w));
}

/**
 * De items waarvan het label bij de zoekregel past, in dezelfde volgorde als ze binnenkwamen.
 *
 * Generiek in `T` en met een `label`-functie erbij, zodat hetzelfde zoekgedrag geldt voor
 * trainers, groepen en lesmateriaal — drie lijsten die niets met elkaar te maken hebben behalve
 * dat je erin zoekt. Wie per lijst zijn eigen filter schrijft, krijgt drie soorten zoeken.
 *
 * `filter` geeft een nieuwe lijst, dus de meegegeven lijst blijft onaangeroerd.
 */
export function zoekOp<T>(items: readonly T[], zoek: string, label: (item: T) => string): T[] {
  return items.filter((item) => pastBij(label(item), zoek));
}
