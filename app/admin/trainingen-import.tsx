// Beheer → Trainingen importeren: een heel seizoen uit Excel, maar pas ná de droogloop.
//
// Dit scherm rekent niets uit. Het kiest een bestand, geeft de bytes aan lib/xlsx-lezen, het
// blad aan lib/import-trainingen, en toont wat daar uitkomt. Dat is dezelfde belofte als
// app/admin/leden-import.tsx maakt, en ze is hier zwaarder: `koen.xlsx` heeft 1398 regels, tien
// lesgroepen en 325 lessen. Een droogloop van 1398 regels is geen droogloop maar een muur —
// vandaar groepen en aantallen (D-09).
//
// De grens staat op dit scherm zelf en niet alleen op de tegel in Beheer: een verborgen tegel is
// geen toegangscontrole, want een trainer kan de link gewoon intikken (D-06). Het is wél de
// beleefde grens en niet de echte — die staat in de policies van supabase-schema.sql
// (`lesson_groups_write` is `is_admin()`), precies zoals lib/rechten.ts uitlegt.

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { useT } from '../../lib/i18n';
import { isAdmin } from '../../lib/rechten';
import { DAY_LABELS } from '../../lib/slots';
import { kanBestandKiezen, kiesBinairBestand } from '../../lib/bestand';
import { shareXlsx, xlsxWordtOndersteund } from '../../lib/share';
import { leesWerkmap } from '../../lib/xlsx-lezen';
import {
  bestandAfgekeurdLessen, geweigerdeNieuweGroepen, kiesLessenBlad, overgeslagenPerReden,
  planImportLessen, voorbeeldTrainingenXlsx,
  type GroepInPlan, type ImportPlanLessen, type ImportUitslagLessen,
} from '../../lib/import-trainingen';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

// Overleeft, anders dan React-state, een her-mount van dit scherm. Bij een ledenlijst is dat
// netjes; hier is het noodzaak. Eén bestand levert 42 spelers, tien groepen en 325 lessen op, en
// een beheerder die tijdens het wegschrijven wegnavigeert en terugkomt mag geen tweede beurt over
// datzelfde bestand krijgen — dat zou de club een tweede stel groepen en lessen opleveren die
// niemand besteld heeft. De uitslag staat om dezelfde reden op moduleniveau: een verse instantie
// heeft nooit gezien wat er op de oude gebeurde, en zou anders "Bezig" voor altijd laten staan of
// de uitslag spoorloos laten verdwijnen.
let importDraait = false;
let laatsteUitslag: ImportUitslagLessen | null = null;
let laatsteMislukking: string | null = null;

type ImportGebeurtenis =
  | { type: 'klaar'; uitslag: ImportUitslagLessen }
  | { type: 'mislukt'; melding: string };

const importLuisteraars = new Set<(gebeurtenis: ImportGebeurtenis) => void>();

function meldImportKlaar(uitslag: ImportUitslagLessen): void {
  importDraait = false;
  laatsteUitslag = uitslag;
  laatsteMislukking = null;
  importLuisteraars.forEach((fn) => fn({ type: 'klaar', uitslag }));
}

/** Ook een mislukking hoort een her-mount te overleven: anders blijft "Bezig" voor altijd staan. */
function meldImportMislukt(melding: string): void {
  importDraait = false;
  laatsteUitslag = null;
  laatsteMislukking = melding;
  importLuisteraars.forEach((fn) => fn({ type: 'mislukt', melding }));
}

/** Wist wat er nog van een eerdere beurt in het geheugen stond, bij elke nieuwe stap. */
function wisLaatsteUitslag(): void {
  laatsteUitslag = null;
  laatsteMislukking = null;
}

export default function TrainingenImport(): React.JSX.Element {
  const t = useT();
  const { currentUser } = useSimpleData();

  // Vóór alles, en vóór elke hook van het scherm zelf: daarom staat de rest in een eigen
  // component hieronder. Zie de kop van dit bestand voor waarom deze grens de beleefde is.
  if (!isAdmin(currentUser)) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>{t('Trainingen importeren is alleen voor de beheerder.')}</Text>
      </Screen>
    );
  }

  return <ImportInhoud />;
}

