# Phase 3: Ziekmelding en vervangerswerklijst - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning
**Source:** Beslissingen uit het openingsgesprek. De gebruiker heeft expliciet gekozen hoe een
les zonder vervanger afloopt; de rest volgt uit vastgelegde projectbeslissingen.

<domain>
## Phase Boundary

Als een trainer ziek is, ziet de beheerder binnen een minuut welke lessen dat raakt en hangt
hij er een vervanger aan die dat uur écht kan.

Dit is de kernwaarde van de hele module. Alles wat ervoor gebouwd is, staat hier ten dienste
van.

Wat er NIET in zit: spelers en ouders verwittigen (bewust buiten scope — de app verstuurt
niets), automatisch een vervanger toewijzen zonder bevestiging, en een trainer die zichzelf
ziek meldt (v2).

</domain>

<decisions>
## Implementation Decisions

### De ziekmelding

- **D-01:** Een ziekmelding is een periode (van–tot) op een trainer, met eventueel een reden.
  Niet één dag: een griep duurt drie dagen en dat moet je één keer kunnen invoeren.
- **D-02:** Een ziekmelding is intrekbaar. Lessen die nog geen vervanger hebben, gaan dan terug
  naar de vaste trainer; lessen waar al een vervanger op staat, blijven zoals ze zijn — die
  afspraak is gemaakt.
- **D-03:** Een ziekmelding is niet hetzelfde als een afwijkende boekingsperiode
  (`users.booking_periods`). Die laatste zegt "hij geeft die weken geen les" en is vooruit
  gepland; een ziekmelding is een gebeurtenis met lessen die al gepland stonden en nu opgelost
  moeten worden. Ze mogen niet in elkaar geschoven worden, maar het vervangersvoorstel moet
  ze allebei kennen.

### De werklijst

- **D-04:** Eén ziekmelding levert één werklijst op met alle geraakte lessen van die trainer in
  die periode. Per les: datum, uur, baan, groep of speler, en het aantal spelers — genoeg om te
  beslissen zonder door te klikken.
- **D-05:** De beheerder kiest **per les** uit drie dingen: vervanger koppelen, laten staan met
  de markering "zoekt vervanger", of de les afzeggen. Expliciet door de gebruiker gekozen —
  geen enkele van de drie is altijd het juiste antwoord.
- **D-06:** Een les zonder vervanger blijft zichtbaar gemarkeerd in de agenda én blijft in de
  werklijst staan tot hij is opgelost of afgezegd. Hij verdwijnt nooit stil.
- **D-07:** Een les uit een reeks (`series_id`) of uit een lesgroep (`group_id`) die een
  vervanger krijgt, raakt de rest van de reeks of de groep niet. Alleen die ene les verandert.

### Het vervangersvoorstel

- **D-08:** Voorgesteld worden alleen collega's die dat uur werkelijk kunnen. Alle vijf de
  redenen tellen mee: geen eigen les op dat moment, binnen hun boekingstijden
  (`users.working_hours` / `working_days`), niet in een afwijkende periode
  (`users.booking_periods`), niet in een clubvakantie (`club_settings.vakanties`), en zelf niet
  ziek gemeld.
- **D-09:** Trainers die niet kunnen zijn opvraagbaar **mét de reden waarom niet**, zodat de
  beheerder bewust kan afwijken. Een lijst die stil iemand weglaat, is een lijst waarin je gaat
  twijfelen of de app het wel goed ziet.
- **D-10:** Geen rangschikking op geschiktheid, voorkeur of ervaring. Voor één club met een
  handvol trainers is "kan hij of niet" genoeg; slim rangschikken staat in Out of Scope.
- **D-11:** Het rekenwerk "wie kan dit uur" hoort puur in `lib/`, met een test eromheen —
  zonder store en zonder scherm. Fase 4 en latere schermen moeten het kunnen hergebruiken.

### Toegang en databank

- **D-12:** Alleen de beheerder. Een trainer meldt zich niet zelf ziek in deze versie.
- **D-13:** De nieuwe tabel krijgt admin-only RLS-policies in dezelfde vorm als `coach_rates`
  (`is_admin()` op zowel `using` als `with check`, geen eigenaarschapscontrole), en de
  upsert-weg wordt met de hand nagelopen.
