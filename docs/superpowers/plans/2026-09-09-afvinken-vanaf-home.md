# Afvinken vanaf Home — implementatieplan

> **Voor wie dit uitvoert:** VERPLICHTE SUB-SKILL: gebruik `superpowers:subagent-driven-development` (aanbevolen) of `superpowers:executing-plans` om dit plan taak voor taak uit te voeren. De stappen gebruiken vinkvakjes (`- [ ]`).

**Doel:** Een trainer vinkt zijn groep af vanaf het hoofdscherm, met één tik per afwezig kind in plaats van drie, en legt de les vast met één knop Klaar.

**Aanpak:** Het afvinkscherm blijft een apart, kaal scherm zonder menu- en tabbalk (de gsm gaat rond in de groep); alleen de ingang verhuist van de Agenda naar Home. De drie standen in de databank blijven bestaan — het scherm toont "niets genoteerd" voortaan als aanwezig, en de Klaar-knop schrijft dat echt weg. Alle nieuwe logica is puur en komt in `lib/aanwezigheid.ts`, waar tests bij kunnen.

**Techniek:** Expo Router, React Native Web, TypeScript, Jest. Geen nieuwe afhankelijkheden.

**Spec:** `docs/superpowers/specs/2026-09-09-afvinken-vanaf-home-design.md`

---

## Bestandsindeling

| Bestand | Verantwoordelijk voor |
|---|---|
| `lib/aanwezigheid.ts` | De pure regels: hoe een opgeslagen stand op het scherm leest, wat de volgende tik doet, en wat "Klaar" wegschrijft. Alles wat te testen valt hoort hier. |
| `lib/aanwezigheid.test.ts` | De tests daarvan. |
| `providers/SimpleDataProvider.tsx` | Eén nieuwe actie `bevestigLes(bookingId)`, gebouwd als tweelingbroer van het bestaande `setAanwezigheid` (regel 955). Ze roept de pure `bevestigAanwezigheid` uit `lib/` aan; de namen verschillen met opzet, zodat uit de aanroep blijkt of je de regel of de schrijfactie voor je hebt. |
| `app/afvinken.tsx` | Het afvinkscherm, verhuisd van `app/agenda/afvinken.tsx`. Leest `?lesId=`, toont iedereen als aanwezig, en heeft de Klaar-knop. |
| `app/_layout.tsx` | Route-registratie, de `HEADLESS`-lijst en de `showMenu`-test noemen de nieuwe route. |
| `components/lesdag/Lesdag.tsx` | Een knop **Afvinken** in de opengeklapte les. |
| `app/agenda/index.tsx` | De bestaande tegel Afvinken wijst naar de nieuwe route. |

**Waarom een knop in de opengeklapte les en geen tik op de les zelf.** De spec zei "een les aantikken opent het afvinkscherm". Bij het uitwerken bleek dat niet te kunnen: de opengeklapte les is de énige plek in de hele app waar een trainer een spraakmemo kan opnemen (`components/lesdag/Lesdag.tsx:103`, `MemoKnop` komt nergens anders voor). Zou de tik wegnavigeren, dan is die knop onbereikbaar. De les klapt dus open zoals nu, en onderin staat Afvinken.

---

## Taak 1: `getoondeStand` — wat het scherm laat zien

**Bestanden:**
- Wijzigen: `lib/aanwezigheid.ts`
- Test: `lib/aanwezigheid.test.ts`

- [ ] **Stap 1: Schrijf de falende test**

Voeg onderaan `lib/aanwezigheid.test.ts` toe:

```ts
describe('getoondeStand', () => {
  it('leest niets genoteerd als aanwezig', () => {
    expect(getoondeStand(null)).toBe('aanwezig');
  });

  it('laat een echte stand zichzelf blijven', () => {
    expect(getoondeStand('aanwezig')).toBe('aanwezig');
    expect(getoondeStand('afwezig')).toBe('afwezig');
  });
});
```

En vul de importregel bovenaan (regel 2) aan met `getoondeStand`:

