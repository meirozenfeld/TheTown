import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('https://town-game-server.onrender.com');

function EndGamePage() {
    const [resultMessage, setResultMessage] = useState('');
    const [playersRoles, setPlayersRoles] = useState([]);
    const [alivePlayers, setAlivePlayers] = useState([]);

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
        const settings = sessionStorage.getItem('settings');
        sessionStorage.clear(); // ניקוי כל הנתונים
        if (settings) {
            sessionStorage.setItem('settings', settings); // שחזור הגדרות
        }
        socket.emit('resetGame'); // איפוס נתוני המשחק הנוכחי
        socket.emit('restartServer'); // אתחול השרת
        window.location.href = '/';
    };

    return (
        <div className="end-game-page">
            <h1>המשחק נגמר!</h1>
            <h2>{resultMessage}</h2>
            <h3>רשימת השחקנים החיים:</h3>
            <ul>
                {alivePlayers.map((player, index) => (
                    <li key={index}>
                        השחקן {player.name} היה בתפקיד {player.role}
                    </li>
                ))}
            </ul>
            <h3>רשימת כל השחקנים והתפקידים:</h3>
            <ul>
                {playersRoles.map((player, index) => (
                    <li key={index}>
                        השחקן {player.name} היה בתפקיד {player.role}.
                    </li>
                ))}
            </ul>
                {/* כפתור לאיפוס המשחק */}
                  <button onClick={handleResetGame} style={{ marginTop: '20px' }}>
                חזרה לדף הבית והתחלת משחק חדש
            </button>
        </div>
    );
}

export default EndGamePage;
