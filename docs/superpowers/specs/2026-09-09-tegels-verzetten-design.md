# Tegels verzetten na het opheffen van de Agenda-tab

*9 september 2026 — een naronde op stuk 4*

## Waar dit vandaan komt

Toen de Agenda-tab werd opgeheven, kwamen zijn tegels op Home terecht. Daardoor stonden er
zes tegels op het hoofdscherm van een trainer, waarvan er drie — Spelers, Trainers en Beheer
— hetzelfde deden als de tabbalk eronder. Twee wegen naar hetzelfde scherm maken het
hoofdscherm langer zonder er iets aan toe te voegen.

## Wat er verandert

**Home van een trainer** houdt wat er vandaag gebeurt en één actie: de goedkeuringswachtrij,
de lesdag, en de tegels Nieuwe afspraak en Mijn kinderen. Dat is precies wat géén tabblad
heeft — Nieuwe afspraak is een scherm onder Reserveren, Mijn kinderen staat nergens anders.

Weg als tegel: **Spelers**, **Trainers** en **Beheer** (ze staan in de tabbalk),
**Afvinken** (naar Spelers) en **Mijn agenda** (naar Trainers).

**Spelers** krijgt de tegel **Afvinken**, naast Voortgang toevoegen en Betalingen. Hij houdt
zijn regel "Nu: 17:00 · geef je gsm door", zodat je ziet welke les er loopt zonder het scherm
te openen. Afvinken gaat over wie er is, dus het hoort bij de spelers.

Eén detail: het icoon wordt `ClipboardCheck` en niet `UserCheck`. Dat laatste staat op dit
scherm al voor "Mijn spelers", en twee tegels met hetzelfde beeld naast elkaar betekenen dan
twee verschillende dingen.

**Trainers** krijgt **Mijn agenda** als eerste regel, bóven het kopje Gereedschap. Daar en
niet erin: dat kopje gaat over materiaal, en dit gaat over jou. Hij opent hetzelfde dossier
als eerst, langs `dossierPad` uit `lib/dossier.ts`.

**Een speler verandert niets.** Zijn tabbalk is een andere — Home, Reserveren, Mijn lessen,
Voortgang — dus hij heeft geen Spelers- en geen Trainers-tab. Zijn vier tegels blijven staan,
en Mijn agenda blijft bij hem op Home: het is zijn enige weg naar zijn eigen dossier.

## Wat er in de code verandert

| bestand | wat |
| --- | --- |
| `app/index.tsx` | `coachTiles` houdt alleen Nieuwe afspraak; de berekening van de lopende les gaat mee naar Spelers; ongebruikte imports eruit. |
| `app/players/index.tsx` | tegel Afvinken met `lessenNu`, icoon `ClipboardCheck`. |
| `app/coaches/index.tsx` | een regel Mijn agenda boven Gereedschap, langs `dossierPad`. |

## Aanvaarde gevolgen

**De badge met openstaande betalingen verdwijnt van Home.** Die zat op de tegel Beheer. Het
getal blijft op de tegel Betalingen onder Spelers en in Beheer zelf, maar een trainer ziet
bij het opstarten niet meer meteen dat er iets openstaat — de tabbalk draagt geen badges.
Blijkt dat te knellen, dan hoort het getal bij de lesdag te staan en niet op een tegel.

**Home van een trainer is kort geworden.** Op een dag zonder lessen en zonder aanvragen staan
er twee tegels en verder niets. Dat is eerlijk: het scherm gaat over wat er vandaag gebeurt,
en dan gebeurt er niets.
