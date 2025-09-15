import React, { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import socketService from './services/socketService';
import LoginForm from './components/LoginForm';
import Room from './components/Room';
import './App.css';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [currentUsername, setCurrentUsername] = useState(null);
  const [users, setUsers] = useState([]);
  const showToast = useCallback((type, message) => {
    switch (type) {
      case 'success':
        toast.success(message);
        break;
      case 'error':
        toast.error(message);
        break;
      case 'info':
        toast(message, {
          icon: 'ℹ️',
        });
        break;
      case 'user-joined':
        toast.success(message, {
          icon: '👋',
        });
        break;
      case 'user-left':
        toast(message, {
          icon: '🚶‍♂️',
        });
        break;
      default:
        toast(message);
    }
  }, []);

  const handleLeaveRoom = useCallback(() => {
    socketService.leaveRoom();
    setCurrentRoom(null);
    setCurrentUsername(null);
    setUsers([]);
  }, []);

  const setupSocketListeners = useCallback(() => {
    socketService.off('join-success');
    socketService.off('join-error');
    socketService.off('existing-users');
    socketService.off('user-joined');
    socketService.off('user-left');
    socketService.off('room-deleted');
    socketService.off('disconnect');

    socketService.on('join-success', (data) => {
      console.log('Join success:', data);
      setCurrentRoom(data.roomId);
      setCurrentUsername(data.username);
      // We no longer set an error state
      // setError(null);
      toast.success(`Joined room: ${data.roomId}`);
    });

    socketService.on('join-error', (message) => {
      console.error('Join error:', message);
      toast.error(message);
    });

    socketService.on('existing-users', (existingUsers) => {
      console.log('Existing users:', existingUsers);
      setUsers(existingUsers);
    });

    socketService.on('user-joined', (user) => {
      console.log('User joined:', user);
      setUsers(prev => [...prev, user]);
      showToast('user-joined', `${user.username} joined the room`);
    });

    socketService.on('user-left', (data) => {
      console.log('User left:', data);
      setUsers(prev => prev.filter(u => u.id !== data.id));
      showToast('user-left', `${data.username} left the room`);
    });

    socketService.on('room-deleted', () => {
      console.log('Room deleted');
      showToast('info', 'The room has been deleted by the creator.');
      handleLeaveRoom();
    });
  }, [showToast, handleLeaveRoom]);

  useEffect(() => {
    socketService.connect()
      .then(() => {
        setIsConnected(true);
        setupSocketListeners();
        toast.success('Successfully connected to the server!');
      })
      .catch((err) => {     
        toast.error('Failed to connect to server. Please refresh the page.');
        setIsConnected(false); // Make sure this is set on failure
        console.error('Connection failed:', err);
      });

    return () => {
      socketService.disconnect();
    };
  }, [setupSocketListeners, showToast]);

  const handleJoinRoom = (roomId, username, password) => {
    if (!isConnected) {
      showToast('error', 'Server is busy , Please wait and retry in a while', {
        position: 'top-center'
      });
      return;
    }
    socketService.joinRoom(roomId, username, password);
  };

  return (
    <div className="App">
      <Toaster 
        position="top-center"
        toastOptions={{
          className: 'custom-toast-container',
          style: {
            padding: '16px',
            color: '#fff',
            background: '#363636',
          },
        }}
      />
      
      <header className="App-header">
        <div className="logo">
          <i className="fas fa-share-nodes"></i>
          <h1>MeetUs - P2P </h1>
        </div>
        <div className="connection-status">
          <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </header>
      <main className="App-main">

        {!currentRoom ? (
          <LoginForm onJoinRoom={handleJoinRoom} />
        ) : (
          <Room
            roomId={currentRoom}
            username={currentUsername}
            users={users}
            onLeaveRoom={handleLeaveRoom}
            showToast={showToast}
          />
        )}
      </main>
    </div>
  );
}

export default App;