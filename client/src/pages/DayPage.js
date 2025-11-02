// DayPage.jsx
// Purpose: Day phase screen for the Town Game. Handles:
// - Restoring and showing night results
// - Listening to server navigation signals (vote/mayor/endgame/dead)
// - Hunter decision flow & notifications
// - Player readiness toggle for the day phase
// Notes:
// * Logic kept intact; comments translated & tightened for clarity.
// * No code omitted; only concise, industry-style comments were added.

import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import TopBar from '../components/topBar';

// Socket connection (shared per module)
const socket = io('https://town-game-server.onrender.com');

function DayPage() {
  // Player identity & role
  const [playerName, setPlayerName] = useState('');
  const [role, setRole] = useState('');

  // Player lifecycle & readiness
  const [isAlive, setIsAlive] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [elderDead, setElderDead] = useState(false);

  // Hunter flow
  const [hunterMessage, setHunterMessage] = useState([]); // array of messages
  const [isHunter, setIsHunter] = useState(false);
  const [targets, setTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [isChoosing, setIsChoosing] = useState(false);
  const [waitingForHunter, setWaitingForHunter] = useState(false);
  const [hunterName, setHunterName] = useState('');

  // Day-page messages (night results + dynamic messages)
  const [message, setMessage] = useState([]); // array of strings

  // Persisted flags & loading
  const hunterChoseTarget = sessionStorage.getItem('hunterChoseTarget');
  const [isLoading, setIsLoading] = useState(true);

  // Toggle readiness for the day phase
  const toggleReady = () => {
    const newReadyState = !isReady;
    setIsReady(newReadyState);

    socket.emit('toggleReadyDay', {
      playerName,
      isReadyDay: newReadyState,
    });
  };

  // Elder status listener + initial request for roles structure
  useEffect(() => {
    socket.on('elderStatus', ({ elderDead }) => {
      setElderDead(elderDead);
      console.log('Elder status updated:', elderDead);
    });

    socket.emit('requestRolesStructure'); // initial roles snapshot

    return () => {
      socket.off('elderStatus');
    };
  }, []);

  // Initial navigation listeners (server-driven)
  useEffect(() => {
    // Mark "first night" as false when entering the day
    sessionStorage.setItem('isFirstNight', 'false');
    console.log('isFirstNight set to FALSE in sessionStorage');

    const storedName = sessionStorage.getItem('playerName');
    if (storedName) setPlayerName(storedName);

    socket.on('navigateToEndGame', () => {
      window.dispatchEvent(new Event('gameNavigation'));
      window.history.pushState(null, '', '/endgame');
      window.location.href = '/endgame';
    });

    socket.on('navigateToVote', () => {
      window.dispatchEvent(new Event('gameNavigation'));
      socket.emit('checkGameStatus');
      window.history.pushState(null, '', '/vote');
      window.location.href = '/vote';
    });

    socket.on('navigateToMayor', () => {
      socket.emit('checkGameStatus');
      window.dispatchEvent(new Event('gameNavigation'));
      window.history.pushState(null, '', '/mayor');
      window.location.href = '/mayor';
    });

    return () => {
      socket.off('navigateToEndGame');
      socket.off('navigateToVote');
      socket.off('navigateToMayor');
    };
  }, []);

  // Restore day messages from sessionStorage (night results + hunter result)
  useEffect(() => {
    const savedMessages = sessionStorage.getItem('nightResults');
    const hunterMessage = sessionStorage.getItem('hunterResult');

    if (savedMessages) {
      setMessage(JSON.parse(savedMessages));
    }
    if (hunterMessage) {
      setHunterMessage(JSON.parse(hunterMessage));
    }
  }, []);

  // Resolve roles structure to determine player's current role and isAlive
  useEffect(() => {
    console.log('waitingForHunter1 ', waitingForHunter);

    const storedName = sessionStorage.getItem('playerName');
    if (storedName) {
      setPlayerName(storedName);
    }

    socket.emit('requestRolesStructure');

    socket.on('rolesStructure', (rolesStructure) => {
      const player = Object.values(rolesStructure)
        .flat()
        .find((p) => p.name === storedName);

      if (player) {
        const roleName = Object.entries(rolesStructure).find(([_, players]) =>
          players.includes(player)
        )[0];
        setRole(roleName);

        if (!player.isAlive) {
          setIsAlive(false);
        }
      }
    });

    socket.on('gameEnd', (result) => {
      console.log('Game Ended:', result);
      sessionStorage.setItem('gameResult', result);
    });

    return () => {
      socket.off('rolesStructure');
      socket.off('gameEnd');
    };
  }, []); // run once

  // Append async hunter messages that arrive during the day
  useEffect(() => {
    socket.on('hunterMessage', (message) => {
      console.log('Hunter message received:', message);
      setMessage((prev) => [...prev, message]);
    });

    return () => {
      socket.off('hunterMessage');
    };
  }, []);

  // Request night results from server and display them
  useEffect(() => {
    console.log('waitingForHunter2 ', waitingForHunter);

    const storedName = sessionStorage.getItem('playerName');
    socket.emit('currentPlayer', storedName);

    socket.emit('requestNightResults');
    socket.on('nightResult', (resultMessage) => {
      console.log('Night results from server:', resultMessage);
      const messagesArray = resultMessage.split('\n');
      setMessage(messagesArray);

      // Persist for Dead page
      sessionStorage.setItem('nightResults', JSON.stringify(messagesArray));
    });

    socket.emit('checkGameStatus');
    setIsLoading(false);

    return () => {
      socket.off('currentPlayer');
      socket.off('requestNightResults');
      socket.off('nightResult');
      socket.off('checkGameStatus');
    };
  }, []);

  // If player is dead, navigate to DeadPage
  useEffect(() => {
    if (!isAlive) {
      window.dispatchEvent(new Event('gameNavigation'));
      window.history.pushState(null, '', '/dead');
      window.location.href = '/dead';
    }
  }, [isAlive]);

  // Server-driven navigation to Dead (e.g., hunter action)
  useEffect(() => {
    socket.on('navigateToDead', ({ message }) => {
      console.log('NavigateToDead message received:', message);
      sessionStorage.setItem('nightResults', JSON.stringify([message]));
      window.dispatchEvent(new Event('gameNavigation'));
      window.history.pushState(null, '', '/dead');
      window.location.href = '/dead';
    });

    return () => {
      socket.off('navigateToDead');
    };
  }, []);

  // Hunter waiting state (show banner while hunter decides)
  useEffect(() => {
    socket.on('hunterWaitingDecision', ({ hunterName }) => {
      console.log('waitingForHunter3 ', waitingForHunter);

      // Do not show duplicate waiting message if already chosen
      const hunterChose = sessionStorage.getItem('hunterChoseTarget');
      if (hunterChose === 'true') {
        console.log('Hunter already chose a target. Skipping duplicate notice.');
        return;
      }

      setWaitingForHunter(true);
      setHunterName(hunterName);
      console.log('waitingForHunter4 ', waitingForHunter);
    });

    // In case player joined late, request the hunter status
    socket.emit('hunterCheckStatus', { playerName });

    return () => {
      socket.off('hunterWaitingDecision');
    };
  }, []);

  // Hunter finished decision
  useEffect(() => {
    socket.on('hunterFinished', ({ hunterName, targetName, targetRole }) => {
      socket.emit('requestRolesStructure');
      sessionStorage.setItem('hunterChoseTarget', 'true');
      setWaitingForHunter(false);
      setHunterMessage([
        `הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}!`,
      ]);

      const storedName = sessionStorage.getItem('playerName');

      if (storedName === targetName) {
        // If current player is the target → navigate to Dead
        sessionStorage.setItem(
          'nightResults',
          JSON.stringify([`${hunterName} בתפקיד צייד החליט לצוד אותך!`])
        );
        window.dispatchEvent(new Event('gameNavigation'));
        window.history.pushState(null, '', '/dead');
        window.location.href = '/dead';
      } else {
        sessionStorage.setItem(
          'hunterResult',
          JSON.stringify([
            `הצייד ${hunterName} החליט לצוד את ${targetName} בתפקיד ${targetRole}!`,
          ])
        );
      }

      if (!isAlive) {
        // If player is already dead, still ensure navigation & messaging
        sessionStorage.setItem(
          'nightResults',
          JSON.stringify([
            `${hunterName} בתפקיד צייד החליט לצוד את ${targetName} ובגלל שאתם נאהבים, גם אתה יצאת מהמשחק!`,
          ])
        );
        window.dispatchEvent(new Event('gameNavigation'));
        window.history.pushState(null, '', '/dead');
        window.location.href = '/dead';
      }
    });

    return () => {
      socket.off('hunterFinished');
    };
  }, []);

  // Hunter finished without elder (ack only)
  useEffect(() => {
    socket.on('hunterFinishedNoElder', () => {
      sessionStorage.setItem('hunterChoseTarget', 'true');
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
        <br />

        {/* Night results */}
        {message.length > 0 && message.map((msg, index) => <c key={index}>{msg}</c>)}
        <br />

        {/* Hunter message */}
        {hunterMessage.length > 0 && !hunterChoseTarget &&
          hunterMessage.map((msg, index) => <p key={index}>{msg}</p>)}
        <br />

        {/* Waiting banner for hunter decision (unless elder is dead) */}
        {!elderDead && waitingForHunter && (
          <c>המתן בזמן ש- {hunterName} הצייד יחליט את מי לצוד...</c>
        )}
        <br />

        {/* Ready button shown unless waiting for hunter (or if elder is dead) */}
        {(!waitingForHunter || elderDead) && (
          <button
            style={{ backgroundColor: isReady ? '#108f14' : '#7e1109' }}
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
