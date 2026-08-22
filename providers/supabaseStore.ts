// De databank-kant van de opslag: dezelfde vorm als de mock, maar dan online.
//
// Lezen gebeurt in één keer bij het opstarten: alle tabellen die deze gebruiker mag zien,
// in één `StoreData`. Dat is bewust. De schermen rekenen met de hele lijst (wie speelt
// wanneer, wat staat er nog open, hoeveel beurten zijn er over) en een club heeft honderden
// lessen, geen honderdduizenden. Zodra dat niet meer waar is, is dit de plek om per scherm
// te gaan opvragen.
//
// Schrijven gaat via `diffStores` (lib/sync): de app geeft de nieuwe toestand door, hier
// wordt uitgerekend welke rijen dat raakt. Zo hoeft geen enkele actie in de app te weten
// dat er een databank is.
//
// Wat RLS tegenhoudt, komt hier niet aan: een speler krijgt alleen zijn eigen lessen terug,
// en een schrijfactie die niet mag, geeft een fout in plaats van stilte. Zie
// supabase-schema.sql — die regels staan daar en niet alleen in de schermen.

import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { diffStores, type SyncTable } from '../lib/sync';
import type { StoreData } from './mockStore';
import { defaultSettings } from '../lib/seed';
import { aanmeldUitkomst, type AanmeldUitkomst } from '../lib/wachtwoord';
import type {
  Beurtenkaart, Booking, Court, Lesson, Memo, OuderKind, PlayerGoal, Settings,
  StudentProgress, User,
} from '../lib/types';

/** De tabelnaam in de databank bij elke verzameling in de app. */
const TABLES: Record<SyncTable, string> = {
  users: 'users',
  courts: 'courts',
  bookings: 'bookings',
  lessons: 'lessons',
  progress: 'student_progress',
  goals: 'player_goals',
  beurtenkaarten: 'beurtenkaarten',
  memos: 'memos',
  relaties: 'ouder_kind',
};

type Row = Record<string, unknown>;

/**
 * Een rij uit de databank naar de vorm die de app kent: lege velden verdwijnen.
 *
 * De app schrijft `undefined` voor "niet ingevuld" en test daar ook op (`student_id ===
 * undefined` betekent clubmateriaal). Postgres geeft `null` terug. Bleef dat staan, dan
 * zou elk zo'n test omslaan en zou `diffStores` bij elke start elke rij als gewijzigd zien.
 */
function clean<T>(row: Row, drop: string[] = []): T {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) continue;
    if (drop.includes(key)) continue;
    out[key] = value;
  }
  return out as T;
}

/**
 * Kolommen die de databank zelf bijhoudt en die de app niet kent. Ze weglaten houdt de
 * vergelijking in `diffStores` eerlijk: anders verschilt een rij die de app zelf net maakte
 * altijd van dezelfde rij nadat hij één keer opnieuw is geladen.
 */
const HOUSEKEEPING = ['created_at', 'auth_id'];

async function selectAll<T>(table: string, drop: string[] = HOUSEKEEPING): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []).map((row) => clean<T>(row as Row, drop));
}

/**
 * Kent deze databank die tabel (nog) niet? Postgres zegt 42P01, PostgREST zegt PGRST205 en
 * schrijft er "schema cache" bij; alle drie betekenen hetzelfde.
 */
function tabelBestaatNiet(error: { code?: string; message?: string }): boolean {
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return /schema cache/i.test(error.message ?? '');
}

/**
 * Een tabel ophalen die er nog niet hoeft te zijn.
 *
 * `memos` kwam later dan de rest van het schema. Een club die de nieuwe SQL nog niet
 * gedraaid heeft, kent die tabel niet — en omdat alles in één keer wordt opgehaald, zou
 * dat de hele lading laten mislukken. De app komt dan niet voorbij het inlogscherm, voor
 * iedereen, wegens één tabel die alleen spraakmemo's draagt.
 *
 * Alleen "die tabel bestaat niet" wordt hier geslikt. Een fout in de rechten of in de
 * verbinding komt gewoon naar boven, want dat is een fout die iemand hoort te zien.
 */
async function selectAllOptioneel<T>(table: string, drop: string[] = HOUSEKEEPING): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*');
  if (error) {
    if (tabelBestaatNiet(error)) {
      console.warn(`${table}: tabel bestaat nog niet — draai supabase-schema.sql.`);
      return [];
    }
    throw new Error(`${table}: ${error.message}`);
  }
  return (data ?? []).map((row) => clean<T>(row as Row, drop));
}

/** Eén rij uit `coach_rates`. Geen `id`: de trainer ís de sleutel. */
interface RateRow {
  coach_id: string;
  hourly_rate: number;
}

