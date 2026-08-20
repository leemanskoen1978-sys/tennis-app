import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, radius, typography, shadow } from '../constants/theme';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { ParticipantPicker } from './ParticipantPicker';
import { UserManagement } from './UserManagement';
import type { Court, PaymentMethod, PaymentSplit } from '../lib/types';
import { useSimpleData } from '../providers/SimpleDataProvider';
import {
  defaultMethodFor, lessonPriceLine, PAYMENT_LABELS, PAYMENT_METHODS,
} from '../lib/payments';
import {
  cardsFor, remaining, GROEPSLES_ALLEEN_FACTUUR, GROEPSLES_METHOD,
} from '../lib/beurtenkaart';
import { sponsorHint, sponsorState } from '../lib/sponsor';
import { formatDay } from '../lib/datetime';
import { formatDayInput, parseDayInput } from '../lib/period';
import {
  MAX_LESSONS, planSeries, seriesSummary,
  type RecurrenceFrequency, type RecurrenceRule,
} from '../lib/recurrence';

interface BookingModalProps {
  visible: boolean;
  onClose: () => void;
  coachId: string;
  date: Date | null;
  slot: string | null; // "HH:00"
  courts: Court[];
  /**
   * Who the lesson is for. Omitted, the booking is for the logged-in user — a player
   * booking their own lesson. Set, a coach is booking on behalf of that player.
   */
  playerId?: string;
}

function parseHour(slot: string): number {
  const [hourPart] = slot.split(':');
  return parseInt(hourPart, 10);
}

/**
 * Een lokale dag als YYYY-MM-DD, het formaat dat de herhaalregel verwacht. Bewust niet via
 * `toISOString()`: die rekent naar UTC om en maakt van een avond in de zomer de dag ervoor.
 */
