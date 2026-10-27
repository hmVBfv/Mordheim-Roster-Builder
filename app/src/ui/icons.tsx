/* Navigation icons: simple strokes, drawn here (no icon font, no library). */
import type { ReactElement } from 'react';

const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const HomeIcon = (): ReactElement => <svg {...base}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>;
export const BannerIcon = (): ReactElement => <svg {...base}><path d="M6 3v18" /><path d="M6 4h12l-3 4 3 4H6" /></svg>;
export const MapIcon = (): ReactElement => <svg {...base}><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v14M15 6v14" /></svg>;
export const QuillIcon = (): ReactElement => <svg {...base}><path d="M20 4c-6 0-11 5-12 12l-2 4" /><path d="M8 16c4 0 8-3 9-8" /></svg>;
export const MoreIcon = (): ReactElement => <svg {...base}><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></svg>;
/** The account (campaign app): a person, not three dots – three dots read as a menu or settings (Rob, 19.10.2026). */
export const PersonIcon = (): ReactElement => <svg {...base}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" /></svg>;
/** The Quick Build's settings: it has no account. */
export const GearIcon = (): ReactElement => <svg {...base}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>;
/** Opens or closes a group of the navigation. */
export const BookIcon = (): ReactElement => <svg {...base}><path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h10" /></svg>;

export const ShieldIcon = (): ReactElement => <svg {...base}><path d="M12 3l8 3v6c0 4.5-3.2 7.6-8 9-4.8-1.4-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>;

export const ChevronIcon = (): ReactElement => <svg {...base}><path d="M9 6l6 6-6 6" /></svg>;
export const IconClose = (): ReactElement => <svg {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconEdit = (): ReactElement => <svg {...base}><path d="M4 20h4l11-11-4-4L4 16z" /><path d="M13 7l4 4" /></svg>;
/** A beetle, the sign everybody knows for "report a bug" (Rob, 20.10.2026: the flag was not found). */
export const BugIcon = (): ReactElement => (
  <svg {...base}>
    <path d="M9.5 5L8 3M14.5 5L16 3" />
    <path d="M9 7.5V7a3 3 0 0 1 6 0v.5" />
    <path d="M12 21c-3 0-5.5-2.5-5.5-5.5v-3A4.5 4.5 0 0 1 11 7.5h2a4.5 4.5 0 0 1 4.5 4.5v3c0 3-2.5 5.5-5.5 5.5z" />
    <path d="M12 10v11" />
    <path d="M6.5 11L3 9.5M6.5 14.5H3M7 18l-3 2M17.5 11L21 9.5M17.5 14.5H21M17 18l3 2" />
  </svg>
);
/** The eye of a password field: "show what is behind it" – here, what the players read of an NPC. */
export const EyeIcon = (): ReactElement => <svg {...base}><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
/** The same eye struck through: the players' view is on. */
export const EyeOffIcon = (): ReactElement => <svg {...base}><path d="M2 12s3.6-6.5 10-6.5c2 0 3.7.6 5.2 1.4M22 12s-3.6 6.5-10 6.5c-2 0-3.7-.6-5.2-1.4" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="M4 4l16 16" /></svg>;

/** A comet with two tails, the sign of a favourite warband (wish #95, #103): a round head and two broad tails that sweep back and part, so it reads as a comet and not as a chain; only the comet, as other sites use a star, in the colour of the text around it. */
export const CometIcon = (): ReactElement => (
  <svg width="56" height="34" viewBox="0 0 40 24" fill="currentColor" aria-hidden="true">
    <path d="M28 5C19 1.5 10 1.5 0.5 3.5C10 6 20 8 28 11Z" />
    <path d="M28 13C20 16 12 19 6 23.5C15 21 22 20.5 28 19Z" />
    <circle cx="31" cy="12" r="7" />
  </svg>
);
