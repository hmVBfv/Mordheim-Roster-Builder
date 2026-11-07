/* The game data the parity tests run on. Legacy knows no limit on War Beasts (a Beastmaster's beasts: `beasts`, `beastMax`; report #198) and treat a Hero who may be made a Wizard for gold as one from the start (`wizardOption`; report
   #199, docs/behaviour-changes.md), a unit's upgrade for gold (`upgradeOption`, Black Orc Blood; report #217), so both sides are compared on the data without those keys – these four,
   nothing else. Their own tests are in core/test/war-beasts.test.ts, core/test/wizard-option.test.ts and core/test/black-orc-blood.test.ts. */
import { readFileSync } from 'node:fs';
import { createGameData } from '../../src/data/gameData.ts';
import { DATA_FILES, type GameData, type RawGameData } from '../../src/data/types.ts';
import { DEFAULT_DATA_DIR } from '../../src/node.ts';

export function loadParityData(): GameData {
  const raw: RawGameData = {};
  for (const f of DATA_FILES) raw[f] = JSON.parse(readFileSync(`${DEFAULT_DATA_DIR}${f}.json`, 'utf8')) as Record<string, unknown>;
  const wbs = (raw.warbands as { WARBANDS: Record<string, { units?: Record<string, unknown>[] }> }).WARBANDS;
  for (const w of Object.values(wbs)) for (const u of w.units ?? []) { delete u.beasts; delete u.beastMax; delete u.wizardOption; delete u.upgradeOption; }
  return createGameData(raw);
}
