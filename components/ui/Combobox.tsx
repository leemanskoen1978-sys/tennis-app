// Typ en kies er één uit: een combobox voor een lijst waar chips niet meer op kunnen.
//
// Waarom hij bestaat: de club heeft 193 lesgroepen, waarvan tientallen letterlijk "Groep" of
// "Priveles" heten. Als rij chips is dat een muur waarin niemand iets terugvindt, ook niet met
// een bovengrens erop — je krijgt dan een willekeurige twaalf te zien. Typen en kiezen laat de
// lijst pas zien wat je zocht.
//
// Het zoeken zelf komt uit lib/zoeken: woorden in willekeurige volgorde, accenten genegeerd, net
// als in de ledenlijst. Zo vindt "priveles wo" de groep "Privéles · Wo 15:00", en gedraagt dit
// veld zich hetzelfde als elk ander zoekveld in de app.
//
// Generiek in `T` met een `label`-functie erbij: trainers, groepen en wat er later nog bijkomt
// zijn drie lijsten die niets met elkaar te maken hebben behalve dat je erin zoekt.
//
// NIET TE VERWARREN MET `StudentCombobox`. Die is ouder, hangt aan `User`, zoekt met een simpele
// `includes` (dus zonder accenten en zonder woordvolgorde) en kan bovendien een onbekende naam
// aanbieden om aan te maken. Dat laatste is waarom hij nog bestaat. Wie een nieuwe kiezer nodig
// heeft, neemt deze.

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { X, Check } from 'lucide-react-native';

import { zoekOp } from '../../lib/zoeken';
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, minTapTarget, webCursor } from '../../constants/theme';

/** Hoeveel treffers de lijst hoogstens toont. Meer is scrollen in een scrollend blad. */
const MAX_TREFFERS = 6;

export function Combobox<T extends { id: string }>({
  items, label, value, onChange, plaatshouder, leeghint,
}: {
  items: readonly T[];
  label: (item: T) => string;
  /** Het gekozen id, of `null` als er niets gekozen is. */
  value: string | null;
  onChange: (id: string | null) => void;
  plaatshouder: string;
  /** Wat er staat als er niets gekozen is. Zonder deze regel is "niets" niet te zien. */
  leeghint: string;
}): React.JSX.Element {
  const t = useT();
  const gekozen = items.find((i) => i.id === value) ?? null;
  const [query, setQuery] = useState(gekozen ? label(gekozen) : '');
  const [open, setOpen] = useState(false);

  const treffers = useMemo(
    () => zoekOp(items, query, label).slice(0, MAX_TREFFERS),
    [items, query, label],
  );

  const kies = (item: T): void => {
    onChange(item.id);
    setQuery(label(item));
    setOpen(false);
  };

  const wis = (): void => {
    onChange(null);
    setQuery('');
    setOpen(true);
  };

  // De lijst blijft dicht zolang er staat wat je gekozen hebt: anders hangt er een lijst onder
  // een veld dat al af is, en dat leest als "je moet nog kiezen".
  const lijstOpen = open && treffers.length > 0
    && !(gekozen !== null && query === label(gekozen));

  return (
    <View>
      <View style={styles.veldRij}>
        <TextInput
          style={styles.veld}
          value={query}
          onChangeText={(tekst) => {
            setQuery(tekst);
            setOpen(true);
            // Doortypen maakt de vorige keuze ongeldig — anders stuur je iets door waar je
            // niet meer naar kijkt.
            if (value !== null) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          placeholder={plaatshouder}
          placeholderTextColor={tennisColors.textMuted}
          autoCapitalize="none"
        />
        {query.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Wissen')}
            onPress={wis}
            style={[styles.wis, webCursor]}
          >
            <X size={18} color={tennisColors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {lijstOpen ? (
        <View style={styles.lijst}>
          {treffers.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={label(item)}
              onPress={() => kies(item)}
              style={({ pressed }) => [styles.rij, webCursor, pressed && styles.rijIngedrukt]}
            >
              <Text style={styles.rijTekst}>{label(item)}</Text>
              {value === item.id ? <Check size={16} color={tennisColors.primary} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={styles.hint}>
        {gekozen ? `${t('Gekozen')}: ${label(gekozen)}` : leeghint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  veldRij: { position: 'relative', justifyContent: 'center' },
  veld: {
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10, paddingRight: 40,
    fontSize: 15, color: tennisColors.text, backgroundColor: tennisColors.surface,
    minHeight: minTapTarget,
  },
  wis: { position: 'absolute', right: 8, padding: 6 },
  lijst: {
    marginTop: spacing.xs, borderWidth: 1, borderColor: tennisColors.border,
    borderRadius: radius.sm, backgroundColor: tennisColors.surface, overflow: 'hidden',
  },
  rij: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: minTapTarget, paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: tennisColors.border,
  },
  rijIngedrukt: { backgroundColor: tennisColors.primaryTint },
  rijTekst: { fontSize: 15, color: tennisColors.text },
  hint: { fontSize: 12, color: tennisColors.textMuted, marginTop: spacing.xs },
});