```ts
  aanwezigheidVan, zetAanwezigheid, aanwezigheidTelling, aanwezigheidRegel, volgendeStand, magAanwezigheidZetten,
  getoondeStand, bevestigAanwezigheid,
} from './aanwezigheid';
```

- [ ] **Stap 2: Draai de test en zie hem falen**

Draai: `npm test -- --ci lib/aanwezigheid.test.ts`
Verwacht: FAIL, met een TypeScript-fout dat `getoondeStand` en `bevestigAanwezigheid` niet bestaan.

- [ ] **Stap 3: Schrijf de code**

Voeg toe in `lib/aanwezigheid.ts`, direct ná `aanwezigheidVan` (dus na regel 42):

```ts
/**
 * Wat het afvinkscherm toont voor deze stand.
 *
 * Niets genoteerd leest als aanwezig, want dat is wat er in de praktijk aan de hand is: op
 * een handvol uitzonderingen na staat iedereen er. De trainer tikt dus alleen de afwezigen
 * aan in plaats van elk kind los te bevestigen.
 *
 * Deze vertaling valt op één plek. Zou elk scherm zelf `?? 'aanwezig'` schrijven, dan gaat
 * de telling (`aanwezigheidTelling`) er vroeg of laat anders over denken dan de namenlijst,
 * en dan klopt de regel "3 van 4 aanwezig" niet meer met wat eronder staat.
 *
 * Let op wat dit NIET doet: het schrijft niets weg. In de databank blijft "niets genoteerd"
 * gewoon leeg staan tot de trainer op Klaar tikt — zie `bevestigAanwezigheid`.
 */
export function getoondeStand(huidig: Aanwezigheid | null): Aanwezigheid {
  return huidig ?? 'aanwezig';
}
```

- [ ] **Stap 4: Draai de test opnieuw**

Draai: `npm test -- --ci lib/aanwezigheid.test.ts`
Verwacht: de twee `getoondeStand`-tests slagen. De rest van het bestand faalt nog op de
ontbrekende `bevestigAanwezigheid` — dat is taak 3.

- [ ] **Stap 5: Nog niet committen.** Taak 2 en 3 horen in dezelfde commit: samen vormen ze
het nieuwe model, en los committen laat de testsuite tussendoor rood staan.

---

## Taak 2: `volgendeStand` wordt een schakelaar

**Bestanden:**
- Wijzigen: `lib/aanwezigheid.ts:104-116`
- Test: `lib/aanwezigheid.test.ts:92-103`

- [ ] **Stap 1: Vervang de bestaande test**

Het `describe('volgendeStand', …)`-blok op regel 92-103 beschrijft de oude cyclus van drie.
Vervang het hele blok door:

```ts
describe('volgendeStand', () => {
  it('schakelt heen en weer tussen aanwezig en afwezig', () => {
    expect(volgendeStand('aanwezig')).toBe('afwezig');
    expect(volgendeStand('afwezig')).toBe('aanwezig');
  });

  it('vertrekt vanuit aanwezig als er nog niets genoteerd staat', () => {
    // Het scherm toont zo iemand als aanwezig, dus de tik moet hem op afwezig zetten.
    expect(volgendeStand(null)).toBe('afwezig');
  });

  it('komt nooit meer op niets genoteerd uit', () => {
    // De weg terug naar "leeg" is met opzet uit het scherm gehaald; hij bestaat nog wel
    // via zetAanwezigheid(b, id, null), waar het detailblad van de les gebruik van maakt.
    for (const stand of [null, 'aanwezig', 'afwezig'] as const) {
      expect(volgendeStand(stand)).not.toBeNull();
    }
  });

  it('laat de weg terug naar leeg bestaan buiten het scherm om', () => {
    const b = { ...base, attendance: { p1: 'aanwezig' as const } };
    expect(zetAanwezigheid(b, 'p1', null).attendance).toEqual({});
  });
});
```

- [ ] **Stap 2: Draai de test en zie hem falen**

