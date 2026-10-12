/* How much a JSON text can make the server hold (security review INPUT-2,
   INPUT-3): parsed, every object and array is a heap object of its own, so
   a body of empty `{}` grew about 45 times in memory. The text is counted
   before it is parsed or stored. */

/** Objects and arrays in one JSON body: a long campaign's warband has a few thousand. */
export const MAX_JSON_CONTAINERS = 50_000;

/** `{` and `[` in a JSON text – inside strings too, so an upper bound; stops counting past `stopAbove`. */
export function countContainers(text: string, stopAbove = Number.POSITIVE_INFINITY): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if ((c === 123 || c === 91) && ++n > stopAbove) return n;
  }
  return n;
}
