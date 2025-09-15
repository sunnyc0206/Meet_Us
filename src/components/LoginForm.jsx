import React, { useState } from 'react';

const LoginForm = ({ onJoinRoom }) => {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');

  const generateRoomId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 4; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setRoomId(id);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim() && roomId.trim()) {
      onJoinRoom(roomId, username, password || undefined);
    }
  };

  return (
    <div className="login-form">
      <h2>
        <i className="fas fa-door-open"></i> Join a Room
      </h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="username">
            <i className="fas fa-user"></i> Username
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="roomId">
            <i className="fas fa-key"></i> Room ID
          </label>
          <div className="input-with-button">
            <input
              type="text"
              id="roomId"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="Enter room ID or generate new"
              required
            />
            <button type="button" onClick={generateRoomId} className="btn-secondary">
              <i className="fas fa-dice"></i> Generate
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="password">
            <i className="fas fa-lock"></i> Password (Optional)
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter room password (optional)"
          />
        </div>

        <button type="submit" className="btn-primary">
          <i className="fas fa-sign-in-alt"></i> Join or Create Room
        </button>
      </form>
    </div>
  );
};

export default LoginForm;