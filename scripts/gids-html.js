// De deelbare webpagina van de handleiding, gemaakt uit lib/handleiding.ts.
//
// Waarom gegenereerd en niet met de hand geschreven: dezelfde tekst staat in de app (Beheer
// → Handleiding) en op deze pagina. Twee kopieën lopen uit elkaar zodra iemand er één
// bijwerkt, en een handleiding die niet meer klopt is erger dan geen.
//
// Draaien:  node scripts/gids-html.js > trainersgids.html
//
// De tekst wordt uit het TypeScript-bestand gelezen zonder het te compileren: lib/i18n trekt
// React mee en dat hoort niet in een bouwscriptje. Er wordt dus geknipt op de twee arrays,
// en de vorm daarvan is eenvoudig genoeg om betrouwbaar te lezen — mislukt dat, dan stopt
// dit script met een foutmelding in plaats van met een halve pagina.

const fs = require('fs');
const path = require('path');

const bron = fs.readFileSync(path.join(__dirname, '..', 'lib', 'handleiding.ts'), 'utf8');

/** Eén array met hoofdstukken uit het bestand halen en tot JavaScript maken. */
function leesGids(naam) {
  const start = bron.indexOf(`const ${naam}: Gidsstuk[] = [`);
  if (start < 0) throw new Error(`De gids "${naam}" staat niet in lib/handleiding.ts.`);
  // Let op: niet de eerste '[' na de naam — dat is die van `Gidsstuk[]`.
  const open = bron.indexOf('= [', start) + 2;
  let diepte = 0;
  let eind = -1;
  for (let i = open; i < bron.length; i++) {
    if (bron[i] === '[') diepte++;
    else if (bron[i] === ']') {
      diepte--;
      if (diepte === 0) { eind = i + 1; break; }
    }
  }
  if (eind < 0) throw new Error(`De gids "${naam}" is niet netjes afgesloten.`);
  // De inhoud is een letterlijke array met tekst en aaneengeplakte stukken; `Function`
  // evalueert dat zonder dat er iets uit de app bij nodig is.
  // eslint-disable-next-line no-new-func
  return new Function(`return ${bron.slice(open, eind)};`)();
}

const GIDSEN = [
  { rol: 'coach', label: 'Voor trainers', stukken: leesGids('TRAINER') },
  { rol: 'player', label: 'Voor spelers', stukken: leesGids('SPELER') },
];

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function stukHtml(stuk) {
  const delen = stuk.delen.map((d) => `
        <li>
          <span class="waar">${esc(d.waar)}</span>
          <div>
            <h3>${esc(d.kop)}</h3>
            ${d.tekst.map((p) => `<p>${esc(p)}</p>`).join('\n            ')}
          </div>
        </li>`).join('');

  const waarschuwing = stuk.waarschuwing ? `
      <div class="let-op">
        <span class="kop">${esc(stuk.waarschuwing.kop)}</span>
        ${stuk.waarschuwing.tekst.map((p) => `<p>${esc(p)}</p>`).join('\n        ')}
      </div>` : '';

  return `
    <section id="${esc(stuk.id)}">
      <span class="plaats">${esc(stuk.plaats)}</span>
      <h2>${esc(stuk.titel)}</h2>
      ${stuk.leidraad ? `<p class="leidraad">${esc(stuk.leidraad)}</p>` : ''}
      <ul class="paden">${delen}
      </ul>${waarschuwing}
    </section>`;
}

function gidsHtml(g) {
  return `
  <div class="gids" data-rol="${g.rol}">
    <nav class="wegwijzer" aria-label="Inhoud — ${esc(g.label)}">
      <ol>
        ${g.stukken.map((s) => `<li><a href="#${esc(s.id)}">${esc(s.titel)}</a></li>`).join('\n        ')}
      </ol>
    </nav>
    <main class="inhoud">${g.stukken.map(stukHtml).join('\n')}
    </main>
  </div>`;
}

