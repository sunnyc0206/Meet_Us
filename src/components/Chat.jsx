// // import React, { useState, useEffect, useRef } from 'react';
// // import socketService from '../services/socketService';
// // import { toast } from 'react-hot-toast';

// // // A helper component to render file-related messages cleanly
// // const FileMessage = ({ msg, acceptFile, rejectFile, formatFileSize }) => {
// //   // Incoming file request
// //   if (msg.type === 'file-request') {
// //     return (
// //       <div className="file-message info">
// //         <div className="file-icon">📁</div>
// //         <div className="file-details">
// //           <strong>{msg.fromUsername} wants to send a file:</strong>
// //           <span>{msg.fileName} ({formatFileSize(msg.fileSize)})</span>
// //         </div>
// //         <div className="file-actions">
// //           <button onClick={() => acceptFile(msg)} className="btn-success">Accept</button>
// //           <button onClick={() => rejectFile(msg)} className="btn-danger">Reject</button>
// //         </div>
// //       </div>
// //     );
// //   }

// //   // File transfer in progress, completed, or rejected
// //   if (msg.type === 'file-transfer') {
// //     const progress = msg.isOwn ? 
// //       (msg.sentSize / msg.fileSize) * 100 :
// //       (msg.receivedSize / msg.fileSize) * 100;

// //     const getStatusText = () => {
// //         switch (msg.status) {
// //             case 'pending': return `Waiting for ${msg.toUsername} to accept...`;
// //             case 'sending': return `Sending... ${Math.round(progress)}%`;
// //             case 'receiving': return `Receiving... ${Math.round(progress)}%`;
// //             case 'completed': return msg.isOwn ? `Sent successfully!` : `Download complete!`;
// //             case 'rejected': return `Transfer rejected.`;
// //             case 'failed': return `Transfer failed.`;
// //             default: return 'File Transfer';
// //         }
// //     };

// //     return (
// //       <div className={`file-message ${msg.status}`}>
// //         <div className="file-icon">
// //             {msg.status === 'completed' && !msg.isOwn ? '✅' : 
// //              msg.status === 'rejected' || msg.status === 'failed' ? '❌' : '⏳'}
// //         </div>
// //         <div className="file-details">
// //             <strong>{msg.fileName}</strong>
// //             <span>{formatFileSize(msg.fileSize)}</span>
// //             <div className="status-text">{getStatusText()}</div>
// //             {(msg.status === 'sending' || msg.status === 'receiving') && (
// //               <progress value={progress} max="100"></progress>
// //             )}
// //         </div>
// //       </div>
// //     );
// //   }
// //   return null;
// // };


// // const Chat = ({ username, messages, setMessages, users, sendFile, acceptFile, rejectFile, formatFileSize }) => {
// //   const [newMessage, setNewMessage] = useState('');
// //   const [selectedFile, setSelectedFile] = useState(null);
// //   const messagesEndRef = useRef(null);
// //   const fileInputRef = useRef(null);

// //   useEffect(() => {
// //     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
// //   }, [messages]);

// //   const handleFileChange = (e) => {
// //     if (e.target.files && e.target.files[0]) {
// //       if (e.target.files[0].size > 2048 * 1024 * 1024) {
// //         toast.error("File is too large (max 2GB).");
// //         return;
// //       }
// //       setSelectedFile(e.target.files[0]);
// //     }
// //   };

// //   const handleSend = () => {
// //     if (selectedFile) {
// //       const recipients = users.filter(u => u.id !== socketService.getSocketId());
// //       if (recipients.length === 0) {
// //         toast.error("No one is in the room to send the file to.");
// //         return;
// //       }
// //       recipients.forEach(user => {
// //         sendFile(user.id, selectedFile);
// //       });
// //       setSelectedFile(null);
// //       fileInputRef.current.value = null; // Clear the file input
// //     } else {
// //       if (newMessage.trim()) {
// //         const timestamp = Date.now();
// //         socketService.sendChatMessage(newMessage, timestamp);
// //         setMessages(prev => [...prev, { type: 'text', username, message: newMessage, timestamp, isOwn: true }]);
// //         setNewMessage('');
// //       }
// //     }
// //   };