Draai: `npm test -- --ci lib/aanwezigheid.test.ts -t volgendeStand`
Verwacht: FAIL — `volgendeStand(null)` geeft nu `'aanwezig'` waar `'afwezig'` verwacht wordt,
en `volgendeStand('afwezig')` geeft `null`.

- [ ] **Stap 3: Schrijf de code**

Vervang in `lib/aanwezigheid.ts` de hele functie `volgendeStand` (regel 104-116, inclusief
het commentaarblok erboven) door:

```ts
/**
 * De volgende stand op het afvinkscherm: aanwezig ⇄ afwezig.
 *
 * Was een rondje van drie (leeg → aanwezig → afwezig → leeg), zodat een kind dat zijn eigen
 * naam aantikte zich kon herstellen door door te tikken. Dat rondje kostte een trainer drie
 * tikken per kind om bij "afwezig" te komen, terwijl hij er per les hooguit één of twee
 * nodig heeft: de rest staat er gewoon.
 *
 * Nu vertrekt alles vanuit aanwezig (zie `getoondeStand`) en zet één tik iemand op afwezig,
 * de volgende weer terug. Herstellen kan dus nog steeds door door te tikken.
 *
 * De weg terug naar "niets genoteerd" is uit het scherm verdwenen maar niet uit de app:
 * `zetAanwezigheid(b, id, null)` doet het nog, en het detailblad van een les gebruikt dat.
 */
export function volgendeStand(huidig: Aanwezigheid | null): Aanwezigheid {
  return getoondeStand(huidig) === 'aanwezig' ? 'afwezig' : 'aanwezig';
}
```

Let op het gewijzigde retourtype: `Aanwezigheid` in plaats van `Aanwezigheid | null`.

- [ ] **Stap 4: Draai de test opnieuw**

Draai: `npm test -- --ci lib/aanwezigheid.test.ts -t volgendeStand`
Verwacht: alle vier de tests slagen.

- [ ] **Stap 5: Nog niet committen** — taak 3 hoort erbij.

---

## Taak 3: `bevestigAanwezigheid` — wat de Klaar-knop wegschrijft

**Bestanden:**
- Wijzigen: `lib/aanwezigheid.ts`
- Test: `lib/aanwezigheid.test.ts`

- [ ] **Stap 1: Schrijf de falende test**

Voeg onderaan `lib/aanwezigheid.test.ts` toe:

```ts
describe('bevestigAanwezigheid', () => {
  const groep = {
    ...base,
    participant_ids: ['p1', 'p2', 'p3'],
  };

  it('zet iedereen zonder aantekening op aanwezig', () => {
    expect(bevestigAanwezigheid(groep).attendance).toEqual({
      p1: 'aanwezig', p2: 'aanwezig', p3: 'aanwezig',
    });
  });

  it('laat een afwezige met rust', () => {
    const b = { ...groep, attendance: { p2: 'afwezig' as const } };
    expect(bevestigAanwezigheid(b).attendance).toEqual({
      p1: 'aanwezig', p2: 'afwezig', p3: 'aanwezig',
    });
  });

  it('gooit de aantekening weg van wie niet meer meespeelt', () => {
    // Dezelfde opruiming als zetAanwezigheid: een speler die de trainer uit de les haalde,
    // laat anders een aantekening achter die nergens op het scherm komt maar wel meetelt.
    const b = { ...groep, attendance: { weg: 'afwezig' as const } };
    expect(bevestigAanwezigheid(b).attendance).toEqual({
      p1: 'aanwezig', p2: 'aanwezig', p3: 'aanwezig',
    });
  });

  it('maakt de telling compleet: niets staat meer open', () => {
    const bevestigd = { ...groep, ...bevestigAanwezigheid(groep) };
    expect(aanwezigheidTelling(bevestigd)).toEqual({ aanwezig: 3, afwezig: 0, open: 0 });
  });

  it('verandert niets meer als je twee keer bevestigt', () => {
    const eenmaal = { ...groep, ...bevestigAanwezigheid(groep) };
    expect(bevestigAanwezigheid(eenmaal).attendance).toEqual(eenmaal.attendance);
  });
});
```

