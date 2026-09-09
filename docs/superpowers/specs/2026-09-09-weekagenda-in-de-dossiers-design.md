# De weekagenda naar de dossiers

*9 september 2026 — stuk 3 van vier*

## Waar dit vandaan komt

De Agenda-tab wordt opgeheven; zijn zeven schermen worden herverdeeld over Home, Spelers en
Trainers. Stuk 1 (afvinken vanaf Home) en stuk 2 (aanwezigheid in het spelersdossier) staan
live. Dit is stuk 3: de weekagenda. Stuk 4 heft de tab op.

Het besluit dat aan dit ontwerp voorafgaat staat in
`docs/superpowers/specs/2026-09-09-afvinken-vanaf-home-design.md`: *de weekagenda komt in het
dossier van de persoon zelf*. Een trainer opent een speler en ziet diens week; hij opent zijn
eigen trainersdossier en ziet die van hem.

## Wat er vandaag staat

`app/agenda/week.tsx` (122 regels) kiest alleen de week. Het raster staat in
`components/WeekRaster.tsx`, het rekenwerk in `lib/week.ts`. De lessen komen uit
`useAgendaScope()`: "wat mag ík zien, gefilterd op de trainer die ik koos".

Het scherm is bereikbaar via Home → Mijn agenda → Overzicht → Weekagenda. Dat is de enige
weg; dit kalenderraster bestaat nergens anders in de app.

## Wat er verandert

### De omhulling wordt een component

`lib/week.ts` verandert niet en `components/WeekRaster.tsx` blijft de tekening — alleen zijn
doorklik verandert, zie hieronder. Wat verhuist is de omhulling: de weekkiezer, de knop "Deze week" en
de regel met de uren. Die wordt `components/Weekagenda.tsx` en krijgt zijn lessen als prop
in plaats van ze zelf op te halen.

Daarmee valt `useAgendaScope` weg, en dus ook de trainerbalk (`CoachFilter`): in een dossier
is de vraag "van wie zijn deze lessen" al beantwoord door het dossier zelf.

`app/agenda/week.tsx` verdwijnt, met zijn regel in de routelijst van `app/_layout.tsx`.

### Een tegel in beide dossiers

Het spelersdossier en het trainersdossier zijn allebei een kop-kaart met daaronder tegels;
een tik opent het onderdeel in een blad. De weekagenda wordt zo'n tegel, met de uren van de
lopende week als ondertitel ("6u30 deze week").

Die uren worden gerekend met dezelfde `weekMinuten(weekAgenda(...))` als het blad erachter.
Dat is de afspraak die de tegel op Overzicht nu al hanteert: een tegel mag geen ander getal
beloven dan wat je erachter vindt.

Welke lessen erin staan, komt uit de lijst die het dossier al heeft:

- speler: `playerBookings` — elke les waarin hij meespeelt, van welke trainer ook,
  geannuleerde niet.
- trainer: `coachBookings` — elke les die hij geeft, geannuleerde niet.

Hergebruiken en niet opnieuw filteren, zodat de tegel Weekagenda nooit iets anders kan
zeggen dan de tegel Lesdagen ernaast.

### Wie de tegel te zien krijgt

In het **spelersdossier**: alleen wie het dossier hoort te zien — de trainer, de speler zelf,
of de ouder van dit kind. Dat is de test die in `app/players/[id].tsx:157` al onder de naam
`magBewerken` staat.

Dit is met opzet strenger dan de rest van dat scherm. Het spelersdossier staat vandaag open
voor medespelers (punt 10 in `OPENSTAAND.md`): in een groepsles is elke medespeler
aanklikbaar, en `app/players/` heeft geen rolcontrole. Een weekraster erbij zou daar niet
naam en telefoon aan toevoegen maar het hele weekritme van een kind. Het gat zelf hoort in
zijn eigen ronde dicht — hier voegen we er in elk geval niets aan toe.

