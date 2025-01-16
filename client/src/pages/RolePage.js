import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import klafImage from '../styles/klaf-removebg2.png';

const socket = io('https://town-game-server.onrender.com');
function RolePage() {
  const [playerName, setPlayerName] = useState('');
  const [role, setRole] = useState('');
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [description, setDescription] = useState('');
  const [currentText, setCurrentText] = useState('');
  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [textVisible, setTextVisible] = useState(false);

  // הגדרת הסברים לתפקידים
  const roleDescriptions = {
    זאב: `הזאבים יודעים האחד על השני וקמים כל לילה בכדי לטרוף את אחד האזרחים. באם יש שוויון בהצבעה על זהות המטרה (יתכן בשל מחלוקת או ניגוד אינטרסים-נאהבים), מנהיג הלהקה הוא שובר השוויון. אם מנהיג הלהקה יצא מהמשחק  שובר השוויון יהיה הזאב הבא בתור למשל "זאב 2".
שיוך: זאבים.`,
    עלוקה: `העלוקה אינה קמה באף לילה. תפקידה במשחק הוא לנסות ולהיצמד לצד המנצח. אם היא נשארת בחיים יחד עם קבוצת שיוך אחת בלבד - זאבים/אזרחים/נאהבים (כלומר קבוצות השיוך האחרות כבר לא במשחק) אזי היא המנצחת במשחק. באם העלוקה יוצאת מהמשחק המנצחת תהיה כרגיל.
שיוך: ללא.`,
    מגן: `המגן קם בכל לילה. המגן מגן כל לילה בלי לדעת את מי הזאבים רצו לטרוף. המגן יכול להגן על עצמו אך אינו יכול להגן על עצמו שני לילות רצופים. מאבד את כוחו בלא זקן השבט.
שיוך: אזרחים.`,
    מכשפה: `המכשפה קמה בכל לילה. בתחילת המשחק בידה שיקוי חיים אחד ושיקוי מוות אחד. כל עוד לא השתמשה בשיקוי חיים, המטרה שהזאבים בחרו תיחשף עבורה והיא תחליט האם להעניק שיקוי חיים. המכשפה מאבדת את כוחה בלא זקן השבט.
שיוך: אזרחים.`,
    'זקן השבט': `זקן השבט לא קם בלילה. זקן השבט יוצא מהמשחק רק אם הזאבים טרפו אותו פעמיים או שהעיירה החליטה להוציא אותו (פעם אחת מספיקה). באם זקן השבט יוצא מהמשחק המכשפה, מגדת העתידות, הצייד והמגן מאבדים את כוחם.
שיוך: אזרחים.`,
    קופידון: `הקופידון בוחר בתחילת המשחק נאהב שישתף איתו פעולה במהלך המשחק. הקופידון אינו יודע את תפקיד הנאהב שלו. לנאהבים יש מטרה נוספת מעבר לשיוכם כאזרחים/זאבים והיא לנצח כזוג. באם אחד הנאהבים יוצא מהמשחק, השני גם יוצא יחד איתו ולכן עליהם להגן אחד על השני.
שיוך: נאהבים.`,
    אזרח: `אזרח פשוט לא קם בלילה. עליו לנסות ולאתר את הזאבים במשך היום ולהוציאם מהמשחק.
שיוך: אזרחים.`,
    'מגדת עתידות': `מגדת העתידות קמה בכל לילה. בכל לילה היא יכולה לחשוף תפקיד של שחקן אחר. אסור לה לגלות לעיירה את תפקידה! מגדת העתידות מאבדת את כוחה בלא זקן השבט.
שיוך: אזרחים.`,
    צייד: `הצייד לא קם בלילה. כוחו בא לידי ביטוי ברגע יציאתו מהמשחק, אז הוא בוחר שחקן שיצא מהמשחק ביחד איתו (בתקווה להוציא זאב כמובן). מאבד את כוחו בלא זקן השבט.
שיוך: אזרחים.`,
  };



  // פונקציה שמחזירה את תיאור התפקיד
  const getRoleDescription = (role) => {
    if (!role) return 'אין מידע על תפקיד'; // במקרה שאין תפקיד
    return role.includes('זאב') ? roleDescriptions['זאב'] : roleDescriptions[role] || 'אין מידע על תפקיד';
  };

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
    sessionStorage.setItem('isFirstNight', 'true');
    const storedName = sessionStorage.getItem('playerName');
    if (storedName) {
      setPlayerName(storedName);
      socket.emit('requestRole', storedName); // בקשת תפקיד
    }


    // האזנה לתפקיד שהוקצה
    socket.on('roleAssigned', (data) => {
      if (data.playerName === storedName) {
        setRole(data.role);
        setDescription("התפקיד שלך הוא -  " + `${data.role}` +"\n"+ getRoleDescription(data.role));
        setIsLoading(false);

      }
    });



    // עדכון רשימת השחקנים
    socket.on('updatePlayers', (playersList) => {
      setPlayers(playersList.filter(player => player.name !== storedName)); // הסתרת השחקן הנוכחי
    });

    // מעבר ל-NightPage כאשר כולם במצב מוכן
    socket.on('updatePlayersReady', (allReady) => {
      if (allReady) {
        window.dispatchEvent(new Event('gameNavigation'));
        window.history.pushState(null, '', '/night'); // עדכון היסטוריה
        window.location.href = '/night';
      }
    });

    return () => {
      socket.off('roleAssigned');
      socket.off('updatePlayersReady');
      socket.off('updatePlayers');
    };
  }, []);



  const handlePlayerSelect = (player) => {
    setSelectedPlayer(player);
  };

  const toggleReady = () => {
    // בדיקת בחירת נאהב עבור קופידון
    if (role === 'קופידון' && !selectedPlayer) {
      alert('בחר נאהב לפני לחיצה על מוכן!');
      return;
    }

    const newReadyState = !isReady;
    setIsReady(newReadyState);

    // שליחת בחירת הנאהב
    if (role === 'קופידון' && selectedPlayer) {
      socket.emit('updateLover', {
        cupidName: playerName,
        loverName: selectedPlayer.name,
      });
    }

    // עדכון מצב מוכנות
    socket.emit('toggleReadyRole', { playerName, isReady: newReadyState });
  };
      useEffect(() => {
        setTimeout(() => {
          const container = document.querySelector('.scroll-container');
          if (!container) {
            console.error('Element .scroll-container not found');
            return;
          }
      
          const img = new Image();
          img.src = klafImage;
      
          img.onload = () => {
            container.classList.add('loaded'); // הצגת התמונה
            setTextVisible(true); // הצגת המלל
          };
        }, 1000); // עיכוב קצר של 100ms
      }, []);
      // אפקט לכתיבה אות אחר אות
      useEffect(() => {
        if (description) {
          // עיכוב של שנייה אחת
          const timeout = setTimeout(() => {
            const interval = setInterval(() => {
              setCurrentText((prev) => {
                if (prev.length < description.length) {
                  return prev + description[prev.length];
                } else {
                  clearInterval(interval);
                  return prev;
                }
              });
            }, 40); // מהירות הכתיבה
      
            // ניקוי ה-interval בסיום
            return () => clearInterval(interval);
          }, 1000); // עיכוב של 1000 מילי-שניות = 1 שנייה
      
          // ניקוי ה-timeout אם ה-description משתנה או שהקומפוננטה מתפרקת
          return () => clearTimeout(timeout);
        }
      }, [description]);

      if (isLoading) {
        return <h1>טוען נתונים...</h1>;
      }
      
  return (
    <div className={`role-page ${getRoleClass(role)}`}>
    <h1 className="role-title">שלום {playerName}!</h1>

    <div className="scroll-container">
    { textVisible && (

    <div className="scroll-text">
    {/* <h2>התפקיד שלך הוא:</h2>
    <h3>{role}</h3> */}
        <p>{currentText}</p>
    </div>
    )}
     </div>
      {role === 'קופידון' && (
        <div>
          <h2>בחר נאהב:</h2>
          <div className="player-buttons">
          {players.map((player) => (
            <button
              key={player.name}
              className="player-button"
              style={{
                backgroundColor: selectedPlayer?.name === player.name ? '#d41e98' : '#424442',
                color: 'white',
                padding: '10px',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
              onClick={() => handlePlayerSelect(player)}
            >
              {player.name}
            </button>
          ))}
        </div>

        </div>
      )}
      <button
        style={{
          backgroundColor: isReady ? '#108f14' : '#7e1109',
          color: 'white',
          padding: '10px',
          borderRadius: '15px',
          cursor: 'pointer',
          
        }}
        onClick={toggleReady}
      >
        במצב - {isReady ? 'מוכן' : 'לא מוכן'}
      </button>
    </div>
  );
}

export default RolePage;