- [ ] **Stap 2: Draai de test en zie hem falen**

Draai: `npm test -- --ci lib/aanwezigheid.test.ts -t bevestigAanwezigheid`
Verwacht: FAIL — `bevestigAanwezigheid is not a function`.

- [ ] **Stap 3: Schrijf de code**

Voeg toe in `lib/aanwezigheid.ts`, direct ná `zetAanwezigheid` (dus na regel 70):

```ts
/**
 * De les afsluiten: wie nog geen aantekening heeft, was er.
 *
 * Dit is wat de Klaar-knop op het afvinkscherm wegschrijft, en het is het moment waarop
 * "niemand heeft hiernaar gekeken" verandert in "de trainer heeft dit gezien". Dat verschil
 * moet blijven bestaan — een les van volgende maand staat anders nu al op "iedereen
 * aanwezig", en het uitprintbare blad voor invaltrainers (`bladAanwezigheid` in
 * lib/export-trainingen) laat een vakje leeg juist om te zeggen dat er niet gekeken is.
 *
 * Bestaande aantekeningen blijven staan: de afwezigen die de trainer net aantikte, zijn
 * precies waarvoor hij het scherm opende.
 *
 * Wie niet meer meespeelt gaat eruit, om dezelfde reden als bij `zetAanwezigheid`.
 */
export function bevestigAanwezigheid(b: AanwezigheidBooking): { attendance: Aanwezigheden } {
  const uit: Aanwezigheden = {};
  for (const id of lessonPlayerIds(b)) {
    const bestaand = b.attendance?.[id];
    uit[id] = bestaand === 'afwezig' ? 'afwezig' : 'aanwezig';
  }
  return { attendance: uit };
}
```

- [ ] **Stap 4: Draai de hele testsuite**

Draai: `npx tsc --noEmit && npm test -- --ci`
Verwacht: `tsc` geeft niets, en alle tests slagen. Faalt er iets in
`lib/export-trainingen.test.ts`, stop dan en meld het: dat is het exportblad waarvan de lege
vakjes bewaakt moeten blijven, en dat mag dit plan niet stilzwijgend veranderen.

- [ ] **Stap 5: Commit**

```bash
git add lib/aanwezigheid.ts lib/aanwezigheid.test.ts
git commit -m "feat(aanwezigheid): standaard aanwezig, en een les afsluiten met Klaar"
```

---

## Taak 4: De provider kan een les bevestigen

**Bestanden:**
- Wijzigen: `providers/SimpleDataProvider.tsx` (type rond regel 130, implementatie rond regel 955, en de `value`-lijst rond regel 1564)

Deze taak heeft geen test: `providers/` heeft er geen enkele, en het rekenwerk zit al getest
in taak 3. De provider doet hier niets anders dan de rechtencontrole en het wegschrijven.

- [ ] **Stap 1: Voeg het type toe**

In de `DataShape`-interface, direct ná `setAanwezigheid` (regel 130-134):

```ts
  /**
   * De hele les afvinken in één keer: wie geen aantekening heeft, was er. Dit is de
   * Klaar-knop van het afvinkscherm. Alleen de trainer van de les en de beheerder — een
   * speler mag zichzelf afmelden, niet de hele groep aanwezig verklaren.
   */
  bevestigLes: (bookingId: string) => Promise<void>;
```

- [ ] **Stap 2: Voeg de implementatie toe**

Direct ná `setAanwezigheid` (dus na regel 976):

```ts
  const bevestigLes = useCallback(async (bookingId: string) => {
    const store = storeRef.current;
    if (!store || !currentUserId) return;
    const booking = store.bookings.find((b) => b.id === bookingId);
    if (!booking) return;
    // Strenger dan `setAanwezigheid`: dáár mag een speler zichzelf zetten, hier gaat het
    // over de hele groep. Dat is het oordeel van wie er stond, en dat is de trainer.
    const kijker = store.users.find((u) => u.id === currentUserId);
    const magHet = kijker?.is_admin === true || booking.coach_id === currentUserId;
    if (!magHet) return;
    const patch = bevestigAanwezigheid(booking);
    await commit({
      ...store,
      bookings: store.bookings.map((b) => (b.id === bookingId ? { ...b, ...patch } : b)),
    });
  }, [commit, currentUserId]);
```

