/* Quick choices for the style guide (wish 251): a few kinds of chip that write
   one line each into the leaders' text. The text stays the only truth – a
   chip is "on" when its line is in it, so editing the text by hand just works. */

export interface ChipOption { label: string; line: string }
export interface ChipGroup {
  key: string;
  title: string;
  /** several chips may be on at once (what stays out); otherwise one swaps for the other */
  many?: boolean;
  options: ChipOption[];
}

const pick = (title: string, values: [label: string, value: string][]): ChipOption[] =>
  values.map(([label, value]) => ({ label, line: `${title}: ${value}.` }));

export const CHIP_GROUPS: ChipGroup[] = [
  { key: 'language', title: 'Language', options: pick('Language', [['German', 'German'], ['English', 'English']]) },
  { key: 'tense', title: 'Tense', options: pick('Tense', [['Past', 'past tense'], ['Present', 'present tense']]) },
  { key: 'voice', title: 'Voice', options: pick('Voice', [['Close third', 'close third person'], ['First person', 'first person'], ['Narrator', 'an omniscient narrator']]) },
  { key: 'tone', title: 'Tone', options: pick('Tone', [['Grim', 'grim and bleak'], ['Gritty', 'gritty and earthy'], ['Epic', 'epic and heroic'], ['Dry humour', 'dry, dark humour']]) },
  {
    key: 'focus', title: 'Focus', many: true,
    options: [
      ['Battle', 'the fighting, move by move'], ['Roleplay', 'the characters, their talk and their choices'], ['Scenario theme', 'the theme and mood of the scenario'],
      ['World', 'the city and its places'], ['Aftermath', 'the consequences: wounds, loot, rumours'],
    ].map(([label, what]) => ({ label: label!, line: `Focus: ${what}.` })),
  },
  { key: 'violence', title: 'Violence', options: pick('Violence', [['Restrained', 'restrained, hinted at'], ['Graphic', 'graphic and brutal']]) },
  { key: 'length', title: 'Length', options: pick('Length', [['Short', 'short, a few paragraphs'], ['Medium', 'a page or two'], ['Long', 'long and detailed']]) },
  {
    key: 'out', title: 'Keep out', many: true,
    options: [
      ['No dice', 'dice'], ['No game terms', 'game terms'], ['No modern speech', 'modern speech'], ['No real names', 'real player names'],
    ].map(([label, what]) => ({ label: label!, line: `Keep out: ${what}.` })),
  },
];

const linesOf = (text: string) => (text === '' ? [] : text.split('\n'));

export const isOn = (text: string, o: ChipOption): boolean => linesOf(text).includes(o.line);

export function toggleChip(text: string, g: ChipGroup, o: ChipOption): string {
  let lines = linesOf(text);
  if (lines.includes(o.line)) return lines.filter((l) => l !== o.line).join('\n');
  if (!g.many) {
    const mine = new Set(g.options.map((x) => x.line));
    lines = lines.filter((l) => !mine.has(l));
  }
  return [...lines, o.line].join('\n');
}
