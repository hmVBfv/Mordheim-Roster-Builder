/* The equipment line of an NPC as words that carry their tooltip, the way the
   equipment of a unit in a warband does: the line is split into items, and an
   item gets the tooltip stored under its name (a pick from the game's list
   brings it, a leader's own words may too). A tooltip that no item names stays
   in `rest`, so it is still shown. Pure. */
import type { EquipmentTip } from '@mordheim/core';

export interface EquipmentWord { label: string; tip: EquipmentTip | null }

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** The name inside an item as typed: without a count ("2x", "x2") and without a note in brackets. */
const nameOf = (item: string) => fold(item.replace(/\([^)]*\)/g, ' ').replace(/^\s*\d+\s*x\s+/i, '').replace(/\s+x\s*\d+\s*$/i, ''));

export function equipmentWords(equipment: string, tips: readonly EquipmentTip[]): { items: EquipmentWord[]; rest: EquipmentTip[] } {
  const used = new Set<EquipmentTip>();
  const items = equipment.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean).map((label) => {
    const n = nameOf(label);
    const tip = tips.find((t) => fold(t.name) === n) ?? null;
    if (tip) used.add(tip);
    return { label, tip };
  });
  return { items, rest: tips.filter((t) => !used.has(t)) };
}