- [ ] **Stap 3: Vul de import aan**

Zoek de regel die uit `../lib/aanwezigheid` importeert en voeg `bevestigAanwezigheid` toe
aan de bestaande lijst.

- [ ] **Stap 4: Zet hem in de context**

Zoek in de `value`-`useMemo` de regel `setAanwezigheid,` en zet er `bevestigLes,` onder.
Voeg `bevestigLes` ook toe aan de afhankelijkhedenlijst van diezelfde `useMemo`, naast
`setAanwezigheid`.

- [ ] **Stap 5: Controleer**

Draai: `npx tsc --noEmit && npm test -- --ci`
Verwacht: geen fouten, 1757+ tests slagen.

- [ ] **Stap 6: Commit**

```bash
git add providers/SimpleDataProvider.tsx
git commit -m "feat(aanwezigheid): de provider kan een hele les bevestigen"
```

---

## Taak 5: Het afvinkscherm verhuist naar `/afvinken`

**Bestanden:**
- Verplaatsen: `app/agenda/afvinken.tsx` → `app/afvinken.tsx`
- Wijzigen: `app/_layout.tsx:48` (`HEADLESS`), de `screens`-lijst, en de `showMenu`-test
- Wijzigen: `app/agenda/index.tsx:96`

- [ ] **Stap 1: Verplaats het bestand met git**

```bash
git mv app/agenda/afvinken.tsx app/afvinken.tsx
```

- [ ] **Stap 2: Herstel de importpaden**

Alles in `app/afvinken.tsx` dat begon met `'../../'` wordt `'../'`. Draai daarna
`npx tsc --noEmit` en verbeter wat hij aanwijst; er blijft niets anders over dan die paden.

- [ ] **Stap 3: Pas de terugweg aan**

In `app/afvinken.tsx` staat twee keer `router.replace('/agenda')` (regel 92 en 106 in het
oude bestand). Vervang allebei door `router.replace('/')`, en de knoptekst
`'Terug naar de agenda'` door `'Terug naar het begin'`.

- [ ] **Stap 4: Pas `app/_layout.tsx` aan — drie plekken**

In de `HEADLESS`-verzameling, vervang `'agenda/afvinken'` door `'afvinken'` en laat het
commentaar erboven staan; het klopt nog steeds.

In de `screens`-lijst, vervang de regel met `{ name: 'agenda/afvinken', title: t('Afvinken') }`
door `{ name: 'afvinken', title: t('Afvinken') }`.

In de `showMenu`-berekening, vervang `route !== 'agenda/afvinken'` door `route !== 'afvinken'`.

- [ ] **Stap 5: Pas de oude tegel aan**

In `app/agenda/index.tsx:96`, vervang `router.push('/agenda/afvinken')` door
`router.push('/afvinken')`.

- [ ] **Stap 6: Controleer**

Draai: `npx tsc --noEmit && npm test -- --ci && npx expo export -p web`
Verwacht: geen fouten, en een geslaagde build. De export is hier belangrijk: een route die
Expo Router niet kan vinden, valt pas bij het bouwen op.

- [ ] **Stap 7: Commit**

```bash
git add -A
git commit -m "refactor(afvinken): het scherm verhuist van de agenda naar /afvinken"
```

---

## Taak 6: Het scherm opent op de les die je aantikte

**Bestanden:**
- Wijzigen: `app/afvinken.tsx`

- [ ] **Stap 1: Lees de parameter uit**

Bovenaan de component, naast de bestaande hooks:

```ts
  // Welke les er afgevinkt wordt. Komt mee vanaf Home; zonder parameter kiest het scherm
  // zelf de les die nu bezig is, zoals het altijd deed.
  const { lesId } = useLocalSearchParams<{ lesId?: string }>();
```

