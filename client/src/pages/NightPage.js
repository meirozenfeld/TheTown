import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import Modal from 'react-modal';
import TopBar from '../components/topBar'; // נתיב לקובץ topBar.js

const socket = io('https://town-game-server.onrender.com');
Modal.setAppElement('#root');

function NightPage() {
  const [message, setMessage] = useState('');
  const [rolesStructure, setRolesStructure] = useState(null);
  const [players, setPlayers] = useState([]);
  const [playersSelf, setPlayersSelf] = useState([]);
  const [role, setRole] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [wolfMessages, setWolfMessages] = useState([]); // הודעות לזאבים
  const [chatMessages, setChatMessages] = useState([]); // צ'אט לזאבים
  const [chatInput, setChatInput] = useState(''); // טקסט קלט בצ'אט
  const storedName = sessionStorage.getItem('playerName');
  const [hasJoinedWolvesRoom, setHasJoinedWolvesRoom] = useState(false);
  const messagesEndRef = useRef(null); // משתנה עבור הפניה
  const [revealedRole, setRevealedRole] = useState(null); // התפקיד שנחשף
  const [selectedPlayer, setSelectedPlayer] = useState(null); // שחקן שנבחר
  const [noActionRoles,setNoActionRoles] = useState(['אזרח', 'קופידון', 'עלוקה', 'זקן השבט','צייד']);
  const [currentMessage, setCurrentMessage] = useState(''); // הודעה רנדומלית
  const [messages, setMessages] = useState([]); // מערך כל ההודעות
  const [seerReady, setSeerReady] = useState(false); // סטטוס מוכנות מגדת עתידות
  const [shieldTarget, setShieldTarget] = useState(null); // השחקן שנבחר
  const [shieldSelf, setShieldSelf] = useState(false); // האם הגן על עצמו
  const [deathTarget, setDeathTarget] = useState(null); // שחקן לשיקוי מוות
  const [lifeTarget, setLifeTarget] = useState(null); // שחקן לשיקוי חיים
  const [usedLifePotion, setUsedLifePotion] = useState(false); // האם שיקוי חיים נוצל
  const [usedDeathPotion, setUsedDeathPotion] = useState(false); // האם שיקוי מוות נוצל
  const [awaitWolfVote, setAwaitWolfVote] = useState(true); // המתנה לזאבים
  const [wolfFinalTarget, setWolfFinalTarget] = useState(null);
  const [lifeChoice, setLifeChoice] = useState(null); // כן או לא
  const [lifeReady, setLifeReady] = useState(false);
  const [olderInTheGame, setOlderInTheGame] = useState(false); // האם יש זקן במשחק
  const [olderAlive, setOlderAlive] = useState(true);         // האם הוא חי
  const [isFirstNight, setIsFirstNight] = useState(null);         // האם הוא חי
  const [wolves, setWolves] = useState([]);         // האם הוא חי
  sessionStorage.setItem('hunterResult', ''); // סימון שהצייד בחר

  const getRoleClass = (role) => {
    if (role.includes('זאב')) return 'wolf';

    switch (role) {
      case 'מגן':
        return 'shield';
      case 'מכשפה':
        return 'witch';
      case 'מגדת עתידות':
        return 'seer';
      case 'צייד':
        return 'hunter';
      case 'זקן השבט':
        return 'elder';
      case 'קופידון':
        return 'cupid';
      case 'עלוקה':
        return 'leech';
      case 'אזרח':
        return 'villager';
      default:
        return '';
    }
  };

  useEffect(() => {
    // קריאת ערך isFirstNight מה-sessionStorage
    const storedFirstNight = sessionStorage.getItem('isFirstNight');
    setIsFirstNight(storedFirstNight === 'true'); // המרה לערך בוליאני
    console.log('isFirstNight loaded from sessionStorage:', storedFirstNight);
  }, []);

  const handleReadyClick = () => {
    if (role.includes('זאב') && !selectedTarget && !isReady) {
      alert('אנא בחר מטרה לפני סימון מוכן!');
      return;
    }
    console.log('seerReady Status:', seerReady);
    if (role.includes('מגדת עתידות') && !seerReady) {
        alert('עלייך לחשוף תפקיד לפני לחיצה על מוכן');
        return;
    }

    if (role.includes('מגן') && !shieldTarget) {
        alert('עלייך לבחור שחקן להגן עליו לפני לחיצה על מוכן');
        return;
    }
    // בדיקת מוכנות למכשפה
    if (role.includes('מכשפה')) {
        if (awaitWolfVote  && !usedLifePotion) { // אם ממתינה להצבעות
            alert('המתיני להצבעת הזאבים על מנת לבחור האם לתת שיקוי חיים!');
            return;
        }
        if (!lifeChoice && wolfFinalTarget && !usedLifePotion) { // אם לא בחרה בשיקוי חיים
            alert('עלייך לבחור האם לתת שיקוי חיים לפני סימון מוכן!');
            return;
        }
    }

        // שליחת שיקוי מוות
        if (!usedDeathPotion && deathTarget) {
            socket.emit('useDeathPotion', { witchName: storedName, targetName: deathTarget });
            setUsedDeathPotion(true); // עדכון שימוש בשיקוי מוות
          }
      
          // שליחת שיקוי חיים
          if (!usedLifePotion && lifeChoice === 'yes') {
            socket.emit('useLifePotion', { witchName: storedName, targetName: wolfFinalTarget });
            setUsedLifePotion(true);
        }
        
    const newReadyState = !isReady;
    setIsReady(newReadyState);

    if (role.includes('זאב') && newReadyState) {
      socket.emit('setWolfTarget', {
        wolfName: storedName,
        targetName: selectedTarget,
      });  
    }

        // שליחת הבחירה לשרת
        if (role.includes('מגן') && newReadyState) {
          socket.emit('shieldPlayer', {
            shieldName: storedName,
            targetName: shieldTarget,
          });
        }
    console.log(`Player ${storedName} is setting readyNight to:`, newReadyState);
    socket.emit('toggleReadyNight', { playerName: storedName, isReady: newReadyState });
  };


  const handleRevealRole = (targetName) => {
    setSeerReady(true); // עדכון מוכנות
    if (selectedPlayer) return; // חסימת לחיצה נוספת לאחר בחירה ראשונה
    setSelectedPlayer(targetName);
    socket.emit('seerRevealRole', { seerName: storedName, targetName });
  };
  
  const handleShieldSelect = (target) => {
    if (isReady) return; // אם המגן מוכן, אין אפשרות לבחור מטרה חדשה
    setShieldTarget(target);
};

const handleDeathPotionSelect = (target) => {
  setDeathTarget(deathTarget === target ? null : target);
};


// בחירה האם לתת שיקוי חיים
const handleLifeChoice = (choice) => {
    setLifeChoice(lifeChoice === choice ? null : choice); // שינוי בחירה
};

// useEffect(() => {

// }, [usedLifePotion, usedDeathPotion, olderAlive, olderInTheGame]); // עוקב אחרי השינויים בזקן השבט

  // טעינת הבדיחות/עובדות מהקובץ
  useEffect(() => {
    fetch('/facts_and_jokes.txt') // טוען את הקובץ מהתיקייה public
      .then(response => response.text())
      .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== ''); // מפרק לשורות ומסנן ריקות
        setMessages(lines); // שומר את כל הבדיחות והעובדות
        setCurrentMessage(lines[Math.floor(Math.random() * lines.length)]); // בוחר הודעה ראשונית רנדומלית
      })
      .catch(err => console.error('Error loading messages:', err));
  }, []);

  // בחירת הודעה רנדומלית חדשה
  const fetchNewMessage = () => {
    if (messages.length > 0) {
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      setCurrentMessage(randomMessage);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); // גלילה לחלק התחתון
  }, [chatMessages]); // מתבצע עם כל עדכון בהודעות

  useEffect(() => {
    socket.on('seerRevealResult', ({ targetName, targetRole }) => {
      console.log(`התקבלה תוצאה מהשרת: ${targetName} הוא ${targetRole}`);
      setRevealedRole(`השחקן ${targetName} הוא בתפקיד ${targetRole}`);
      setSeerReady(true); // עדכון מוכנות
    });
  
    return () => {
      socket.off('seerRevealResult');
    };
  }, []);

  useEffect(() => {
    const requestRoles = () => {
      console.log('Requesting roles structure...');
      socket.emit('requestRolesStructure');
    };


    const handleRolesUpdate = (data) => {
      console.log('Roles structure received:', data);
      setRolesStructure(data);

      let playerRole = '';
      let elderAlive = true;
      let elderInGame = false;

      for (const [roleName, playersList] of Object.entries(data)) {
        const player = playersList.find((p) => p.name === storedName);
        if (player) {
          playerRole = roleName;
          // עדכון שיקויים אם מדובר במכשפה
          if (roleName.includes('מכשפה')) {
            setUsedDeathPotion(player.usedDeathPotion); // עדכון מצב התחלתי
            setUsedLifePotion(player.usedLifePotion);   // עדכון מצב התחלתי
          }
          break;
        }
      }


      setRole(playerRole);
      console.log('Assigned role:', playerRole);
     
    // אם התפקיד הוא זאב - הצטרפות לחדר הזאבים
    if (playerRole.includes('זאב')) {
        if (!hasJoinedWolvesRoom) {
          socket.emit('requestRole', storedName);
          setHasJoinedWolvesRoom(true);
          console.log(`${storedName} מבקש להצטרף לחדר הזאבים`);
        }
      }

      // בדיקת מצב זקן השבט
      for (const [roleName, players] of Object.entries(data)) {
        players.forEach(player => {
          if (roleName.includes('זקן השבט')) {
            elderInGame = true;
            if (!player.isAlive) {
              elderAlive = false; // זקן השבט מת
            }
          }

        });
      }
      setOlderInTheGame(elderInGame);
      setOlderAlive(elderAlive);


      const alivePlayers = [];
      const alivePlayersSelf = [];
      const aliveWolves = [];

      for (const roleName in data) {
        data[roleName].forEach((player) => {
          if (player.isAlive && player.name !== storedName) {
            alivePlayers.push(player);
          }
          if (player.isAlive) {
            alivePlayersSelf.push(player);
            if (roleName.includes('זאב') && player.name !== storedName){
              aliveWolves.push(player);
            }
          }
        });
      }
      setPlayers(alivePlayers);
      setPlayersSelf(alivePlayersSelf);
      if(aliveWolves.length > 0){
        setWolves(aliveWolves);
      } else{
        aliveWolves.push({ name: 'אין איתך זאבים חיים' })
        setWolves(aliveWolves);
      }
    


      const cupidRole = Object.keys(data).find((role) => role.includes('קופידון'));
      if (cupidRole) {
        // פונקציה להוספת ירידת שורה אחרי כל 4 מילים
        const formatMessage = (text) => {
          const words = text.split(' ');
          let formattedText = '';
          for (let i = 0; i < words.length; i++) {
            formattedText += words[i] + ' ';
            if ((i + 1) % 6 === 0) {
              formattedText += '<br />'; // הוספת תגית HTML לשבירת שורה
            }
          }
          return formattedText.trim(); // הסרת רווח מיותר בסוף
        };

        const cupid = data[cupidRole][0];
        console.log('Cupid details:', cupid);

        if (cupid.lover === storedName) {
          const rawMessage = `הקופידון ${cupid.name} בחר בך כנאהב. עליכם להישאר יחד במשחק, וזה אומר שאם אחד ממכם יצא מהמשחק אז גם השני יצא מהמשחק.`;
          const formattedMessage = formatMessage(rawMessage); // עיצוב עם שבירת שורות
          setMessage(formattedMessage); // שמירת הודעה בפורמט HTML       
          setIsModalOpen(true);
        }
      }
    
      setIsLoading(false);
        // *** ניתוק כל המאזינים הקודמים ***
    };

    requestRoles();

    socket.off('wolfChatMessage'); // ניתוק מאזין קודם אם קיים

    socket.on('rolesStructure', handleRolesUpdate);

    // קבלת הודעות על מטרות שנבחרו על ידי זאבים אחרים
    socket.on('wolfTargetUpdate', ({ senderName, senderRole, targetName }) => {
      if (senderName !== storedName) { // לא להציג הודעה עבור הזאב עצמו
        setWolfMessages((prev) => [
          ...prev.filter((msg) => !msg.includes(senderName)), // מחיקת הודעה קודמת של אותו זאב
          `${senderRole} ${senderName} לחץ על ${targetName} כמטרה.`,
        ]);
      }
    });

  
  // האזנה להודעות בצ'אט
  socket.on('wolfChatMessage', ({ senderName, message }) => {
    console.log(`התקבלה הודעה מהשרת מ-${senderName}: ${message}`);
    setChatMessages((prev) => [
      ...prev,
      `${senderName}: ${message}`,
    ]);
  });



    socket.on('allPlayersReadyNight', () => {
      console.log('Switching to DayPage');
      window.dispatchEvent(new Event('gameNavigation'));
      window.history.pushState(null, '', '/day'); // עדכון היסטוריה
      window.location.href = '/day';
    });

    socket.on('wolfFinalTarget', (target) => {
        console.log('המטרה הסופית שהתקבלה אצל המכשפה:', target);
        setWolfFinalTarget(target); // שמירת המטרה שנבחרה
        setAwaitWolfVote(false); // הזאבים סיימו להצביע
    });
    return () => {
      socket.off('rolesStructure', handleRolesUpdate);
      socket.off('wolfTargetUpdate');
      socket.off('wolfChatMessage'); // ניתוק מאזין הצ'אט
      socket.off('allPlayersReadyNight');
      socket.off('wolfFinalTarget');

    };
  }, []);

  useEffect(() => {
    console.log("olderInTheGame ", olderInTheGame);
    console.log("olderAlive ", olderAlive);
  
    let updatedNoActionRoles = [...noActionRoles];
    
    // תנאי לעדכון `noActionRoles`
    if (olderInTheGame && !olderAlive) {
      updatedNoActionRoles = [
        'אזרח',
        'קופידון',
        'עלוקה',
        'זקן השבט',
        'צייד',
        'מכשפה',
        'מגדת עתידות',
        'מגן',
      ];
    } else {
      updatedNoActionRoles = [
        'אזרח',
        'קופידון',
        'עלוקה',
        'זקן השבט',
        'צייד',
      ];
    }
  
    if (usedLifePotion && usedDeathPotion) {
      updatedNoActionRoles.push('מכשפה');
    }
  
    // השוואת המצב החדש עם המצב הקיים
    const rolesHaveChanged =
      updatedNoActionRoles.length !== noActionRoles.length ||
      updatedNoActionRoles.some((role, index) => role !== noActionRoles[index]);

    console.log("updatedNoActionRoles: ", updatedNoActionRoles)

    if (rolesHaveChanged) {
      setNoActionRoles(updatedNoActionRoles);
    }
    console.log("NoActionRoles: ", noActionRoles)
    // בדיקת סטייט `role`
    if (noActionRoles.includes(role) && !isReady) {
      console.log(`${role} is in noActionRoles and should be ready.`);
      setIsReady(true);
      socket.emit('toggleReadyNight', { playerName: storedName, isReady: true });
    }
  
    return () => {
      socket.off('toggleReadyNight');
    };
  }, [usedLifePotion, usedDeathPotion, olderAlive, olderInTheGame, role, isReady, noActionRoles]);
  
  const handleTargetSelect = (target) => {
    if (isReady) return;
    setSelectedTarget(target);
  };


