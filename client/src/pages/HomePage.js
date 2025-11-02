// HomePage.jsx
// Purpose: Lobby/home screen. Handles player join, first-player (host) detection,
// players list updates, and navigation to settings once enough players joined.
// Notes:
// - Logic preserved exactly; only comments translated and tightened.
// - No code omitted.

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import io from 'socket.io-client';

const socket = io('https://town-game-server.onrender.com');

function HomePage() {
  const [playerName, setPlayerName] = useState(sessionStorage.getItem('playerName') || '');
  const [players, setPlayers] = useState([]);
  const [isFirstPlayer, setIsFirstPlayer] = useState(false);
  const [isJoined, setIsJoined] = useState(!!sessionStorage.getItem('playerName'));
  const navigate = useNavigate();
  const location = useLocation();
  const [roomId, setRoomId] = useState('');

  // Fire a navigation event and normalize history to home (kept as original behavior)
  window.dispatchEvent(new Event('gameNavigation'));
  window.history.pushState(null, '', '/'); // history update

  // -----------------------------------------
  // (Optional) Room support via URL parameter
  // -----------------------------------------
  // useEffect(() => {
  //   // Extract roomId from URL
  //   const queryParams = new URLSearchParams(location.search);
  //   const room = queryParams.get('room');
  //   setRoomId(room);
  //
  //   // Join room if provided
  //   if (room) {
  //     socket.emit('joinRoom', { roomId: room });
  //   }
  // }, [location.search]);

  useEffect(() => {
    // Reset session data if game was restarted and we returned to home
    const isRestart = sessionStorage.getItem('restartGame');
    if (isRestart) {
      sessionStorage.clear();
      sessionStorage.setItem('settings', settings); // keep settings only (as in original)
      sessionStorage.removeItem('restartGame');     // clear the restart flag
    }

    socket.emit('requestPlayers');

    return () => {
      socket.off('clearLocalStorage');
    };
  }, []);

  useEffect(() => {
    // Server requests client to clear local storage and reset lobby state
    socket.on('clearLocalStorage', () => {
      sessionStorage.clear();
      setPlayerName('');
      setIsJoined(false);
    });

    // Handle "name already taken" error from server
    const handleNameTaken = (message) => {
      setPlayerName('');     // clear input
      setIsJoined(false);    // allow entering a new name
      alert(message);        // show server message
    };

    socket.off('nameTaken'); // avoid duplicate listeners
    socket.on('nameTaken', handleNameTaken);

    // Update players list from server
    socket.on('updatePlayers', (playersList) => {
      setPlayers(playersList);
      sessionStorage.setItem('playersNumber', playersList.length);
    });

    // Identify first player (host) based on server signal
    socket.on('setFirstPlayer', (firstPlayer) => {
      console.log('First Player:', firstPlayer);
      sessionStorage.setItem('firstPlayer', firstPlayer);
      setIsFirstPlayer(firstPlayer === playerName);
    });

    // Navigate to settings when the server says so
    socket.on('navigateToSettings', () => {
      window.dispatchEvent(new Event('gameNavigation'));
      window.history.pushState(null, '', '/settings'); // history update
      navigate('/settings');
    });

    // Request current players (also on location change)
    socket.emit('requestPlayers');

    // Cleanup listeners
    return () => {
      socket.off('clearLocalStorage');
      socket.off('nameExists');      // original cleanup retained
      socket.off('updatePlayers');
      socket.off('setFirstPlayer');
      socket.off('navigateToSettings');
    };
  }, [playerName, navigate]);

  const handleNameChange = (e) => {
    if (!isJoined) {
      setPlayerName(e.target.value);
    }
  };

  const handleJoinGame = () => {
    if (!playerName.trim()) {
      alert('אנא הכנס שם תקין.');
      return;
    }

    if (!isJoined) {
      // Persist player name
      sessionStorage.setItem('playerName', playerName);

      // Send join request to server
      socket.emit('joinGame', playerName);

      setIsJoined(true);
    }
  };

  const handleSettingsClick = () => {
    // TODO Cange to 4  (kept verbatim)
    if (players.length < 4) {
      alert('על מנת להתחיל את המשחק יש צורך בלפחות 4 שחקנים.');
      return;
    }
    if (isFirstPlayer) {
      socket.emit('startGame');
    }
  };

  return (
    <div className="home-page">
      <h1 className="title">העיירה</h1>

      <div className="input-container">
        <input
          type="text"
          id="player-name"
          value={playerName}
          onChange={handleNameChange}
          placeholder="הכנס שם"
          disabled={isJoined}
        />
      </div>

      <button
        onClick={handleJoinGame}
        disabled={isJoined || !playerName.trim()}
      >
        {isJoined ? 'הצטרפת למשחק' : 'הצטרף למשחק'}
      </button>

      {/* <h2>חדר: {roomId}</h2> */}
      <h2>השחקן הראשון שיצטרף, יהיה מנהל המשחק.</h2>

      <h2>{players.length} שחקנים נמצאים במשחק:</h2>

      <ul>
        {players.map((player, index) => (
          <li key={index}>{player.name}</li>
        ))}
      </ul>

      {isFirstPlayer && isJoined && (
        <button onClick={handleSettingsClick}>
          הגדרות המשחק
        </button>
      )}
    </div>
  );
}

export default HomePage;
