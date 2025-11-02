// socketHandlers.js
const { exec } = require('child_process');
const path = require('path');

const {
  addPlayer,
  setPlayerReady,
  areAllPlayersReady,
  resetPlayersReady,
  getPlayers,
  removePlayer,
  getPlayerSocketId,
  getAssignedRolesStructure,
  setAssignedRolesStructure,
  resetGamePlayers,
} = require('./utils/players');
const { assignRoles } = require('./utils/assignRoles');
const { getSettings } = require('./controllers/settingsController');

let hunterChoosing = false; // Global flag: hunter selection phase active
let nightProcessingLock = false; // Lock to prevent duplicate night processing
let cachedNightResult = null; // Cached night result for broadcast reuse

const calculateWolfTarget = (io) => {
  console.log('calculateWolfTarget מופעל!');
  const rolesStructure = getAssignedRolesStructure();
  console.log('מבנה תפקידים בעת חישוב המטרה:', JSON.stringify(rolesStructure, null, 2));

  // Collect all wolves while retaining their role label
  const wolves = Object.entries(rolesStructure)
    .filter(([role]) => role.includes('זאב'))
    .flatMap(([role, players]) => players.map((player) => ({ ...player, role })));

  const votes = {};
  let leaderVote = null;

  // Aggregate votes and capture leader’s vote if alive
  wolves.forEach((wolf) => {
    if (wolf.isAlive && wolf.wolfChoose) {
      votes[wolf.wolfChoose] = (votes[wolf.wolfChoose] || 0) + 1;

      if (wolf.isAlive && wolf.role.includes('מנהיג')) {
        leaderVote = wolf.wolfChoose;
      }
    }
  });

  // Determine popular targets
  const maxVotes = Math.max(...Object.values(votes), 0);
  const tiedTargets = Object.keys(votes).filter((t) => votes[t] === maxVotes);

  let finalTarget = null;

  if (tiedTargets.length > 1) {
    console.log('יש תיקו בין המטרות:', tiedTargets);

    // Wolf priority by role
    const wolfHierarchy = [
      'זאב מנהיג הלהקה',
      'זאב 2',
      'זאב 3',
      'זאב 4',
      'זאב 5',
      'זאב 6',
      'זאב 7',
      'זאב 8',
      'זאב 9',
      'זאב 10',
    ];

    for (const role of wolfHierarchy) {
      const prioritizedWolf = wolves.find(
        (wolf) => wolf.role.includes(role) && wolf.isAlive && tiedTargets.includes(wolf.wolfChoose),
      );
      if (prioritizedWolf) {
        finalTarget = prioritizedWolf.wolfChoose;
        break;
      }
    }
  } else if (tiedTargets.length === 1) {
    finalTarget = tiedTargets[0];
  } else {
    // No votes -> default to leader’s vote (if present)
    finalTarget = leaderVote || null;
  }

  console.log('המטרה הסופית של הזאבים:', finalTarget);

  if (finalTarget) {
    // Persist target for all players (used later in night resolution)
    Object.values(rolesStructure)
      .flat()
      .forEach((player) => {
        player.wolfFinalTarget = finalTarget;
      });

    io.emit('wolfFinalTarget', finalTarget);
  } else {
    console.log('לא נבחרה מטרה סופית לזאבים.');
    io.emit('wolfFinalTarget', null);
  }
};

let currentPlayer = null;

