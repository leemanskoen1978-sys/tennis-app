# Alle vervangingen in één keer aan één trainer

**Doel:** de beheerder wijst in één klik alle lessen die nog een vervanger zoeken toe aan één
collega, in plaats van ze één voor één af te gaan.

**Aanleiding:** de gebruiker, 6 september 2026: *"Bij de vervanging moet het ook mogelijk zijn om
alle vervangingen door 1 bepaalde trainer."* Een ziekmelding van een week raakt bij deze club
makkelijk twaalf lessen, en die stuk voor stuk aanklikken is het werk dat dit scherm juist zou
wegnemen.

## Wat er vandaag staat

`app/admin/ziekmelding/[id].tsx` toont de lessen die de ziekmelding raakt. Per les klap je een
kiezer open; `vervangersVoor` in `lib/vervanger.ts` beoordeelt elke collega en het scherm zet ze
in twee groepen — wie kan, en wie niet mét de reden erbij. Je mag ook iemand kiezen die niet kan:
de app beslist niet voor de beheerder.

## Beslissingen van de gebruiker

| Vraag | Antwoord |
| --- | --- |
| Welke lessen pakt de knop? | **Alleen wat nog een vervanger zoekt.** Een les waar al iemand op staat wordt niet aangeraakt, een afgezegde les evenmin. |
| En waar die trainer niet kan? | **Overslaan en tonen welke.** Hij krijgt wat hij kan; de rest blijft openstaan met de reden erbij. |

## Het ontwerp

**1. De rekenregel komt in `lib/vervanger.ts`, naast `vervangersVoor`.**

```ts
export interface MassaVervanging {
  /** De boekingen die deze collega krijgt. */
  toewijzen: string[];
  /** De boekingen die blijven openstaan, met de reden waarom hij niet kan. */
  overgeslagen: Array<{ id: string; reden: VervangerReden }>;
}

export function planMassaVervanging(
  kandidaat: VervangerKandidaat,
  lessen: readonly Booking[],
  bestaandeLessen: Booking[],
  vakanties: Vakantie[],
  open: OpenZiekmelding[],
  clubEinde: string,
): MassaVervanging
```

`lessen` zijn de boekingen van deze ziekmelding die nog een vervanger zoeken — het scherm
filtert die met `zoektVervanger`, dezelfde vraag die de lijst zelf al stelt. Er komt geen tweede
antwoord op "zoekt deze les nog iemand".

Wie de zieke trainer zelf is, valt af: hij vervangt zichzelf niet. Dat is dezelfde regel die de
kiezer per les al toepast.

**2. De beschikbaarheid wordt uitgerekend tegen de toestand vóór de knop, niet oplopend.**

Deze club heeft trainers die drie groepen tegelijk draaien — het kleutertennis op Terrein 7.
Die drie lessen botsen met elkaar. Zou de rekenregel na elke toewijzing opnieuw kijken, dan heet
de vervanger na de eerste les "bezet" en krijgt hij er één van de drie, terwijl de zieke collega
ze alle drie zelf gaf. Tegen de begintoestand rekenen geeft hem precies wat zijn collega had.

Dat sluit aan bij de regel van 6 september 2026: een overlap blokkeert nooit en waarschuwt
altijd.

**3. Eén schrijfbeurt.** De provider krijgt `zetVervangerVoorLessen(ids, coachId)`, die alle
`taught_by_id`-velden in één `commit` zet. Een lus over `updateBooking` zou acht opslagbeurten
en acht ronden naar Supabase betekenen, met een halve toewijzing als het onderweg misgaat.

`coach_id` wordt nooit aangeraakt. De vervanger staat náást de vaste trainer, nooit in zijn
plaats (D-07) — precies zoals de kiezer per les het doet.

**4. Het scherm.** Boven de lessenlijst een blok, alleen zichtbaar zolang er iets openstaat: per
collega één knop met het aantal erin ("Lasoen Filip · kan er 8 van de 12"), de nuttigste bovenaan.
Na de klik één zin: "8 lessen naar Lasoen Filip. 4 blijven openstaan." De lijst eronder is de
verantwoording — daar staat per les nog steeds dat hij een vervanger zoekt.

Kan een collega er nul, dan komt hij niet in het blok: een knop die niets doet is een knop die je
één keer indrukt en daarna wantrouwt.

## Testen

In `lib/vervanger.test.ts`:

- Kan de collega alles, dan staat elke les in `toewijzen` en is `overgeslagen` leeg.
- Kan hij er niets, dan andersom, met per les de reden.
- Drie lessen op hetzelfde uur leveren drie toewijzingen op, niet één — de begintoestand telt.
- Een lege lijst geeft twee lege lijsten en geen fout.
- De reden per overgeslagen les is dezelfde die `kanVervangen` geeft; er komt geen tweede
  formulering naast.

Het scherm en de provider hebben geen tests in deze codebase; alle tests staan op `lib/`.

## Wat er buiten valt

Geen knop "toch allemaal, ook waar hij niet kan". De gebruiker koos overslaan; wie er één toch
wil forceren, doet dat per les zoals nu — die weg blijft bestaan.

Geen ongedaan maken van de hele actie. Elke les is los terug te zetten via de kiezer, en een
tweede knop die acht toewijzingen terugdraait is werk waar niemand om vroeg.