Voeg `useLocalSearchParams` toe aan de bestaande `expo-router`-import.

- [ ] **Stap 2: Laat de parameter de eerste keuze zijn**

Vervang de berekening van `les` (in het oude bestand regel 71-73):

```ts
  const les = lessen.find((b) => b.id === gekozen)
    ?? komend.find((b) => b.id === gekozen)
    ?? lessen[0] ?? null;
```

door:

```ts
  // `gekozen` eerst: tikt de trainer boven op een andere les, dan wint dat van waar hij
  // vandaan kwam. Daarna `lesId` — de les die hij op Home aantikte. En pas als die twee
  // allebei niets opleveren, de oude automatische keuze: de les die nu bezig is.
  const gevraagd = gekozen ?? lesId ?? null;
  const les = lessen.find((b) => b.id === gevraagd)
    ?? komend.find((b) => b.id === gevraagd)
    ?? lessen[0] ?? null;
```

- [ ] **Stap 3: Controleer**

Draai: `npx tsc --noEmit`
Verwacht: geen fouten.

- [ ] **Stap 4: Commit**

```bash
git add app/afvinken.tsx
git commit -m "feat(afvinken): het scherm opent op de les die je aantikte"
```

---

## Taak 7: Iedereen staat op aanwezig, en Klaar legt het vast

**Bestanden:**
- Wijzigen: `app/afvinken.tsx`

- [ ] **Stap 1: Toon de stand via `getoondeStand`**

In de namenlijst staat `const stand = aanwezigheidVan(les, id);`. Vervang die regel door:

```ts
            const stand = getoondeStand(aanwezigheidVan(les, id));
```

Vul de import uit `../lib/aanwezigheid` aan met `getoondeStand`. De tik eronder
(`setAanwezigheid(les.id, id, volgendeStand(stand))`) blijft ongewijzigd en werkt nu als
schakelaar.

`stand` kan hierdoor nooit meer `null` zijn. Twee gevolgen in dezelfde `map`, allebei in
de `style`- en `Text`-regels van de `Pressable`: `stand ? styles.naamOpVulling : null` mag
`styles.naamOpVulling` worden, want er is altijd een vulling. Doe dat op beide plekken
(de `Text` met de naam en de `Text` met het standlabel).

En de drie helpers onderaan het bestand (regel 268-284) verliezen hun derde tak. Vervang
ze door:

```tsx
function standLabel(stand: Aanwezigheid, t: (nl: string) => string): string {
  return stand === 'aanwezig' ? t('Aanwezig') : t('Afwezig');
}

function standIcoon(stand: Aanwezigheid): React.JSX.Element {
  return stand === 'aanwezig'
    ? <Check size={28} color={tennisColors.onFill} />
    : <X size={28} color={tennisColors.onFill} />;
}

function standStijl(stand: Aanwezigheid): object {
  return stand === 'aanwezig' ? styles.rijAanwezig : styles.rijAfwezig;
}
```

`Circle` uit `lucide-react-native` en de stijl `rijLeeg` worden hierdoor ongebruikt. Haal
allebei weg — `tsc` wijst de import aan, `rijLeeg` moet je zelf uit het `StyleSheet` halen.
De tekst `'Nog niet afgevinkt'` blijft wél in `lib/i18n-en.ts` staan: `aanwezigheidRegel`
gebruikt hem nog voor een les die niemand opende.

- [ ] **Stap 2: Voeg de Klaar-knop toe**

Onderaan het scherm, ná de namenlijst en vóór de foutmelding:

```tsx
      {/* Dit is de handeling, niet een sierknop: pas hier wordt "niemand heeft gekeken"
          een echte aanwezigheid. Wie het scherm sluit zonder te tikken, legt niets vast —
          openklappen is geen controleren. Vandaar de zin eronder. */}
      <Button
        label={t('Klaar')}
        variant="primary"
        onPress={() => { void bevestigen(); }}
        style={styles.klaar}
      />
      <Text style={styles.klaarUitleg}>
        {t('Iedereen die je niet aantikte, staat dan op aanwezig.')}
      </Text>
```