const sendChatMessage = () => {
  if (chatInput.trim()) {
    socket.emit('wolfChatMessage', {
      senderName: storedName,
      message: chatInput,
    });

    // אין הוספת ההודעה לסטייט באופן מקומי
    setChatInput(''); // ניקוי תיבת הקלט
  }
};

  const closeModal = () => {
    setIsModalOpen(false);
  };

  if (isLoading) {
    return <h1>טוען נתונים...</h1>;
  } 

  return (
    <div>
      <Modal 
        isOpen={isModalOpen && isFirstNight} 
        className="modal-content"
        overlayClassName="modal-overlay2"
      >
        <h2>הודעה חשובה</h2>
        <p dangerouslySetInnerHTML={{ __html: message }}></p>
        <button onClick={closeModal}>הבנתי</button>
      </Modal>
    <div>
  <TopBar role={role} />
    <div className={`night-page ${getRoleClass(role)}`}>
      <h1 className="role-title">לילה טוב {role}</h1>
      {noActionRoles.includes(role) && !role.includes('זאב')  && olderInTheGame && !olderAlive &&(
        <div className="no-acts" style={{ marginTop: '20px' }}>
          <h2>לא ניתן לבצע פעולות בלילה זה, זקן השבט מת.</h2>
        </div>
        )}
        {noActionRoles.includes(role) && (
        <div className="fact-container" style={{ marginTop: '20px', padding: '10px' }}>
          {noActionRoles.includes(role) && role == 'מכשפה' && (!olderInTheGame || olderAlive ) && (
          <h2>השתמשת בכל השיקויים</h2>

          )}

          <h2>אין לך תפקיד בלילה אנא המתינו לסיום הלילה...</h2>
          <div className="bubble-container">
          <p
            className="bubble-text"
            dangerouslySetInnerHTML={{
              __html: currentMessage.replace(/n/g, '<br />'),
            }}
          />
          <button className="bubble-button" onClick={fetchNewMessage}>
            הבא
          </button>
        </div>
        </div>
      )}

      {role.includes('מכשפה') && !usedDeathPotion &&  !noActionRoles.includes(role) && (
        <div className="death-potion-container" style={{ marginTop: '20px' }}>
            <h2>האם תרצי לתת שיקוי מוות לאחד השחקנים?</h2>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {players.map((player) => (
                <button
                key={player.name}
                style={{
                    padding: '10px',
                    borderRadius: '5px',
                    backgroundColor: deathTarget === player.name ? '#7e1109' : '#424442',
                    color: 'white',
                    cursor: 'pointer',
                }}
                onClick={() => handleDeathPotionSelect(player.name)}
                >
                {player.name}
                </button>
            ))}
            </div>
        </div>
        )}

        {role.includes('מכשפה') && !usedLifePotion && !awaitWolfVote && wolfFinalTarget && !noActionRoles.includes(role) && (
            <div className="life-potion-container" style={{ marginTop: '20px' }}>
                <h2>הזאבים החליטו לטרוף את {wolfFinalTarget}, האם תרצי להעניק לו שיקוי חיים?</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        style={{
                            padding: '10px',
                            borderRadius: '5px',
                            backgroundColor: lifeChoice === 'yes' ? '#7e1109' : '#424442',
                            color: 'white',
                        }}
                        onClick={() => handleLifeChoice('yes')}
                    >
                        כן
                    </button>
                    <button
                        style={{
                            padding: '10px',
                            borderRadius: '5px',
                            backgroundColor: lifeChoice === 'no' ? '#7e1109' : '#424442',
                            color: 'white',
                        }}
                        onClick={() => handleLifeChoice('no')}
                    >
                        לא
                    </button>
                </div>
            </div>
        )}

        {role.includes('מכשפה') && awaitWolfVote && !usedLifePotion && !noActionRoles.includes(role) &&(
            <h2>המתיני להצבעת הזאבים על מנת לבחור האם לתת שיקוי חיים...</h2>
        )}


          {role.includes('מגן') && !noActionRoles.includes(role) && (
            <div className="shield-container" style={{ marginTop: '20px' }}>
              <h2>על מי תרצה להגן הלילה? (לא יכול על עצמך פעמיים ברצף)</h2>
              <div className="shield-options" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {playersSelf.map((player) => (
                  <button
                    key={player.name}
                    style={{
                      padding: '10px',
                      borderRadius: '5px',
                      backgroundColor: shieldTarget === player.name ? 'darkblue' : '#424442',
                      color: 'white',
                      cursor: player.name === storedName && player.shildSelf ? 'not-allowed' : 'pointer',
                    }}
                    disabled={isReady || (player.name === storedName && player.shildSelf)} // מניעת לחיצה אם השחקן הוא המגן והגן על עצמו
                    onClick={() => handleShieldSelect(player.name)}
                  >
                    {player.name}
                  </button>
                ))}
              </div>
            </div>
          )}

      {role.includes('מגדת עתידות') && !noActionRoles.includes(role) && (
        <div className="seer-container" style={{ marginTop: '20px' }}>
            <h2>את מי תרצי לחשוף הלילה?</h2>
            <div className="seer-options" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {players.map((player) => (
                <button
                    key={player.name}
                    style={{
                    padding: '10px',
                    borderRadius: '5px',
                    backgroundColor: selectedPlayer === player.name ? '#7e1109' : '#424442',
                    color: 'white',
                    cursor: seerReady ? 'not-allowed' : 'pointer',
                    }}
                    disabled={seerReady} // מניעת לחיצה נוספת
                    onClick={() => handleRevealRole(player.name)}
                >
                    {player.name}
                </button>
                ))}
            </div>
            {revealedRole && (
            <p style={{ marginTop: '20px', fontSize: '25px', fontWeight: 'bold' }}>
                {revealedRole}
            </p>
)}  
      </div>
        )}

      {/* הודעות לזאבים */}
      {role.includes('זאב') && (
        <div className="wolf-messages">
        <h2 style={{ color: 'black' }}>הזאבים שחיים איתך הם:</h2>
            {wolves.map((player, index) => (
      <h2 key={index} style={{ color: 'black', fontSize: "23px" }}>{player.name}</h2>
        ))}
        </div>
      )}
      {role.includes('זאב') && (
        <div className="wolf-messages">
          <h2 style={{ color: 'black' }}>פעולות הזאבים האחרים:</h2>
          {wolfMessages.map((msg, index) => (
            <p key={index} style={{ color: 'black', fontSize: "23px" }}>{msg}</p>
          ))}
        </div>
      )}

      {/* אפשרות בחירת מטרה עבור זאבים */}
      {role.includes('זאב') && (
        <div >
          <h2>בחר מטרה:</h2>
          <div className="player-buttons-wolf">

          {players.map((player) => (
            <button
              key={player.name}
              style={{
                backgroundColor: selectedTarget === player.name ? '#7e1109' : '#424442',
                margin: '5px',
                padding: '10px',
              }}
              disabled={isReady}
              onClick={() => handleTargetSelect(player.name)}
            >
              {player.name}
            </button>
          ))}
          </div>
        </div>
      )}

      {!noActionRoles.includes(role) && (
        <button
          style={{
            backgroundColor: isReady ?  '#108f14' : '#7e1109',
            color: 'white',
            padding: '10px',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
          onClick={handleReadyClick}
        >
          במצב - {isReady ? 'מוכן' : 'לא מוכן'}
        </button>
      )}
      
      {role.includes('זאב') && (
        <div className="wolf-chat" style={{ marginBottom: '20px', marginTop: '120px' }}>
            {/* תיבת הצ'אט */}
            <div
            style={{
                height: '160px',
                overflowY: 'auto',
                border: '1px solid gray',
                padding: '5px',
                marginBottom: '10px',
                width: '80%',
                backgroundColor: 'white', // שינוי צבע רקע ללבן
            }}
            >
            <div className="chat-box">

            {chatMessages.map((msg, index) => (
                <p key={index}>{msg}</p>
            ))}
            </div>

            <div ref={messagesEndRef}></div> {/* גלילה לחלק התחתון */}
            </div>

            {/* שורת קלט וכפתור שליחה */}
            <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '10px',
                width: '80%',
            }}
            >
            <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="כתוב הודעה לשאר הזאבים..."
                rows="3"
                style={{
                flex: '1',
                resize: 'none',
                padding: '10px',
                fontSize: '16px',
                borderRadius: '5px',
                }}
            />
            <button
                onClick={sendChatMessage}
                style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                }}
            >
                שלח
            </button>
            </div>
        </div>
        )}





    </div>
    </div>
    </div>
  );
}

export default NightPage;
