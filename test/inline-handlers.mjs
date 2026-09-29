/* Every name an inline handler of the legacy app uses must exist on
 * `window`. The app is made of ES modules, so a function or variable that
 * is not in the Object.assign(window, {…}) block of js/app.js is not
 * reachable from onclick="…" and friends; the handler throws a
 * ReferenceError when it runs, and nothing else notices.
 *
 * Found by the button audit (29.09.2026): the "Extra equipment (house rule)"
 * panel of Hired Swords and Dramatis Personae stored its open state with
 * ontoggle="hsEqOpen[…]=this.open", but hsEqOpen was never exposed, so every
 * open and close threw and the panel closed on every render.
 *
 * The handlers are read from index.html and from the strings and templates
 * of js/*.js, the templates' ${…} parts replaced by a placeholder.
 */
import assert from 'assert';
import { readFileSync, readdirSync } from 'fs';
import { createRequire } from 'module';

const acorn = createRequire(import.meta.url)('acorn');
const root = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8');

/* Everything a handler may use besides the exposed names. */
const GLOBALS = new Set(['event', 'window', 'document', 'Number', 'parseInt', 'parseFloat', 'String', 'Math', 'JSON',
  'Array', 'Object', 'Boolean', 'isNaN', 'undefined', 'alert', 'confirm', 'prompt', 'setTimeout', 'console', 'location', 'history']);

function walk(node, fn, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  fn(node, parent);
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (Array.isArray(v)) v.forEach((c) => walk(c, fn, node));
    else if (v && typeof v.type === 'string') walk(v, fn, node);
  }
}

/* The names in Object.assign(window, {…}). */
const exposed = new Set();
walk(acorn.parse(read('js/app.js'), { ecmaVersion: 'latest', sourceType: 'module' }), (n) => {
  if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object.name === 'Object'
    && n.callee.property.name === 'assign' && n.arguments[0]?.name === 'window' && n.arguments[1]?.type === 'ObjectExpression') {
    n.arguments[1].properties.forEach((p) => { if (p.key) exposed.add(p.key.name ?? p.key.value); });
  }
});
assert.ok(exposed.size > 100, `the window block was found (${exposed.size} names)`);

/* Handler code: attribute values of on…="…" in a piece of markup. */
const handlers = [];
function scan(markup, where) {
  const re = /(?<![\w-])on[a-z]+\s*=\s*(["'])/g; let m;
  while ((m = re.exec(markup))) {
    const end = markup.indexOf(m[1], m.index + m[0].length);
    if (end > 0) handlers.push({ where, code: markup.slice(m.index + m[0].length, end) });
  }
}
const PH = '0';
const flatten = (n) => {
  if (n.type === 'BinaryExpression' && n.operator === '+') return flatten(n.left) + flatten(n.right);
  if (n.type === 'Literal' && typeof n.value === 'string') return n.value;
  if (n.type === 'TemplateLiteral') return n.quasis.map((q, i) => (q.value.cooked ?? q.value.raw) + (i < n.expressions.length ? PH : '')).join('');
  return PH;
};
scan(read('index.html'), 'index.html');
for (const f of readdirSync(new URL('js/', root)).filter((x) => x.endsWith('.js'))) {
  const src = read('js/' + f);
  const seen = new Set();
  walk(acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true }), (n, p) => {
    if (n.type !== 'TemplateLiteral' && !(n.type === 'Literal' && typeof n.value === 'string') && !(n.type === 'BinaryExpression' && n.operator === '+')) return;
    if (p && p.type === 'BinaryExpression' && p.operator === '+') return; // the whole concatenation is read once
    const s = flatten(n);
    if (!/on[a-z]+\s*=/.test(s) || seen.has(n.start)) return;
    seen.add(n.start);
    scan(s, `js/${f}:${n.loc.start.line}`);
  });
}
assert.ok(handlers.length > 200, `inline handlers found (${handlers.length})`);

/* The free names of each handler. */
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const missing = new Map();
for (const h of handlers) {
  let ast;
  try { ast = acorn.parse(decode(h.code), { ecmaVersion: 'latest' }); } catch { continue; } // placeholder artefacts; compiled for real by the audit
  const declared = new Set();
  walk(ast, (n) => { if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') declared.add(n.id.name); });
  walk(ast, (n, p) => {
    if (n.type !== 'Identifier') return;
    if (p && p.type === 'MemberExpression' && p.property === n && !p.computed) return;
    if (p && p.type === 'Property' && p.key === n && !p.computed) return;
    if (declared.has(n.name) || exposed.has(n.name) || GLOBALS.has(n.name)) return;
    if (!missing.has(n.name)) missing.set(n.name, h.where);
  });
}
assert.deepStrictEqual(Object.fromEntries(missing), {}, 'names used by inline handlers but not exposed on window');

console.log(`Inline handlers: OK (${handlers.length} handlers, every name on window)`);
