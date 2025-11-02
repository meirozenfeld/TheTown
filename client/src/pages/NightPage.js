// NightPage.jsx
// Purpose: Night phase screen. Manages per-role night actions (wolves target, seer reveal,
// witch potions, shield protection), elder/cupid effects, wolves chat, and transition to Day.
// Notes:
// - Logic preserved exactly; comments are concise and in English.
// - No code omitted.

import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import Modal from 'react-modal';
import TopBar from '../components/topBar'; // Path to topBar.js

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
  const [wolfMessages, setWolfMessages] = useState([]);     // Wolves' action feed
  const [chatMessages, setChatMessages] = useState([]);     // Wolves' chat messages
  const [chatInput, setChatInput] = useState('');           // Wolves' chat input
  const storedName = sessionStorage.getItem('playerName');
  const [hasJoinedWolvesRoom, setHasJoinedWolvesRoom] = useState(false);
  const messagesEndRef = useRef(null);                      // Ref for chat autoscroll
  const [revealedRole, setRevealedRole] = useState(null);   // Seer reveal result
  const [selectedPlayer, setSelectedPlayer] = useState(null);// Seer selected player
  const [noActionRoles,setNoActionRoles] = useState(['אזרח', 'קופידון', 'עלוקה', 'זקן השבט','צייד']);
  const [currentMessage, setCurrentMessage] = useState(''); // Random fact/joke
  const [messages, setMessages] = useState([]);             // Facts/jokes pool
  const [seerReady, setSeerReady] = useState(false);        // Seer "ready" after reveal
  const [shieldTarget, setShieldTarget] = useState(null);   // Shield target
  const [shieldSelf, setShieldSelf] = useState(false);      // (kept, not used directly)
  const [deathTarget, setDeathTarget] = useState(null);     // Witch death potion target
  const [lifeTarget, setLifeTarget] = useState(null);       // Witch life potion target (kept)
  const [usedLifePotion, setUsedLifePotion] = useState(false);
  const [usedDeathPotion, setUsedDeathPotion] = useState(false);
  const [awaitWolfVote, setAwaitWolfVote] = useState(true); // Witch waits wolves decision
  const [wolfFinalTarget, setWolfFinalTarget] = useState(null);
  const [lifeChoice, setLifeChoice] = useState(null);       // 'yes' | 'no'
  const [lifeReady, setLifeReady] = useState(false);        // (kept)
  const [olderInTheGame, setOlderInTheGame] = useState(false);
  const [olderAlive, setOlderAlive] = useState(true);
  const [isFirstNight, setIsFirstNight] = useState(null);
  const [wolves, setWolves] = useState([]);
  sessionStorage.setItem('hunterResult', '');               // Reset hunter result

  // Map role to CSS class
  const getRoleClass = (role) => {
    if (role.includes('זאב')) return 'wolf';
    switch (role) {
      case 'מגן': return 'shield';
      case 'מכשפה': return 'witch';
      case 'מגדת עתידות': return 'seer';
      case 'צייד': return 'hunter';
      case 'זקן השבט': return 'elder';
      case 'קופידון': return 'cupid';
      case 'עלוקה': return 'leech';
      case 'אזרח': return 'villager';
      default: return '';
    }
  };

  // Load 'isFirstNight' from sessionStorage
  useEffect(() => {
    const storedFirstNight = sessionStorage.getItem('isFirstNight');
    setIsFirstNight(storedFirstNight === 'true');
    console.log('isFirstNight loaded from sessionStorage:', storedFirstNight);
  }, []);

  // Handle "Ready" click with per-role validations and emits
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
    // Witch validations
    if (role.includes('מכשפה')) {
        if (awaitWolfVote  && !usedLifePotion) {
            alert('המתיני להצבעת הזאבים על מנת לבחור האם לתת שיקוי חיים!');
            return;
        }
        if (!lifeChoice && wolfFinalTarget && !usedLifePotion) {
            alert('עלייך לבחור האם לתת שיקוי חיים לפני סימון מוכן!');
            return;
        }
    }

    // Witch death potion emit
    if (!usedDeathPotion && deathTarget) {
      socket.emit('useDeathPotion', { witchName: storedName, targetName: deathTarget });
      setUsedDeathPotion(true);
    }
    // Witch life potion emit
    if (!usedLifePotion && lifeChoice === 'yes') {
      socket.emit('useLifePotion', { witchName: storedName, targetName: wolfFinalTarget });
      setUsedLifePotion(true);
    }

    const newReadyState = !isReady;
    setIsReady(newReadyState);

    // Wolves submit target on ready
    if (role.includes('זאב') && newReadyState) {
      socket.emit('setWolfTarget', {
        wolfName: storedName,
        targetName: selectedTarget,
      });  
    }
    // Shield submit protection on ready
    if (role.includes('מגן') && newReadyState) {
      socket.emit('shieldPlayer', {
        shieldName: storedName,
        targetName: shieldTarget,
      });
    }

    console.log(`Player ${storedName} is setting readyNight to:`, newReadyState);
    socket.emit('toggleReadyNight', { playerName: storedName, isReady: newReadyState });
  };

  // Seer: request reveal result for target; allow single choice
  const handleRevealRole = (targetName) => {
    setSeerReady(true);
    if (selectedPlayer) return; // prevent second selection
    setSelectedPlayer(targetName);
    socket.emit('seerRevealRole', { seerName: storedName, targetName });
  };

  // Shield selection (block if already "ready")
  const handleShieldSelect = (target) => {
    if (isReady) return;
    setShieldTarget(target);
  };

  // Witch: death potion target toggle
  const handleDeathPotionSelect = (target) => {
    setDeathTarget(deathTarget === target ? null : target);
  };

  // Witch: choose whether to use life potion
  const handleLifeChoice = (choice) => {
    setLifeChoice(lifeChoice === choice ? null : choice);
  };

  // Load facts/jokes from public file
  useEffect(() => {
    fetch('/facts_and_jokes.txt')
      .then(response => response.text())
      .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        setMessages(lines);
        setCurrentMessage(lines[Math.floor(Math.random() * lines.length)]);
      })
      .catch(err => console.error('Error loading messages:', err));
  }, []);

  // Pick a new random message
  const fetchNewMessage = () => {
    if (messages.length > 0) {
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      setCurrentMessage(randomMessage);
    }
  };

  // Auto-scroll wolves chat to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Seer reveal result listener
  useEffect(() => {
    socket.on('seerRevealResult', ({ targetName, targetRole }) => {
      console.log(`התקבלה תוצאה מהשרת: ${targetName} הוא ${targetRole}`);
      setRevealedRole(`השחקן ${targetName} הוא בתפקיד ${targetRole}`);
      setSeerReady(true);
    });
  
    return () => {
      socket.off('seerRevealResult');
    };
  }, []);

  // Roles structure setup, wolves room join, elder/cupid effects, wolves actions/chat, night→day
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

      // Determine this player's role; initialize witch potion flags from server state
      for (const [roleName, playersList] of Object.entries(data)) {
        const player = playersList.find((p) => p.name === storedName);
        if (player) {
          playerRole = roleName;
          if (roleName.includes('מכשפה')) {
            setUsedDeathPotion(player.usedDeathPotion);
            setUsedLifePotion(player.usedLifePotion);
          }
          break;
        }
      }

      setRole(playerRole);
      console.log('Assigned role:', playerRole);
     
      // If wolf, join wolves room (once)
      if (playerRole.includes('זאב')) {
        if (!hasJoinedWolvesRoom) {
          socket.emit('requestRole', storedName);
          setHasJoinedWolvesRoom(true);
          console.log(`${storedName} מבקש להצטרף לחדר הזאבים`);
        }
      }

      // Elder presence & alive state
      for (const [roleName, players] of Object.entries(data)) {
        players.forEach(player => {
          if (roleName.includes('זקן השבט')) {
            elderInGame = true;
            if (!player.isAlive) {
              elderAlive = false;
            }
          }
        });
      }
      setOlderInTheGame(elderInGame);
      setOlderAlive(elderAlive);

      // Build lists: alive others, alive (including self), wolves (excluding self)
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
      if (aliveWolves.length > 0) {
        setWolves(aliveWolves);
      } else {
        aliveWolves.push({ name: 'אין איתך זאבים חיים' });
        setWolves(aliveWolves);
      }

      // Cupid: show lovers modal if current player was chosen
      const cupidRole = Object.keys(data).find((role) => role.includes('קופידון'));
      if (cupidRole) {
        // Simple formatter that inserts a <br /> every 6 words
        const formatMessage = (text) => {
          const words = text.split(' ');
          let formattedText = '';
          for (let i = 0; i < words.length; i++) {
            formattedText += words[i] + ' ';
            if ((i + 1) % 6 === 0) {
              formattedText += '<br />';
            }
          }
          return formattedText.trim();
        };

        const cupid = data[cupidRole][0];
        console.log('Cupid details:', cupid);

        if (cupid.lover === storedName) {
          const rawMessage = `הקופידון ${cupid.name} בחר בך כנאהב. עליכם להישאר יחד במשחק, וזה אומר שאם אחד ממכם יצא מהמשחק אז גם השני יצא מהמשחק.`;
          const formattedMessage = formatMessage(rawMessage);
          setMessage(formattedMessage);
          setIsModalOpen(true);
        }
      }
    
      setIsLoading(false);
      // *** previous listeners are cleaned below ***
    };

    requestRoles();

    // Avoid dup listeners before attaching
    socket.off('wolfChatMessage');

    socket.on('rolesStructure', handleRolesUpdate);

    // Wolves: receive other wolves' target selection updates (de-duplicate per sender)
    socket.on('wolfTargetUpdate', ({ senderName, senderRole, targetName }) => {
      if (senderName !== storedName) {
        setWolfMessages((prev) => [
          ...prev.filter((msg) => !msg.includes(senderName)),
          `${senderRole} ${senderName} לחץ על ${targetName} כמטרה.`,
        ]);
      }
    });

    // Wolves: chat listener
    socket.on('wolfChatMessage', ({ senderName, message }) => {
      console.log(`התקבלה הודעה מהשרת מ-${senderName}: ${message}`);
      setChatMessages((prev) => [...prev, `${senderName}: ${message}`]);
    });

    // Everyone ready at night → navigate to Day
    socket.on('allPlayersReadyNight', () => {
      console.log('Switching to DayPage');
      window.dispatchEvent(new Event('gameNavigation'));
      window.history.pushState(null, '', '/day');
      window.location.href = '/day';
    });

    // Witch: receive wolves' final target
    socket.on('wolfFinalTarget', (target) => {
      console.log('המטרה הסופית שהתקבלה אצל המכשפה:', target);
      setWolfFinalTarget(target);
      setAwaitWolfVote(false);
    });

    return () => {
      socket.off('rolesStructure', handleRolesUpdate);
      socket.off('wolfTargetUpdate');
      socket.off('wolfChatMessage');
      socket.off('allPlayersReadyNight');
      socket.off('wolfFinalTarget');
    };
  }, []);

  // Keep noActionRoles in sync with elder state and witch potions;
  // auto-ready for roles with no night actions
  useEffect(() => {
    console.log("olderInTheGame ", olderInTheGame);
    console.log("olderAlive ", olderAlive);
  
    let updatedNoActionRoles = [...noActionRoles];
    
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
  
    const rolesHaveChanged =
      updatedNoActionRoles.length !== noActionRoles.length ||
      updatedNoActionRoles.some((role, index) => role !== noActionRoles[index]);

    console.log("updatedNoActionRoles: ", updatedNoActionRoles);

    if (rolesHaveChanged) {
      setNoActionRoles(updatedNoActionRoles);
    }
    console.log("NoActionRoles: ", noActionRoles);

    // If this role has no actions, auto-mark ready once
    if (noActionRoles.includes(role) && !isReady) {
      console.log(`${role} is in noActionRoles and should be ready.`);
      setIsReady(true);
      socket.emit('toggleReadyNight', { playerName: storedName, isReady: true });
    }
  
    return () => {
      socket.off('toggleReadyNight');
    };
  }, [usedLifePotion, usedDeathPotion, olderAlive, olderInTheGame, role, isReady, noActionRoles]);
  
  // Wolves: select target (blocked if already ready)
  const handleTargetSelect = (target) => {
    if (isReady) return;
    setSelectedTarget(target);
  };

  // Wolves: send chat message (server echoes back; no local push)
  const sendChatMessage = () => {
    if (chatInput.trim()) {
      socket.emit('wolfChatMessage', {
        senderName: storedName,
        message: chatInput,
      });
      setChatInput(''); // clear input box
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

          {/* Elder died → disable night actions for everyone (message) */}
          {noActionRoles.includes(role) && !role.includes('זאב') && olderInTheGame && !olderAlive && (
            <div className="no-acts" style={{ marginTop: '20px' }}>
              <h2>לא ניתן לבצע פעולות בלילה זה, זקן השבט מת.</h2>
            </div>
          )}

          {/* Generic "no night action" block, with joke/fact */}
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

          {/* Witch: death potion (before wolves' final) */}
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

          {/* Witch: life potion decision after wolves' final target */}
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

          {/* Witch: waiting notice before wolves finalize */}
          {role.includes('מכשפה') && awaitWolfVote && !usedLifePotion && !noActionRoles.includes(role) &&(
            <h2>המתיני להצבעת הזאבים על מנת לבחור האם לתת שיקוי חיים...</h2>
          )}

          {/* Shield: pick target (cannot self twice in a row; disabled when ready) */}
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
                    disabled={isReady || (player.name === storedName && player.shildSelf)}
                    onClick={() => handleShieldSelect(player.name)}
                  >
                    {player.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Seer: pick one player to reveal (then locked) */}
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
                    disabled={seerReady}
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

          {/* Wolves: show teammates */}
          {role.includes('זאב') && (
            <div className="wolf-messages">
              <h2 style={{ color: 'black' }}>הזאבים שחיים איתך הם:</h2>
              {wolves.map((player, index) => (
                <h2 key={index} style={{ color: 'black', fontSize: "23px" }}>{player.name}</h2>
              ))}
            </div>
          )}

          {/* Wolves: actions feed */}
          {role.includes('זאב') && (
            <div className="wolf-messages">
              <h2 style={{ color: 'black' }}>פעולות הזאבים האחרים:</h2>
              {wolfMessages.map((msg, index) => (
                <p key={index} style={{ color: 'black', fontSize: "23px" }}>{msg}</p>
              ))}
            </div>
          )}

          {/* Wolves: choose nightly target */}
          {role.includes('זאב') && (
            <div>
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

          {/* Global Ready button (hidden for no-action roles) */}
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
      
          {/* Wolves chat block */}
          {role.includes('זאב') && (
            <div className="wolf-chat" style={{ marginBottom: '20px', marginTop: '120px' }}>
              {/* Chat messages box */}
              <div
                style={{
                  height: '160px',
                  overflowY: 'auto',
                  border: '1px solid gray',
                  padding: '5px',
                  marginBottom: '10px',
                  width: '80%',
                  backgroundColor: 'white',
                }}
              >
                <div className="chat-box">
                  {chatMessages.map((msg, index) => (
                    <p key={index}>{msg}</p>
                  ))}
                </div>

                <div ref={messagesEndRef}></div>
              </div>

              {/* Chat input and send button */}
              <div>
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
