# Het spelersdossier afschermen voor medespelers

*9 september 2026. Punt 10 uit OPENSTAAND.md.*

## Wat er mis is

In een groepsles is elke medespeler aanklikbaar in het lesdetail
(`components/BookingDetailSheet.tsx`, "Open dossier van {naam}"), en `app/players/` heeft geen
enkele rolcontrole. Een speler opent dus zijn eigen les, tikt op een medespeler, en ziet diens
naam, e-mailadres, telefoonnummer, de opmerking voor de trainer, zijn doelen en zijn
voortgangsnotities. Bij 555 leden, veel kinderen.

Het is geen deep link en geen truc: het is een gewone knop, drie tikken vanaf het hoofdscherm.

Er is een tweede weg die niemand bedoeld heeft. `/players` — de hele clublijst — heeft ook geen
rolcontrole. Voor een speler staat er geen tab naartoe, maar het pad werkt: 555 namen, met per
naam wanneer hij weer les heeft en hoeveel er over hem genoteerd is. Dat is trainersinformatie,
en het is de springplank naar elk dossier.

`app/players/progress.tsx` is wél in orde: dat leest via `useKindkeuze` altijd de eigen speler,
nooit een id uit de URL.

## Waarom de regel er niet al staat

Hij staat er wel, één laag te laat. `app/players/[id].tsx` berekent `magBewerken` als "trainer,
of jezelf, of de ouder van dit kind". Dat is precies de goede set mensen — maar de vraag die
ermee beantwoord wordt is "mag je hier iets wijzigen", terwijl dezelfde set had moeten bepalen
of je het scherm überhaupt mag ópenen. Wie het niet mag, krijgt nu het hele dossier te lezen
met de knoppen eruit.

## Wat we bouwen

### `magDossierZien` in `lib/rechten.ts`

Eén nieuwe functie, met tests ernaast, in dezelfde vorm als `magLoonZien` en `magContactZien`:

```ts
magDossierZien(kijker: User | null | undefined, lid: User | null | undefined, relaties: OuderKind[]): boolean
```

Waar: een beheerder, elke trainer, jijzelf, of de ouder van dít kind. Ouderschap telt alleen
als het goedgekeurd is — `isMijnKind` bewaakt dat — want anders volstaat het aanvrágen van
ouderschap om in het dossier van een kind te komen.

**Waarom niet `magContactZien` hergebruiken.** De set is vandaag identiek, dus het zou meteen
werken. Maar het zijn twee vragen: "mag hij het nummer zien" en "mag hij dit scherm openen".
Zolang ze één functie delen, verschuift de tweede stilzwijgend mee zodra iemand de eerste
verruimt.

**Waarom niet een `_layout` boven `app/players/`.** Dat is centraler, maar dan staat de regel
niet in `lib/` en is hij niet te testen zonder scherm — precies wat de werkwijze in
OPENSTAAND.md afraadt.

### `app/players/[id].tsx`

De vraag komt direct na het opzoeken van `player`, vóór alles wat een rij uitleest: vóór de
kop-kaart, vóór de tegels, vóór `magBewerken`. Mag het niet, dan één regel — "Dit dossier is
niet van jou." — in dezelfde vorm als het bestaande "Speler niet gevonden.". Geen naam, geen
e-mailadres, niets uit die rij op het scherm.

`magBewerken` blijft staan als wat het is: mag je hier iets áán wijzigen. Het staat nu alleen
onder een scherm dat je überhaupt mag openen.

### `app/players/index.tsx`

Wie geen trainer of beheerder is, krijgt "De spelerslijst is voor trainers." De vraag is daar
een andere — het gaat over de hele club en niet over één lid — dus die loopt via `isCoach` en
`isAdmin`, en krijgt geen eigen functie voor iets wat `magClubcijfersZien` al niet is.

### `components/BookingDetailSheet.tsx`

De betaler-regel en elke medespeler-regel worden alleen een `Pressable` als de kijker dat
dossier mag openen. Anders dezelfde tekst en hetzelfde bedrag, zonder chevron en zonder tik.

De namen blijven dus staan. Je moet weten met wie je op de baan staat, en namen zijn in de club
sowieso zichtbaar — het is het dossier eronder dat dicht moet. De trainer- en beheerderskant
verandert niet.

De doorklik naar het trainersdossier (`/coaches/{id}`) blijft zoals hij is: dat scherm schermt
het loon al af met `magLoonZien` en draagt geen contactgegevens van kinderen.

## Wat dit niet is

De databank blijft open. `users_select` staat op `using (true)` zodat leden elkaars naam kunnen
zien (`supabase-schema.sql:584`), en RLS schermt rijen af en geen kolommen — dus e-mail,
telefoon, bio en sponsorbudget gaan nog steeds mee naar elk ingelogd lid dat de API zelf
aanspreekt. Dit sluit de dagelijkse weg, niet de API. Wat er nodig is om dat wél dicht te
zetten staat in OPENSTAAND.md punt 11: een eigen tabel met een eigen select-policy, zoals
`coach_rates` dat al doet.

Dezelfde noot staat al boven `magContactZien`; deze functie krijgt hem ook, want wie hier iets
verandert moet weten dat het scherm de enige grendel is.

## Testen

Bij `magDossierZien`, in `lib/rechten.test.ts`: de beheerder mag, een trainer mag, jezelf mag,
de goedgekeurde ouder mag, een ouder met een openstaande aanvraag mag niet, een medespeler mag
niet, en niemand ingelogd mag niet.

Met de hand na te lopen: met een spelersaccount een groepsles openen — de medespelers staan er
met naam en zonder chevron — en `/players/<id>` van een medespeler rechtstreeks in de adresbalk
proberen.
