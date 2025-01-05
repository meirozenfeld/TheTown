import React from 'react';
import './SettingsPage.css';

const WolvesCounter = ({ wolvesCount, onChange }) => {
  const increment = () => onChange(Math.min(wolvesCount + 1, 10));  // עדכון הערך לפי הלחיצה
  const decrement = () => onChange(Math.max(wolvesCount - 1, 2));  // עדכון הערך לפי הלחיצה

  return (
<div className="wolves-counter">
  <h2 className="feature-title">זאבים</h2>
  <div className="counter-controls">
    <button className="counter-button" onClick={decrement}>−</button>
    <span className="wolves-number">{wolvesCount}</span>
    <button className="counter-button" onClick={increment}>+</button>
  </div>
</div>


  );
};

export default WolvesCounter;
