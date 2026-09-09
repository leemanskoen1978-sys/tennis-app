# De Agenda-tab opheffen

*9 september 2026 — stuk 4 van vier, het laatste*

## Waar dit vandaan komt

De zeven schermen van de Agenda-tab worden herverdeeld over Home, Spelers, Trainers en
Beheer. Stuk 1 (afvinken vanaf Home), stuk 2 (aanwezigheid in het spelersdossier) en stuk 3
(de weekagenda naar de dossiers) staan live. Dit stuk haalt de tab weg.

De besluiten die eraan voorafgaan staan in
`docs/superpowers/specs/2026-09-09-afvinken-vanaf-home-design.md`, onder "Besluiten voor
stuk 2, 3 en 4": de goedkeuringswachtrij en Nieuwe afspraak gaan naar Home, de betalingen
krijgen een ingang op Spelers, Historiek en Nog te komen verdwijnen, en het ICS-bestand
wordt er twee.

## Wat er nu staat

| scherm | wat het doet | waar het heen gaat |
| --- | --- | --- |
| `agenda/index` | goedkeuringswachtrij + vier tegels | Home |
| `agenda/overzicht` | drie tegels naar historiek, komend, week | verdwijnt |
| `agenda/historiek` | lessen van een periode, bedragen, CSV/Excel | Beheer → Rapport (alleen de bestanden) |
| `agenda/komend` | geplande lessen + `.ics` | de dossiers (stuk 3) en Beheer → Kalender |
| `agenda/week` | het weekraster | **al verhuisd in stuk 3** |
| `agenda/new` | een les inplannen | **blijft** |

## Wat er verandert

### 1. Home wordt de agenda van vandaag

**Voor een trainer** komt de sectie *Goed te keuren* bovenaan Home, met dezelfde kaarten als
nu op `/agenda`: wie welke les vraagt, in wiens agenda hij valt als het niet de zijne is, en
de knoppen Goedkeuren en Weigeren, met de foutregel eronder.

Boven de lesdag en niet eronder: zolang de trainer niets zegt, gaat die les niet door. Home
telt die aanvragen vandaag al (`awaitingApprovalFor` staat er in `app/index.tsx`) en zet het
getal als badge op de tegel Agenda. Het commentaar bij die badge zegt zelf waarom dat niet
klopt — *"een melding die naar een ander scherm wijst dan waar je hem afhandelt, laat je
zoeken"*. Die badge verdwijnt dus met de tegel: de lijst staat er nu zelf.

**Voor een speler** verhuist het spiegelbeeld mee: *Wacht op goedkeuring* — wat hij vroeg en
waar de trainer nog niets over zei. De geweigerde aanvragen staan al op Home.

De tegels van Home worden:

| trainer | speler |
| --- | --- |
| Afvinken · Nieuwe afspraak · Mijn agenda · Spelers · Trainers · Beheer · Mijn kinderen | Reserveren · Mijn agenda · Mijn lessen · Voortgang · Mijn kinderen |

**Afvinken** houdt zijn regel "Nu: 18:00 · geef je gsm door" en blijft dus zeggen welke les
er loopt. Het is een tweede weg naar hetzelfde scherm dat de lesdag erboven ook opent, en dat
is hier gewenst: het is de tegel die je aantikt terwijl de kinderen voor je staan.

**Mijn agenda** is voor allebei de rollen de weg naar het eigen dossier, langs `dossierPad`
uit `lib/dossier.ts` (gebouwd in stuk 3): een trainer komt in `/coaches/<zichzelf>`, een
speler in `/players/<zichzelf>`, en een ouder in het dossier van het kind dat hij koos. De
badge met openstaande betalingen blijft erop staan, en het openstaand saldo — de kaart met
het bedrag boven de tegels — klikt naar hetzelfde dossier in plaats van naar Overzicht.

### 2. Betalingen krijgen een ingang op Spelers

`/admin/payments` bestaat al en is bereikbaar via Beheer en via Profiel. Er komt één ingang
bij: een tegel **Betalingen** op `/players`, naast de bestaande tegel Voortgang toevoegen,
met het aantal openstaande lessen als badge.