// //   return (
// //     <div className="chat-section">
// //       <div className="messages">
// //         {messages.map((msg, index) => (
// //           <div key={msg.id || index} className={`message ${msg.isOwn ? 'own-message' : ''}`}>
// //             {!msg.isOwn && msg.type === 'text' && (
// //               <div className="message-header">{msg.username}</div>
// //             )}
// //             <div className="message-bubble">
// //               {msg.type === 'text' ? (
// //                 <div className="message-content">{msg.message}</div>
// //               ) : (
// //                 <FileMessage 
// //                   msg={msg} 
// //                   acceptFile={acceptFile} 
// //                   rejectFile={rejectFile}
// //                   formatFileSize={formatFileSize}
// //                 />
// //               )}
// //             </div>
// //             <div className="timestamp">
// //               {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
// //             </div>
// //           </div>
// //         ))}
// //         <div ref={messagesEndRef} />
// //       </div>
// //       <div className="message-input">
// //         {selectedFile && (
// //           <div className="file-preview">
// //             <span>📎 {selectedFile.name}</span>
// //             <button onClick={() => {
// //               setSelectedFile(null);
// //               fileInputRef.current.value = null;
// //             }} title="Cancel file selection">
// //               &times;
// //             </button>
// //           </div>
// //         )}
// //         <input
// //           type="file"
// //           ref={fileInputRef}
// //           onChange={handleFileChange}
// //           style={{ display: 'none' }}
// //         />
// //         <button onClick={() => fileInputRef.current.click()} className="attach-button" title="Attach file">
// //           📎
// //         </button>
// //         <input
// //           type="text"
// //           value={newMessage}
// //           onChange={(e) => setNewMessage(e.target.value)}
// //           onKeyPress={(e) => e.key === 'Enter' && handleSend()}
// //           placeholder={selectedFile ? "Click send to transfer the file" : "Type a message..."}
// //           disabled={!!selectedFile}
// //         />
// //         <button onClick={handleSend} className="send-button" disabled={!newMessage.trim() && !selectedFile} title="Send">
// //           ➤
// //         </button>
// //       </div>
// //     </div>
// //   );
// // };

// // export default Chat;
// import React, { useState, useEffect, useRef } from 'react';
// import socketService from '../services/socketService';
// import { toast } from 'react-hot-toast';

// // A helper component to render file-related messages cleanly with Font Awesome icons
// const FileMessage = ({ msg, acceptFile, rejectFile, formatFileSize }) => {

//     const getIconForStatus = () => {
//         // This logic preserves the original display rules (e.g., only receiver sees the "completed" checkmark)
//         if (msg.status === 'completed' && !msg.isOwn) {
//             return <i className="fas fa-check-circle status-icon-success"></i>;
//         }
//         if (msg.status === 'rejected' || msg.status === 'failed') {
//             return <i className="fas fa-times-circle status-icon-danger"></i>;
//         }
//         if (msg.status === 'sending' || msg.status === 'receiving') {
//             return <i className="fas fa-spinner fa-spin status-icon-progress"></i>;
//         }
//         // For 'pending' or 'completed' on the sender's side
//         return <i className="fas fa-clock status-icon-pending"></i>;
//     };

//     // Incoming file request
//     if (msg.type === 'file-request') {
//         return (
//             <div className="file-message info">
//                 <div className="file-icon"><i className="fas fa-file-alt"></i></div>
//                 <div className="file-details">
//                     <strong>{msg.fromUsername} wants to send a file:</strong>
//                     <span>{msg.fileName} ({formatFileSize(msg.fileSize)})</span>
//                 </div>
//                 <div className="file-actions">
//                     <button onClick={() => acceptFile(msg)} className="btn-success">
//                         <i className="fas fa-check"></i>
//                     </button>
//                     <button onClick={() => rejectFile(msg)} className="btn-danger">
//                         <i className="fas fa-times"></i>
//                     </button>
//                 </div>
//             </div>
//         );
//     }

