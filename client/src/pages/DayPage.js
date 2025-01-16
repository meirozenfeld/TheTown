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
  const [isLoading, setIsLoading] = useState(true);

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
    window.dispatchEvent(new Event('gameNavigation'));
    window.history.pushState(null, '', '/endgame'); // עדכון היסטוריה


      window.location.href = '/endgame';
  });

  socket.on('navigateToVote', () => {
    window.dispatchEvent(new Event('gameNavigation'));
    socket.emit('checkGameStatus'); // בקשת בדיקת סיום המשחק
    window.history.pushState(null, '', '/vote'); // עדכון היסטוריה

      window.location.href = '/vote';
  });

  socket.on('navigateToMayor', () => {
    socket.emit('checkGameStatus'); // בקשת בדיקת סיום המשחק
    window.dispatchEvent(new Event('gameNavigation'));
    window.history.pushState(null, '', '/mayor'); // עדכון היסטוריה

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
useEffect(() => {
  socket.on('hunterMessage', (message) => {
    console.log('Hunter message received:', message); // בדיקה בהדפסה
    setMessage(prevMessages => [...prevMessages, message]); // הוספת ההודעה למערך הקיים
  });

  return () => {
    socket.off('hunterMessage'); // ניתוק המאזין בעת עזיבת העמוד
  };
}, []);
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
    setIsLoading(false);

  
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
      window.dispatchEvent(new Event('gameNavigation'));
      window.history.pushState(null, '', '/dead'); // עדכון היסטוריה

        window.location.href = '/dead';
    }
 }, [isAlive]);

// מאזין להודעות העברה
useEffect(() => {
  // האזנה להעברה לעמוד DEAD בעקבות בחירת הצייד
  socket.on('navigateToDead', ({ message }) => {
      console.log('NavigateToDead message received:', message); // DEBUG
      sessionStorage.setItem('nightResults', JSON.stringify([message])); // שמירת הודעה
      window.dispatchEvent(new Event('gameNavigation'));
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
    socket.emit('requestRolesStructure');
    sessionStorage.setItem('hunterChoseTarget', 'true'); // סימון שהצייד בחר
    setWaitingForHunter(false);
    setHunterMessage([`הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}!`]); // הודעת הצייד
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
        sessionStorage.setItem('hunterResult', JSON.stringify([`הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}!`])); // שמירה
      }
      if (!isAlive) {
                  // השחקן שנבחר - עדכון isAlive והעברה לעמוד DEAD
                  sessionStorage.setItem('nightResults', JSON.stringify([
                    `${hunterName} בתפקיד צייד החליט לצוד את ${targetName} ובגלל שאתם נאהבים, גם אתה יצאת מהמשחק!`,
                ]));
        window.dispatchEvent(new Event('gameNavigation'));
        window.history.pushState(null, '', '/dead'); // עדכון היסטוריה

          window.location.href = '/dead';
      }
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


if (isLoading) {
  return <h1>טוען נתונים...</h1>;
}
return (
  <div>
  <TopBar role={role} />
  <div className="day-page">

    <h1 className="role-title">בוקר טוב {role}!</h1>
    <br></br>
    {/* הצגת תוצאות הלילה */}
    {message.length > 0 && (
      message.map((msg, index) => <c key={index}>{msg}</c>)
    )}
    <br></br>

    {/* הצגת הודעת הצייד */}
    {hunterMessage.length > 0 && !hunterChoseTarget && (
      hunterMessage.map((msg, index) => <p key={index}>{msg}</p>)
    )}
    <br></br>

    {!elderDead && waitingForHunter && (
      <c>המתן בזמן ש- {hunterName} הצייד יחליט את מי לצוד...</c>
    )}
    <br></br>

    {/* הצגת כפתור מוכן רק אם לא מחכים לצייד */}
    {(!waitingForHunter || elderDead) && (
      <button
        style={{backgroundColor: isReady ?  '#108f14' : '#7e1109',}}
        onClick={toggleReady}
      >
        {isReady ? 'במצב - מוכן' : 'במצב - לא מוכן'}
      </button>
    )}


  </div>
  </div>
);

}

export default DayPage;
