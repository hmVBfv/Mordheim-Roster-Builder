/* Files and the clipboard: what an export hands to the player. */

/** Saves `data` as a file named `name` (the browser's download). */
export function saveFile(name: string, data: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Copies text; true when the clipboard took it. The page's own clipboard
    comes first; where there is none (an address without https, a browser
    window that keeps it from the page) the older command copies from a
    field that exists for that moment only. When neither works the caller
    selects the text so the player can copy it himself. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyByCommand(text);
  }
}

function copyByCommand(text: string): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.setAttribute('data-copy-helper', '');
  field.setAttribute('aria-hidden', 'true');
  field.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
  const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  // an open sheet is a modal dialog: the rest of the page is inert, so the field must sit inside it
  (document.querySelector('dialog[open]') ?? document.body).append(field);
  field.focus();
  field.select();
  field.setSelectionRange(0, text.length);
  let ok: boolean;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  field.remove();
  before?.focus();
  return ok;
}

/** A name safe for a file: lower case, letters and digits, dashes between. */
export const fileSlug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'campaign';
