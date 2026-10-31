/* The Rules tab: the rulebook chapters word for word (data/rulesref.json, read from mordheimer.net), and a search over all of
   them. Reading works offline; nothing here is computed. */
import { Fragment, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useSearchParams } from 'react-router';
import { ACCOUNT } from '../app/paths.ts';
import trade from '../roster/Trade.module.css';
import ui from '../ui/ui.module.css';
import { loadRules, type Block, type Chapter } from './data.ts';
import styles from './Rules.module.css';
import { mark, searchBlocks } from './search.ts';

function Marked({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  return <>{mark(text, query).map((m, i) => (m.hit ? <mark key={i}>{m.text}</mark> : <Fragment key={i}>{m.text}</Fragment>))}</>;
}

function BlockView({ b, query = '' }: { b: Block; query?: string }) {
  if (b.t === 'h') {
    const H = (`h${b.l + 1}` as 'h3' | 'h4' | 'h5');
    return <H id={query ? undefined : b.id || undefined}><Marked text={b.text} query={query} /></H>;
  }
  if (b.t === 'p') return <p><Marked text={b.text} query={query} /></p>;
  return (
    <div className={styles.scroll} tabIndex={0} role="region" aria-label="Table">
      <table className={styles.table}>
        {b.head.length > 0 && <thead><tr>{b.head.map((c, i) => <th key={i} scope="col"><Marked text={c} query={query} /></th>)}</tr></thead>}
        <tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c.split('\n').map((l, k) => <p key={k}><Marked text={l} query={query} /></p>)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function Rules() {
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const asked = useDeferredValue(query.trim());
  useEffect(() => { void loadRules().then(setChapters); }, []);

  const current = chapters?.find((c) => c.id === params.get('c')) ?? chapters?.[0];
  const results = useMemo(() => {
    if (!chapters || !asked) return null;
    return chapters
      .map((c) => {
        // a hit is shown under the nearest heading above it, so it can be placed in the chapter
        const hits = searchBlocks(c.blocks, asked).map(({ index }) => {
          let h = '';
          for (let i = index; i >= 0; i--) { const b = c.blocks[i]!; if (b.t === 'h') { h = b.text; break; } }
          return { block: c.blocks[index]!, heading: h };
        });
        return { chapter: c, hits };
      })
      .filter((r) => r.hits.length > 0);
  }, [chapters, asked]);
  const total = results?.reduce((n, r) => n + r.hits.length, 0) ?? 0;

  return (
    <section className={`${ui.page} ${ui.measure}`}>
      <div>
        <Link to={ACCOUNT} className={trade.back}>‹ {ACCOUNT === '/account' ? 'Account' : 'Settings'}</Link>
        <h1>Rules</h1>
        <p className={ui.muted}>The rulebook, word for word. Charts and diagrams are pictures on the original pages.</p>
      </div>
      <label className={ui.field}>
        <span>Search the rules</span>
        <input type="search" className={ui.input} value={query} onChange={(e) => setQuery(e.target.value)} autoCapitalize="none" spellCheck={false} enterKeyHint="search" placeholder="hide, charge, ward save …" />
      </label>
      <nav aria-label="Chapters" className={styles.chapters}>
        {(chapters ?? []).map((c) => (
          <NavLink key={c.id} to={`/rules?c=${c.id}`} end className={() => (!asked && current?.id === c.id ? `${styles.chapter} ${styles.on}` : styles.chapter)} aria-current={!asked && current?.id === c.id ? 'page' : undefined}>{c.title}</NavLink>
        ))}
      </nav>

      {chapters === null && <p className={ui.muted}>Loading …</p>}

      {results && (
        <section aria-label="Search results" className={styles.results}>
          <p className={ui.muted}>{total === 0 ? 'Nothing found. Words match by their stem: hide finds hiding.' : `${total} ${total === 1 ? 'place' : 'places'} in ${results.length} ${results.length === 1 ? 'chapter' : 'chapters'}.`}</p>
          {results.map(({ chapter, hits }) => (
            <div key={chapter.id}>
              <h2><Link to={`/rules?c=${chapter.id}`} onClick={() => setQuery('')}>{chapter.title}</Link></h2>
              <ul className={styles.hits}>
                {hits.map((h, i) => (
                  <li key={i} className={ui.card}>
                    {h.heading && <small className={styles.where}>{h.heading}</small>}
                    <BlockView b={h.block.t === 'h' ? { t: 'p', text: h.block.text } : h.block} query={asked} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {!asked && current && (
        <article className={styles.chapterText} aria-labelledby="rules-chapter">
          <h2 id="rules-chapter">{current.title}</h2>
          {current.blocks.map((b, i) => <BlockView key={i} b={b} />)}
          <p className={ui.muted}>Source: <a className={styles.source} href={current.url} target="_blank" rel="noreferrer">{current.url.replace('https://', '')}</a></p>
        </article>
      )}
    </section>
  );
}
