// VotePage.jsx
// Purpose: Daytime town voting flow.
// Responsibilities:
// - Countdown for discussion time; auto-pick random vote on timeout
// - Show alive players (excluding self) and submit/confirm vote
// - Display vote results + personal votes when tallied
// - Handle hunter/elder special flows and navigation to Night/End/Dead
// Notes:
// - Logic preserved. Minor safety fix: random pick uses filtered list length.
// - Comments are concise and in English. No code omitted.

import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import TopBar from '../components/topBar';

const socket = io('https://town-game-server.onrender.com');

function VotePage() {
  const [players, setPlayers] = useState([]);
  const [selectedVote, setSelectedVote] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [voteResults, setVoteResults] = useState({});
  const [personalVotes, setPersonalVotes] = useState([]);
  const [mayorName, setMayorName] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  const [playerName, setPlayerName] = useState('');
  const [role, setRole] = useState('');
  const [isAlive, setIsAlive] = useState(true); // track if current player is alive
  const [message, setMessage] = useState([]); // general messages to show
  const [hunterMessage, setHunterMessage] = useState([]); // hunter-related message(s)
  const [isHunter, setIsHunter] = useState(false);
  const [targets, setTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [isChoosing, setIsChoosing] = useState(false); // hunter choosing state
  const [waitingForHunter, setWaitingForHunter] = useState(false);
  const [hunterName, setHunterName] = useState('');
  const [elderDead, setElderDead] = useState(false); // elder status
  const currentPlayer = sessionStorage.getItem('playerName');
  const hunterChoseTarget = sessionStorage.getItem('hunterChoseTarget');
  const [isLoading, setIsLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);

  // Get town-time setting (minutes → seconds)
  useEffect(() => {
    socket.emit('requestSettings');
    socket.on('settingsReceived', (settings) => {
      console.log('Settings received Vote:', settings);
      const townTimeInSeconds = settings.townTime * 60;
      setTimeLeft(townTimeInSeconds);
    });
    return () => {
      socket.off('settingsReceived');
    };
  }, []);

  // Countdown and auto-pick if time is over
  useEffect(() => {
    if (timeLeft > 0) {
      setIsFlashing(timeLeft <= 10);
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (!confirmed && !selectedVote && players.length > 0) {
      // Auto-select a random target (excluding self) on timeout
      const filteredPlayersTime = players.filter(p => p.name !== currentPlayer);
      const randomPlayer =
        filteredPlayersTime[Math.floor(Math.random() * filteredPlayersTime.length)];
      if (randomPlayer) {
        setSelectedVote(randomPlayer.name);
        setConfirmed(true);
        socket.emit('submitVote', {
          playerName: currentPlayer,
          voteTarget: randomPlayer.name,
        });
        socket.emit('confirmVote', {
          playerName: currentPlayer,
          confirm: true,
        });
      }
    }
  }, [timeLeft, confirmed, selectedVote, players, currentPlayer]);

  // Load alive players & current player's role; listen for aggregated vote results
  useEffect(() => {
    socket.emit('requestRolesStructure');

    socket.on('rolesStructure', (rolesStructure) => {
      const alivePlayers = Object.values(rolesStructure)
        .flat()
        .filter(p => p.isAlive);
      setPlayers(alivePlayers);
    });

    socket.on('rolesStructure', (rolesStructure) => {
      const player = Object.values(rolesStructure)
        .flat()
        .find(p => p.name === currentPlayer);
      if (player) {
        const roleName = Object
          .entries(rolesStructure)
          .find(([_, ps]) => ps.includes(player))[0];
        setRole(roleName);
        setIsLoading(false);
      }
    });

    socket.on('voteResults', ({ results, personalVotes, mayorName, electedPlayer, electedRole }) => {
      console.log('voteResults from server:', {
        results, personalVotes, mayorName, electedPlayer, electedRole,
      });
      setVoteResults(results);
      setPersonalVotes(personalVotes);
      setMayorName(mayorName);
      setSelectedVote(electedPlayer);
      setSelectedRole(electedRole);
    });

    socket.on('gameEnd', (result) => {
      console.log('Game Ended:', result);
      sessionStorage.setItem('gameResult', result);
    });

    return () => {
      socket.off('rolesStructure');
      socket.off('voteResults');
      socket.off('gameEnd');
    };
  }, [currentPlayer, selectedRole]);

  // Cupid chain-death message during day
  useEffect(() => {
    socket.on('cupidDeathMessage', ({ message }) => {
      console.log('Cupid message:', message);
      setMessage(prev => [...prev, message]);
    });
    return () => {
      socket.off('cupidDeathMessage');
    };
  }, []);

  // Navigate to Dead if server instructs (only if message is for me)
  useEffect(() => {
    socket.on('navigateToDead', ({ message }) => {
      const me = sessionStorage.getItem('playerName');
      console.log('NavigateToDead received:', message);
      const isForCurrentPlayer = message.includes(me);
      if (isForCurrentPlayer) {
        sessionStorage.setItem('nightResults', JSON.stringify([message]));
        window.dispatchEvent(new Event('gameNavigation'));
        window.history.pushState(null, '', '/dead');
        window.location.href = '/dead';
      }
    });
    return () => {
      socket.off('navigateToDead');
    };
  }, []);

  // Elder status
  useEffect(() => {
    socket.on('elderStatus', ({ elderDead }) => {
      setElderDead(elderDead);
      console.log('Elder status updated:', elderDead);
    });
    socket.emit('requestRolesStructure');
    return () => {
      socket.off('elderStatus');
    };
  }, []);

  // Restore hunter message (if any)
  useEffect(() => {
    const hunterMsg = sessionStorage.getItem('hunterResult');
    if (hunterMsg) {
      setHunterMessage(JSON.parse(hunterMsg));
    }
  }, []);

  // Hunter waiting state
  useEffect(() => {
    socket.on('hunterWaitingDecision', ({ hunterName }) => {
      console.log('hunterWaitingDecision');
      const hunterChose = sessionStorage.getItem('hunterChoseTarget');
      if (hunterChose === 'true') {
        console.log('Hunter already chose a target. Skipping wait notice.');
        return;
      }
      setWaitingForHunter(true);
      setHunterName(hunterName);
    });

    socket.emit('hunterCheckStatus', { playerName });

    return () => {
      socket.off('hunterWaitingDecision');
    };
  }, [playerName]);

  // Hunter finished flow
  useEffect(() => {
    socket.on('hunterFinished', ({ hunterName, targetName, targetRole }) => {
      setWaitingForHunter(false);

      if (targetRole === 'זקן השבט') {
        setHunterMessage([
          `הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}! \n מעכשיו ועד סוף המשחק לא יהיו לאזרחים כוחות בלילה`,
        ]);
      } else {
        setHunterMessage([`הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}!`]);
      }

      const storedName = sessionStorage.getItem('playerName');

      if (storedName === targetName) {
        sessionStorage.setItem('nightResults', JSON.stringify([
          `${hunterName} בתפקיד צייד החליט לצוד אותך!`,
        ]));
        window.dispatchEvent(new Event('gameNavigation'));
        window.history.pushState(null, '', '/dead');
        window.location.href = '/dead';
      } else {
        if (targetRole === 'זקן השבט') {
          sessionStorage.setItem('hunterResult', JSON.stringify([
            `הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}! \nמעכשיו ועד סוף המשחק לא יהיו לאזרחים כוחות בלילה`,
          ]));
        } else {
          sessionStorage.setItem('hunterResult', JSON.stringify([
            `הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}!`,
          ]));
        }
      }
      sessionStorage.setItem('hunterChoseTarget', 'true');
    });

    return () => {
      socket.off('hunterFinished');
    };
  }, []);

  // Hunter finished when elder is not in game
  useEffect(() => {
    socket.on('hunterFinishedNoElder', () => {
      sessionStorage.setItem('hunterChoseTarget', 'true');
      setWaitingForHunter(false);
    });
    return () => {
      socket.off('hunterFinishedNoElder');
    };
  }, []);

  // Select a player to vote
  const handleVote = (playerName) => {
    if (confirmed) {
      alert('הבחירה כבר נעולה! בטל את האישור כדי לשנות.');
      return;
    }
    setSelectedVote(playerName);
    socket.emit('submitVote', {
      playerName: currentPlayer,
      voteTarget: playerName,
    });
  };

  // Confirm / unlock selection
  const handleConfirm = () => {
    if (!selectedVote) {
      alert('חייב לבחור שחקן לפני לחיצה על "אשר בחירה"!');
      return;
    }
    setConfirmed(!confirmed);
    socket.emit('confirmVote', {
      playerName: currentPlayer,
      confirm: !confirmed,
    });

    if (!confirmed) {
      socket.emit('submitVote', {
        playerName: currentPlayer,
        voteTarget: selectedVote,
      });
    }
  };

  // Ready to proceed to Night / EndGame
  const handleReady = () => {
    socket.emit('checkGameStatus');
    setIsReady(!isReady);
    socket.emit('toggleVoteReady', {
      playerName: currentPlayer,
      isReady: !isReady,
    });

    socket.on('navigateToEndGame', () => {
      window.dispatchEvent(new Event('gameNavigation'));
      window.history.pushState(null, '', '/endgame');
      window.location.href = '/endgame';
    });

    socket.on('navigateToNight', () => {
      window.dispatchEvent(new Event('gameNavigation'));
      window.history.pushState(null, '', '/night');
      window.location.href = '/night';
    });
  };

  // If town eliminates me, navigate to Dead
  useEffect(() => {
    socket.on('playerDead', ({ playerName, role }) => {
      const myName = sessionStorage.getItem('playerName');
      if (playerName === myName) {
        sessionStorage.setItem('nightResults', JSON.stringify([
          `העיירה בחרה להדיח אותך בתפקיד ${role}`,
        ]));
        window.dispatchEvent(new Event('gameNavigation'));
        window.history.pushState(null, '', '/dead');
        window.location.href = '/dead';
      }
    });
    return () => {
      socket.off('playerDead');
    };
  }, []);

  // If lover chain kills me (my lover died)
  useEffect(() => {
    socket.on('playerDeadCupid', ({ playerName, role, loverRole, loverName }) => {
      const myName = sessionStorage.getItem('playerName');
      if (playerName === myName) {
        sessionStorage.setItem('nightResults', JSON.stringify([
          ` העיירה החליטה להוציא את ${loverName} בתפקיד ${loverRole}`,
          `  יצאת מהמשחק בעקבות מותו של הנאהב ${loverName}!`,
        ]));
        window.dispatchEvent(new Event('gameNavigation'));
        window.history.pushState(null, '', '/dead');
        window.location.href = '/dead';
      }
    });
    return () => {
      socket.off('playerDeadCupid');
    };
  }, []);

  // If Cupid dies and that kills me as a lover
  useEffect(() => {
    socket.on('playerDeadLover', ({ playerName, role, cupidName }) => {
      const myName = sessionStorage.getItem('playerName');
      if (playerName === myName) {
        sessionStorage.setItem('nightResults', JSON.stringify([
          ` העיירה החליטה להוציא את ${cupidName} בתפקיד קופידון`,
          ` יצאת מהמשחק בעקבות מותו של הקופידון ${cupidName}!`,
        ]));
        window.dispatchEvent(new Event('gameNavigation'));
        window.history.pushState(null, '', '/dead');
        window.location.href = '/dead';
      }
    });
    return () => {
      socket.off('playerDeadLover');
    };
  }, []);

  // Exclude current player from vote options
  const filteredPlayers = players.filter(player => player.name !== currentPlayer);

  if (isLoading) {
    return <h1>טוען נתונים...</h1>;
  }

  return (
    <div>
      <TopBar role={role} />
      <div className="vote-page">
        <h1 className='role-title'>שלום {role}!</h1>

        {Object.keys(voteResults).length > 0 ? (
          <div>
            {selectedVote && selectedRole && (
              <>
                <h4>העיירה החליטה להוציא את {selectedVote} בתפקיד {selectedRole}</h4>
                {message.length > 0 && message.map((msg, index) => (
                  <h4 key={index}>{msg}</h4>
                ))}
                {selectedRole === 'זקן השבט' && (
                  <h4>מעכשיו ועד סוף המשחק לא יהיו לאזרחים כוחות בלילה.</h4>
                )}
              </>
            )}

            {hunterMessage.length > 0 && hunterChoseTarget && (
              hunterMessage.map((msg, index) => <h4 key={index}>{msg}</h4>)
            )}

            {!elderDead && waitingForHunter && (
              <h4>המתן בזמן ש- {hunterName} הצייד יחליט את מי לצוד...</h4>
            )}

            <h4>תוצאות ההצבעות:</h4>
            {Object.entries(voteResults).map(([player, count]) => (
              <li key={player}>
                <span>{player} קיבל {count} קולות</span>
              </li>
            ))}

            <h4>בחירות אישיות:</h4>
            {personalVotes.map(({ voter, target }) => (
              <li key={voter}>
                <span>{voter} הצביע ל-{target}</span>
              </li>
            ))}

            {(!waitingForHunter || elderDead) && (
              <button
                style={{ backgroundColor: isReady ? '#108f14' : '#7e1109' }}
                onClick={handleReady}
              >
                {isReady ? 'מצב - מוכן' : 'מצב - לא מוכן'}
              </button>
            )}
          </div>
        ) : (
          <>
            <h4>
              כעת העיירה יכולה לדון - 
              אם שחקן לא נבחר בסוף הזמן, הבחירה תהיה רנדומלית 
            </h4>
            <h3 className={isFlashing ? 'flashing-timer' : ''}>
              הזמן שנותר: {Math.floor(timeLeft / 60)}:{timeLeft % 60}
            </h3>
            <h3>בחר את מי אתה רוצה להוציא מהמשחק:</h3>

            {filteredPlayers.map((player) => (
              <button
                key={player.name}
                onClick={() => handleVote(player.name)}
                disabled={confirmed}
                style={{
                  backgroundColor: selectedVote === player.name ? 'darkred' : '#424442',
                }}
              >
                {player.name}
              </button>
            ))}

            <button
              style={{ backgroundColor: confirmed ? 'darkgreen' : 'darkred' }}
              onClick={handleConfirm}
            >
              {confirmed ? 'בטל נעילה' : 'אשר בחירה'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default VotePage;
