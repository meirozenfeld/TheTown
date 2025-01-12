import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const socket = io('http://localhost:5001'); // עדכן לפי השרת שלך

function CreateRoomPage() {
  const [roomName, setRoomName] = useState('');
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    if (roomName.trim() === '') {
      alert('אנא הזן שם לחדר');
      return;
    }

    // יצירת החדר ושמירתו בשרת
    socket.emit('createRoom', { roomName });

    // מעבר לעמוד הבית עם פרמטר החדר ב-URL
    navigate(`/home?room=${roomName}`);
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>צור חדר חדש</h1>
      <input
        type="text"
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
        placeholder="שם החדר"
        style={{ padding: '10px', marginRight: '10px' }}
      />
      <button onClick={handleCreateRoom} style={{ padding: '10px' }}>
        צור חדר
      </button>
    </div>
  );
}

export default CreateRoomPage;
