import React, { useEffect, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';

import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';
import RolePage from './pages/RolePage';
import NightPage from './pages/NightPage';
import DayPage from './pages/DayPage';
import DeadPage from './pages/DeadPage';
import EndGamePage from './pages/EndGamePage';
import VotePage from './pages/VotePage';
import MayorPage from './pages/MayorPage';
import CreateRoomPage from './pages/CreateRoomPage';

import './styles/styles.css';

function App() {
  const navigate = useNavigate();
  const isProgrammaticNavigation = useRef(false); // משתנה לזיהוי מעבר יזום

  useEffect(() => {
    // מאזין לאירועי חזור בדפדפן
    const handlePopState = (event) => {
      if (!isProgrammaticNavigation.current) {
        const shouldLeave = window.confirm('אתה עומד לאבד את הנתונים שלך. האם אתה בטוח?');
        if (!shouldLeave) {
          window.history.forward(); // מחזיר את הדפדפן לעמוד הנוכחי
        }
      }
    };
    

    // מאזין לאירועי רענון
    const handleBeforeUnload = (event) => {
      if (!isProgrammaticNavigation.current) {
        event.preventDefault();
        event.returnValue = 'אתה עומד לאבד את הנתונים שלך. האם אתה בטוח?';
      }
    };

    // סימון מעבר יזום דרך המשחק
    const handleGameNavigation = () => {
      isProgrammaticNavigation.current = true; // מעבר מתוכנן
      window.history.pushState(null, '', window.location.href); // דוחף היסטוריה למניעת חזור
      setTimeout(() => {
        isProgrammaticNavigation.current = false; // איפוס
      }, 500);
    };

    // הוספת מאזינים
    window.addEventListener('popstate', handlePopState); // כפתור חזור
    window.addEventListener('beforeunload', handleBeforeUnload); // רענון דף
    window.addEventListener('gameNavigation', handleGameNavigation); // ניווט יזום

    // ניקוי מאזינים כשמתנתק
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('gameNavigation', handleGameNavigation);
    };
  }, []);

  return (
<Routes>
  {/* <Route path="/" element={<CreateRoomPage />} /> */}
  <Route path="/" element={<HomePage />} />
  <Route path="/settings" element={<SettingsPage />} />
  <Route path="/role" element={<RolePage />} />
  <Route path="/night" element={<NightPage />} />
  <Route path="/day" element={<DayPage />} />
  <Route path="/dead" element={<DeadPage />} />
  <Route path="/endgame" element={<EndGamePage />} />
  <Route path="/vote" element={<VotePage />} />
  <Route path="/mayor" element={<MayorPage />} />
</Routes>
  );
}

export default App;
