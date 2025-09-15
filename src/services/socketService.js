// import { io, Socket } from 'socket.io-client';

// class SocketService {
//   private socket: Socket | null = null;
//   private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();

//   connect(): Promise<void> {
//     return new Promise((resolve, reject) => {
//       // Connect to Socket.io server on port 9092
//       this.socket = io('http://localhost:9092', {
//         transports: ['websocket', 'polling'],
//         reconnection: true,
//         reconnectionAttempts: 5,
//         reconnectionDelay: 1000,
//       });

//       this.socket.on('connect', () => {
//         console.log('Connected to Socket.io server');
//         resolve();
//       });

//       this.socket.on('connect_error', (error) => {
//         console.error('Connection error:', error);
//         reject(error);
//       });

//       this.socket.on('disconnect', () => {
//         console.log('Disconnected from Socket.io server');
//       });
//     });
//   }

//   disconnect(): void {
//     if (this.socket) {
//       this.socket.disconnect();
//       this.socket = null;
//     }
//   }

//   emit(event: string, data?: any): void {
//     if (this.socket) {
//       this.socket.emit(event, data);
//     }
//   }

//   on(event: string, callback: (...args: any[]) => void): void {
//     if (this.socket) {
//       this.socket.on(event, callback);
      
//       // Store listeners for cleanup
//       if (!this.listeners.has(event)) {
//         this.listeners.set(event, []);
//       }
//       this.listeners.get(event)?.push(callback);
//     }
//   }

//   off(event: string, callback?: (...args: any[]) => void): void {
//     if (this.socket) {
//       if (callback) {
//         this.socket.off(event, callback);
//         const listeners = this.listeners.get(event);
//         if (listeners) {
//           const index = listeners.indexOf(callback);
//           if (index > -1) {
//             listeners.splice(index, 1);
//           }
//         }
//       } else {
//         this.socket.off(event);
//         this.listeners.delete(event);
//       }
//     }
//   }

//   getSocketId(): string | undefined {
//     return this.socket?.id;
//   }

//   isConnected(): boolean {
//     return this.socket?.connected ?? false;
//   }

//   // Room management
//   joinRoom(roomId: string, username: string, password?: string): void {
//     this.emit('join-room', { roomId, username, password });
//   }

//   leaveRoom(): void {
//     // Ensure the socket is connected before emitting
//     if (this.socket) {
//       // Emit an event to the server to signal the user is leaving the room
//       this.emit('leave-room', {}); // Or just this.emit('leave-room', {}); if the room ID is managed on the server
//     }
//   }

//   getRooms(): void {
//     this.emit('get-rooms');
//   }

//   deleteRoom(roomId: string): void {
//     this.emit('delete-room', roomId);
//   }

//   // WebRTC signaling
//   sendOffer(to: string, offer: any): void {
//     this.emit('offer', { to, offer });
//   }

//   sendAnswer(to: string, answer: any): void {
//     this.emit('answer', { to, answer });
//   }

//   sendIceCandidate(to: string, candidate: any): void {
//     this.emit('ice-candidate', { to, candidate });
//   }

//   // Video signaling
//   sendVideoOffer(to: string, offer: any): void {
//     this.emit('video-offer', { to, offer });
//   }

//   sendVideoAnswer(to: string, answer: any): void {
//     this.emit('video-answer', { to, answer });
//   }

//   sendVideoIceCandidate(to: string, candidate: any): void {
//     this.emit('video-ice-candidate', { to, candidate });
//   }
  

//   // Chat and file transfer
//   sendChatMessage(message: string, timestamp: number): void {
//     this.emit('chat-message', { message, timestamp });
//   }

//   sendFileMetadata(to: string, fileName: string, fileSize: number, fileType: string): void {
//     this.emit('file-metadata', { to, fileName, fileSize, fileType });
//   }

//   endCall(): void {
//     this.emit('end-call', {});
//   }
// }

// const socketService = new SocketService();
// export default socketService; 
import { io } from 'socket.io-client';

class SocketService {
  socket = null;
  listeners = new Map();

  connect() {
    return new Promise((resolve, reject) => {
      // Connect to Socket.io server on port 9092
      this.socket = io('http://localhost:9092', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        console.log('Connected to Socket.io server');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from Socket.io server');
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
      
      // Store listeners for cleanup
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event)?.push(callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
        const listeners = this.listeners.get(event);
        if (listeners) {
          const index = listeners.indexOf(callback);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        }
      } else {
        this.socket.off(event);
        this.listeners.delete(event);
      }
    }
  }

  getSocketId() {
    return this.socket?.id;
  }

  isConnected() {
    return this.socket?.connected ?? false;
  }

  // Room management
  joinRoom(roomId, username, password) {
    this.emit('join-room', { roomId, username, password });
  }

  leaveRoom() {
    // Ensure the socket is connected before emitting
    if (this.socket) {
      // Emit an event to the server to signal the user is leaving the room
      this.emit('leave-room', {}); // Or just this.emit('leave-room', {}); if the room ID is managed on the server
    }
  }

  getRooms() {
    this.emit('get-rooms');
  }

  deleteRoom(roomId) {
    this.emit('delete-room', roomId);
  }

  // WebRTC signaling
  sendOffer(to, offer) {
    this.emit('offer', { to, offer });
  }

  sendAnswer(to, answer) {
    this.emit('answer', { to, answer });
  }

  sendIceCandidate(to, candidate) {
    this.emit('ice-candidate', { to, candidate });
  }

  // Video signaling
  sendVideoOffer(to, offer) {
    this.emit('video-offer', { to, offer });
  }

  sendVideoAnswer(to, answer) {
    this.emit('video-answer', { to, answer });
  }

  sendVideoIceCandidate(to, candidate) {
    this.emit('video-ice-candidate', { to, candidate });
  }
  
  // Chat and file transfer
  sendChatMessage(message, timestamp) {
    this.emit('chat-message', { message, timestamp });
  }

  sendFileMetadata(to, fileName, fileSize, fileType) {
    this.emit('file-metadata', { to, fileName, fileSize, fileType });
  }

  endCall() {
    this.emit('end-call', {});
  }
}

const socketService = new SocketService();
export default socketService;