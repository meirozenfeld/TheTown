import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../components/SettingsPage/SettingsPage.css';
import WolvesCounter from '../components/SettingsPage/WolvesCounter';
import TimeTownCounter from '../components/SettingsPage/TimeTownCounter';
import TimeMayorCounter from '../components/SettingsPage/TimeMayorCounter';
import ToggleSwitch from '../components/SettingsPage/ToggleSwitch';
import { io } from 'socket.io-client';


const SettingsPage = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    wolvesCount: 1,
    elder: false,
    shield: false,
    seer: false,
    witch: false,
    hunter: false,
    cupid: false,
    leech: false,
    townTime: 1,
    mayorTime: 1,
  });
  const [isManager, setIsManager] = useState(false);
  const [firstPlayerName, setFirstPlayerName] = useState(null);
  const [currentPlayerName, setCurrentPlayerName] = useState(null);
  const [isWaitingForSettings, setIsWaitingForSettings] = useState(false);
  const [socket, setSocket] = useState(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const playersNumber = sessionStorage.getItem('playersNumber');


  useEffect(() => {
    const newSocket = io('https://town-game-server.onrender.com');
    setSocket(newSocket);
  
    const storedCurrentPlayerName = sessionStorage.getItem('playerName');
    setCurrentPlayerName(storedCurrentPlayerName);
  
    newSocket.on('setFirstPlayer', (firstPlayer) => {
      // console.log('First Player:', firstPlayer);
      setFirstPlayerName(firstPlayer);
      setIsManager(firstPlayer === storedCurrentPlayerName);
      setIsLoading(false);
    });

 newSocket.on('updatePlayers', (playersList) => {
      setPlayerCount(playersList.length);
    });

    newSocket.on('notifyPlayers', (message) => {
      if (!isManager) {
        setIsWaitingForSettings(true);
        alert(message);
      }
    });

    newSocket.on('navigateToRolePage', () => {
      window.dispatchEvent(new Event('gameNavigation'));
      window.history.pushState(null, '', '/role'); // עדכון היסטוריה

      navigate('/role');
    });
  
    return () => {
      newSocket.disconnect();
    };
  }, [navigate]);
  

  // Load saved settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('settings');
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings);
      setSettings({
        ...parsedSettings,
        wolvesCount: parsedSettings.wolvesCount || 1,
        townTime: parsedSettings.townTime || 1,
        mayorTime: parsedSettings.mayorTime || 1,
      });
    }
  }, []);

const handleSave = async () => {
      if (settings.townTime < 1 || settings.townTime > 10) {
        alert('זמן הצבעת העיירה חייב להיות בין 1 ל-10 דקות.');
        return;
      }
      if (settings.mayorTime < 1 || settings.mayorTime > 10) {
        alert('זמן הצבעת ראש העיר חייב להיות בין 1 ל-10 דקות.');
        return;
      }
    const selectedRoles = Object.values(settings).filter(value => value === true).length;
    const remainingPlayers = playerCount - settings.wolvesCount - selectedRoles;

    if (remainingPlayers < 0) {
      alert('לא ניתן לבחור יותר תפקידים מאשר כמות השחקנים במשחק.');
      return;
    }

    try {
      localStorage.setItem('settings', JSON.stringify(settings));
      const response = await fetch('https://town-game-server.onrender.com/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
  
      if (response.ok) {
        socket.emit('assignRoles', settings);
        socket.emit('settingsUpdated');
      } else {
        alert('שגיאה בשמירת ההגדרות.');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('שגיאה בשמירת ההגדרות.');
    }
  };
  
  
 if (isLoading) {
    return <h1>טוען נתונים...</h1>;
  }
  // If not the manager, show waiting message
  if ((isWaitingForSettings || !isManager) && !isLoading) {
    return (
    <div className="settings-page">
      <h1 className="settings-title2">המתן</h1>
      <p className="settings-paragraph">
        {!isManager 
          ? `רק המנהל (${firstPlayerName}) יכול לערוך את הגדרות המשחק` 
          : 'אנא המתן בזמן שהמנהל עורך את הגדרות המשחק...'}
      </p>
    </div>
    );
  }



  return (
    <div className="settings-page">
      <h1 className="settings-title">הגדרות</h1>

          <div className="feature-title">
          <h3>שחקנים במשחק: {playersNumber}</h3>
            <TimeTownCounter
              townTime={settings.townTime}
              onChange={(value) => {
                const newValue = Math.max(1, Math.min(10, value));
                setSettings({ ...settings, townTime: newValue });
              }}
            />
          </div>
           <div className="feature-title">
            <TimeMayorCounter
              mayorTime={settings.mayorTime}
              onChange={(value) => {
                const newValue = Math.max(1, Math.min(10, value));
                setSettings({ ...settings, mayorTime: newValue });
              }}
            />
          </div>
          <div className="feature-title">
          <WolvesCounter
          wolvesCount={settings.wolvesCount}
          onChange={(value) => {
            const maxWolves = playerCount - 2;
            const newValue = Math.min(Math.max(1, value), maxWolves);
            setSettings({ ...settings, wolvesCount: newValue });
          }}
        />
          </div>
          <div className="feature-title">
            <ToggleSwitch
              title="זקן השבט"
              onChange={(value) => setSettings({ ...settings, elder: value })}
              isOn={settings.elder}
            />
            <ToggleSwitch
              title="מגן"
              onChange={(value) => setSettings({ ...settings, shield: value })}
              isOn={settings.shield}
            />
            <ToggleSwitch
              title="מגדת עתידות"
              onChange={(value) => setSettings({ ...settings, seer: value })}
              isOn={settings.seer}
            />
            <ToggleSwitch
              title="מכשפה"
              onChange={(value) => setSettings({ ...settings, witch: value })}
              isOn={settings.witch}
            />
            <ToggleSwitch
              title="צייד"
              onChange={(value) => setSettings({ ...settings, hunter: value })}
              isOn={settings.hunter}
            />
            <ToggleSwitch
              title="קופידון"
              onChange={(value) => setSettings({ ...settings, cupid: value })}
              isOn={settings.cupid}
            />
            <ToggleSwitch
              title="עלוקה"
              onChange={(value) => setSettings({ ...settings, leech: value })}
              isOn={settings.leech}
            />
            <h3>שאר השחקנים יקבלו את תפקיד האזרח</h3>

          </div>
          <div className="settings-buttons">
            <button className="save-button" onClick={handleSave}>
              שמור הגדרות
            </button>
          </div>
    </div>
  );
};

export default SettingsPage;
