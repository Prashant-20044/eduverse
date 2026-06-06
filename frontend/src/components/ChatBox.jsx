import React, { useState, useEffect, useRef } from 'react';
import './ChatBox.css';

const ChatBox = ({ socket, roomId, user }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('receive-chat', (data) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      socket.off('receive-chat');
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const messageData = {
      id: Date.now(),
      senderName: user?.name || 'Anonymous',
      senderRole: user?.role || 'student',
      text: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Optimistically add to UI if needed, but our backend broadcasts to everyone including sender
    socket.emit('send-chat', roomId, messageData);
    setInput('');
  };

  return (
    <div className="chatbox-container glass-panel">
      <div className="chat-header">
        <h3>Class Chat</h3>
      </div>
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.senderName === user?.name ? 'own-message' : ''}`}>
            <div className="msg-info">
              <span className={`msg-role role-${msg.senderRole}`}>{msg.senderRole === 'teacher' ? '👨‍🏫' : '👩‍🎓'} {msg.senderName}</span>
              <span className="msg-time">{msg.timestamp}</span>
            </div>
            <div className="msg-text">{msg.text}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form className="chat-input-form" onSubmit={sendMessage}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="input-field"
        />
        <button type="submit" className="btn-primary" style={{padding: '12px 16px'}}>Send</button>
      </form>
    </div>
  );
};

export default ChatBox;
