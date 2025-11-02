// App.jsx
// Purpose: Define client-side routes and guard against accidental navigation.
// Behavior:
// - Registers listeners to warn on back/refresh unless navigation is programmatic
// - Emits/handles a custom "gameNavigation" event to mark intentional route changes
// - Declares all app routes

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
  const isProgrammaticNavigation = useRef(false); // flag to detect intentional navigation

  useEffect(() => {
    // Handle browser back/forward button
    const handlePopState = (event) => {
      if (!isProgrammaticNavigation.current) {
        const shouldLeave = window.confirm('אתה עומד לאבד את הנתונים שלך. האם אתה בטוח?');
        if (!shouldLeave) {
          window.history.forward(); // return user to current page
        }
      }
    };

    // Handle page refresh/close
    const handleBeforeUnload = (event) => {
      if (!isProgrammaticNavigation.current) {
        event.preventDefault();
        event.returnValue = 'אתה עומד לאבד את הנתונים שלך. האם אתה בטוח?';
      }
    };

    // Mark intentional in-app navigation (fired by pages before redirect)
    const handleGameNavigation = () => {
      isProgrammaticNavigation.current = true; // planned navigation
      window.history.pushState(null, '', window.location.href); // push to history to mitigate back
      setTimeout(() => {
        isProgrammaticNavigation.current = false; // reset after short delay
      }, 500);
    };

    // Register listeners
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('gameNavigation', handleGameNavigation);

    // Cleanup on unmount
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
