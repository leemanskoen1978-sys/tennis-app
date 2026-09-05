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
import { parseDag } from './vakanties';
import type { SickLeave } from './types';

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
