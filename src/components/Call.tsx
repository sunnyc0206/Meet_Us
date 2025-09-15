import React, { useEffect, useRef, useState, useCallback } from 'react';
import socketService from '../services/socketService';

interface User {
  id: string;
  username: string;
  isMuted?: boolean;
  isCameraOff?: boolean;
}

interface CallProps {
  roomId: string;
  username: string;
  users: User[];
}

const servers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const Call: React.FC<CallProps> = ({ roomId, username, users }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});
  const localStream = useRef<MediaStream | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<User[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});

  const endCall = useCallback(() => {
    console.log('Ending call. Stopping all tracks and closing connections.');
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
    }
    Object.values(peerConnections.current).forEach(pc => {
      pc.close();
    });
    peerConnections.current = {};
    remoteVideoRefs.current = {};
    localStream.current = null;
    setIsCallActive(false);
    setRemoteUsers([]);
    socketService.endCall();
  }, []);

  const createPeerConnection = useCallback((userId: string): RTCPeerConnection => {
    console.log(`Creating RTCPeerConnection for user ${userId}`);
    const peerConnection = new RTCPeerConnection(servers);
    peerConnections.current[userId] = peerConnection;

    peerConnection.oniceconnectionstatechange = () => {
      console.log(`User ${userId} - ICE Connection State: ${peerConnection.iceConnectionState}`);
    };
    peerConnection.onconnectionstatechange = () => {
      console.log(`User ${userId} - Peer Connection State: ${peerConnection.connectionState}`);
    };

    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        console.log(`Adding local track to peer connection for user ${userId}:`, track.kind);
        peerConnection.addTrack(track, localStream.current!);
      });
    }

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        console.log(`Sending ICE candidate to ${userId}`);
        socketService.sendVideoIceCandidate(userId, event.candidate);
      }
    };

    peerConnection.ontrack = event => {
      console.log(`Received remote track from ${userId}`, event.track);
      const remoteStream = event.streams[0];
      setRemoteStreams(prev => ({
        ...prev,
        [userId]: remoteStream
      }));
    };

    return peerConnection;
  }, []);

  const createOffer = useCallback(async (peerConnection: RTCPeerConnection, userId: string) => {
    try {
      console.log(`Creating offer for user ${userId}`);
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      console.log(`Sending video offer to ${userId}`);
      socketService.sendVideoOffer(userId, peerConnection.localDescription);
    } catch (error) {
      console.error(`Error creating offer for user ${userId}:`, error);
    }
  }, []);

  const createPeerConnectionAndOffer = useCallback((userId: string) => {
    const peerConnection = createPeerConnection(userId);
    createOffer(peerConnection, userId);
  }, [createPeerConnection, createOffer]);

  const handleVideoOffer = useCallback(async (data: { from: string; offer: RTCSessionDescriptionInit }) => {
    const { from, offer } = data;
    console.log(`Received video offer from user ${from}`);

    let peerConnection = peerConnections.current[from];
    if (!peerConnection) {
      peerConnection = createPeerConnection(from);
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    console.log(`Creating answer for user ${from}`);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    console.log(`Sending video answer to ${from}`);
    socketService.sendVideoAnswer(from, peerConnection.localDescription);
  }, [createPeerConnection]);

  const handleVideoAnswer = useCallback(async (data: { from: string; answer: RTCSessionDescriptionInit }) => {
    const { from, answer } = data;
    console.log(`Received video answer from user ${from}`);
    const peerConnection = peerConnections.current[from];

    if (peerConnection && peerConnection.signalingState === 'have-local-offer') {
      console.log(`Peer connection is in 'have-local-offer' state. Setting remote answer for user ${from}`);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } else {
      console.warn(`Could not set remote answer from ${from}. Peer connection is in wrong state: ${peerConnection?.signalingState}`);
    }
  }, []);

  const handleIceCandidate = useCallback(async (data: { from: string; candidate: RTCIceCandidateInit }) => {
    const { from, candidate } = data;
    console.log(`Received ICE candidate from user ${from}`);
    const peerConnection = peerConnections.current[from];
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(`Added ICE candidate from user ${from}`);
      } catch (e) {
        console.error('Error adding received ice candidate:', e);
      }
    }
  }, []);

  const handleUserLeft = useCallback((data: { userId: string }) => {
    const { userId } = data;
    console.log(`User ${userId} left the call.`);
    if (peerConnections.current[userId]) {
      peerConnections.current[userId].close();
      delete peerConnections.current[userId];
    }
    setRemoteUsers(prev => prev.filter(user => user.id !== userId));
    // Also remove their stream
    setRemoteStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[userId];
        return newStreams;
    });
  }, []);

  const handleUserJoined = useCallback((data: { id: string; username: string }) => {
    console.log(`New user joined the room: ${data.username}`);
    const currentUserId = socketService.getSocketId();

    setRemoteUsers(prev => {
      const isUserAlreadyRemote = prev.some(user => user.id === data.id);
      if (!isUserAlreadyRemote) {
        return [...prev, { id: data.id, username: data.username, isMuted: false, isCameraOff: false }];
      }
      return prev;
    });

    if (currentUserId && !peerConnections.current[data.id]) {
      if (currentUserId < data.id) {
        console.log(`My ID (${currentUserId}) is smaller. Creating offer for new user ${data.id}`);
        createPeerConnectionAndOffer(data.id);
      } else {
        console.log(`My ID (${currentUserId}) is larger. Waiting for offer from new user ${data.id}`);
        createPeerConnection(data.id);
      }
    }
  }, [createPeerConnectionAndOffer, createPeerConnection]);

  const handleRemoteToggle = useCallback((data: { userId: string; type: 'video' | 'audio'; state: boolean }) => {
    const { userId, type, state } = data;
    setRemoteUsers(prev => {
      return prev.map(user => {
        if (user.id === userId) {
          if (type === 'video') {
            return { ...user, isCameraOff: !state };
          } else if (type === 'audio') {
            return { ...user, isMuted: !state };
          }
        }
        return user;
      });
    });
  }, []);

  // Main Effect: Orchestrates the entire call setup
  useEffect(() => {
    console.log('Main useEffect running.');

    const startCall = async () => {
      try {
        console.log('Requesting local media stream...');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setIsCallActive(true);
        console.log('Local stream acquired and set.');

        const currentUserId = socketService.getSocketId();
        // Set up initial peer connections for all other users already in the room
        users.forEach(user => {
          if (user.id !== currentUserId) {
            if (currentUserId! < user.id) {
              createPeerConnectionAndOffer(user.id);
            } else {
              createPeerConnection(user.id);
            }
          }
        });
        
      } catch (error) {
        console.error('Error starting video call:', error);
        setIsCallActive(false);
      }
    };
    
    startCall();

    socketService.on('video-offer', handleVideoOffer);
    socketService.on('video-answer', handleVideoAnswer);
    socketService.on('video-ice-candidate', handleIceCandidate);
    socketService.on('user-left', handleUserLeft);
    socketService.on('user-joined', handleUserJoined);
    socketService.on('toggle-track', handleRemoteToggle);

    return () => {
      console.log('Component unmounting. Performing cleanup.');
      endCall();
      socketService.off('video-offer', handleVideoOffer);
      socketService.off('video-answer', handleVideoAnswer);
      socketService.off('video-ice-candidate', handleIceCandidate);
      socketService.off('user-left', handleUserLeft);
      socketService.off('user-joined', handleUserJoined);
      socketService.off('toggle-track', handleRemoteToggle);
    };
  }, [endCall, handleIceCandidate, handleUserLeft, handleUserJoined, handleRemoteToggle, handleVideoAnswer, handleVideoOffer, users, createPeerConnectionAndOffer, createPeerConnection]);

  const toggleMute = () => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        console.log(`Audio muted: ${!audioTrack.enabled}`);
      }
    }
  };

  const toggleCamera = () => {
    if (localStream.current) {
      const videoTrack = localStream.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
        console.log(`Camera off: ${!videoTrack.enabled}`);
      }
    }
  };

  return (
    <div className="call-container">
      {!isCallActive && <div className="call-loading">Starting call...</div>}
      
      <div className="videos-grid">
        <div className="video-item local-video">
          <video ref={localVideoRef} autoPlay muted playsInline />
          <div className="username-overlay">{username} (You)</div>
          <div className="status-icons">
            <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
            <i className={`fas ${isCameraOff ? 'fa-video-slash' : 'fa-video'}`}></i>
          </div>
        </div>
        
        {remoteUsers.map(user => (
          <div key={user.id} className="video-item remote-video">
            <VideoPlayer 
                userId={user.id} 
                stream={remoteStreams[user.id]} 
                ref={el => {
                    if (el) remoteVideoRefs.current[user.id] = el;
                    else delete remoteVideoRefs.current[user.id];
                }} 
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
        <button onClick={toggleMute} className={`control-btn ${isMuted ? 'active' : ''}`}>
          <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
          <span className="tooltip">{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>
        <button onClick={toggleCamera} className={`control-btn ${isCameraOff ? 'active' : ''}`}>
          <i className={`fas ${isCameraOff ? 'fa-video-slash' : 'fa-video'}`}></i>
          <span className="tooltip">{isCameraOff ? 'Turn on camera' : 'Turn off camera'}</span>
        </button>
      </div>
    </div>
  );
};

// FIX: Define props for the VideoPlayer component
interface VideoPlayerProps {
    userId: string;
    stream: MediaStream | undefined;
}

// FIX: Correctly type the forwarded ref component
const VideoPlayer = React.forwardRef<HTMLVideoElement, VideoPlayerProps>(({ stream, userId }, ref) => {
    useEffect(() => {
        if (ref && typeof ref !== 'function' && ref.current && stream) {
            console.log(`Attaching stream for user ${userId}`);
            ref.current.srcObject = stream;
        }
    }, [stream, ref, userId]);

    return <video autoPlay playsInline ref={ref} />;
});

export default Call;