process.stdout.write(`<title>Tennisapp-gids</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Mono:wght@500&family=Literata:opsz,wght@7..72,400;7..72,600&display=swap">

<style>
  :root {
    --groen: #2F7D34; --groen-diep: #245C29; --groen-vlek: #E8F1E6;
    --klei: #C56B3E; --klei-vlek: #FAF0DE; --klei-inkt: #8F4A26;
    --grond: #F6F8F4; --blad: #FFFFFF;
    --inkt: #16221A; --inkt-zacht: #55655A;
    --lijn: #E2E9DD; --lijn-hard: #CBD8C6;
    --display: "Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif;
    --lees: "Literata", Georgia, "Times New Roman", serif;
    --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
    --kolom: 40rem;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --groen: #57B25D; --groen-diep: #8ACF8F; --groen-vlek: #1D2C21;
      --klei: #DE8F63; --klei-vlek: #2B2414; --klei-inkt: #E0A63F;
      --grond: #0E1411; --blad: #171F1A;
      --inkt: #E7EEE8; --inkt-zacht: #A2B2A7;
      --lijn: #2B372F; --lijn-hard: #3C4C41;
    }
  }
  :root[data-theme="dark"] {
    --groen: #57B25D; --groen-diep: #8ACF8F; --groen-vlek: #1D2C21;
    --klei: #DE8F63; --klei-vlek: #2B2414; --klei-inkt: #E0A63F;
    --grond: #0E1411; --blad: #171F1A;
    --inkt: #E7EEE8; --inkt-zacht: #A2B2A7;
    --lijn: #2B372F; --lijn-hard: #3C4C41;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0; background: var(--grond); color: var(--inkt);
    font-family: var(--lees); font-size: 17px; line-height: 1.62;
    -webkit-font-smoothing: antialiased;
  }

  .omslag { max-width: 78rem; margin: 0 auto; padding: 0 1.5rem 6rem; }

  .masthead {
    border-bottom: 1px solid var(--lijn); padding: 3.5rem 0 2rem;
    display: flex; flex-direction: column; gap: 1rem;
  }
  .stempel {
    font-family: var(--mono); font-size: 0.7rem; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--groen);
  }
  h1 {
    font-family: var(--display); font-weight: 700;
    font-size: clamp(2.6rem, 7vw, 4.25rem); line-height: 0.98;
    letter-spacing: -0.02em; margin: 0; text-wrap: balance;
  }
  .onderkop { max-width: var(--kolom); font-size: 1.075rem; color: var(--inkt-zacht); margin: 0; }

  /* de schakelaar tussen de twee gidsen */
  .schakelaar { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
  .schakelaar button {
    font-family: var(--mono); font-size: 0.74rem; letter-spacing: 0.06em;
    text-transform: uppercase; cursor: pointer;
    padding: 0.55rem 1rem; border-radius: 999px;
    border: 1px solid var(--lijn-hard); background: var(--blad); color: var(--inkt-zacht);
  }
  .schakelaar button[aria-pressed="true"] {
    background: var(--groen); border-color: var(--groen); color: #FFFFFF;
  }
  .kopieerknop { border-style: dashed; }
  .melding {
    align-self: center; font-family: var(--mono); font-size: 0.72rem;
    color: var(--groen); letter-spacing: 0.03em;
  }

  .gids { display: none; gap: 3rem; padding-top: 3rem; }
  .gids.actief { display: grid; grid-template-columns: 1fr; }
  @media (min-width: 62rem) {
    .gids.actief { grid-template-columns: 13.5rem minmax(0, 1fr); column-gap: 4rem; }
    .wegwijzer { display: block; }
  }

  .wegwijzer {
    display: none; position: sticky; top: 2rem; align-self: start;
    font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.04em;
  }
  .wegwijzer ol {
    list-style: none; margin: 0; padding: 0;
    display: flex; flex-direction: column; gap: 0.55rem; border-left: 1px solid var(--lijn);
  }
  .wegwijzer a {
    display: block; padding: 0.1rem 0 0.1rem 0.85rem; margin-left: -1px;
    border-left: 2px solid transparent; color: var(--inkt-zacht); text-decoration: none;
  }
  .wegwijzer a:hover, .wegwijzer a:focus-visible { color: var(--groen); border-left-color: var(--groen); }

  .inhoud { min-width: 0; display: flex; flex-direction: column; gap: 3.5rem; }
  section { scroll-margin-top: 1.5rem; }

  .plaats {
    font-family: var(--mono); font-size: 0.7rem; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--groen); display: block; margin-bottom: 0.4rem;
  }
  h2 {
    font-family: var(--display); font-weight: 700;
    font-size: clamp(1.6rem, 3.4vw, 2.15rem); line-height: 1.1;
    letter-spacing: -0.015em; margin: 0 0 0.75rem; text-wrap: balance;
  }
  h3 {
    font-family: var(--display); font-weight: 500; font-size: 1.14rem;
    line-height: 1.25; margin: 0 0 0.35rem;
  }
  p { max-width: var(--kolom); margin: 0 0 1rem; }

  .leidraad {
    max-width: var(--kolom); color: var(--inkt-zacht); font-size: 1.02rem;
    margin-bottom: 1.75rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--lijn);
  }

  .paden { list-style: none; margin: 0; padding: 0; max-width: var(--kolom); }
  .paden li {
    display: grid; gap: 0.15rem 1.5rem; padding: 0.95rem 0;
    border-bottom: 1px solid var(--lijn);
  }
  .paden li:first-child { border-top: 1px solid var(--lijn); }
  @media (min-width: 44rem) { .paden li { grid-template-columns: 10rem 1fr; } }
  .waar {
    font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.04em;
    color: var(--inkt-zacht); padding-top: 0.28rem;
  }
  .paden p { margin: 0; font-size: 0.98rem; }
  .paden p + p { margin-top: 0.45rem; }

  .let-op {
    max-width: var(--kolom); background: var(--klei-vlek);
    border-left: 3px solid var(--klei); padding: 1rem 1.2rem;
    border-radius: 0 3px 3px 0; margin-top: 1.75rem;
  }
  .let-op p { margin: 0; font-size: 0.98rem; }
  .let-op .kop {
    font-family: var(--mono); font-size: 0.7rem; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--klei-inkt); display: block; margin-bottom: 0.35rem;
  }

  .colofon {
    border-top: 1px solid var(--lijn); margin-top: 4rem; padding-top: 1.75rem;
    color: var(--inkt-zacht); font-size: 0.9rem; max-width: var(--kolom);
  }

  a { color: var(--groen); }
  :focus-visible { outline: 2px solid var(--groen); outline-offset: 3px; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>

<div class="omslag">
  <header class="masthead">
    <span class="stempel">Gebruiksaanwijzing</span>
    <h1>Tennisapp-gids</h1>
    <p class="onderkop">
      Twee gidsen: één voor wie lesgeeft en één voor wie les krijgt. Kies hieronder welke je
      leest. Elke gids volgt de app zoals je hem tegenkomt, van het inloggen tot wat er
      gebeurt als iets niet lukt.
    </p>
    <div class="schakelaar" role="group" aria-label="Kies een gids">
      ${GIDSEN.map((g, i) => `<button type="button" data-toon="${g.rol}" aria-pressed="${i === 0}">${esc(g.label)}</button>`).join('\n      ')}
    </div>
    <div class="schakelaar">
      <button type="button" id="kopieer" class="kopieerknop">Kopieer als tekst</button>
      <span id="kopieermelding" class="melding" role="status"></span>
    </div>
  </header>
${GIDSEN.map(gidsHtml).join('\n')}

  <footer class="colofon">
    Deze gids beschrijft de app zoals hij nu werkt. Verandert er iets aan de schermen, dan
    hoort dit mee te veranderen — een handleiding die niet meer klopt, is erger dan geen.
  </footer>
</div>

<script>
  (function () {
    var knoppen = document.querySelectorAll('.schakelaar button');
    var gidsen = document.querySelectorAll('.gids');

    function toon(rol) {
      gidsen.forEach(function (g) { g.classList.toggle('actief', g.dataset.rol === rol); });
      knoppen.forEach(function (k) { k.setAttribute('aria-pressed', String(k.dataset.toon === rol)); });
      // Onthouden op dit toestel: wie de spelersgids leest, leest hem meestal nog eens.
      try { localStorage.setItem('gids.rol', rol); } catch (e) { /* privévenster */ }
    }

    knoppen.forEach(function (k) {
      k.addEventListener('click', function () { toon(k.dataset.toon); });
    });

    var bewaard = null;
    try { bewaard = localStorage.getItem('gids.rol'); } catch (e) { /* privévenster */ }
    toon(bewaard === 'player' ? 'player' : 'coach');

    // De gids als platte tekst, om in een mail te plakken.
    //
    // Opgebouwd uit wat er op het scherm staat en niet uit een tweede kopie van de tekst:
    // zo kán het niet uit de pas lopen met wat je leest, en verandert er niets aan deze
    // knop als de gids wordt bijgewerkt.
    function alsTekst() {
      var gids = document.querySelector('.gids.actief');
      if (!gids) return '';
      var uit = [];
      gids.querySelectorAll('section').forEach(function (sec) {
        var plaats = sec.querySelector('.plaats');
        var titel = sec.querySelector('h2');
        var kop = (plaats ? plaats.textContent.toUpperCase() + ' — ' : '') + titel.textContent;
        uit.push(kop, '='.repeat(kop.length));
        var leidraad = sec.querySelector('.leidraad');
        if (leidraad) uit.push('', leidraad.textContent.trim());
        sec.querySelectorAll('.paden > li').forEach(function (li) {
          var waar = li.querySelector('.waar').textContent.trim();
          uit.push('', '[' + waar + '] ' + li.querySelector('h3').textContent.trim());
          li.querySelectorAll('p').forEach(function (p) { uit.push(p.textContent.trim()); });
        });
        var letop = sec.querySelector('.let-op');
        if (letop) {
          uit.push('', 'LET OP — ' + letop.querySelector('.kop').textContent.trim());
          letop.querySelectorAll('p').forEach(function (p) { uit.push(p.textContent.trim()); });
        }
        uit.push('', '');
      });
      return uit.join('\n').replace(/\s+$/, '') + '\n';
    }

    var knop = document.getElementById('kopieer');
    var melding = document.getElementById('kopieermelding');
    knop.addEventListener('click', function () {
      var tekst = alsTekst();
      var klaar = function () { melding.textContent = 'Op je klembord'; };
      var mislukt = function () { melding.textContent = 'Kopiëren lukte niet — selecteer de tekst zelf'; };
      if (navigator.clipboard) navigator.clipboard.writeText(tekst).then(klaar, mislukt);
      else mislukt();
      setTimeout(function () { melding.textContent = ''; }, 4000);
    });
  })();
</script>
`);
