import React from 'react';
import './SettingsPage.css';

const TimeMayorCounter = ({ mayorTime, onChange }) => {
  const increment = () => onChange(Math.min(mayorTime + 1, 10));  
  const decrement = () => onChange(Math.max(mayorTime - 1, 1)); 

  return (
<div className="wolves-counter">
<h2 className="feature-title">זמן הצבעת ראש העיר</h2>
  <div className="counter-controls">
    <button className="counter-button" onClick={decrement}>−</button>
    <span className="wolves-number">{mayorTime}</span>
    <button className="counter-button" onClick={increment}>+</button>
  </div>
</div>


  );
};

export default TimeMayorCounter;

