import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import TopBar from '../components/topBar'; // נתיב לקובץ topBar.js

const socket = io('http://localhost:5000');

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
        sessionStorage.setItem('hunterChoseTarget', 'true'); // סימון שהצייד בחר

      setWaitingForHunter(false);
      if (targetRole === "זקן השבט"){
        setHunterMessage([`הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}! \n מעכשיו ועד סוף המשחק לא יהיו לאזרחים תפקידים בלילה`]); // הודעת הצייד

      } else {
        setHunterMessage([`הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}!`]); // הודעת הצייד

      }
      const storedName = sessionStorage.getItem('playerName');
  
            if (storedName === targetName) {
            // השחקן שנבחר - עדכון isAlive והעברה לעמוד DEAD
            sessionStorage.setItem('nightResults', JSON.stringify([
                `${hunterName} בתפקיד צייד החליט לצוד אותך!`,
            ]));
  
            // העברה לעמוד DEAD
            window.location.href = '/dead';
        }
        else {
            if (targetRole === "זקן השבט"){
                sessionStorage.setItem('hunterResult', JSON.stringify([`הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}! \nמעכשיו ועד סוף המשחק לא יהיו לאזרחים תפקידים בלילה`])); // שמירה
              } else {
                sessionStorage.setItem('hunterResult', JSON.stringify([`הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}!`])); // שמירה
              }
  
        }
    });
  
    return () => {
      socket.off('hunterFinished');
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

  // מוכנות להמשך
  const handleReady = () => {
    setIsReady(!isReady);
    socket.emit('toggleVoteReady', { 
      playerName: currentPlayer, 
      isReady: !isReady 
    });

    socket.on('navigateToNight', () => {
      window.location.href = '/night';
    });
  
    socket.on('navigateToEndGame', () => {
      window.location.href = '/endgame';
    });
  };

  useEffect(() => {
    socket.on('playerDead', ({ playerName, role }) => {
      const myName = sessionStorage.getItem('playerName');
      if (playerName === myName) { // אם אני זה שהודח
        sessionStorage.setItem('nightResults', JSON.stringify([ `העיירה בחרה להדיח אותך בתפקיד ${role}`])); // שמירת הודעה

        // sessionStorage.setItem('nightResults', `העיירה בחרה להדיח אותך בתפקיד ${role}`);
        window.location.href = '/dead'; // מעבר לעמוד המתים
      }
    });
  
    return () => {
      socket.off('playerDead');
    };
  }, []);
  
  // סינון השחקן הנוכחי מהרשימה
  const filteredPlayers = players.filter(player => player.name !== currentPlayer);

  return (
    <div>
     <TopBar role={role} />

    <h1>שלום {role}!</h1>

      {Object.keys(voteResults).length > 0 ? (
        <div>
      {selectedVote && selectedRole && (
        <>
          <h2>העיירה החליטה להוציא את {selectedVote} בתפקיד {selectedRole}</h2>
          {selectedRole === 'זקן השבט' && (
            <p>מעכשיו ועד סוף המשחק לא יהיו לאזרחים תפקידים בלילה.</p>
          )}
        </>
      )}
        <h2>תוצאות ההצבעות:</h2>
          {Object.entries(voteResults).map(([player, count]) => (
            <p key={player}>{player} קיבל {count} קולות</p>
          ))}

          <h3>בחירות אישיות:</h3>
          {personalVotes.map(({ voter, target }, index) => (
            <p key={index}>{voter} הצביע ל-{target}</p>
          ))}
            {/* הצגת הודעת הצייד */}
            {hunterMessage.length > 0 && !hunterChoseTarget && (
            hunterMessage.map((msg, index) => <p key={index}>{msg}</p>)
            )}

            {!elderDead && waitingForHunter && (
            <p>המתן בזמן ש- {hunterName} הצייד יחליט את מי לצוד...</p>
            )}

          {!waitingForHunter && (
          <button
            style={{ backgroundColor: isReady ? 'green' : 'red' }}
            onClick={handleReady}
          >
            {isReady ? 'מצב - מוכן' : 'מצב - לא מוכן'}
          </button>
         )}

        </div>
      ) : (
        <>
        <h1>בחר את מי אתה רוצה להוציא מהמשחק:</h1>

            {filteredPlayers.map((player) => (
            <button
                key={player.name}
                onClick={() => handleVote(player.name)}
                disabled={confirmed} // השבתה לאחר נעילה
                style={{
                backgroundColor: selectedVote === player.name ? 'red' : 'green',
                }}
            >
                {player.name}
            </button>
            ))}
        <button
        style={{ backgroundColor: confirmed ? 'green' : 'red' }}
        onClick={handleConfirm}
        >
        {confirmed ? 'בטל נעילה' : 'אשר בחירה'}
        </button>
        </>
      )}
    </div>
  );
}

export default VotePage;
