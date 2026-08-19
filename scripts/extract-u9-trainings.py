import pdfplumber, re, json

HEAD=['N°','Duur','Situatie','Bedoeling','Omschrijving','Kwaliteit','Organ./Mat.']

TITLES = {
1:"Ruimte gebruiken en tijd knippen",
2:"Diep gekruist verdedigen",
3:"Dubbelspel: basisposities en volley door het midden",
4:"Dubbelspel: aanpassen aan de bal van je partner",
5:"Dubbelspel: basisposities met terugslag 2",
6:"Druk vergroten door op te komen",
7:"Diep gekruist verdedigen met terugslag 2 en bal 4",
8:"Diep centraal verdedigen",
9:"Voordeelsituatie herkennen en de gepaste keuze maken",
10:"Druk vergroten door op te komen, met opslag 1",
11:"Van rallyzone naar aanvalszone",
12:"Snelle voor- en achterwaartse verplaatsingen (drop-lob)",
13:"Neutraliseren vanuit de verdedigingszone",
14:"Herpositioneren op basis van balkwaliteit",
15:"Tijd geven vanuit de verdedigingszone",
16:"Dubbelspel: basisposities",
17:"Dubbelspel: opbouwen naar de achterlijn voor de netspeler",
18:"Dubbelspel: rechtdoor aanvallen met de netspeler",
19:"Drivevolley rechtdoor met forehand en backhand",
20:"Enkelspel: vaardigheden toepassen in spelsituaties",
21:"Diep gekruist neutraliseren na achterwaartse verplaatsing",
22:"Diep gekruist neutraliseren onder ruimte- en tijdsdruk",
23:"Neutraliseren met routine en ritueel bij de start",
24:"Serveren in de backhand van de tegenstander",
25:"De bal opzoeken met de benen om aan te vallen",
26:"Aanvallen na de bal opzoeken, onder tijdsdruk",
27:"Dubbelspel: diepe centrale bal laat de netspeler tussenkomen",
28:"Dubbelspel: netspeler schuift mee",
29:"Dubbelspel: scoren aan het net met volley of smash",
30:"Dubbelspel: opbouw naar de achterlijn met aangepaste netspeler",
31:"Sterk starten met opslag 1, diep neutraliseren met terugslag 1",
32:"Snel aanpassen tussen aanval en verdediging",
33:"Van uitwisselen naar aanvallen: opbouwen in de lengte",
34:"Van uitwisselen naar aanvallen: de 3/4 bal",
35:"Van uitwisselen naar aanvallen: druk kiezen naar terreinmogelijkheid",
36:"Van uitwisselen naar aanvallen met OPEN/OPEN bij opslag 1",
37:"Van verdedigen naar uitwisselen: gekruist na voorwaartse verplaatsing",
38:"Van verdedigen naar uitwisselen: met ruim traject",
39:"Van verdedigen naar uitwisselen: minstens in nulsituatie komen",
40:"Drive volley spelen en verdedigen met druk",
41:"Graveltennis: aanval inzetten en scoren aan het net",
42:"Graveltennis: opkomen en afmaken aan het net",
43:"Graveltennis: SNEL/SNEL laten leiden tot aanvallen",
44:"Graveltennis: glijden naar verre ballen",
45:"Verdedigen tegen een opkomende netspeler",
46:"Tijd kopen met een diepe centrale bal",
47:"Diepe centrale bal met backhand slice",
48:"Tegenstander uit het terrein met de 3/4 bal",
49:"Vast zijn in uitwisselen en aanvallen met de 3/4 bal",
50:"Getrainde vaardigheden toepassen in spelsituaties",
51:"Lengtecontrole en de 3/4 bal in spelsituaties",
}

def flat(c):
    if not c: return ''
    return re.sub(r'\s*\n\s*', ' ', c).strip()

def lines(c):
    if not c: return []
    return [l.strip() for l in c.split('\n') if l.strip()]

def ts(v):
    return "'" + v.replace('\\','\\\\').replace("'", "\\'") + "'"

out=[]
with pdfplumber.open('KDT tennisplanning U9 eindversie.pdf') as pdf:
    for pi,page in enumerate(pdf.pages, start=1):
        table=None
        for t in page.extract_tables():
            if any([flat(c) for c in r][:7]==HEAD for r in t):
                table=t; break
        assert table, f'geen tabel op pagina {pi}'
        hi=next(i for i,r in enumerate(table) if [flat(c) for c in r][:7]==HEAD)
        focus=materials=[]
        focus, materials = [], []
        for r in table[:hi]:
            f0 = (r[0] or '').strip()
            if f0 and f0 != 'Aandachtspunten training' and not focus:
                focus = lines(r[0])
            m5 = (r[5] or '').strip() if len(r) > 5 else ''
            if m5 and m5 != 'Materiaal per terrein' and not materials:
                materials = lines(r[5])
        ex=[]
        for r in table[hi+1:]:
            cells=[flat(c) for c in r[:7]]
            if not any(cells): continue
            ex.append(cells)
        out.append((pi, TITLES[pi], focus, materials, ex))

L=[]
L.append("// Gegenereerd uit 'KDT tennisplanning U9 eindversie.pdf' — 51 trainingen van 1u30.")
L.append("// Elke pagina van het boekje is één les. De kolommen van de tabel staan als losse")
L.append("// velden op TrainingExercise, zodat elk scherm ze apart kan tonen.")
L.append("// Niet met de hand bijwerken: pas het PDF-script aan en genereer opnieuw.")
L.append("import type { Lesson } from './types';")
L.append('')
L.append('export const U9_CATALOGUE_ID = \'u9-kdt-v1\';')
L.append('')
L.append('export const u9Trainings: Lesson[] = [')
for pi,title,focus,materials,ex in out:
    L.append('  {')
    L.append(f"    id: 'l-u9-{pi:02d}',")
    L.append(f"    title: {ts(title)},")
    L.append(f"    description: {ts(' '.join(focus))},")
    L.append("    uploaded_by: 'u-koen',")
    L.append("    coach_id: 'u-koen',")
    L.append(f"    training_number: {pi},")
    L.append("    duration_minutes: 90,")
    L.append("    focus_points: [")
    for f in focus: L.append(f"      {ts(f)},")
    L.append("    ],")
    L.append("    materials: [")
    for m in materials: L.append(f"      {ts(m)},")
    L.append("    ],")
    L.append("    exercises: [")
    for c in ex:
        L.append("      {")
        L.append(f"        nr: {ts(c[0])}, duration: {ts(c[1])}, situation: {ts(c[2])},")
        L.append(f"        purpose: {ts(c[3])},")
        L.append(f"        description: {ts(c[4])},")
        L.append(f"        quality: {ts(c[5])},")
        L.append(f"        organisation: {ts(c[6])},")
        L.append("      },")
    L.append("    ],")
    L.append('  },')
L.append('];')
L.append('')
open('lib/trainings-u9.ts','w').write('\n'.join(L))
print('geschreven:', sum(len(e[4]) for e in out), 'oefeningen over', len(out), 'trainingen')
