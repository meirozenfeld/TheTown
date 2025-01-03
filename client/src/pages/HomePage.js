import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

function HomePage() {
  const [playerName, setPlayerName] = useState(sessionStorage.getItem('playerName') || '');
  const [players, setPlayers] = useState([]);
  const [isFirstPlayer, setIsFirstPlayer] = useState(false);
  const [isJoined, setIsJoined] = useState(!!sessionStorage.getItem('playerName'));
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // איפוס המידע אם המשחק הסתיים וחזרנו לדף הבית
    const isRestart = sessionStorage.getItem('restartGame');
    if (isRestart) {
        sessionStorage.clear();
        sessionStorage.setItem('settings', settings); // שמירת ההגדרות בלבד
        sessionStorage.removeItem('restartGame'); // מחיקה של הדגל
    }

    socket.emit('requestPlayers');

    return () => {
        socket.off('clearLocalStorage');
    };
}, []);


  useEffect(() => {
    // Clear sessionStorage and reset state
    socket.on('clearLocalStorage', () => {
      sessionStorage.clear();
      setPlayerName('');
      setIsJoined(false);
    });

  // Handle name existence error
  const handleNameTaken = (message) => {
    setPlayerName(''); // ניקוי השם בתיבת הטקסט
    setIsJoined(false); // אפשר להקליד שם חדש
    alert(message); // הצגת הודעה
  };

  socket.off('nameTaken'); // הסר מאזינים קודמים
  socket.on('nameTaken', handleNameTaken); // הוסף מאזין חדש

    // Update players list
    socket.on('updatePlayers', (playersList) => {
      setPlayers(playersList);
    });

    // Handle 'setFirstPlayer' event
    socket.on('setFirstPlayer', (firstPlayer) => {
      console.log('First Player:', firstPlayer); // בדיקה אם האירוע מתקבל
      setIsFirstPlayer(firstPlayer === playerName); // בדיקה אם המשתמש הוא המנהל
    });

    // Navigations
    socket.on('navigateToSettings', () => {
      navigate('/settings');
    });

    // Request current players on location change
    socket.emit('requestPlayers');

    // Cleanup
    return () => {
      socket.off('clearLocalStorage');
      socket.off('nameExists');
      socket.off('updatePlayers');
      socket.off('setFirstPlayer');
      socket.off('navigateToSettings');
    };
  }, [playerName]);

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
      // שמירה ב-Session Storage
      sessionStorage.setItem('playerName', playerName);
      
      // שליחת שם לשרת
      socket.emit('joinGame', playerName);
  
      setIsJoined(true);
    }
  };

  const handleSettingsClick = () => {
    //TODO Cange to 4
    if (players.length < 3) {
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
        <label htmlFor="player-name">שם השחקן:</label>
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
