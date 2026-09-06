# Ziekmelding: verwijderen en een periodecontrole

**Doel:** een beheerder kan een ziekmelding verwijderen in plaats van intrekken, en een periode
die eindigt voor ze begint wordt geweigerd in plaats van stil omgedraaid.

**Aanleiding:** de gebruiker meldde twee dingen op 6 september 2026. Ten eerste: een ziekmelding
moet weg kunnen. Ten tweede: hij voerde "september 2026 tot en met augustus 2026" in, kreeg geen
enkele melding, en zag een lege werklijst.

---

## Wat er vandaag staat

`trekZiekmeldingIn` zet `retracted_at` en laat de rij staan. Het scherm toont zulke meldingen
onder "Ingetrokken". Daar staat deze reden bij:

> De club hoort te kunnen terugzien dat er die week een trainer ziek gemeld is geweest, ook als
> het achteraf loos alarm was.

`ziekmeldingFout` controleert alleen of er een trainer gekozen is en of beide datums leesbaar
zijn. Een omgekeerde periode is er met opzet géén fout; `dektDag` draait de grenzen om. "September
2026 tot augustus 2026" werd daardoor gelezen als augustus tot september 2026 — een venster dat al
voorbij was, dus nul lessen en geen woord uitleg.

De app spreekt zichzelf hierin tegen: `lesGroepFout` weigert precies hetzelfde wél, met "Het
seizoen eindigt voor het begint."

## Beslissingen van de gebruiker

| Vraag | Antwoord |
| --- | --- |
| Wanneer verwijderen? | **Altijd, in plaats van intrekken.** "Intrekken" verdwijnt. |
| Omgekeerde periode? | **Weigeren**, dezelfde regel als bij een lesgroep. |
| Bevestiging bij verwijderen? | **Ja.** Twee klikken. |

## Het ontwerp

**1. `ziekmeldingFout` weigert een omgekeerde periode.** Eén regel erbij, na de datumcontrole:
eindigt de periode voor ze begint, dan komt er "De ziekteperiode eindigt voor ze begint." Dat is
dezelfde formulering als `lesGroepFout` gebruikt, zodat dezelfde vergissing overal hetzelfde heet.

Een half getypte datum blijft géén fout — die afspraak staat er al en blijft.

**2. `dektDag` blijft de grenzen omdraaien.** Niet omdat het nog kan gebeuren, maar omdat het al
gebeurd is: er staat minstens één omgekeerde rij in de databank van de club. Zou de lezer de swap
verliezen, dan dekt zo'n rij ineens geen enkele dag meer en verandert stilletjes wat er in de
agenda staat. Het commentaar erboven wordt herschreven: de swap is een vangnet voor oude rijen,
niet langer het bedoelde gedrag.

**3. `verwijderZiekmelding(id)` vervangt `trekZiekmeldingIn(id)`.** Haalt de rij uit `sickLeaves`;
`diffStores` en `saveToSupabase` doen de rest — die kunnen al verwijderen. De policy
`sick_leaves_write ... for all ... is_admin()` dekt `delete`. **Geen SQL, geen migratie.**

**4. Geen enkele boeking wordt aangeraakt.** Precies zoals bij intrekken: "zoekt deze les een
vervanger" is een afgeleid feit uit de open meldingen (`zoektVervanger`), geen kolom. Valt de
melding weg, dan is dat antwoord vanzelf overal nee. Een vervanger die de beheerder al toewees
blijft staan — dat is zijn keuze en geen gevolg van de ziekmelding.

**5. `retracted_at` blijft in het type, en `openZiekmeldingen` blijft erop filteren.** Het veld
wordt nooit meer gezet, maar de filter moet blijven: staan er ingetrokken meldingen in de
databank, dan zouden die zonder filter morgen weer als lópend verschijnen. Ze worden onzichtbaar.
Wie ze echt weg wil, doet dat met één regel SQL — dat is geen onderdeel van dit werk.

**6. Het scherm.** "Intrekken" wordt "Verwijderen" met een bevestiging in twee stappen; de sectie
"Ingetrokken" verdwijnt, want die kan niet meer vollopen. De bevestiging is er omdat verwijderen
onomkeerbaar is en intrekken dat niet was: één misklik in een lijst wist anders een melding die
nog nodig was.

## Wat er buiten valt

`vakantieFout` in `lib/vakanties` draait een omgekeerde periode net zo stil om. Dezelfde
inconsistentie, maar een andere plek en een ander scherm; die blijft zoals hij is tot iemand er
last van heeft.

Er komt géén melding als een geldige periode nul lessen raakt (een week die al voorbij is
bijvoorbeeld). De gebruiker koos de smalle variant: alleen de omgekeerde periode weigeren.

## Testen

In `lib/ziekmelding.test.ts`: de omgekeerde periode geeft een fout, een gelijke begin- en einddag
niet, een half getypte datum nog steeds "vul beide dagen in", en `dektDag` blijft een bestaande
omgekeerde rij correct lezen.

De provider en het scherm hebben geen tests in deze codebase — alle 1710 staan op `lib/`. Het
verwijderen leunt op `diffStores`, en dát is wel getest.
