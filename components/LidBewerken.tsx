// Eén lid bewerken: het blad achter een naam in Beheer → Leden.
//
// Dit is het enige scherm waar de gegevens van iemand anders veranderd kunnen worden. Tot nu
// toe kon dat alleen bij het aanmaken: een verkeerd getypt e-mailadres was daarna niet meer
// recht te zetten zonder een SQL-query, en het beheerdersvinkje was helemaal onbereikbaar.
//
// Drie dingen op dit blad zijn geen gewoon veld en gedragen zich ook niet zo:
//  - de rol, want een trainer met lessen op zijn naam kan niet zomaar speler worden;
//  - het beheerdersvinkje, want de laatste beheerder die zichzelf ontvinkt sluit de club
//    buiten haar eigen deur;
//  - verwijderen, want dat neemt zijn lessen, zijn dossier en zijn kaarten mee.
// De regels erachter staan in lib/leden; hier staat wat je ervan ziet.

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Save, Trash2 } from 'lucide-react-native';

import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { DetailSheet } from './ui/DetailSheet';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { isValidEmail, normalizePhone } from '../lib/contact';
import {
  gevolgenVanVerwijderen, heeftGevolgen, magVinkjeWeg, rolWisselBezwaar, type Gevolgen,
} from '../lib/leden';
import { isAdmin, roleLabel } from '../lib/rechten';
import { PAYMENT_METHODS, PAYMENT_LABELS } from '../lib/payments';
import { useT } from '../lib/i18n';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, radius, typography } from '../constants/theme';
import type { PaymentMethod, Role, User } from '../lib/types';

/** De opsomming onder de verwijderknop: wat er meegaat, in gewone woorden. */
function gevolgenTekst(g: Gevolgen, t: (nl: string, vars?: Record<string, string | number>) => string): string {
  const delen: string[] = [];
  if (g.lessen > 0) delen.push(g.lessen === 1 ? t('1 les') : t('{n} lessen', { n: g.lessen }));
  if (g.verslagen > 0) {
    delen.push(g.verslagen === 1 ? t('1 verslag') : t('{n} verslagen', { n: g.verslagen }));
  }
  if (g.kaarten > 0) {
    delen.push(g.kaarten === 1 ? t('1 beurtenkaart') : t('{n} beurtenkaarten', { n: g.kaarten }));
  }
  if (g.doelen > 0) delen.push(g.doelen === 1 ? t('1 doel') : t('{n} doelen', { n: g.doelen }));
  if (g.memos > 0) delen.push(g.memos === 1 ? t('1 memo') : t('{n} memo’s', { n: g.memos }));
  if (g.lesmateriaal > 0) {
    delen.push(g.lesmateriaal === 1
      ? t('1 stuk lesmateriaal')
      : t('{n} stukken lesmateriaal', { n: g.lesmateriaal }));
  }
  if (g.koppelingen > 0) {
    delen.push(g.koppelingen === 1
      ? t('1 koppeling met een ouder of kind')
      : t('{n} koppelingen met ouders of kinderen', { n: g.koppelingen }));
  }
  return delen.join(' · ');
}

