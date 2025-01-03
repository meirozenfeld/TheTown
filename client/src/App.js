// App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage'; // דף הגדרות חדש
import RolePage from './pages/RolePage';
import NightPage from './pages/NightPage';
import DayPage from './pages/DayPage';
import DeadPage from './pages/DeadPage';
import EndGamePage from './pages/EndGamePage';
import VotePage from './pages/VotePage';
import MayorPage from './pages/MayorPage';
import TopBar from './components/topBar';

import './styles/styles.css'; // Import the CSS

function App() {

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/settings" element={<SettingsPage />} /> {/* דף הגדרות */}
        <Route path="/role" element={<RolePage />} /> {/* דף תפקיד */}
        <Route path="/night" element={<NightPage />} /> {/* דף לילה */}
        <Route path="/day" element={<DayPage />} />
        <Route path="/dead" element={<DeadPage />} />
        <Route path="/endgame" element={<EndGamePage />} />
        <Route path="/vote" element={<VotePage />} />
        <Route path="/mayor" element={<MayorPage />} />

      </Routes>
    </Router>
  );
}

export default App;
