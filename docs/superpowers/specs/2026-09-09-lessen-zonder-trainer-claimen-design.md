# Lessen zonder trainer overnemen — ontwerp

9 september 2026. Een trainer ziet in de trainers-tab welke lessen er zonder trainer
staan en neemt er zelf een over.

## Waarom

Valt een trainer uit, dan staan zijn lessen in de agenda zonder dat er iemand op de baan
staat. Vandaag lost alleen de beheerder dat op, vanaf de werklijst van een ziekmelding
(`app/admin/ziekmelding/[id].tsx`). Hij moet er dus altijd tussen zitten, ook als een
collega die avond gewoon vrij is en de les meteen zou nemen. Dat kost tijd op precies het
moment dat er geen tijd is — bij een uitval van vandaag voor morgen.

Daarnaast is ziekte niet de enige reden dat een les vrijkomt. Een trainer die er om een
andere reden niet geraakt, heeft nu geen manier om dat te laten zien behalve zich ziek
melden — wat niet klopt in de gegevens.

## Wat het wordt

Een trainer opent de trainers-tab, ziet bij het gereedschap **"Lessen zonder trainer"**
met een aantal, en komt op een scherm met elke openstaande les. Per les staat er genoeg om
te beslissen zonder door te klikken, en een knop om hem te nemen. Wat hij nam, kan hij op
hetzelfde scherm teruggeven zolang de les nog moet beginnen.

Een les komt op twee manieren in die lijst: de vaste trainer is ziek gemeld, of iemand
heeft de les vrijgegeven met een merkteken op de les zelf.

## Gegevens

### Eén nieuw veld

`bookings.zoekt_trainer` — waar/onwaar, standaard onwaar. Het merkteken "deze les zoekt
een trainer" buiten ziekte om.

Het zegt niets over wie de les geeft. `coach_id` blijft van wie de les is — zijn agenda,
zijn rooster, zijn dubbele-boekingscontrole. `taught_by_id` blijft het enige antwoord op
wie er werkelijk op de baan stond, met `lib/lesgever.ts` als enige lezer. Er komt geen
tweede veld naast dat óók iets over de lesgever beweert; dat is precies het gat dat het
kopcommentaar van `lib/lesgever.ts` beschrijft, en het laat een trainer betaald worden
voor een les die hij niet gaf.

Leeg (onwaar) is de normale toestand. Er hoeft niets ingevuld te worden voor wat er al
staat.

### Eén nieuw rekenbestand: `lib/openstaand.ts`

Puur rekenwerk — geen store, geen scherm, geen schrijfweg — en de ENIGE plek die de vraag
"staat deze les open om over te nemen" beantwoordt.

```
staatOpen(les, openMeldingen): boolean
```

Waar als `zoektVervanger` uit `lib/ziekmelding.ts` ja zegt (openstaande ziekmelding op de
vaste trainer, nog geen lesgever, niet afgezegd), **of** als `zoekt_trainer` aanstaat, er
nog geen lesgever op staat en de les niet afgezegd is.

De ziektekant wordt hergebruikt en niet nagebouwd. Zou dit bestand zijn eigen
periodevergelijking schrijven, dan is er een kopie van `van <= dag <= tot` bij, en een
kopie die ooit uiteenloopt laat een les stil buiten de lijst vallen.

```
openstaandeLessen(lessen, openMeldingen, vakanties, nu, kijkerId): OpenstaandeLes[]
```

Van alles wat `staatOpen` zegt, valt hier nog af:

- wat al begonnen is of geweest (`start_time <= nu`) — daar valt niets meer over te
  beslissen;
- een dag dat de club dicht is (`vakantieOpMoment`) — die les gaat sowieso niet door, en
  er een trainer voor zoeken is werk voor niets, dezelfde regel als
  `lessenVoorZiekmelding`;
- de eigen lessen van de kijker — jezelf overnemen betekent niets.

Op tijd gesorteerd, want zo werkt een trainer de lijst van boven naar beneden af. Geen
tweede sortering in het scherm.

Elke rij draagt de reden mee waarom hij openstaat — `'ziek'` (met de melding erbij) of
`'vrijgegeven'` — zodat het scherm dat kan tonen zonder het zelf af te leiden.

Er staat geen bovengrens op hoe ver vooruit gekeken wordt. Een les die pas over twee
maanden valt hoort ook nu al zichtbaar te zijn; een venster van vier weken is precies hoe
een les blijft liggen tot hij te dichtbij is om nog op te lossen.

### Wat er níét bij komt

Geen nieuwe waarde op `bookings.status`. "Staat open" is een afgeleid feit uit een veld,
een ziekmelding en een lesgever, net als `zoektVervanger` vandaag — een opgeslagen
vlaggetje blijft hangen omdat iemand het vergat uit te zetten, en een nieuwe status raakt
elke `switch` in de app.

Geen claimtabel en geen claimgeschiedenis. Wie de les geeft staat in `taught_by_id`, en
dat is genoeg.

## Wie kan wat overnemen

