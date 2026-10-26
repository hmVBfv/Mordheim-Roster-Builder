/* The clipboard fallback (#85): inside a modal sheet (<dialog>) everything outside the dialog is inert, so the helper
   field has to live in the open dialog or the browser refuses to focus and copy from it. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './files.ts';

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

describe('copyText without the page clipboard', () => {
  it('copies from a field inside the open dialog, and leaves nothing behind', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } });
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.append(dialog);
    let parent: Element | null = null;
    document.execCommand = vi.fn(() => { parent = document.querySelector('[data-copy-helper]')?.parentElement ?? null; return true; });
    expect(await copyText('the report')).toBe(true);
    expect(parent).toBe(dialog);
    expect(document.querySelector('[data-copy-helper]')).toBeNull();
  });

  it('uses the page when no dialog is open', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } });
    let parent: Element | null = null;
    document.execCommand = vi.fn(() => { parent = document.querySelector('[data-copy-helper]')?.parentElement ?? null; return true; });
    expect(await copyText('x')).toBe(true);
    expect(parent).toBe(document.body);
  });
});
