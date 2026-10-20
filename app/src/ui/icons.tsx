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