In het **trainersdossier** staat de tegel er voor iedereen die het scherm opent. Dat is geen
uitzondering maar dezelfde regel: `/coaches` hangt aan het Beheer-deel van de app en de tab
staat alleen in `coachTabs`, dus wie daar komt is trainer of beheerder. Wanneer een trainer
lesgeeft is bovendien geen persoonlijk gegeven — het staat al op de kop-kaart onder "Geeft
les". Het loon blijft wél afgeschermd, langs `magLoonZien`, zoals nu.

### De doorklik naar het lesdetail

`WeekRaster` opent nu zelf het lesdetail (`BookingDetailSheet`) als je een lesblok aantikt.
Dat kan in een dossier niet zo blijven: een `DetailSheet` tekent zijn inhoud alleen zolang
hij zichtbaar is, dus zodra het weekblad sluit verdwijnt het lesdetail mee.

Het raster geeft de aangetikte les daarom naar boven door met een nieuwe prop
`onBookingPress`, en het dossier tekent het lesdetail op schermniveau. Dat is precies waar
het spelersdossier zijn andere gestapelde bladen al zet, en om dezelfde reden: twee bladen
over elkaar is rommelig, en op Android sluit één druk op terug ze allebei.

Het weekblad sluit zolang het lesdetail openstaat en komt daarna terug — de `stacked`-regel
uit `app/players/[id].tsx:207`. Het trainersdossier kent die regel nog niet en krijgt hem
erbij.

`WeekRaster` had maar één gebruiker, en die verdwijnt. De eigen `BookingDetailSheet` gaat er
dus helemaal uit; `onBookingPress` is geen keuze maar de enige weg.

**De gekozen week woont in het dossier, niet in het blad.** Sluit het blad terwijl je drie
weken vooruit keek, dan zou de week anders terugspringen naar vandaag zodra het lesdetail
dichtgaat.

### Wat dit meteen oplost

Sinds stuk 2 is de beheerder de enige die een oude aanwezigheid kan rechtzetten, en hij had
maar één weg naar het lesdetail van een oude les: Beheer → Lesgroepen → groep → les. Die
werkt alleen voor lessen die aan een lesgroep hangen. Voor een losse les was er na het
opheffen van Historiek en Nog te komen geen enkele weg meer.

Het weekraster is die weg, want het opent hetzelfde blad en het kent het verschil tussen een
losse les en een groepsles niet. Blader naar de week van de les en tik hem aan. Daarmee is
het gat dat onderaan de stand van zaken staat gedicht, en hoeft stuk 4 er niets meer voor te
verzinnen.

### De oude weg

De tegel Weekagenda op `/agenda/overzicht` blijft staan en wijst voortaan naar je eigen
dossier: een trainer naar `/coaches/<zichzelf>`, een speler naar `/players/<zichzelf>`. Een
ouder gaat naar het dossier van het kind dat hij koos — dezelfde `useActieveSpeler` die de
agenda al gebruikt.

Zonder dat wordt de weekagenda voor een speler onbereikbaar: `/players/[id]` wordt vandaag
alleen geopend vanuit de spelerslijst, vanuit Beheer → Betalingen en vanuit een
trainersdossier, en dat zijn alle drie schermen voor een trainer.

### De naam op Home wordt een doorklik

In een opengeklapte les op Home staat elke deelnemer met zijn naam en een memoknop
(`components/lesdag/Lesdag.tsx:102`). Die naam wordt aanklikbaar en opent
`/players/<id>`.

Dat is de ingang die een trainer op de baan mist: hij ziet het kind voor zich staan, en wil
bij zijn doelen, zijn voortgang of zijn week — nu moet hij daarvoor terug naar Home, naar
Spelers, en de naam opzoeken in een lijst van 555.

De kop van de les blijft doen wat hij deed: openklappen en dichtklappen. Ook bij een les met
één speler, waar in die kop een naam staat. Die regel is het gebaar om de les te openen, en
twee betekenissen op één tik maken beide onbetrouwbaar.