/**
 * Het uurloon terug op de gebruiker plakken.
 *
 * In de databank woont het apart (zie `coach_rates` in supabase-schema.sql), want RLS kan
 * geen enkele kolom afschermen. Voor de rest van de app is het gewoon een veld op `User`,
 * en dat blijft zo: hier is de enige plek die van het verschil weet.
 *
 * Wat je niet mag zien, komt niet mee terug — dan blijft het veld leeg. Een collega ziet
 * dus geen bedrag van nul maar geen bedrag, en dat is precies het verschil dat de schermen
 * ook maken.
 */
function metTarief(users: User[], rates: RateRow[]): User[] {
  const byId = new Map(rates.map((r) => [r.coach_id, r.hourly_rate]));
  return users.map((u) => {
    const rate = byId.get(u.id);
    return rate === undefined ? u : { ...u, hourly_rate: rate };
  });
}

/** Alles ophalen wat deze gebruiker mag zien. */
export async function loadFromSupabase(): Promise<StoreData> {
  const [
    users, courts, bookings, lessons, progress, goals, beurtenkaarten, memos, relaties, rates,
  ] = await Promise.all([
    selectAll<User>('users'),
    selectAll<Court>('courts'),
    selectAll<Booking>('bookings'),
    selectAll<Lesson>('lessons'),
    // `created_at` hoort hier wél bij de app: de tijdlijn in het spelersdossier leest hem.
    selectAll<StudentProgress>('student_progress', ['auth_id']),
    selectAll<PlayerGoal>('player_goals'),
    selectAll<Beurtenkaart>('beurtenkaarten', ['auth_id']),
    // `created_at` hoort hier wél bij de app: de uitwerklijst zet de oudste bovenaan.
    selectAllOptioneel<Memo>('memos', ['auth_id']),
    // Deze twee kwamen later dan de rest van het schema; een club die de nieuwe SQL nog
    // niet draaide kent ze niet, en dan mag de hele lading daar niet op stuklopen.
    selectAllOptioneel<OuderKind>('ouder_kind', ['auth_id']),
    selectAllOptioneel<RateRow>('coach_rates', ['auth_id', 'updated_at']),
  ]);

  const [settingsRow, catalogueRows] = await Promise.all([
    supabase.from('club_settings').select('value').eq('id', 'club').maybeSingle(),
    supabase.from('installed_catalogues').select('id'),
  ]);
  if (settingsRow.error) throw new Error(`club_settings: ${settingsRow.error.message}`);
  if (catalogueRows.error) throw new Error(`installed_catalogues: ${catalogueRows.error.message}`);

  const stored = (settingsRow.data?.value ?? {}) as Partial<Settings>;

  return {
    users: metTarief(users, rates),
    courts,
    bookings,
    lessons,
    progress,
    goals,
    beurtenkaarten,
    memos,
    relaties,
    // De club heeft één rij instellingen; ontbrekende velden vallen terug op de standaard,
    // zodat een nieuw veld geen lege plek in een scherm oplevert.
    settings: { ...defaultSettings, ...stored },
    installed_catalogues: (catalogueRows.data ?? []).map((r) => (r as { id: string }).id),
  };
}

/**
 * De nieuwe toestand wegschrijven. Alleen wat er veranderd is gaat over de lijn.
 *
 * Bewust géén transactie over alle tabellen heen: supabase-js kan dat niet vanaf de client.
 * Wat bij elkaar hoort, hoort daarom in zo min mogelijk bewerkingen — een beurt afboeken
 * raakt de kaart en de les, en dat zijn twee upserts die achter elkaar gaan. Gaat de tweede
 * mis, dan meldt de app de fout en klopt het scherm nog met wat de databank heeft, want de
 * volgende keer opslaan vertrekt van dezelfde vergelijking.
 */
/** Dezelfde rij zonder het uurloon: dat gaat naar `coach_rates`. */
function zonderTarief(row: Row): Row {
  const { hourly_rate: _weg, ...rest } = row;
  return rest;
}

/**
 * De uurlonen wegschrijven — alleen die van trainers bij wie het bedrag écht veranderd is.
 *
 * Bewust langs de vórige toestand en niet langs de gewijzigde gebruikersrijen: werkt een
 * trainer zijn telefoonnummer bij, dan staat hij wél in die lijst maar is zijn tarief niet
 * veranderd. Zouden we het dan toch wegschrijven, dan liep het opslaan van zijn nummer stuk
 * op `rates_write` — want schrijven mag alleen de beheerder, en dat is hij meestal niet.
 *
 * Een leeggemaakt tarief is een verwijderde rij en niet een rij met nul: nul is een
 * ingevuld tarief ("deze trainer werkt gratis") en dat is iets anders dan "nog niet
 * ingesteld" — de schermen zeggen dat verschil ook hardop.
 */