Met daarboven, bij de andere handelingen in de component:

```ts
  const bevestigen = async (): Promise<void> => {
    if (!les) return;
    await bevestigLes(les.id);
    router.replace('/');
  };
```

Haal `bevestigLes` uit `useSimpleData()` naast het bestaande `setAanwezigheid`, en importeer
`Button` uit `../components/ui/Button` als dat er nog niet staat.

- [ ] **Stap 3: Voeg de twee stijlen toe**

In het `StyleSheet.create`-blok onderaan:

```ts
  klaar: { marginTop: spacing.lg },
  klaarUitleg: { fontSize: 13, color: tennisColors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
```

- [ ] **Stap 4: Zet de twee zinnen in het Engels**

In `lib/i18n-en.ts`, op alfabetische plek tussen de bestaande regels:

```ts
  'Klaar': 'Done',
  'Iedereen die je niet aantikte, staat dan op aanwezig.': 'Everyone you did not tap will be marked present.',
  'Terug naar het begin': 'Back to the start',
```

- [ ] **Stap 5: Controleer**

Draai: `npx tsc --noEmit && npm test -- --ci`
Verwacht: geen fouten, alle tests slagen.

- [ ] **Stap 6: Commit**

```bash
git add app/afvinken.tsx lib/i18n-en.ts
git commit -m "feat(afvinken): standaard aanwezig, en Klaar legt de les vast"
```

---

## Taak 8: De ingang op Home

**Bestanden:**
- Wijzigen: `components/lesdag/Lesdag.tsx:96-117`

- [ ] **Stap 1: Voeg de knop toe onder de namenlijst**

In het `{open ? (…) : null}`-blok, ná de `map` over `uur.playerIds` en nog binnen dezelfde
`View`:

```tsx
                <Pressable
                  onPress={() => router.push(`/afvinken?lesId=${uur.booking.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={t('Deze les afvinken')}
                  style={[styles.afvinken, webCursor]}
                >
                  <Text style={styles.afvinkenTekst}>{t('Afvinken')}</Text>
                  <ChevronRight size={18} color={tennisColors.primary} />
                </Pressable>
```

`router`, `ChevronRight` en `webCursor` zijn al geïmporteerd in dit bestand.

- [ ] **Stap 2: Voeg de stijlen toe**

```ts
  afvinken: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: spacing.sm, marginTop: spacing.xs,
  },
  afvinkenTekst: { fontSize: 14, fontWeight: '700', color: tennisColors.primary },