Dat is geen verhuizing maar een derde weg, en hij hoort daar omdat openstaande betalingen
over mensen gaan: je zoekt ze op als je toch met de spelerslijst bezig bent. De tegel is
alleen voor een trainer, net als de rest van dat blok.

### 3. Beheer erft het geld en de bestanden

**`Beheer → Rapport`** heeft al dezelfde twee filters als Historiek — een periodekiezer en
een trainerfilter — en toont de bedragen over precies die selectie. Daar komen de twee
knoppen bij die nu op Historiek staan: **CSV** en **Excel**, over exact die selectie, met
dezelfde foutafhandeling (`shareCsv`, `shareXlsx`, `xlsxWordtOndersteund`) en dezelfde
bestandsnamen (`periodFilename`).

De lessenlijst van Historiek komt niet mee. Wie de lessen van één persoon wil zien, opent
diens dossier; wie ze allemaal wil, exporteert. Twee schermen met dezelfde periodekiezer en
dezelfde bedragen naast elkaar zetten zou de reden om Historiek op te heffen ongedaan maken.

**`Beheer → Kalender`** krijgt de **clubbrede agenda-export**: alle geplande lessen als
`.ics`, met een trainerfilter ernaast voor "alleen die van Jan". Die bestaat vandaag niet —
`/agenda/komend` exporteert alleen wat de kijker zelf mag zien.

Kalender is de juiste plek omdat dat scherm al over "wanneer er les kan zijn" gaat: de
clubkalender en de uren per trainer. Een bestand met alle lessen erin hoort bij die vraag en
niet bij het geld.

### 4. De persoonlijke agenda-export gaat mee naar het dossier

De `.ics`-knop van Nog te komen komt in het blad **Lesdagen** van het spelersdossier te
staan, boven de lijst Aankomend, en exporteert precies die lessen — dezelfde selectie die je
eronder ziet.

Dat is waar de knop voor gemaakt is: een speler zet zíjn lessen in de agenda van zijn
telefoon. Een trainer die een spelersdossier opent, maakt met dezelfde knop het bestand voor
die speler.

De twee zinnen uitleg die nu onder de knop staan (het bestand werkt bij in plaats van dubbel
toe te voegen; een later geannuleerde les verdwijnt niet vanzelf) gaan mee. Ze staan er niet
voor de sier: zonder de eerste denkt iemand dat hij zijn agenda vervuilt door twee keer te
exporteren.

### 5. Dan pas gaat de tab weg

Weg:

- `app/agenda/index.tsx`, `app/agenda/overzicht.tsx`, `app/agenda/historiek.tsx`,
  `app/agenda/komend.tsx`;
- hun vier regels in de schermenlijst van `app/_layout.tsx`, en `agenda/index` uit de
  `HEADLESS`-verzameling;
- de tab Agenda uit `coachTabs` (`components/ui/TabBar.tsx`). Een trainer houdt vier tabs:
  Home, Spelers, Trainers, Beheer.

**`/agenda/new` blijft**, met dat pad. Het is de tab Reserveren van een speler en het doel
van Nieuwe afspraak voor een trainer. Een map in de code is geen tabblad; hernoemen zou elke
verwijzing in TabBar, Home en de dossiers raken zonder dat iemand er iets aan heeft. De
`segment`-waarde `'agenda'` in `playerTabs` blijft daardoor ook kloppen.

`useAgendaScope` houdt na deze ronde één gebruiker over (Rapport) en `LessonCards` ook
(Beheer → Lesgroepen). Allebei laten staan: ze doen nog werk, en een hook die één scherm
bedient is nog altijd de plek waar die drie regels één keer staan.

## Wat er in de code verandert

