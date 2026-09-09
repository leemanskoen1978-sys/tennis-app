# Afvinken vanaf Home

*9 september 2026*

## Waar dit vandaan komt

De Agenda-tab moet op termijn helemaal verdwijnen; zijn zeven schermen worden herverdeeld
over Home, Spelers en Trainers. Dat is te groot voor één ontwerp, en de volgorde is niet
vrij — de tab kan pas weg als alles een nieuw huis heeft. De verdeling in vier stukken:

| | wat | wanneer |
|---|---|---|
| **1** | Afvinken vanaf Home, met "standaard aanwezig" en een Klaar-knop | **dit document** |
| 2 | Aanwezigheid in het spelersdossier: historiek lezen, toekomst aanpassen | later |
| 3 | Weekagenda naar Spelers (eigen lessen) en Trainers (eigen lessen) | later |
| 4 | De Agenda-tab opheffen: goedkeuren en nieuwe afspraak naar Home, betalingen naar Spelers, en beslissen wat er met Historiek en Nog te komen gebeurt | moet laatst |

Dit document beschrijft **alleen stuk 1**. Wat de andere drie raken staat onderaan onder
"Bewust buiten dit stuk", zodat het bij het volgende ontwerp niet opnieuw uitgezocht hoeft.

## Het probleem

Een trainer die op de baan staat en zijn groep wil afvinken, moet nu: Agenda openen →
tegel Afvinken → en dan per kind driemaal tikken om bij de juiste stand te komen, want elke
naam loopt door `leeg → aanwezig → afwezig → leeg`.

Dat is de verkeerde weg om twee redenen. De ingang ligt in een tab die gaat verdwijnen. En
de tikcyclus is gebouwd op de aanname dat "aanwezig" even bijzonder is als "afwezig",
terwijl in de praktijk vrijwel iedereen er gewoon is: je wilt alleen de uitzonderingen
aantikken.

## Wat er verandert

### Op Home

De lessen van vandaag staan er al (`components/lesdag/Lesdag.tsx`). Nieuw: een les aantikken
opent het afvinkscherm voor díe les. Nu klapt hij alleen open.

### Het afvinkscherm blijft een apart, kaal scherm

Het verhuist van `/agenda/afvinken` naar `/afvinken`, maar het blijft wat het is: een scherm
zonder menubalk en zonder tabbalk.

Dat is met opzet en het is de enige plek in de app waar die balken verborgen worden
(`app/_layout.tsx:48`). De reden staat er al: op de baan gaat de gsm van de trainer rond in
de groep, en één tik op de tabbalk zou een kind in de ledenlijst of bij de betalingen
zetten. Het afvinken inline op Home zetten — hoe logisch "klik op het groepje en vink daar
af" ook klinkt — zou die bescherming weggooien. Het gebaar voor de trainer is hetzelfde;
alleen de ingang verschuift.

Het scherm opent voortaan op de les die je aantikte (`/afvinken?lesId=…`) in plaats van
zelf de nu lopende les te kiezen. Zonder `lesId` blijft het oude gedrag gelden.

### Eén tik in plaats van drie

Bij het openen staat iedereen op **aanwezig**. Eén tik zet een kind op afwezig, nog een tik
weer terug. Er is geen derde stand meer te zien.

Onderaan één knop: **Klaar**. Die schrijft de kinderen die je niet aantikte echt op
aanwezig weg, en sluit het scherm.

### In de databank blijven het drie standen

`leeg` blijft bestaan en blijft betekenen: *hier heeft niemand naar gekeken*. Dat is nodig,
en het is een bewuste keuze van de opdrachtgever:

- Een les van volgende maand zou anders nu al op "iedereen aanwezig" staan.
- De 5736 lessen die al in de agenda staan zouden met terugwerkende kracht een
  aanwezigheid claimen die niemand ooit gecontroleerd heeft.
- Het uitprintbare blad voor invaltrainers (`lib/export-trainingen.ts:600`) laat een vakje
  leeg als niemand keek, en dat mag geen "aanwezig" worden.
- De historiek in het spelersdossier (stuk 2) toont straks een streepje voor zo'n les.

Het verschil met vandaag is dat de trainer die lege stand niet meer met de hand hoeft te
zetten of te vermijden. De Klaar-knop is het moment waarop "iemand heeft gekeken" waar
wordt.

## Wat er in de code verandert

### `lib/aanwezigheid.ts` — drie ingrepen, alle drie puur en testbaar

