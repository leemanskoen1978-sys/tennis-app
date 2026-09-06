// Een tabel in stukken ophalen, tot ze op is.
//
// WAAROM DIT BESTAAT. PostgREST — de laag waarmee Supabase de databank aanbiedt — geeft nooit
// meer dan een vast aantal rijen per verzoek terug. Bij Supabase staat dat standaard op duizend.
// Een `select('*')` op een tabel met 6396 lessen levert er dus 1000 op, zonder foutmelding en
// zonder waarschuwing: de app krijgt een antwoord dat er gezond uitziet en waar tweederde uit
// weg is.
//
// Dat is precies wat er op 6 september 2026 gebeurde. Tot die dag stonden er 325 lessen in de
// databank van de club en viel het niemand op. Na de import van de tennisschool stonden er 6396,
// en zag een trainer zijn eigen agenda leeg staan terwijl zijn lessen er gewoon waren.
//
// Deze functie kent geen Supabase en geen tabellen: er gaat een ophaler in die een stuk levert,
// en er komt een volledige lijst uit. Zo is de regel te testen zonder databank, net als de rest
// van lib/ — en dat is nodig, want een fout hierin is er precies één van het soort dat je pas
// merkt als er te veel gegevens zijn om het nog met de hand na te tellen.

/**
 * Hoeveel rijen er per verzoek gevraagd worden.
 *
 * Gelijk aan de standaardgrens van Supabase, en met opzet niet hoger: vraag je er meer, dan geeft
 * de server er stilletjes minder terug en denkt deze functie dat de tabel op is. De grens is
 * instelbaar per project, dus hij zou hoger kúnnen liggen — maar te laag mikken kost hoogstens
 * een extra verzoek, en te hoog mikken kost gegevens.
 */
export const PAGINAGROOTTE = 1000;

/**
 * Alle rijen ophalen door te blijven vragen tot er een onvolledig stuk terugkomt.
 *
 * Een stuk dat kleiner is dan gevraagd, betekent dat het einde bereikt is. Dat is de enige
 * betrouwbare stopvoorwaarde: het totaal opvragen zou een tweede verzoek kosten en kan intussen
 * alweer veranderd zijn.
 *
 * `haal` krijgt een begin en een eind, allebei meegerekend — dezelfde vorm als `range()` van
 * Supabase, zodat de aanroeper niets hoeft om te rekenen.
 *
 * `maxPaginas` is een noodrem en geen instelling. Zou een server bij elk verzoek een vol stuk
 * blijven leveren — omdat hij `range` negeert bijvoorbeeld — dan draait deze lus eeuwig en hangt
 * de app bij het opstarten. Duizend stukken is een miljoen rijen; een club die daaraan komt heeft
 * een ander gesprek nodig dan deze lus.
 */
export async function alleRijen<T>(
  haal: (van: number, tot: number) => Promise<T[]>,
  paginagrootte: number = PAGINAGROOTTE,
  maxPaginas = 1000,
): Promise<T[]> {
  const alles: T[] = [];
  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const van = pagina * paginagrootte;
    const stuk = await haal(van, van + paginagrootte - 1);
    alles.push(...stuk);
    if (stuk.length < paginagrootte) return alles;
  }
  return alles;
}
