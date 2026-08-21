# Leden importeren uit Excel, en de eerste keer inloggen

21 augustus 2026.

## Wat dit oplost

Een club begint niet leeg. De namen, adressen en telefoonnummers van leerlingen en
trainers staan al ergens in een Excel-bestand. Die met de hand overtypen in de app is werk
dat niemand doet, en zolang het niet gebeurt blijft de app naast de club staan in plaats
van erin.

Het tweede deel volgt uit het eerste. Wie geïmporteerd is, bestaat wel maar heeft nog geen
login. Als die persoon voor het eerst de app opent, hoort hij niet te lezen "maak een
account aan" — hij heeft er al een; hij mist alleen nog een wachtwoord.

## Wat er al staat

Het halve werk ligt er, en dit ontwerp verandert daar niets aan:

- `users.auth_id` mag leeg zijn. Een trainer voert iemand in die nog nooit inlogde, en die
  persoon heeft vanaf dat moment lessen, een beurtenkaart en een dossier.
- De trigger `link_auth_user` koppelt een nieuwe login op e-mailadres aan die bestaande
  rij. Bestaat het adres nog niet, dan komt er een speler bij.
- `lib/csv.ts` schrijft CSV, `lib/share.ts` geeft een bestand aan de browser.

**Geen schemawijziging.** Dit ontwerp is een deur naar een gang die er al ligt.

## Deel 1 — De import

### Waar

Beheer → *Leden importeren*. Alleen zichtbaar voor een trainer, en dat is niet alleen een
schermregel: de policy `users_insert` staat een `insert` op `users` sowieso alleen toe aan
`is_coach()`.

### Het bestand

CSV, zoals Excel het opslaat met "Opslaan als → CSV". Kolomkoppen in het Nederlands,
volgorde maakt niet uit, hoofdletters evenmin.

| kolom | verplicht | opmerking |
| --- | --- | --- |
| `naam` | ja | |
| `email` | ja | de sleutel — hierop koppelt de login later |
| `rol` | nee | `speler` (standaard), `trainer`, `ouder` |
| `telefoon` | nee | |
| `uurtarief` | nee | alleen zinvol bij een trainer |

De rolnamen in het bestand zijn Nederlands en die in de databank Engels
(`player`, `coach`, `parent`). Die vertaling staat op één plek, in `lib/import-leden.ts`.
Een trainer hoort niet te weten dat zijn rol intern `coach` heet.

Twee dingen die Excel doet en waar een naïeve lezer op stukloopt: Nederlandse Excel
scheidt met een **puntkomma**, niet met een komma, en zet een **BOM** vooraan. De lezer
herkent beide — zonder dat wordt "Müller" onleesbaar en staat de hele regel in één kolom.

### Drie eenheden

**`lib/csv.ts` krijgt een lezer bij (`parseCsv`).** Dat bestand kan nu alleen schrijven.
De lezer neemt tekst en geeft rijen van cellen: aanhalingstekens, puntkomma of komma
(herkend aan de kopregel), BOM eraf, lege regels weg. Weet niets van leden.

**`lib/import-leden.ts` — nieuw, puur.** Neemt de gelezen rijen plus de huidige
ledenlijst, en geeft een plan terug:

```
{ nieuw: Lid[], bijgewerkt: { bestaand, wijzigingen }[], fouten: { regel, reden }[] }
```

Hier zit alle regelgeving, en niets anders: is het adres geldig, is de rol bekend, staat
hetzelfde adres twee keer in het bestand, en — bij een bestaand lid — welke velden
verándert dit bestand eigenlijk. Geen databank, geen scherm, volledig te testen.

**`app/admin/leden-import.tsx` — het scherm.** Bestand kiezen → plan tonen → knop
*Importeren*. Pas na die knop wordt er iets weggeschreven, via `addUser` en `updateUser`
van de provider; die weg werkt zowel met Supabase als op de lokale opslag.

### Het bestand binnenkrijgen

Op de website een gewone bestandskiezer. Op een telefoon bestaat die niet zonder een
pakket erbij (`expo-document-picker`), dus staat daar een plakvak: kolommen uit Excel
kopiëren en plakken, tab-gescheiden. Dat is dezelfde keuze die `lib/share.ts` al maakt aan
de exportkant — xlsx alleen op web, CSV overal — en om dezelfde reden: geen pakket erbij
voor een knop die op de plek waar de club de app gebruikt allang werkt.

