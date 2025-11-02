// EndGamePage.jsx
// Purpose: End-of-game screen. Displays final result, lists alive players and all roles,
// and allows returning to home + triggering a game reset (and optional server restart).
// Notes:
// - Logic preserved exactly; comments are concise and in English.
// - No code omitted.

import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('https://town-game-server.onrender.com');

function EndGamePage() {
  const [resultMessage, setResultMessage] = useState('');
  const [playersRoles, setPlayersRoles] = useState([]);
  const [alivePlayers, setAlivePlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch roles structure and track alive players; listen for gameEnd summary.
  useEffect(() => {
    socket.emit('requestRolesStructure');
    socket.on('rolesStructure', (rolesStructure) => {
      const rolesList = [];
      const aliveList = [];

      Object.entries(rolesStructure).forEach(([role, players]) => {
        players.forEach((player) => {
          rolesList.push({ name: player.name, role }); // Build full list of {name, role}
          if (player.isAlive) {
            aliveList.push({ name: player.name, role }); // Alive-only list
          }
        });
      });

      setPlayersRoles(rolesList);
      setAlivePlayers(aliveList);
      setIsLoading(false);
    });

    socket.on('gameEnd', (result) => {
      console.log('Game Ended:', result);
      sessionStorage.setItem('gameResult', result); // Persist end result
    });

    return () => {
      socket.off('rolesStructure');
      socket.off('gameEnd');
    };
  }, []);

  // Restore end result from sessionStorage (if already stored earlier)
  useEffect(() => {
    const result = sessionStorage.getItem('gameResult');
    if (result) {
      setResultMessage(result);
    }
  }, []);

  // Reset game flow: emit reset, optionally request server restart if current player is "firstPlayer",
  // and always navigate back to home.
  const handleResetGame = () => {
    const firstPlayer = sessionStorage.getItem('firstPlayer');
    const currentPlayer = sessionStorage.getItem('playerName');

    socket.emit('resetGame');
    if (firstPlayer === currentPlayer) {
      socket.emit('restartServer');
    }

    // Navigate home regardless
    window.dispatchEvent(new Event('gameNavigation'));
    window.history.pushState(null, '', '/');
    window.location.href = '/';
  };

  if (isLoading) {
    return <h1>טוען נתונים...</h1>;
  }

  return (
    <div className="end-game-page">
      <h1>המשחק נגמר!</h1>
      <br />
      <h2>{resultMessage}</h2>
      <br />
      <h3>רשימת השחקנים החיים:</h3>
      <br />

      <ul>
        {alivePlayers.map((player, index) => (
          <li key={index}>
            השחקן {player.name} היה בתפקיד {player.role}
          </li>
        ))}
      </ul>

      <br />
      <h3>רשימת כל השחקנים והתפקידים:</h3>
      <br />

      <ul>
        {playersRoles.map((player, index) => (
          <li key={index}>
            השחקן {player.name} היה בתפקיד {player.role}.
          </li>
        ))}
      </ul>

      <br />
      {/* Reset game button */}
      <button onClick={handleResetGame} style={{ marginTop: '20px' }}>
        חזרה לדף הבית והתחלת משחק חדש
      </button>
    </div>
  );
}

export default EndGamePage;
