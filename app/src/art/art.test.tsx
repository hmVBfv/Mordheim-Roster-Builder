import { cleanup, render as mount, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GROUND, H, PALETTE, W, backdropRows } from './draw.ts';
import { Banner, Empty, bands, layers } from './Pixels.tsx';
import { sceneFor } from './route.ts';
import { SCENES, backdropOnly, paint, render, type SceneId } from './scenes.ts';

afterEach(cleanup);

const IDS = Object.keys(SCENES) as SceneId[];

describe('the scenes', () => {
  it('are drawn in one palette, on a full grid, without a gap', () => {
    for (const id of IDS) {
      const rows = paint(id);
      expect(rows.length, id).toBe(H);
      for (const row of rows) {
        expect(row.length, id).toBe(W);
        for (const c of row) expect(PALETTE[c], `${id}: ${c}`).toBeTruthy();
      }
    }
  });

  it('are the same picture every time (no chance in them)', () => {
    for (const id of IDS) expect(render(id), id).toEqual(render(id));
  });

  it('keep the motif inside its span, so an empty screen can show just that', () => {
    for (const id of IDS) {
      const x0 = Math.floor((W - SCENES[id].span) / 2);
      const base = backdropOnly(id);
      render(id).forEach((row, y) => {
        for (let x = 0; x < W; x++) {
          if (row[x] === base[y]![x]) continue;
          expect(x >= x0 && x < x0 + SCENES[id].span, `${id}: (${x}, ${y})`).toBe(true);
        }
      });
    }
  });

  it('add something to the night: the motif is not empty and does not sink into the ground', () => {
    for (const id of IDS) {
      const base = backdropOnly(id);
      const changed = render(id).reduce((n, row, y) => n + [...row].filter((c, x) => c !== base[y]![x]).length, 0);
      expect(changed, id).toBeGreaterThan(300);
    }
    expect(GROUND).toBeLessThan(H);
  });

  it('move only what is a light: windows, fires, wyrdstone, stars', () => {
    const live = layers('city').filter((l) => l.live);
    expect(live.length).toBeGreaterThan(1);
    expect(layers('lock').every((l) => l.d.length > 0)).toBe(true);
  });

  it('are a handful of paths each, not a rect per pixel', () => {
    for (const id of IDS) expect(layers(id).length, id).toBeLessThan(40);
  });
});

describe('which screen shows which picture', () => {
  it.each([
    ['/', 'city'],
    ['/warbands', 'camp'],
    ['/warbands/new', 'camp'],
    ['/warbands/w1', 'camp'],
    ['/warbands/w1/trade', 'market'],
    ['/warbands/w1/hire', 'market'],
    ['/warbands/w1/export', 'dice'],
    ['/warbands/w1/house', 'tome'],
    ['/warbands/w1/districts', 'map'],
    ['/warbands/w1/story', 'scribe'],
    ['/warbands/w1/aftermath/b1', 'fire'],
    ['/campaign', 'map'],
    ['/campaign/c1', 'gate'],
    ['/campaign/c1/notes', 'scribe'],
    ['/campaign/c1/chronicle', 'tome'],
    ['/campaign/c1/world', 'map'],
    ['/campaign/c1/questions', 'lock'],
    ['/campaign/c1/manage', 'camp'],
    ['/campaign/c1/battles/b1', 'battle'],
    ['/campaign/c1/house-rules', 'tome'],
    ['/campaign/c1/warbands/w1', 'camp'],
    ['/more', 'lock'],
    ['/admin/people', 'lock'],
    ['/nowhere', 'city']
  ])('%s shows %s', (path, scene) => {
    expect(sceneFor(path)).toBe(scene);
  });

  it('knows a picture for every one it can name', () => {
    for (const path of ['/', '/warbands/x/trade', '/campaign/x/house-rules']) expect(SCENES[sceneFor(path)]).toBeTruthy();
  });
});

describe('the pieces on a screen', () => {
  it('the banner is decoration: hidden from a screen reader, the night painted in bands beside it', () => {
    const { container } = mount(<Banner scene="city" />);
    const banner = container.firstElementChild as HTMLElement;
    expect(banner.getAttribute('aria-hidden')).toBe('true');
    expect(banner.getAttribute('data-scene')).toBe('city');
    expect(banner.querySelectorAll('svg').length).toBe(1);
    expect(bands()).toMatch(/^linear-gradient\(to bottom, #0b0d12 0%/);
    expect(backdropRows().length).toBe(H);
  });

  it('an empty screen says what is missing and what to do, under its picture', () => {
    const { container, getByRole, getByText } = mount(<Empty scene="gate" title="Nothing yet.">Ask a leader to add you.</Empty>);
    expect(getByRole('heading', { name: 'Nothing yet.' })).toBeTruthy();
    expect(getByText('Ask a leader to add you.')).toBeTruthy();
    // the picture is not read out, the words are
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe(`${Math.floor((W - SCENES.gate.span) / 2)} 0 ${SCENES.gate.span} ${H}`);
  });

  it('an empty screen without a hint has no empty paragraph', () => {
    const { container } = mount(<Empty scene="battle" title="No battles yet." />);
    expect(container.querySelector('p')).toBeNull();
  });

  it('an empty part of a page is compact: the same words and picture, marked for the small layout', () => {
    const full = mount(<Empty scene="map" title="No warband holds a district yet." />);
    expect((full.container.firstElementChild as HTMLElement).className).not.toMatch(/compact/);
    const small = mount(<Empty scene="map" title="No warband holds a district yet." compact />);
    const root = small.container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/compact/);
    expect(root.getAttribute('data-scene')).toBe('map');
    expect(within(root).getByRole('heading', { name: 'No warband holds a district yet.' })).toBeTruthy();
    expect(small.container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