**`getoondeStand(a: Aanwezigheid | null): Aanwezigheid`** — nieuw. Vertaalt de opgeslagen
stand naar wat het scherm toont: niets genoteerd wordt `'aanwezig'`. Eén plek waar die
vertaling valt, zodat scherm en telling niet uit elkaar kunnen lopen.

**`volgendeStand`** — verandert van een cyclus van drie naar een schakelaar van twee:
`aanwezig ⇄ afwezig`, met `null` als "aanwezig" als vertrekpunt. De weg terug naar "niets
genoteerd" verdwijnt uit het scherm; wie een hele les wil terugdraaien doet dat niet meer
per kind. *(Zie "Aanvaarde gevolgen".)*

**`bevestigAanwezigheid(b): { attendance: Aanwezigheden }`** — nieuw. Geeft elke deelnemer
zonder aantekening `'aanwezig'`, laat bestaande aantekeningen staan, en ruimt net als
`zetAanwezigheid` de spelers op die niet meer meespelen. Dit is wat de Klaar-knop wegschrijft.

`aanwezigheidRegel` en `aanwezigheidTelling` blijven ongewijzigd: na een Klaar staat `open`
vanzelf op nul, dus de regel klopt zonder aanpassing.

### Schermen

- `components/lesdag/Lesdag.tsx` — een les aantikken navigeert naar `/afvinken?lesId=…`.
- `app/agenda/afvinken.tsx` → `app/afvinken.tsx` — leest `lesId`, toont `getoondeStand`,
  krijgt de Klaar-knop, en gaat bij sluiten terug naar `/` in plaats van `/agenda`.
- `app/_layout.tsx` — de route-registratie, de `HEADLESS`-lijst en de `showMenu`-test
  noemen `agenda/afvinken`; die drie gaan mee naar `afvinken`.
- `app/agenda/index.tsx` — de tegel Afvinken wijst naar de nieuwe route. Het scherm zelf
  blijft in dit stuk verder ongemoeid; het verdwijnt pas in stuk 4.

## Testen

De 24 tests in `lib/aanwezigheid.test.ts` en de 15 in `lib/export-trainingen.test.ts`
beschrijven het huidige gedrag; een deel daarvan gaat over de driestandencyclus en moet
meeveranderen. Eerst de test, dan de code:

- `getoondeStand`: niets genoteerd leest als aanwezig; een echte stand blijft zichzelf.
- `volgendeStand`: schakelt heen en weer, en komt nooit meer op `null` uit.
- `bevestigAanwezigheid`: vult alleen de ontbrekende deelnemers aan, laat een bestaande
  `afwezig` staan, en gooit aantekeningen weg van wie niet meer meespeelt.
- `bladAanwezigheid` (export): een les die nooit bevestigd is, houdt lege vakjes. Dit is de
  test die bewaakt dat de derde stand echt overleeft.

Schermtests bestaan niet in dit project (alle 1757 tests zitten in `lib/`), dus het gedrag
van het scherm zelf wordt met de hand nagekeken op de echte site: een groep afvinken, Klaar
tikken, en in de databank controleren dat de niet-aangetikte kinderen op `aanwezig` staan.

## Aanvaarde gevolgen

**Een aantekening per kind terugzetten naar "niet gekeken" kan niet meer vanuit het
afvinkscherm.** Dat was de derde tik in de oude cyclus. Het blijft wel kunnen via het
detailblad van de les (`components/BookingDetailSheet.tsx:613`), dat na stuk 4 via Beheer →
Lesgroepen bereikbaar blijft. De afweging: één tik winnen op elk kind van elke les weegt op
tegen een handeling die zelden nodig is en elders nog bestaat.

**Wie het scherm opent en meteen weggaat zonder Klaar, heeft niets vastgelegd.** Dat is de
bedoeling — openklappen is geen controleren — maar het betekent wel dat een trainer die
vergeet op Klaar te tikken, denkt te hebben afgevinkt terwijl er niets staat. Het scherm
moet dus duidelijk maken dat Klaar de handeling is en niet een sierknop.

## Besluiten voor stuk 2, 3 en 4

Genomen op 9 september 2026, zodat de volgende ontwerpen er niet opnieuw over hoeven.

**Stuk 2 — de aanwezigheidshistoriek krijgt een periodekiezer.** Dezelfde `PeriodPicker` als
op Historiek, in plaats van "alles van dit seizoen". Het plafond van zes verleden lessen in
het blad Lesdagen (`app/players/[id].tsx:320`) gaat eraf.