Onveranderd uit `kanVervangen` in `lib/vervanger.ts`, met zijn vijf redenen (`zelf_ziek`,
`afwijkende_periode`, `buiten_uren`, `clubvakantie`, `eigen_les`).

**Er wordt niets weggefilterd.** Elke openstaande les staat in de lijst, ook als hij niet
past, met de reden eronder in gewone taal. Dat is dezelfde afspraak als aan de
beheerderskant: een lijst waar iets zonder uitleg uit verdwijnt, laat de gebruiker
twijfelen of de app het wel goed ziet. En erger — een les die niemand ziet, blijft zonder
trainer staan, en dat is de fout waarvoor deze module bestaat.

De trainer mag bewust afwijken. Hij weet dat zijn les van 18:00 die week niet doorgaat; de
app weet dat niet.

## Schrijfwegen

Twee nieuwe functies in `providers/SimpleDataProvider.tsx`, naast `setTaughtBy` die van de
beheerder blijft:

```
claimLes(bookingId): Promise<string | null>
geefLesTerug(bookingId): Promise<string | null>
```

`claimLes` zet `taught_by_id` op de ingelogde gebruiker. Weigert — met de reden als tekst,
niet stil — als de les niet meer openstaat, al begonnen is, of van de kijker zelf is. Dat
laatste is geen theorie: twee trainers kunnen tegelijk naar dezelfde lijst kijken, en de
tweede hoort te lezen dat een collega hem voor was.

`geefLesTerug` maakt `taught_by_id` weer leeg. Alleen de lesgever zelf, alleen zolang de
les nog moet beginnen. De les komt daarmee terug in de lijst waar iedereen hem ziet — dat
is de reden dat teruggeven mag: het maakt de les niet onzichtbaar, het maakt hem weer
zichtbaar.

Beide raken precies één boeking. Ook bij een les uit een reeks (`series_id`) of uit een
lesgroep (`group_id`): de rest van de reeks blijft van de vaste trainer. Wie dit "handig"
maakt en de hele reeks meeneemt, laat een half seizoen aan lessen van eigenaar wisselen
voor lessen waar niemand voor uitviel — dezelfde regel als D-07 op de werklijst.

Het merkteken `zoekt_trainer` gaat gewoon langs `updateBooking`. Het is geen loon- of
geldveld en hoeft geen eigen bewaakte weg; de databank bewaakt wie het mag zetten.

## Schermen

### Trainers-tab — `app/coaches/index.tsx`

Bij *Gereedschap* komt er één regel bij: **"Lessen zonder trainer"** met het aantal
erachter, naar `/coaches/openstaand`.

De regel is er alleen voor wie trainer is (`isCoach`). Spelers en ouders zien hem niet —
een ouder die leest dat de les van zijn kind geen trainer heeft, belt de club over iets
wat binnen het uur opgelost is.

Staat er niets open, dan blijft de regel staan met "geen" erachter. Een regel die
verdwijnt laat je twijfelen of je hem wel goed onthouden had.

### Nieuw scherm — `app/coaches/openstaand.tsx`

De grens staat op het scherm zelf en niet alleen op de regel die ernaartoe wijst: wie geen
trainer is krijgt een zin te lezen, geen lege lijst. Een trainer kan de link intikken,
maar ook een speler kan dat (TOEG-01 op de werklijst).

**Deel 1 — Openstaand.** Eén kaart per les:

- dag en uur, baan;
- de speler, of bij een groep de groepsnaam met het aantal (`groupSize`, `groupSizeLabel`);
- van wie de les is;
- waarom hij openstaat: "Jan is ziek van 12 tot 16 maart" (`periodeTekst`) of "vrijgegeven
  door Jan";
- past het uur niet, dan de zin van `kanVervangen` eronder: "botst met je eigen les van
  18:00", "valt buiten je uren", "de club is die dag dicht".

Knop **"Ik neem deze les"**, altijd aanwezig. Is er een reden waarom het niet past, dan
vraagt hij eerst een bevestiging in het scherm zelf ("Toch nemen?") — geen `Alert`, die
blokkeert op web; het bevestigingsvak van de beurtenkaarten en van
`BookingDetailSheet.tsx` is het voorbeeld.

Is er niets open, dan staat er een zin en geen leeg scherm.

**Deel 2 — Door mij overgenomen.** Daaronder de lessen waar de kijker als lesgever op
staat en die nog moeten komen, met **"teruggeven"**. Zo staan nemen en teruggeven op één
plek, en hoeft niemand zijn eigen claim in de agenda terug te zoeken.

Hier staan ook de lessen die de beheerder aan hem gaf. Teruggeven zet die terug in de
lijst waar de beheerder hem weer ziet staan als zoekend — hij verdwijnt niet.

### Lesdetail — `components/BookingDetailSheet.tsx`

Voor de trainer van de les en voor de beheerder komt er een schakelaar **"deze les zoekt
een trainer"** bij. Aan betekent: de les staat in de lijst. Uit haalt hem eruit.

Staat er al een lesgever op, dan is de schakelaar er niet — die les zoekt niemand meer.

### Werklijst van de beheerder — ongewijzigd