| bestand | wat |
| --- | --- |
| `app/index.tsx` | Goed te keuren en Wacht op goedkeuring erbij; tegels Afvinken en Nieuwe afspraak erbij; Agenda wordt Mijn agenda langs `dossierPad`; het saldo klikt naar het dossier. |
| `app/players/index.tsx` | tegel Betalingen met badge, alleen voor een trainer. |
| `app/admin/reports.tsx` | knoppen CSV en Excel over de bestaande selectie. |
| `app/admin/kalender.tsx` | clubbrede `.ics`-export met trainerfilter. |
| `app/players/[id].tsx` | `.ics`-knop boven Aankomend in het blad Lesdagen. |
| `app/_layout.tsx` | vier routes weg, `agenda/index` uit `HEADLESS`. |
| `components/ui/TabBar.tsx` | de tab Agenda uit `coachTabs`. |
| `app/agenda/index.tsx`, `overzicht.tsx`, `historiek.tsx`, `komend.tsx` | **weg**. |

## Testen

Er komt geen nieuw rekenwerk bij: `awaitingApprovalFor`, `awaitingApprovalOf`, `csvRows`,
`toCsv`, `toXlsx`, `toIcs`, `icsFilename` en `dossierPad` bestaan allemaal al en hebben hun
tests. Dit stuk verplaatst schermen.

Eén ding hoort wél in `lib/` en niet in een scherm: **welke lessen in de clubbrede export
horen**. Dat is een selectie ("alle geplande lessen, of die van één trainer") en geen opmaak.
Die komt als `clubAgenda(bookings, coachId, now)` in `lib/ics.ts`, met tests: alles wat nog
moet komen, geannuleerde eruit, gesorteerd op tijd, en met `coachId` erbij alleen die trainer.

Met de hand na te lopen op de echte site:

1. Als trainer met een openstaande aanvraag: Home toont hem bovenaan, Goedkeuren werkt, en
   de les staat daarna in de lesdag.
2. Als speler een les aanvragen → Home toont "Wacht op goedkeuring".
3. Home → Mijn agenda opent je eigen dossier, voor allebei de rollen; het openstaand saldo
   ook.
4. Spelers → Betalingen opent de openstaande lessen, met het juiste aantal op de badge.
5. Beheer → Rapport: een periode kiezen en de CSV en de Excel downloaden; de bedragen komen
   overeen met wat op het scherm staat.
6. Beheer → Kalender: het `.ics`-bestand voor de hele club, en daarna voor één trainer.
7. Een spelersdossier → Lesdagen → het `.ics`-bestand met precies zijn aankomende lessen.
8. Geen enkele weg leidt nog naar `/agenda`, `/agenda/overzicht`, `/agenda/historiek` of
   `/agenda/komend`; Reserveren en Nieuwe afspraak werken nog.

## Volgorde

Twee golven, en die volgorde is niet vrij.

**Eerst een nieuw huis** (1 tot en met 4): de goedkeuringswachtrij, de tegels, de betalingen,
de exports. Zolang die verhuizingen niet af zijn, blijft de Agenda-tab gewoon staan en is
alles langs beide wegen bereikbaar.

**Dan pas opheffen** (5). Andersom zou er een moment zijn waarop een trainer zijn aanvragen
nergens kan goedkeuren en een speler zijn lessen nergens terugvindt — en de dev-server
herlaadt bij elke opslag, dus dat moment is echt.

## Aanvaarde gevolgen

**De clubbrede lessenlijst verdwijnt van het scherm.** Een beheerder die "alle lessen van
september" wil zien, krijgt daar een bestand van in plaats van een lijst. De cijfers erover
staan wél op Rapport, en per persoon staat de lijst in het dossier.

**Home wordt langer voor een trainer met veel aanvragen.** Dat is de bedoeling — het is werk
dat op hem wacht — maar bij tien openstaande aanvragen staat de lesdag ver naar beneden. Als
dat in de praktijk knelt, is een grens met "toon alles" het antwoord; dat bouwen we niet
vooruit.

**Een speler die alleen zijn volgende les wil zien, moet naar zijn dossier.** Vandaag staat
die les op `/agenda` in de lijst Vandaag. Home toont hem wel nog zijn openstaand saldo en
zijn wachtende aanvragen, maar niet meer de lessen van vandaag. Dat is een echt verlies; het
alternatief — de lesdag ook voor spelers op Home — hoort bij een volgende ronde en niet bij
het opheffen van een tab.
