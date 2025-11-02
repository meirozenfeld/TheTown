// players.js
// Purpose: Manage player state for the game server (registration, readiness, roles structure, and targets).
// Notes:
// - Do not remove fields from player records; other services/pages rely on them.
// - rolesStructure is a shared, server-side cache set by the role assignment module.

let players = [];
let firstPlayer = null;
let rolesStructure = {}; // Initialized as an empty object

// ===== Roles structure (shared with roles assignment) =====
const getAssignedRolesStructure = () => {
  console.log('getAssignedRolesStructure called!');
  return rolesStructure;
};

const setAssignedRolesStructure = (newRolesStructure) => {
  rolesStructure = newRolesStructure || {};
  console.log('Roles Structure Updated:', rolesStructure);
};

// ===== Player lifecycle =====
/**
 * Register a new player if the name is not already taken.
 * The first arriving player becomes the manager (firstPlayer).
 */
const addPlayer = (playerName, socketId) => {
  if (!players.some((p) => p.name === playerName)) {
    players.push({
      name: playerName,
      socketId,
      role: null,
      isAlive: true,
      // readiness flags for different phases
      ready: false, // role page
      readyNight: false,
      readyDay: false,
      locked: false,
      // hunter flow
      hunterChoseTarget: false,
      // cupid
      lover: '',
    });

    if (!firstPlayer) {
      firstPlayer = playerName; // store first player's NAME
    }
  }
};

/**
 * Assign a role to a player (name → role mapping kept locally in players array).
 */
const assignRoleToPlayer = (playerName, role) => {
  const player = players.find((p) => p.name === playerName);
  if (player) {
    player.role = role;
  }
};

/**
 * Set a player's "ready" state for the role page.
 */
const setPlayerReady = (playerName, isReady) => {
  const player = players.find((p) => p.name === playerName);
  if (player) {
    player.ready = isReady;
  }
};

/**
 * Are all players ready (for the current phase represented by `ready`)?
 */
const areAllPlayersReady = () => players.every((p) => p.ready);

/**
 * Reset "ready" state (role page) for all players.
 */
const resetPlayersReady = () => players.forEach((p) => (p.ready = false));

/**
 * Return the full players list and the first player's name (manager).
 */
const getPlayers = () => {
  return { players, firstPlayer };
};

/**
 * Return only the players' names (used in several flows).
 */
const getPlayersRoles = () => {
  return players.map((p) => p.name);
};

/**
 * Remove a player by socket id.
 * If the removed player was the manager (firstPlayer), promote the next player (by arrival order).
 */
const removePlayer = (socketId) => {
  // Identify the player being removed BEFORE filtering
  const removed = players.find((p) => p.socketId === socketId);

  players = players.filter((p) => p.socketId !== socketId);

  // If firstPlayer (name) matches the removed player's name, promote the next one
  if (removed && firstPlayer === removed.name) {
    firstPlayer = players.length > 0 ? players[0].name : null;
  }
};

/**
 * Get a player's socket id by their name.
 */
const getPlayerSocketId = (playerName) => {
  const player = players.find((p) => p.name === playerName);
  return player ? player.socketId : null;
};

// ===== Wolves targeting (night phase) =====
/**
 * Persist the target chosen by a specific wolf (by name).
 * Walks rolesStructure to find the wolf entry and updates its `wolfChoose`.
 */
const setWolfTarget = (wolfName, targetName) => {
  const wolfRole = Object.keys(rolesStructure).find(
    (role) =>
      role.includes('זאב') &&
      rolesStructure[role].some((player) => player.name === wolfName)
  );

  if (wolfRole) {
    const wolf = rolesStructure[wolfRole].find((p) => p.name === wolfName);
    if (wolf) {
      wolf.wolfChoose = targetName;
      console.log(`Wolf ${wolfName} chose ${targetName}`);
    }
  }
};

// ===== Reset game state =====
/**
 * Clear all players and reset the first player and roles structure.
 */
const resetGamePlayers = () => {
  players = [];
  firstPlayer = null;
  setAssignedRolesStructure({}); // also clears rolesStructure
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
