let players = [];
let firstPlayer = null;
let rolesStructure = {}; // אתחול ריק במקום null

const getAssignedRolesStructure = () => {
  console.log('getAssignedRolesStructure called!'); // בדיקה אם הפונקציה נקראת
  // console.log('Current roles structure:', JSON.stringify(rolesStructure, null, 2)); // הדפסת המבנה הנוכחי
  return rolesStructure;
};
const setAssignedRolesStructure = (newRolesStructure) => {
  rolesStructure = newRolesStructure || {}; // שמירה על מבנה ריק במקרה של null
  console.log('Roles Structure Updated:', rolesStructure); // הדפסת המבנה בכל עדכון
};

const addPlayer = (playerName, socketId) => {
  if (!players.some(player => player.name === playerName)) {
    players.push({ 
      name: playerName, 
      socketId, 
      role: null, 
      isAlive: true, 
      ready: false, // מוכנות עבור עמוד התפקידים
      readyNight: false, // מוכנות עבור עמוד הלילה
      readyDay: false, // מוכנות עבור עמוד הלילה
      locked: false,
      hunterChoseTarget: false,
    });
    if (!firstPlayer) {
      firstPlayer = playerName; // הגדרת המנהל הראשון
    }
  }
};

const assignRoleToPlayer = (playerName, role) => {
  const player = players.find((player) => player.name === playerName);
  if (player) {
    player.role = role;
  }
};

const setPlayerReady = (playerName, isReady) => {
  const player = players.find(player => player.name === playerName);
  if (player) {
    player.ready = isReady;
  }
};

const areAllPlayersReady = () => players.every(player => player.ready);

const resetPlayersReady = () => players.forEach(player => (player.ready = false));

const getPlayers = () => {
  return { players, firstPlayer };
};

const getPlayersRoles = () => {
  return players.map(player => player.name); // החזרת שמות בלבד
};
const removePlayer = (socketId) => {
  players = players.filter((player) => player.socketId !== socketId);

  if (firstPlayer && firstPlayer.socketId === socketId) {
    firstPlayer = players.length > 0 ? players[0] : null;
  }
};

const getPlayerSocketId = (playerName) => {
  const player = players.find((player) => player.name === playerName);
  return player ? player.socketId : null;
};


const setWolfTarget = (wolfName, targetName) => {
  const wolfRole = Object.keys(rolesStructure).find((role) =>
    role.includes('זאב') &&
    rolesStructure[role].some(player => player.name === wolfName)
  );

  if (wolfRole) {
    const wolf = rolesStructure[wolfRole].find(player => player.name === wolfName);
    if (wolf) {
      wolf.wolfChoose = targetName; // עדכון המטרה של הזאב
      console.log(`Wolf ${wolfName} chose ${targetName}`);
    }
  }
};

const resetGamePlayers = () => {
  players = [];
  firstPlayer = null;
  setAssignedRolesStructure({}); // איפוס מבנה התפקידים
};


module.exports = {
  addPlayer,
  setPlayerReady,
  areAllPlayersReady,
  resetPlayersReady,
  assignRoleToPlayer,
  getPlayers,
  removePlayer,
  getPlayerSocketId,
  getPlayersRoles,
  getAssignedRolesStructure,
  setAssignedRolesStructure,
  setWolfTarget,
  resetGamePlayers,
};