//     // File transfer in progress, completed, or rejected
//     if (msg.type === 'file-transfer') {
//         const progress = msg.fileSize > 0 ? (msg.isOwn ?
//             (msg.sentSize / msg.fileSize) * 100 :
//             (msg.receivedSize / msg.fileSize) * 100) : 0;

//         const getStatusText = () => {
//             switch (msg.status) {
//                 case 'pending': return `Waiting for ${msg.toUsername} to accept...`;
//                 case 'sending': return `Sending... ${Math.round(progress)}%`;
//                 case 'receiving': return `Receiving... ${Math.round(progress)}%`;
//                 case 'completed': return msg.isOwn ? `Sent successfully!` : `Download complete!`;
//                 case 'rejected': return `Transfer rejected by user.`;
//                 case 'failed': return `Transfer failed.`;
//                 default: return 'File Transfer';
//             }
//         };

//         return (
//             <div className={`file-message ${msg.status}`}>
//                 <div className="file-icon">
//                     {getIconForStatus()}
//                 </div>
//                 <div className="file-details">
//                     <strong>{msg.fileName}</strong>
//                     <span>{formatFileSize(msg.fileSize)}</span>
//                     <div className="status-text">{getStatusText()}</div>
//                     {(msg.status === 'sending' || msg.status === 'receiving') && (
//                         <progress value={progress} max="100"></progress>
//                     )}
//                 </div>
//             </div>
//         );
//     }
//     return null;
// };


// const Chat = ({ username, messages, setMessages, users, sendFile, acceptFile, rejectFile, formatFileSize }) => {
//     const [newMessage, setNewMessage] = useState('');
//     const [selectedFile, setSelectedFile] = useState(null);
//     const messagesEndRef = useRef(null);
//     const fileInputRef = useRef(null);

//     useEffect(() => {
//         messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//     }, [messages]);

//     const handleFileChange = (e) => {
//         if (e.target.files && e.target.files[0]) {
//             if (e.target.files[0].size > 2048 * 1024 * 1024) { // 2GB limit
//                 toast.error("File is too large (max 2GB).");
//                 return;
//             }
//             setSelectedFile(e.target.files[0]);
//         }
//     };

//     const handleSend = () => {
//         if (selectedFile) {
//             const recipients = users.filter(u => u.id !== socketService.getSocketId());
//             if (recipients.length === 0) {
//                 toast.error("No one is in the room to send the file to.");
//                 return;
//             }
//             recipients.forEach(user => {
//                 sendFile(user.id, selectedFile);
//             });
//             setSelectedFile(null);
//             fileInputRef.current.value = null; // Clear the file input
//         } else {
//             if (newMessage.trim()) {
//                 const timestamp = Date.now();
//                 socketService.sendChatMessage(newMessage, timestamp);
//                 setMessages(prev => [...prev, { type: 'text', username, message: newMessage, timestamp, isOwn: true }]);
//                 setNewMessage('');
//             }
//         }
//     };

//     return (
//         <div className="chat-section">
//             <div className="messages">
//                 {messages.map((msg, index) => (
//                     <div key={msg.id || index} className={`message ${msg.isOwn ? 'own-message' : ''}`}>
//                         {!msg.isOwn && msg.type === 'text' && (
//                             <div className="message-header">{msg.username}</div>
//                         )}
//                         <div className="message-bubble">
//                             {msg.type === 'text' ? (
//                                 <div className="message-content">{msg.message}</div>
//                             ) : (
//                                 <FileMessage
//                                     msg={msg}
//                                     acceptFile={acceptFile}
//                                     rejectFile={rejectFile}
//                                     formatFileSize={formatFileSize}
//                                 />
//                             )}
//                         </div>
//                         <div className="timestamp">
//                             {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
//                         </div>
//                     </div>
//                 ))}
//                 <div ref={messagesEndRef} />
//             </div>
//             <div className="message-input">
//                 {selectedFile && (
//                     <div className="file-preview">
//                         <span><i className="fas fa-paperclip"></i> {selectedFile.name}</span>
//                         <button onClick={() => {
//                             setSelectedFile(null);
//                             fileInputRef.current.value = null;
//                         }} title="Cancel file selection">
//                             <i className="fas fa-times"></i>
//                         </button>
//                     </div>
//                 )}
//                 <input
//                     type="file"
//                     ref={fileInputRef}
//                     onChange={handleFileChange}
//                     style={{ display: 'none' }}
//                 />
//                 <button onClick={() => fileInputRef.current.click()} className="attach-button" title="Attach file">
//                     <i className="fas fa-paperclip"></i>
//                 </button>
//                 <input
//                     type="text"
//                     value={newMessage}
//                     onChange={(e) => setNewMessage(e.target.value)}
//                     onKeyPress={(e) => e.key === 'Enter' && handleSend()}
//                     placeholder={selectedFile ? "Click send to transfer the file" : "Type a message..."}
//                     disabled={!!selectedFile}
//                 />
//                 <button onClick={handleSend} className="send-button" disabled={!newMessage.trim() && !selectedFile} title="Send">
//                     <i className="fas fa-paper-plane"></i>
//                 </button>
//             </div>
//         </div>
//     );
// };