function dayKey(d: Date): string {
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/** "1 les" / "5 lessen" — komt in meerdere meldingen hieronder terug. */
function lessons(n: number): string {
  return n === 1 ? '1 les' : `${n} lessen`;
}

/** Hoeveel dagen er tussen twee lessen van een reeks zitten. */
const STEP_DAYS: Record<RecurrenceFrequency, number> = { weekly: 7, biweekly: 14 };

export function BookingModal(props: BookingModalProps): JSX.Element | null {
  const { visible, onClose, coachId, date, slot, courts, playerId } = props;
  // `courts` is een prop (de terreinen waaruit je hier kiest); voor de prijs van een les
  // is de hele lijst nodig, dus die komt uit de opslag onder een eigen naam.
  const {
    currentUser, users, bookings, courts: allCourts, beurtenkaarten,
    addBooking, addBookingSeries, setPaymentMethod, error,
  } = useSimpleData();

  const [selectedCourtId, setSelectedCourtId] = useState<string>(
    courts[0]?.id ?? '',
  );
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  // De les is aangemaakt, maar de betaalwijze kon er niet op: geen beurt over, of het
  // sponsorbudget draagt hem niet meer. Het venster blijft dan open met de melding erbij;
  // deze id zorgt dat een tweede klik het opnieuw probeert in plaats van een tweede les
  // aan te maken.
  const [bookedWithoutBeurt, setBookedWithoutBeurt] = useState<string | null>(null);
  // Bewust alleen de eigen keuze van de gebruiker, en `null` zolang hij niets aanklikte.
  // Zo blijft de standaard van de speler leidend — wisselt de trainer van speler, dan
  // schuift de keuze mee — terwijl een aangeklikte betaalwijze wél blijft staan.
  const [chosenMethod, setChosenMethod] = useState<PaymentMethod | null>(null);
  // De medespelers van een groepsles: de betaler staat er niet bij, die is `forPlayerId`.
  const [participants, setParticipants] = useState<string[]>([]);
  // Bij een groepsles: één factuur voor de betaler, of ieder zijn deel.
  const [split, setSplit] = useState<PaymentSplit>('together');
  // De naam die in de keuzelijst getypt werd voor een speler die nog niet bestaat.
  const [newPlayerName, setNewPlayerName] = useState<string | null>(null);
  // Herhalen: `null` is één losse les, en dat blijft de standaard — zonder keuze hier
  // gebeurt er precies wat er vóór de reeksen gebeurde.
  const [repeat, setRepeat] = useState<RecurrenceFrequency | null>(null);
  const [untilText, setUntilText] = useState<string>('');
  // De afsluitende melding van een reeks waarvan niet elke les zijn betaalwijze kreeg. Zolang
  // die er staat blijft het venster open: dichtklappen zou zeggen "alles gelukt".
  const [seriesNotice, setSeriesNotice] = useState<string | null>(null);

  if (date === null || slot === null) {
    return null;
  }

  const hour = parseHour(slot);
  const startDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hour,
    0,
    0,
  );
  const endDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hour + 1,
    0,
    0,
  );
  const start_time = startDate.toISOString();
  const end_time = endDate.toISOString();

  const forPlayerId = playerId ?? currentUser?.id;
  const defaultMethod = defaultMethodFor(users.find((u) => u.id === forPlayerId));
  const isGroup = participants.length > 0;
  // De betaalwijze waarmee geboekt wordt: bij een groepsles staat die vast op factuur,
  // anders de eigen keuze en anders de standaard van de speler.
  const method: PaymentMethod = isGroup ? GROEPSLES_METHOD : (chosenMethod ?? defaultMethod);

  // Beurtenkaart en sponsor hebben allebei een bodem. Ze lopen daarom niet rechtstreeks
  // mee in de nieuwe les, maar via `setPaymentMethod`: dat is de enige plek die de beurt
  // afboekt en het sponsorbudget bewaakt. Bij een groepsles komen ze niet voor.
  const bewaakt = method === 'beurtenkaart' || method === 'sponsor';

  const players = users.filter((u) => u.role !== 'coach');
  // Wat de les gaat kosten, met de gekozen namen erin verwerkt: zo ziet de trainer meteen
  // wat er verandert als hij er een speler bij zet.
  const priceLine = lessonPriceLine(
    {
      player_id: forPlayerId ?? '',
      participant_ids: participants,
      payment_method: method,
      payment_split: split,
      start_time,
      end_time,
    },
    allCourts.find((c) => c.id === (selectedCourtId || courts[0]?.id)),
  );

  // De reeks zoals hij er nú uitziet, met wat er in het veld staat. Het rekenwerk loopt mee
  // terwijl de trainer tikt: een halve datum levert geen regel en dus geen plan op.
  const untilDate = repeat ? parseDayInput(untilText) : null;
  const rule: RecurrenceRule | null = repeat && untilDate
    ? { frequency: repeat, until: dayKey(untilDate) }
    : null;
  const plan = rule ? planSeries(start_time, end_time, rule, coachId, bookings) : null;
  // Een reeks zonder één bruikbare les is geen boeking; de knop hoort dan niet te werken.
  const blockedSeries = repeat !== null && (plan === null || plan.usable.length === 0);

  /** Zelfde formulering als het exportscherm: hoeveel beurten heeft deze speler nog. */
  const beurtenHint = (): string => {
    const cards = forPlayerId ? cardsFor(beurtenkaarten, forPlayerId) : [];
    if (cards.length === 0) return 'Deze speler heeft nog geen beurtenkaart.';
    const left = cards.reduce((sum, c) => sum + remaining(c), 0);
    return left === 1 ? 'Nog 1 beurt over.' : `Nog ${left} beurten over.`;
  };

  /** Hetzelfde in euro's: wat heeft deze speler nog van zijn sponsorcontract over. */
  const sponsorTekst = (): string =>
    sponsorHint(sponsorState(users.find((u) => u.id === forPlayerId), bookings, allCourts));

  /**
   * Een frequentie aanklikken. De einddatum wordt meteen ingevuld op twaalf lessen vooruit:
   * een leeg veld naast "Wekelijks" laat de trainer raden wat er verwacht wordt, en twaalf
   * lessen is de maat van een lesblok. Wat hij zelf al tikte blijft staan.
   */
  const kiesHerhaling = (frequency: RecurrenceFrequency | null): void => {
    setRepeat(frequency);
    if (frequency && !untilText.trim()) {
      const days = 11 * STEP_DAYS[frequency];
      setUntilText(formatDayInput(
        new Date(date.getFullYear(), date.getMonth(), date.getDate() + days),
      ));
    }
  };

  const handleClose = (): void => {
    setBookedWithoutBeurt(null);
    setSeriesNotice(null);
    setRepeat(null);
    setUntilText('');
    setNotes('');
    setParticipants([]);
    setSplit('together');
    // Het venster blijft gemonteerd; zonder dit begint de volgende boeking met de keuze
    // van de vorige in plaats van met de standaard van die speler.
    setChosenMethod(null);
    onClose();
  };

  const handleConfirm = async (): Promise<void> => {
    if (!currentUser) {
      return;
    }
    if (submitting) {
      return;
    }
    setSubmitting(true);
    try {
      // De les staat er al en wacht alleen nog op zijn betaalwijze: niets opnieuw aanmaken.
      if (bookedWithoutBeurt) {
        const retried = await setPaymentMethod(bookedWithoutBeurt, method);
        if (!retried) {
          return;
        }
        handleClose();
        return;
      }
      const base = {
        player_id: playerId ?? currentUser.id,
        coach_id: coachId,
        court_id: selectedCourtId || courts[0]?.id || '',
        start_time,
        end_time,
        status: 'confirmed' as const,
        participant_ids: participants.length > 0 ? participants : undefined,
        payment_split: isGroup ? split : undefined,
        notes: notes.trim() ? notes.trim() : undefined,
      };

      if (rule && plan) {
        // Nul bruikbare lessen is geen reeks; de knop staat dan al uit, maar een reeks van
        // niets aanmaken mag ook hier niet kunnen.
        if (plan.usable.length === 0) return;
        // De betaalwijze gaat hier wél mee zoals gekozen: de provider doet per les de
        // bewaakte weg, met de beurten van de eerdere lessen van deze reeks meegeteld.
        const { created, skipped } = await addBookingSeries(
          { ...base, payment_method: method },
          rule,
        );
        if (created.length === 0) return;
        // Betrouwbaarder dan de foutregel: kijk in wat er terugkwam. Een les die op “Open”
        // staat terwijl er iets anders gekozen was, kreeg geen beurt of geen budget meer.
        const open = method === 'open'
          ? 0
          : created.filter((b) => b.payment_method === 'open').length;
        if (open > 0) {
          const gelukt = created.length - open;
          setSeriesNotice(
            `${lessons(created.length)} aangemaakt: ${gelukt} op ${PAYMENT_LABELS[method]}, `
            + `${open} op ${PAYMENT_LABELS.open} — die vind je in Beheer → Betalingen.`
            + (skipped.length > 0
              ? ` ${lessons(skipped.length)} overgeslagen, de trainer was dan al bezet.`
              : ''),
          );
          return;
        }
        handleClose();
        return;
      }

      // Bij een bewaakte betaalwijze: boek op open en laat setPaymentMethod de beurt
      // afboeken of het sponsorbudget nakijken — dat is de enige plek die dat bewaakt.
      const created = await addBooking({
        ...base,
        payment_method: bewaakt ? 'open' : method,
      });
      if (!created) {
        return;
      }
      if (bewaakt) {
        const paid = await setPaymentMethod(created.id, method);
        if (!paid) {
          // Geen kaart met beurten over, of het sponsorbudget draagt deze les niet meer.
          // De les bestaat wel, op Open: het venster blijft open zodat de trainer de
          // melding van de provider hieronder te zien krijgt.
          setBookedWithoutBeurt(created.id);
          return;
        }
      }
      handleClose();
    } finally {
      setSubmitting(false);
    }
  };

  const slotEndLabel = `${String(hour + 1).padStart(2, '0')}:00`;

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>Les boeken</Text>
            <Text style={styles.subtitle}>
              {formatDay(date)} · {slot}–{slotEndLabel}
            </Text>
            {/* Booking for someone else is easy to do by accident, so name them. */}
            {playerId && playerId !== currentUser?.id ? (
              <Text style={styles.forWhom}>
                Voor {users.find((u) => u.id === playerId)?.name ?? 'onbekende speler'}
              </Text>
            ) : null}

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
            >
              {seriesNotice ? (
                // De reeks staat er; alleen het geld klopte niet overal. De velden zijn niet
                // meer van toepassing, de melding is het enige wat hier nog telt.
                <Text style={styles.notice}>{seriesNotice}</Text>
              ) : bookedWithoutBeurt ? (
                // De les staat er al. De velden zijn niet meer van toepassing: wat hier nog
                // ontbreekt is de beurt, niet de boeking.
                <Text style={styles.notice}>
                  De les is geboekt, maar “{PAYMENT_LABELS[method]}” ging er niet op: de
                  betaalwijze staat nog op “{PAYMENT_LABELS.open}”. Bevestigen probeert het
                  alsnog — er komt geen tweede les bij. Sluiten mag ook; je kunt de betaalwijze
                  later bij de les zelf zetten.
                </Text>
              ) : (
                <>
                  <Text style={styles.label}>Terrein</Text>
                  <View style={styles.chipRow}>
                    {courts.map((court) => (
                      <Chip
                        key={court.id}
                        label={court.name}
                        selected={court.id === selectedCourtId}
                        onPress={() => setSelectedCourtId(court.id)}
                      />
                    ))}
                  </View>

                  <Text style={styles.label}>Medespelers (optioneel)</Text>
                  <ParticipantPicker
                    players={players}
                    payerId={forPlayerId}
                    value={participants}
                    onChange={setParticipants}
                    onRequestCreate={setNewPlayerName}
                  />

                  {/* Wat de les kost, meteen onder de namen: hier ziet de trainer de staffel
                      in werking zodra hij er iemand bij zet. */}
                  <Text style={styles.price}>{priceLine}</Text>

                  {isGroup ? (
                    <>
                      <Text style={styles.label}>Factuur</Text>
                      <View style={styles.chipRow}>
                        <Chip
                          label="Samen"
                          selected={split === 'together'}
                          onPress={() => setSplit('together')}
                        />
                        <Chip
                          label="Apart"
                          selected={split === 'separate'}
                          onPress={() => setSplit('separate')}
                        />
                      </View>
                      <Text style={styles.hint}>
                        {split === 'together'
                          ? `Het hele bedrag gaat naar ${users.find((u) => u.id === forPlayerId)?.name ?? 'de betaler'}.`
                          : 'Elke speler krijgt zijn eigen deel gefactureerd.'}
                      </Text>
                    </>
                  ) : null}

                  <Text style={styles.label}>Betaalwijze</Text>
                  {isGroup ? (
                    // Bij een groepsles valt er niets te kiezen; een rij chips die allemaal
                    // weigeren is erger dan geen rij.
                    <Text style={styles.hint}>
                      {PAYMENT_LABELS[GROEPSLES_METHOD]}. {GROEPSLES_ALLEEN_FACTUUR} Een
                      beurtenkaart en het sponsorbudget gelden alleen voor een privéles.
                    </Text>
                  ) : (
                    <>
                      <View style={styles.chipRow}>
                        {PAYMENT_METHODS.map((m) => (
                          <Chip
                            key={m}
                            label={PAYMENT_LABELS[m]}
                            selected={m === method}
                            onPress={() => setChosenMethod(m)}
                          />
                        ))}
                      </View>
                      {method === 'beurtenkaart' ? (
                        <Text style={styles.hint}>
                          Er gaat een beurt af. {beurtenHint()}
                        </Text>
                      ) : null}
                      {method === 'sponsor' ? (
                        <Text style={styles.hint}>
                          De les gaat van het sponsorcontract af. {sponsorTekst()}
                        </Text>
                      ) : null}
                    </>
                  )}

                  <Text style={styles.label}>Notities (optioneel)</Text>
                  <TextInput
                    style={styles.input}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Voeg een notitie toe…"
                    placeholderTextColor={tennisColors.textMuted}
                    multiline
                  />

                  <Text style={styles.label}>Herhalen</Text>
                  <View style={styles.chipRow}>
                    <Chip
                      label="Niet herhalen"
                      selected={repeat === null}
                      onPress={() => kiesHerhaling(null)}
                    />
                    <Chip
                      label="Wekelijks"
                      selected={repeat === 'weekly'}
                      onPress={() => kiesHerhaling('weekly')}
                    />
                    <Chip
                      label="Tweewekelijks"
                      selected={repeat === 'biweekly'}
                      onPress={() => kiesHerhaling('biweekly')}
                    />
                  </View>

                  {repeat ? (
                    <>
                      <Text style={styles.fieldLabel}>Tot en met</Text>
                      <TextInput
                        style={styles.dayInput}
                        value={untilText}
                        onChangeText={setUntilText}
                        placeholder="dd/mm/jjjj"
                        placeholderTextColor={tennisColors.textMuted}
                        accessibilityLabel="Laatste dag van de reeks"
                        inputMode="numeric"
                      />
                      {!untilDate ? (
                        <Text style={styles.hint}>Vul de laatste dag in als dd/mm/jjjj.</Text>
                      ) : null}

                      {/* Wat er gaat gebeuren, vóór het bevestigen. De overgeslagen dagen
                          staan er met datum bij: "3 overgeslagen" zonder te zeggen welke
                          laat de trainer met een raadsel achter. */}
                      {plan && rule ? (
                        <>
                          <Text style={styles.price}>{seriesSummary(plan, rule)}</Text>
                          {plan.skipped.length > 0 ? (
                            <Text style={styles.hint}>
                              {lessons(plan.skipped.length)} overgeslagen omdat de trainer dan
                              al bezet is: {plan.skipped.map((s) => formatDay(s.start_time)).join(', ')}.
                            </Text>
                          ) : null}
                          {plan.usable.length === 0 ? (
                            <Text style={styles.error}>
                              Geen enkel moment van deze reeks is nog vrij; er valt niets te
                              boeken.
                            </Text>
                          ) : null}
                          {plan.usable.length + plan.skipped.length >= MAX_LESSONS ? (
                            <Text style={styles.hint}>
                              Een reeks gaat tot {MAX_LESSONS} lessen; wat daarna komt valt
                              erbuiten.
                            </Text>
                          ) : null}
                        </>
                      ) : null}
                    </>
                  ) : null}
                </>
              )}

              {/* Bij een afgeronde reeks zegt de melding hierboven al wat er misging; de
                  foutregel van de provider zou dat woord voor woord herhalen. */}
              {error && !seriesNotice ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>

            <View style={styles.actions}>
              {seriesNotice ? (
                // Er valt hier niets meer te bevestigen: de lessen staan er al.
                <Button label="Sluiten" variant="primary" onPress={handleClose} fullWidth />
              ) : (
                <>
                  <Button
                    label={bookedWithoutBeurt ? 'Sluiten' : 'Annuleren'}
                    variant="secondary"
                    onPress={handleClose}
                    disabled={submitting}
                    fullWidth
                  />
                  <Button
                    label={bookedWithoutBeurt ? 'Betaalwijze opnieuw proberen' : 'Bevestigen'}
                    variant="primary"
                    onPress={handleConfirm}
                    disabled={submitting || blockedSeries}
                    fullWidth
                  />
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Het volledige invulscherm voor een nieuwe speler. Bewust naast het boekvenster en
          niet erin: twee bladen in elkaar geschoven raakt op web en Android in de knoop.
          Zodra hij bewaard is, doet hij meteen mee aan de les die geboekt wordt. */}
      <UserManagement
        visible={newPlayerName !== null}
        initialName={newPlayerName ?? ''}
        onClose={() => setNewPlayerName(null)}
        onCreated={(u) => {
          setParticipants((current) => (current.includes(u.id) ? current : [...current, u.id]));
          setNewPlayerName(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: tennisColors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
    ...shadow('lg'),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.sm,
    backgroundColor: tennisColors.border,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: tennisColors.text,
  },
  subtitle: {
    ...typography.body,
    fontSize: 14,
    color: tennisColors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  forWhom: {
    ...typography.body,
    fontWeight: '600',
    color: tennisColors.text,
    marginBottom: spacing.md,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingBottom: spacing.sm,
  },
  label: {
    ...typography.label,
    color: tennisColors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 72,
    color: tennisColors.text,
    backgroundColor: tennisColors.background,
    textAlignVertical: 'top',
  },
  fieldLabel: {
    ...typography.label,
    color: tennisColors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  // Eén regel, dus lager dan het notitieveld; verder dezelfde omlijsting als daar.
  dayInput: {
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: tennisColors.text,
    backgroundColor: tennisColors.background,
  },
  notice: {
    ...typography.body,
    fontSize: 14,
    color: tennisColors.text,
    marginTop: spacing.md,
  },
  price: {
    ...typography.body,
    fontWeight: '600',
    color: tennisColors.text,
    marginTop: spacing.md,
  },
  hint: {
    fontSize: 13,
    color: tennisColors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  error: {
    color: tennisColors.danger,
    fontSize: 14,
    marginTop: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
});
