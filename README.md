# MeetUs - WebRTC File Transfer & Video Chat (Spring Boot)

A real-time peer-to-peer file transfer and video chat application built with Spring Boot backend and WebRTC technology.

## Features

- 🚀 **P2P File Transfer**: Direct browser-to-browser file sharing without server storage
- 📹 **Video Chat**: Real-time video and audio communication
- 💬 **Real-time Chat**: Instant messaging within rooms
- 🔒 **Password-Protected Rooms**: Secure your rooms with optional passwords
- 👥 **Multi-user Support**: Share files with multiple users simultaneously
- 🎯 **No Size Limits**: Transfer files of any size directly between browsers
- 🔄 **Auto-reconnect**: Automatic WebSocket reconnection on connection loss

## Technology Stack

- **Java 21** - Latest LTS version of Java
- **WebRTC** - Peer-to-peer communication
- **Spring Boot 3.2.0** - Framework for building the application
- **Real-time Communication:** Netty Socket.io server


## Prerequisites

- Java 21 or higher
- Maven 3.6 or higher
- Modern web browser with WebRTC support (Chrome, Firefox, Edge, Safari)

## Usage

### Creating/Joining a Room

1. **Enter Username**: Choose a display name
2. **Room ID**: Enter existing room ID or leave blank to create new room
3. **Password** (optional): Set/enter room password for security
4. **Join**: Click to enter the room

### Sharing Files

1. **Select Recipients**: Choose users to send files to
2. **Add Files**: Click "Select Files" or drag & drop
3. **Send**: Files transfer directly between browsers

### Video Chat

1. **Start Call**: Click the video icon in the room
2. **Allow Permissions**: Grant camera/microphone access
3. **End Call**: Click the red hang-up button

### Chat

1. **Switch to Chat Tab**: Click the chat icon
2. **Type Message**: Enter your message
3. **Send**: Press Enter or click send


## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14.1+
- Edge 90+

## Troubleshooting

### Connection Issues
- Ensure firewall allows WebSocket connections on port 3001
- Check browser console for WebSocket connection errors
- Verify CORS configuration matches your domain

### WebRTC Issues
- Ensure HTTPS in production (required for camera/microphone access)
- Configure STUN/TURN servers for NAT traversal
- Check browser permissions for camera/microphone

### File Transfer Issues
- Large files may take time depending on connection speed
- Browser may limit maximum file size (usually 2GB)
- Ensure stable internet connection for large transfers

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Spring Boot team for the excellent framework
- WebRTC community for peer-to-peer technology

## Support

For issues, questions, or suggestions, please open an issue on GitHub. 