const handleSocketEvents = (socket, io) => {
  const { players, firstPlayer } = getPlayers();
  socket.emit('updatePlayers', players);
  socket.emit('setFirstPlayer', firstPlayer);

  socket.on('currentPlayer', (playerName) => {
    currentPlayer = playerName;
  });

  socket.on('requestSettings', () => {
    const settings = getSettings();
    if (settings) {
      socket.emit('settingsReceived', settings);
    } else {
      socket.emit('error', 'Settings not found');
    }
  });

  // Join game
  socket.on('joinGame', (playerName) => {
    const existingPlayers = getPlayers().players;
    const isNameTaken = existingPlayers.some((player) => player.name === playerName);

    if (isNameTaken) {
      socket.emit('nameTaken', `השם ${playerName} תפוס. אנא בחר שם אחר.`);
    } else {
      addPlayer(playerName, socket.id);
      io.emit('updatePlayers', getPlayers().players);
      const { firstPlayer } = getPlayers();
      io.emit('setFirstPlayer', firstPlayer);
    }
  });

  // Navigate to settings screen
  socket.on('startGame', () => {
    io.emit('gameNavigation');
    io.emit('pushState', '/settings');
    io.emit('navigateToSettings');
  });

  socket.on('settingsUpdated', () => {
    io.emit('gameNavigation');
    io.emit('pushState', '/role');
    io.emit('navigateToRolePage');
  });

  // Role request + wolves room join
  socket.on('requestRole', (playerName) => {
    const players = getPlayers().players;
    const gameSettings = getSettings();
    if (!gameSettings || Object.keys(gameSettings).length === 0) {
      return socket.emit('error', 'Game settings are not available');
    }

    const { assignedRolesCache, rolesStructure } = assignRoles(gameSettings, players);
    const role = assignedRolesCache[playerName];

    if (role) {
      socket.emit('roleAssigned', { playerName, role });

      // Add to wolves room if wolf (avoid re-joining if already in)
      const rooms = Array.from(socket.rooms);
      if (role.includes('זאב') && !rooms.includes('wolvesRoom')) {
        socket.join('wolvesRoom');
        console.log(`${playerName} הצטרף לחדר הזאבים.`);
      }
    }
  });

  // Wolf-only chat message
  socket.on('wolfChatMessage', ({ senderName, message }) => {
    console.log(`שידור הודעה לחדר הזאבים מ- ${senderName}: ${message}`);
    io.to('wolvesRoom').emit('wolfChatMessage', {
      senderName,
      message,
    });
    console.log(`Wolf ${senderName} sent message: ${message}`);
  });

  // Cupid selects lover
  socket.on('updateLover', ({ cupidName, loverName }) => {
    const rolesStructure = getAssignedRolesStructure();

    if (!rolesStructure) {
      console.error('Roles structure is not initialized.');
      return;
    }

    const cupidRole = Object.keys(rolesStructure).find((role) => role.includes('קופידון'));

    if (cupidRole) {
      const cupid = rolesStructure[cupidRole].find((p) => p.name === cupidName);
      if (cupid) {
        cupid.lover = loverName;
        console.log('Cupid lover updated:', cupid);
        console.log('Updated roles structure before emitting:', rolesStructure);

        io.emit('rolesStructure', rolesStructure);
      } else {
        console.error(`Cupid ${cupidName} not found.`);
      }
    } else {
      console.error('No cupid role found.');
    }
  });

  // Utility: check if Elder is dead
  const isElderDead = () => {
    const rolesStructure = getAssignedRolesStructure();
    const elder = Object.entries(rolesStructure)
      .filter(([role]) => role.includes('זקן השבט'))
      .flatMap(([_, players]) => players)[0];

    return elder && !elder.isAlive;
  };

  // Hunter selects a target (triggered after hunter death)
  socket.on('hunterChooseTarget', ({ hunterName, targetName }) => {
    const rolesStructure = getAssignedRolesStructure();
    hunterChoosing = false; // Hunter finished

    const hunter = Object.entries(rolesStructure)
      .filter(([role]) => role.includes('צייד'))
      .flatMap(([_, players]) => players)[0];

    // Elder rule: if Elder is dead, hunter cannot choose
    if (isElderDead()) {
      console.log('זקן השבט מת - הצייד אינו יכול לבחור מטרה.');
      hunterChoosing = false;
      io.emit('hunterFinishedNoElder');
      return;
    }

    // Prevent double choice by hunter
    if (hunter.hunterChoseTarget) {
      console.log(`${hunterName} כבר בחר מטרה. בחירה נוספת לא תתבצע.`);
      return;
    }

    // Mark that hunter used his shot
    hunter.hunterChoseTarget = true;
    console.log(`Hunter event received: ${hunterName} בחר לצוד את ${targetName}`);

    console.log('Roles structure for Hunter:', JSON.stringify(rolesStructure, null, 2));

    let target = null;
    let targetRole = null;

    // Locate target and role
    for (const [role, players] of Object.entries(rolesStructure)) {
      console.log(`Checking role: ${role}`);
      const foundTarget = players.find((p) => p.name === targetName);
      if (foundTarget) {
        target = foundTarget;
        targetRole = role;
        break;
      }
    }

    if (target) {
      target.isAlive = false;
      console.log(`${hunterName} צד את ${targetName} בתפקיד ${targetRole}`);

      // Cupid / lover cascade deaths
      const cupids = Object.entries(rolesStructure)
        .filter(([role]) => role.includes('קופידון'))
        .flatMap(([_, players]) => players);

      // Case 1: Cupid died → lover dies too (only if Cupid == target)
      cupids.forEach((cupid) => {
        if (!cupid.isAlive && cupid.lover) {
          let lover = null;
          let loverRole = null;
          for (const [roleName, players] of Object.entries(rolesStructure)) {
            const foundLover = players.find((player) => player.name === cupid.lover);
            if (foundLover) {
              lover = foundLover;
              loverRole = roleName;
              break;
            }
          }

          if (lover && lover.isAlive && cupid.name === targetName) {
            console.log(`Cupid ${cupid.name} died. Checking lover: ${cupid.lover}`);
            lover.isAlive = false;
            if (loverRole === 'זקן השבט') {
              io.emit(
                'hunterMessage',
                ` ${lover.name} בתפקיד ${loverRole} יצא מהמשחק כנאהב של הקופידון!\n מעכשיו ועד סוף המשחק לא יהיו לאזרחים כוחות בלילה.`,
              );
            } else {
              io.emit(
                'hunterMessage',
                `${lover.name} בתפקיד ${loverRole} יצא מהמשחק כנאהב של הקופידון!`,
              );
            }
          }
        }
      });

      // Case 2: Lover died → cupid dies (only if lover == target)
      cupids.forEach((cupid) => {
        let lover = null;
        for (const [roleName, players] of Object.entries(rolesStructure)) {
          lover = players.find((player) => player.name === cupid.lover && !player.isAlive);
          if (lover) break;
        }

        if (cupid.lover === targetName && cupid.isAlive) {
          cupid.isAlive = false;
          io.emit(
            'hunterMessage',
            `${cupid.name} בתפקיד הקופידון יצא מהמשחק מאחר שבחר לנאהב את ${lover.name}`,
          );
        }
      });

      // Notify hunter personally
      io.to(getPlayerSocketId(hunterName)).emit('hunterTargetSelected', {
        targetName: target.name,
        targetRole: targetRole,
      });

      // Notify all players
      io.emit('hunterFinished', { hunterName, targetName, targetRole });

      // Navigate killed target to Dead page
      io.to(getPlayerSocketId(targetName)).emit('navigateToDead', {
        message: `${hunterName} בתפקיד צייד הרג אותך בתפקיד ${targetRole}!`,
      });
      io.to(getPlayerSocketId(targetName)).emit('gameNavigation');
      io.to(getPlayerSocketId(targetName)).emit('pushState', '/dead');

      // Day page message for alive players
      const alivePlayers = Object.values(rolesStructure)
        .flat()
        .filter((p) => p.isAlive);
      alivePlayers.forEach((player) => {
        io.to(getPlayerSocketId(player.name)).emit(
          'nightResult',
          `${hunterName} בתפקיד צייד צד את ${target.name} בתפקיד ${targetRole}!`,
        );
      });

      // Global hunter message (+ Elder side-effect if applicable)
      if (targetRole === 'זקן השבט') {
        io.emit(
          'hunterMessage',
          `${hunterName} בתפקיד צייד צד את ${target.name} בתפקיד ${targetRole}! \nמעכשיו ועד סוף המשחק לא יהיו לאזרחים כוחות בלילה.`,
        );
      } else {
        io.emit(
          'hunterMessage',
          `${hunterName} בתפקיד צייד צד את ${target.name} בתפקיד ${targetRole}!`,
        );
      }

      setAssignedRolesStructure(rolesStructure);

      // Check end-game state
      const gameEnded = checkGameEnd(io);
      if (gameEnded) {
        console.log('Game ended after hunter action.');
        io.emit('navigateToEndGame');
      } else {
        console.log('המשחק ממשיך לאחר בחירת הצייד.');
      }
    } else {
      console.error('Target not found:', targetName);
    }
  });

  // Roles structure request (plus elder status)
  socket.on('requestRolesStructure', () => {
    const rolesStructure = getAssignedRolesStructure();
    const elderDead = isElderDead();
    console.log('Sending roles structure with elder status:', elderDead);

    socket.emit('rolesStructure', rolesStructure);
    socket.emit('elderStatus', { elderDead });
  });

  // Clear mayor (head) when requested
  socket.on('mayorDead', ({ mayorDeadFlag }) => {
    const rolesStructure = getAssignedRolesStructure();
    if (mayorDeadFlag) {
      for (const [role, players] of Object.entries(rolesStructure)) {
        players.forEach((player) => {
          player.mayorName = null;
          player.mayor = false;
        });
      }
    }
  });

  // Ready check for Night page
  socket.on('toggleReadyRole', ({ playerName, isReady }) => {
    setPlayerReady(playerName, isReady);

    const allReady = areAllPlayersReady();
    io.emit('updatePlayersReady', allReady);

    if (allReady) {
      resetPlayersReady();
      io.emit('gameNavigation');
      io.emit('pushState', '/night');
      io.emit('navigateToNight');
    }
  });

  // Ready check for Day page (alive players only)
  socket.on('toggleReadyDay', ({ playerName, isReadyDay }) => {
    const rolesStructure = getAssignedRolesStructure();

    for (const [role, players] of Object.entries(rolesStructure)) {
      const player = players.find((p) => p.name === playerName);
      if (player && player.isAlive) {
        player.readyDay = isReadyDay;
        console.log(`${playerName} updated readyDay to ${isReadyDay}`);
      }
    }

    const allReady = Object.values(rolesStructure)
      .flat()
      .filter((p) => p.isAlive)
      .every((p) => p.readyDay);

    if (allReady) {
      console.log('All players are ready in DAY.');

      const gameEnded = checkGameEnd(io, false);
      if (gameEnded) {
        console.log('Game ended. Navigating to EndGame.');
        io.emit('navigateToEndGame');
        return;
      }

      const alivePlayers = Object.values(rolesStructure)
        .flat()
        .filter((p) => p.isAlive);
      const mayorExists = alivePlayers.some((p) => p.mayor === true);

      if (mayorExists) {
        resetPlayersReadyDay();
        io.emit('gameNavigation');
        io.emit('pushState', '/vote');
        io.emit('navigateToVote');
      } else {
        resetPlayersReadyDay();
        io.emit('gameNavigation');
        io.emit('pushState', '/mayor');
        io.emit('navigateToMayor');
      }
    }
  });

  // Navigate based on whether mayor exists
  socket.on('checkGameFlow', () => {
    const rolesStructure = getAssignedRolesStructure();
    const alivePlayers = Object.values(rolesStructure)
      .flat()
      .filter((p) => p.isAlive);
    const mayorExists = alivePlayers.some((p) => p.mayor === true);
    if (mayorExists) {
      io.emit('navigateToVote');
    } else {
      io.emit('navigateToMayor');
    }
  });

  // Wolf chooses target (store + notify)
  socket.on('setWolfTarget', ({ wolfName, targetName }) => {
    const rolesStructure = getAssignedRolesStructure();

    // Find wolf role
    const wolfRole = Object.keys(rolesStructure).find(
      (role) => role.includes('זאב') && rolesStructure[role].some((player) => player.name === wolfName),
    );

    if (wolfRole) {
      const wolf = rolesStructure[wolfRole].find((player) => player.name === wolfName);
      if (wolf) {
        wolf.wolfChoose = targetName;
        console.log(`Wolf ${wolfName} chose ${targetName}`);

        // Broadcast update
        io.emit('wolfTargetUpdate', {
          senderName: wolfName,
          senderRole: wolfRole,
          targetName,
        });
      }
    }
  });

  // --- Night readiness helpers (alive-only logic) ---
  const setPlayerReadyNight = (playerName, isReady) => {
    const rolesStructure = getAssignedRolesStructure();
    for (const role in rolesStructure) {
      const player = rolesStructure[role].find((p) => p.name === playerName);
      if (player) {
        player.readyNight = isReady;
      }
    }
  };

  const areAllPlayersReadyNight = () => {
    const rolesStructure = getAssignedRolesStructure();
    const allAlivePlayers = Object.values(rolesStructure)
      .flat()
      .filter((player) => player.isAlive);

    console.log(
      'Check All Alive Players Ready Night:',
      allAlivePlayers.map((p) => ({ name: p.name, readyNight: p.readyNight })),
    );

    const allReady = allAlivePlayers.every((player) => player.readyNight === true);
    console.log('All Ready Check (Alive Only):', allReady);
    return allReady;
  };

  const resetPlayersReadyNight = () => {
    const rolesStructure = getAssignedRolesStructure();
    for (const role in rolesStructure) {
      rolesStructure[role].forEach((player) => (player.readyNight = false));
      // rolesStructure[role].forEach(player => player.isFirstNight = false);
    }
  };

  const resetPlayersReadyDay = () => {
    const rolesStructure = getAssignedRolesStructure();
    for (const role in rolesStructure) {
      rolesStructure[role].forEach((player) => (player.readyDay = false));
      rolesStructure[role].forEach((player) => (player.deathTarget = null));
      rolesStructure[role].forEach((player) => (player.lifeTarget = null));
      rolesStructure[role].forEach((player) => (player.shild = null));
    }
  };

  const resetPlayersReadyMayor = () => {
    const rolesStructure = getAssignedRolesStructure();
    for (const role in rolesStructure) {
      rolesStructure[role].forEach((player) => (player.mayorReady = false));
      rolesStructure[role].forEach((player) => (player.mayorConfirm = false));
    }
  };

  const resetPlayersReadyVote = () => {
    const rolesStructure = getAssignedRolesStructure();
    for (const role in rolesStructure) {
      rolesStructure[role].forEach((player) => (player.readyVote = false));
      rolesStructure[role].forEach((player) => (player.voteConfirm = false));
    }
  };

  const areAllNonWitchPlayersReady = () => {
    const rolesStructure = getAssignedRolesStructure();

    // Filter only alive, non-witch players
    const allAliveNonWitchPlayers = Object.entries(rolesStructure)
      .filter(([role]) => !role.includes('מכשפה'))
      .flatMap(([_, players]) => players)
      .filter((player) => player.isAlive);

    console.log(
      'בדיקת מוכנות - שחקנים חיים שאינם מכשפה:',
      allAliveNonWitchPlayers.map((p) => ({ name: p.name, readyNight: p.readyNight })),
    );

    const allReady = allAliveNonWitchPlayers.every((player) => player.readyNight === true);
    console.log('מוכנות של כולם חוץ מהמכשפה (Alive Only):', allReady);
    return allReady;
  };

  // Toggle night ready + two-phase checks (non-witch, then all)
  socket.on('toggleReadyNight', ({ playerName, isReady }) => {
    setPlayerReadyNight(playerName, isReady);

    console.log('Night readiness statuses after toggle:', getAssignedRolesStructure());

    setTimeout(() => {
      const allReadyNoWitch = areAllNonWitchPlayersReady();
      console.log('מוכנות של כולם חוץ מהמכשפה (לפני חישוב מטרה):', allReadyNoWitch);

      if (allReadyNoWitch) {
        console.log('שולח את calculateWolfTarget');
        calculateWolfTarget(io);
      } else {
        console.log('לא כל השחקנים מוכנים עדיין.');
      }
    }, 300);

    setTimeout(() => {
      const allReady = areAllPlayersReadyNight();
      console.log('All players ready for Day (Final Check):', allReady);

      if (allReady) {
        // Optional first-night handling (commented out in original)
        console.log('כל השחקנים מוכנים - עיבוד תוצאות הלילה.');
        io.emit('allPlayersReadyNight');
        resetPlayersReadyNight();
      }
    }, 300);
  });

  // Seer reveals a role to everyone
  socket.on('seerRevealRole', ({ seerName, targetName }) => {
    const rolesStructure = getAssignedRolesStructure();

    let targetRole = null;
    for (const [role, players] of Object.entries(rolesStructure)) {
      if (players.some((player) => player.name === targetName)) {
        targetRole = role;
        break;
      }
    }

    if (targetRole) {
      console.log(`מגדת עתידות ${seerName} חשפה את השחקן ${targetName}: ${targetRole}`);
      io.emit('seerRevealResult', {
        targetName,
        targetRole,
      });
    }
  });

  // Shield: protect target (and note if self)
  socket.on('shieldPlayer', ({ shieldName, targetName }) => {
    const rolesStructure = getAssignedRolesStructure();

    const shieldRole = Object.keys(rolesStructure).find(
      (role) => role.includes('מגן') && rolesStructure[role].some((player) => player.name === shieldName),
    );

    if (shieldRole) {
      const shield = rolesStructure[shieldRole].find((player) => player.name === shieldName);

      if (shield) {
        shield.shild = targetName;
        shield.shildSelf = shield.name === targetName;
        console.log(`מגן ${shieldName} הגן על ${targetName}`);
      }
    }
  });

  // Witch: death potion
  socket.on('useDeathPotion', ({ witchName, targetName }) => {
    const rolesStructure = getAssignedRolesStructure();
    const witch = rolesStructure['מכשפה'].find((p) => p.name === witchName);
    if (witch) {
      witch.usedDeathPotion = true;
      witch.deathTarget = targetName;
      console.log(`מכשפה ${witchName} בחרה להרוג את ${targetName}`);
    }
  });

  // Witch: life potion
  socket.on('useLifePotion', ({ witchName, targetName }) => {
    const rolesStructure = getAssignedRolesStructure();
    const witch = rolesStructure['מכשפה'].find((p) => p.name === witchName);
    if (witch) {
      witch.usedLifePotion = true;
      witch.lifeTarget = targetName;
      console.log(`מכשפה ${witchName} בחרה להחיות את ${targetName}`);
    }
  });

  // Night results: request (process or reuse cache)
  socket.on('requestNightResults', () => {
    console.log('הלקוח ביקש את תוצאות הלילה.');
    // if (cachedNightResult) {
    //   console.log('שולח תוצאה שמורה ללקוח:', cachedNightResult);
    //   socket.emit('nightResult', cachedNightResult);
    // } else {
    console.log('אין תוצאות שמורות. עיבוד מחדש עשוי להידרש.');
    processNightResults(io);
    // }
  });

  // For DEAD page users to navigate to end when game ends
  socket.on('checkGameEndForDead', () => {
    if (isGameOver) {
      socket.emit('navigateToEndGame');
    }
  });

  socket.on('disconnect', () => {
    removePlayer(socket.id);
    const updatedPlayers = getPlayers();
    io.emit('updatePlayers', updatedPlayers.players);
  });

  socket.on('connect', () => {
    console.log('Reconnected to server. Re-registering event listeners...');
    socket.emit('requestRolesStructure');
    socket.emit('requestNightResults');
  });

  // Hunter status check (used for late joins/reloads)
  socket.on('hunterCheckStatus', ({ playerName }) => {
    const rolesStructure = getAssignedRolesStructure();
    const hunter = Object.values(rolesStructure)
      .flat()
      .find((p) => p.name === playerName);

    if (hunter && !hunter.isAlive && hunterChoosing) {
      console.log(`${playerName} בודק אם הוא בצייד פעיל.`);
      io.emit('hunterChooseTarget', {
        hunterName: playerName,
        players: Object.values(rolesStructure)
          .flat()
          .filter((p) => p.isAlive),
      });
    }
  });

  // End-game recheck hook
  socket.on('checkGameStatus', () => {
    checkGameEnd(io);
  });

  // Mayor voting (head election)
  socket.on('mayorVote', ({ playerName, targetName }) => {
    const rolesStructure = getAssignedRolesStructure();

    for (const [role, players] of Object.entries(rolesStructure)) {
      const player = players.find((p) => p.name === playerName);
      if (player && player.isAlive) {
        player.mayorVote = targetName;
        console.log(`${playerName} הצביע עבור ראש העיר: ${targetName}`);
      }
    }

    // After vote, check if all confirmed
    const allConfirmed = Object.values(rolesStructure)
      .flat()
      .filter((p) => p.isAlive)
      .every((p) => p.mayorConfirm);

    if (allConfirmed) {
      console.log('כולם אישרו בחירה. מבצעים ספירת קולות.');

      const votes = {};
      Object.values(rolesStructure)
        .flat()
        .forEach((p) => {
          if (p.isAlive && p.mayorVote) {
            votes[p.mayorVote] = (votes[p.mayorVote] || 0) + 1;
          }
        });

      const maxVotes = Math.max(...Object.values(votes));
      const tiedCandidates = Object.keys(votes).filter((name) => votes[name] === maxVotes);
      const selectedMayor =
        tiedCandidates.length > 1
          ? tiedCandidates[Math.floor(Math.random() * tiedCandidates.length)]
          : tiedCandidates[0];

      console.log(`ראש העיר שנבחר: ${selectedMayor}`);

      for (const [role, players] of Object.entries(rolesStructure)) {
        players.forEach((player) => {
          player.mayorName = selectedMayor;
          player.mayor = player.name === selectedMayor;
        });
      }

      io.emit('mayorElected', { mayorName: selectedMayor, votes });
    }
  });

  // Helper: finalize mayor election when all confirmations are in
  const checkAllMayorConfirmed = (io, rolesStructure) => {
    const allConfirmed = Object.values(rolesStructure)
      .flat()
      .filter((p) => p.isAlive)
      .every((p) => p.mayorConfirm);

    if (allConfirmed) {
      console.log('כולם אישרו בחירה. מבצעים ספירת קולות.');

      const votes = {};
      const personalVotes = {};
      Object.values(rolesStructure)
        .flat()
        .forEach((p) => {
          if (p.isAlive && p.mayorVote) {
            votes[p.mayorVote] = (votes[p.mayorVote] || 0) + 1;
            personalVotes[p.name] = p.mayorVote;
          }
        });

      const maxVotes = Math.max(...Object.values(votes));
      const tiedCandidates = Object.keys(votes).filter((name) => votes[name] === maxVotes);
      const selectedMayor =
        tiedCandidates.length > 1
          ? tiedCandidates[Math.floor(Math.random() * tiedCandidates.length)]
          : tiedCandidates[0];

      console.log(`ראש העיר שנבחר: ${selectedMayor}`);

      Object.values(rolesStructure)
        .flat()
        .forEach((player) => {
          player.mayorName = selectedMayor;
          player.mayor = player.name === selectedMayor;
        });

      io.emit('mayorElected', { mayorName: selectedMayor, votes, personalVotes });
    }
  };

  // Mayor confirm (per player)
  socket.on('confirmMayorVote', ({ playerName, confirm }) => {
    const rolesStructure = getAssignedRolesStructure();

    for (const [role, players] of Object.entries(rolesStructure)) {
      const player = players.find((p) => p.name === playerName);
      if (player && player.isAlive) {
        player.mayorConfirm = confirm;
        console.log(`${playerName} עדכן mayorConfirm ל-${confirm}`);
      }
    }

    io.emit('rolesStructure', rolesStructure);

    checkAllMayorConfirmed(io, rolesStructure);
  });

  // Manual check (client-side trigger) for mayor confirmation state
  socket.on('checkAllMayorConfirmed', () => {
    const rolesStructure = getAssignedRolesStructure();

    const allConfirmed = Object.values(rolesStructure)
      .flat()
      .filter((p) => p.isAlive)
      .every((p) => p.mayorConfirm);

    if (allConfirmed) {
      console.log('כולם אישרו בחירה. מבצעים ספירת קולות.');

      const votes = {};
      const personalVotes = {};
      Object.values(rolesStructure)
        .flat()
        .forEach((p) => {
          if (p.isAlive && p.mayorVote) {
            votes[p.mayorVote] = (votes[p.mayorVote] || 0) + 1;
            personalVotes[p.name] = p.mayorVote;
          }
        });

      const maxVotes = Math.max(...Object.values(votes));
      const tiedCandidates = Object.keys(votes).filter((name) => votes[name] === maxVotes);
      const selectedMayor =
        tiedCandidates.length > 1
          ? tiedCandidates[Math.floor(Math.random() * tiedCandidates.length)]
          : tiedCandidates[0];

      console.log(`ראש העיר שנבחר: ${selectedMayor}`);

      Object.values(rolesStructure)
        .flat()
        .forEach((player) => {
          player.mayorName = selectedMayor;
          player.mayor = player.name === selectedMayor;
        });

      io.emit('mayorElected', { mayorName: selectedMayor, votes, personalVotes });
    }
  });

  // Check all mayor-ready → transition to vote page
  socket.on('checkAllMayorReady', () => {
    const rolesStructure = getAssignedRolesStructure();

    const allReady = Object.values(rolesStructure)
      .flat()
      .filter((p) => p.isAlive)
      .every((p) => p.mayorReady);

    if (allReady) {
      console.log('כל השחקנים מוכנים. עוברים לעמוד הצבעות.');
      resetPlayersReadyMayor();
      io.emit('navigateToVote');
    }
  });

  // Toggle mayor-ready per player
  socket.on('toggleMayorReady', ({ playerName, isReady }) => {
    const rolesStructure = getAssignedRolesStructure();

    for (const [role, players] of Object.entries(rolesStructure)) {
      const player = players.find((p) => p.name === playerName);
      if (player && player.isAlive) {
        player.mayorReady = isReady;
        console.log(`${playerName} עדכן mayorReady ל-${isReady}`);
      }
    }

    const allReady = Object.values(rolesStructure)
      .flat()
      .filter((p) => p.isAlive)
      .every((p) => p.mayorReady);

    if (allReady) {
      console.log('כל השחקנים מוכנים. עוברים לעמוד ההצבעות.');
      resetPlayersReadyMayor();
      io.emit('navigateToVote');
    }
  });

  // Submit lynch vote
  socket.on('submitVote', ({ playerName, voteTarget }) => {
    const rolesStructure = getAssignedRolesStructure();

    for (const [role, players] of Object.entries(rolesStructure)) {
      const player = players.find((p) => p.name === playerName);
      if (player && player.isAlive) {
        player.deadVote = voteTarget;
        console.log(`${playerName} הצביע עבור ${voteTarget}`);
      }
    }
  });

  // Confirm lynch vote; when all confirmed, process results
  socket.on('confirmVote', ({ playerName, confirm }) => {
    const rolesStructure = getAssignedRolesStructure();

    for (const [role, players] of Object.entries(rolesStructure)) {
      const player = players.find((p) => p.name === playerName);
      if (player && player.isAlive) {
        player.voteConfirm = confirm;
        console.log(`${playerName} אישר את הבחירה: ${confirm}`);
      }
    }

    const allConfirmed = Object.values(rolesStructure)
      .flat()
      .filter((p) => p.isAlive)
      .every((p) => p.voteConfirm);

    if (allConfirmed) {
      console.log('כולם אישרו בחירה. מבצעים ספירת קולות.');
      processVoteResults(io);
    }
  });

  // Request current mayor name
  socket.on('requestMayor', () => {
    let mayor = null;

    const rolesStructure = getAssignedRolesStructure();
    for (const [role, players] of Object.entries(rolesStructure)) {
      players.forEach((player) => {
        const tmpMayor = player.mayorName;
        if (tmpMayor) {
          mayor = tmpMayor;
        }
        console.log('mayor name: ', mayor);
      });
    }
    console.log('getMayor ', mayor);
    socket.emit('mayorName', mayor);
  });

  // Vote page ready toggle
  socket.on('toggleVoteReady', ({ playerName, isReady }) => {
    const rolesStructure = getAssignedRolesStructure();

    for (const [role, players] of Object.entries(rolesStructure)) {
      const player = players.find((p) => p.name === playerName);
      if (player && player.isAlive) {
        player.readyVote = isReady;
      }
    }

    const allReady = Object.values(rolesStructure)
      .flat()
      .filter((p) => p.isAlive)
      .every((p) => p.readyVote);

    if (allReady) {
      const isGameOver = checkGameEnd(io);
      if (isGameOver) {
        io.emit('navigateToEndGame');
      } else {
        resetPlayersReadyVote();
        io.emit('navigateToNight');
      }
    }
  });

  const fs = require('fs');

  // Reset game state (players + client local storage)
  socket.on('resetGame', () => {
    console.log('Resetting game...');
    resetGamePlayers();
    io.emit('clearLocalStorage');
    console.log('Game reset complete.');
  });

  // Restart server (touch this file to trigger reload if using a watcher)
  socket.on('restartServer', () => {
    console.log('Restarting server...');
    fs.utimesSync(__filename, new Date(), new Date());
  });

  // Hunter votes retrieval (stored temporarily in memory)
  socket.on('requestHunterVotes', (hunterName) => {
    const votes = hunterVotesMap.get(hunterName) || [];
    socket.emit('receiveHunterVotes', { personalVotes: votes });
  });
};

