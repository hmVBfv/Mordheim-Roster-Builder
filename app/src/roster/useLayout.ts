/* How the roster uses the room it is given (docs/ui.md §3). The width that
   counts is the workspace's own, not the window's: the sidebar and the page
   padding are already taken off. Three layouts:
   - stack:  one column; a warrior opens in place, under his row
   - split:  the list and, beside it, the selected warrior with every section
   - triple: the same, and the warband's own functions in a third column */
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

export type Layout = 'stack' | 'split' | 'triple';

/** Workspace widths (px) from which the list and the pane stand side by side, and the third column joins. */
export const SPLIT_AT = 860;
export const TRIPLE_AT = 1560;

export const layoutFor = (width: number): Layout => (width >= TRIPLE_AT ? 'triple' : width >= SPLIT_AT ? 'split' : 'stack');

/** The layout of the element the ref is put on; measured before the first paint, then followed. */
export function useLayout(): readonly [Layout, RefObject<HTMLDivElement | null>] {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>('stack');
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setLayout(layoutFor(el.clientWidth));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  return [layout, ref];
}
