const { setAssignedRolesStructure } = require('./players'); // ייבוא הפונקציה

let assignedRolesCache = null;
let rolesStructure = null;

const assignRoles = (settings, players) => {
  if (assignedRolesCache && rolesStructure) return { assignedRolesCache, rolesStructure };

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

  while (roles.length < players.length) {
    roles.push('אזרח');
  }

  const shuffledRoles = roles.sort(() => Math.random() - 0.5);
  assignedRolesCache = players.reduce((acc, player, index) => {
    acc[player.name] = shuffledRoles[index];
    return acc;
  }, {});

  rolesStructure = players.reduce((acc, player, index) => {
    const role = shuffledRoles[index];
    if (!acc[role]) acc[role] = [];
    acc[role].push({
      name: player.name,
      isAlive: true,
      ready: false,
      readyNight: false,
      readyDay: false,
      readyVote: false,
      voteConfirm: false,
      deadVote : null,
      voteTarget : null,
      mayorConfirm: false,
      mayorReady: false,
      mayor: false,
      mayorName: null,
      mayorVote: null,
      liveCount: role.includes('זקן השבט') ? 2 : 1, // ערך 2 לזקן השבט ו-1 לאחרים
      lover: role.includes('קופידון') ? null : undefined,
      wolfChoose: role.includes('זאב') ? null : undefined, // שמירה לזאבים בלבד
      shild: null,
      shildSelf: false,
      usedLifePotion: false,
      lifeTarget: null,
      usedDeathPotion: false,
      deathTarget: null,
      wolfFinalTarget: null,
      isAttackedOnce: false,
      olderInTheGame: settings.elder,
      olderAlive: true,
      hunter: null,
      isFirstNight: true, 
      locked: false,
      hunterChoseTarget: false,
    });
    return acc;
  }, {});

  setAssignedRolesStructure(rolesStructure);
  console.log('Final assigned roles structure:', JSON.stringify(rolesStructure, null, 2));

  return { assignedRolesCache, rolesStructure };
};

module.exports = { assignRoles, rolesStructure };