export function LidBewerken({
  lid,
  visible,
  onClose,
}: {
  lid: User;
  visible: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const t = useT();
  const {
    currentUser, users, bookings, progress, beurtenkaarten, goals, lessons, relaties, memos,
    updateUser, setUserRole, setBeheerder, deleteUser, error, clearError,
  } = useSimpleData();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rate, setRate] = useState('');
  const [budget, setBudget] = useState('');
  const [bevestigen, setBevestigen] = useState(false);
  const [bewaard, setBewaard] = useState(false);

  // Bij elk openen opnieuw vullen: het blad blijft gemonteerd, dus een afgebroken bewerking
  // van het vorige lid zou anders boven het volgende blijven hangen.
  useEffect(() => {
    if (!visible) return;
    setName(lid.name);
    setEmail(lid.email);
    setPhone(lid.phone ?? '');
    setRate(lid.hourly_rate !== undefined ? String(lid.hourly_rate) : '');
    setBudget(lid.sponsor_budget !== undefined ? String(lid.sponsor_budget) : '');
    setBevestigen(false);
    setBewaard(false);
    clearError();
  }, [visible, lid, clearError]);

  const emailOk = isValidEmail(email.trim());
  const naamOk = name.trim().length > 0;

  // De vraag "mag dit vinkje weg" gaat over de stand zoals ze nu is opgeslagen, niet over
  // wat er in de velden staat: het vinkje schrijft meteen weg.
  const vinkjeWegMag = magVinkjeWeg(users, lid.id);
  const bezwaar = rolWisselBezwaar(lid, lid.role === 'coach' ? 'player' : 'coach', bookings);
  const gevolgen = gevolgenVanVerwijderen(
    { bookings, progress, beurtenkaarten, goals, lessons, relaties, memos },
    lid.id,
  );
  const zelf = currentUser?.id === lid.id;

  const bewaar = (): void => {
    if (!naamOk || !emailOk) return;
    const nummer = normalizePhone(phone);
    const tarief = Number(rate.replace(',', '.'));
    const sponsor = Number(budget.replace(',', '.'));
    void updateUser(lid.id, {
      name: name.trim(),
      email: email.trim(),
      // Leeg betekent "niet ingevuld", en dat is iets anders dan een lege tekst: de rest
      // van de app leest `undefined` als "er staat niets".
      phone: nummer ? nummer : undefined,
      ...(lid.role === 'coach'
        ? { hourly_rate: rate.trim() && Number.isFinite(tarief) ? tarief : undefined }
        : {
          sponsor_budget: budget.trim() && Number.isFinite(sponsor) ? sponsor : undefined,
        }),
    }).then(() => setBewaard(true), () => {});
  };

  return (
    <DetailSheet title={lid.name} subtitle={lid.email} visible={visible} onClose={onClose}>
      <Text style={styles.label}>{t('Naam')}</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />
      {!naamOk ? <Text style={styles.error}>{t('Een naam is verplicht.')}</Text> : null}

      <Text style={styles.label}>{t('E-mailadres')}</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.helper}>
        {t('Hiermee logt hij in. Verander je het, dan hoort hij het te weten.')}
      </Text>
      {!emailOk ? <Text style={styles.error}>{t('Dit lijkt geen geldig e-mailadres.')}</Text> : null}

      <Text style={styles.label}>{t('Gsm-nummer')}</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

      {lid.role === 'coach' ? (
        <>
          <Text style={styles.label}>{t('Uurtarief')}</Text>
          <TextInput style={styles.input} value={rate} onChangeText={setRate} keyboardType="numeric" />
          <Text style={styles.helper}>
            {t('Alleen ter informatie — de omzet loopt op het baantarief.')}
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.label}>{t('Sponsorbudget')}</Text>
          <TextInput style={styles.input} value={budget} onChangeText={setBudget} keyboardType="numeric" />
          <Text style={styles.helper}>
            {t('Leeg is geen sponsorcontract. Wat er nog van over is, rekent de app uit de '
              + 'gesponsorde lessen.')}
          </Text>

          {/* Schrijft meteen weg: het is een keuze uit een rij en geen veld dat je afmaakt. */}
          <Text style={styles.label}>{t('Standaard betaalwijze')}</Text>
          <View style={styles.chipRow}>
            {PAYMENT_METHODS.map((m: PaymentMethod) => (
              <Chip
                key={m}
                label={t(PAYMENT_LABELS[m])}
                selected={(lid.default_payment_method ?? 'open') === m}
                onPress={() => {
                  clearError();
                  void updateUser(lid.id, { default_payment_method: m });
                }}
              />
            ))}
          </View>
          <Text style={styles.helper}>
            {t('Hiermee staat een nieuwe les van deze speler alvast klaar; je kunt het per '
              + 'les nog wijzigen.')}
          </Text>
        </>
      )}

      <View style={styles.actions}>
        <Button
          label={bewaard ? t('Bewaard') : t('Bewaren')}
          onPress={bewaar}
          disabled={!naamOk || !emailOk}
          fullWidth={false}
          icon={<Save size={16} color={tennisColors.onFill} />}
        />
      </View>

      <View style={styles.divider} />

      {/* De rol schrijft meteen weg, net als het vinkje: het is één keuze en geen formulier,
          en een bewaarknop die soms wél en soms niet nodig is, is erger dan geen. */}
      <Text style={styles.label}>{t('Type account')}</Text>
      <View style={styles.chipRow}>
        {(['player', 'coach'] as Role[]).map((r) => (
          <Chip
            key={r}
            label={roleLabel(r)}
            selected={lid.role === r}
            disabled={lid.role !== r && bezwaar !== null}
            onPress={() => {
              if (lid.role === r) return;
              clearError();
              void setUserRole(lid.id, r);
            }}
          />
        ))}
      </View>
      <Text style={styles.helper}>
        {bezwaar
          ?? t('Een trainer heeft een eigen agenda en spelers; een speler niet. Zijn lessen, '
            + 'dossier en betalingen blijven hoe dan ook staan.')}
      </Text>

      <Text style={styles.label}>{t('Beheerder')}</Text>
      <View style={styles.chipRow}>
        <Chip
          label={isAdmin(lid) ? t('Is beheerder') : t('Beheerder maken')}
          selected={isAdmin(lid)}
          disabled={isAdmin(lid) && !vinkjeWegMag}
          onPress={() => {
            clearError();
            void setBeheerder(lid.id, !isAdmin(lid));
          }}
        />
      </View>
      <Text style={styles.helper}>
        {isAdmin(lid) && !vinkjeWegMag
          ? t('Dit is de enige beheerder. Maak eerst iemand anders beheerder; anders komt '
            + 'niemand er nog bij.')
          : t('Een beheerder mag in elke agenda werken, ziet de cijfers van de club en kan '
            + 'hier andere beheerders aanwijzen.')}
      </Text>
      {zelf && isAdmin(lid) && vinkjeWegMag ? (
        <Text style={styles.helper}>
          {t('Dit ben jij: neem je het weg, dan verlies je zelf dit scherm.')}
        </Text>
      ) : null}

      <View style={styles.divider} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {bevestigen ? (
        <View style={styles.confirmBox}>
          <Text style={styles.confirmText}>
            {t('{naam} verwijderen. Weg is weg.', { naam: lid.name })}
            {heeftGevolgen(gevolgen)
              ? ` ${t('Dit gaat mee: {dingen}.', { dingen: gevolgenTekst(gevolgen, t) })}`
              : ` ${t('Er hangt verder niets aan hem.')}`}
          </Text>
          <View style={styles.chipRow}>
            <Button
              label={t('Ja, verwijderen')}
              variant="danger"
              fullWidth={false}
              onPress={() => {
                setBevestigen(false);
                // Pas dichtdoen als het gelukt is: anders is er geen plek meer waar een
                // weigering te lezen valt.
                void deleteUser(lid.id).then(onClose, () => {});
              }}
            />
            <Button
              label={t('Nee')}
              variant="secondary"
              fullWidth={false}
              onPress={() => setBevestigen(false)}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <Button
            label={t('Lid verwijderen')}
            variant="danger"
            fullWidth={false}
            disabled={zelf}
            icon={<Trash2 size={16} color={tennisColors.onFill} />}
            onPress={() => {
              clearError();
              setBevestigen(true);
            }}
          />
        </View>
      )}
      {zelf ? (
        <Text style={styles.helper}>{t('Je eigen account verwijder je hier niet.')}</Text>
      ) : null}
    </DetailSheet>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label, color: tennisColors.textMuted, marginTop: spacing.md },
  input: {
    backgroundColor: tennisColors.background,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: tennisColors.text,
  },
  helper: { ...typography.caption, color: tennisColors.textMuted },
  error: { color: tennisColors.danger, fontSize: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  divider: { height: 1, backgroundColor: tennisColors.border, marginVertical: spacing.lg },
  confirmBox: {
    backgroundColor: tennisColors.dangerTint,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  confirmText: { ...typography.body, color: tennisColors.text },
});
