/* Navigation icons: simple strokes, drawn here (no icon font, no library). */
import type { ReactElement } from 'react';

const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const HomeIcon = (): ReactElement => <svg {...base}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>;
export const BannerIcon = (): ReactElement => <svg {...base}><path d="M6 3v18" /><path d="M6 4h12l-3 4 3 4H6" /></svg>;
export const MapIcon = (): ReactElement => <svg {...base}><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v14M15 6v14" /></svg>;
export const QuillIcon = (): ReactElement => <svg {...base}><path d="M20 4c-6 0-11 5-12 12l-2 4" /><path d="M8 16c4 0 8-3 9-8" /></svg>;
export const MoreIcon = (): ReactElement => <svg {...base}><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></svg>;
export const IconClose = (): ReactElement => <svg {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>;
