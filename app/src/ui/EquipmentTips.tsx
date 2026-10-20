/* What a piece of equipment does, item by item – the tooltips an NPC's equipment carries, under its card's "Equipment:" line. */
import type { EquipmentTip } from '@mordheim/core';

export function EquipmentTips({ tips }: { tips: readonly EquipmentTip[] }) {
  if (tips.length === 0) return null;
  return (
    <div>
      <p><strong>Equipment tooltips:</strong></p>
      <ul>{tips.map((t, i) => <li key={`${i}:${t.name}`}>{t.text.trim() ? `${t.name}: ${t.text.trim()}` : t.name}</li>)}</ul>
    </div>
  );
}
