// DeadPage.jsx
// Purpose: Dead screen for the Town Game.
// Responsibilities:
// - Restore and display latest night results for eliminated players
// - Manage Hunter flow if the dead player is the Hunter (target selection, personal messages)
// - Track Elder status (affects Hunter power), Mayor status, and game-end navigation
// - Poll server for game-end while on Dead page
// Notes:
// * Logic is unchanged; comments are concise and in English.
// * No code has been omitted.

import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('https://town-game-server.onrender.com');
console.log('Socket connected:', socket.connected);

function DeadPage() {
    const [messages, setMessages] = useState([]);
    const [isHunter, setIsHunter] = useState(false);
    const [targets, setTargets] = useState([]);
    const [selectedTarget, setSelectedTarget] = useState(null);
    const [elderDead, setElderDead] = useState(false); // Elder status
    const [role, setRole] = useState('');
    const storedName = sessionStorage.getItem('playerName');
    const hunterChoseTarget = sessionStorage.getItem('hunterChoseTarget');
    const hunterResult = sessionStorage.getItem('hunterResult');
    const [isLoading, setIsLoading] = useState(true);
    const [hunterPersonalMessage, setHunterPersonalMessage] = useState('');
    const [personalVotes, setPersonalVotes] = useState([]);

    // Listen for Elder status and request roles structure on mount.
    // Also re-check game end upon reconnect.
    useEffect(() => {
        socket.on('elderStatus', ({ elderDead }) => {
          setElderDead(elderDead);
          console.log('Elder status updated:', elderDead);
        });
      
        socket.emit('requestRolesStructure'); // Initial roles snapshot

        socket.on('connect', () => {
         socket.emit('checkGameEndForDead'); // Re-check game end upon reconnection
        });
        
        return () => {
          socket.off('elderStatus');
        };
      }, []);
      
      // Request roles structure; derive current player's role when received
      useEffect(() => {
        socket.emit('requestRolesStructure'); // Request roles structure from server
        socket.on('rolesStructure', (roles) => {
            console.log('Received roles structure:', roles);
        });

        // Resolve the player's role from the roles structure
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

    // Determine if the current player is the Hunter; if so, receive target list
    useEffect(() => {
        const playerName = sessionStorage.getItem('playerName');
    
        console.log(`Checking hunter status for ${playerName}`);
        socket.emit('hunterCheckStatus', { playerName });
    
        socket.on('hunterChooseTarget', ({ hunterName, players }) => {
            console.log(`Hunter target received for: ${hunterName}, I am: ${sessionStorage.getItem('playerName')}`);
            console.log(`Hunter target received for: ${hunterName}, I am: ${playerName}`);
            console.log('Players received:', players);
    
            if (hunterName === sessionStorage.getItem('playerName')) {
                setIsHunter(true);
                setTargets(players);
                console.log('Hunter mode activated. Targets:', players);
            } else {
                console.log(`${sessionStorage.getItem('playerName')} is not the Hunter or is still alive`);
                setIsHunter(false); 
            }
        });

        return () => {
            socket.off('hunterChooseTarget');
        };
    }, []);

    // Debug current hunter state
    useEffect(() => {
        console.log('isHunter:', isHunter, 'targets:', targets);
    }, [isHunter, targets]);

    // Restore night results from sessionStorage or listen for a fresh result once
    useEffect(() => {
        const savedMessages = sessionStorage.getItem('nightResults');
        if (savedMessages) {
            // Load existing messages
            setMessages(JSON.parse(savedMessages));
        } else {
            // If no saved messages, listen for one result and persist it once
            socket.on('nightResult', (result) => {
                console.log('New result received:', result);
                const newMessages = [result]; // store a single latest result
                setMessages(newMessages);
                sessionStorage.setItem('nightResults', JSON.stringify(newMessages));
            });
        }
        setIsLoading(false);

        return () => {
            socket.off('nightResult');
        };
    }, []);

    // If role is Hunter, request personal votes and listen for updates
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
      
    // Determine if the dead player was Mayor and notify server; also handle game end
    useEffect(() => {
        socket.emit('requestRolesStructure');    
        socket.on('rolesStructure', (rolesStructure) => {
          // Check if current player is mayor
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
            sessionStorage.setItem('gameResult', result);
            window.dispatchEvent(new Event('gameNavigation'));
            window.history.pushState(null, '', '/endgame');
            window.location.href = '/endgame';
        });
        
        return () => {
          socket.off('rolesStructure');
          socket.off('mayorDead');
          socket.off('gameEnd');
        };
      }, []);

    // Server-driven navigation to Dead (e.g., from other screens)
    useEffect(() => {
        socket.on('navigateToDead', ({ message }) => {
            sessionStorage.setItem('nightResults', JSON.stringify([message]));
            window.dispatchEvent(new Event('gameNavigation'));
            window.history.pushState(null, '', '/dead');
            window.location.href = '/dead';
        });
    
        return () => {
            socket.off('navigateToDead');
        };
    }, []);

    // Hunter UI handlers
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
            // Update personal hunter message UI state and remove duplicate listeners
            setIsHunter(false);
            socket.off('hunterChooseTarget');
        } else {
            console.log('No target selected!');
        }
    };
    
    // Personal confirmation message for Hunter after selecting a target
    useEffect(() => {
        socket.on('hunterTargetSelected', ({ targetName, targetRole }) => {
            setHunterPersonalMessage(`בחרת לצוד את ${targetName} בתפקיד ${targetRole}`);
        });
    
        return () => {
            socket.off('hunterTargetSelected');
        };
    }, []);

    // Global hunter finished event (with/without Elder impact)
    useEffect(() => {
        socket.on('hunterFinished', ({ hunterName, targetName, targetRole }) => {
          if (targetRole === "זקן השבט"){
            setHunterPersonalMessage([`הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}! \n מעכשיו ועד סוף המשחק לא יהיו לאזרחים כוחות בלילה`]);
          } else {
            setHunterPersonalMessage([`הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}!`]);
          }
        });
      
        return () => {
          socket.off('hunterFinished');
        };
      }, []);

    // Periodically check if the game has ended while on Dead page; navigate when signaled
    useEffect(() => {
        const interval = setInterval(() => {
            socket.emit('checkGameEndForDead'); // Poll server for game end state
        }, 5000);
    
        socket.on('navigateToEndGame', () => {
            const resultMessage = sessionStorage.getItem('gameResult') || 'המשחק נגמר!';
            sessionStorage.setItem('gameResult', resultMessage);
            window.dispatchEvent(new Event('gameNavigation'));
            window.history.pushState(null, '', '/endgame');
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
          messages.map((msg, index) => <p key={index}>{msg}</p>) // Render saved/latest results
        ) : (
          <p>אין תוצאות זמינות.</p>
        )}

        {hunterResult && (
          <div>
            <p>{hunterResult}</p>
          </div>
        )}

        {hunterPersonalMessage && role === 'צייד' && (
          <p>{hunterPersonalMessage}</p>
        )}

        {elderDead && role === 'צייד' && (
          <div>
            <p>זקן השבט לא במשחק ולכן אין לך כוחות בתור צייד</p>
          </div>
        )}

        {!elderDead && isHunter && targets.length > 0 && role === 'צייד' && (
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