### Wat er misgaat, gaat per regel mis

Regel 7 mist een adres, dan gaan de andere 42 gewoon door en staat regel 7 met reden in de
lijst. Eén typefout hoort geen hele club tegen te houden. Het plan toont de telling
vooraf ("40 nieuw, 2 bijgewerkt, 1 fout"), zodat een trainer die het verkeerde bestand
koos dat ziet vóór er iets gebeurt en niet erna.

Gaat het schrijven zelf mis (netwerk weg, halverwege), dan meldt het scherm hoeveel er
gelukt zijn en welke niet. Het bestand mag opnieuw: wie er al staat, wordt bijgewerkt in
plaats van verdubbeld — de import is herhaalbaar.

### Erbij

Een knop *Voorbeeldbestand*: downloadt een CSV met alleen de kopregel, via het bestaande
`shareCsv`. Kost bijna niets en scheelt het raden van kolomnamen.

## Deel 2 — De eerste keer inloggen

### Wat de gebruiker ziet

Het loginscherm heeft nu twee standen: *Inloggen* en *Account aanmaken*. Er komt een derde
bij, met de voorkeurspositie onder de knop:

> **Eerste keer hier? Stel je wachtwoord in.**

Dat scherm vraagt twee dingen: e-mailadres en wachtwoord, dat laatste twee keer. Een
typefout in een wachtwoord dat je nog nooit gebruikt hebt, sluit je buiten zonder dat er
een weg terug is — dus die tweede regel is er geen beleefdheid maar een slot.

Geen naam. Die staat al in de ledenlijst.

### Wat eronder gebeurt

`signUp` maakt de login, de bestaande trigger `link_auth_user` zoekt de rij met hetzelfde
adres en hangt de login eraan. De speler ziet meteen zijn lessen, zijn beurtenkaart en
zijn dossier — die stonden er al vanaf de import.

### Drie regels, expliciet

1. **De naam blijft van de trainer.** Matcht het adres, dan wint de naam uit de
   ledenlijst; iemand hernoemt zichzelf niet via het loginscherm. Matcht het adres niet,
   dan komt er een speler bij met de naam uit het adres. Dat is het huidige gedrag en het
   blijft zo.
2. **De rol komt nooit uit dit scherm.** Wie als trainer geïmporteerd is, is trainer. Wie
   er niet in stond, wordt speler. Trainer word je alleen in Beheer.
3. **De bekende opening.** Wie het adres van een clublid kent, kan dat account claimen
   zolang Supabase geen bevestigingsmail eist. Dat geldt vandaag al voor "Account
   aanmaken", dus dit maakt het niet erger — maar het is het aanzetten van *Confirm email*
   in Supabase waard. Dat komt als regel in de README, niet als code.

### Meldingen

- de twee wachtwoorden verschillen
- het wachtwoord is te kort (Supabase eist zes tekens)
- er bestaat al een wachtwoord voor dit adres → "log gewoon in", met de knop ernaartoe

Die laatste is de belangrijkste: iemand die vorig seizoen al een wachtwoord koos en dat
vergeten is, komt hier terecht en moet niet in een muur lopen.

## Testen

Alles wat te toetsen valt zit in `lib/`, zoals de 483 bestaande tests:

- `parseCsv`: puntkomma, komma, aanhalingstekens met een scheidingsteken erin, BOM, lege
  regels, kopregel met andere hoofdletters.
- `planImport`: nieuw, bijgewerkt, ongeldig adres, onbekende rol, hetzelfde adres twee
  keer in één bestand, een bestand zonder verplichte kolom, een bestaand lid waarbij
  niets verandert (hoort niet in `bijgewerkt` te staan).
- de rolvertaling heen en terug.
- de wachtwoordcontroles van het loginscherm, als losse functie zodat ze zonder scherm te
  toetsen zijn.

De schermen zelf worden met de hand doorlopen op web. `npx tsc --noEmit` en
`npx expo export --platform web` horen bij de oplevering.

## Wat hier bewust niet in zit

- **Uitnodigingsmails.** Vraagt een Edge Function met de service-role sleutel en werkende
  mailbezorging. Kan later; het ontwerp staat het niet in de weg.
