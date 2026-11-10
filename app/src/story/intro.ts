/* The lore opening of a warband (data/warbandintro.json): the lore of the warband’s page on mordheimer.net, word for word, offered as
   the default text of the Prologue. Fetched on first use, so it is not part of the app shell. */
export interface Intro { text: string; url: string }

const file = import.meta.glob<{ INTRO: Record<string, Intro> }>('../../../data/warbandintro.json', { import: 'default' });

let loading: Promise<Record<string, Intro>> | null = null;
export function loadIntros(): Promise<Record<string, Intro>> {
  loading ??= file['../../../data/warbandintro.json']!().then((d) => d.INTRO);
  return loading;
}
