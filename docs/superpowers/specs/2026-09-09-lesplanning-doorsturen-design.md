# Lesmateriaal doorsturen per periode — ontwerp

9 september 2026. De beheerder stuurt lesmateriaal door voor een bepaalde periode, aan een
trainer en/of aan een lesgroep. De trainer ziet bij zijn les welk materiaal er die periode
aan de orde is.

## Waarom

De tennisschool werkt met een lessenboekje: in week X doet iedereen training 4. Vandaag kan
dat nergens in de app staan. Lesmateriaal (`Lesson`) hangt aan precies één speler
(`student_id`), gezet vanuit `AssignLessonModal`, of het staat als los materiaal in de
bibliotheek en dan hangt het aan niemand. Er is geen manier om te zeggen "deze twee weken
geeft Ann training 4 aan Kidstennis rood - Groep 3".

Het gevolg is dat de afspraak buiten de app leeft — in een mail of op papier — en dat een
trainer die op zijn lesdag kijkt niet ziet wat hij hoort te geven.

## Wat het wordt

De beheerder opent Beheer → Lessen beheren → Lesplanning, kiest materiaal uit de bibliotheek,
kiest een trainer en/of een groep, en vult twee dagen in. Elke les van die trainer of die groep
die in die periode valt, draagt vanaf dan die instructie.

De trainer ziet op zijn lesdag en op het lesdetail: *"Deze periode: Training 4"*, aantikbaar
naar het materiaal zelf.

## Wat er met opzet buiten blijft

**De speler ziet het niet.** Beslist op 9 september 2026. Dit is werkinstructie voor de
trainer, en de spelerskant zou twee openingen in de bewaking kosten in plaats van nul:
`lessons_select` laat een speler alleen materiaal lezen dat aan hemzelf hangt, en
`lesson_groups_select` is alleen voor de beheerder. Het persoonlijke materiaal dat via
`student_id` aan een speler hangt, blijft precies werken zoals het werkte.

**Geen bericht en geen mail.** "Doorsturen" is hier een toewijzing in de app en geen verzending.
De trainer vindt het bij zijn les; daar kijkt hij toch.

**Geen weeknummers.** Een periode is van dag tot dag, dezelfde vorm als een ziekmelding en een
clubvakantie. De app rekent nergens anders met weeknummers en dat begrip komt er niet bij voor
dit alleen.

## Gegevens

### Eén nieuwe soort rij

```
Lesplanning: id · lesson_id · coach_id? · group_id? · van · tot · created_at
```

`van` en `tot` zijn dagen als `jjjj-mm-dd`, beide meegerekend — dezelfde afspraak als
`SickLeave` en `Vakantie`, zodat een periode over de zomertijdwissel dezelfde dagen houdt.

Minstens één van `coach_id` en `group_id` is gevuld:

- alleen een trainer: alles wat hij die periode geeft;
- alleen een groep: die groep, bij wie hem ook geeft;
- beide: die groep bij die trainer.

Beide leeg is geen geldige rij. Dat zou stilzwijgend "de hele club" betekenen, en dat is een
beslissing die iemand met een lege invoer nooit bedoeld heeft.

De rij leeft náást `Lesson`. `student_id` blijft wat het is: persoonlijk materiaal voor één
speler. Een tweede betekenis op datzelfde veld hangen zou dezelfde fout zijn als een tweede
antwoord naast `taught_by_id` — zie het kopcommentaar van `lib/lesgever.ts`.

### Eén nieuw rekenbestand: `lib/lesplanning.ts`

Puur rekenwerk — geen store, geen scherm, geen schrijfweg — en de ENIGE plek die de vraag
"welk materiaal geldt voor deze les" beantwoordt.

```
lesplanningFout(lessonId, coachId, groupId, van, tot): string | null
```

De invoercontrole, met dezelfde regels en dezelfde volgorde als `ziekmeldingFout`: eerst of er
materiaal gekozen is, dan of er een trainer of een groep gekozen is, dan of beide dagen
leesbaar zijn, en pas daarna of ze goed om staan. Een periode die eindigt voor ze begint wordt
geweigerd en niet stil omgedraaid — dezelfde beslissing als op 6 september 2026 bij de
ziekmeldingen, die de eigenaar een lege werklijst zonder uitleg kostte.

