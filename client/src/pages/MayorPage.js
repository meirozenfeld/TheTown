import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import TopBar from '../components/topBar'; // נתיב לקובץ topBar.js

const socket = io('http://localhost:5000');

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

  useEffect(() => {
    socket.emit('requestRolesStructure'); // בקשה לקבלת מבנה התפקידים
    
    socket.on('rolesStructure', (rolesStructure) => {
      const alivePlayers = Object.values(rolesStructure)
        .flat()
        .filter(p => p.isAlive);
  
      const currentPlayer = sessionStorage.getItem('playerName'); // שם השחקן הנוכחי
      const filteredPlayers = alivePlayers.filter(p => p.name !== currentPlayer); // סינון השחקן הנוכחי
      setPlayers(filteredPlayers);
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
    if (!selectedMayor) { // אם השחקן לא בחר ראש עיר
      alert('עליך לבחור ראש עיר לפני לחיצה על "אשר בחירה"!');
      return;
    }
  
    setConfirmed(!confirmed);
    socket.emit('confirmMayorVote', { 
      playerName: sessionStorage.getItem('playerName'), 
      confirm: !confirmed 
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
  

  return (
    <div>
              <TopBar role={role} />

    <h1>שלום {role}!</h1>
      {mayorName ? (
        <div>
          <h2>ראש העיר הנבחר הוא {mayorName}</h2>
            <h3>תוצאות ההצבעות:</h3>
            <ul>
            {Object.entries(votes).map(([player, count]) => (
                <li key={player}>
                {player} קיבל {count} קולות
                </li>
            ))}
            </ul>
            <h3>בחירות אישיות:</h3>
            <ul>
            {Object.entries(personalVotes).map(([voter, target]) => (
                <li key={voter}>
                {voter} הצביע ל-{target}
                </li>
            ))}
            </ul>

          <button
            style={{ backgroundColor: isReady ? 'green' : 'red' }}
            onClick={handleReady}
          >
            {isReady ? 'מצב - מוכן' : 'מצב - לא מוכן'}
          </button>
        </div>
      ) : (
        <>
        <h1>בחר ראש עיר שיקבל 2 קולות בהצבעת העיירה:</h1>

          {players.map((player) => (
            <button
              key={player.name}
              onClick={() => handleVote(player.name)}
              style={{
                backgroundColor: selectedMayor === player.name ? 'blue' : 'red',
              }}
            >
              {player.name}
            </button>
          ))}
          <button
            style={{ backgroundColor: confirmed ? 'green' : 'red' }}
            onClick={handleConfirm}
          >
            אשר בחירה
          </button>
        </>
      )}
    </div>
  );
}

export default MayorPage;