module.exports = handleSocketEvents;

// --- Global end-game / status utilities ---

// Ensure mayor state is reset if the mayor died
const checkMayorStatus = () => {
  const rolesStructure = getAssignedRolesStructure();

  for (const [role, players] of Object.entries(rolesStructure)) {
    players.forEach((player) => {
      if (!player.isAlive && player.name === rolesStructure.mayorName) {
        console.log(`ראש העיר ${player.name} מת, איפוס ראש העיר.`);
        rolesStructure.mayorName = null;
        player.mayor = false;
      }
    });
  }
};

// NOTE: Duplicate of the inner helper above (kept intentionally to preserve original code)
const isElderDead = () => {
  const rolesStructure = getAssignedRolesStructure();
  const elder = Object.entries(rolesStructure)
    .filter(([role]) => role.includes('זקן השבט'))
    .flatMap(([_, players]) => players)[0];

  return elder && !elder.isAlive;
};

let isGameOver = false; // Tracks global end-game state

const checkGameEnd = (io) => {
  const rolesStructure = getAssignedRolesStructure();

  checkMayorStatus();

  const alivePlayers = Object.entries(rolesStructure).flatMap(([role, players]) =>
    players.filter((p) => p.isAlive).map((p) => ({ ...p, role })),
  );
  const aliveRoles = alivePlayers.map((p) => p.role);
  console.log('תפקידים חיים:', aliveRoles);

  // Win-state predicates
  const allWolves = aliveRoles.every((role) => role.includes('זאב'));
  const onlyWolvesAndLeech = aliveRoles.every((role) => role.includes('זאב') || role === 'עלוקה');
  const hasLeech = aliveRoles.includes('עלוקה');
  const onlyLeech = aliveRoles.length === 1 && hasLeech;
  const noOneAlive = alivePlayers.length === 0;
  const allCitizens = aliveRoles.every((role) => !role.includes('זאב'));

  console.log('allWolves:', allWolves);
  console.log('hasLeech:', hasLeech);
  console.log('aliveRoles length:', aliveRoles.length);

  const cupids = Object.entries(rolesStructure)
    .filter(([role]) => role.includes('קופידון'))
    .flatMap(([_, players]) => players);
  const lovers = cupids.map((cupid) => cupid.lover);
  const onlyCupidAndLover =
    alivePlayers.length === 2 && alivePlayers.some((p) => lovers.includes(p.name));
  const elder = Object.entries(rolesStructure)
    .filter(([role]) => role.includes('זקן השבט'))
    .flatMap(([_, players]) => players)[0];

  if (elder) {
    hunterChoosing = !isElderDead();
  }

  let resultMessage = '';

  if (noOneAlive) {
    resultMessage = 'אף אחד לא ניצח';
  } else if (allWolves && !hasLeech && aliveRoles.length > 0) {
    resultMessage = 'הזאבים ניצחו';
  } else if (onlyWolvesAndLeech) {
    resultMessage = 'העלוקה ניצחה';
  } else if (onlyLeech) {
    resultMessage = 'העלוקה ניצחה';
  } else if (onlyCupidAndLover && hasLeech) {
    resultMessage = 'העלוקה ניצחה';
  } else if (onlyCupidAndLover && !hasLeech) {
    resultMessage = 'הנאהבים ניצחו';
  } else if (allCitizens && !hasLeech) {
    resultMessage = 'האזרחים ניצחו';
  } else if (allCitizens && hasLeech) {
    resultMessage = 'העלוקה ניצחה';
  } else {
    resultMessage = ''; // Continue game
  }

  console.log('!hunterChoosing ', hunterChoosing);

  // Update global game state and notify
  if (resultMessage && !hunterChoosing) {
    isGameOver = true;
    console.log(resultMessage);
    io.emit('gameEnd', resultMessage);
  } else {
    isGameOver = false;
    console.log('המשחק ממשיך');
  }

  return isGameOver && !hunterChoosing;
};