## Wat er in de code verandert

| bestand | wat |
| --- | --- |
| `components/Weekagenda.tsx` | **nieuw.** De weekkiezer, "Deze week", de urenregel en het raster. Krijgt `bookings`, `week` en `onWeek` als props, plus `onBookingPress`. |
| `components/WeekRaster.tsx` | de eigen `BookingDetailSheet` eruit, `onBookingPress` erin. |
| `app/agenda/week.tsx` | **weg.** |
| `app/_layout.tsx` | de route `agenda/week` uit de lijst. |
| `lib/dossier.ts` + `.test.ts` | **nieuw.** `dossierPad(user, speler)`: waar het eigen dossier van deze gebruiker staat. |
| `app/agenda/overzicht.tsx` | de tegel Weekagenda wijst naar het eigen dossier, langs `dossierPad`. |
| `app/players/[id].tsx` | tegel + blad `week`, het lesdetail op schermniveau, `week` in `stacked`. |
| `app/coaches/[id].tsx` | tegel + blad `week`, het lesdetail op schermniveau, en de `stacked`-regel die dit scherm nog niet had. |
| `components/lesdag/Lesdag.tsx` | de naam van een deelnemer wordt een `Pressable` naar `/players/<id>`. |

## Testen

Er verandert niets aan het rekenwerk: `lib/week.ts` blijft zoals het is en zijn tests blijven
staan. Wat hier verandert zijn schermen, en schermtests bestaan in dit project niet — alle
1794 tests zitten in `lib/`.

Eén ding hoort wél in `lib/` en niet in een scherm: waar de tegel op Overzicht naartoe wijst.
Dat is een regel ("een trainer naar zijn trainersdossier, iedereen anders naar het dossier
van de actieve speler") en geen opmaak. Die komt als `dossierPad(user, speler)` in een nieuw
`lib/dossier.ts`, met tests. Niet in `lib/rechten.ts`: dat bestand beantwoordt "mag het", niet
"waarheen".

Met de hand na te lopen op de echte site:

1. Als trainer een speler openen → tegel Weekagenda → bladeren → een lesblok aantikken → het
   lesdetail staat er, het weekblad is dicht → sluiten → het weekblad staat er weer, op
   dezelfde week.
2. Hetzelfde in het eigen trainersdossier.
3. Als beheerder een **losse** les van vorige maand opzoeken via het raster en daar de
   aanwezigheid rechtzetten. Dit is het gat uit stuk 4.
4. Als speler: Home → Mijn agenda → Overzicht → Weekagenda → je eigen dossier opent met de
   tegel erin.
5. Op Home een les openklappen en op een naam tikken → het dossier van dat kind.
6. Als medespeler (een kind in een groepsles) het dossier van een ander kind openen: de tegel
   Weekagenda staat er niet.

## Aanvaarde gevolgen

**Het raster schuift zijwaarts in een blad.** Een `DetailSheet` is 640 px breed, het raster
wil er 718 (zeven kolommen van minstens 96 naast een uren-as van 46). Het raster kan dat al —
het schuift horizontaal zodra het niet past, ook vandaag op een telefoon. Een eigen scherm
zou breder zijn, maar dan is de weekagenda het enige onderdeel van een dossier dat geen blad
is.

**Twee weken naast elkaar vergelijken kan niet meer.** De trainerbalk verdwijnt, dus wie de
week van twee trainers wil zien opent twee dossiers na elkaar. Dat is de prijs van "de
agenda van deze persoon" en het was op één na de enige plek waar die balk stond.

**De speler bereikt zijn week via een omweg** — Home → Mijn agenda → Overzicht → Weekagenda →
zijn dossier. Dat blijft zo tot stuk 4 beslist wat er van de Agenda-tab overblijft; een tegel
"Mijn dossier" op Home hoort bij dat besluit en niet bij dit stuk.
