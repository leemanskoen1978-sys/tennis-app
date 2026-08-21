# De lesdag, en de spraakmemo op de baan

22 augustus 2026.

## Wat dit oplost

De app is compleet genoeg om een club mee te draaien, maar er is één moment waarop een
trainer hem vandaag niet openslaat: tijdens de les. En dat is nu juist het moment waarop
hij iets over een speler te zeggen heeft.

Wat er nu voor nodig is om dat vast te leggen: het startscherm openen, naar Agenda of
Spelers, de speler opzoeken, het voortgangsblad openen, een soort training kiezen, sterren
geven, typen. Zeven handelingen met twee handen, terwijl er vier kinderen op de baan staan
te wachten. Dat gebeurt dus niet tijdens de les — en na de les is het al de helft vergeten.

Twee dingen moeten daarvoor veranderen:

1. **De app moet openen op de dag zelf.** Wat een trainer om vijf voor vijf wil zien, is de
   les van vijf uur en wie daarin staat. Niet een keuzemenu.
2. **Een notitie moet in twee tikken kunnen.** Typen is op een baan te traag. Praten niet.

De keuze die daaruit volgt en die dit hele ontwerp draagt: **op de baan neem je een
spraakmemo op, en die werk je later uit tot een echte notitie.** Ruw materiaal eerst,
dossier daarna.

## Wat er al staat

Dit ontwerp bouwt bijna alles op bestaande onderdelen:

- `components/VoiceRecorder.tsx` neemt op de website al geluid op via `MediaRecorder` en
  levert een data-URL op. Op een telefoon-app is het nog een plaatshouder; zie
  `docs/voice-memo-native.md`.
- `StudentProgress.voice_memo_uri` bewaart zo'n data-URL al, en `ProgressForm` speelt hem af.
- `lib/hub.ts` weet wat "valt op deze dag" betekent (`bookingsOnDay`) — één definitie die
  het startscherm en de agenda allebei al gebruiken.
- `lib/groups.ts` weet wie er in een les staat (`lessonPlayerIds`), betaler en meespelers.
- `providers/SimpleDataProvider.tsx` heeft met `commit` één plek waar elke wijziging
  langsgaat, en `saveToSupabase` schrijft alleen de rijen die veranderd zijn.

Wat er níét al staat, en dus nieuw is: het begrip **memo**.

## Het begrip

Een **memo** is een opname over één speler, gemaakt tijdens een les. Hij heeft een speler,
een trainer, de les waarin hij is opgenomen, de audio, hoe lang die duurt, en wanneer hij
gemaakt is. Meer niet.

Een memo is **geen voortgangsnotitie** en telt nergens als notitie mee — niet in
`noteCountLabel`, niet in het dossier, niet in de rapporten. Hij bestaat om uitgewerkt te
worden, en verdwijnt op het moment dat dat gebeurt.

Dat is met opzet de belangrijkste eigenschap van dit ontwerp. Omdat een memo tijdelijk is,
blijft de voorraad audio klein, en daarom mag de audio gewoon in de opslag staan zoals dat
vandaag met `voice_memo_uri` ook al gebeurt. Was een memo blijvend, dan zou dat niet meer
kunnen en was er een aparte bestandsopslag nodig.

## De keuze die is afgewogen

Drie wegen lagen open voor de vraag *waar landt de audio*:

| Weg | Waarom niet |
| --- | --- |
| Audio in Supabase Storage, de rij houdt alleen een pad | Schaalt oneindig, maar is een tweede opslagweg náást de bestaande. Werkt niet in de lokale modus, en een bestandsupload past niet in dezelfde wachtrij als een rij-wijziging — dat breekt het offline-werk dat hierna komt. |
| Een voortgangsnotitie met een vlag `concept` | Geen nieuwe tabel, maar élke plek die notities telt of toont moet voortaan concepten wegfilteren. Dat is precies het soort keuze dat op vijf schermen vijf antwoorden krijgt. |
| **Eigen tabel, audio als data-URL in de rij** | **Gekozen.** Eén opslagweg, past in de bestaande diff-opslag, werkt ook lokaal zonder Supabase, en de uitwerklijst houdt de voorraad vanzelf klein. |

