import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('https://town-game-server.onrender.com');
console.log('Socket connected:', socket.connected);

function EndGamePage() {
    const [resultMessage, setResultMessage] = useState('');
    const [playersRoles, setPlayersRoles] = useState([]);
    const [alivePlayers, setAlivePlayers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        socket.emit('requestRolesStructure'); // בקשת מבנה התפקידים
        socket.on('rolesStructure', (rolesStructure) => {
            const rolesList = [];
            const aliveList = [];
            Object.entries(rolesStructure).forEach(([role, players]) => {
                players.forEach(player => {
                    rolesList.push({ name: player.name, role }); // בניית רשימה של שמות ותפקידים
                    if (player.isAlive) { // בדיקת חיים
                        aliveList.push({ name: player.name, role });
                    }
                });
            });
            setPlayersRoles(rolesList); // עדכון המצב
            setAlivePlayers(aliveList); // עדכון רשימת השחקנים החיים
            setIsLoading(false);
        });

        socket.on('gameEnd', (result) => {
            console.log('Game Ended:', result);
            sessionStorage.setItem('gameResult', result); // שמירת התוצאה בזיכרון
        });

        return () => {
            socket.off('rolesStructure');
            socket.off('gameEnd');
        };
    }, []);
    

    useEffect(() => {
        const result = sessionStorage.getItem('gameResult'); // שליפת תוצאה
        if (result) {
            setResultMessage(result); // הצגה על המסך
        }
    }, []);

    const handleResetGame = () => {
        // בדיקה אם כבר בוצע אתחול על ידי שחקן אחר
        const firstPlayer = sessionStorage.getItem('firstPlayer');
        const currentPlayer = sessionStorage.getItem('playerName'); // שם השחקן הנוכחי
        socket.emit('resetGame');
        if (firstPlayer === currentPlayer) {
            socket.emit('restartServer');
        }
        // בכל מקרה מעבר לדף הבית
        window.dispatchEvent(new Event('gameNavigation'));
        window.history.pushState(null, '', '/');
        window.location.href = '/';
    };
    
    if (isLoading) {
        return <h1>טוען נתונים...</h1>;
      }
    return (
        <div className="end-game-page">
            <h1>המשחק נגמר!</h1>
            <br></br>
            <h2>{resultMessage}</h2>
            <br></br>
            <h3>רשימת השחקנים החיים:</h3>
            <br></br>

            <ul>
                {alivePlayers.map((player, index) => (
                    <li key={index}>
                        השחקן {player.name} היה בתפקיד {player.role}
                    </li>
                ))}
            </ul>
            <br></br>

            <h3>רשימת כל השחקנים והתפקידים:</h3>
            <br></br>

            <ul>
                {playersRoles.map((player, index) => (
                    <li key={index}>
                        השחקן {player.name} היה בתפקיד {player.role}.
                    </li>
                ))}
            </ul>
            <br></br>

                {/* כפתור לאיפוס המשחק */}
                  <button onClick={handleResetGame} style={{ marginTop: '20px' }}>
                חזרה לדף הבית והתחלת משחק חדש
            </button>
        </div>
    );
}

export default EndGamePage;
