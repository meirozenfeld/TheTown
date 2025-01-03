import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../components/SettingsPage/SettingsPage.css';
import WolvesCounter from '../components/SettingsPage/WolvesCounter';
import ToggleSwitch from '../components/SettingsPage/ToggleSwitch';
import { io } from 'socket.io-client';

const SettingsPage = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    wolvesCount: 2,
    elder: false,
    shield: false,
    seer: false,
    witch: false,
    hunter: false,
    cupid: false,
    leech: false,
  });
  const [isManager, setIsManager] = useState(false);
  const [firstPlayerName, setFirstPlayerName] = useState(null);
  const [currentPlayerName, setCurrentPlayerName] = useState(null);
  const [isWaitingForSettings, setIsWaitingForSettings] = useState(false);
  const [socket, setSocket] = useState(null);
  const [playerCount, setPlayerCount] = useState(0);


  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);
  
    const storedCurrentPlayerName = sessionStorage.getItem('playerName');
    setCurrentPlayerName(storedCurrentPlayerName);
  
    newSocket.on('setFirstPlayer', (firstPlayer) => {
      // console.log('First Player:', firstPlayer);
      setFirstPlayerName(firstPlayer);
      setIsManager(firstPlayer === storedCurrentPlayerName);
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
      setSettings(parsedSettings);
    }
  }, []);

const handleSave = async () => {
    const selectedRoles = Object.values(settings).filter(value => value === true).length;
    const remainingPlayers = playerCount - settings.wolvesCount - selectedRoles;

    if (remainingPlayers < 0) {
      alert('לא ניתן לבחור יותר תפקידים מאשר כמות השחקנים במשחק.');
      return;
    }

    try {
      localStorage.setItem('settings', JSON.stringify(settings));
      const response = await fetch('http://localhost:5000/api/settings', {
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
  
  
  // If not the manager, show waiting message
  if (isWaitingForSettings || !isManager) {
    return (
      <div className="settings-page">
        <h1 className="settings-title">המתן</h1>
        <p>
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

          <div className="settings-section-wolves">
          <WolvesCounter
          wolvesCount={settings.wolvesCount}
          onChange={(value) => {
            const maxWolves = playerCount - 2;
            const newValue = Math.min(Math.max(2, value), maxWolves);
            setSettings({ ...settings, wolvesCount: newValue });
          }}
        />
          </div>
          <div className="settings-section">
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