- **Echte .xlsx lezen.** Een xlsx is een zip, dus dat vraagt decompressie. "Opslaan als
  CSV" is één klik voor de trainer en scheelt tweehonderd regels waar niemand naar wil
  kijken.
- **Verwijderen via de import.** Een naam die uit het bestand valt, verdwijnt niet uit de
  club. Iemand wissen die lessen en een dossier heeft, is een besluit en geen bijwerking
  van een bestand.

---

# Aanvulling — wachtwoord vergeten

21 augustus 2026, na de eerste reviewronde.

## Waarom dit erbij hoort

Het ontwerp hierboven zorgt dat wie al een wachtwoord heeft, de melding *"Er bestaat al een
wachtwoord voor dit adres. Log gewoon in."* krijgt in plaats van stil een nieuw wachtwoord te
denken te zetten. Dat is de juiste melding — maar zonder uitweg is het een doodlopende straat
voor precies de persoon die hem het vaakst zal lezen: iemand die vorig seizoen een wachtwoord
koos en het kwijt is.

## De weg

**Op het loginscherm** komt een vierde stand: *Wachtwoord vergeten?*. Die vraagt alleen een
e-mailadres en stuurt een herstelmail via `supabase.auth.resetPasswordForEmail`.

De melding erna is **altijd dezelfde**, of dat adres nu bestaat of niet: *"Als dit adres bij de
club bekend is, staat er zo een mail in je mailbox."* Dat is geen vaagheid maar dezelfde regel
die Supabase zelf aanhoudt bij het aanmelden — wie een adres intypt hoort niet te weten te
komen wie er lid is van de club.

**De link in die mail** opent de app met een herstelsessie. Supabase meldt dat als de
gebeurtenis `PASSWORD_RECOVERY`. Twee dingen staan dat vandaag in de weg:

1. `onAuthChange` in `providers/supabaseStore.ts` gooit het soort gebeurtenis weg — de
   handler krijgt niets mee. Dat moet erdoorheen.
2. `app/_layout.tsx` stuurt iedereen mét een sessie naar de hub. Na een herstellink ís er een
   sessie, dus die persoon belandt in de app zonder ooit een wachtwoord te kiezen — en de
   volgende keer staat hij weer buiten.

Daarom houdt de provider een vlag bij: er loopt een wachtwoordherstel. Zolang die aanstaat
leidt de indeling naar één scherm, en pas als het nieuwe wachtwoord gezet is valt die vlag weg.

**Het scherm `app/nieuw-wachtwoord.tsx`** vraagt tweemaal een nieuw wachtwoord — dezelfde
controle als bij de eerste keer inloggen, uit `lib/wachtwoord.ts` — en zet het met
`supabase.auth.updateUser`. Daarna is hij gewoon binnen.

## Alleen op het web, net als de rest

De herstellink werkt op de website. Op een telefoon vraagt dat `detectSessionInUrl` buiten web,
een `Linking`-luisteraar en een geregistreerd schema — en dat is dezelfde afweging die dit
project al twee keer eerder maakte (de xlsx-export in `lib/share.ts`, de bestandskiezer in
`lib/bestand.ts`): geen pakketten en geen extra machinerie voor een weg die op de plek waar de
club de app gebruikt allang werkt. De knop *stuurt* de mail wel vanaf een telefoon; de link
erin opent de website, en daar gaat het verder.

## Wat er in Supabase moet staan

Twee dingen, en zonder allebei doet de knop niets zichtbaars:

- **Mailbezorging.** Dezelfde voorwaarde als *Confirm email* uit de README. De ingebouwde
  mail van Supabase is streng gelimiteerd; een club met vijftig leden hoort een eigen SMTP in
  te stellen.
- **De herstel-URL moet toegelaten zijn.** Onder Authentication → URL Configuration staan
  *Site URL* en *Redirect URLs*. Staat het adres van de website daar niet bij, dan weigert
  Supabase de link en komt de speler op een foutpagina. Dit is de meest gemaakte fout bij het
  opzetten hiervan en hoort in de README.

## Wat hier bewust niet in zit

- **De trainer die een wachtwoord voor iemand klaarzet.** Vraagt een Edge Function met de
  service-role sleutel, en laat een trainer tijdelijk het wachtwoord van een ander kennen.
  Kan later; dit ontwerp staat het niet in de weg.
- **Herstel op een telefoon zonder browser.** Zie hierboven.