- **D-14:** Schemawijzigingen als `alter table ... if not exists`-blok onderaan
  `supabase-schema.sql`. **De gebruiker draait ze zelf.** Niets in deze fase mag SQL draaien of
  de productiedatabank aanraken.

### Beantwoord na het onderzoek van fase 3

- **D-15:** De werklijst neemt ook de lessen mee waar de zieke trainer alléén als vervanger
  stond, niet als toegewezen trainer. Hij kan die les evengoed niet geven, en een les die
  stilzwijgend buiten de lijst valt is precies de fout die deze module moet voorkomen.
- **D-16:** "Zoekt vervanger" wordt **afgeleid**, niet opgeslagen: er is een openstaande
  ziekmelding die deze les dekt, er staat nog geen lesgever, en de les is niet afgezegd. Zo
  hoeft `bookings.status` geen nieuwe waarde te krijgen (dat zou elke `switch` op status
  raken en een migratie vragen), en kan een vergeten vlaggetje niet blijven hangen.
- **D-17:** Een ziekmelding intrekken raakt daardoor geen enkele boeking. `coach_id` is nooit
  overschreven (fase 2), dus er is niets terug te zetten: de markering verdwijnt vanzelf zodra
  de ziekmelding is ingetrokken. Lessen waar al een vervanger op staat, blijven staan — die
  afspraak is gemaakt.

### Claude's Discretion

- De vorm van de markering "zoekt vervanger" — een status, een veld, of iets afgeleids.
- De schermindeling van de werklijst.
- Of de ziekmelding een eigen tabel is of een uitbreiding van iets bestaands.

</decisions>

<specifics>
## Specific Ideas

- De club telt een handvol trainers. De werklijst zal zelden meer dan twintig lessen tellen.
- Uit de echte planning: lessen op hele uren tussen 14:00 en 20:00, groepen van 2 tot 6.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Beslissingen en eisen
- `.planning/PROJECT.md` — Core Value staat letterlijk op deze fase.
- `.planning/REQUIREMENTS.md` — VERV-04 t/m VERV-10.
- `.planning/phases/02-wie-gaf-de-les-echt/02-CONTEXT.md` — het veld en de ene rekenplek waar deze fase op leunt.

### De bestaande code
- `lib/boekingstijd.ts` — de boekingstijden en afwijkende periodes van een trainer.
- `lib/vakanties.ts` — de clubvakanties.
- `lib/slots.ts`, `lib/hub.ts` — beschikbare momenten en de lessen op een dag.
- `lib/recurrence.ts` — hoe "bezet" vandaag al bepaald wordt bij een reeks; dezelfde vraag, hergebruiken in plaats van een tweede versie.
- `lib/series.ts` — waarom één les uit een reeks los te veranderen is.
- `lib/rechten.ts` — `isAdmin`, `magInElkeAgenda`.
- `supabase-schema.sql` — `coach_rates` + `rates_write` als de admin-only policyvorm, en de `bookings`-policies.
- `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/CONCERNS.md`, `.planning/research/PITFALLS.md` (de sectie over beschikbaarheid, DST en de RLS-upsertval).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/boekingstijd.ts` + `lib/vakanties.ts` + `lib/recurrence.ts` — samen weten ze al bijna alles wat "kan deze trainer dat uur" vraagt. De nieuwe functie hoort ze te gebruiken, niet na te bouwen.
- `components/BookingDetailSheet.tsx` — waar een les geopend wordt.
- `app/admin/` — de plek van de werklijst.

### Constraints from Existing Code
- Alles in lokale tijd, met dag-, uur- en minuutvelden — nooit "168 uur erbij". Zie de kop van `lib/recurrence.ts`; een reeks over de uurwissel moet om 10:00 blijven staan.
- `lib/` importeert nooit uit `providers/`, `components/` of `app/`. Geen `jest.mock`.
- Oplevering: `npx tsc --noEmit`, `npm test`, `npx expo export --platform web`.

</code_context>

<deferred>
## Deferred Ideas

- Spelers en ouders automatisch verwittigen — Out of Scope, de app verstuurt niets.
- Automatisch toewijzen zonder bevestiging — Out of Scope.
- Een trainer die zichzelf ziek meldt — v2 (ZIEK-01).
- Inhaallessen voor een afgezegde speler — v2 (INHAAL-01).

</deferred>

---

*Phase: 03-ziekmelding-en-vervangerswerklijst*
*Context gathered: 2026-09-05*