async function bewaarTarieven(before: User[], after: User[]): Promise<void> {
  const was = new Map(before.map((u) => [u.id, u.hourly_rate]));
  const veranderd = after.filter((u) => u.hourly_rate !== was.get(u.id));

  const metBedrag = veranderd.filter((u) => u.hourly_rate !== undefined);
  const leeggemaakt = veranderd.filter((u) => u.hourly_rate === undefined);

  if (metBedrag.length > 0) {
    const { error } = await supabase.from('coach_rates').upsert(
      metBedrag.map((u) => ({
        coach_id: u.id,
        hourly_rate: u.hourly_rate,
        updated_at: new Date().toISOString(),
      })),
    );
    if (error) throw new Error(`coach_rates: ${error.message}`);
  }

  if (leeggemaakt.length > 0) {
    const { error } = await supabase
      .from('coach_rates')
      .delete()
      .in('coach_id', leeggemaakt.map((u) => u.id));
    if (error) throw new Error(`coach_rates: ${error.message}`);
  }
}

export async function saveToSupabase(
  previous: StoreData | null,
  next: StoreData,
): Promise<void> {
  const change = diffStores(previous, next);
  if (change.empty) return;

  // Het uurloon heeft een eigen tabel, dus een eigen vergelijking. Vóór de rest: gaat het
  // mis, dan is er nog niets anders geschreven.
  //
  // Zonder vorige toestand slaan we het over. Er valt dan niets te vergelijken, en "dus
  // alles schrijven" zou een gewone trainer bij zijn eerste bewerking op `rates_write`
  // laten stuklopen — terwijl hij misschien alleen zijn telefoonnummer invulde.
  if (previous !== null) await bewaarTarieven(previous.users, next.users);

  for (const { table, upsert, remove } of change.tables) {
    const name = TABLES[table];
    if (upsert.length > 0) {
      // Het uurloon woont in een eigen tabel, dus het mag niet mee in de gebruikersrij —
      // die kolom bestaat daar niet meer. Zie `bewaarTarieven` hieronder.
      const rows = table === 'users'
        ? (upsert as unknown as Row[]).map(zonderTarief)
        : (upsert as unknown as Row[]);
      const { error } = await supabase.from(name).upsert(rows);
      if (error) throw new Error(`${name}: ${error.message}`);
    }
    if (remove.length > 0) {
      const { error } = await supabase.from(name).delete().in('id', remove);
      if (error) throw new Error(`${name}: ${error.message}`);
    }
  }

  if (change.settings !== null) {
    const { error } = await supabase
      .from('club_settings')
      .upsert({ id: 'club', value: change.settings, updated_at: new Date().toISOString() });
    if (error) throw new Error(`club_settings: ${error.message}`);
  }

  if (change.catalogues.length > 0) {
    const { error } = await supabase
      .from('installed_catalogues')
      .upsert(change.catalogues.map((id) => ({ id })));
    if (error) throw new Error(`installed_catalogues: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Inloggen
// ---------------------------------------------------------------------------

/**
 * Het id van de gebruiker in de app, bij de ingelogde login.
 *
 * Twee dingen, bewust uit elkaar gehouden: `auth.users` is wie er inlogt, `users` is wie er
 * tennist. Een speler die de trainer aanmaakte bestaat al lang voordat hij ooit inlogt (met
 * lessen, een beurtenkaart en een dossier); bij zijn eerste aanmelding koppelt de databank
 * zijn login aan die bestaande rij. Zie `link_auth_user` in supabase-schema.sql.
 */
export async function currentAppUserId(): Promise<string | null> {
  const { data: session } = await supabase.auth.getSession();
  const authId = session.session?.user.id;
  if (!authId) return null;

  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authId)
    .maybeSingle();
  if (error) throw new Error(`users: ${error.message}`);
  return (data as { id: string } | null)?.id ?? null;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(loginMessage(error.message));
}

/**
 * Aanmelden. De naam gaat mee als metadata; de databank gebruikt hem alleen als er nog geen
 * gebruiker met dit e-mailadres bestond.
 *
 * Geeft terug wát er gebeurde in plaats van alleen "het lukte": bij een bestaand, al
 * bevestigd adres gooit Supabase geen fout (dat zou verklappen wie er al lid is), en zonder
 * dit onderscheid zou het scherm een gebruiker die zijn wachtwoord vergeten is vertellen dat
 * hij zonet een nieuw wachtwoord instelde.
 */
export async function signUp(email: string, password: string, name: string): Promise<AanmeldUitkomst> {
  const schoon = name.trim();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    // Geen naam? Dan sturen we het veld helemaal niet mee. Een lege string is voor de
    // `coalesce` in `link_auth_user` een geldige waarde, en dan heet de nieuwe gebruiker
    // letterlijk niets in plaats van het deel vóór het apenstaartje.
    options: schoon ? { data: { name: schoon } } : undefined,
  });
  if (error) throw new Error(loginMessage(error.message));
  return aanmeldUitkomst(data.session !== null, data.user?.identities?.length ?? 0);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

/**
 * Wat er met de login gebeurde.
 *  - 'herstel': de klik op een link uit een herstelmail.
 *  - 'weg': de sessie is verdwenen — uitgelogd, of een token dat niet meer te verlengen was.
 *  - 'anders': elke andere wisseling (inloggen, een ververste sessie bij het opstarten, …).
 */
export type AuthGebeurtenis = 'herstel' | 'weg' | 'anders';

/**
 * Roept terug bij elke wisseling van login, ook bij het herstellen van een oude sessie.
 *
 * Geeft het soort gebeurtenis mee — niet de sessie zelf: de app hoeft alleen te weten of
 * dit een herstellink was of een weggevallen sessie, niet wat er precies in die sessie zit.
 */
export function onAuthChange(handler: (wat: AuthGebeurtenis) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    const wat: AuthGebeurtenis = event === 'PASSWORD_RECOVERY' ? 'herstel'
      : event === 'SIGNED_OUT' ? 'weg' : 'anders';
    handler(wat);
  });
  return () => data.subscription.unsubscribe();
}

/**
 * Een herstelmail sturen. Geeft niets terug over of dit adres bestaat — en dat is met opzet:
 * wie een adres intypt, hoort niet te weten te komen wie er lid is van de club. Supabase
 * houdt dezelfde regel aan en meldt een onbekend adres niet als fout.
 *
 * `redirectTo` moet in Supabase onder Authentication → URL Configuration bij *Redirect URLs*
 * staan. Staat het er niet, dan weigert Supabase de link en komt de speler op een foutpagina;
 * dat is de meest gemaakte fout bij het opzetten hiervan. Het adres moet daar dus mét het pad
 * van de site staan (bv. `https://club.github.io/tennis-app`), niet de kale `origin` — anders
 * landt de speler op de 404 van GitHub Pages met zijn hersteltoken in een URL die de app nooit
 * te zien krijgt.
 *
 * Zonder `redirectTo` valt Supabase terug op de Site URL, en dat is precies wat we willen op
 * een telefoon: `window` bestaat daar wél (React Native zet `global.window = global`), maar
 * `window.location` niet — die aanroepen zou de knop laten crashen in plaats van de mail te
 * sturen.
 */
export async function stuurHerstelmail(email: string): Promise<void> {
  const terug = Platform.OS === 'web' && typeof window !== 'undefined' && window.location
    // `EXPO_BASE_URL` is de submap uit `app.json` (`experiments.baseUrl`), door Expo zelf
    // ingebakken bij het bouwen — dezelfde submap die de site online ook gebruikt.
    ? `${window.location.origin}${process.env.EXPO_BASE_URL ?? ''}`
    : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: terug,
  });
  if (error) throw new Error(loginMessage(error.message));
}

/** Het nieuwe wachtwoord zetten. Kan alleen binnen de sessie die de herstellink opende. */
export async function zetNieuwWachtwoord(wachtwoord: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: wachtwoord });
  if (error) throw new Error(loginMessage(error.message));
}

/**
 * De meldingen van Supabase zijn Engels en technisch; dit is wat een trainer eraan heeft.
 *
 * "Al geregistreerd" vertaalt hier expres niet mee: `signUp` gooit die fout in de praktijk
 * niet meer (zie `aanmeldUitkomst`), maar mócht Supabase dat toch doen, dan herkent het
 * loginscherm de Engelse tekst zelf via `gaatOverEenBestaandAccount` — en dan hoort de
 * vertaling van die ene fout op precies één plek te staan, niet hier én daar.
 */
function loginMessage(raw: string): string {
  const text = raw.toLowerCase();
  if (text.includes('invalid login credentials')) {
    return 'E-mailadres of wachtwoord klopt niet.';
  }
  if (text.includes('email not confirmed')) {
    return 'Je account is nog niet bevestigd. Kijk in je mailbox.';
  }
  if (text.includes('password should be')) {
    return 'Kies een wachtwoord van minstens zes tekens.';
  }
  return raw;
}
