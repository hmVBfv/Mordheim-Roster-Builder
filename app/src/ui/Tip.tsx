/* A word on a card that names a rule, and the bubble that says what it does
   (docs/ui.md §5; Rob, 02.10.2026: the Roster Builder's tooltips are
   "essential and must be in"). A tap opens the bubble and keeps it open; a
   tap anywhere, Esc or another word closes it. With a mouse it also opens
   while the pointer rests on the word. Like the Undo notice it lets taps
   pass through (docs/ui.md §1.6): whatever lies under it stays usable, and
   that tap closes it. One bubble at a time.

   The bubble is drawn into <body>, fixed to the word and kept inside the
   screen; it follows the word while the page scrolls. (Inside an open
   <dialog> it would sit under the dialog's top layer – the cards are not in
   one; a sheet that wants bubbles must draw them inside itself.) */
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import ui from './ui.module.css';

export interface TipEntry { name: string; line: string; text: string }

/* which bubble is open, shared by every word */
let openId: string | null = null;
const listeners = new Set<() => void>();
function setOpen(id: string | null) {
  if (openId === id) return;
  openId = id;
  for (const f of listeners) f();
}
function subscribe(f: () => void) {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

const EDGE = 8;
const GAP = 6;

/** Places the bubble under the word, or over it when there is no room
    below, and never past the edges of the screen. */
function place(word: HTMLElement, bubble: HTMLElement) {
  const r = word.getBoundingClientRect();
  const w = bubble.offsetWidth, h = bubble.offsetHeight;
  const below = r.bottom + GAP + h <= window.innerHeight - EDGE || r.top - GAP - h < EDGE;
  bubble.style.top = `${Math.round(below ? r.bottom + GAP : r.top - GAP - h)}px`;
  bubble.style.left = `${Math.round(Math.min(Math.max(EDGE, r.left), Math.max(EDGE, window.innerWidth - w - EDGE)))}px`;
}

function TipButton({ label, tips }: { label: string; tips: readonly TipEntry[] }) {
  const id = useId();
  const open = useSyncExternalStore(subscribe, () => openId === id, () => false);
  const pinned = useRef(false);
  const word = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) { pinned.current = false; return; }
    const follow = () => { if (word.current && bubble.current) place(word.current, bubble.current); };
    follow();
    const away = (e: PointerEvent) => { if (!word.current?.contains(e.target as Node)) setOpen(null); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    };
  }, [open]);

  // a word that leaves the page takes its bubble with it
  useEffect(() => () => { if (openId === id) setOpen(null); }, [id]);

  const bubbleId = `${id}-tip`;
  return (
    <>
      <button
        ref={word}
        type="button"
        className={ui.tip}
        data-tip=""
        aria-expanded={open}
        aria-describedby={open ? bubbleId : undefined}
        onClick={() => {
          if (open && pinned.current) { setOpen(null); return; }
          pinned.current = true;
          setOpen(id);
        }}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse' && openId !== id) { pinned.current = false; setOpen(id); } }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse' && openId === id && !pinned.current) setOpen(null); }}
      >
        {label}
      </button>
      {open && createPortal(
        <div ref={bubble} id={bubbleId} role="tooltip" className={ui.tipBubble}>
          {tips.map((t, i) => (
            <Fragment key={i}>
              <b>{t.name}</b>
              {t.line && <small>{t.line}</small>}
              <p>{t.text}</p>
            </Fragment>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

/** The word, opening its rules in a bubble; a plain word when there are none. */
export function TipWord({ label, tips }: { label: string; tips: readonly TipEntry[] }) {
  return tips.length ? <TipButton label={label} tips={tips} /> : <>{label}</>;
}
