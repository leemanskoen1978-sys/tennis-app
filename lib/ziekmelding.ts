// Wat een ziekmelding is, welke lessen hij raakt, en of een les nog een vervanger zoekt.
// Puur rekenwerk — geen store, geen scherm, geen schrijfweg — zodat de regels van een zieke
// trainer één keer vastliggen en te testen zijn.
//
// Dit bestand schrijft nooit. Het rekent uit wat er aan de hand is; wie er een vervanger aan
// hangt doet dat één laag hoger, met `setTaughtBy` in de provider.
//
// De grens die dit bestand bewaakt: een ziekmelding is niet hetzelfde als een afwijkende
// boekingsperiode (`users.booking_periods`, `Boekingsperiode` in lib/types). Die laatste is
// vooruit gepland — "hij geeft die weken geen les" — en er staat nog niets in de agenda dat
// eronder lijdt. Een ziekmelding is een gebeurtenis: de lessen stonden er al, ze staan er
// nog, en ze moeten vandaag opgelost worden. Wie de twee in elkaar schuift, laat de club
// lessen ongemerkt zonder trainer staan omdat ze "al buiten zijn uren vielen".
//
// Een ziektedag is een dag op de kalender en geen moment op de klok, net als bij een
// vakantie: de grenzen staan als `jjjj-mm-dd`, en elke vergelijking hier loopt over die
// vorm. Zie `SickLeave` in lib/types.

import { t } from './i18n';
import { dagSleutel, parseDag, vakantieOpMoment } from './vakanties';
import type { Booking, SickLeave, Vakantie } from './types';

/** De velden die deze vragen nodig hebben; meer weet dit bestand niet van een ziekmelding. */
export type OpenZiekmelding = Pick<SickLeave, 'coach_id' | 'van' | 'tot' | 'retracted_at'>;

/** Idem voor een les: vijf velden, en de rest van de boeking gaat dit bestand niets aan. */
export type ZiekmeldingBoeking = Pick<Booking, 'id' | 'coach_id' | 'taught_by_id' | 'start_time' | 'status'>;

/**
 * Waarom deze ziekmelding niet klopt, of `null` als hij deugt. Wordt gelezen terwijl iemand
 * nog aan het typen is, dus een half ingevulde datum is geen fout maar "nog niet af" —
 * dezelfde afspraak als `vakantieFout` in lib/vakanties.
 *
 * Een omgekeerd ingevulde periode (tot vóór van) is met opzet géén fout: wie de twee
 * omdraait bedoelt de dagen ertussen, en de lezers hieronder draaien de grenzen om in plaats
 * van te klagen — precies zoals `vakantieOpDag` dat doet.
 */
export function ziekmeldingFout(coachId: string, van: string, tot: string): string | null {
  if (coachId.trim().length === 0) return t('Kies wie er ziek is.');
  if (parseDag(van) === null || parseDag(tot) === null) {
    return t('Vul beide dagen in als dd/mm/jjjj.');
  }
  return null;
}

/**
 * De ziekmeldingen die nog meetellen. Dit is de ENIGE plek die de vraag "telt deze
 * ziekmelding nog mee" beantwoordt: een rij met `retracted_at` gezet blijft bestaan, maar
 * telt nergens meer als open.
 *
 * Daarom hoeft het intrekken van een ziekmelding geen enkele boeking aan te raken — zodra de
 * rij hier wegvalt, is het antwoord van `zoektVervanger` vanzelf nee, overal waar iemand de
 * vraag opnieuw stelt. Wie hier een tweede antwoord naast zet, laat ergens een les hangen
 * met een markering die niemand nog kan wegkrijgen.
 */
export function openZiekmeldingen(alle: SickLeave[]): SickLeave[] {
  return alle.filter((z) => !z.retracted_at);
}

/**
 * Valt deze dag in de ziekteperiode? Beide grenzen tellen mee: ziek van 1 tot en met 5 maart
 * betekent ook op 1 en op 5 geen les. Een omgekeerd ingevulde periode wordt gelezen als de
 * dagen ertussen, dezelfde afspraak als `vakantieOpDag` in lib/vakanties — een ziekmelding
 * die niets tegenhoudt omdat iemand twee velden omdraaide zou pas echt verwarrend zijn.
 */
