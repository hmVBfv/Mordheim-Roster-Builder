/* The rules on the server – only where ADR 0005 has the server compute:
   the binding totals and changes when a warband is marked (a tag). The
   data files are bundled in (build.mjs), so the image needs no data
   directory; they are read into game data on first use. */
import { createGameData, ctxOf, loadSave, stageTotals, type GameData, type RawGameData, type StageTotals } from '@mordheim/core';
import races from '../../data/races.json' with { type: 'json' };
import equipment from '../../data/equipment.json' with { type: 'json' };
import skills from '../../data/skills.json' with { type: 'json' };
import spells from '../../data/spells.json' with { type: 'json' };
import abilities from '../../data/abilities.json' with { type: 'json' };
import mutations from '../../data/mutations.json' with { type: 'json' };
import injuries from '../../data/injuries.json' with { type: 'json' };
import i18n from '../../data/i18n.json' with { type: 'json' };
import houserules from '../../data/houserules.json' with { type: 'json' };
import marks from '../../data/marks.json' with { type: 'json' };
import sheet from '../../data/sheet.json' with { type: 'json' };
import campaign from '../../data/campaign.json' with { type: 'json' };
import warbands from '../../data/warbands.json' with { type: 'json' };
import hiredswords from '../../data/hiredswords.json' with { type: 'json' };
import dramatis from '../../data/dramatis.json' with { type: 'json' };
import postbattle from '../../data/postbattle.json' with { type: 'json' };

const RAW: RawGameData = { races, equipment, skills, spells, abilities, mutations, injuries, i18n, houserules, marks, sheet, campaign, warbands, hiredswords, dramatis, postbattle };

let data: GameData | null = null;

export function gameData(): GameData {
  data ??= createGameData(structuredClone(RAW) as RawGameData);
  return data;
}

/** The totals of a stored save as core computes them, or null when core cannot read it. */
export function totalsOf(save: unknown): StageTotals | null {
  const r = loadSave(gameData(), save);
  return r.ok ? stageTotals(ctxOf(gameData(), r.state)) : null;
}