Wie nog aan het typen is krijgt geen verwijt over een veld dat hij nog invult: een half getypte
datum is "nog niet af" en geen fout.

```
geldtVoor(planning, les): boolean
```

De lokale dag van `les.start_time` valt binnen de periode, én de trainer klopt als er een
trainer staat, én de groep klopt als er een groep staat.

De dag komt uit `dagSleutel` en nooit uit de ISO-tekst: die is in UTC gerenderd, dus een
avondles zou een dag opschuiven en op de verkeerde dag binnen of buiten de periode vallen.

**De trainer wordt vergeleken met `les.coach_id` en met opzet NIET met `lesgeverId`.** Neemt een
collega een les over van een zieke trainer, dan blijft het de les van die groep en hoort er
hetzelfde materiaal bij. De vervanger ziet het gewoon: het materiaal hangt aan de les die hij
geeft, niet aan zijn naam. Zou hier `lesgeverId` staan, dan verdwijnt de instructie op het
moment dat er iemand inspringt — precies wanneer een trainer het het hardst nodig heeft.

```
materiaalVoor(les, planningen, lessons): Lesson[]
```

Alles wat geldt, van bijzonder naar algemeen: eerst groep-én-trainer, dan groep, dan trainer.

**Er wordt niets weggelaten als er twee dingen gelden.** De beheerder heeft ze beide ingevuld,
en een instructie die de app stil verbergt is een instructie die niet gegeven is. Dezelfde
afspraak als `vervangersVoor` in lib/vervanger, dat ook nooit iemand stil wegfiltert.

### Wat er níét bij komt

Geen verwijzing van de boeking naar het materiaal. "Welk materiaal hoort bij deze les" is een
afgeleid feit uit de trainer, de groep en de datum — net als `zoektVervanger` en `staatOpen`.
Een verwijzing per boeking zou honderden rijen per doorsturing kosten, opruimwerk bij elke
periodewijziging, en — het ergste — geen materiaal op een les die later in die periode nog
bijgeboekt wordt.

## Schrijfwegen

Twee nieuwe functies in `providers/SimpleDataProvider.tsx`, zonder rekenwerk:

```
voegLesplanningToe(planning: Omit<Lesplanning, 'id' | 'created_at'>): Promise<void>
verwijderLesplanning(id: string): Promise<void>
```

De beslissing of de invoer deugt staat in `lesplanningFout` en wordt door het scherm gesteld
voordat het opslaat — dezelfde verdeling als bij de lesgroepen (`lesGroepFout`) en de
ziekmeldingen.

`lesPlanning` komt erbij als verzameling in `lib/sync.ts` (`SyncTable`) en in de store, langs
dezelfde weg die `sickLeaves` liep.

## Schermen

### Beheer → Lessen beheren → Lesplanning

Een nieuwe regel in `app/admin/tennisschool.tsx`, naast Lesgroepen, Ziekmelding, Import en
Export. Daar hoort het: het is werk van de tennisschool en niet van de clubadministratie.

Het scherm `app/admin/lesplanning/index.tsx`:

- **De lijst**, op datum gesorteerd. Per rij: de periode met `periodeTekst` (dezelfde zin als
  bij de vakanties), de titel van het materiaal, en aan wie het hangt — de naam van de trainer,
  de naam van de groep, of beide. Wat voorbij is blijft eronder staan: die rijen zijn de
  geschiedenis van wat er wanneer gegeven werd, en dat is de helft van waarom ze bestaan.
- **Doorsturen**: materiaal uit de bibliotheek, een trainer en/of een groep, twee dagen. De
  melding van `lesplanningFout` staat bij het formulier — geen `Alert`, die blokkeert op web.
- **Weghalen** per rij, met een bevestiging in het scherm zelf, zoals bij de beurtenkaarten.
- De grens staat op het scherm zelf (`isAdmin`) en niet alleen op de regel die ernaartoe wijst:
  een trainer kan de link intikken, en dan hoort hij een zin te lezen en geen lege lijst
  (TOEG-01, zie de werklijst van een ziekmelding).

