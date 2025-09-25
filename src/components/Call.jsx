import React, { useEffect, useRef, useState, useCallback } from 'react';
import socketService from '../services/socketService';

const servers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const Call = ({ roomId, username, users, onNavigateToCall, onNavigateToChat }) => {
  // Refs
  const localVideoRef = useRef(null);
  const peerConnections = useRef({});
  const localStream = useRef(null);
  const isInitialized = useRef(false);
  const initialUsers = useRef(users);
  const remoteStreamsRef = useRef({});
  const blackCanvasStream = useRef(null);
  
  // Update users ref on each render
  initialUsers.current = users;
  
  // State
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isInCall, setIsInCall] = useState(false);

  // Create black video stream
  const createBlackVideoStream = () => {
    if (!blackCanvasStream.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      blackCanvasStream.current = canvas.captureStream(30);
    }
    return blackCanvasStream.current.getVideoTracks()[0];
  };

  // Get user media
  const initializeMedia = useCallback(async () => {
    try {
      let stream;
      
      try {
        // Try to get both video and audio
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
      } catch (error) {
        // If video fails, try audio only with fake video
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: false, 
            audio: true 
          });
          
          // Add fake video track
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = 'black';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const videoTrack = canvas.captureStream(30).getVideoTracks()[0];
          stream.addTrack(videoTrack);
          setIsCameraOff(true);
        } catch (audioError) {
          alert('Unable to access camera or microphone. Please check permissions.');
          isInitialized.current = false;
          return null;
        }
      }
      
      localStream.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setIsCallActive(true);
      
      return stream;
    } catch (error) {
      console.error('Error getting user media:', error);
      setIsCallActive(false);
      return null;
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((userId) => {
    const pc = new RTCPeerConnection(servers);
    peerConnections.current[userId] = pc;

    // Add local tracks
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        pc.addTrack(track, localStream.current);
      });
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        
        // Store in both ref and state
        remoteStreamsRef.current[userId] = stream;
        setRemoteStreams(prev => ({
          ...prev,
          [userId]: stream
        }));
        
        // Listen for track changes in the stream
        stream.onaddtrack = () => {
          console.log(`Track added to stream for ${userId}`);
          setRemoteStreams(prev => ({
            ...prev,
            [userId]: stream
          }));
        };
        
        stream.onremovetrack = () => {
          console.log(`Track removed from stream for ${userId}`);
          setRemoteStreams(prev => ({
            ...prev,
            [userId]: stream
          }));
        };
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.sendVideoIceCandidate(userId, event.candidate);
      }
    };

    // Monitor connection state
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        console.error(`Connection failed with ${userId}`);
      }
    };

    return pc;
  }, []);

  // Create and send offer
  const createAndSendOffer = useCallback(async (userId) => {
    const pc = peerConnections.current[userId];
    if (!pc) return;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketService.sendVideoOffer(userId, offer);
    } catch (error) {
      console.error(`Error creating offer for ${userId}:`, error);
    }
  }, []);

  // Handle incoming offer
  const handleOffer = useCallback(async ({ from, offer }) => {
    if (!localStream.current) return;

    let pc = peerConnections.current[from];
    
    // Handle offer collision
    if (pc && pc.signalingState !== 'stable') {
      const myId = socketService.getSocketId();
      if (myId > from) {
        pc.close();
        pc = createPeerConnection(from);
      } else {
        return;
      }
    }
    
    if (!pc) {
      pc = createPeerConnection(from);
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketService.sendVideoAnswer(from, answer);
    } catch (error) {
      console.error(`Error handling offer from ${from}:`, error);
    }
  }, [createPeerConnection]);

  // Handle incoming answer
  const handleAnswer = useCallback(async ({ from, answer }) => {
    const pc = peerConnections.current[from];
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error(`Error handling answer from ${from}:`, error);
    }
  }, []);

  // Handle incoming ICE candidate
  const handleIceCandidate = useCallback(async ({ from, candidate }) => {
    const pc = peerConnections.current[from];
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error(`Error adding ICE candidate from ${from}:`, error);
    }
  }, []);

  // Handle user joined
  const handleUserJoined = useCallback(({ id, username: newUsername }) => {
    setRemoteUsers(prev => {
      if (prev.some(user => user.id === id)) return prev;
      return [...prev, { id, username: newUsername }];
    });

    // Create connection for new user
    if (localStream.current && !peerConnections.current[id]) {
      const pc = createPeerConnection(id);
      
      // Create offer if our ID is smaller
      const myId = socketService.getSocketId();
      if (myId < id) {
        setTimeout(() => createAndSendOffer(id), 100);
      }
    }
  }, [createPeerConnection, createAndSendOffer]);

  // Handle user left
  const handleUserLeft = useCallback(({ userId }) => {
    // Close and remove peer connection
    if (peerConnections.current[userId]) {
      peerConnections.current[userId].close();
      delete peerConnections.current[userId];
    }
    
    // Remove from state
    setRemoteUsers(prev => prev.filter(user => user.id !== userId));
    setRemoteStreams(prev => {
      const newStreams = { ...prev };
      delete newStreams[userId];
      return newStreams;
    });
    
    // Remove from ref
    delete remoteStreamsRef.current[userId];
  }, []);

  // Handle remote toggle
  const handleRemoteToggle = useCallback((data) => {
    const { userId, type, state } = data;
    setRemoteUsers(prev => 
      prev.map(user => {
        if (user.id === userId) {
          if (type === 'video') {
            return { ...user, isCameraOff: !state };
          } else if (type === 'audio') {
            return { ...user, isMuted: !state };
          }
        }
        return user;
      })
    );
    
    // Force re-render of remote streams when video is toggled
    if (type === 'video') {
      setRemoteStreams(prev => ({ ...prev }));
    }
  }, []);

  // Initialize call
  useEffect(() => {
    let mounted = true;
    
    if (isInitialized.current || !isInCall) return;
    
    const startCall = async () => {
      isInitialized.current = true;
      
      let stream = await initializeMedia();
      if (!stream || !mounted) return;
      
      const myId = socketService.getSocketId();
      if (!myId || !mounted) return;
      
      // Set initial remote users
      const otherUsers = (initialUsers.current || []).filter(user => user.id !== myId);
      setRemoteUsers(otherUsers);
      
      // Create connections for existing users
      for (const user of otherUsers) {
        if (!mounted) break;
        createPeerConnection(user.id);
        
        if (myId < user.id) {
          await createAndSendOffer(user.id);
        }
      }
    };

    // Register socket handlers
    socketService.on('video-offer', handleOffer);
    socketService.on('video-answer', handleAnswer);
    socketService.on('video-ice-candidate', handleIceCandidate);
    socketService.on('user-joined', handleUserJoined);
    socketService.on('user-left', handleUserLeft);
    socketService.on('toggle-track', handleRemoteToggle);

    startCall();

    // Cleanup
    return () => {
      mounted = false;
      
      if (!isInitialized.current) return;
      
      // Stop local stream
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
        localStream.current = null;
      }
      
      // Close peer connections
      Object.values(peerConnections.current).forEach(pc => pc.close());
      peerConnections.current = {};
      
      // Remove socket handlers
      socketService.off('video-offer', handleOffer);
      socketService.off('video-answer', handleAnswer);
      socketService.off('video-ice-candidate', handleIceCandidate);
      socketService.off('user-joined', handleUserJoined);
      socketService.off('user-left', handleUserLeft);
      socketService.off('toggle-track', handleRemoteToggle);
      
      isInitialized.current = false;
    };
  }, [isInCall, initializeMedia, createPeerConnection, createAndSendOffer, handleOffer, handleAnswer, handleIceCandidate, handleUserJoined, handleUserLeft, handleRemoteToggle]);

  // Watch for changes in users prop to handle join/leave
  useEffect(() => {
    if (!isInitialized.current || !localStream.current) return;
    
    const myId = socketService.getSocketId();
    if (!myId) return;
    
    // Get current user IDs
    const currentUserIds = remoteUsers.map(u => u.id);
    
    // Find new users
    const newUsers = users.filter(user => 
      user.id !== myId && !currentUserIds.includes(user.id)
    );
    
    // Find users who left
    const leftUserIds = currentUserIds.filter(id => 
      !users.some(user => user.id === id)
    );
    
    // Handle new users
    if (newUsers.length > 0) {
      setRemoteUsers(prev => [...prev, ...newUsers]);
      
      // Create connections for new users
      newUsers.forEach(user => {
        if (!peerConnections.current[user.id]) {
          createPeerConnection(user.id);
          if (myId < user.id) {
            createAndSendOffer(user.id);
          }
        }
      });
    }
    
    // Handle users who left
    leftUserIds.forEach(userId => {
      if (peerConnections.current[userId]) {
        peerConnections.current[userId].close();
        delete peerConnections.current[userId];
      }
      
      setRemoteUsers(prev => prev.filter(u => u.id !== userId));
      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[userId];
        return newStreams;
      });
      delete remoteStreamsRef.current[userId];
    });
  }, [users, remoteUsers, createPeerConnection, createAndSendOffer]);

  // Toggle mute
  const toggleMute = () => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) {
        if (isMuted) {
          // Turn mic back on - need to get new audio stream
          navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(newStream => {
              const newAudioTrack = newStream.getAudioTracks()[0];
              const videoTrack = localStream.current.getVideoTracks()[0];
              
              // Create new stream with new audio and existing video
              const newLocalStream = new MediaStream();
              if (videoTrack) newLocalStream.addTrack(videoTrack);
              newLocalStream.addTrack(newAudioTrack);
              
              // Update local stream
              localStream.current = newLocalStream;
              if (localVideoRef.current) {
                localVideoRef.current.srcObject = newLocalStream;
              }
              
              // Update all peer connections
              Object.entries(peerConnections.current).forEach(([userId, pc]) => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
                if (sender) {
                  sender.replaceTrack(newAudioTrack);
                }
              });
              
              // Stop old audio track
              audioTrack.stop();
              
              setIsMuted(false);
              socketService.emit('toggle-track', { type: 'audio', state: true });
            })
            .catch(error => {
              console.error('Error turning microphone on:', error);
              alert('Unable to access microphone.');
            });
        } else {
          // Turn mic off - stop the track completely
          audioTrack.stop();
          
          // Remove audio track from stream
          localStream.current.removeTrack(audioTrack);
          
          // Update all peer connections to send silence
          Object.entries(peerConnections.current).forEach(([userId, pc]) => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
            if (sender) {
              sender.replaceTrack(null);
            }
          });
          
          setIsMuted(true);
          socketService.emit('toggle-track', { type: 'audio', state: false });
        }
      }
    }
  };

  // Toggle camera with proper handling
  const toggleCamera = async () => {
    if (!localStream.current) return;
    
    const videoTrack = localStream.current.getVideoTracks()[0];
    
    if (isCameraOff) {
      // Turn camera back on
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: false 
        });
        
        const newVideoTrack = newStream.getVideoTracks()[0];
        const audioTrack = localStream.current.getAudioTracks()[0];
        
        // Create new stream with new video and existing audio
        const newLocalStream = new MediaStream();
        if (audioTrack) newLocalStream.addTrack(audioTrack);
        newLocalStream.addTrack(newVideoTrack);
        
        // Update local video
        localStream.current = newLocalStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newLocalStream;
        }
        
        // Update all peer connections
        Object.entries(peerConnections.current).forEach(([userId, pc]) => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(newVideoTrack);
          }
        });
        
        // Stop old video track if it exists
        if (videoTrack) {
          videoTrack.stop();
        }
        
        setIsCameraOff(false);
        socketService.emit('toggle-track', { type: 'video', state: true });
      } catch (error) {
        console.error('Error turning camera on:', error);
        alert('Unable to access camera. It may be in use by another application.');
      }
    } else {
      // Turn camera off - replace with black video
      if (videoTrack) {
        const blackVideoTrack = createBlackVideoStream();
        const audioTrack = localStream.current.getAudioTracks()[0];
        
        // Create new stream with black video and existing audio
        const newLocalStream = new MediaStream();
        if (audioTrack) newLocalStream.addTrack(audioTrack);
        newLocalStream.addTrack(blackVideoTrack);
        
        // Update local video
        localStream.current = newLocalStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newLocalStream;
        }
        
        // Update all peer connections to send black video
        Object.entries(peerConnections.current).forEach(([userId, pc]) => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(blackVideoTrack);
          }
        });
        
        // Stop the actual camera track
        videoTrack.stop();
        
        setIsCameraOff(true);
        socketService.emit('toggle-track', { type: 'video', state: false });
      }
    }
  };

  // Start call
  const handleStartCall = async () => {
    setIsInCall(true);
  };

  // End call
  const handleEndCall = () => {
    // Stop all tracks
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
      localStream.current = null;
    }
    
    // Close all peer connections
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
    
    // Clear states
    setRemoteStreams({});
    remoteStreamsRef.current = {};
    setIsCallActive(false);
    setIsInCall(false);
    setIsMuted(false);
    setIsCameraOff(false);
    isInitialized.current = false;
    
    // Emit end call event
    socketService.endCall();
  };

  return (
    <div className="call-container">
      {!isInCall ? (
        // Pre-call popup modal
        <div className="join-modal-overlay">
          <div className="join-modal">
            <div className="text-center">
              {/* Icon */}
              <div className="join-modal-icon">
                <i className="fas fa-video"></i>
              </div>
              
              {/* Title */}
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
                Join Video Call
              </h2>
              
              {/* Room info */}
              <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>
                Room: <span style={{ fontFamily: 'monospace', color: '#d1d5db' }}>{roomId}</span>
              </p>
              
              {/* User info */}
              <div style={{ backgroundColor: '#374151', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Joining as</p>
                <p style={{ color: 'white', fontWeight: '600' }}>{username}</p>
              </div>
              
              {/* Status indicators */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', color: '#9ca3af' }}>
                  <i className="fas fa-microphone" style={{ marginRight: '0.5rem', color: '#10b981' }}></i>
                  <span>Mic ready</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', color: '#9ca3af' }}>
                  <i className="fas fa-video" style={{ marginRight: '0.5rem', color: '#10b981' }}></i>
                  <span>Camera ready</span>
                </div>
              </div>
              
              {/* Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => {
                    // Navigate to chat tab
                    if (onNavigateToChat) {
                      onNavigateToChat();
                    }
                  }}
                  className="join-modal-button join-modal-button-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartCall}
                  className="join-modal-button join-modal-button-primary"
                  style={{ flex: 1 }}
                >
                  <i className="fas fa-video"></i>
                  Join Call
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {!isCallActive && <div className="call-loading">Starting call...</div>}
          
          <div className="videos-grid">
            {/* Local video */}
            <div className="video-item local-video">
              <video 
                ref={localVideoRef} 
                autoPlay 
                muted 
                playsInline 
              />
              <div className="username-overlay">{username} (You)</div>
              <div className="status-icons">
                <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                <i className={`fas ${isCameraOff ? 'fa-video-slash' : 'fa-video'}`}></i>
              </div>
            </div>
            
            {/* Remote videos */}
            {remoteUsers.filter(user => user.id !== socketService.getSocketId()).map(user => (
              <div key={user.id} className="video-item remote-video">
                <RemoteVideo 
                  key={`${user.id}-${user.isCameraOff}`}
                  userId={user.id}
                  stream={remoteStreams[user.id]}
                />
                <div className="username-overlay">{user.username}</div>
                <div className="status-icons">
                  <i className={`fas ${user.isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                  <i className={`fas ${user.isCameraOff ? 'fa-video-slash' : 'fa-video'}`}></i>
                </div>
              </div>
            ))}
          </div>

          <div className="call-controls">
            <button 
              onClick={toggleMute} 
              className={`control-btn ${isMuted ? 'active' : ''}`}
            >
              <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
              <span className="tooltip">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>
            <button 
              onClick={toggleCamera} 
              className={`control-btn ${isCameraOff ? 'active' : ''}`}
            >
              <i className={`fas ${isCameraOff ? 'fa-video-slash' : 'fa-video'}`}></i>
              <span className="tooltip">{isCameraOff ? 'Turn on camera' : 'Turn off camera'}</span>
            </button>
            <button 
              onClick={handleEndCall}
              className="control-btn bg-red-600 hover:bg-red-700 text-white px-6"
            >
              <i className="fas fa-phone-slash"></i>
              <span className="tooltip">End Call</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// Remote video component
const RemoteVideo = React.forwardRef(({ userId, stream }, ref) => {
  const videoRef = useRef(null);
  const [streamId, setStreamId] = useState(null);
  
  useEffect(() => {
    const video = (ref && ref.current) || videoRef.current;
    if (video && stream) {
      // Check if stream has changed
      if (stream.id !== streamId) {
        video.srcObject = stream;
        setStreamId(stream.id);
        
        // Force play after stream change
        video.play().catch(() => {
          // Autoplay blocked
        });
      }
    }
  }, [stream, streamId, userId, ref]);

  return (
    <video 
      ref={ref || videoRef}
      autoPlay
      playsInline
      muted={false}
      onClick={(e) => {
        e.target.play();
      }}
      style={{ 
        width: '100%', 
        height: '100%', 
        objectFit: 'cover',
        background: '#000',
        cursor: 'pointer'
      }}
    />
  );
});

RemoteVideo.displayName = 'RemoteVideo';

export default Call; 