#!/usr/bin/env node
/**
 * build.js — baut aus den modularen Quellen wieder EINE eigenständige HTML.
 *
 *   node build.js                 -> dist/mordheim-roster.html
 *   node build.js --out foo.html  -> eigener Ausgabepfad
 *
 * Warum: GitHub Pages serviert die modulare Version (schnell, cachebar,
 * wartbar). Für Offline-Nutzung und zum Weitergeben (Discord, USB-Stick)
 * gibt es weiterhin eine Datei, die per Doppelklick läuft — ohne Server.
 *
 * Ablauf:
 *   1. Datenmodule einlesen, `export ` entfernen, `import`-Zeilen streichen.
 *   2. app.js dito; die Reihenfolge folgt den Abhängigkeiten (Daten zuerst).
 *   3. Sheet-PDF als Base64-Konstante einbetten (statt fetch).
 *   4. pdf-lib inline, alles in index.html einsetzen.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const outArg = process.argv.indexOf('--out');
const OUT = outArg > -1 ? process.argv[outArg + 1]
                        : path.join(ROOT, 'dist', 'mordheim-roster.html');

/** Die Spieldaten liegen als JSON (sprachunabhängig, auch für TTS/Bots lesbar).
 *  Für die Single-File werden sie minifiziert als __MH_DATA eingebettet und der
 *  fetch-Block in data/index.js entfernt (top-level await geht dort nicht). */
const DATA_JSON = [
  'races', 'equipment', 'skills', 'spells', 'abilities', 'mutations',
  'injuries', 'i18n', 'houserules', 'marks', 'sheet', 'campaign',
  'warbands', 'hiredswords', 'dramatis',
];

/** Modul-Syntax entfernen: aus `export const X` wird `const X`, imports fliegen raus. */
function deModule(src) {
  return src
    .replace(/^\s*import\s[^;]*;\s*$/gm, '')          // import-Zeilen
    .replace(/^export\s+(async\s+)?(const|let|var|function|class)\s/gm, '$1$2 ')
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, '');      // Re-Exports
}

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

// --- 1) Daten (JSON) einbetten ------------------------------------------
const chunks = [];
const data = {};
for (const f of DATA_JSON) {
  const p = path.join(ROOT, 'data', f + '.json');
  if (!fs.existsSync(p)) { console.warn(`  ! fehlt: data/${f}.json`); continue; }
  data[f] = JSON.parse(fs.readFileSync(p, 'utf8'));   // minifiziert beim Serialisieren
}
chunks.push('/* ===== Spieldaten (data/*.json, eingebettet) ===== */\n'
  + 'const __MH_DATA = ' + JSON.stringify(data) + ';');

// data/index.js: fetch-Block entfernen (top-level await ist im <script> verboten)
let loader = read(path.join('data', 'index.js'))
  .replace(/\/\* @build:fetch-start \*\/[\s\S]*?\/\* @build:fetch-end \*\//,
           '/* fetch-Block vom Build entfernt — Daten liegen in __MH_DATA */');
chunks.push('/* ===== data/index.js ===== */\n' + deModule(loader));
chunks.push('/* ===== data/_util.js ===== */\n' + deModule(read(path.join('data', '_util.js'))));

/* Logik-Module. Reihenfolge ist unkritisch (Funktions-Deklarationen werden
   gehoistet), app.js aber zuerst — dort liegt der Zustand. */
const JS_FILES = ['app.js', 'pdf.js', 'tts.js'];
let app = JS_FILES
  .map(f => `/* ===== js/${f} ===== */\n` + deModule(read(path.join('js', f))))
  .join('\n\n');

// --- 2) Sheet-Template als Base64 einbetten (ersetzt den fetch) ---------
const pdfPath = path.join(ROOT, 'assets', 'sheet.pdf');
if (fs.existsSync(pdfPath)) {
  const b64 = fs.readFileSync(pdfPath).toString('base64');
  chunks.push(`/* ===== assets/sheet.pdf (inline) ===== */\nconst SHEET_TPL_B64="${b64}";`);
} else {
  console.warn('  ! assets/sheet.pdf fehlt — PDF-Export wird nicht funktionieren.');
}

// Die window-Bindung braucht es in der Single-File-Variante nicht (alles ist
// ohnehin global), sie stört aber auch nicht. `import.meta` gibt es hier nicht:
app = app.replace(/new URL\([^)]*import\.meta\.url\)/g, "'assets/sheet.pdf'");

chunks.push(`/* ===== js/app.js ===== */\n` + app);

// --- 3) In die HTML-Hülle einsetzen ------------------------------------
let html = read('index.html');
const vendor = read(path.join('vendor', 'pdf-lib.min.js'));

// Achtung: Ersetzungs-STRINGS würden $&, $1 usw. interpretieren — der Code
// enthält solche Sequenzen (Regex-Escapes). Darum Replacer-FUNKTIONEN nutzen.
html = html.replace(
  /^[ \t]*<script src="vendor\/pdf-lib\.min\.js"><\/script>\s*$/m,
  () => '<script>\n' + vendor + '\n</script>'
);
html = html.replace(
  /^[ \t]*<script type="module" src="js\/app\.js"><\/script>\s*$/m,
  () => '<script>\n' + chunks.join('\n\n') + '\n</script>'
);

// --- 4) Schreiben ------------------------------------------------------
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);

const kb = n => (n / 1024).toFixed(0) + ' KB';
console.log(`Build fertig: ${path.relative(ROOT, OUT)}  (${kb(html.length)})`);
console.log(`  Daten:  ${kb(JSON.stringify(data).length)} (JSON, minifiziert)`);
console.log(`  Logik:  ${kb(app.length)}`);
console.log(`  Vendor: ${kb(vendor.length)}`);
