// roles.js
// Purpose: Assign roles to players based on settings and build the roles structure persisted in players module.
// Notes:
// - Returns cached assignment if already computed for the current process lifetime.
// - Uses simple array shuffle via sort(Math.random() - 0.5). For production-grade randomness, consider Fisher–Yates.
// - Do not remove fields in the player payload: other parts of the app expect these flags/props.

const { setAssignedRolesStructure } = require('./players');

let assignedRolesCache = null;
let rolesStructure = null;

const assignRoles = (settings, players) => {
  // Return cached mapping if already assigned
  if (assignedRolesCache && rolesStructure) return { assignedRolesCache, rolesStructure };

  // Build roles list from settings
  const roles = [];
  for (let i = 0; i < settings.wolvesCount; i++) {
    roles.push(i === 0 ? 'זאב מנהיג הלהקה' : `זאב ${i + 1}`);
  }
  if (settings.elder) roles.push('זקן השבט');
  if (settings.shield) roles.push('מגן');
  if (settings.seer) roles.push('מגדת עתידות');
  if (settings.witch) roles.push('מכשפה');
  if (settings.hunter) roles.push('צייד');
  if (settings.cupid) roles.push('קופידון');
  if (settings.leech) roles.push('עלוקה');

  // Fill remainder with villagers
  while (roles.length < players.length) {
    roles.push('אזרח');
  }

  // Shuffle roles (simple/randomized ordering)
  const shuffledRoles = roles.sort(() => Math.random() - 0.5);

  // Map player name → role
  assignedRolesCache = players.reduce((acc, player, index) => {
    acc[player.name] = shuffledRoles[index];
    return acc;
  }, {});

  // Build roles structure: role → array of player state objects
  rolesStructure = players.reduce((acc, player, index) => {
    const role = shuffledRoles[index];
    if (!acc[role]) acc[role] = [];
    acc[role].push({
      name: player.name,
      isAlive: true,
      // readiness flags
      ready: false,
      readyNight: false,
      readyDay: false,
      readyVote: false,
      // voting/day-phase state
      voteConfirm: false,
      deadVote: null,
      voteTarget: null,
      // mayor flow
      mayorConfirm: false,
      mayorReady: false,
      mayor: false,
      mayorName: null,
      mayorVote: null,
      // elder special: elder gets 2 lives
      liveCount: role.includes('זקן השבט') ? 2 : 1,
      // cupid / lovers
      lover: role.includes('קופידון') ? null : undefined,
      // wolves targeting
      wolfChoose: role.includes('זאב') ? null : undefined,
      // shield
      shild: null,
      shildSelf: false,
      // witch potions
      usedLifePotion: false,
      lifeTarget: null,
      usedDeathPotion: false,
      deathTarget: null,
      // wolves final target (for witch prompt)
      wolfFinalTarget: null,
      // elder attack tracking
      isAttackedOnce: false,
      olderInTheGame: settings.elder,
      olderAlive: true,
      // hunter state
      hunter: null,
      // night flag (first night narrative/UX)
      isFirstNight: true,
      // lock flags (e.g., confirm choices)
      locked: false,
      // hunter finished decision
      hunterChoseTarget: false,
    });
    return acc;
  }, {});

  // Persist in players module for global access
  setAssignedRolesStructure(rolesStructure);
  console.log('Final assigned roles structure:', JSON.stringify(rolesStructure, null, 2));

  return { assignedRolesCache, rolesStructure };
};

module.exports = { assignRoles, rolesStructure };
