//socketHandlers.js
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
  resetGamePlayers
} = require('./utils/players');
const { assignRoles } = require('./utils/assignRoles');
const { getSettings } = require('./controllers/settingsController');
let hunterChoosing = false; // משתנה גלובלי לבדיקת בחירה
let nightProcessingLock = false; // לוק שימנע כפילויות בטיפול
let cachedNightResult = null;   // תוצאה שמורה לכל המשתמשים

const calculateWolfTarget = (io) => {
  console.log('calculateWolfTarget מופעל!');
  const rolesStructure = getAssignedRolesStructure();
  console.log('מבנה תפקידים בעת חישוב המטרה:', JSON.stringify(rolesStructure, null, 2));

  // שליפת כל הזאבים עם שמירת תפקידם
  const wolves = Object.entries(rolesStructure)
    .filter(([role]) => role.includes('זאב'))
    .flatMap(([role, players]) =>
      players.map(player => ({ ...player, role })) // הוספת התפקיד לתוך האובייקט
    );

  let votes = {};
  let leaderVote = null;

  // חישוב הצבעות והצבעת המנהיג
  wolves.forEach(wolf => {
    if (wolf.isAlive && wolf.wolfChoose) {
      votes[wolf.wolfChoose] = (votes[wolf.wolfChoose] || 0) + 1;

      // שמירת הצבעת המנהיג אם הוא חי
      if (wolf.isAlive && wolf.role.includes('מנהיג')) {
        leaderVote = wolf.wolfChoose;
      }
    }
  });

  // בדיקת המצביעים הפופולריים ביותר
  const maxVotes = Math.max(...Object.values(votes), 0);
  const tiedTargets = Object.keys(votes).filter(t => votes[t] === maxVotes);

  let finalTarget = null;

  if (tiedTargets.length > 1) {
    console.log('יש תיקו בין המטרות:', tiedTargets);

    // היררכיה של הזאבים לפי תפקיד
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
      const prioritizedWolf = wolves.find(wolf =>
        wolf.role.includes(role) && wolf.isAlive && tiedTargets.includes(wolf.wolfChoose)
      );
      if (prioritizedWolf) {
        finalTarget = prioritizedWolf.wolfChoose;
        break;
      }
    }
  } else if (tiedTargets.length === 1) {
    // אם יש רק מטרה אחת, היא המטרה הסופית
    finalTarget = tiedTargets[0];
  } else {
    // במקרה שאין הצבעות, ברירת מחדל היא הצבעת המנהיג
    finalTarget = leaderVote || null;
  }

  console.log('המטרה הסופית של הזאבים:', finalTarget);

  if (finalTarget) {
    // שמירת המטרה אצל כולם
    Object.values(rolesStructure).flat().forEach(player => {
      player.wolfFinalTarget = finalTarget;
    });

    io.emit('wolfFinalTarget', finalTarget); // שולח לכל השחקנים
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
    const settings = getSettings(); // שליפת ההגדרות באמצעות הפונקציה הקיימת
    if (settings) {
        socket.emit('settingsReceived', settings); // שליחת ההגדרות ללקוח
    } else {
        socket.emit('error', 'Settings not found'); // הודעת שגיאה אם אין הגדרות
    }
});

  // הצטרפות למשחק
  socket.on('joinGame', (playerName) => {
    
    const existingPlayers = getPlayers().players;
    const isNameTaken = existingPlayers.some(player => player.name === playerName);

    if (isNameTaken) {
      socket.emit('nameTaken', `השם ${playerName} תפוס. אנא בחר שם אחר.`);
    } else {
      addPlayer(playerName, socket.id);
      io.emit('updatePlayers', getPlayers().players);
      const { firstPlayer } = getPlayers();
      io.emit('setFirstPlayer', firstPlayer);
    }
  });

  // מעבר לעמוד הגדרות
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



  // בקשת תפקיד
 // הצטרפות לחדר הזאבים
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

    // בדיקה אם השחקן כבר נמצא בחדר
    const rooms = Array.from(socket.rooms); // השגת רשימת החדרים שהשחקן נמצא בהם
    if (role.includes('זאב') && !rooms.includes('wolvesRoom')) {
      socket.join('wolvesRoom'); // הוספת השחקן לחדר רק אם לא שם כבר
      console.log(`${playerName} הצטרף לחדר הזאבים.`);
    }
  }
 });


 // הודעה לזאבים בלבד בצ'אט
 socket.on('wolfChatMessage', ({ senderName, message }) => {
  console.log(`שידור הודעה לחדר הזאבים מ- ${senderName}: ${message}`);
  io.to('wolvesRoom').emit('wolfChatMessage', {
    senderName,
    message,
  }); // משדר רק לחדר הזאבים פעם אחת
  console.log(`Wolf ${senderName} sent message: ${message}`);
 });



  // שמירת הנאהב של קופידון
  socket.on('updateLover', ({ cupidName, loverName }) => {
    const rolesStructure = getAssignedRolesStructure();

    if (!rolesStructure) {
        console.error('Roles structure is not initialized.');
        return;
    }

    const cupidRole = Object.keys(rolesStructure).find((role) =>
        role.includes('קופידון')
    );

    if (cupidRole) {
        const cupid = rolesStructure[cupidRole].find((p) => p.name === cupidName);
        if (cupid) {
            cupid.lover = loverName; // עדכון הנאהב
            console.log('Cupid lover updated:', cupid); // לוג לבדיקה
            console.log('Updated roles structure before emitting:', rolesStructure); // בדיקה נוספת

            // שידור המבנה המעודכן
            io.emit('rolesStructure', rolesStructure);
        } else {
            console.error(`Cupid ${cupidName} not found.`);
        }
    } else {
        console.error('No cupid role found.');
    }
 });

 const isElderDead = () => {
  const rolesStructure = getAssignedRolesStructure();
  const elder = Object.entries(rolesStructure)
    .filter(([role]) => role.includes('זקן השבט'))
    .flatMap(([_, players]) => players)[0]; // מציאת זקן השבט

  return elder && !elder.isAlive; // החזרת TRUE אם זקן השבט מת
};

    socket.on('hunterChooseTarget', ({ hunterName, targetName }) => {
      const rolesStructure = getAssignedRolesStructure();
      hunterChoosing = false; // הצייד סיים

      const hunter = Object.entries(rolesStructure)
      .filter(([role]) => role.includes('צייד'))
      .flatMap(([_, players]) => players)[0]; // מציאת זקן השבט
      if (isElderDead()) { // בדיקה אם זקן השבט מת
        console.log('זקן השבט מת - הצייד אינו יכול לבחור מטרה.');
        hunterChoosing =false;
        io.emit('hunterFinishedNoElder'); // שליחה לכל השחקנים
        return; // חסימת הפעולה
      }
          // בדיקה אם הצייד כבר בחר מטרה
    if (hunter.hunterChoseTarget) {
      console.log(`${hunterName} כבר בחר מטרה. בחירה נוספת לא תתבצע.`);
      return; // ביטול בחירה נוספת
  }
      // סימון שהצייד בחר מטרה
      hunter.hunterChoseTarget = true;
      console.log(`Hunter event received: ${hunterName} בחר לצוד את ${targetName}`);

      console.log('Roles structure for Hunter:', JSON.stringify(rolesStructure, null, 2));
    
      let target = null;
      let targetRole = null;
    
      for (const [role, players] of Object.entries(rolesStructure)) {
        console.log(`Checking role: ${role}`);
        const foundTarget = players.find(p => p.name === targetName);
        if (foundTarget) {
          target = foundTarget;
          targetRole = role;
          break;
        }
      }
    
      if (target) {
        target.isAlive = false; // הורגים את המטרה
        console.log(`${hunterName} צד את ${targetName} בתפקיד ${targetRole}`);

      //   // שליחת הודעה לכל השחקנים עם פרטי המטרה שנבחרה
      //   io.emit('hunterTargetSelected', {
      //     hunterName,
      //     targetName,
      //     targetRole,
      // });

        // io.emit('nightResult', `${hunterName} בתפקיד צייד הרג את ${target.name} בתפקיד ${targetRole}!`);
    
        // עדכון מוות עבור קופידון והנאהב
          // 1. בדיקת קופידון ונאהב
          const cupids = Object.entries(rolesStructure)
          .filter(([role]) => role.includes('קופידון'))
          .flatMap(([_, players]) => players);
    






    //*********************** *        http://localhost:3706/      /
    cupids.forEach(cupid => {
      if (!cupid.isAlive && cupid.lover) {
        // קופידון מת - הורגים את הנאהב שלו
        let lover = null;
        let loverRole = null;
        for (const [roleName, players] of Object.entries(rolesStructure)) {
          const foundLover = players.find(player => player.name === cupid.lover);
          if (foundLover) {
            lover = foundLover;
            loverRole = roleName;
            break;
          }
        }
     
        if (lover && lover.isAlive && cupid.name === targetName ) {
         console.log(`Cupid ${cupid.name} died. Checking lover: ${cupid.lover}`);
          lover.isAlive = false;
          if (loverRole === "זקן השבט"){
           io.emit('hunterMessage',` ${lover.name} בתפקיד ${loverRole} יצא מהמשחק כנאהב של הקופידון!\n מעכשיו ועד סוף המשחק לא יהיו לאזרחים כוחות בלילה.`);
          } else{
            io.emit('hunterMessage',`${lover.name} בתפקיד ${loverRole} יצא מהמשחק כנאהב של הקופידון!`);
          }
        }
      }
      });
     
       // 2. בדיקה אם נאהב של קופידון מת
       cupids.forEach(cupid => {
       let lover = null;
       for (const [roleName, players] of Object.entries(rolesStructure)) {
         lover = players.find(player => player.name === cupid.lover && !player.isAlive);
         if (lover) break;
       } 
     
       if (cupid.lover === targetName && cupid.isAlive) {
        cupid.isAlive = false;
        io.emit('hunterMessage',`${cupid.name} בתפקיד הקופידון יצא מהמשחק מאחר שבחר לנאהב את ${lover.name}`);
      }
      });
    //********************** */
        // cupids.forEach(cupid => {
        //   if (cupid.lover === targetName && cupid.isAlive) {
        //     cupid.isAlive = false;
        //     io.emit('nightResult', `${cupid.name} בתפקיד קופידון יצא מהמשחק מאחר שבחר לנאהב את ${targetName}!`);
        //   }
        //   const lover = Object.values(rolesStructure).flat().find(p => p.name === cupid.lover);
        //   if (lover && lover.name === targetName && lover.isAlive) {
        //     lover.isAlive = false;
        //     io.emit('nightResult', `${lover.name} בתפקיד ${targetRole} יצא מהמשחק כנאהב של הקופידון!`);
        //     if (lover.role === "זקן השבט"){
        //       io.emit('nightResult', `מעכשיו ועד סוף המשחק לא יהיו לאזרחים תפקידים בלילה.`);
        //      }
        //   }
        // });
                // שליחת המידע כולל לצייד
                io.to(getPlayerSocketId(hunterName)).emit('hunterTargetSelected', {
                  targetName: target.name,
                  targetRole: targetRole,
              });

        io.emit('hunterFinished', { hunterName, targetName, targetRole }); // שליחה לכל השחקנים

        io.to(getPlayerSocketId(targetName)).emit('navigateToDead', {
            message: `${hunterName} בתפקיד צייד הרג אותך בתפקיד ${targetRole}!`,
        });
        io.to(getPlayerSocketId(targetName)).emit('gameNavigation');
        io.to(getPlayerSocketId(targetName)).emit('pushState', '/dead');
            // עדכון יתר השחקנים בעמוד ה-DAY
        const alivePlayers = Object.values(rolesStructure).flat().filter(p => p.isAlive);
        alivePlayers.forEach(player => {
          io.to(getPlayerSocketId(player.name)).emit('nightResult', 
          `${hunterName} בתפקיד צייד צד את ${target.name} בתפקיד ${targetRole}!`);
        });
        // סיום בחירת הצייד
        if (targetRole === "זקן השבט"){
          io.emit('hunterMessage', `${hunterName} בתפקיד צייד צד את ${target.name} בתפקיד ${targetRole}! \nמעכשיו ועד סוף המשחק לא יהיו לאזרחים כוחות בלילה.`);

        } else {
          io.emit('hunterMessage', `${hunterName} בתפקיד צייד צד את ${target.name} בתפקיד ${targetRole}!`);

        }
        
        setAssignedRolesStructure(rolesStructure); // שמירת המבנה המעודכן
        // קריאה לבדיקה אם המשחק נגמר
        const gameEnded = checkGameEnd(io);
        if (gameEnded) {
            console.log('Game ended after hunter action.');
            io.emit('navigateToEndGame'); // מעבר לעמוד סיום המשחק
        } else {
            console.log('המשחק ממשיך לאחר בחירת הצייד.');
        }
        //  io.emit('hunterFinished', { hunterName, targetName });
      }  else {
        console.error('Target not found:', targetName);
      }
    });
    
  // מאזין לבקשת מבנה התפקידים מהלקוח
  socket.on('requestRolesStructure', () => {
    const rolesStructure = getAssignedRolesStructure();
    const elderDead = isElderDead();
    console.log('Sending roles structure with elder status:', elderDead);
  
    socket.emit('rolesStructure', rolesStructure); // מבנה תפקידים
    socket.emit('elderStatus', { elderDead }); // הוספת מצב זקן השבט
  });

  // בדיקת מוכנות ל-NightPage
  socket.on('mayorDead', ({ mayorDeadFlag }) => {
    const rolesStructure = getAssignedRolesStructure();
    if (mayorDeadFlag){
      for (const [role, players] of Object.entries(rolesStructure)) {
        players.forEach(player => {
          player.mayorName = null;
          player.mayor = false;
        });
      }
    }
  });

  // בדיקת מוכנות ל-NightPage
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

  socket.on('toggleReadyDay', ({ playerName, isReadyDay }) => {
    const rolesStructure = getAssignedRolesStructure();

    for (const [role, players] of Object.entries(rolesStructure)) {
        const player = players.find(p => p.name === playerName);
        if (player && player.isAlive) {
            player.readyDay = isReadyDay; // עדכון מוכנות
            console.log(`${playerName} updated readyDay to ${isReadyDay}`);
        }
    }

    // בדיקה אם כל השחקנים החיים מוכנים
    const allReady = Object.values(rolesStructure)
        .flat()
        .filter(p => p.isAlive)
        .every(p => p.readyDay); // האם כולם מוכנים?

    if (allReady) {
        console.log('All players are ready in DAY.');

        // נבדוק האם המשחק נגמר
        const gameEnded = checkGameEnd(io, false); // false = אל תשלח תוצאה עדיין
        if (gameEnded) {
            console.log('Game ended. Navigating to EndGame.');
            io.emit('navigateToEndGame'); // מעבר לעמוד סיום המשחק
            return; // עוצרים כאן
        }

        // המשחק לא נגמר - בודקים האם יש Mayor וממשיכים לעמוד הבא
        const alivePlayers = Object.values(rolesStructure)
            .flat()
            .filter(p => p.isAlive);
        const mayorExists = alivePlayers.some(p => p.mayor === true);

        if (mayorExists) {
          resetPlayersReadyDay();
          io.emit('gameNavigation');
            io.emit('pushState', '/vote');
            io.emit('navigateToVote'); // מעבר לעמוד VotePage
        } else {
          resetPlayersReadyDay();
          io.emit('gameNavigation');
          io.emit('pushState', '/mayor');
            io.emit('navigateToMayor'); // מעבר לעמוד MayorPage
        }
    }
});



