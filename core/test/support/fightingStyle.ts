/* Pit Fighters (report of 2.11.2026): a man who picks a fixed kit needs one, or the warband is not legal. Legacy has no such warning, so the
   parity tests do not compare it – this one warning, by its words, nothing else (docs/behaviour-changes.md). Its own tests are in
   core/test/pit-fighters.test.ts. */
export const STYLE_WARNING = /: pick a fighting style – one set of equipment for each man/;

export function withoutStyleWarnings(w: string[]): string[] {
  return w.filter((x) => !STYLE_WARNING.test(x));
}
