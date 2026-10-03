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

/** Copies text; true when the clipboard took it. Without clipboard access
    (an old browser, no secure context) the caller selects the text so the
    player can copy it himself. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
