import React, { useState, useEffect } from 'react';
import './TopBar.css'; // עיצוב מותאם אישית
import io from 'socket.io-client';

const socket = io('https://town-game-server.onrender.com');

const TopBar = ({ role }) => {
  const [isOpen, setIsOpen] = useState(false); // מציין אם החלון פתוח
  const [mayorName, setMayorName] = useState('');
  const [hasMayor, setHasMayor] = useState(false); // האם יש ראש עיר
  const [isMayorModalOpen, setIsMayorModalOpen] = useState(false); // מצב חלון מודאלי לראש העיר

  // הגדרת ההסברים לכל תפקיד
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

  useEffect(() => {
    // בקשה לשם ראש העיר
    socket.emit('requestMayor');
    socket.on('mayorName', (name) => {
      if (name) {
        setMayorName(name);
        setHasMayor(true);
      } else {
        setHasMayor(false);
      }
    });

    return () => {
      socket.off('mayorName');
    };
  }, []);

  const toggleMayorModal = () => {
    setIsMayorModalOpen(!isMayorModalOpen);
  };

  // פונקציה שמחזירה את תיאור התפקיד לפי השם
  const getRoleDescription = (role) => {
    if (!role) return 'אין מידע על תפקיד'; // במקרה שאין תפקיד

    // אם התפקיד מכיל את המילה "זאב"
    const description = role.includes('זאב') ? roleDescriptions['זאב'] : roleDescriptions[role];

    // פיצול ההסבר לפי שורות ועטיפה בפסקאות
    return description.split('\n').map((line, index) => (
      <p key={index}>{line.trim()}</p>
    ));
  };

  const toggleModal = () => {
    setIsOpen(!isOpen); // פתיחה או סגירה של החלון
  };

  return (
    <div className="top-bar">
        {hasMayor && (
        <button className="mayor-button" onClick={toggleMayorModal}>
         הצג ראש עיר 
        </button>
      )}
            {isMayorModalOpen && (
        <div className="modal-overlay-role" onClick={toggleMayorModal}>
          <div className="modal-content-role" onClick={(e) => e.stopPropagation()}>
            <h2>ראש העיר הוא  {mayorName}</h2>
                      <p className="top-bar__text">
                      &nbsp;            &nbsp;            כוחו של ראש העיר הוא בכך שהצבעתו <br />
                      &nbsp;             &nbsp;    בעיירה שווה שני קולות.  במקרה של<br />
                      &nbsp;            &nbsp;     שוויון - הצבעת רוב השחקנים  עדיפה על<br />
                      &nbsp;            &nbsp;     הצבעת המיעוט
            וראש העיר.<br />
            &nbsp;     &nbsp;    באם ראש העיר יוצא מהמשחק,<br />
            &nbsp;    &nbsp;    יבחר ראש עיר חדש בבוקר לאחר מכן.
          </p>      
      <button onClick={toggleMayorModal}>סגור</button>
          </div>
        </div>
      )}

      <button className="role-button" onClick={toggleModal}>
        הצג תפקיד
      </button>

      {isOpen && (
        <div className="modal-overlay-role" onClick={toggleModal}>
          <div className="modal-content-role" onClick={(e) => e.stopPropagation()}>
            <h2>התפקיד שלך - {role}</h2>
            <div>
            <p className="top-bar__text">{getRoleDescription(role)}</p> 
              </div>
            <button onClick={toggleModal}>סגור</button>
          </div>
        </div>
      )}



    </div>
  );
};

export default TopBar;