socket.on('checkGameFlow', () => {
  const rolesStructure = getAssignedRolesStructure();
  const alivePlayers = Object.values(rolesStructure).flat().filter(p => p.isAlive);
  const mayorExists = alivePlayers.some(p => p.mayor === true);
  if (mayorExists) {
      io.emit('navigateToVote'); // מעבר לעמוד VotePage
  } else {
      io.emit('navigateToMayor'); // מעבר לעמוד MayorPage
  }
});

 // הודעה על בחירת מטרה לזאבים אחרים
 socket.on('setWolfTarget', ({ wolfName, targetName }) => {
  const rolesStructure = getAssignedRolesStructure();

  // מציאת תפקיד הזאב
  const wolfRole = Object.keys(rolesStructure).find((role) =>
    role.includes('זאב') &&
    rolesStructure[role].some((player) => player.name === wolfName)
  );

  if (wolfRole) {
    const wolf = rolesStructure[wolfRole].find((player) => player.name === wolfName);
    if (wolf) {
      wolf.wolfChoose = targetName; // עדכון המטרה של הזאב
      console.log(`Wolf ${wolfName} chose ${targetName}`);

      // שליחת הודעה לזאבים אחרים
      io.emit('wolfTargetUpdate', {
        senderName: wolfName,
        senderRole: wolfRole,
        targetName,
      });
    }
  }
 });

  const setPlayerReadyNight = (playerName, isReady) => {
    const rolesStructure = getAssignedRolesStructure(); // שליפת המבנה המעודכן
    for (const role in rolesStructure) {
      const player = rolesStructure[role].find(p => p.name === playerName);
      if (player) {
        player.readyNight = isReady; // עדכון השדה
      }
    }
  };
  
  const areAllPlayersReadyNight = () => {
    const rolesStructure = getAssignedRolesStructure(); // שליפת המבנה המעודכן
    
    // סינון רק שחקנים חיים
    const allAlivePlayers = Object.values(rolesStructure)
        .flat()
        .filter(player => player.isAlive); // לוקח רק את החיים

    console.log('Check All Alive Players Ready Night:', 
        allAlivePlayers.map(p => ({ name: p.name, readyNight: p.readyNight }))
    );

    // בדיקת מוכנות של כולם
    const allReady = allAlivePlayers.every(player => player.readyNight === true); // בדיקה רק על החיים
    console.log('All Ready Check (Alive Only):', allReady);
    return allReady; // החזרת התוצאה
};

  
  const resetPlayersReadyNight = () => {
    const rolesStructure = getAssignedRolesStructure(); // שליפת המבנה המעודכן
    for (const role in rolesStructure) {
      rolesStructure[role].forEach(player => player.readyNight = false);
      // rolesStructure[role].forEach(player => player.isFirstNight = false);
    }
  };
  const resetPlayersReadyDay = () => {
    const rolesStructure = getAssignedRolesStructure(); // שליפת המבנה המעודכן
    for (const role in rolesStructure) {
      rolesStructure[role].forEach(player => player.readyDay = false);
      rolesStructure[role].forEach(player => player.deathTarget = null);
      rolesStructure[role].forEach(player => player.lifeTarget = null);
      rolesStructure[role].forEach(player => player.shild = null);
    }
  };
  const resetPlayersReadyMayor = () => {
    const rolesStructure = getAssignedRolesStructure(); // שליפת המבנה המעודכן
    for (const role in rolesStructure) {
      rolesStructure[role].forEach(player => player.mayorReady = false);
      rolesStructure[role].forEach(player => player.mayorConfirm = false);

    }
  };
  const resetPlayersReadyVote = () => {
    const rolesStructure = getAssignedRolesStructure(); // שליפת המבנה המעודכן
    for (const role in rolesStructure) {
      rolesStructure[role].forEach(player => player.readyVote = false);
      rolesStructure[role].forEach(player => player.voteConfirm = false);

    }
  };

  const areAllNonWitchPlayersReady = () => {
    const rolesStructure = getAssignedRolesStructure(); // שליפת המבנה המעודכן

    // סינון תפקידים שלא כוללים 'מכשפה' ורק שחקנים חיים
    const allAliveNonWitchPlayers = Object.entries(rolesStructure)
        .filter(([role]) => !role.includes('מכשפה')) // סינון כל מי שהתפקיד שלו הוא "מכשפה"
        .flatMap(([_, players]) => players) // מיפוי לתוך מערך כללי
        .filter(player => player.isAlive); // לוקח רק את החיים

    console.log('בדיקת מוכנות - שחקנים חיים שאינם מכשפה:', 
        allAliveNonWitchPlayers.map(p => ({ name: p.name, readyNight: p.readyNight }))
    );

    // בדיקת מוכנות של כולם חוץ מהמכשפה
    const allReady = allAliveNonWitchPlayers.every(player => player.readyNight === true); // בדיקה
    console.log('מוכנות של כולם חוץ מהמכשפה (Alive Only):', allReady);
    return allReady; // החזרת התוצאה
};




  socket.on('toggleReadyNight', ({ playerName, isReady }) => {
    setPlayerReadyNight(playerName, isReady); // עדכון המוכנות בלילה
    
    console.log('Night readiness statuses after toggle:', getAssignedRolesStructure());

    setTimeout(() => {
      const allReadyNoWitch = areAllNonWitchPlayersReady(); // בדיקה מעודכנת
      console.log('מוכנות של כולם חוץ מהמכשפה (לפני חישוב מטרה):', allReadyNoWitch);
    
      if (allReadyNoWitch) {
        console.log('שולח את calculateWolfTarget');
        calculateWolfTarget(io); // קריאה מעודכנת
      } else {
        console.log('לא כל השחקנים מוכנים עדיין.');
      }
    }, 300);

    setTimeout(() => {
      const allReady = areAllPlayersReadyNight();
      console.log('All players ready for Day (Final Check):', allReady);
    
      if (allReady) {
        // const rolesStructure = getAssignedRolesStructure();

        // // עדכון השדה לכל השחקנים
        // Object.values(rolesStructure).flat().forEach(player => {
        //   player.isFirstNight = false; // שינוי השדה ל-FALSE
        // });

        // // שליחת עדכון ללקוח
        // io.emit('updateFirstNightStatus', { isFirstNight: false }); // שידור לכל הלקוחות
        console.log('כל השחקנים מוכנים - עיבוד תוצאות הלילה.');
        io.emit('allPlayersReadyNight'); // מעבר ליום
        resetPlayersReadyNight();
      }
    }, 300);
  });
  
  // בקשה לחשיפת תפקיד על ידי מגדת עתידות
  socket.on('seerRevealRole', ({ seerName, targetName }) => {
    const rolesStructure = getAssignedRolesStructure();
  
    let targetRole = null;
    for (const [role, players] of Object.entries(rolesStructure)) {
      if (players.some(player => player.name === targetName)) {
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

  socket.on('shieldPlayer', ({ shieldName, targetName }) => {
    const rolesStructure = getAssignedRolesStructure();
  
    // מציאת תפקיד המגן
    const shieldRole = Object.keys(rolesStructure).find((role) =>
      role.includes('מגן') &&
      rolesStructure[role].some(player => player.name === shieldName)
    );
  
    if (shieldRole) {
      const shield = rolesStructure[shieldRole].find(player => player.name === shieldName);
  
      if (shield) {
        shield.shild = targetName; // עדכון מטרה
        shield.shildSelf = shield.name === targetName; // האם הגן על עצמו
        console.log(`מגן ${shieldName} הגן על ${targetName}`);
      }
    }
  });
  
  socket.on('useDeathPotion', ({ witchName, targetName }) => {
    const rolesStructure = getAssignedRolesStructure();
    const witch = rolesStructure['מכשפה'].find((p) => p.name === witchName);
    if (witch) {
      witch.usedDeathPotion = true;
      witch.deathTarget = targetName;
      console.log(`מכשפה ${witchName} בחרה להרוג את ${targetName}`);
    }
  });

 
  socket.on('useLifePotion', ({ witchName, targetName }) => {
    const rolesStructure = getAssignedRolesStructure();
    const witch = rolesStructure['מכשפה'].find((p) => p.name === witchName);
    if (witch) {
      witch.usedLifePotion = true;
      witch.lifeTarget = targetName;
      console.log(`מכשפה ${witchName} בחרה להחיות את ${targetName}`);
    }
  });

  // socketHandlers.js
  socket.on('requestNightResults', () => {
    console.log('הלקוח ביקש את תוצאות הלילה.');
    // if (cachedNightResult) {
    //   console.log('שולח תוצאה שמורה ללקוח:', cachedNightResult);
    //   socket.emit('nightResult', cachedNightResult); // שליחה ללקוח
    // } else {
      console.log('אין תוצאות שמורות. עיבוד מחדש עשוי להידרש.');
      processNightResults(io); // במידה ואין תוצאה שמורה
    // }
  });
  // מאזין לבדיקה האם המשחק נגמר עבור שחקנים בעמוד DEAD
  socket.on('checkGameEndForDead', () => {
    if (isGameOver) { // משתמש במשתנה גלובלי שמגדיר האם המשחק נגמר
      socket.emit('navigateToEndGame'); // מעביר שחקנים בעמוד DEAD לעמוד הסיום
    }
  });
  socket.on('disconnect', () => {
    removePlayer(socket.id);
    const updatedPlayers = getPlayers();
    io.emit('updatePlayers', updatedPlayers.players);
  });

  socket.on('connect', () => {
    console.log('Reconnected to server. Re-registering event listeners...');
    socket.emit('requestRolesStructure'); // בקשה מחדש למבנה התפקידים
    socket.emit('requestNightResults');   // בקשה לתוצאות הלילה
});

  socket.on('hunterCheckStatus', ({ playerName }) => {
    const rolesStructure = getAssignedRolesStructure();
    const hunter = Object.values(rolesStructure).flat().find(p => p.name === playerName);

    if (hunter && !hunter.isAlive && hunterChoosing) {
        console.log(`${playerName} בודק אם הוא בצייד פעיל.`);
        io.emit('hunterChooseTarget', { // שליחה לכולם
            hunterName: playerName,
            players: Object.values(rolesStructure).flat().filter(p => p.isAlive),
        });
    }
});


// קריאה לבדיקה לאחר תוצאות הלילה
socket.on('checkGameStatus', () => {
  checkGameEnd(io);
});
socket.on('mayorVote', ({ playerName, targetName }) => {
  const rolesStructure = getAssignedRolesStructure();

  for (const [role, players] of Object.entries(rolesStructure)) {
    const player = players.find(p => p.name === playerName);
    if (player && player.isAlive) {
      player.mayorVote = targetName;
      console.log(`${playerName} הצביע עבור ראש העיר: ${targetName}`);
    }
  }

  // מיד לאחר ההצבעה בודקים אם כולם אישרו
  const allConfirmed = Object.values(rolesStructure)
    .flat()
    .filter(p => p.isAlive)
    .every(p => p.mayorConfirm);

  if (allConfirmed) {
    console.log('כולם אישרו בחירה. מבצעים ספירת קולות.');

    const votes = {};
    Object.values(rolesStructure).flat().forEach(p => {
      if (p.isAlive && p.mayorVote) {
        votes[p.mayorVote] = (votes[p.mayorVote] || 0) + 1;
      }
    });

    const maxVotes = Math.max(...Object.values(votes));
    const tiedCandidates = Object.keys(votes).filter(name => votes[name] === maxVotes);
    const selectedMayor = tiedCandidates.length > 1
      ? tiedCandidates[Math.floor(Math.random() * tiedCandidates.length)]
      : tiedCandidates[0];

    console.log(`ראש העיר שנבחר: ${selectedMayor}`);

    for (const [role, players] of Object.entries(rolesStructure)) {
      players.forEach(player => {
        player.mayorName = selectedMayor;
        player.mayor = player.name === selectedMayor;
      });
    }

    io.emit('mayorElected', { mayorName: selectedMayor, votes });
  }
});
const checkAllMayorConfirmed = (io, rolesStructure) => {
  const allConfirmed = Object.values(rolesStructure)
    .flat()
    .filter(p => p.isAlive)
    .every(p => p.mayorConfirm);

  if (allConfirmed) {
    console.log('כולם אישרו בחירה. מבצעים ספירת קולות.');

    const votes = {};
    const personalVotes = {}; // הוספת הצבעות אישיות
    Object.values(rolesStructure).flat().forEach(p => {
      if (p.isAlive && p.mayorVote) {
        votes[p.mayorVote] = (votes[p.mayorVote] || 0) + 1;
        personalVotes[p.name] = p.mayorVote; // שמירת ההצבעה האישית
      }
    });

    const maxVotes = Math.max(...Object.values(votes));
    const tiedCandidates = Object.keys(votes).filter(name => votes[name] === maxVotes);
    const selectedMayor = tiedCandidates.length > 1
      ? tiedCandidates[Math.floor(Math.random() * tiedCandidates.length)]
      : tiedCandidates[0];

    console.log(`ראש העיר שנבחר: ${selectedMayor}`);

    Object.values(rolesStructure).flat().forEach(player => {
      player.mayorName = selectedMayor;
      player.mayor = player.name === selectedMayor;
    });

    io.emit('mayorElected', { mayorName: selectedMayor, votes, personalVotes });
  }
};


socket.on('confirmMayorVote', ({ playerName, confirm }) => {
  const rolesStructure = getAssignedRolesStructure();

  // חיפוש השחקן בעזרת שמו ועדכון השדה mayorConfirm
  for (const [role, players] of Object.entries(rolesStructure)) {
    const player = players.find(p => p.name === playerName);
    if (player && player.isAlive) {
      player.mayorConfirm = confirm; // עדכון השדה
      console.log(`${playerName} עדכן mayorConfirm ל-${confirm}`);
    }
  }

  // שליחת עדכון לכל השחקנים
  io.emit('rolesStructure', rolesStructure); // עדכון מבנה התפקידים לכל המשתמשים

  // קריאה לבדיקה אם כולם אישרו בחירה
  checkAllMayorConfirmed(io, rolesStructure); // פונקציה שתבדוק אם כולם אישרו
});

socket.on('checkAllMayorConfirmed', () => {
  const rolesStructure = getAssignedRolesStructure();

  const allConfirmed = Object.values(rolesStructure)
    .flat()
    .filter(p => p.isAlive)
    .every(p => p.mayorConfirm);

  if (allConfirmed) {
    console.log('כולם אישרו בחירה. מבצעים ספירת קולות.');

    const votes = {};
    const personalVotes = {}; // הצבעות אישיות
    Object.values(rolesStructure).flat().forEach(p => {
      if (p.isAlive && p.mayorVote) {
        votes[p.mayorVote] = (votes[p.mayorVote] || 0) + 1;
        personalVotes[p.name] = p.mayorVote; // שמירת הצבעה אישית
      }
    });

    // מציאת המנצח (במקרה של תיקו, בחירה אקראית)
    const maxVotes = Math.max(...Object.values(votes));
    const tiedCandidates = Object.keys(votes).filter(name => votes[name] === maxVotes);
    const selectedMayor = tiedCandidates.length > 1
      ? tiedCandidates[Math.floor(Math.random() * tiedCandidates.length)]
      : tiedCandidates[0];

    console.log(`ראש העיר שנבחר: ${selectedMayor}`);

    // עדכון תפקיד ראש העיר
    Object.values(rolesStructure).flat().forEach(player => {
      player.mayorName = selectedMayor;
      player.mayor = player.name === selectedMayor;
    });

    io.emit('mayorElected', { mayorName: selectedMayor, votes, personalVotes }); // שליחת התוצאות כולל הצבעות אישיות
  }
});



socket.on('checkAllMayorReady', () => {
  const rolesStructure = getAssignedRolesStructure();

  // בדיקה אם כולם מוכנים
  const allReady = Object.values(rolesStructure)
    .flat()
    .filter(p => p.isAlive)
    .every(p => p.mayorReady);

  if (allReady) {
    console.log('כל השחקנים מוכנים. עוברים לעמוד הצבעות.');
    resetPlayersReadyMayor();
    io.emit('navigateToVote');
  }
});


socket.on('toggleMayorReady', ({ playerName, isReady }) => {
  const rolesStructure = getAssignedRolesStructure();

  for (const [role, players] of Object.entries(rolesStructure)) {
    const player = players.find(p => p.name === playerName);
    if (player && player.isAlive) {
      player.mayorReady = isReady; // עדכון מוכנות
      console.log(`${playerName} עדכן mayorReady ל-${isReady}`);
    }
  }

  // בדיקה אם כולם מוכנים
  const allReady = Object.values(rolesStructure)
    .flat()
    .filter(p => p.isAlive)
    .every(p => p.mayorReady);

  if (allReady) {
    console.log('כל השחקנים מוכנים. עוברים לעמוד ההצבעות.');
    resetPlayersReadyMayor();
    io.emit('navigateToVote'); // מעבר לעמוד VotePage
  }
});

socket.on('submitVote', ({ playerName, voteTarget }) => {
  const rolesStructure = getAssignedRolesStructure();

  for (const [role, players] of Object.entries(rolesStructure)) {
    const player = players.find(p => p.name === playerName);
    if (player && player.isAlive) {
      player.deadVote = voteTarget; // שמירת הבחירה
      console.log(`${playerName} הצביע עבור ${voteTarget}`);
    }
  }
});

socket.on('confirmVote', ({ playerName, confirm }) => {
  const rolesStructure = getAssignedRolesStructure();

  // עדכון השדה voteConfirm של השחקן שאישר בחירה
  for (const [role, players] of Object.entries(rolesStructure)) {
    const player = players.find(p => p.name === playerName);
    if (player && player.isAlive) {
      player.voteConfirm = confirm; // עדכון השדה
      console.log(`${playerName} אישר את הבחירה: ${confirm}`);
    }
  }

  // בדיקה האם כל השחקנים החיים אישרו בחירה
  const allConfirmed = Object.values(rolesStructure)
  .flat()
  .filter(p => p.isAlive) // סינון שחקנים חיים בלבד
  .every(p => p.voteConfirm);

  if (allConfirmed) {
    console.log('כולם אישרו בחירה. מבצעים ספירת קולות.');

    // קריאה לפונקציה processVoteResults
    processVoteResults(io);
  }
});

socket.on('requestMayor', () => {
  let mayor = null;

  const rolesStructure = getAssignedRolesStructure(); // הפונקציה הקיימת
  for (const [role, players] of Object.entries(rolesStructure)) {
    players.forEach(player => {
      const tmpMayor = player.mayorName;
        if (tmpMayor){
          mayor = tmpMayor;
        }
        console.log("mayor name: ", mayor);      
    });
  }
  // const mayor = getMayor(); // פונקציה המחזירה את שם ראש העיר
  console.log("getMayor ", mayor)
  socket.emit('mayorName', mayor);
});

socket.on('toggleVoteReady', ({ playerName, isReady }) => {
  const rolesStructure = getAssignedRolesStructure();

  // עדכון מוכנות
  for (const [role, players] of Object.entries(rolesStructure)) {
    const player = players.find(p => p.name === playerName);
    if (player && player.isAlive) {
      player.readyVote = isReady;
    }
  }

  // בדיקת מוכנות כללית
  const allReady = Object.values(rolesStructure)
    .flat()
    .filter(p => p.isAlive)
    .every(p => p.readyVote);

  if (allReady) {
    const isGameOver = checkGameEnd(io);
    if (isGameOver) {
      io.emit('navigateToEndGame'); // מעבר לעמוד סיום משחק
    } else {
      resetPlayersReadyVote();
      io.emit('navigateToNight'); // מעבר לעמוד לילה
    }
  }
});

const fs = require('fs');

socket.on('resetGame', () => {
        console.log('Resetting game...');
        resetGamePlayers();
        io.emit('clearLocalStorage'); // ניקוי מקומי
        console.log('Game reset complete.');
});

socket.on('restartServer', () => {
        console.log('Restarting server...');
        fs.utimesSync(__filename, new Date(), new Date()); // עדכון קובץ

});

socket.on('requestHunterVotes', (hunterName) => {
  const votes = hunterVotesMap.get(hunterName) || [];
  socket.emit('receiveHunterVotes', { personalVotes: votes });
});
};

module.exports = handleSocketEvents;

const checkMayorStatus = () => {
  const rolesStructure = getAssignedRolesStructure();

  // איפוס שדה ראש העיר במקרה והמת תואם
  for (const [role, players] of Object.entries(rolesStructure)) {
    players.forEach(player => {
      if (!player.isAlive && player.name === rolesStructure.mayorName) {
        console.log(`ראש העיר ${player.name} מת, איפוס ראש העיר.`);
        rolesStructure.mayorName = null; // איפוס שם ראש העיר
        player.mayor = false; // איפוס תפקיד ראש העיר
      }
    });
  }
};
const isElderDead = () => {
  const rolesStructure = getAssignedRolesStructure();
  const elder = Object.entries(rolesStructure)
    .filter(([role]) => role.includes('זקן השבט'))
    .flatMap(([_, players]) => players)[0]; // מציאת זקן השבט

  return elder && !elder.isAlive; // החזרת TRUE אם זקן השבט מת
};
let isGameOver = false; // משתנה למעקב אחר סיום המשחק
const checkGameEnd = (io) => {
  const rolesStructure = getAssignedRolesStructure();
  
  checkMayorStatus(); // קריאה לפונקציה החדשה

  const alivePlayers = Object.entries(rolesStructure)
    .flatMap(([role, players]) => 
      players.filter(p => p.isAlive).map(p => ({ ...p, role }))
    );
  const aliveRoles = alivePlayers.map(p => p.role);
  console.log('תפקידים חיים:', aliveRoles);


  const allWolves = aliveRoles.every(role => role.includes('זאב')); // כל החיים הם זאבים בלבד
  const onlyWolvesAndLeech = aliveRoles.every(role => role.includes('זאב') || role === 'עלוקה'); // רק זאבים ועלוקה
  const hasLeech = aliveRoles.includes('עלוקה');
  const onlyLeech = aliveRoles.length === 1 && hasLeech;
  const noOneAlive = alivePlayers.length === 0;
  const allCitizens = aliveRoles.every(role => !role.includes('זאב'));
  console.log('allWolves:', allWolves);
  console.log('hasLeech:', hasLeech);
  console.log('aliveRoles length:', aliveRoles.length);
  const cupids = Object.entries(rolesStructure)
    .filter(([role]) => role.includes('קופידון'))
    .flatMap(([_, players]) => players);
  const lovers = cupids.map(cupid => cupid.lover);
  const onlyCupidAndLover = alivePlayers.length === 2 && alivePlayers.some(p => lovers.includes(p.name));
  const elder = Object.entries(rolesStructure)
  .filter(([role]) => role.includes('זקן השבט'))
  .flatMap(([_, players]) => players)[0]; // מציאת זקן השבט
  if (elder){
    hunterChoosing = !isElderDead();
  }  let resultMessage = '';
  if (noOneAlive) {
    resultMessage = 'אף אחד לא ניצח';
    // io.emit('gameEnd', resultMessage); // שליחת האירוע לכל המשתמשים
  } else if (allWolves && !hasLeech && aliveRoles.length > 0) {
    resultMessage = 'הזאבים ניצחו';
  }else if (onlyWolvesAndLeech) {
    resultMessage = 'העלוקה ניצחה';
  } else if (onlyLeech) {
    resultMessage = 'העלוקה ניצחה';
  } else if (onlyCupidAndLover  && hasLeech) {
    resultMessage = 'העלוקה ניצחה';
  } else if (onlyCupidAndLover  && !hasLeech) {
    resultMessage = 'הנאהבים ניצחו';
  } else if (allCitizens && !hasLeech) {
    resultMessage = 'האזרחים ניצחו';
  } else if (allCitizens && hasLeech) {
    resultMessage = 'העלוקה ניצחה';
  } else {
    resultMessage = ''; // המשחק ממשיך
  }
  console.log("!hunterChoosing " , hunterChoosing);

  // עדכון המצב הגלובלי אם המשחק נגמר
  if (resultMessage && !hunterChoosing) {
    isGameOver = true;
    console.log(resultMessage);
    io.emit('gameEnd', resultMessage);
  } else {
    isGameOver = false;
    console.log('המשחק ממשיך');
  }

  return isGameOver && !hunterChoosing; // מחזירים האם המשחק נגמר
};




let hunterIndex = 0;
const processNightResults = (io) => {
  console.log("currentPlayer ", currentPlayer);
  let foundCurrName = null;
  const rolesStructure = getAssignedRolesStructure();

  for (const [roleName, players] of Object.entries(rolesStructure)) {
    const currName = players.find(player => player.name === currentPlayer);
    if (currName) {
      foundCurrName = currName;
      break;
    }
  }
  if (foundCurrName.locked ) {
    console.log('עיבוד הלילה כבר מתבצע. מבטל קריאה כפולה.');
    if (cachedNightResult) {
      console.log('שולח תוצאות שמורות מהזיכרון לכל השחקנים.');
      io.emit('nightResult', cachedNightResult); // שליחת תוצאות שמורות
    }
    return; // אם הקריאה כבר מתבצעת, לא נמשיך
  }
  foundCurrName.locked = true;
  nightProcessingLock = true; // ננעל את הקריאה הנוכחית
  console.log('מעבד תוצאות הלילה...');

  // rolesStructure[role].forEach(player => {
  //   player.locked = false;  // ודא שכולם מאותחלים כברירת מחדל
  // });
  console.log('מבנה התפקידים בתום הלילה:', JSON.stringify(rolesStructure, null, 2));

  let results = []; // מערך לתוצאות התצוגה
  let savedByWitch = false;
  let savedByShield = false;

  // חיפוש המכשפה
  const witch = Object.entries(rolesStructure)
    .filter(([role]) => role.includes('מכשפה'))
    .flatMap(([_, players]) => players)[0];

  // חיפוש המגן
  const shild = Object.entries(rolesStructure)
    .filter(([role]) => role.includes('מגן'))
    .flatMap(([_, players]) => players)[0];

  // 2. בדיקת האם המכשפה נתנה שיקוי מוות
  if (witch && witch.deathTarget && witch.usedDeathPotion) {
    const deathTargetName = witch.deathTarget;
    console.log("aaa"); // לוג לתיעוד

    // חיפוש המטרה לשיקוי מוות
    let victim = null;
    let victimRole = null;
    for (const [roleName, players] of Object.entries(rolesStructure)) {
      const foundVictim = players.find(player => player.name === deathTargetName);
      if (foundVictim) {
        victim = foundVictim;
        victimRole = roleName; // שמירת התפקיד
        console.log("bbb"); // לוג לתיעוד

        break;
      }
    }

    if (victim) {
      console.log("ccc"); // לוג לתיעוד

      victim.isAlive = false; // הורגים את הקורבן
      results.push(`המכשפה החליטה לתת ל-${victim.name} בתפקיד ${victimRole} שיקוי מוות ולכן הוא יצא מהמשחק!`);
      console.log(results[results.length - 1]); // לוג לתיעוד
    }
  }

    // 3. בדיקת המטרה של הזאבים
    const firstAlivePlayer = Object.values(rolesStructure) // חיפוש השחקן הראשון שעדיין חי
      .flat()
      .find(player => player.isAlive);

 const wolfTargetName = firstAlivePlayer?.wolfFinalTarget;

  // . בדיקת האם המכשפה נתנה שיקוי חיים
  if (witch && witch.usedLifePotion && witch.lifeTarget === wolfTargetName) {
    savedByWitch = true; 
    console.log(`המכשפה הצילה מהתקפת הזאבים בעזרת שיקוי חיים!`);
  }
    // . בדיקה אם המגן הגן
    if (shild && shild.shild === wolfTargetName) {
      savedByShield = true;  
      console.log(`המגן הציל מהתקפת הזאבים!`);
    }
 if (wolfTargetName && !savedByWitch && !savedByShield) {
  let victim = null;
  let victimRole = null;

  for (const [roleName, players] of Object.entries(rolesStructure)) {
    const foundVictim = players.find(player => player.name === wolfTargetName);
    if (foundVictim) {
      victim = foundVictim;
      victimRole = roleName;
      break;
    }
  }
  console.log('victim ', victim);

  if (victim) {
    // טיפול במקרה של זקן השבט
    if (victimRole === 'זקן השבט') {
          if (!foundCurrName.isAttackedOnce) {
            foundCurrName.isAttackedOnce = true; // התקפה ראשונה
            console.log("foundCurrName.isAttackedOnce ", foundCurrName.isAttackedOnce);
            victim.liveCount = 1; // הורדת חיים אחד
            console.log(`זקן השבט ${victim.name} הותקף פעם ראשונה ונשאר בחיים.`);
          } else {
            victim.liveCount = 0;
            victim.olderAlive = false;
            victim.isAlive = false; // מוות מוחלט
            results.push(`הזאבים טרפו את ${victim.name} בתפקיד זקן השבט! \nמעכשיו ועד סוף המשחק לא יהיו לאזרחים כוחות בלילה.`);
            console.log(`זקן השבט ${victim.name} מת סופית.`);
          }
        

    } else {
      // שחקן רגיל מת
      victim.isAlive = false;
      results.push(`הזאבים החליטו לטרוף את ${victim.name} בתפקיד ${victimRole}!`);
      console.log(results[results.length - 1]);
    }
  }
}


 // 1. בדיקת קופידון ונאהב
 const cupids = Object.entries(rolesStructure)
 .filter(([role]) => role.includes('קופידון'))
 .flatMap(([_, players]) => players);

 cupids.forEach(cupid => {
 if (!cupid.isAlive && cupid.lover) {
   // קופידון מת - הורגים את הנאהב שלו
   let lover = null;
   let loverRole = null;
   for (const [roleName, players] of Object.entries(rolesStructure)) {
     const foundLover = players.find(player => player.name === cupid.lover);
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
     if (loverRole === "זקן השבט"){
      results.push(`מעכשיו ועד סוף המשחק לא יהיו לאזרחים כוחות בלילה.`);
     }
     console.log(results[results.length - 1]);
   }
 }
 });

  // 2. בדיקה אם נאהב של קופידון מת
  cupids.forEach(cupid => {
  let lover = null;
  for (const [roleName, players] of Object.entries(rolesStructure)) {
    lover = players.find(player => player.name === cupid.lover && !player.isAlive);
    if (lover) break;
  } 

 if (lover && cupid.isAlive) {
   cupid.isAlive = false;
   results.push(`${cupid.name} בתפקיד הקופידון יצא מהמשחק מאחר שבחר לנאהב את ${lover.name}`);
   console.log(results[results.length - 1]);
 }
 });

  let hunterDied = false; // דגל לבדיקת מוות של צייד
  let hunterPlayer = null;

  const hunters = Object.entries(rolesStructure)
    .filter(([role]) => role.includes('צייד'))
    .flatMap(([_, players]) => players);

  // עדכון שידור אירוע לצייד
  hunters.forEach(hunter => {
    if (!hunter.isAlive) {
      hunterDied = true;
      hunterPlayer = hunter;
      hunterIndex++;
    }
  });

  if (hunterDied && hunterPlayer) {
    if (hunterIndex == 1){
      hunterChoosing = true; // הצייד במצב בחירה
    }

  // לוג מפורט עם השחקנים החיים
  const alivePlayers = Object.values(rolesStructure).flat().filter(p => p.isAlive);
  console.log('Alive players for hunter:', alivePlayers.map(p => p.name));
  console.log(`Hunter ${hunterPlayer.name} is triggered. Alive players:`, alivePlayers.map(p => p.name));

  // שידור האירוע - כולל שמירה של משתנה חיצוני לזיהוי החזרת האירוע במקרים של דיס-קונקט
  io.emit('hunterWaitingDecision', { hunterName: hunterPlayer.name });
  if (hunterDied && hunterPlayer) {
    console.log(`Hunter ${hunterPlayer.name} died. Emitting hunterChooseTarget.`);
    io.emit('hunterChooseTarget', {
        hunterName: hunterPlayer.name,
        players: alivePlayers,
    });
}

  // טיפול בדיסקונקטים מאוחרים
  io.on('connection', (socket) => {
    // console.log(`Client reconnected: ${socket.id}`);
    socket.emit('hunterWaitingDecision', { hunterName: hunterPlayer.name });
  });
 }


  if (results.length === 0) {
    results.push('הלילה אף אחד לא יצא מהמשחק.');
  }

  const finalMessage = results.join('\n');
  cachedNightResult = finalMessage;
  io.emit('nightResult', finalMessage);
  
  // cachedNightResult = null; // איפוס המטמון בסוף העיבוד
  io.emit('checkGameStatus'); // קריאה לבדיקה אם המשחק נגמר
  setTimeout(() => {
    foundCurrName.locked = false;
  }, 500);
  setTimeout(() => {
    nightProcessingLock = false;
  }, 500);
};
const hunterVotesMap = new Map(); // Map זמני לשמירת הצבעות הצייד

const processVoteResults = (io, results) => {
  const rolesStructure = getAssignedRolesStructure();

  let electedPlayer = null;
  let electedRole = null;

  // חישוב הקולות
  const votesCount = {};
  const personalVotes = [];

  for (const [role, players] of Object.entries(rolesStructure)) {
    players.forEach((player) => {
      if (player.isAlive && player.deadVote) {
        votesCount[player.deadVote] = (votesCount[player.deadVote] || 0) + (player.mayor ? 2 : 1); // תוספת קול לראש עיר
        personalVotes.push({ voter: player.name, target: player.deadVote });
      }
    });
  }

  // מציאת השחקן עם הכי הרבה קולות
  const maxVotes = Math.max(...Object.values(votesCount));
  const tiedPlayers = Object.keys(votesCount).filter(p => votesCount[p] === maxVotes);

  // במקרה של תיקו נבחר רנדומלית
    // שליפת ראש העיר
    const mayorPlayer = Object.values(rolesStructure)
      .flat()
      .find(p => p.mayor);

    if (tiedPlayers.length > 1 && mayorPlayer) {
      // במקרה של תיקו, בודקים את מי ראש העיר לא הצביע
      const playersNotVotedByMayor = tiedPlayers.filter(p => p !== mayorPlayer.deadVote);
      if (playersNotVotedByMayor.length > 0) {
        // אם יש יותר מאחד, בוחרים רנדומלית מבין אלה שראש העיר לא הצביע להם
        electedPlayer = playersNotVotedByMayor.length > 1 
          ? playersNotVotedByMayor[Math.floor(Math.random() * playersNotVotedByMayor.length)] 
          : playersNotVotedByMayor[0];
      } else {
        // אם כולם קיבלו הצבעה מראש העיר, נבחר רנדומלית מבין התיקו
        electedPlayer = tiedPlayers[Math.floor(Math.random() * tiedPlayers.length)];
      }
    } else {
      // אם אין תיקו, בוחרים את המועמד בעל הקולות הגבוהים ביותר
      electedPlayer = tiedPlayers[0];
    }


  // מציאת התפקיד של השחקן שנבחר
  for (const [role, players] of Object.entries(rolesStructure)) {
    const found = players.find(p => p.name === electedPlayer);
    if (found) {
      electedRole = role;
      found.isAlive = false; // עדכון המצב
      io.emit('playerDead', { 
        playerName: found.name, 
        role: role 
      });   
     }
  }

  console.log(`נבחר שחקן להריגה: ${electedPlayer}, תפקיד: ${electedRole}`);
  console.log(`בדיקת קשר קופידון עם נאהבים...`);
  
  const cupidPlayers = Object.entries(rolesStructure)
  .filter(([role]) => role.includes('קופידון'))
  .flatMap(([_, players]) => players);

cupidPlayers.forEach(cupid => {
  const lover = Object.values(rolesStructure)
    .flat()
    .find(p => p.name === cupid.lover);

  console.log(`בדיקת קשרי קופידון: ${cupid.name} -> ${cupid.lover}`);

  // אם הנאהב מת
  if (lover && lover.name === electedPlayer) {
    console.log(`${lover.name} נהרג - הקופידון ${cupid.name} אמור למות.`);
    cupid.isAlive = false;
    console.log(`Socket ID של הקופידון ${cupid.name}:`, getPlayerSocketId(cupid.name));
    console.log(`שליחת הודעת נווט לקופידון ${cupid.name}`);
    // שליחת הודעות והעברה לדף המתים
    io.to(getPlayerSocketId(cupid.name)).emit('navigateToDead', {
      message: `הקופידון ${cupid.name} יצא מהמשחק בעקבות מותו של הנאהב ${lover.name}!`,
    });
    io.emit('playerDeadCupid', { 
      playerName: cupid.name, 
      role: 'קופידון',
      loverRole: electedRole,
      loverName: lover.name

    });   
    io.emit('cupidDeathMessage', {
      message: `הקופידון ${cupid.name} יצא מהמשחק בעקבות מותו של הנאהב ${lover.name}!`,
    });
    io.to(getPlayerSocketId(cupid.name)).emit('pushState', '/dead');
  }

  // אם הקופידון מת
  if (cupid.name === electedPlayer && lover) {
    console.log(`${cupid.name} נהרג - הנאהב ${lover.name} אמור למות.`);
    lover.isAlive = false;

    io.to(getPlayerSocketId(lover.name)).emit('navigateToDead', {
      message: `הנאהב ${lover.name} בתפקיד ${lover.role} יצא מהמשחק בעקבות מותו של הקופידון ${cupid.name}!`,
    });

    io.emit('playerDeadLover', { 
      playerName: lover.name, 
      role: lover.role,
      cupidName: cupid.name
    });   

    io.emit('cupidDeathMessage', {
      message: `הנאהב ${lover.name} יצא מהמשחק בעקבות מותו של הקופידון ${cupid.name}!`,
    });
    io.to(getPlayerSocketId(lover.name)).emit('pushState', '/dead');
  }
});



// שליפת שם ראש העיר
const mayor = Object.values(rolesStructure)
  .flat()
  .find(p => p.mayor); // מחפש את השחקן שמסומן כראש עיר
  let hunterDied = false; // דגל לבדיקת מוות של צייד
  let hunterPlayer = null;

  const hunters = Object.entries(rolesStructure)
    .filter(([role]) => role.includes('צייד'))
    .flatMap(([_, players]) => players);

  // עדכון שידור אירוע לצייד
  hunters.forEach(hunter => {
    if (!hunter.isAlive) {
      hunterDied = true;
      hunterPlayer = hunter;
      hunterIndex++;
      
    }
  });

  if (hunterDied && hunterPlayer) {
    if (hunterIndex == 1){
      hunterChoosing = true; // הצייד במצב בחירה
    }
    hunterVotesMap.set(hunterPlayer.name, personalVotes);

    io.emit('voteResultsHunter', {
      personalVotes,
    });
  // לוג מפורט עם השחקנים החיים
  const alivePlayers = Object.values(rolesStructure).flat().filter(p => p.isAlive);
  console.log('Alive players for hunter:', alivePlayers.map(p => p.name));

  // שידור האירוע - כולל שמירה של משתנה חיצוני לזיהוי החזרת האירוע במקרים של דיס-קונקט
  io.emit('hunterWaitingDecision', { hunterName: hunterPlayer.name });
  io.emit('hunterChooseTarget', {
      hunterName: hunterPlayer.name,
      players: alivePlayers,
  });

  // טיפול בדיסקונקטים מאוחרים
  io.on('connection', (socket) => {
    // console.log(`Client reconnected: ${socket.id}`);
    socket.emit('hunterWaitingDecision', { hunterName: hunterPlayer.name });
  });
}
const mayorName = mayor ? mayor.name : ''; // אם אין ראש עיר, הערך יהיה מחרוזת ריקה
  // שליחת תוצאות
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


