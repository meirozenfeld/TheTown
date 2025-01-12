import React from 'react';
import './SettingsPage.css';

const TimeTownCounter = ({ townTime, onChange }) => {
  const increment = () => onChange(Math.min(townTime + 1, 10));  // עדכון הערך לפי הלחיצה
  const decrement = () => onChange(Math.max(townTime - 1, 1));  // עדכון הערך לפי הלחיצה

  return (
<div className="wolves-counter">
<h2 className="feature-title">זמן הצבעת בוקר העיירה</h2>
  <div className="counter-controls">
    <button className="counter-button" onClick={decrement}>−</button>
    <span className="wolves-number">{townTime}</span>
    <button className="counter-button" onClick={increment}>+</button>
  </div>
</div>


  );
};

export default TimeTownCounter;