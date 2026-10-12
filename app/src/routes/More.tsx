/* The account (campaign app) and the settings of this device. */
import { lazy, Suspense, useState } from 'react';
import { cleanServer, getServer, setServer } from '../share/link.ts';
import { APP_NAME, FLAVOUR } from '../flavour.ts';
import { setChoice, THEME_CHOICES, useThemeChoice } from '../theme/theme.ts';
import { shownVersion } from '../version.ts';
import ui from '../ui/ui.module.css';
import styles from './More.module.css';

// only the campaign app has accounts; the Quick Build never loads them
const AccountSection = lazy(() => import('../account/Account.tsx').then((m) => ({ default: m.AccountSection })));

/** Quick Build: where "Send to campaign server" points (concept.md 4.11). */
function CampaignServer() {
  const [value, setValue] = useState(getServer);
  const [saved, setSaved] = useState(getServer);
  const clean = cleanServer(value);
  return (
    <form className={`${ui.card} ${styles.themes}`} onSubmit={(e) => { e.preventDefault(); setServer(clean); setSaved(clean); setValue(clean); }}>
      <label className={ui.field}>
        <span>Campaign server</span>
        <input className={ui.input} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="https://mordheim.example.org" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <p className={ui.muted}>{saved ? `Export → “Send to campaign server” opens ${saved}.` : 'The address of your group’s campaign app, for “Send to campaign server” on the Export screen.'}</p>
      <div className={ui.row}>
        <button type="submit" className={ui.buttonQuiet} disabled={clean === saved || (!!value.trim() && !clean)}>Save the address</button>
      </div>
      {!!value.trim() && !clean && <p className={ui.error}>{/^http:\/\//i.test(value.trim()) ? 'Plain http only for an address in your home network – use https://.' : 'That is not a web address.'}</p>}
    </form>
  );
}

export function More() {
  const choice = useThemeChoice();
  return (
    <section className={ui.page}>
      <h1>More</h1>
      {FLAVOUR === 'campaign' && <Suspense fallback={null}><AccountSection /></Suspense>}
      {FLAVOUR === 'quickbuild' && <CampaignServer />}
      <fieldset className={`${ui.card} ${styles.themes}`}>
        <legend>Theme</legend>
        {THEME_CHOICES.map((t) => (
          <label key={t.value} className={styles.option}>
            <input type="radio" name="theme" value={t.value} checked={choice === t.value} onChange={() => setChoice(t.value)} />
            {t.label}
          </label>
        ))}
      </fieldset>
      <p className={`${ui.muted} ${styles.version}`}>
        {APP_NAME} · version <span title={__APP_VERSION__}>{shownVersion(__APP_VERSION__)}</span>
        {FLAVOUR === 'quickbuild' && ' · warbands stay on this device'}
      </p>
    </section>
  );
}
