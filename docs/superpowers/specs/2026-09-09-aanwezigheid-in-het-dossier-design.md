# Aanwezigheid in het spelersdossier

*9 september 2026 — stuk 2 van het opheffen van de Agenda-tab*

## Het probleem

Een trainer die wil weten hoe vaak een kind er dit seizoen was, kan dat nergens opzoeken.
Aanwezigheid bestaat alleen per losse les: op het afvinkscherm en in het detailblad van één
boeking. Er is geen enkele plek in de app die het optelt.

Het spelersdossier zou die plek moeten zijn, maar het blad **Lesdagen** toont vandaag alleen
tijd, baan en betaalstatus — geen woord over wie er stond. En het toont hooguit **zes**
verleden lessen (`app/players/[id].tsx:326`, `past.slice(0, 6)`), wat voor een kind met
vijfendertig lessen niet eens de vorige maand haalt.

## Wat het wordt

Het blad Lesdagen krijgt aanwezigheid erbij. **Geen nieuwe tegel**: de lessen staan er al, en
aanwezigheid is een eigenschap van die lessen, geen apart onderwerp. Twee lijsten die
dezelfde lessen tonen is precies de fout die bij Lesplan en Voortgang al eens is
rechtgezet — daar stond in het commentaar: *"Als twee lijsten naast elkaar moest je zelf
uitzoeken welke notitie bij welke les hoorde, terwijl de notitie dat zelf al weet."*

Drie toevoegingen:

**Een samenvatting bovenaan.** Eén regel over de gekozen periode: *"30 van 35 lessen
aanwezig · 3 keer afwezig · 2 niet afgevinkt"*. Die derde teller staat er met opzet naast en
niet bij "aanwezig": een les waar niemand naar keek is geen aanwezigheid. Zie de drie
standen in `lib/aanwezigheid.ts`.

**Een merkteken per lesregel.** Aanwezig, afwezig, of een streepje voor een les die niemand
afvinkte. Dat streepje is met opzet zichtbaar: een leeg vakje betekent "hier is niet
gekeken", en dat mag niet als aanwezigheid gelezen worden.

**Een periodekiezer.** Dezelfde `PeriodPicker` als op Historiek, met `currentPeriod()` als
beginstand. Daarmee vervalt het plafond van zes: de periode bepaalt wat je ziet, niet een
willekeurig getal.

## De toekomst is aanpasbaar, het verleden alleen leesbaar

In dit blad kan een trainer alleen **toekomstige** lessen aanpassen. Tikt hij een komende
les aan, dan kan hij een kind alvast afmelden — dat is een mededeling, die krijgt hij van de
ouder. Een les die geweest is, staat er alleen ter lezing.

Vergat hij af te vinken, dan meldt hij dat aan de beheerder en die zet het recht.

### "Verleden" begint de dag nadien

Een trainer mag alles wijzigen aan een les van **vandaag**, ook nadat die is afgelopen. Vanaf
middernacht is het aan de beheerder.

De grens is de dag en niet het uur, en dat is de kern: afvinken gebeurt ná de les. Zou de
grens "zodra de les voorbij is" zijn, dan blokkeert ze precies het gewone geval — een trainer
die zijn groep afvinkt om vijf over het uur.

Er komt geen nieuw begrip bij. Deze dag-grens staat al in `magAanwezigheidZetten`
(`lib/aanwezigheid.ts:227`) en in de databank (`bewaak_betaalvelden`, met
`date_trunc('day', now() at time zone 'Europe/Brussels')`). Ze geldt vandaag alleen voor
spelers en ouders; de trainer van de les valt er bovenlangs uit:

```
if (kijker.is_admin === true || booking.coach_id === kijker.id) return true;
```

Die uitzondering wordt gesplitst: de beheerder houdt de vrije hand, de trainer krijgt
dezelfde dag-grens als iedereen.

**Dit moet op twee plaatsen, anders is het cosmetica.** In `magAanwezigheidZetten`, zodat het
scherm niets aanbiedt wat daarna geweigerd wordt. En in de trigger `bewaak_betaalvelden` in
`supabase-schema.sql`, die nu nog `if is_admin() or old.coach_id = app_user_id() then return
new` doet en de trainer dus alles laat schrijven. Staat de app-regel er wel en de
databankregel niet, dan is de grens een suggestie.

## Wat er in de code verandert

### `lib/aanwezigheid.ts`

**`magAanwezigheidZetten`** — de trainer verliest zijn onvoorwaardelijke pas. Nieuw:

- beheerder: altijd;
- de lesgever van deze les: alleen als de les vandaag of later begint;
- jijzelf, of je goedgekeurde kind: alleen als de les vandaag of later begint, en alleen voor
  je eigen aantekening (ongewijzigd).

**`lesgeverId` en niet `coach_id`.** De functie toetst nu op `booking.coach_id`. Een
vervanger die de les overnam moet hem ook kunnen afvinken — dezelfde scheur die bij de
Klaar-knop al is rechtgezet (`bevestigLes`, commit `0168cb8`). `lib/lesgever.ts` is de enige
plek die de vraag "wie geeft deze les" beantwoordt.

**`aanwezigheidOverzicht(bookings, playerId)`** — nieuw en puur. Telt over een lijst lessen
hoe vaak deze speler aanwezig, afwezig en niet-afgevinkt was. Dit is de samenvattingsregel,
en het is de eerste functie in de app die aanwezigheid over meer dan één les optelt.

### `supabase-schema.sql`

De trigger `bewaak_betaalvelden` krijgt dezelfde splitsing. Let op: die functie staat er
**twee keer** in (rond regel 420 en rond regel 975); allebei moeten mee, anders hangt het
ervan af welke versie er op de databank van de club staat.

### `app/players/[id].tsx`

Het blad Lesdagen krijgt de periodekiezer, de samenvatting, het merkteken per regel, en een
doorklik op toekomstige lessen. `past.slice(0, 6)` verdwijnt.

## Testen

Alles wat rekent, komt in `lib/` en krijgt tests:

- `magAanwezigheidZetten`: een trainer mag een les van vandaag, ook als die al afgelopen is;
  een trainer mag een les van gisteren **niet**; een beheerder mag die wél; een vervanger
  (`taught_by_id`) mag wat de vaste trainer mag. Dit vervangt bestaande tests die uitgaan van
  de onvoorwaardelijke trainerspas.
- `aanwezigheidOverzicht`: telt drie standen los; telt alleen lessen waar deze speler in
  meespeelt; een lege lijst geeft nullen.

Het scherm zelf wordt met de hand nagekeken, zoals bij stuk 1 — dit project heeft geen
schermtests.

## Aanvaarde gevolgen

**Een trainer kan een oude vergissing niet meer zelf rechtzetten.** Dat is de bedoeling: wat
geweest is, is wat er op de baan is vastgesteld. Maar het legt wel een taak bij de beheerder
die daar vandaag geen goede weg voor heeft — zie hieronder.

**De beheerder heeft geen betrouwbare weg naar een oude losse les.** Vandaag loopt die via
Beheer → Lesgroepen → groep → les, en dat werkt alleen voor lessen die aan een lesgroep
hangen. `LessonCards` — het enige component dat het lesdetail opent — staat verder alleen in
`agenda/historiek` en `agenda/komend`, en die verdwijnen in stuk 4. **Dat gat moet in stuk 4
gedicht worden**, en het is nu urgenter dan het was: vanaf dit stuk is de beheerder de enige
die een correctie kán doen.