// --- Night resolution ---

let hunterIndex = 0;

const processNightResults = (io) => {
  console.log('currentPlayer ', currentPlayer);
  let foundCurrName = null;
  const rolesStructure = getAssignedRolesStructure();

  // Find current player object
  for (const [roleName, players] of Object.entries(rolesStructure)) {
    const currName = players.find((player) => player.name === currentPlayer);
    if (currName) {
      foundCurrName = currName;
      break;
    }
  }

  // Prevent concurrent processing
  if (foundCurrName.locked) {
    console.log('עיבוד הלילה כבר מתבצע. מבטל קריאה כפולה.');
    if (cachedNightResult) {
      console.log('שולח תוצאות שמורות מהזיכרון לכל השחקנים.');
      io.emit('nightResult', cachedNightResult);
    }
    return;
  }
  foundCurrName.locked = true;
  nightProcessingLock = true;
  console.log('מעבד תוצאות הלילה...');

  console.log('מבנה התפקידים בתום הלילה:', JSON.stringify(rolesStructure, null, 2));

  const results = [];
  let savedByWitch = false;
  let savedByShield = false;

  // Locate witch
  const witch = Object.entries(rolesStructure)
    .filter(([role]) => role.includes('מכשפה'))
    .flatMap(([_, players]) => players)[0];

  // Locate shield
  const shild = Object.entries(rolesStructure)
    .filter(([role]) => role.includes('מגן'))
    .flatMap(([_, players]) => players)[0];

  // Witch death potion
  if (witch && witch.deathTarget && witch.usedDeathPotion) {
    const deathTargetName = witch.deathTarget;
    console.log('aaa');

    let victim = null;
    let victimRole = null;
    for (const [roleName, players] of Object.entries(rolesStructure)) {
      const foundVictim = players.find((player) => player.name === deathTargetName);
      if (foundVictim) {
        victim = foundVictim;
        victimRole = roleName;
        console.log('bbb');
        break;
      }
    }

    if (victim) {
      console.log('ccc');
      victim.isAlive = false;
      results.push(
        `המכשפה החליטה לתת ל-${victim.name} בתפקיד ${victimRole} שיקוי מוות ולכן הוא יצא מהמשחק!`,
      );
      console.log(results[results.length - 1]);
    }
  }

  // Wolf target taken from any alive player's cached wolfFinalTarget
  const firstAlivePlayer = Object.values(rolesStructure)
    .flat()
    .find((player) => player.isAlive);

  const wolfTargetName = firstAlivePlayer?.wolfFinalTarget;

  // Witch life potion cancels wolf kill
  if (witch && witch.usedLifePotion && witch.lifeTarget === wolfTargetName) {
    savedByWitch = true;
    console.log(`המכשפה הצילה מהתקפת הזאבים בעזרת שיקוי חיים!`);
  }

  // Shield cancels wolf kill
  if (shild && shild.shild === wolfTargetName) {
    savedByShield = true;
    console.log(`המגן הציל מהתקפת הזאבים!`);
  }

  // Apply wolf kill if not saved
  if (wolfTargetName && !savedByWitch && !savedByShield) {
    let victim = null;
    let victimRole = null;

    for (const [roleName, players] of Object.entries(rolesStructure)) {
      const foundVictim = players.find((player) => player.name === wolfTargetName);
      if (foundVictim) {
        victim = foundVictim;
        victimRole = roleName;
        break;
      }
    }
    console.log('victim ', victim);

    if (victim) {
      // Elder has two lives (special handling)
      if (victimRole === 'זקן השבט') {
        if (!foundCurrName.isAttackedOnce) {
          foundCurrName.isAttackedOnce = true; // mark first attack
          console.log('foundCurrName.isAttackedOnce ', foundCurrName.isAttackedOnce);
          victim.liveCount = 1;
          console.log(`זקן השבט ${victim.name} הותקף פעם ראשונה ונשאר בחיים.`);
        } else {
          victim.liveCount = 0;
          victim.olderAlive = false;
          victim.isAlive = false;
          results.push(
            `הזאבים טרפו את ${victim.name} בתפקיד זקן השבט! \nמעכשיו ועד סוף המשחק לא יהיו לאזרחים כוחות בלילה.`,
          );
          console.log(`זקן השבט ${victim.name} מת סופית.`);
        }
      } else {
        // Regular player dies
        victim.isAlive = false;
        results.push(`הזאבים החליטו לטרוף את ${victim.name} בתפקיד ${victimRole}!`);
        console.log(results[results.length - 1]);
      }
    }
  }

  // Cupid / lover cascades (night-time consequences)

  // 1) If Cupid died, lover dies
  const cupids = Object.entries(rolesStructure)
    .filter(([role]) => role.includes('קופידון'))
    .flatMap(([_, players]) => players);

  cupids.forEach((cupid) => {
    if (!cupid.isAlive && cupid.lover) {
      let lover = null;
      let loverRole = null;
      for (const [roleName, players] of Object.entries(rolesStructure)) {
        const foundLover = players.find((player) => player.name === cupid.lover);
        if (foundLover) {
          lover = foundLover;
          loverRole = roleName;
          break;
        }
      }

      if (lover && lover.isAlive) {
        console.log(`Cupid ${cupid.name} died. Checking lover: ${cupid.lover}`);
        lover.isAlive = false;
        results.push(`${lover.name} בתפקיד ${loverRole} יצא מהמשחק כנאהב של הקופידון!`);
        if (loverRole === 'זקן השבט') {
          results.push(`מעכשיו ועד סוף המשחק לא יהיו לאזרחים כוחות בלילה.`);
        }
        console.log(results[results.length - 1]);
      }
    }
  });

  // 2) If lover died, cupid dies
  cupids.forEach((cupid) => {
    let lover = null;
    for (const [roleName, players] of Object.entries(rolesStructure)) {
      lover = players.find((player) => player.name === cupid.lover && !player.isAlive);
      if (lover) break;
    }

    if (lover && cupid.isAlive) {
      cupid.isAlive = false;
      results.push(
        `${cupid.name} בתפקיד הקופידון יצא מהמשחק מאחר שבחר לנאהב את ${lover.name}`,
      );
      console.log(results[results.length - 1]);
    }
  });

  // Hunter trigger (if died this night)
  let hunterDied = false;
  let hunterPlayer = null;

  const hunters = Object.entries(rolesStructure)
    .filter(([role]) => role.includes('צייד'))
    .flatMap(([_, players]) => players);

  hunters.forEach((hunter) => {
    if (!hunter.isAlive) {
      hunterDied = true;
      hunterPlayer = hunter;
      hunterIndex++;
    }
  });

  if (hunterDied && hunterPlayer) {
    if (hunterIndex == 1) {
      hunterChoosing = true;
    }

    const alivePlayers = Object.values(rolesStructure)
      .flat()
      .filter((p) => p.isAlive);
    console.log('Alive players for hunter:', alivePlayers.map((p) => p.name));
    console.log(
      `Hunter ${hunterPlayer.name} is triggered. Alive players:`,
      alivePlayers.map((p) => p.name),
    );

    // Broadcast hunter selection flow
    io.emit('hunterWaitingDecision', { hunterName: hunterPlayer.name });
    if (hunterDied && hunterPlayer) {
      console.log(`Hunter ${hunterPlayer.name} died. Emitting hunterChooseTarget.`);
      io.emit('hunterChooseTarget', {
        hunterName: hunterPlayer.name,
        players: alivePlayers,
      });
    }

    // Reconnect handling: resend hunter waiting state
    io.on('connection', (socket) => {
      socket.emit('hunterWaitingDecision', { hunterName: hunterPlayer.name });
    });
  }

  if (results.length === 0) {
    results.push('הלילה אף אחד לא יצא מהמשחק.');
  }

  const finalMessage = results.join('\n');
  cachedNightResult = finalMessage;
  io.emit('nightResult', finalMessage);

  // Post-night: check for end-game
  io.emit('checkGameStatus');

  setTimeout(() => {
    foundCurrName.locked = false;
  }, 500);
  setTimeout(() => {
    nightProcessingLock = false;
  }, 500);
};