/** Het uur zoals het op het scherm hoort te staan: 09:00 en niet 9:0. */
function uurTekst(uur: number, minuut: number): string {
  return `${String(uur).padStart(2, '0')}:${String(minuut).padStart(2, '0')}`;
}

function ImportInhoud(): React.JSX.Element {
  const t = useT();
  const { users, courts, bookings, lesGroepen, settings, importeerTrainingen } = useSimpleData();

  const [bestandsnaam, setBestandsnaam] = useState<string>('');
  // De bytes blijven staan zolang het scherm openstaat, en dat is precies wat "opnieuw proberen"
  // mogelijk maakt: het plan wordt dan opnieuw uitgerekend tegen de intussen bijgewerkte lijsten,
  // zonder de beheerder zijn bestand nog eens te laten zoeken.
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [plan, setPlan] = useState<ImportPlanLessen | null>(null);
  const [leesFout, setLeesFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState<boolean>(importDraait);
  const [uitkomst, setUitkomst] = useState<ImportUitslagLessen | null>(null);
  const [mislukking, setMislukking] = useState<string | null>(null);

  useEffect(() => {
    const onGebeurtenis = (g: ImportGebeurtenis): void => {
      setBezig(false);
      if (g.type === 'klaar') { setMislukking(null); setUitkomst(g.uitslag); return; }
      setUitkomst(null);
      setMislukking(g.melding);
    };
    importLuisteraars.add(onGebeurtenis);
    // Hermontage tijdens, of vlak ná, het wegschrijven: haal op wat er al bekend is in plaats
    // van bij nul te beginnen. Eenmalig afleveren: eenmaal getoond hoort een latere, losse
    // opening van dit scherm deze oude uitslag niet nog eens te zien.
    if (!importDraait && laatsteUitslag) {
      const uitslag = laatsteUitslag;
      laatsteUitslag = null;
      setBezig(false);
      setUitkomst(uitslag);
    } else if (!importDraait && laatsteMislukking) {
      const melding = laatsteMislukking;
      laatsteMislukking = null;
      setBezig(false);
      setMislukking(melding);
    }
    return () => { importLuisteraars.delete(onGebeurtenis); };
  }, []);

  if (bezig) {
    return (
      <Screen scroll={false}>
        <Card>
          <Text style={styles.kop}>{t('Bezig met importeren…')}</Text>
          <Text style={styles.uitleg}>
            {t('Dit kan even duren. Blijf op dit scherm tot het klaar is.')}
          </Text>
        </Card>
      </Screen>
    );
  }

  const opnieuw = (): void => {
    wisLaatsteUitslag();
    setBestandsnaam('');
    setBytes(null);
    setPlan(null);
    setLeesFout(null);
    setUitkomst(null);
    setMislukking(null);
  };

  const toonPlan = (naam: string, inhoud: Uint8Array): void => {
    wisLaatsteUitslag();
    setBestandsnaam(naam);
    setBytes(inhoud);
    setUitkomst(null);
    setMislukking(null);
    // Eén melding over het hele bestand als het niet eens een werkmap blijkt: dat is iets
    // anders dan een regel die niet deugt, en het hoort ook anders op het scherm te staan.
    try {
      const blad = kiesLessenBlad(leesWerkmap(inhoud));
      if (!blad) {
        setPlan(null);
        setLeesFout(t('Dit bestand heeft geen enkel blad met lessen erin.'));
        return;
      }
      setLeesFout(null);
      setPlan(planImportLessen(
        blad.rijen, lesGroepen, users, courts, bookings, settings, new Date(),
      ));
    } catch {
      setPlan(null);
      setLeesFout(t('Dit is geen Excel-bestand dat ik kan lezen. Bewaar het in Excel als .xlsx en kies het opnieuw.'));
    }
  };

  /**
   * Het plan opnieuw uitrekenen tegen de lijsten zoals ze nú zijn, uit dezelfde bytes.
   *
   * Dat is D-21 op het scherm: mislukte het wegschrijven halverwege, dan staan de spelers er al
   * en de groepen misschien niet. Dit toont dan wat er nog openstaat, in plaats van de beheerder
   * hetzelfde bestand nog eens te laten zoeken en hem te laten raden of hij nu alles dubbel doet.
   */
  const probeerOpnieuw = (): void => {
    if (bytes !== null) toonPlan(bestandsnaam, bytes);
  };

  const voerUit = async (): Promise<void> => {
    if (!plan || bezig || importDraait) return;
    importDraait = true;
    setBezig(true);
    setMislukking(null);
    try {
      // De keuze reist mee vanaf hier; het vinkje dat hem zet komt in taak 3 van dit plan.
      // Standaard uit: wie doorklikt zonder te lezen doet niets onomkeerbaars (IMP-16).
      meldImportKlaar(await importeerTrainingen(plan, { ingrijpend: false }));
    } catch (e) {
      // `commit` zet de lokale opslag terug en gooit de fout door, maar wat er al bij Supabase
      // stond blijft daar staan. Er wordt hier dus niet gezegd dat er niets gebeurd is — het
      // scherm biedt "Opnieuw proberen" aan en zegt waarom dat het afmaakt (D-21).
      meldImportMislukt(e instanceof Error ? e.message : t('Het wegschrijven is mislukt.'));
    }
  };

  const groepRegel = (g: GroepInPlan): string => {
    const dag = g.weekdag >= 0 && g.weekdag <= 6 ? t(DAY_LABELS[g.weekdag]) : '';
    const spelers = g.aantalSpelers === 1
      ? t('1 speler')
      : t('{n} spelers', { n: g.aantalSpelers });
    return `${g.naam} · ${dag} ${uurTekst(g.beginuur, g.beginminuut)} · ${g.trainerNaam} · ${spelers}`;
  };

  const groepenKaart = (kop: string, groepen: GroepInPlan[]): React.JSX.Element | null => {
    if (groepen.length === 0) return null;
    return (
      <Card>
        <Text style={styles.kop}>{kop}</Text>
        {groepen.map((g) => (
          <Text key={g.groep.sleutel} style={styles.regel}>{groepRegel(g)}</Text>
        ))}
      </Card>
    );
  };

  return (
    <Screen>
      <Card>
        <Text style={styles.kop}>{t('Trainingen importeren')}</Text>
        <Text style={styles.uitleg}>
          {t('Kies het Excel-bestand met een heel seizoen erin: één regel per les en per leerling. Verplicht zijn Datum, Uur, Groep, Coach en Leerling; Type les, Groep-ID, E-mail leerling en Baan mogen erbij.')}
        </Text>
        {xlsxWordtOndersteund ? (
          <Button
            label={t('Voorbeeldbestand downloaden')}
            variant="secondary"
            onPress={() => { void shareXlsx('trainingen-voorbeeld.xlsx', voorbeeldTrainingenXlsx()); }}
          />
        ) : null}
      </Card>

      {plan === null && leesFout === null ? (
        <Card>
          {kanBestandKiezen ? (
            <Button
              label={t('Bestand kiezen')}
              onPress={() => {
                void kiesBinairBestand().then((gekozen) => {
                  if (gekozen !== null) toonPlan(gekozen.naam, gekozen.bytes);
                });
              }}
            />
          ) : (
            // Geen plakvak-terugval zoals bij de ledenimport, en dat kan ook niet: een xlsx is
            // geen tekst maar een zip vol bytes met tabbladen erin. Tab-gescheiden tekst uit
            // Excel plakken levert geen werkmap op. Op een toestel zonder bestandskiezer valt er
            // dus niets te importeren, en dat hoort hier te staan in plaats van een knop die faalt.
            <Text style={styles.uitleg}>
              {t('Op een telefoon of tablet kan hier geen bestand gekozen worden, en een Excel-bestand valt niet te plakken. Doe deze import op een computer, in de browser.')}
            </Text>
          )}
        </Card>
      ) : null}

      {leesFout !== null ? (
        <>
          <Card>
            <Text style={styles.foutKop}>{t('Dit bestand kan niet gebruikt worden')}</Text>
            <Text style={styles.fout}>{leesFout}</Text>
          </Card>
          <Card>
            <Button label={t('Ander bestand')} variant="secondary" onPress={opnieuw} />
          </Card>
        </>
      ) : null}

      {plan !== null && bestandAfgekeurdLessen(plan) ? (
        <>
          <Card>
            <Text style={styles.foutKop}>{t('Dit bestand kan niet gebruikt worden')}</Text>
            <Text style={styles.fout}>{t(plan.fouten[0].reden, plan.fouten[0].vars)}</Text>
          </Card>
          <Card>
            <Button label={t('Ander bestand')} variant="secondary" onPress={opnieuw} />
          </Card>
        </>
      ) : null}

      {plan !== null && !bestandAfgekeurdLessen(plan) ? (
        <PlanInBeeld
          plan={plan}
          bestandsnaam={bestandsnaam}
          uitkomst={uitkomst}
          mislukking={mislukking}
          groepenKaart={groepenKaart}
          onAnderBestand={opnieuw}
          onImporteren={() => { void voerUit(); }}
          onOpnieuwProberen={probeerOpnieuw}
        />
      ) : null}
    </Screen>
  );
}

/**
 * De droogloop zelf: wat dit bestand met de club zou doen, in groepen en aantallen.
 *
 * Apart gehouden omdat het de enige plek is waar veel op het scherm komt, en omdat de volgorde
 * ervan een afspraak is (`.planning/IMPORT-SJABLOON.md`): eerst de groepen, dan de spelers, dan
 * de lessen, dan wat de beheerder met de hand moet nakijken, en pas daarna wat er misging.
 */
function PlanInBeeld({
  plan, bestandsnaam, uitkomst, mislukking, groepenKaart,
  onAnderBestand, onImporteren, onOpnieuwProberen,
}: {
  plan: ImportPlanLessen;
  bestandsnaam: string;
  uitkomst: ImportUitslagLessen | null;
  mislukking: string | null;
  groepenKaart: (kop: string, groepen: GroepInPlan[]) => React.JSX.Element | null;
  onAnderBestand: () => void;
  onImporteren: () => void;
  onOpnieuwProberen: () => void;
}): React.JSX.Element {
  const t = useT();
  // De bevestiging staat hier en niet in de provider: er wordt pas iets weggeschreven nadat de
  // beheerder deze droogloop gezien heeft én daarna nog een keer uitdrukkelijk ja zegt.
  const [bevestigen, setBevestigen] = useState<boolean>(false);
  const overgeslagen = overgeslagenPerReden(plan);
  const nietsNieuws = plan.groepenNieuw.length === 0
    && plan.groepenBijgewerkt.length === 0
    && plan.spelersNieuw.length === 0
    && plan.nieuweLessen.length === 0
    // Een bestand dat alleen een andere Coach noemt maakt niets nieuws aan en werkt toch iets
    // bij: zonder deze regel staat de knop Importeren uit en is de trainerwissel onbereikbaar.
    && plan.trainerwissels.length === 0;
  // Deze tien zinnen horen náást de tien nieuwe groepen te staan en niet erna. Zonder ze leest
  // een beheerder "tien nieuwe lesgroepen", drukt hij op Importeren en krijgt hij er nul.
  const geweigerd = geweigerdeNieuweGroepen(plan);

  return (
    <>
      <Card>
        <Text style={styles.kop}>{uitkomst ? t('Resultaat') : t('Dit gaat er gebeuren')}</Text>
        {bestandsnaam ? <Text style={styles.mededeling}>{bestandsnaam}</Text> : null}
        {uitkomst ? (
          <Text style={styles.telling}>
            {t('{groepen} lesgroepen aangemaakt, {bijgewerkt} bijgewerkt, {spelers} spelers erbij, {lessen} lessen ingepland, {gewisseld} lessen kregen een andere trainer.', {
              groepen: uitkomst.nieuweGroepen,
              bijgewerkt: uitkomst.bijgewerkteGroepen,
              spelers: uitkomst.spelers,
              lessen: uitkomst.lessen,
              gewisseld: uitkomst.bijgewerkteLessen,
            })}
          </Text>
        ) : (
          <>
            <Text style={styles.telling}>
              {t('{nieuw} nieuwe lesgroepen, {bijgewerkt} bijgewerkt, {ongewijzigd} ongewijzigd.', {
                nieuw: plan.groepenNieuw.length,
                bijgewerkt: plan.groepenBijgewerkt.length,
                ongewijzigd: plan.groepenOngewijzigd.length,
              })}
            </Text>
            <Text style={styles.telling}>
              {t('{spelers} nieuwe spelers, {lessen} lessen ingepland.', {
                spelers: plan.spelersNieuw.length,
                lessen: plan.nieuweLessen.length,
              })}
            </Text>
          </>
        )}
        <Text style={styles.mededeling}>
          {t('{n} lessen staan al goed en blijven zoals ze zijn.', { n: plan.ongewijzigdeLessen.length })}
        </Text>
        <Text style={styles.mededeling}>
          {t('{vakantie} vallen in een clubvakantie, {bezet} botsen met een bezette trainer of baan, {verleden} zijn al geweest.', {
            vakantie: overgeslagen.vakantie,
            bezet: overgeslagen.bezet,
            verleden: overgeslagen.verleden,
          })}
        </Text>
        {plan.nietHerkend.length > 0 ? (
          <Text style={styles.mededeling}>
            {t('Deze kolommen herken ik niet en komen niet mee: {koppen}', { koppen: plan.nietHerkend.join(', ') })}
          </Text>
        ) : null}
        {plan.dubbel.length > 0 ? (
          <Text style={styles.mededeling}>
            {t('Deze kolommen staan er twee keer; ik lees alleen de eerste: {koppen}', { koppen: plan.dubbel.join(', ') })}
          </Text>
        ) : null}
      </Card>

      {geweigerd.length > 0 && !uitkomst ? (
        <Card>
          {/* Meteen onder de aantallen, want dit corrigeert ze: de droogloop telt tien nieuwe
              groepen en dit zegt hoeveel daarvan er vandaag niet komen. Dezelfde controle die
              `addLesGroep` doet, en dezelfde zinnen die de uitvoerder straks zou geven. */}
          <Text style={styles.foutKop}>{t('Deze lesgroepen worden niet aangemaakt')}</Text>
          <Text style={styles.fout}>
            {t('{n} van de nieuwe lesgroepen hierboven komen er nu niet, en hun lessen dus ook niet.', { n: geweigerd.length })}
          </Text>
          {geweigerd.map((g) => (
            <Text key={g.inPlan.groep.sleutel} style={styles.fout}>
              {t('Regel {regel}', { regel: g.fout.regel })}: {t(g.fout.reden, g.fout.vars)}
            </Text>
          ))}
          <Text style={styles.mededeling}>
            {t('Ontbreekt de trainer? Geef hem eerst een traineraccount in Beheer en kies daarna hetzelfde bestand opnieuw; dan komen deze groepen er alsnog bij.')}
          </Text>
        </Card>
      ) : null}

      {groepenKaart(t('Nieuwe lesgroepen'), plan.groepenNieuw)}
      {groepenKaart(t('Lesgroepen die bijgewerkt worden'), plan.groepenBijgewerkt)}
      {groepenKaart(t('Lesgroepen die niet veranderen'), plan.groepenOngewijzigd)}

      {plan.spelersNieuw.length > 0 ? (
        <Card>
          <Text style={styles.kop}>
            {plan.spelersNieuw.length === 1
              ? t('1 nieuwe speler')
              : t('{n} nieuwe spelers', { n: plan.spelersNieuw.length })}
          </Text>
          <Text style={styles.regel}>{plan.spelersNieuw.map((s) => s.naam).join(', ')}</Text>
        </Card>
      ) : null}

      {plan.trainerwissels.length > 0 ? (
        <Card>
          {/* De belofte van deze fase, en de reden dat ze zichtbaar is en niet slim (D-10): het
              bestand noemt een andere Coach, en dat wordt een wijziging op bestaande lessen in
              plaats van een tweede groep. Het aantal komt uit `plan.trainerwissels` — dezelfde
              lijst die straks weggeschreven wordt — zodat wat hier staat hetzelfde is als wat er
              gebeurt. Het scherm telt hier zelf niets. */}
          <Text style={styles.waarschuwKop}>{t('Deze lesgroepen krijgen een andere trainer')}</Text>
          {plan.trainerwissels.map((w) => (
            <Text key={`${w.groep}-${w.trainerId}`} style={styles.waarschuwing}>
              {w.van
                ? t('{groep}: {aantal} komende lessen gaan van {van} naar {naar}.', {
                  groep: w.groep, aantal: w.aantal, van: w.van, naar: w.naar,
                })
                : t('{groep}: {aantal} komende lessen krijgen {naar}.', {
                  groep: w.groep, aantal: w.aantal, naar: w.naar,
                })}
            </Text>
          ))}
          <Text style={styles.mededeling}>
            {t('Lessen die al geweest zijn veranderen niet, en wie een les werkelijk gaf blijft staan zoals het staat.')}
          </Text>
        </Card>
      ) : null}

      {plan.handmatigGewijzigd.length > 0 ? (
        <Card>
          {/* Hierover beslist de beheerder zelf (IMP-08). Het bestand overrulet een les die met
              de hand verzet of afgezegd is nooit — anders zou een import het werk van een week
              stilzwijgend terugdraaien (D-13). */}
          <Text style={styles.waarschuwKop}>{t('Met de hand verzet of afgezegd; dit blijft zoals het staat')}</Text>
          {plan.handmatigGewijzigd.map((h) => (
            <Text key={`${h.groep}-${h.dag}`} style={styles.waarschuwing}>
              {t('{groep} op {dag}: staat op {bestaandeTijd}, het bestand zegt {tijdInBestand}.', {
                groep: h.groep, dag: h.dag, bestaandeTijd: h.bestaandeTijd, tijdInBestand: h.tijdInBestand,
              })}
            </Text>
          ))}
        </Card>
      ) : null}

      {plan.verdwenenUitBestand.length > 0 ? (
        <Card>
          {/* Een melding en nooit een opdracht: de import maakt aan en werkt bij, en wist nooit
              iets (D-13). Wie zo een les weg wil, doet dat met de hand in de agenda. */}
          <Text style={styles.waarschuwKop}>{t('Deze lessen staan in de app maar niet meer in het bestand')}</Text>
          <Text style={styles.mededeling}>{t('Ze blijven staan; een import haalt nooit iets weg.')}</Text>
          {plan.verdwenenUitBestand.map((v) => (
            <Text key={v.id} style={styles.waarschuwing}>
              {t('{groep} op {dag} om {tijd}.', { groep: v.groep, dag: v.dag, tijd: v.tijd })}
            </Text>
          ))}
        </Card>
      ) : null}

      {plan.waarschuwingen.length > 0 ? (
        <Card>
          <Text style={styles.waarschuwKop}>{t('Kijk deze regels even na')}</Text>
          {plan.waarschuwingen.map((w) => (
            <Text key={`w-${w.regel}-${w.reden}`} style={styles.waarschuwing}>
              {t('Regel {regel}', { regel: w.regel })}: {t(w.reden, w.vars)}
            </Text>
          ))}
        </Card>
      ) : null}

      {plan.fouten.length > 0 ? (
        <Card>
          <Text style={styles.foutKop}>
            {uitkomst ? t('Deze regels zijn overgeslagen') : t('Deze regels worden overgeslagen')}
          </Text>
          {plan.fouten.map((f) => (
            <Text key={`f-${f.regel}-${f.reden}`} style={styles.fout}>
              {t('Regel {regel}', { regel: f.regel })}: {t(f.reden, f.vars)}
            </Text>
          ))}
        </Card>
      ) : null}

      {uitkomst && uitkomst.fouten.length > 0 ? (
        <Card>
          <Text style={styles.foutKop}>{t('Dit is niet weggeschreven')}</Text>
          {uitkomst.fouten.map((f) => (
            <Text key={`u-${f.regel}-${f.reden}`} style={styles.fout}>
              {t('Regel {regel}', { regel: f.regel })}: {t(f.reden, f.vars)}
            </Text>
          ))}
        </Card>
      ) : null}

      {mislukking !== null ? (
        <Card>
          <Text style={styles.foutKop}>{t('Het wegschrijven is halverwege misgegaan')}</Text>
          <Text style={styles.fout}>{mislukking}</Text>
          <Text style={styles.uitleg}>
            {t('Wat er al weggeschreven was, blijft staan. Er komt niets dubbel bij: kies hieronder Opnieuw proberen, dan zie je wat er nog openstaat.')}
          </Text>
        </Card>
      ) : null}

      {uitkomst || mislukking !== null ? (
        <Card>
          {/* Opnieuw proberen rekent het plan opnieuw uit tegen de intussen bijgewerkte lijsten,
              uit dezelfde bytes. Zo staat er precies wat er nog te doen is: elke speler wordt op
              zijn naam herkend, elke groep op haar sleutel of haar Groep-ID, en elke les op groep
              + dag + beginuur. Niets wordt blind toegevoegd. */}
          {mislukking !== null || (uitkomst && uitkomst.fouten.length > 0) ? (
            <Button label={t('Opnieuw proberen')} onPress={onOpnieuwProberen} />
          ) : null}
          <Button
            label={t('Nieuwe import')}
            variant="secondary"
            onPress={onAnderBestand}
            style={styles.knop}
          />
        </Card>
      ) : bevestigen ? (
        <Card>
          <Text style={styles.kop}>{t('Zeker weten?')}</Text>
          <Text style={styles.uitleg}>
            {t('Hierna staan de spelers, de lesgroepen en de lessen hierboven echt in de app, en krijgen de genoemde komende lessen hun nieuwe trainer.')}
          </Text>
          <Button label={t('Ja, nu importeren')} onPress={onImporteren} />
          <Button
            label={t('Nee, toch niet')}
            variant="secondary"
            onPress={() => setBevestigen(false)}
            style={styles.knop}
          />
        </Card>
      ) : (
        <Card>
          {/* De operationele afspraak van de ledenimport geldt hier net zo goed, en zwaarder: dit
              maakt in één keer tientallen spelersaccounts aan. Zie .planning/codebase/CONCERNS.md
              — de app kan die instelling niet zelf nakijken, dus staat ze hier als herinnering. */}
          <Text style={styles.mededeling}>
            {t('Zet in Supabase eerst "Confirm email" aan. Deze import maakt spelersaccounts aan voor die mensen zelf ooit ingelogd hebben, en zonder die instelling kan iemand met hun e-mailadres zo een account claimen.')}
          </Text>
          <Button label={t('Importeren')} disabled={nietsNieuws} onPress={() => setBevestigen(true)} />
          {/* Geen belofte over een transactie die deze app niet heeft (D-21): er is geen
              kruistabel-transactie, en die kan er niet komen zonder SQL. Wat er wél is, is dat
              opnieuw inlezen het afmaakt — en dat staat er dus in gewone taal. */}
          <Text style={styles.uitleg}>
            {t('Eerst gaan de spelers weg, dan de lesgroepen, dan de lessen. Gaat er onderweg iets mis, dan blijft staan wat er al stond en komt er niets dubbel bij: hetzelfde bestand nog een keer inlezen maakt het af. Het is dus veilig om opnieuw te draaien, maar het is geen import die zichzelf in één keer terugdraait.')}
          </Text>
          <Button label={t('Ander bestand')} variant="secondary" onPress={onAnderBestand} />
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  muted: { color: tennisColors.textMuted, fontSize: 14 },
  kop: { ...typography.h3, color: tennisColors.text },
  uitleg: {
    fontSize: 14,
    color: tennisColors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  knop: { marginTop: spacing.md },
  telling: { ...typography.h3, color: tennisColors.primary, marginBottom: spacing.sm },
  regel: { fontSize: 14, color: tennisColors.text, marginTop: spacing.xs },
  mededeling: { fontSize: 14, color: tennisColors.textMuted, marginBottom: spacing.sm },
  waarschuwKop: { ...typography.h3, color: tennisColors.text },
  waarschuwing: { fontSize: 14, color: tennisColors.textMuted, marginTop: spacing.xs },
  foutKop: { ...typography.h3, color: tennisColors.danger },
  fout: { fontSize: 14, color: tennisColors.danger, marginTop: spacing.xs },
});
