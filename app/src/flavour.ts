/* Which of the two apps this build is (vite.config.ts: the build mode). */
export type Flavour = 'campaign' | 'quickbuild';

export const FLAVOUR: Flavour = import.meta.env.MODE === 'quickbuild' ? 'quickbuild' : 'campaign';
export const APP_NAME = FLAVOUR === 'quickbuild' ? 'Mordheim Quick Build' : 'Mordheim Campaign';
