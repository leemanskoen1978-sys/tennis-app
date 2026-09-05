# Phase 4: Excel-export - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning
**Source:** De gebruiker heeft alle vier de bladen expliciet gekozen. Het kolomformaat ligt
vast in `.planning/IMPORT-SJABLOON.md`.

<domain>
## Phase Boundary

De beheerder trekt op elk moment een kloppende Excel-export over een periode, met een
groepskenmerk dat een latere herimport laat herkennen.

Deze fase komt bewust vóór de import: herimport zonder verdubbelen kan alleen als de export een
round-trip-baar groepskenmerk meedraagt. Matchen op naam gaat vroeg of laat mis — zie het
bewijs in `.planning/IMPORT-SJABLOON.md`.

</domain>

<decisions>
## Implementation Decisions

### Wat erin zit

- **D-01:** Eén bestand, vier bladen. Alle vier door de gebruiker gekozen:
  - **Lessen** — één rij per les: datum, begin- en einduur, baan, toegewezen trainer, wie hem
    werkelijk gaf, groep of speler, aantal spelers, status.
  - **Uren per trainer** — uren en loon per trainer over de periode, gerekend op wie de les
    werkelijk gaf (fase 2).
  - **Aanwezigheid** — per lesgroep de spelers in de rijen en de lesdata in de kolommen,
    gevuld uit het bestaande `bookings.attendance`. Moet ook léég afdrukbaar zijn: een
    vervanger die geen app heeft, is precies waarom dit blad bestaat.
  - **Groepen** — één rij per lesgroep: naam, niveau, dag en uur, trainer, aantal spelers,
    aantal ingeplande lessen, plus `Groep-ID`.
- **D-02:** Blad "Lessen" staat in **exact** het kolomformaat dat de import leest, inclusief
  `Groep-ID`. Een export moet ongewijzigd weer ingelezen kunnen worden. Zie
  `.planning/IMPORT-SJABLOON.md` voor de kolommen; wijk daar niet van af.
- **D-03:** Bedragen zijn getallen en datums zijn datums — geen tekst. Dat is precies waarom
  `lib/xlsx.ts` bestaat: de beheerder moet kunnen sorteren en optellen zonder Excel eerst uit
  te leggen wat er staat.

### Wat er niet in zit

- **D-04:** Geen nieuw xlsx-pakket. `lib/xlsx.ts` is met opzet zelfgeschreven — een schrijver
  van de plank kost een megabyte in de webbundel. Uitbreiden mag; vervangen niet.
- **D-05:** Geen omzetblad. Omzet staat al in Beheer → Rapport en loopt op een ander tarief
  (de baan, niet de trainer). Die twee bedragen mogen nooit in elkaar schuiven.

### Toegang

- **D-06:** Alleen de beheerder. Deze fase voegt geen tabel toe en dus ook geen RLS-policy;
  wél moet het scherm zelf achter `isAdmin` staan, niet alleen de tegel.

### Claude's Discretion

- Hoe de periode gekozen wordt en waar het exportscherm komt te staan.
- Hoe het bestand op web en op telefoon bij de gebruiker terechtkomt (`lib/bestand.ts` bestaat).
- De kolombreedtes en de bladnamen, binnen wat `.planning/IMPORT-SJABLOON.md` vastlegt.

</decisions>

<specifics>
## Specific Ideas

- Realistische omvang: een seizoen van één trainer is ~325 lessen en ~1400 regels op blad
  "Lessen". De hele club is een veelvoud daarvan. Dat is voor Excel niets, maar het rekenwerk
  moet niet per rij de databank opnieuw bevragen.
- Uit de echte planning: niveaus zijn vrije tekst ("Kidstennis oranje", "Duoles"), geen lijst.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/IMPORT-SJABLOON.md` — **het kolomformaat en de groepssleutel. Bindend.**
- `.planning/REQUIREMENTS.md` — EXP-01 t/m EXP-07.
- `.planning/phases/01-lesgroepen/01-CONTEXT.md` en `.planning/phases/02-wie-gaf-de-les-echt/02-CONTEXT.md` — het groepsmodel en de trainerattributie waarop dit leunt.
- `lib/xlsx.ts` + `lib/xlsx.test.ts` — de bestaande schrijver; de tests lezen het bestand weer uit elkaar.
- `lib/reports.ts`, `lib/payments.ts` — loon en uren; het exportblad mag geen tweede berekening worden.
- `lib/aanwezigheid.ts` — het aanwezigheidsveld.
- `lib/period.ts` — periodes.
- `lib/bestand.ts` — een bestand bij de gebruiker krijgen.
- `.planning/codebase/CONVENTIONS.md`, `.planning/research/PITFALLS.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/xlsx.ts` — `XlsxBlad`, `XlsxCel` met de soorten `tekst`/`getal`/`geld`/`datum`. Meerdere bladen moeten mogelijk zijn; kijk of dat er al in zit voor je iets toevoegt.
- `lib/reports.ts` — het rekenwerk achter Beheer → Rapport. Blad "Uren per trainer" hoort hier langs te gaan, niet ernaast.
- `app/admin/reports.tsx` — een bestaand rapportscherm als voorbeeld.

### Constraints from Existing Code
- `lib/` importeert nooit uit `providers/`, `components/` of `app/`. Het samenstellen van de bladen is puur rekenwerk en hoort in `lib/` met een test die het bestand weer uitleest.
- Geen nieuwe afhankelijkheden.
- Oplevering: `npx tsc --noEmit`, `npm test`, `npx expo export --platform web`.

</code_context>

<deferred>
## Deferred Ideas

- Een omzetblad — staat al in Beheer → Rapport.
- Exporteren naar iets anders dan Excel — niet gevraagd.

</deferred>

---

*Phase: 04-excel-export*
*Context gathered: 2026-09-05*
