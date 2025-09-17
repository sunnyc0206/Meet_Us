import React, { useState, useEffect, useRef } from "react";
import socketService from "../services/socketService";
import { toast } from "react-hot-toast";
import FileMessage from "./FileMessage";

const Chat = ({
  username,
  messages,
  setMessages,
  users,
  sendFile,
  acceptFile,
  rejectFile,
  formatFileSize,
}) => {
  const [newMessage, setNewMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      if (e.target.files[0].size > 2048 * 1024 * 1024) {
        // 2GB limit
        toast.error("File is too large (max 2GB).");
        return;
      }
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSend = () => {
    if (selectedFile) {
      const recipientIds = users
        .filter((u) => u.id !== socketService.getSocketId())
        .map((u) => u.id);

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
        setMessages((prev) => [
          ...prev,
          {
            type: "text",
            username,
            message: newMessage,
            timestamp,
            isOwn: true,
            id: `${socketService.getSocketId()}-${timestamp}`,
          },
        ]);
        setNewMessage("");
      }
    }
  };

  return (
    <div className="chat-section">
      <div className="messages">
        {messages.map((msg, index) => (
          <div
            key={msg.id || index}
            className={`message ${msg.isOwn ? "own-message" : ""}`}
          >
            {!msg.isOwn && msg.type === "text" && (
              <div className="message-header">{msg.username}</div>
            )}
            <div className="message-bubble">
              {msg.type === "text" ? (
                <div className="message-content">{msg.message}</div>
              ) : (
                <FileMessage
                  msg={msg}
                  acceptFile={acceptFile}
                  rejectFile={rejectFile}
                  formatFileSize={formatFileSize}
                />
              )}
            </div>
            <div className="timestamp">
              {new Date(msg.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="message-input">
        <>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          {selectedFile ? (
            <div className="file-preview">
              <span
                className="file-preview"
                style={{
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%",
                  color: "white",
                  maxWidth: "550px",
                  display: "inline-block",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                <i className="fas fa-file"></i> {selectedFile.name}
              </span>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  fileInputRef.current.value = null;
                }}
                title="Cancel file selection"
              ></button>
            </div>
          ) : (
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              placeholder={
                selectedFile
                  ? "Click send to transfer the file"
                  : "Type a message..."
              }
              disabled={!!selectedFile}
            />
          )}
        </>
        {!selectedFile ? (
          <button
            onClick={() => fileInputRef.current.click()}
            className="send-button"
            title="Attach file"
          >
            <i className="fa-solid fa-paperclip" />
          </button>
        ) : (
          <button
            onClick={() => {
              setSelectedFile(null);
              fileInputRef.current.value = null;
            }}
            className="send-button"
            title="Cancel file"
          >
            <i className="fa-solid fa-times" />
          </button>
        )}

        <button
          onClick={handleSend}
          className="send-button"
          disabled={!newMessage.trim() && !selectedFile}
          title="Send"
        >
          <i className="fas fa-paper-plane"></i>
        </button>
      </div>
    </div>
  );
};

export default Chat;