## Het datamodel

Eén nieuw type in `lib/types.ts`:

```ts
export interface Memo {
  id: string;
  student_id: string;
  coach_id: string;
  /** De les waarin hij is opgenomen. Leeg kan: een memo buiten een les om. */
  booking_id?: string;
  /** De opname zelf: een data-URL, net als `StudentProgress.voice_memo_uri`. */
  audio_uri: string;
  duration_ms: number;
  created_at: string; // ISO
}
```

`booking_id` is optioneel en verwijst naar een `Booking`, niet naar een `Lesson`. Dat is een
ander soort les dan `StudentProgress.lesson_id`, dat naar het lesmateriaal wijst — twee
verschillende vragen, dus twee velden. Wordt de les verwijderd, dan blijft de memo bestaan
met een leeg `booking_id`: wat er gezegd is over een speler, hoort niet te verdwijnen omdat
een boeking geschrapt wordt.

### Schema

`supabase-schema.sql` krijgt de tabel `memos`, met dezelfde strikte RLS als de rest:

- Een trainer ziet, maakt en verwijdert alleen zijn eigen memo's (`coach_id = app_user_id()`).
- Een speler ziet zijn memo's **niet**. Een memo is ruw materiaal, geen mededeling; wat een
  speler te zien krijgt is de notitie die eruit voortkomt.
- `on delete set null` op `booking_id`, `on delete cascade` op `student_id` en `coach_id` —
  dezelfde regels als de bestaande tabellen.

`providers/supabaseStore.ts` krijgt `memos` in `TABLES` en in de diff, zodat een memo langs
dezelfde weg wordt weggeschreven als al het andere.

## Het rekenwerk

Twee nieuwe bestanden in `lib/`, allebei zonder React en allebei met tests ernaast. De
schermen blijven dun; alles wat te beslissen valt, valt hier te beslissen.

### `lib/lesdag.ts`

Wat het startscherm tekent, uitgerekend uit de boekingen.

```ts
/** Eén les van vandaag, met de spelers die erin staan. */
export interface Lesuur {
  booking: Booking;
  /** De spelers, betaler voorop — de namen worden op het scherm opgezocht. */
  playerIds: string[];
  /** Is deze les nu bezig? Hoogstens één les kan dit zijn. */
  loopt: boolean;
  /** Is hij al voorbij? Dan staat hij grijs. */
  voorbij: boolean;
  /**
   * De les die het scherm opengeklapt toont. Precies één les in de dag heeft dit, zolang
   * er lessen zijn — anders zou een trainer op een baan eerst moeten tikken voor hij iets
   * ziet. Welke dat is, staat hieronder.
   */
  open: boolean;
}

/** De lesdag van één trainer: zijn lessen van vandaag, op tijd oplopend. */
export function lesdagVan(bookings: Booking[], coachId: string, now: Date): Lesuur[];
```

Regels die hier vastliggen, en nergens anders:

- Alleen de lessen van **deze** trainer, alleen van **vandaag** (`bookingsOnDay`, dus
  dezelfde definitie van "deze dag" als de rest van de app), geannuleerde niet.
- "Loopt" betekent: `start_time <= now < end_time`.
- "Voorbij" betekent `end_time <= now`. Voorbije lessen blijven staan: je maakt weleens een
  memo na afloop.
- Welke les opengeklapt staat, in deze volgorde: de lopende les; is er geen, de
  eerstvolgende — om kwart voor vijf wil je de les van vijf uur zien; is die er ook niet
  (de dag zit erop), dan de laatste les van de dag, want dáár gaat een memo achteraf over.
  Zijn er geen lessen, dan is er niets om open te klappen.

### `lib/memo.ts`

Wat een memo is en wat ermee gebeurt.