// export default Chat;
import React, { useState, useEffect, useRef } from 'react';
import socketService from '../services/socketService';
import { toast } from 'react-hot-toast';
import FileMessage from './FileMessage'; // Assuming FileMessage is in a separate file

const Chat = ({ username, messages, setMessages, users, sendFile, acceptFile, rejectFile, formatFileSize }) => {
    const [newMessage, setNewMessage] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            if (e.target.files[0].size > 2048 * 1024 * 1024) { // 2GB limit
                toast.error("File is too large (max 2GB).");
                return;
            }
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleSend = () => {
        if (selectedFile) {
            // NEW: Get all other users' IDs and send to all at once
            const recipientIds = users
                .filter(u => u.id !== socketService.getSocketId())
                .map(u => u.id);

            if (recipientIds.length === 0) {
                toast.error("No one is in the room to send the file to.");
                return;
            }
            
            sendFile(recipientIds, selectedFile);

            setSelectedFile(null);
            fileInputRef.current.value = null;
        } else {
            if (newMessage.trim()) {
                const timestamp = Date.now();
                socketService.sendChatMessage(newMessage, timestamp);
                setMessages(prev => [...prev, { type: 'text', username, message: newMessage, timestamp, isOwn: true, id: `${socketService.getSocketId()}-${timestamp}` }]);
                setNewMessage('');
            }
        }
    };

    return (
        <div className="chat-section">
            <div className="messages">
                {messages.map((msg, index) => (
                    <div key={msg.id || index} className={`message ${msg.isOwn ? 'own-message' : ''}`}>
                        {!msg.isOwn && msg.type === 'text' && (
                            <div className="message-header">{msg.username}</div>
                        )}
                        <div className="message-bubble">
                            {msg.type === 'text' ? (
                                <div className="message-content">{msg.message}</div>
                            ) : (
                                <FileMessage
                                    msg={msg}
                                    acceptFile={acceptFile}
                                    rejectFile={rejectFile}
                                    formatFileSize={formatFileSize}
                                />)
                              }
                        </div>
                        <div className="timestamp">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div className="message-input">
                {selectedFile && (
                    <div className="file-preview">
                        <span><i className="fas fa-paperclip"></i> {selectedFile.name}</span>
                        <button onClick={() => {
                            setSelectedFile(null);
                            fileInputRef.current.value = null;
                        }} title="Cancel file selection">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                )}
                <input
                    type="file" ref={fileInputRef} onChange={handleFileChange}
                    style={{ display: 'none' }}
                />
                <button onClick={() => fileInputRef.current.click()} className="attach-button" title="Attach file">
                    <i className="fas fa-paperclip"></i>
                </button>
                <input
                    type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={selectedFile ? "Click send to transfer the file" : "Type a message..."}
                    disabled={!!selectedFile}
                />
                <button onClick={handleSend} className="send-button" disabled={!newMessage.trim() && !selectedFile} title="Send">
                    <i className="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    );
};

export default Chat;