```

- [ ] **Stap 3: Zet het woord in het Engels**

In `lib/i18n-en.ts`: `'Deze les afvinken': 'Check off this lesson',`
(`'Afvinken'` staat er al, want de tegel op de Agenda gebruikt hem.)

- [ ] **Stap 4: Controleer**

Draai: `npx tsc --noEmit && npm test -- --ci && npx expo export -p web`
Verwacht: geen fouten, geslaagde build.

- [ ] **Stap 5: Commit**

```bash
git add components/lesdag/Lesdag.tsx lib/i18n-en.ts
git commit -m "feat(home): afvinken begint bij de lessen van vandaag"
```

---

## Taak 9: Met de hand nakijken op de echte site

Schermtests bestaan niet in dit project, dus dit is de enige controle op het scherm zelf.
Dit moet de gebruiker doen: het vraagt een trainersaccount met een les van vandaag.

- [ ] **Stap 1: Zet het online**

```bash
git push origin main
gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId') --exit-status
```

- [ ] **Stap 2: Loop dit na op de site**

1. Log in als trainer. Op Home staat een les van vandaag.
2. Tik de les open → de namen verschijnen, elk met de memoknop, en onderaan **Afvinken**.
3. Tik Afvinken → het kale scherm opent, op déze les, zonder menu- en tabbalk.
4. Alle namen staan op **aanwezig**.
5. Tik één kind aan → het staat op afwezig. Tik nog eens → weer aanwezig. Laat er één op afwezig staan.
6. Tik **Klaar** → je komt terug op Home.
7. Open de les opnieuw via Afvinken: het aangetikte kind staat nog op afwezig, de rest op aanwezig.

- [ ] **Stap 3: Controleer wat er echt in de databank staat**

In de SQL-editor van Supabase, met het id van de les uit stap 2:

```sql
select id, start_time, attendance
from bookings
where id = '<id-van-de-les>';
```

Verwacht: een `attendance` met een regel per deelnemer, één op `afwezig` en de rest op
`aanwezig`. Verwacht **niet** dat lessen die je niet hebt afgevinkt ineens gevuld zijn:

```sql
select count(*) from bookings where attendance is not null;
```

Dit getal hoort alleen te groeien met de lessen die je zelf met Klaar afsloot.

---

## Wat de code-review erbij bracht

Tijdens de uitvoering vond de kwaliteitscontrole drie dingen die in dit plan ontbraken. Ze
zijn uitgevoerd in commit `c4520ca`; ze staan hier zodat het plan klopt met wat er gebouwd is.

**Een vierde functie: `magLesBevestigen(booking, now)`.** De Klaar-knop had geen datumgrens.
Het afvinkscherm toont met opzet ook lessen die nog moeten komen (het blok "Hierna", om
alvast iemand af te melden), en zonder grens kon een trainer daar op Klaar tikken. Dan is
"hier heeft niemand naar gekeken" voor die hele groep weg terwijl de les nog niet gebeurd
is — precies wat het driestandenmodel moet voorkomen, en vanaf dat scherm niet meer terug
te draaien. `magAanwezigheidZetten` had die grens al; `bevestigLes` erfde hem niet.

Deze regel staat **alleen in de app** en heeft geen tegenhanger in `supabase-schema.sql`.
Dat is een bewuste uitzondering op de huisregel in `lib/rechten.ts`. De databank laat de
trainer van de les alles schrijven (regel 978: `if is_admin() or old.coach_id = app_user_id()
then return new`), en dat hoort ook: dit is geen beveiligingsregel maar een zinnigheidsregel.
De trainer mág het, we beletten alleen een handeling die niets betekent.

**De uitlegzin op het scherm.** Er stond "Tik op je naam: één keer voor aanwezig, nog eens
voor afwezig, nog eens om hem leeg te maken" — een belofte die na taak 2 niet meer klopt.
Taak 7 vervangt hem door "Iedereen staat op aanwezig. Tik alleen wie er niet is; nog een tik
zet hem terug."

**`bevestigAanwezigheid` schreef een regel twee keer uit.** Het stond er als
`bestaand === 'afwezig' ? 'afwezig' : 'aanwezig'`, wat opnieuw codeert dat leeg als aanwezig
leest — terwijl de docstring van `getoondeStand` vier regels lang uitlegt waarom die regel op
één plek hoort. Nu `uit[id] = getoondeStand(aanwezigheidVan(b, id))`. Alle vijf bestaande
tests bleven ongewijzigd slagen, wat bewijst dat de vervanging equivalent was.

Daarnaast is één commentaarregel rechtgezet die naar de verkeerde functie verwees: het
detailblad van een les wist een aantekening niet door `null` door te geven, maar door
opnieuw op de al gekozen stand te tikken (`uit[playerId] === waarde`).

## Wat dit plan bewust niet doet

- **De Agenda-tab blijft staan**, inclusief de tegel Afvinken die nu naar `/afvinken` wijst.
  Opheffen is stuk 4 en kan pas als goedkeuren, nieuwe afspraak en betalingen een huis hebben.
- **De historiek van aanwezigheid in het spelersdossier** is stuk 2.
- **Het detailblad van een les** (`components/BookingDetailSheet.tsx:613`) houdt zijn eigen
  aanwezigheidsknoppen met alle drie de standen. Dat is met opzet de plek waar een
  aantekening teruggezet kan worden naar "niet gekeken".
