import React, { useState, useEffect, useRef, useCallback } from 'react';
import socketService from '../services/socketService';
import Call from './Call';
import Chat from './Chat';
import { toast } from 'react-hot-toast';

const Room = ({ roomId, username, users, onLeaveRoom, showToast }) => {
    const [activeTab, setActiveTab] = useState('chat');
    const [messages, setMessages] = useState([]);

    const peerConnections = useRef(new Map());
    const dataChannels = useRef(new Map());
    const pendingFileData = useRef(new Map());
    const pendingToasts = useRef(new Map());
    const receivingFileTransfers = useRef(new Map());

    const formatFileSize = useCallback((bytes) => {
        if (bytes === 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }, []);

    const onNavigateToChat = useCallback(() => {
        setActiveTab('chat');
    }, []);

    const onNavigateToCall = useCallback(() => {
        setActiveTab('meet');
    }, []);

    const downloadFile = useCallback((fileTransferMessage) => {
        const blob = new Blob(fileTransferMessage.chunks, { type: fileTransferMessage.fileType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileTransferMessage.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        // toast.success(`File Downloaded!`);
    }, [showToast]);

    const sendFileData = useCallback((targetUserId, file, messageId) => {
        const channel = dataChannels.current.get(targetUserId);
        
        if (!channel || channel.readyState !== 'open') {
            // console.error(`Data channel not open to ${targetUserId}. Cancelling file transfer.`);
            toast.error('Data channel not ready. Please try again.');
            setMessages(prev => prev.map(m => {
                if (m.id === messageId && m.isOwn) {
                    const newStatusMap = { ...m.statusMap, [targetUserId]: 'failed' };
                    return { ...m, statusMap: newStatusMap };
                }
                return m;
            }));
            return;
        }

        const chunkSize = 16384;
        const reader = new FileReader();
        let offset = 0;

        const readSlice = () => {
            const slice = file.slice(offset, offset + chunkSize);
            reader.readAsArrayBuffer(slice);
        };
        
        const sendingToastId = toast.loading(`Sending "${file.name}" to user...`, { id: `sending-${targetUserId}` });

        reader.onload = (e) => {
            if (e.target?.result && channel.readyState === 'open') {
                try {
                    channel.send(e.target.result);
                    offset += e.target.result.byteLength;

                    // NEW: Update progress in the shared message object
                    setMessages(prev => prev.map(m => {
                        if (m.id === messageId) {
                            const newSentSizeMap = { ...(m.sentSizeMap || {}), [targetUserId]: offset };
                            return { ...m, sentSizeMap: newSentSizeMap };
                        }
                        return m;
                    }));

                    if (offset < file.size) {
                        readSlice();
                    } else {
                        // NEW: Update completion status in the shared message object
                        setMessages(prev => prev.map(m => {
                            if (m.id === messageId) {
                                const newStatusMap = { ...m.statusMap, [targetUserId]: 'completed' };
                                const statuses = Object.values(newStatusMap);
                                const isAllDone = statuses.every(s => s === 'completed' || s === 'rejected' || s === 'failed');
                                return { ...m, statusMap: newStatusMap, status: isAllDone ? 'completed' : 'sending' };
                            }
                            return m;
                        }));
                        toast.dismiss(sendingToastId);
                        toast.success(`File sent successfully!`);
                        pendingFileData.current.delete(targetUserId);
                    }
                } catch (error) {
                    console.error("File send error:", error);
                    setMessages(prev => prev.map(m => {
                        if (m.id === messageId) {
                            const newStatusMap = { ...m.statusMap, [targetUserId]: 'failed' };
                            return { ...m, statusMap: newStatusMap };
                        }
                        return m;
                    }));
                    toast.dismiss(sendingToastId);
                    toast.error(`Failed to send file.`);
                }
            }
        };
        readSlice();
    }, []);
    
    const setupDataChannel = useCallback((channel, userId) => {
        channel.binaryType = 'arraybuffer';
        channel.onopen = () => {
            console.log(`Data channel to ${userId} is open.`);
            dataChannels.current.set(userId, channel);
            const pendingFile = pendingFileData.current.get(userId);
            if (pendingFile && pendingFile.isAccepted) {
                sendFileData(pendingFile.targetId, pendingFile.file, pendingFile.messageId);
            }
        };
        channel.onclose = () => {
            console.log(`Data channel to ${userId} is closed.`);
            dataChannels.current.delete(userId);
        };
        channel.onerror = (error) => console.error(`Data channel error with ${userId}:`, error);
        channel.onmessage = (event) => {
            const activeTransfer = receivingFileTransfers.current.get(userId);
            if (!activeTransfer) return;
            activeTransfer.chunks.push(event.data);
            activeTransfer.receivedSize += event.data.byteLength;
            setMessages(prev => prev.map(m =>
                m.id === activeTransfer.id ? { ...m, receivedSize: activeTransfer.receivedSize } : m
            ));
            if (activeTransfer.receivedSize >= activeTransfer.fileSize) {
                downloadFile(activeTransfer);
                receivingFileTransfers.current.delete(userId);
                setMessages(prev => prev.map(m =>
                    m.id === activeTransfer.id ? { ...m, status: 'completed' } : m
                ));
            }
        };
    }, [downloadFile, sendFileData]);

    const createPeerConnection = useCallback((userId, isOffering) => {
        let pc = peerConnections.current.get(userId);
        if (pc && pc.signalingState !== 'closed') return pc;

        pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        pc.onicecandidate = (event) => {
            if (event.candidate) socketService.sendIceCandidate(userId, event.candidate);
        };
        pc.onconnectionstatechange = () => {
            if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
                pc.close();
                peerConnections.current.delete(userId);
                dataChannels.current.delete(userId);
            }
        };
        if (!isOffering) {
            pc.ondatachannel = (event) => setupDataChannel(event.channel, userId);
        }
        peerConnections.current.set(userId, pc);
        return pc;
    }, [setupDataChannel]);

    const handleOffer = useCallback(async (data) => {
        const pc = createPeerConnection(data.from, false);
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketService.sendAnswer(data.from, answer);
    }, [createPeerConnection]);

    const handleAnswer = useCallback(async (data) => {
        const pc = peerConnections.current.get(data.from);
        if (pc && !pc.remoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    }, []);

    const handleIceCandidate = useCallback(async (data) => {
        const pc = peerConnections.current.get(data.from);
        if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    }, []);
    
    const acceptFile = useCallback((fileMessage) => {
        socketService.emit('file-accepted', { to: fileMessage.from });
        const transferMessage = {
            ...fileMessage,
            type: 'file-transfer',
            status: 'receiving',
            chunks: [],
            receivedSize: 0,
        };
        receivingFileTransfers.current.set(fileMessage.from, transferMessage);
        setMessages(prev => prev.map(msg =>
            msg.id === fileMessage.id ? { ...msg, type: 'file-transfer', status: 'receiving', receivedSize: 0 } : msg
        ));
        toast.success(`You accepted the file! The download will start shortly.`);
    }, []);

    const rejectFile = useCallback((fileMessage) => {
        socketService.emit('file-rejected', { to: fileMessage.from });
        setMessages(prev => prev.map(msg =>
            msg.id === fileMessage.id ? { ...msg, type: 'file-transfer', status: 'rejected' } : msg
        ));
        toast.error(`You rejected the file.`);
    }, []);

    useEffect(() => {
        const handleChatMessage = (data) => {
            setMessages(prev => [...prev, { ...data, type: 'text' }]);
            if (activeTab !== 'chat') {
                toast('New message received!', {
                    icon: '💬',
                    action: { label: 'View', onClick: onNavigateToChat },
                });
            }
        };
        socketService.on('chat-message', handleChatMessage);
        return () => socketService.off('chat-message', handleChatMessage);
    }, [activeTab, onNavigateToChat]);

    useEffect(() => {
        const handleFileMetadata = (data) => {
            const fromUsername = users.find(u => u.id === data.from)?.username || 'Someone';
            const fileRequestMessage = {
                id: `${data.from}_${data.fileName}_${Date.now()}`,
                type: 'file-request',
                from: data.from,
                fromUsername,
                fileName: data.fileName, fileSize: data.fileSize, fileType: data.fileType,
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, fileRequestMessage]);
            if (activeTab !== 'chat') {
                toast(`${fromUsername} wants to send you a file!`, {
                    icon: '📁',
                    action: { label: 'View in Chat', onClick: onNavigateToChat },
                });
            }
        };

        const handleFileAccepted = (data) => {
            const pendingFile = pendingFileData.current.get(data.from);
            if (pendingFile) {
                pendingFile.isAccepted = true;
                const sharedMessageId = pendingFile.messageId;

                // NEW: Update the shared message object's status map
                setMessages(prev => prev.map(msg => {
                    if (msg.id === sharedMessageId) {
                        const newStatusMap = { ...msg.statusMap, [data.from]: 'sending' };
                        return { ...msg, statusMap: newStatusMap, status: 'sending' };
                    }
                    return msg;
                }));
                
                const channel = dataChannels.current.get(data.from);
                if (channel && channel.readyState === 'open') {
                    sendFileData(pendingFile.targetId, pendingFile.file, pendingFile.messageId);
                }
            }
        };

        const handleFileRejected = (data) => {
            const pendingFile = pendingFileData.current.get(data.from);
            if (pendingFile) {
                const sharedMessageId = pendingFile.messageId;
                // NEW: Update the shared message object's status map
                setMessages(prev => prev.map(msg => {
                    if (msg.id === sharedMessageId) {
                        const newStatusMap = { ...msg.statusMap, [data.from]: 'rejected' };
                        const statuses = Object.values(newStatusMap);
                        const isAllRejected = statuses.every(s => s === 'rejected');
                        return { ...msg, statusMap: newStatusMap, status: isAllRejected ? 'rejected' : msg.status };
                    }
                    return msg;
                }));
                pendingFileData.current.delete(data.from);
                const fromUsername = users.find(u => u.id === data.from)?.username || 'User';
                toast.error(`${fromUsername} rejected the file.`);
            }
        };

        socketService.on('offer', handleOffer);
        socketService.on('answer', handleAnswer);
        socketService.on('ice-candidate', handleIceCandidate);
        socketService.on('file-metadata', handleFileMetadata);
        socketService.on('file-accepted', handleFileAccepted);
        socketService.on('file-rejected', handleFileRejected);

        return () => {
            socketService.off('offer'); socketService.off('answer'); socketService.off('ice-candidate');
            socketService.off('file-metadata'); socketService.off('file-accepted'); socketService.off('file-rejected');
        };
    }, [users, activeTab, onNavigateToChat, sendFileData, handleOffer, handleAnswer, handleIceCandidate]);

    useEffect(() => {
        const handleUserLeave = (userId) => {
            const pc = peerConnections.current.get(userId);
            if (pc) pc.close();
            peerConnections.current.delete(userId);
            dataChannels.current.delete(userId);
        };
        socketService.on('user-left', handleUserLeave);
        return () => {
            socketService.off('user-left', handleUserLeave);
            peerConnections.current.forEach(pc => pc.close());
            peerConnections.current.clear(); dataChannels.current.clear();
            pendingFileData.current.clear(); pendingToasts.current.clear();
            receivingFileTransfers.current.clear();
        };
    }, []);

    // NEW: Handles an array of target user IDs
    const sendFile = useCallback(async (targetUserIds, file) => {
        if (!file || targetUserIds.length === 0) return;

        const sharedMessageId = `${socketService.getSocketId()}_${file.name}_${Date.now()}`;
        const statusMap = targetUserIds.reduce((acc, id) => ({ ...acc, [id]: 'pending' }), {});
        
        // NEW: Create one message object for the sender's UI
        setMessages(prev => [...prev, {
            id: sharedMessageId,
            type: 'file-transfer', isOwn: true,
            recipients: targetUserIds.map(id => ({ id, username: users.find(u => u.id === id)?.username || 'User' })),
            statusMap,
            sentSizeMap: {},
            fileName: file.name, fileSize: file.size, status: 'pending',
            timestamp: Date.now(),
        }]);

        // NEW: Loop to establish connection and send metadata to each user
        for (const targetUserId of targetUserIds) {
            pendingFileData.current.set(targetUserId, {
                file,
                targetId: targetUserId,
                messageId: sharedMessageId, // Link back to the single message
                isAccepted: false
            });

            const pc = createPeerConnection(targetUserId, true);
            const channel = pc.createDataChannel('fileTransfer', { reliable: true });
            setupDataChannel(channel, targetUserId);
            
            if (pc.signalingState === 'stable') {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socketService.sendOffer(targetUserId, offer);
            }
            socketService.sendFileMetadata(targetUserId, file.name, file.size, file.type);
        }
        // toast.success(`File offer sent to ${targetUserIds.length} user(s).`);
        toast.success(`File offer sent to user${targetUserIds.length > 1 ? 's' : ''}.`);

    }, [createPeerConnection, setupDataChannel, users]);

    return (
        <div className="room">
            {/* ... JSX remains the same as previous version ... */}
            <div className="room-header">
                <div className="room-info">
                    <h2>Room: {roomId}</h2>
                    <span className="user-count"><i className="fas fa-users"></i> {users.length} users</span>
                </div>
                <button onClick={onLeaveRoom} className="btn-danger">
                    <i className="fas fa-sign-out-alt"></i> Leave Room
                </button>
            </div>
            <div className="room-content">
                <div className="users-panel">
                    <h3>Users in Room</h3>
                    <ul className="user-list">
                        {users.map(user => (
                            <li key={user.id} className={user.username === username ? 'current-user' : ''}>
                                <div className="user-info">
                                    <i className="fas fa-user"></i>
                                    <span>{user.username} {user.username === username && '(You)'}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="main-panel">
                    <div className="tabs">
                        <button className={`tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={onNavigateToChat}>
                            <i className="fas fa-comments"></i> Chat
                        </button>
                        <button className={`tab ${activeTab === 'meet' ? 'active' : ''}`} onClick={onNavigateToCall}>
                            <i className="fas fa-video"></i> Meeting
                        </button>
                    </div>
                    <div className="tab-content">
                        {activeTab === 'chat' ? (
                            <Chat
                                username={username} messages={messages} setMessages={setMessages}
                                users={users} sendFile={sendFile} acceptFile={acceptFile}
                                rejectFile={rejectFile} formatFileSize={formatFileSize}
                            />
                        ) : (
                            <Call
                                roomId={roomId} username={username} users={users}
                                showToast={showToast} isActive={activeTab === 'meet'}
                                onNavigateToCall={onNavigateToCall}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Room;