/* The account (campaign app) and the settings of this device. */
import { lazy, Suspense } from 'react';
import { APP_NAME, FLAVOUR } from '../flavour.ts';
import { setChoice, THEME_CHOICES, useThemeChoice } from '../theme/theme.ts';
import { shownVersion } from '../version.ts';
import ui from '../ui/ui.module.css';
import styles from './More.module.css';

// only the campaign app has accounts; the Quick Build never loads them
const AccountSection = lazy(() => import('../account/Account.tsx').then((m) => ({ default: m.AccountSection })));

export function More() {
  const choice = useThemeChoice();
  return (
    <section className={ui.page}>
      <h1>More</h1>
      {FLAVOUR === 'campaign' && <Suspense fallback={null}><AccountSection /></Suspense>}
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