**Stuk 2 — het verleden is in het dossier alleen leesbaar.** Een trainer past daar alleen
toekomstige lessen aan. Vergat hij af te vinken, dan meldt hij dat aan de beheerder en die
zet het recht.

**"Verleden" begint de dag nadien.** Een trainer mag alles wijzigen aan een les van
vandaag, ook nadat die is afgelopen; vanaf middernacht is het aan de beheerder.

Die grens is er met opzet en niet "zodra de les voorbij is": dat laatste zou precies het
gewone geval blokkeren — een trainer die zijn groep afvinkt om vijf over het uur. Afvinken
gebeurt ná de les, dus de dag is de eenheid, niet het uur.

Er komt geen nieuw begrip bij. Deze grens staat al in `magAanwezigheidZetten`
(`lib/aanwezigheid.ts`) en in de databank (`bewaak_betaalvelden`,
`date_trunc('day', now() at time zone 'Europe/Brussels')`), alleen geldt ze vandaag enkel
voor spelers en ouders — de trainer van de les valt er nu bovenlangs uit. Die uitzondering
vervalt; alleen de beheerder houdt de vrije hand.

Dit moet op **twee** plaatsen, anders is het cosmetica: in `magAanwezigheidZetten` zodat het
scherm niets aanbiedt wat geweigerd wordt, én in de trigger `bewaak_betaalvelden`, die nu
nog `if is_admin() or old.coach_id = app_user_id() then return new` doet en de trainer dus
alles laat schrijven.

Wat wél opgelost moet worden in stuk 4: de beheerder heeft vandaag maar één weg naar het
lesdetail van een oude les, en dat is Beheer → Lesgroepen → groep → les. Die werkt alleen
voor lessen die aan een lesgroep hangen. Voor een losse les is er na het opheffen van
Historiek en Nog te komen geen enkele weg meer — `LessonCards`, het component dat het
lesdetail opent, staat alleen in `agenda/historiek`, `agenda/komend` en
`admin/lesgroepen/[id]`, en de eerste twee verdwijnen. De lessenregels in de dossiers zijn
gewone regels zonder doorklik.

**Stuk 3 — de weekagenda komt in het dossier van de persoon zelf.** Een trainer opent een
speler en ziet diens week; hij opent zijn eigen trainersdossier en ziet die van hem. Geen
aparte ingang voor de speler.

**Stuk 4 — Historiek en Nog te komen verdwijnen.** De dossiers nemen het over, zonder
plafond. De periodekiezer en de bedragen gaan naar Beheer → Rapport, waar het geld al staat.

## Bewust buiten dit stuk

- De goedkeuringswachtrij (`app/agenda/index.tsx:122`) verhuist naar Home — **stuk 4**.
  Besloten is al: hij gaat naar Home, bij de lessen van vandaag.
- "Nieuwe afspraak" naar Home — **stuk 4**. Voor een trainer is die nu bijna dakloos: alleen
  via de Agenda en via één knop in een spelersdossier.
- Openstaande betalingen naar Spelers — **stuk 4**. Het scherm bestaat al op
  `/admin/payments` en is ook via Profiel en Beheer bereikbaar; dit is een ingang erbij,
  geen verhuizing.
- Weekagenda naar Spelers en Trainers — **stuk 3**. Let op: dit kalenderraster bestaat
  nergens anders in de app, dus dit is echt verhuizen.
- Historiek en Nog te komen — **stuk 4**. Ze staan al verkort op de dossiers
  (`app/players/[id].tsx:320`, `app/coaches/[id].tsx:200`), maar zonder periodekiezer,
  zonder bedragen en zonder de exports.

  **Het ICS-agendabestand bestaat alleen op `/agenda/komend`.** Beslist op 9 september 2026:
  het wordt er **twee**.

  - Een **persoonlijke** export blijft bestaan voor de speler, op een plek die hij bereikt —
    bij zijn eigen lessen. Dat is waar de knop voor gemaakt is: een speler zet zíjn lessen in
    de agenda van zijn telefoon.
  - Een **clubbrede** export komt erbij in Beheer → Kalender, voor de beheerder: alle lessen,
    of die van één trainer.

  Waarom niet alleen dat tweede, zoals eerst gevraagd: het Beheer-tabblad staat alleen in
  `coachTabs` (`components/ui/TabBar.tsx:31`) en `app/admin/index.tsx:33` weigert iedereen die
  geen trainer is. De knop daarheen verplaatsen zou hem onbereikbaar maken voor precies de
  mensen voor wie hij bestaat.
