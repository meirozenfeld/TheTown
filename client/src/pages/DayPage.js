import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import TopBar from '../components/topBar'; // נתיב לקובץ topBar.js

const socket = io('https://town-game-server.onrender.com');

function DayPage() {
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
  const [isReady, setIsReady] = useState(false); // מצב מוכנות
  const [elderDead, setElderDead] = useState(false); // מצב זקן השבט
  const hunterChoseTarget = sessionStorage.getItem('hunterChoseTarget');

  const toggleReady = () => {
    const newReadyState = !isReady;
    setIsReady(newReadyState);

    socket.emit('toggleReadyDay', {
        playerName,
        isReadyDay: newReadyState,
    });
};

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
    // עדכון isFirstNight ל-FALSE
    sessionStorage.setItem('isFirstNight', 'false');
    console.log('isFirstNight set to FALSE in sessionStorage');
  const storedName = sessionStorage.getItem('playerName');
  if (storedName) setPlayerName(storedName);

  // האזנה לנווטים מהשרת
  socket.on('navigateToEndGame', () => {
      window.location.href = '/endgame';
  });

  socket.on('navigateToVote', () => {
      window.location.href = '/vote';
  });

  socket.on('navigateToMayor', () => {
      window.location.href = '/mayor';
  });

  return () => {
      socket.off('navigateToEndGame');
      socket.off('navigateToVote');
      socket.off('navigateToMayor');
  };
}, []);

  useEffect(() => {
    const savedMessages = sessionStorage.getItem('nightResults'); // תוצאות הלילה
    const hunterMessage = sessionStorage.getItem('hunterResult'); // תוצאת הצייד
    
    if (savedMessages) {
      setMessage(JSON.parse(savedMessages)); // שחזור הודעות הלילה
    }
    if (hunterMessage) {
      setHunterMessage(JSON.parse(hunterMessage)); // שחזור הודעת הצייד
    }
  }, []);

  useEffect(() => {
    console.log("waitingForHunter1 ", waitingForHunter);

    const storedName = sessionStorage.getItem('playerName');
    if (storedName) {
      setPlayerName(storedName);
    }
    socket.emit('requestRolesStructure'); // בקשה ראשונית לתפקיד

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
  
        if (!player.isAlive) {
          setIsAlive(false); // השחקן מת
        }
      }
    });

    socket.on('gameEnd', (result) => {
      console.log('Game Ended:', result);
      sessionStorage.setItem('gameResult', result); // שמירת התוצאה בזיכרון
  });


  return () => {
    socket.off('rolesStructure');
    socket.off('gameEnd');
  };
}, []); // פועל פעם אחת בלבד

  // האזנה להודעת תוצאות הלילה
  useEffect(() => {
    console.log("waitingForHunter2 ", waitingForHunter);
    const storedName = sessionStorage.getItem('playerName');
    socket.emit('currentPlayer', storedName); // שליחת בקשה לעיבוד מחדש של תוצאות הלילה

    socket.emit('requestNightResults'); // שליחת בקשה לעיבוד מחדש של תוצאות הלילה
    socket.on('nightResult', (resultMessage) => {
      console.log('תוצאות הלילה התקבלו מהשרת:', resultMessage);
      const messagesArray = resultMessage.split('\n');
      setMessage(messagesArray); // הצגה מיידית של התוצאות
      
      // שמירת ההודעות ב-sessionStorage עבור דף ה-Dead
      sessionStorage.setItem('nightResults', JSON.stringify(messagesArray));

    });
    socket.emit('checkGameStatus'); // בקשת בדיקת סיום המשחק

  
    return () => {
      socket.off('currentPlayer');
      socket.off('requestNightResults');
      socket.off('nightResult');
      socket.off('checkGameStatus');
    };
  }, []);

  // מעבר אוטומטי לעמוד DeadPage אם השחקן מת
  useEffect(() => {
    if (!isAlive) {
        window.location.href = '/dead';
    }
 }, [isAlive]);

// מאזין להודעות העברה
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
    setHunterMessage([`הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}!`]); // הודעת הצייד
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
        sessionStorage.setItem('hunterResult', JSON.stringify([`הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}!`])); // שמירה

      }
  });

  return () => {
    socket.off('hunterFinished');
  };
}, []);


return (
  <div className="day-page">
          <TopBar role={role} />

    <h1>בוקר טוב {role}!</h1>
    
    {/* הצגת תוצאות הלילה */}
    {message.length > 0 && (
      message.map((msg, index) => <p key={index}>{msg}</p>)
    )}

    {/* הצגת הודעת הצייד */}
    {hunterMessage.length > 0 && !hunterChoseTarget && (
      hunterMessage.map((msg, index) => <p key={index}>{msg}</p>)
    )}

    {!elderDead && waitingForHunter && (
      <p>המתן בזמן ש- {hunterName} הצייד יחליט את מי לצוד...</p>
    )}

    {/* הצגת כפתור מוכן רק אם לא מחכים לצייד */}
    {!waitingForHunter && (
      <button
        style={{ backgroundColor: isReady ? 'green' : 'red' }}
        onClick={toggleReady}
      >
        {isReady ? 'מצב - מוכן' : 'מצב - לא מוכן'}
      </button>
    )}


  </div>
);

}

export default DayPage;