### De trainer, bij zijn les

Twee plekken, met dezelfde zin uit `materiaalVoor`:

- op zijn lesdag (`components/lesdag/Lesdag.tsx`) onder het lesuur: *"Deze periode: Training
  4"*, aantikbaar naar dat materiaal;
- op het lesdetail (`components/BookingDetailSheet.tsx`), op dezelfde manier.

Gelden er twee, dan staan ze er beide, de bijzonderste bovenaan. Geldt er niets, dan staat er
niets — geen lege kop, want een kop zonder inhoud leest als "er is niets gepland" terwijl het
even goed "er is nooit iets ingevuld" betekent.

**De groepsnaam staat er niet op.** Een gewone trainer mag `lesson_groups` niet lezen
(`lesson_groups_select` is `is_admin()`), dus die naam zou bij hem leeg blijven. Hij heeft hem
ook niet nodig: hij kijkt naar zijn eigen les en wat er gegeven moet worden.

## Databank — `LESPLANNING.sql`

Een bestand in de projectmap, te draaien in de Supabase SQL-editor, twee keer draaien kan geen
kwaad. Zelfde vorm als `ZOEKT-TRAINER.sql` en `AFZEGGING-MERKTEKEN.sql`.

```sql
create table if not exists les_planning (
  id text primary key,
  lesson_id text not null references lessons(id) on delete cascade,
  coach_id text references users(id) on delete cascade,
  group_id text references lesson_groups(id) on delete cascade,
  van date not null,
  tot date not null,
  created_at timestamptz not null default now(),
  constraint les_planning_doelwit check (coach_id is not null or group_id is not null)
);
```

- `on delete cascade` op alle drie de verwijzingen: een doorsturing van materiaal dat niet meer
  bestaat, of naar een trainer of groep die niet meer bestaat, heeft geen betekenis meer. Dit is
  bewust anders dan `taught_by_id`, waar `on delete set null` staat omdat de boeking zelf blijft
  bestaan en terugvalt op een geldige toestand; een planningrij heeft die terugval niet.
- De `check` bewaakt dezelfde regel als `lesplanningFout`. De app zorgt dat er geen knop is die
  hier geweigerd wordt, dit is de bewaking — zie het kopcommentaar van `lib/rechten.ts`.
- **Lezen:** `is_coach() or is_admin()`. Een trainer moet de planning van zijn eigen lessen
  zien, en dat is dezelfde grens die `lessons_select` al hanteert voor de bibliotheek.
- **Schrijven:** alleen `is_admin()`, zoals bij `lesson_groups` en `sick_leaves`.
- Een index op `les_planning (coach_id)` en op `les_planning (group_id)`.

Aan `lessons`, `lesson_groups` en `bookings` verandert niets. Dat is de winst van "alleen de
trainer": nul openingen in de bestaande bewaking.

## Oplevering

- `lib/lesplanning.test.ts`:
  - `lesplanningFout`: geen materiaal, geen trainer én geen groep, een half getypte datum, een
    onbestaande datum, een periode die eindigt voor ze begint, één enkele dag (mag), en een
    volledig ingevulde periode.
  - `geldtVoor`: binnen de periode, op de eerste dag, op de laatste dag, ervoor, erna; alleen
    trainer, alleen groep, beide; een avondles op de laatste dag (die mag niet naar de volgende
    UTC-dag schuiven); een les van een vervanger blijft gelden (`coach_id`, niet `lesgeverId`).
  - `materiaalVoor`: geen enkele treffer geeft een lege lijst, twee treffers staan er beide in,
    en de volgorde is groep-én-trainer, dan groep, dan trainer.
- `npx tsc --noEmit`, `npx jest` en `npx expo export --platform web`, zoals bij elke oplevering.
- **Handwerk van de gebruiker:** `LESPLANNING.sql` draaien in de Supabase SQL-editor en daarna
  de app hard herladen — de app leest de databank bij het opstarten. Vóór die SQL werkt het
  scherm wel en het opslaan niet.
