import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('https://town-game-server.onrender.com');
console.log('Socket connected:', socket.connected);

function DeadPage() {
    const [messages, setMessages] = useState([]);
    const [isHunter, setIsHunter] = useState(false);
    const [targets, setTargets] = useState([]);
    const [selectedTarget, setSelectedTarget] = useState(null);
    const [elderDead, setElderDead] = useState(false); // מצב זקן השבט
    const [role, setRole] = useState('');
    const storedName = sessionStorage.getItem('playerName');
    const hunterChoseTarget = sessionStorage.getItem('hunterChoseTarget');
    const hunterResult = sessionStorage.getItem('hunterResult');
    const [isLoading, setIsLoading] = useState(true);
    const [hunterPersonalMessage, setHunterPersonalMessage] = useState('');
    const [personalVotes, setPersonalVotes] = useState([]);

    // useEffect(() => {
    //     // קריאת הודעות ששמורות ב-sessionStorage
    //     const savedMessages = sessionStorage.getItem('nightResults');
    //     if (savedMessages) {
    //       setMessages(JSON.parse(savedMessages));
    //     }
    //   }, []);


    useEffect(() => {
        socket.on('elderStatus', ({ elderDead }) => {
          setElderDead(elderDead); // עדכון המצב
          console.log('Elder status updated:', elderDead);
        });
      
        socket.emit('requestRolesStructure'); // בקשת מצב ראשוני
        socket.on('connect', () => {
         socket.emit('checkGameEndForDead'); // שליחת בקשה מחדש לבדיקה אם המשחק נגמר
        });
        
        return () => {
          socket.off('elderStatus'); // הסרת המאזין
        };
      }, []);
      
      useEffect(() => {
        socket.emit('requestRolesStructure'); // בקשת מבנה תפקידים מהשרת
        socket.on('rolesStructure', (roles) => {
            console.log('Received roles structure:', roles);
            
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
        return () => {
            socket.off('rolesStructure');
        };
    }, []);

    useEffect(() => {
        const playerName = sessionStorage.getItem('playerName');
    
        // בדיקה אם השחקן הוא הצייד
        console.log(`Checking hunter status for ${playerName}`);
        socket.emit('hunterCheckStatus', { playerName });
    
        // קבלת הודעת בחירה עבור הצייד
        socket.on('hunterChooseTarget', ({ hunterName, players }) => {
            console.log(`Hunter target received for: ${hunterName}, I am: ${sessionStorage.getItem('playerName')}`);

            console.log(`Hunter target received for: ${hunterName}, I am: ${playerName}`);
            console.log('Players received:', players);
    
            if (hunterName === sessionStorage.getItem('playerName')) {
                setIsHunter(true);
                setTargets(players);
                console.log('Hunter mode activated. Targets:', players);
            }else {
                console.log(`${sessionStorage.getItem('playerName')} אינו צייד או עדיין חי`);
                setIsHunter(false); 
            }
        });
        return () => {
            socket.off('hunterChooseTarget');

        };
    }, []);

    useEffect(() => {
        console.log('isHunter:', isHunter, 'targets:', targets);

    }, [isHunter, targets]);

    useEffect(() => {
        const savedMessages = sessionStorage.getItem('nightResults');
        if (savedMessages) {
            // טוען הודעות קיימות
            setMessages(JSON.parse(savedMessages));
        } else {
            // אם אין הודעות בזיכרון, מאזין להודעות חדשות ושומר רק פעם אחת
            socket.on('nightResult', (result) => {
                console.log('תוצאה חדשה התקבלה:', result);
                const newMessages = [result]; // לשמירת תוצאה אחת בלבד
                setMessages(newMessages);
                sessionStorage.setItem('nightResults', JSON.stringify(newMessages)); // שמירה בזיכרון
            });
        }
        setIsLoading(false);

        return () => {
            socket.off('nightResult');
        };
    }, []);

    useEffect(() => {
        if (role === 'צייד') {
          socket.emit('requestHunterVotes', storedName);
      
          socket.on('receiveHunterVotes', ({ personalVotes }) => {
            setPersonalVotes(personalVotes);
            console.log('Received personalVotes for hunter:', personalVotes);
          });
      
          return () => {
            socket.off('receiveHunterVotes');
          };
        }
      }, [role]);
      
    useEffect(() => {
        
        socket.emit('requestRolesStructure');    
        socket.on('rolesStructure', (rolesStructure) => {
        // בדיקה אם השחקן הנוכחי הוא ה-mayor
        let isMayor = false;
        for (const [role, players] of Object.entries(rolesStructure)) {
            players.forEach(player => {
                if (player.name === storedName && player.mayor) {
                    isMayor = true;
                }
            });
        }
        socket.emit('mayorDead', {mayorDeadFlag: isMayor});
        
        });

        socket.on('gameEnd', (result) => {
            console.log('Game Ended:', result);
            sessionStorage.setItem('gameResult', result); // שמירת התוצאה בזיכרון
            window.dispatchEvent(new Event('gameNavigation'));
            window.history.pushState(null, '', '/endgame'); // עדכון היסטוריה
            window.location.href = '/endgame'; // מעבר לעמוד הסיום
        });
        
        return () => {
          socket.off('rolesStructure');
          socket.off('mayorDead');
          socket.off('gameEnd');
        };
      }, []);

    useEffect(() => {
        socket.on('navigateToDead', ({ message }) => {
            sessionStorage.setItem('nightResults', JSON.stringify([message])); // שמירת הודעה
            window.dispatchEvent(new Event('gameNavigation'));
            window.history.pushState(null, '', '/dead'); // עדכון היסטוריה
            window.location.href = '/dead'; // מעבר מיידי לדף DEAD
        });
    
        return () => {
            socket.off('navigateToDead');
        };
    }, []);

    const handleSelectTarget = (targetName) => {
        console.log(`Selected target: ${targetName}`);
        setSelectedTarget(targetName);
    };
    
    const handleConfirmTarget = () => {
        if (selectedTarget) {
            console.log('Confirming target:', selectedTarget);
            socket.emit('hunterChooseTarget', {
                hunterName: sessionStorage.getItem('playerName'),
                targetName: selectedTarget,
            });
                    // עדכון ההודעה האישית לצייד
            setIsHunter(false); // להבטיח סיום הבחירה
            socket.off('hunterChooseTarget'); // להסיר מאזין כפול
        } else {
            console.log('No target selected!');
        }
    };
    
    useEffect(() => {
        socket.on('hunterTargetSelected', ({ targetName, targetRole }) => {
            setHunterPersonalMessage(`בחרת לצוד את ${targetName} בתפקיד ${targetRole}`);
        });
    
        return () => {
            socket.off('hunterTargetSelected');
        };
    }, []);
    useEffect(() => {
        socket.on('hunterFinished', ({ hunterName, targetName, targetRole }) => {
    
          if (targetRole === "זקן השבט"){
            setHunterPersonalMessage([`הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}! \n מעכשיו ועד סוף המשחק לא יהיו לאזרחים כוחות בלילה`]); // הודעת הצייד
    
          } else {
            setHunterPersonalMessage([`הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}!`]); // הודעת הצייד
    
          }
        });
      
        return () => {
          socket.off('hunterFinished');
        };
      }, []);
    useEffect(() => {
        const interval = setInterval(() => {
            socket.emit('checkGameEndForDead'); // שולח בקשה לבדיקה אם המשחק נגמר
        }, 5000); // בדיקה כל 5 שניות
    
        socket.on('navigateToEndGame', () => {
            const resultMessage = sessionStorage.getItem('gameResult') || 'המשחק נגמר!';
            sessionStorage.setItem('gameResult', resultMessage);
            window.dispatchEvent(new Event('gameNavigation'));
            window.history.pushState(null, '', '/endgame'); // עדכון היסטוריה
            window.location.href = '/endgame';
        });
    
        return () => {
            clearInterval(interval);
            socket.off('navigateToEndGame');
        };
    }, []);
    
    if (isLoading) {
        return <h1>טוען נתונים...</h1>;
      }
  return (
    <div className="dead-page">
      <h1>יצאת מהמשחק! בתפקיד {role} </h1>
      <p>תודה שהשתתפת. כעת תוכל להמתין לתוצאות הסופיות של המשחק.</p>
      <h2>תוצאות אחרונות:</h2>
      {messages.length > 0 ? (
        messages.map((msg, index) => <p key={index}>{msg}</p>) // הצגת ההודעות
      ) : (
        <p>אין תוצאות זמינות.</p>
      )}
            {hunterResult && (
        <div>
          <p>{hunterResult}</p>
        </div>
          )}
            {hunterPersonalMessage &&  role === 'צייד'  &&(
                    <p>{hunterPersonalMessage}</p>
            )}
    {elderDead && role === 'צייד' &&(
            <div>
                <p>זקן השבט לא במשחק ולכן אין לך כוחות בתור צייד</p>
            </div>
        )}

    {!elderDead && isHunter && targets.length > 0 &&  role === 'צייד' &&(
            <div>
                {personalVotes.length > 0 && (
                    <div>
                    <h2>הצבעות אחרונות:</h2>
                    <ul>
                        {personalVotes.map(({ voter, target }, index) => (
                        <li key={index}>
                            {voter} הצביע ל-{target}
                        </li>
                        ))}
                    </ul>
                    </div>
                )}
                <h2>בחר את מי לצוד ולהוציא מהמשחק:</h2>
                <div className="hunter-targets">
                    {targets.map((player) => {
                        console.log('Rendering button for:', player.name);
                        return (
                            <button
                                key={player.name}
                                style={{
                                    backgroundColor: selectedTarget === player.name ? 'black' : 'green',
                                }}
                                onClick={() => handleSelectTarget(player.name)}
                            >
                                {player.name}
                            </button>
                        );
                    })}

                </div>
                <button onClick={handleConfirmTarget}>אשר בחירה</button>
            </div>
        )}

    </div>
  );
}

export default DeadPage;
