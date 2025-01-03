import React, { useState, useEffect } from 'react';
import './SettingsPage.css';

const ToggleSwitch = ({ title, onChange, isOn: initialIsOn }) => {
  const [isOn, setIsOn] = useState(initialIsOn || false);

  useEffect(() => {
    setIsOn(initialIsOn); // עדכון הערך כאשר ההגדרות נטענות
  }, [initialIsOn]);

  const toggleSwitch = () => {
    const newIsOn = !isOn;
    setIsOn(newIsOn);
    onChange(newIsOn); // עדכון ההגדרה בסטייט הראשי של SettingsPage
  };

  return (
    <div className="toggle-switch-container">
      <h2 className="switch-title">{title}</h2>
      <div
        className={`toggle-switch ${isOn ? 'switch-on' : 'switch-off'}`}
        onClick={toggleSwitch}
      >
        <div className="switch-circle"></div>
      </div>
    </div>
  );
};

export default ToggleSwitch;
