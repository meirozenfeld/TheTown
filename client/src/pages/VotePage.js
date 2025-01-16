import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import TopBar from '../components/topBar'; // נתיב לקובץ topBar.js

const socket = io('https://town-game-server.onrender.com');

function VotePage() {
  const [players, setPlayers] = useState([]);
  const [selectedVote, setSelectedVote] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [voteResults, setVoteResults] = useState({});
  const [personalVotes, setPersonalVotes] = useState([]);
  const [mayorName, setMayorName] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  const [playerName, setPlayerName] = useState('');
  const [role, setRole] = useState('');
  const [isAlive, setIsAlive] = useState(true); // מעקב אם השחקן חי
  const [message, setMessage] = useState([]); // מערך במקום מחרוזת
  const [hunterMessage, setHunterMessage] = useState([]); // מערך במקום מחרוזת
  const [isHunter, setIsHunter] = useState(false);
  const [targets, setTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [isChoosing, setIsChoosing] = useState(false); // משתנה האם הצייד בוחר
  const [waitingForHunter, setWaitingForHunter] = useState(false);
  const [hunterName, setHunterName] = useState('');
  const [elderDead, setElderDead] = useState(false); // מצב זקן השבט
  const currentPlayer = sessionStorage.getItem('playerName'); // השחקן הנוכחי
  const hunterChoseTarget = sessionStorage.getItem('hunterChoseTarget');
  const [isLoading, setIsLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);


  useEffect(() => {
    // בקשה ל-towntime מהשרת
    socket.emit('requestSettings');
    socket.on('settingsReceived', (settings) => {
      console.log('Settings received Vote:', settings);
      const townTimeInSeconds = settings.townTime * 60; // המרה לשניות
      setTimeLeft(townTimeInSeconds);
    });

    return () => {
      socket.off('settingsReceived');
    };
  }, []);

  useEffect(() => {
    // ספירה לאחור
    if (timeLeft > 0) {
      if (timeLeft <= 10) {
        setIsFlashing(true);
      } else {
        setIsFlashing(false);
      }
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (!confirmed && !selectedVote && players.length > 0) {
      // בחירה רנדומלית אם הזמן נגמר
      const filteredPlayersTime = players.filter(player => player.name !== currentPlayer);

      const randomPlayer = filteredPlayersTime[Math.floor(Math.random() * players.length)];
      setSelectedVote(randomPlayer.name);
      setConfirmed(true);
      socket.emit('submitVote', {
        playerName: currentPlayer,
        voteTarget: randomPlayer.name,
      });
      socket.emit('confirmVote', {
        playerName: currentPlayer,
        confirm: true,
      });
    }
  }, [timeLeft, confirmed, selectedVote, players]);

  useEffect(() => {
    socket.emit('requestRolesStructure');

    socket.on('rolesStructure', (rolesStructure) => {
      const alivePlayers = Object.values(rolesStructure)
        .flat()
        .filter(p => p.isAlive);
      setPlayers(alivePlayers);

    });
    // האזנה למבנה התפקידים
    socket.on('rolesStructure', (rolesStructure) => {
        const player = Object.values(rolesStructure)
          .flat()
          .find(p => p.name === currentPlayer);
    
        if (player) {
          const roleName = Object.entries(rolesStructure).find(([_, players]) =>
            players.includes(player)
          )[0];
          setRole(roleName);
          setIsLoading(false);

        }
      });
    socket.on('voteResults', ({ results, personalVotes, mayorName, electedPlayer, electedRole }) => {
        console.log('voteResults התקבלו מהשרת:', {
          results,
          personalVotes,
          mayorName,
          electedPlayer,
          electedRole,
        });
        setVoteResults(results);
        setPersonalVotes(personalVotes);
        setMayorName(mayorName);
        setSelectedVote(electedPlayer);
        setSelectedRole(electedRole);
        // console.log("selectedRole: ", selectedRole)
        // if (selectedRole === 'צייד') {
        //   sessionStorage.setItem('personalVotes', JSON.stringify(personalVotes)); // שמירת personalVotes
        // }
      });

      socket.on('gameEnd', (result) => {
        console.log('Game Ended:', result);
        sessionStorage.setItem('gameResult', result); // שמירת התוצאה בזיכרון
    });
    return () => {
      socket.off('rolesStructure');
      socket.off('voteResults');
      socket.off('gameEnd');

    };
  }, [selectedRole]);

  useEffect(() => {
    // מאזין להודעות על מוות נוסף בעקבות קשרי קופידון
    socket.on('cupidDeathMessage', ({ message }) => {
      console.log('הודעת קופידון:', message);
      setMessage(prev => [...prev, message]); // עדכון הודעות על המסך
      // if (role === 'קופידון' ){
      //   sessionStorage.setItem('nightResults', JSON.stringify([message])); // שמירת הודעה
      //   window.dispatchEvent(new Event('gameNavigation')); // סימון מעבר יזום
      //   window.history.pushState(null, '', '/dead'); // עדכון היסטוריה
      //   window.location.href = '/dead'; // מעבר לעמוד המתים
      // }
    });
    //     // האזנה להעברה לעמוד DEAD בעקבות בחירת הצייד
    // socket.on('navigateToDead', ({ message }) => {
    //     console.log('NavigateToDead message received:', message); // DEBUG
    //     sessionStorage.setItem('nightResults', JSON.stringify([message])); // שמירת הודעה
    //     window.dispatchEvent(new Event('gameNavigation')); // סימון מעבר יזום
    //     window.history.pushState(null, '', '/dead'); // עדכון היסטוריה
    //     window.location.href = '/dead'; // מעבר לעמוד המתים
    // });
  
    return () => {
      socket.off('cupidDeathMessage'); // ניקוי מאזין
    };
  }, []);

  useEffect(() => {
    socket.on('navigateToDead', ({ message }) => {
      const currentPlayer = sessionStorage.getItem('playerName');
      console.log('NavigateToDead message received:', message);
  
      // בדיקה האם ההודעה מיועדת לשחקן הנוכחי
      const isForCurrentPlayer = message.includes(currentPlayer);
      if (isForCurrentPlayer) {
        sessionStorage.setItem('nightResults', JSON.stringify([message])); // שמירת הודעה
        window.dispatchEvent(new Event('gameNavigation')); // סימון מעבר יזום
        window.history.pushState(null, '', '/dead'); // עדכון היסטוריה
        window.location.href = '/dead'; // מעבר לעמוד המתים
      }
    });
  
    return () => {
      socket.off('navigateToDead'); // ניקוי מאזין
    };
  }, []);
  
  useEffect(() => {
    socket.on('elderStatus', ({ elderDead }) => {
      setElderDead(elderDead); // עדכון המצב
      console.log('Elder status updated:', elderDead);
    });
  
    socket.emit('requestRolesStructure'); // בקשת מצב ראשוני
  
    return () => {
      socket.off('elderStatus'); // הסרת המאזין
    };
  }, []);

  useEffect(() => {
    // const savedMessages = sessionStorage.getItem('nightResults'); // תוצאות הלילה
    const hunterMessage = sessionStorage.getItem('hunterResult'); // תוצאת הצייד
    
    // if (savedMessages) {
    //   setMessage(JSON.parse(savedMessages)); // שחזור הודעות הלילה
    // }
    if (hunterMessage) {
      setHunterMessage(JSON.parse(hunterMessage)); // שחזור הודעת הצייד
    }
  }, []);

  useEffect(() => {
    // האזנה להעברה לעמוד DEAD בעקבות בחירת הצייד
    socket.on('navigateToDead', ({ message }) => {
        console.log('NavigateToDead message received:', message); // DEBUG
        sessionStorage.setItem('nightResults', JSON.stringify([message])); // שמירת הודעה
        window.dispatchEvent(new Event('gameNavigation')); // סימון מעבר יזום
        window.history.pushState(null, '', '/dead'); // עדכון היסטוריה
        window.location.href = '/dead'; // מעבר לעמוד המתים
    });
  
    return () => {
        socket.off('navigateToDead'); // ניקוי מאזין
    };
  }, []);

  useEffect(() => {
    socket.on('hunterWaitingDecision', ({ hunterName }) => {
      console.log("waitingForHunter3 ", waitingForHunter);
          // בדיקה אם הצייד כבר בחר
    const hunterChose = sessionStorage.getItem('hunterChoseTarget');
    if (hunterChose === 'true') {
      console.log('הצייד כבר בחר מטרה. הודעה נוספת לא תוצג.');
      return; // ביטול הודעה נוספת
    }
      setWaitingForHunter(true);
      setHunterName(hunterName);
      console.log("waitingForHunter4 ", waitingForHunter);
    });
  
    // הוספת בדיקה חוזרת במקרה שהשחקן מחובר מאוחר
    socket.emit('hunterCheckStatus', { playerName });
  
    return () => {
      socket.off('hunterWaitingDecision');
    };
  }, []);

  useEffect(() => {
    socket.on('hunterFinished', ({ hunterName, targetName, targetRole }) => {

      setWaitingForHunter(false);
      if (targetRole === "זקן השבט"){
        setHunterMessage([`הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}! \n מעכשיו ועד סוף המשחק לא יהיו לאזרחים כוחות בלילה`]); // הודעת הצייד

      } else {
        setHunterMessage([`הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}!`]); // הודעת הצייד

      }
      const storedName = sessionStorage.getItem('playerName');
  
            if (storedName === targetName) {
            // השחקן שנבחר - עדכון isAlive והעברה לעמוד DEAD
            sessionStorage.setItem('nightResults', JSON.stringify([
                `${hunterName} בתפקיד צייד החליט לצוד אותך!`,
            ]));
            window.dispatchEvent(new Event('gameNavigation'));
            window.history.pushState(null, '', '/dead'); // עדכון היסטוריה
            // העברה לעמוד DEAD
            window.location.href = '/dead';
        }
        else {
            if (targetRole === "זקן השבט"){
                sessionStorage.setItem('hunterResult', JSON.stringify([`הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}! \nמעכשיו ועד סוף המשחק לא יהיו לאזרחים כוחות בלילה`])); // שמירה
              } else {
                sessionStorage.setItem('hunterResult', JSON.stringify([`הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}!`])); // שמירה
              }
  
        }
        sessionStorage.setItem('hunterChoseTarget', 'true'); // סימון שהצייד בחר
    });
  
    return () => {
      socket.off('hunterFinished');
    };
  }, []);


  useEffect(() => {
    socket.on('hunterFinishedNoElder', () => {
        sessionStorage.setItem('hunterChoseTarget', 'true'); // סימון שהצייד בחר
        setWaitingForHunter(false);

    });
  
    return () => {
      socket.off('hunterFinishedNoElder');
    };
  }, []);

  // בחירה בשחקן
  const handleVote = (playerName) => {
    if (confirmed) { // אם הבחירה נעולה
      alert('הבחירה כבר נעולה! בטל את האישור כדי לשנות.');
      return;
    }
    setSelectedVote(playerName); // עדכון הבחירה
    socket.emit('submitVote', { 
      playerName: currentPlayer, 
      voteTarget: playerName 
    });
  };

  // אישור הבחירה
  const handleConfirm = () => {
    if (!selectedVote) {
      alert('חייב לבחור שחקן לפני לחיצה על "אשר בחירה"!');
      return;
    }
    setConfirmed(!confirmed); // נעילת הבחירה
    socket.emit('confirmVote', { 
      playerName: currentPlayer, 
      confirm: !confirmed 
    });

    if (!confirmed) {
      socket.emit('submitVote', { 
        playerName: currentPlayer, 
        voteTarget: selectedVote 
      });
    }
  };
  // useEffect(() => {
  //   socket.on('hunterMessage', (message) => {
  //     setHunterMessage(prevMessages => [...prevMessages, message]); // הוספת ההודעה
  //   });
  
  //   return () => {
  //     socket.off('hunterMessage'); // ניקוי מאזין בעת יציאה מהעמוד
  //   };
  // }, []);
  // מוכנות להמשך
  const handleReady = () => {
    socket.emit('checkGameStatus'); // בקשת בדיקת סיום המשחק
    setIsReady(!isReady);
    socket.emit('toggleVoteReady', { 
      playerName: currentPlayer, 
      isReady: !isReady 
    });
    socket.on('navigateToEndGame', () => {
      window.dispatchEvent(new Event('gameNavigation'));
      window.history.pushState(null, '', '/endgame'); // עדכון היסטוריה
      window.location.href = '/endgame';
    });

    socket.on('navigateToNight', () => {
      window.dispatchEvent(new Event('gameNavigation'));
      window.history.pushState(null, '', '/night'); // עדכון היסטוריה
      window.location.href = '/night';
    });
  };

  useEffect(() => {
    socket.on('playerDead', ({ playerName, role }) => {
      const myName = sessionStorage.getItem('playerName');
      if (playerName === myName) { // אם אני זה שהודח
        sessionStorage.setItem('nightResults', JSON.stringify([ `העיירה בחרה להדיח אותך בתפקיד ${role}`])); // שמירת הודעה
        window.dispatchEvent(new Event('gameNavigation'));
        window.history.pushState(null, '', '/dead'); // עדכון היסטוריה
        // sessionStorage.setItem('nightResults', `העיירה בחרה להדיח אותך בתפקיד ${role}`);
        window.location.href = '/dead'; // מעבר לעמוד המתים
      }
    });
  
    return () => {
      socket.off('playerDead');
    };
  }, []);

  useEffect(() => {
    socket.on('playerDeadCupid', ({ playerName, role, loverRole, loverName }) => {
      const myName = sessionStorage.getItem('playerName');
      if (playerName === myName) { // אם אני זה שהודח
        sessionStorage.setItem('nightResults', JSON.stringify([` העיירה החליטה להוציא את ${loverName} בתפקיד ${loverRole}`,
          `  יצאת מהמשחק בעקבות מותו של הנאהב ${loverName}!`])); // שמירת הודעה
        window.dispatchEvent(new Event('gameNavigation'));
        window.history.pushState(null, '', '/dead'); // עדכון היסטוריה
        // sessionStorage.setItem('nightResults', `העיירה בחרה להדיח אותך בתפקיד ${role}`);
        window.location.href = '/dead'; // מעבר לעמוד המתים
      }
    });
  
    return () => {
      socket.off('playerDeadCupid');
    };
  }, []);

  useEffect(() => {
    socket.on('playerDeadLover', ({ playerName, role, cupidName }) => {
      const myName = sessionStorage.getItem('playerName');
      if (playerName === myName) { // אם אני זה שהודח
        sessionStorage.setItem('nightResults', JSON.stringify([` העיירה החליטה להוציא את ${cupidName} בתפקיד קופידון`,
          ` יצאת מהמשחק בעקבות מותו של הקופידון ${cupidName}!`])); // שמירת הודעה
        window.dispatchEvent(new Event('gameNavigation'));
        window.history.pushState(null, '', '/dead'); // עדכון היסטוריה
        // sessionStorage.setItem('nightResults', `העיירה בחרה להדיח אותך בתפקיד ${role}`);
        window.location.href = '/dead'; // מעבר לעמוד המתים
      }
    });
  
    return () => {
      socket.off('playerDeadLover');
    };
  }, []);

  // סינון השחקן הנוכחי מהרשימה
  const filteredPlayers = players.filter(player => player.name !== currentPlayer);

  if (isLoading) {
    return <h1>טוען נתונים...</h1>;
  }
  
  return (
    <div>
    <TopBar role={role} />
    <div className="vote-page">

    <h1 className='role-title'>שלום {role}!</h1>
      {Object.keys(voteResults).length > 0 ? (
        <div>
      {selectedVote && selectedRole && (
        <>
          <h4>העיירה החליטה להוציא את {selectedVote} בתפקיד {selectedRole}</h4>
          {message.length > 0 && (
            message.map((msg, index) => (
              <h4 key={index}>{msg}</h4>
            ))
          )}
          {selectedRole === 'זקן השבט' && (
            <h4>מעכשיו ועד סוף המשחק לא יהיו לאזרחים כוחות בלילה.</h4>
          )}
        </>
      )}
            {hunterMessage.length > 0 && hunterChoseTarget && (
            hunterMessage.map((msg, index) => <h4 key={index}>{msg}</h4>)
            )}
            

            {!elderDead && waitingForHunter && (
            <h4>המתן בזמן ש- {hunterName} הצייד יחליט את מי לצוד...</h4>
            )}
        <h4>תוצאות ההצבעות:</h4>
          {Object.entries(voteResults).map(([player, count]) => (
                  <li key={player}>
                  <span>{player} קיבל {count} קולות</span>
                </li>          ))}

          <h4>בחירות אישיות:</h4>
          {personalVotes.map(({ voter, target }, index) => (
                    <li key={voter}>
                    <span>{voter} הצביע ל-{target}</span>
                  </li>
          ))}


        {(!waitingForHunter || elderDead) && (
          <button
            style={{ backgroundColor: isReady ? '#108f14' : '#7e1109'}}
            onClick={handleReady}
          >
            {isReady ? 'מצב - מוכן' : 'מצב - לא מוכן'}
          </button>
         )}

        </div>
      ) : (
        <>
        <h4>
        כעת העיירה יכולה לדון - 
        אם שחקן לא נבחר בסוף הזמן, הבחירה תהיה רנדומלית 
        </h4>
        <h3 className={isFlashing ? 'flashing-timer' : ''}>
          הזמן שנותר: {Math.floor(timeLeft / 60)}:{timeLeft % 60}
        </h3>
        <h3>
          בחר את מי אתה רוצה להוציא מהמשחק:
        </h3>

            {filteredPlayers.map((player) => (
            <button
                key={player.name}
                onClick={() => handleVote(player.name)}
                disabled={confirmed} // השבתה לאחר נעילה
                style={{
                backgroundColor: selectedVote === player.name ? 'darkred' : '#424442',
                }}
            >
                {player.name}
            </button>
            ))}
        <button
        style={{ backgroundColor: confirmed ? 'darkgreen' : 'darkred' }}
        onClick={handleConfirm}
        >
        {confirmed ? 'בטל נעילה' : 'אשר בחירה'}
        </button>
        </>
      )}
    </div>
    </div>
  );
}

export default VotePage;