```ts
/** Korter dan dit is een misgreep, langer dan dit kapt de knop af. */
export const MIN_MEMO_MS = 1000;
export const MAX_MEMO_MS = 60_000;

/** Is deze opname het bewaren waard? */
export function opnameDeugt(durationMs: number): boolean;

/** De memo's die nog uitgewerkt moeten worden: oudste eerst. */
export function uitTeWerken(memos: Memo[], coachId: string): Memo[];

/** Heeft deze speler vandaag al een memo in deze les? Voor het vinkje op de baan. */
export function heeftMemo(memos: Memo[], bookingId: string, studentId: string): boolean;

/** Hoe lang hij duurt, in woorden: "0:08". */
export function memoDuur(durationMs: number): string;

/** De velden die een memo meegeeft aan de notitie die eruit voortkomt. */
export function memoNaarNotitie(memo: Memo): Pick<
  StudentProgress, 'student_id' | 'coach_id' | 'voice_memo_uri' | 'created_at'
>;
```

`memoNaarNotitie` zet `created_at` op het moment van de **opname**, niet van het uitwerken.
Een notitie die 's avonds getypt wordt, gaat over wat er die middag gebeurde; in het dossier
hoort hij op de middag te staan.

## De schermen

### Het startscherm wordt de lesdag

`app/index.tsx` toont voor een trainer bovenaan zijn lesdag. De tegels die er nu staan
verdwijnen niet — ze schuiven eronder. Er gaat dus niets weg; er komt iets vóór.

```
  Tennis App                       KL
  ─────────────────────────────────────
  Lesdag · di 25 aug

  ● NU  17:00–18:00 · Baan 2
    Mathis   🎤 ✓    Lotte   🎤
    Sam      🎤 ✓    Noa     🎤

    18:00–19:00 · Baan 1   Jef +1
    19:00–20:00 · Baan 1   Emma
  ─────────────────────────────────────
  ▸ 4 memo's uit te werken
  ─────────────────────────────────────
  [ Les boeken ]  [ Agenda ]
  [ Spelers ]     [ Trainers ]  [ Beheer ]
```

- De lopende (of eerstvolgende) les staat uitgeklapt met zijn spelers; de andere zijn één
  regel en klappen open als je ze aantikt.
- Achter elke naam één microfoonknop: indrukken, praten, loslaten.
- Een speler met een memo in déze les krijgt een vinkje. Op een baan is dat de enige vraag
  die telt: wie heb ik al gehad?
- Heeft de trainer vandaag geen lessen, dan staat er één regel dat het zo is en schuiven de
  tegels naar boven. Geen leeg vlak.
- Een speler of ouder ziet dit blok niet en houdt het startscherm dat hij nu heeft.

### De opnameknop

Nieuw: `components/lesdag/MemoKnop.tsx`. Indrukken en vasthouden neemt op, loslaten stopt.
Tijdens het opnemen loopt er een teller en is de knop duidelijk aan — op een baan kijk je
er maar half naar, dus het moet van een meter afstand te zien zijn of hij loopt.

De opnamemotor komt uit `VoiceRecorder`: die logica wordt eruit getrokken naar een eigen
haak (`useOpname`), zodat de knop op de baan en het bestaande voortgangsblad dezelfde motor
delen. Twee keer `MediaRecorder` bedienen betekent twee keer dezelfde randgevallen oplossen,
en dan doet de ene het wel en de andere niet.

### De uitwerklijst

Nieuw scherm `app/memos.tsx`, bereikbaar via de regel "4 memo's uit te werken" onder de
lesdag. Oudste bovenaan, want die vergeet je het snelst.

```
  Nog uit te werken · 4
  ──────────────────────────────
  Mathis   ▶ 0:08   di 17:12   [uitwerken]  [🗑]
  Sam      ▶ 0:05   di 17:20   [uitwerken]  [🗑]
  Lotte    ▶ 0:11   di 17:31   [uitwerken]  [🗑]
  Jef      ▶ 0:06   di 18:14   [uitwerken]  [🗑]
```