function dektDag(periode: Pick<SickLeave, 'van' | 'tot'>, dag: string): boolean {
  const [van, tot] = periode.van <= periode.tot
    ? [periode.van, periode.tot]
    : [periode.tot, periode.van];
  return dag >= van && dag <= tot;
}

/**
 * Zoekt deze les nog een vervanger? Er is een openstaande ziekmelding die hem dekt, er staat
 * nog geen lesgever, en de les is niet afgezegd.
 *
 * Geen kolom en geen status op de boeking: dit is een afgeleid feit. Een nieuwe waarde op
 * `bookings.status` zou elke `switch` op status raken, en een opgeslagen vlaggetje kan
 * blijven hangen omdat iemand het vergat uit te zetten. Dit is de ENIGE plek die deze vraag
 * beantwoordt, net als `lesgeverId` in lib/lesgever — en precies daarom hoeft het intrekken
 * van een ziekmelding geen enkele boeking aan te raken: zodra de melding niet meer open
 * staat, is het antwoord hier vanzelf nee, overal waar iemand het opnieuw vraagt. Wie er een
 * tweede antwoord naast zet, laat een les stil uit de werklijst verdwijnen.
 *
 * Leest alleen. Er wordt hier nooit iets aan een boeking geschreven.
 */
export function zoektVervanger(booking: ZiekmeldingBoeking, open: OpenZiekmelding[]): boolean {
  if (booking.status === 'cancelled') return false;
  if (booking.taught_by_id) return false;
  // De lokale dag via `dagSleutel`, en nooit door de ISO-tekst af te knippen: die is in UTC
  // gerenderd, dus een les van 23:00 op de laatste ziektedag zou naar de volgende UTC-dag
  // schuiven en stil buiten de werklijst vallen.
  const dag = dagSleutel(new Date(booking.start_time));
  return open.some((z) => !z.retracted_at && z.coach_id === booking.coach_id && dektDag(z, dag));
}

/**
 * De lessen die deze ziekmelding raakt: alles wat de zieke trainer die dagen zou geven.
 * Op tijd gesorteerd, want zo werkt de beheerder de werklijst van boven naar beneden af.
 *
 * Wat er uitvalt: afgezegde lessen (die raakt niemand meer) en lessen op een dag dat de club
 * dicht is — die worden toch niet gegeven, en er een vervanger voor zoeken is werk voor
 * niets. Wat er met opzet in blijft: een les waar al een vervanger op staat. De beheerder
 * moet die rij zien om te weten dat hij geregeld is; het scherm toont hem als opgelost.
 *
 * De uitkomst is generiek in `T`, zodat het werklijstscherm er volle `Booking`-rijen in stopt
 * en er volle `Booking`-rijen uit krijgt — met baan, groep en spelers erin — zonder dat dit
 * bestand van meer dan vijf velden hoeft te weten.
 *
 * Er wordt hier nergens een uur opgeteld of afgetrokken: elke vergelijking loopt over de
 * lokale dag uit `dagSleutel`, zodat een reeks over de zomertijdwissel dezelfde uren houdt.
 */
export function lessenVoorZiekmelding<T extends ZiekmeldingBoeking>(
  bookings: T[],
  ziekmelding: Pick<SickLeave, 'coach_id' | 'van' | 'tot'>,
  vakanties: Vakantie[],
): T[] {
  return bookings
    .filter((b) => {
      if (b.status === 'cancelled') return false;
      // D-15: ook de lessen waar de zieke trainer alléén als vervanger stond. Hij kan die
      // evengoed niet geven, en een les die stilzwijgend buiten deze lijst valt is precies
      // de fout waarvoor deze module bestaat.
      const vanHem = b.coach_id === ziekmelding.coach_id
        || b.taught_by_id === ziekmelding.coach_id;
      if (!vanHem) return false;
      if (!dektDag(ziekmelding, dagSleutel(new Date(b.start_time)))) return false;
      // Is de club die dag dicht, dan was de les er sowieso niet: dat is de vakantie die hem
      // wegneemt en niet de ziekmelding.
      return vakantieOpMoment(vakanties, b.start_time) === null;
    })
    // `filter` gaf al een nieuwe lijst terug, dus deze `sort` raakt de invoer niet aan.
    // `Date.parse` en niet de tekst zelf: een tijdstip met een zone-aanduiding sorteert als
    // tekst verkeerd, en de volgorde van de werklijst is wat de beheerder afwerkt.
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));
}