Een les die een trainer claimt krijgt `taught_by_id`, en `zoektVervanger` zegt daarna
vanzelf nee. Op `app/admin/ziekmelding/[id].tsx` staat die rij dus als geregeld, met de
naam van de collega erop. Geen tweede administratie, geen scherm dat bijgewerkt moet
worden.

## Databank — `ZOEKT-TRAINER.sql`

Een bestand in de projectmap, te draaien in de Supabase SQL-editor, twee keer draaien kan
geen kwaad. Zelfde vorm als `AFZEGGING-MERKTEKEN.sql`.

1. **De kolom.**
   `alter table bookings add column if not exists zoekt_trainer boolean not null default false`

2. **De functie `les_staat_open(bookings)`.** Niet afgezegd, nog geen `taught_by_id`, en
   óf `zoekt_trainer` staat aan óf de vaste trainer is die dag ziek gemeld (een
   `sick_leaves`-rij zonder `retracted_at` die de lokale dag van `start_time` dekt).

   De ziekteperiode wordt met `least`/`greatest` gelezen, net als `dektDag` in
   `lib/ziekmelding.ts`: er staat minstens één omgekeerde rij in de databank van vóór de
   controle van 6 september 2026, en die hoort hier hetzelfde te dekken als in de app.

   Dit is bewust een tweede uitwerking van `staatOpen`. Dezelfde dubbeling als tussen
   `lib/rechten.ts` en de policies: de app zorgt dat er geen knop staat die de databank
   weigert, de databank is de bewaker. Lopen ze uiteen, dan is het gevolg een geweigerde
   knop en geen stille wijziging.

3. **De opening in de bewaking**, zo nauw mogelijk.

   **Policy `bookings_update`** krijgt er één tak bij, naast de bestaande:
   `is_coach() and (les_staat_open(bookings) or taught_by_id = app_user_id())`.
   In `with check` hetzelfde, met `taught_by_id = app_user_id() or taught_by_id is null`.
   Een policy kent alleen hele rijen; welke kolom er mag veranderen zegt de trigger.

   **Trigger `bewaak_betaalvelden`** — de regel "alleen een beheerder kan invullen wie de
   les werkelijk gaf" wordt vervangen door drie gevallen, en blijft staan waar hij staat:
   vóór "de trainer van deze les mag alles", want ook de vaste trainer mag dit veld niet
   zelf zetten.

   - beheerder: mag het altijd, ongewijzigd;
   - **claimen**: `old.taught_by_id is null`, `new.taught_by_id = app_user_id()`,
     `is_coach()`, `les_staat_open(old)`, en `old.start_time > now()`;
   - **teruggeven**: `old.taught_by_id = app_user_id()`, `new.taught_by_id is null`, en
     `old.start_time > now()`.

   In beide gevallen geldt bovendien: **er verandert verder niets aan de rij**
   (`to_jsonb(new) - 'taught_by_id'` gelijk aan `to_jsonb(old) - 'taught_by_id'`). Zonder
   die eis geeft de claimtak een trainer schrijfrecht op de hele boeking van een collega —
   het uur, de baan, de spelers.

   Alles daarbuiten blijft geweigerd, met de bestaande melding.

   Het merkteken `zoekt_trainer` heeft geen eigen regel nodig: de bestaande tak "de
   trainer van deze les mag alles" laat de vaste trainer het zetten, en voor iedere andere
   trainer is het een verandering buiten `taught_by_id` en dus geweigerd.

## Wat er met opzet buiten blijft

- **Een vervanger kan de aanwezigheid van die les niet afvinken.** Dat is vandaag al zo
  voor een vervanger die de beheerder aanwees; het rechttrekken raakt de
  aanwezigheidsregels in de trigger en is een eigen beslissing. Deze wijziging maakt het
  niet erger en lost het niet op.
- **Geen bericht of melding** als er een les vrijkomt. De lijst is waar je kijkt.
- **Geen prijs- of loongevolg om te regelen.** `taught_by_id` bepaalt al wie er betaald
  wordt, langs `lib/lesgever.ts`. Een claim is precies dezelfde wijziging als een
  toewijzing door de beheerder.
- **Geen bulkclaim.** Elke les apart, om dezelfde reden als D-07.

## Oplevering

- `lib/openstaand.test.ts`: staat open door ziekte, staat open door het merkteken, staat
  niet open bij een lesgever, bij afgezegd, bij een ingetrokken ziekmelding; valt af in het
  verleden, in een clubvakantie, en bij de eigen lessen van de kijker; sortering op tijd.
- Tests rond `claimLes` en `geefLesTerug` in de bestaande provider-tests: een tweede
  claimer krijgt een weigering met reden, teruggeven van andermans les gaat niet.
- `npx tsc --noEmit` en `npx expo export --platform web`, zoals bij elke oplevering.
- **Handwerk van de gebruiker:** `ZOEKT-TRAINER.sql` in de Supabase SQL-editor draaien, en
  daarna de app hard herladen — de app leest de databank bij het opstarten. Vóór die SQL
  werkt het claimen niet; het scherm en de lijst wel.