- **Afspelen** kan zonder verder iets te doen; soms is luisteren genoeg.
- **Uitwerken** opent het bestaande `ProgressForm`, met de speler, de les en de audio al
  ingevuld. Er valt alleen nog te typen wat je hoorde. Bewaren maakt er één
  voortgangsnotitie van en verwijdert de memo — in één handeling, zodat er geen toestand
  bestaat waarin allebei bestaan of allebei weg zijn.
- **Weggooien** vraagt eerst na. Een opname is niet terug te halen.
- Wie nooit uitwerkt, houdt zijn memo's. Ze verdwijnen niet vanzelf en er staat geen
  vervaldatum op; dit is een werklijst, geen postvak dat opruimt.

### In de provider

Drie nieuwe handelingen in `providers/SimpleDataProvider.tsx`, alle drie via `commit`:

- `addMemo(memo)` — na een geslaagde opname.
- `deleteMemo(id)` — weggooien.
- `werkMemoUit(memo, velden)` — voegt de voortgangsnotitie toe en verwijdert de memo in
  **één** `commit`. Zou dat twee keer opslaan zijn, dan bestaat er een moment waarop een
  mislukte tweede helft een dubbele notitie of een verdwenen memo oplevert.

## Wat er misgaat, en wat de app dan doet

| Wat | Wat de trainer ziet |
| --- | --- |
| Geen toestemming voor de microfoon | Een regel op de knop zelf, niet een venster dat je moet wegklikken. Op web vraagt de browser dat één keer per site. |
| Opname korter dan een seconde | Verdwijnt zonder iets te zeggen. Dat was een misgreep, geen memo. |
| Langer dan 60 seconden | De opname stopt vanzelf en wordt bewaard. Vanaf 50 seconden telt hij zichtbaar af. |
| Browser kan niet opnemen | De microfoonknop staat er niet; in plaats daarvan een regel dat opnemen hier niet kan. Niet een knop die niets doet. |
| Opslaan mislukt | De opname **blijft in beeld** met de melding dat hij nog niet bewaard is, en een knop om het opnieuw te proberen. Een memo mag nooit stil weg zijn. Dit is het gat dat de volgende spec (offline werken) echt dicht. |
| Speler staat niet meer in de club | De memo blijft, met "Onbekend" als naam — net als overal elders in de app. |

## Wat er niet in zit

- **Aanwezigheid.** Wie er was en wie niet is een eigen onderwerp met gevolgen voor de
  beurtenkaart en de facturatie. Niet hier.
- **Spraak-naar-tekst.** Bestaat op web nog niet in deze app; uitwerken blijft luisteren en
  typen. Komt dat er ooit, dan verandert alleen de uitwerklijst.
- **Offline werken.** Dat is de volgende spec en raakt `commit`, niet dit scherm.
- **Memo's over een hele groep tegelijk.** Eén memo gaat over één speler. Een groepsmemo is
  een ander begrip en kan later, zonder dit ontwerp om te gooien.

## Wat er getest wordt

Zoals in dit project gebruikelijk: alles wat te beslissen valt zit in `lib/` en heeft tests.

- `lib/lesdag.test.ts` — welke lessen van vandaag, in welke volgorde, welke loopt er (ook:
  er loopt er geen, er is er nog geen geweest, ze zijn allemaal voorbij), geannuleerde
  vallen weg, lessen van een andere trainer vallen weg, meespelers van een groepsles staan
  erin.
- `lib/memo.test.ts` — te kort, te lang, precies op de grens; de volgorde van de
  uitwerklijst; het vinkje per les en per speler; de velden en het tijdstip die een memo aan
  een notitie meegeeft.

Voor de schermen zijn er in dit project nog geen tests (alle 676 zitten in `lib/`). Dat
verandert dit ontwerp niet, maar het is wél de reden dat de knoplogica — wanneer is een
opname geldig, wat toont de teller — in `lib/memo.ts` staat en niet in de knop.

Met de hand na te lopen in de browser: opnemen en loslaten, te kort loslaten, de teller tot
60, toestemming weigeren, uitwerken tot een notitie, weggooien, en een dag zonder lessen.
