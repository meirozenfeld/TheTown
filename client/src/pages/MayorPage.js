import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import TopBar from '../components/topBar'; // נתיב לקובץ topBar.js

const socket = io('https://town-game-server.onrender.com');

function MayorPage() {
  const [players, setPlayers] = useState([]);
  const [selectedMayor, setSelectedMayor] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [mayorName, setMayorName] = useState('');
  const [votes, setVotes] = useState({});
  const [isReady, setIsReady] = useState(false);
  const [personalVotes, setPersonalVotes] = useState(false);
  const [role, setRole] = useState('');
  const storedName = sessionStorage.getItem('playerName');
  const [isLoading, setIsLoading] = useState(true);
  const [locked, setLocked] = useState(false); // מצב נעילה
  const [timeLeft, setTimeLeft] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    // בקשה ל-towntime מהשרת
    socket.emit('requestSettings');
    socket.on('settingsReceived', (settings) => {
      console.log('Settings received Vote:', settings);
      const mayorTimeInSeconds = settings.mayorTime * 60; // המרה לשניות
      setTimeLeft(mayorTimeInSeconds);
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
    } else if (!locked && !selectedMayor && players.length > 0) {
      // בחירה רנדומלית אם הזמן נגמר
      const currentPlayer = sessionStorage.getItem('playerName'); // שם השחקן הנוכחי

      const filteredPlayersTime = players.filter(player => player.name !== currentPlayer);

      const randomPlayer = filteredPlayersTime[Math.floor(Math.random() * players.length)];
      setSelectedMayor(randomPlayer.name);
      setLocked(true);
    socket.emit('mayorVote', { playerName: currentPlayer, targetName: randomPlayer.name });
    socket.emit('confirmMayorVote', { 
      playerName: currentPlayer, 
      confirm: true // שליחת מצב הנעילה
    });
  
    socket.emit('checkAllMayorConfirmed'); // בדיקה אם כולם אישרו בחירה
    }
  }, [timeLeft, locked, selectedMayor, players]);

  useEffect(() => {
    socket.emit('requestRolesStructure'); // בקשה לקבלת מבנה התפקידים
    
    socket.on('rolesStructure', (rolesStructure) => {
      const alivePlayers = Object.values(rolesStructure)
        .flat()
        .filter(p => p.isAlive);
  
      const currentPlayer = sessionStorage.getItem('playerName'); // שם השחקן הנוכחי
      const filteredPlayers = alivePlayers.filter(p => p.name !== currentPlayer); // סינון השחקן הנוכחי
      setPlayers(filteredPlayers);
      setIsLoading(false);
    });
  
      // האזנה למבנה התפקידים
      socket.on('rolesStructure', (rolesStructure) => {
        const player = Object.values(rolesStructure)
          .flat()
          .find(p => p.name === storedName);
    
        if (player) {
          const roleName = Object.entries(rolesStructure).find(([_, players]) =>
            players.includes(player)
          )[0];
          setRole(roleName);
        }
      });

  // מאזין לעדכון בחירת ראש העיר
  socket.on('mayorElected', ({ mayorName, votes, personalVotes }) => {
    console.log('בחירת ראש העיר התקבלה:', mayorName, votes, personalVotes); 
    setMayorName(mayorName); // עדכון ראש העיר
    setVotes(votes);         // עדכון תוצאות ההצבעה
    setPersonalVotes(personalVotes); // שמירת הצבעות אישיות
  });
  

    return () => {
      socket.off('rolesStructure');
      socket.off('mayorElected');

    };
  }, []);
  
  useEffect(() => {
    socket.on('navigateToVote', () => {
      console.log('קיבלנו אירוע מעבר ל-VotePage'); // לוודא שהאירוע מתקבל
      window.dispatchEvent(new Event('gameNavigation'));
      window.history.pushState(null, '', '/vote'); // עדכון היסטוריה
      window.location.href = '/vote'; // מעבר לעמוד ההצבעות
    });
  
    return () => {
      socket.off('navigateToVote'); // ניקוי מאזין
    };
  }, []);
  
  const handleVote = (playerName) => {
    setSelectedMayor(playerName); // בחירת שחקן
    socket.emit('mayorVote', { playerName: sessionStorage.getItem('playerName'), targetName: playerName });
  };

  const handleConfirm = () => {
    if (!selectedMayor && !locked) { // אם השחקן לא בחר ראש עיר ולא נעול
      alert('עליך לבחור ראש עיר לפני לחיצה על "נעל בחירה"!');
      return;
    }
  
    const newLockedState = !locked; // שינוי מצב הנעילה
    setLocked(newLockedState); // עדכון מצב הנעילה
    socket.emit('confirmMayorVote', { 
      playerName: sessionStorage.getItem('playerName'), 
      confirm: newLockedState // שליחת מצב הנעילה
    });
  
    socket.emit('checkAllMayorConfirmed'); // בדיקה אם כולם אישרו בחירה
  };
  
  

  const handleReady = () => {
    const newReadyState = !isReady;
    setIsReady(newReadyState);
  
    // שליחת עדכון מוכנות לשרת
    socket.emit('toggleMayorReady', { 
      playerName: sessionStorage.getItem('playerName'), 
      isReady: newReadyState 
    });
  
    // קריאה לבדיקה האם כל השחקנים מוכנים
    socket.emit('checkAllMayorReady');
  };
  
  if (isLoading) {
    return <h1>טוען נתונים...</h1>;
  }
  return (
    <div>
    <TopBar role={role} />
    <div className={`mayor-page ${mayorName ? 'mayor-selected' : ''}`}>
     <h1>שלום {role}!</h1>
      {mayorName ? (
        <div className={`mayor-page ${mayorName ? 'mayor-selected' : ''}`}>
          <h2>ראש העיר הנבחר הוא {mayorName}</h2>
          <br></br>
                  <h2>ספירת קולות:</h2>
                  <ul className="votes-list">
                {Object.entries(votes).map(([player, count]) => (
                  <li key={player}>
                    <span>{player} קיבל {count} קולות</span>
                  </li>
                ))}
              </ul>

              <h2>בחירות אישיות:</h2>
              <ul className="votes-list" >
                  {Object.entries(personalVotes).map(([voter, target]) => (
                    <li key={voter}>
                      <span>{voter} הצביע ל-{target}</span>
                    </li>
                  ))}
                </ul>

          <button
            style={{ backgroundColor: isReady ? '#108f14' : '#7e1109' }}
            onClick={handleReady}
          >
            {isReady ? 'במצב - מוכן' : 'במצב - לא מוכן'}
        </button>
        </div>
      ) : (
        <>
        <br></br>
        <h2>
        כעת העיירה יכולה לדון בבחירות לראש העיר - 
        אם שחקן לא נבחר בסוף הזמן, הבחירה תהיה רנדומלית 
        </h2>
        <h2 className={isFlashing ? 'flashing-timer-mayor' : ''}>
          הזמן שנותר: {Math.floor(timeLeft / 60)}:{timeLeft % 60}
        </h2>
        <h2>בחר ראש עיר שיקבל 2 קולות בהצבעת העיירה:</h2>
        <br></br>

        {players.map((player) => (
          <button
            key={player.name}
            onClick={() => handleVote(player.name)}
            disabled={locked} // כפתור יושבת אם במצב נעול
            style={{
              backgroundColor: selectedMayor === player.name ? 'darkblue' : '#424442',
              cursor: locked ? 'not-allowed' : 'pointer', // חץ עכבר משתנה בהתאם למצב הנעילה
            }}
          >
            {player.name}
          </button>
        ))}
        <br />

        <button
          style={{
            backgroundColor: locked ? '#7e1109' : '#424442', // ירוק - נעול, אדום - פתוח
            cursor: 'pointer',
          }}
          onClick={handleConfirm}
        >
          {locked ? 'בחירה נעולה' : 'נעל בחירה'} {/* שינוי טקסט דינמי */}
        </button>

        </>
      )}
    </div>
</div>

  );
  
}

export default MayorPage;