// In-memory store for hunter personal vote breakdown
const hunterVotesMap = new Map();

// Process daytime lynch votes (includes mayor tie-break logic and Cupid cascades)
const processVoteResults = (io, results) => {
  const rolesStructure = getAssignedRolesStructure();

  let electedPlayer = null;
  let electedRole = null;

  const votesCount = {};
  const personalVotes = [];

  // Count votes (mayor counts as 2)
  for (const [role, players] of Object.entries(rolesStructure)) {
    players.forEach((player) => {
      if (player.isAlive && player.deadVote) {
        votesCount[player.deadVote] =
          (votesCount[player.deadVote] || 0) + (player.mayor ? 2 : 1);
        personalVotes.push({ voter: player.name, target: player.deadVote });
      }
    });
  }

  const maxVotes = Math.max(...Object.values(votesCount));
  const tiedPlayers = Object.keys(votesCount).filter((p) => votesCount[p] === maxVotes);

  // Mayor tie-breaker rule
  const mayorPlayer = Object.values(rolesStructure)
    .flat()
    .find((p) => p.mayor);

  if (tiedPlayers.length > 1 && mayorPlayer) {
    const playersNotVotedByMayor = tiedPlayers.filter((p) => p !== mayorPlayer.deadVote);
    if (playersNotVotedByMayor.length > 0) {
      electedPlayer =
        playersNotVotedByMayor.length > 1
          ? playersNotVotedByMayor[Math.floor(Math.random() * playersNotVotedByMayor.length)]
          : playersNotVotedByMayor[0];
    } else {
      electedPlayer = tiedPlayers[Math.floor(Math.random() * tiedPlayers.length)];
    }
  } else {
    electedPlayer = tiedPlayers[0];
  }

  // Kill elected player + identify role
  for (const [role, players] of Object.entries(rolesStructure)) {
    const found = players.find((p) => p.name === electedPlayer);
    if (found) {
      electedRole = role;
      found.isAlive = false;
      io.emit('playerDead', {
        playerName: found.name,
        role: role,
      });
    }
  }

  console.log(`נבחר שחקן להריגה: ${electedPlayer}, תפקיד: ${electedRole}`);
  console.log(`בדיקת קשר קופידון עם נאהבים...`);

  // Cupid cascades during day
  const cupidPlayers = Object.entries(rolesStructure)
    .filter(([role]) => role.includes('קופידון'))
    .flatMap(([_, players]) => players);

  cupidPlayers.forEach((cupid) => {
    const lover = Object.values(rolesStructure)
      .flat()
      .find((p) => p.name === cupid.lover);

    console.log(`בדיקת קשרי קופידון: ${cupid.name} -> ${cupid.lover}`);

    // If lover died by vote → cupid dies
    if (lover && lover.name === electedPlayer) {
      console.log(`${lover.name} נהרג - הקופידון ${cupid.name} אמור למות.`);
      cupid.isAlive = false;
      console.log(`Socket ID של הקופידון ${cupid.name}:`, getPlayerSocketId(cupid.name));
      console.log(`שליחת הודעת נווט לקופידון ${cupid.name}`);

      io.to(getPlayerSocketId(cupid.name)).emit('navigateToDead', {
        message: `הקופידון ${cupid.name} יצא מהמשחק בעקבות מותו של הנאהב ${lover.name}!`,
      });
      io.emit('playerDeadCupid', {
        playerName: cupid.name,
        role: 'קופידון',
        loverRole: electedRole,
        loverName: lover.name,
      });
      io.emit('cupidDeathMessage', {
        message: `הקופידון ${cupid.name} יצא מהמשחק בעקבות מותו של הנאהב ${lover.name}!`,
      });
      io.to(getPlayerSocketId(cupid.name)).emit('pushState', '/dead');
    }

    // If cupid died by vote → lover dies
    if (cupid.name === electedPlayer && lover) {
      console.log(`${cupid.name} נהרג - הנאהב ${lover.name} אמור למות.`);
      lover.isAlive = false;

      io.to(getPlayerSocketId(lover.name)).emit('navigateToDead', {
        message: `הנאהב ${lover.name} בתפקיד ${lover.role} יצא מהמשחק בעקבות מותו של הקופידון ${cupid.name}!`,
      });

      io.emit('playerDeadLover', {
        playerName: lover.name,
        role: lover.role,
        cupidName: cupid.name,
      });

      io.emit('cupidDeathMessage', {
        message: `הנאהב ${lover.name} יצא מהמשחק בעקבות מותו של הקופידון ${cupid.name}!`,
      });
      io.to(getPlayerSocketId(lover.name)).emit('pushState', '/dead');
    }
  });

  // Mayor reference for client display
  const mayor = Object.values(rolesStructure)
    .flat()
    .find((p) => p.mayor);
  let hunterDied = false;
  let hunterPlayer = null;

  const hunters = Object.entries(rolesStructure)
    .filter(([role]) => role.includes('צייד'))
    .flatMap(([_, players]) => players);

  hunters.forEach((hunter) => {
    if (!hunter.isAlive) {
      hunterDied = true;
      hunterPlayer = hunter;
      hunterIndex++;
    }
  });

  if (hunterDied && hunterPlayer) {
    if (hunterIndex == 1) {
      hunterChoosing = true;
    }
    hunterVotesMap.set(hunterPlayer.name, personalVotes);

    io.emit('voteResultsHunter', {
      personalVotes,
    });

    const alivePlayers = Object.values(rolesStructure)
      .flat()
      .filter((p) => p.isAlive);
    console.log('Alive players for hunter:', alivePlayers.map((p) => p.name));

    io.emit('hunterWaitingDecision', { hunterName: hunterPlayer.name });
    io.emit('hunterChooseTarget', {
      hunterName: hunterPlayer.name,
      players: alivePlayers,
    });

    io.on('connection', (socket) => {
      socket.emit('hunterWaitingDecision', { hunterName: hunterPlayer.name });
    });
  }

  const mayorName = mayor ? mayor.name : '';

  // Emit final vote results
  io.emit('voteResults', {
    electedPlayer,
    electedRole,
    results: votesCount,
    personalVotes,
    mayorName: mayorName || '',
  });
  console.log('voteResults נשלחו ללקוח:', {
    electedPlayer,
    electedRole,
    results: votesCount,
    personalVotes,
    mayorName: mayorName || '',
  });
};
