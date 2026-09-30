/* The five skill lists of the rulebook with our short rules texts, copied
   from data/skills.json (SKILLLISTS) so the mockups can offer every skill a
   Hero may learn, as the builder will (Rob, 30.09.2026: "Wird es fuer die
   ganzen Felder ... noch weitere Auswahlmoeglichkeiten geben?"). Refresh it
   from the data rather than editing it here. */
(function () {
  var LISTS = {
    combat: { name: "Combat", skills: [
      ["Strike to Injure","+1 to all injury rolls caused in hand-to-hand combat."],
      ["Combat Master","Fighting 2+ enemies: +1 Attack each close-combat phase; immune to All Alone tests."],
      ["Weapons Training","May use any hand-to-hand weapon, not just those in his equipment options."],
      ["Web of Steel","+1 to all his Critical Hit rolls in hand-to-hand combat."],
      ["Expert Swordsman","Re-roll all missed attacks in the close-combat phase of the turn he CHARGES, while armed with a sword (RB 122). FAQ: Only normal swords or weeping blades — not double-handed swords or any other weapon."],
      ["Step Aside","Each time he suffers a wound in close combat he may make an additional saving throw of 5+. This save is never modified and is taken after all other armour saves."]
    ] },
    shooting: { name: "Shooting", skills: [
      ["Quick Shot","May shoot twice per turn with a bow or crossbow (not a crossbow pistol)."],
      ["Pistolier","Brace of pistols: Fire twice; a single pistol may fire the turn it was reloaded."],
      ["Eagle Eyes","+6\" to the range of any missile weapon."],
      ["Weapons Expert","May use any missile weapon, not just those on his warband list."],
      ["Nimble","May move and fire with weapons that normally require staying still (not with Quick Shot)."],
      ["Trick Shooter","Ignores all cover modifiers when shooting."],
      ["Hunter","May fire every turn with a handgun or Hochland long rifle."],
      ["Knife-Fighter","Throw up to three throwing knives/stars per shooting phase, split between targets (not with Quick Shot)."]
    ] },
    academic: { name: "Academic", skills: [
      ["Battle Tongue","Leader only: +6\" to his Leader range (not Undead leaders)."],
      ["Sorcery","Spellcasters only: +1 to rolls to cast spells (not Sisters of Sigmar / Warrior-Priests)."],
      ["Streetwise","+2 to the roll to find rare items."],
      ["Haggle","Deduct 2D6 gc from one item's price (min 1 gc), once per post-battle sequence."],
      ["Arcane Lore","May learn Lesser Magic if he owns a Tome of Magic (not Witch Hunters / Sisters / Warrior-Priests)."],
      ["Wyrdstone Hunter","Re-roll one die on the Exploration chart (second result stands)."],
      ["Warrior Wizard","Spellcasters only: May wear armour and still cast spells."]
    ] },
    strength: { name: "Strength", skills: [
      ["Mighty Blow","+1 Strength in close combat (excluding pistols)."],
      ["Pit Fighter","+1 WS and +1 Attack when fighting inside buildings or ruins."],
      ["Resilient","-1 Strength to all close-combat hits against him (does not affect armour save modifiers)."],
      ["Fearsome","Causes fear in opposing models."],
      ["Strongman","May use a double-handed weapon without the always-strikes-last penalty."],
      ["Unstoppable Charge","+1 Weapon Skill when charging."]
    ] },
    speed: { name: "Speed", skills: [
      ["Leap","Leap D6\" in the movement phase, in addition to normal movement (once per turn)."],
      ["Sprint","Triple Movement when running or charging (instead of doubling)."],
      ["Acrobat","Fall/jump up to 12\" unharmed on an Initiative test; re-roll failed Diving Charge rolls."],
      ["Lightning Reflexes","Strikes first against chargers (compare Initiative if both would strike first)."],
      ["Jump Up","Springs up instantly if knocked down (counts as having moved). Ignores 'knocked down' results when rolling for injuries — except when knocked down by a successful helmet save or if he has the No Pain rule (FAQ)."],
      ["Dodge","Avoid any missile hit on a D6 roll of 5+ (rolled when hit, before rolling to wound)."],
      ["Scale Sheer Surfaces","Climb up or down twice his Movement with no Initiative tests."]
    ] }
  };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  window.MOCK_SKILLS = LISTS;
  // what a skill does, from any of the lists
  window.mockSkillText = function (name) {
    for (var k in LISTS) for (var i = 0; i < LISTS[k].skills.length; i++) if (LISTS[k].skills[i][0] === name) return LISTS[k].skills[i][1];
    return '';
  };
  /* A picker of every skill in the given lists that the warrior does not
     have yet, grouped by list, the first one chosen. One .pick, so a choice
     anywhere in it replaces the one before (mockups.js). */
  window.mockSkillPicker = function (keys, known) {
    var first = true, html = '';
    keys.forEach(function (k) {
      var L = LISTS[k]; if (!L) return;
      var left = L.skills.filter(function (s) { return (known || []).indexOf(s[0]) < 0; });
      if (!left.length) return;
      html += '<span class="pick-h">' + esc(L.name) + '</span>' + left.map(function (s) {
        var b = '<button type="button" data-value="' + esc(s[0]) + '" aria-pressed="' + first + '">' + esc(s[0]) + '</button>';
        first = false; return b;
      }).join('');
    });
    return html ? '<div class="pick skills">' + html + '</div>' : '<p class="muted">He knows every skill of his lists.</p>';
  };
})();
