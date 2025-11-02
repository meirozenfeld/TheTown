// MayorPage.jsx
// Purpose: Mayor election phase.
// Responsibilities:
// - Fetch settings for countdown timer
// - Build alive players list (excluding current player)
// - Handle vote selection, confirmation lock, readiness toggle
// - Display elected mayor, vote tally, and personal votes
// - Navigate to Vote page once the server triggers it
// Notes:
// * Logic preserved exactly. Comments are concise and in English.
// * No code omitted.

import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import TopBar from '../components/topBar'; // Path to topBar.js

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
  const [locked, setLocked] = useState(false); // Lock state after confirm
  const [timeLeft, setTimeLeft] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);

  // Request settings (for mayor time) and initialize countdown
  useEffect(() => {
    socket.emit('requestSettings');
    socket.on('settingsReceived', (settings) => {
      console.log('Settings received Vote:', settings);
      const mayorTimeInSeconds = settings.mayorTime * 60; // minutes -> seconds
      setTimeLeft(mayorTimeInSeconds);
    });

    return () => {
      socket.off('settingsReceived');
    };
  }, []);

  // Countdown + auto-random selection if time runs out (excluding current player)
  useEffect(() => {
    if (timeLeft > 0) {
      if (timeLeft <= 10) {
        setIsFlashing(true);
      } else {
        setIsFlashing(false);
      }
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (!locked && !selectedMayor && players.length > 0) {
      // Random pick when time is up (avoid self-pick)
      const currentPlayer = sessionStorage.getItem('playerName');
      const filteredPlayersTime = players.filter(player => player.name !== currentPlayer);

      const randomPlayer = filteredPlayersTime[Math.floor(Math.random() * players.length)];
      setSelectedMayor(randomPlayer.name);
      setLocked(true);

      socket.emit('mayorVote', { playerName: currentPlayer, targetName: randomPlayer.name });
      socket.emit('confirmMayorVote', { 
        playerName: currentPlayer, 
        confirm: true
      });
      socket.emit('checkAllMayorConfirmed');
    }
  }, [timeLeft, locked, selectedMayor, players]);

  // Build list of alive players (excluding current player) and detect current role
  useEffect(() => {
    socket.emit('requestRolesStructure');
    
    socket.on('rolesStructure', (rolesStructure) => {
      const alivePlayers = Object.values(rolesStructure)
        .flat()
        .filter(p => p.isAlive);

      const currentPlayer = sessionStorage.getItem('playerName');
      const filteredPlayers = alivePlayers.filter(p => p.name !== currentPlayer);
      setPlayers(filteredPlayers);
      setIsLoading(false);
    });
  
    // Derive current player's role
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

    // Listen for final mayor decision and votes
    socket.on('mayorElected', ({ mayorName, votes, personalVotes }) => {
      console.log('בחירת ראש העיר התקבלה:', mayorName, votes, personalVotes); 
      setMayorName(mayorName);
      setVotes(votes);
      setPersonalVotes(personalVotes);
    });

    return () => {
      socket.off('rolesStructure');
      socket.off('mayorElected');
    };
  }, []);

  // Navigate to Vote page when server triggers transition
  useEffect(() => {
    socket.on('navigateToVote', () => {
      console.log('קיבלנו אירוע מעבר ל-VotePage');
      window.dispatchEvent(new Event('gameNavigation'));
      window.history.pushState(null, '', '/vote');
      window.location.href = '/vote';
    });
  
    return () => {
      socket.off('navigateToVote');
    };
  }, []);
  
  // Select candidate for mayor
  const handleVote = (playerName) => {
    setSelectedMayor(playerName);
    socket.emit('mayorVote', { playerName: sessionStorage.getItem('playerName'), targetName: playerName });
  };

  // Confirm/lock vote (toggle). If no selection and not locked, block with alert.
  const handleConfirm = () => {
    if (!selectedMayor && !locked) {
      alert('עליך לבחור ראש עיר לפני לחיצה על "נעל בחירה"!');
      return;
    }
  
    const newLockedState = !locked;
    setLocked(newLockedState);
    socket.emit('confirmMayorVote', { 
      playerName: sessionStorage.getItem('playerName'), 
      confirm: newLockedState
    });
    socket.emit('checkAllMayorConfirmed');
  };

  // Toggle "ready" state for server coordination after mayor is elected
  const handleReady = () => {
    const newReadyState = !isReady;
    setIsReady(newReadyState);
  
    socket.emit('toggleMayorReady', { 
      playerName: sessionStorage.getItem('playerName'), 
      isReady: newReadyState 
    });

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
            <br />
            <h2>ספירת קולות:</h2>
            <ul className="votes-list">
              {Object.entries(votes).map(([player, count]) => (
                <li key={player}>
                  <span>{player} קיבל {count} קולות</span>
                </li>
              ))}
            </ul>

            <h2>בחירות אישיות:</h2>
            <ul className="votes-list">
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
            <br />
            <h2>
              כעת העיירה יכולה לדון בבחירות לראש העיר - 
              אם שחקן לא נבחר בסוף הזמן, הבחירה תהיה רנדומלית 
            </h2>

            <h2 className={isFlashing ? 'flashing-timer-mayor' : ''}>
              הזמן שנותר: {Math.floor(timeLeft / 60)}:{timeLeft % 60}
            </h2>

            <h2>בחר ראש עיר שיקבל 2 קולות בהצבעת העיירה:</h2>
            <br />

            {players.map((player) => (
              <button
                key={player.name}
                onClick={() => handleVote(player.name)}
                disabled={locked}
                style={{
                  backgroundColor: selectedMayor === player.name ? 'darkblue' : '#424442',
                  cursor: locked ? 'not-allowed' : 'pointer',
                }}
              >
                {player.name}
              </button>
            ))}

            <br />

            <button
              style={{
                backgroundColor: locked ? '#7e1109' : '#424442',
                cursor: 'pointer',
              }}
              onClick={handleConfirm}
            >
              {locked ? 'בחירה נעולה' : 'נעל בחירה'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default MayorPage;
