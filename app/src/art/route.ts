/* Which picture belongs to which screen (docs/ui.md §4). The first rule
   that matches wins; the Home picture is the fallback. */
import type { SceneId } from './scenes.ts';

const RULES: ReadonlyArray<readonly [RegExp, SceneId]> = [
  [/^\/$/, 'city'],
  [/^\/warbands\/[^/]+\/(trade|hire)$/, 'market'],
  [/^\/warbands\/[^/]+\/export$/, 'dice'],
  [/^\/warbands\/[^/]+\/house$/, 'tome'],
  [/^\/campaign\/[^/]+\/house-rules$/, 'tome'],
  [/^\/warbands\/[^/]+\/districts$/, 'map'],
  [/^\/warbands\/[^/]+\/(story|versions)$/, 'scribe'],
  [/^\/warbands\/[^/]+\/aftermath\/[^/]+$/, 'fire'],
  [/^\/warbands(\/|$)/, 'camp'],
  [/^\/campaign\/[^/]+\/battles\/[^/]+$/, 'battle'],
  [/^\/campaign\/[^/]+\/warbands\/[^/]+$/, 'camp'],
  [/^\/campaign\/[^/]+\/(notes|timeline)$/, 'scribe'],
  [/^\/campaign\/[^/]+\/chronicle$/, 'tome'],
  [/^\/campaign\/[^/]+\/world$/, 'map'],
  [/^\/campaign\/[^/]+\/(questions|background)$/, 'lock'],
  [/^\/campaign\/[^/]+\/(manage|as-player)$/, 'camp'],
  [/^\/campaign\/[^/]+$/, 'gate'],
  [/^\/campaign$/, 'map'],
  [/^\/library(\/|$)/, 'scribe'],
  [/^\/(more|account|settings|admin|sign-in|invite|reset)(\/|$)/, 'lock'],
  [/^\/import$/, 'market']
];

export function sceneFor(pathname: string): SceneId {
  for (const [pattern, scene] of RULES) if (pattern.test(pathname)) return scene;
  return 'city';
}
