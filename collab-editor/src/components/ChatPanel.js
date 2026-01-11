import React, { useState, useEffect, useRef } from 'react';
import './css/ChatPanel.css';

const ChatPanel = ({ socket, documentId, username, currentLine, onLineClick }) => {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [typingUsers, setTypingUsers] = useState(new Set());
    const [isCollapsed, setIsCollapsed] = useState(false);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    useEffect(() => {
        if (!socket) return;

        // Load chat history on mount
        socket.emit('load-chat-history', documentId);

        // Listen for chat history
        socket.on('chat-history', (history) => {
            setMessages(history);
        });

        // Listen for new messages
        socket.on('receive-chat-message', (message) => {
            setMessages((prev) => [...prev, message]);
        });

        // Listen for typing indicators
        socket.on('user-typing', ({ username: typingUsername, isTyping }) => {
            setTypingUsers((prev) => {
                const newSet = new Set(prev);
                if (isTyping) {
                    newSet.add(typingUsername);
                } else {
                    newSet.delete(typingUsername);
                }
                return newSet;
            });
        });

        // Listen for errors
        socket.on('chat-error', ({ message: errorMsg }) => {
            alert(`Chat error: ${errorMsg}`);
        });

        return () => {
            socket.off('chat-history');
            socket.off('receive-chat-message');
            socket.off('user-typing');
            socket.off('chat-error');
        };
    }, [socket, documentId]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!inputMessage.trim()) return;

        socket.emit('send-chat-message', {
            documentId,
            message: inputMessage,
            lineReference: null
        });

        setInputMessage('');
        handleTyping(false);
    };

    const handleInputChange = (e) => {
        setInputMessage(e.target.value);
        handleTyping(true);
    };

    const handleTyping = (typing) => {
        if (typing) {
            if (!isTyping) {
                setIsTyping(true);
                socket.emit('chat-typing', { documentId, isTyping: true });
            }

            // Clear previous timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            // Stop typing after 2 seconds of inactivity
            typingTimeoutRef.current = setTimeout(() => {
                setIsTyping(false);
                socket.emit('chat-typing', { documentId, isTyping: false });
            }, 2000);
        } else {
            setIsTyping(false);
            socket.emit('chat-typing', { documentId, isTyping: false });
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        }
    };

    const handleTagCurrentLine = () => {
        if (!currentLine || !inputMessage) return;

        socket.emit('send-chat-message', {
            documentId,
            message: inputMessage,
            lineReference: currentLine
        });

        setInputMessage('');
        handleTyping(false);
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className={`chat-panel ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="chat-header">
                <div className="chat-title">
                    <span className="chat-icon">💬</span>
                    <span>Chat</span>
                    <span className="chat-count">{messages.length}</span>
                </div>
                <button
                    className="collapse-button"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    title={isCollapsed ? 'Expand' : 'Collapse'}
                >
                    {isCollapsed ? '←' : '→'}
                </button>
            </div>

            {!isCollapsed && (
                <>
                    <div className="messages-container">
                        {messages.length === 0 ? (
                            <div className="empty-state">
                                <span className="empty-icon">💭</span>
                                <p>No messages yet</p>
                                <small>Start a conversation with your team!</small>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div key={msg.id} className="message">
                                    <div className="message-header">
                                        <span
                                            className="message-author"
                                            style={{ color: msg.userColor }}
                                        >
                                            {msg.username}
                                        </span>
                                        <span className="message-time">
                                            {formatTime(msg.createdAt)}
                                        </span>
                                    </div>
                                    <div className="message-content">
                                        {msg.message}
                                        {msg.lineReference && (
                                            <button
                                                className="line-reference"
                                                onClick={() => onLineClick(msg.lineReference)}
                                                title={`Jump to line ${msg.lineReference}`}
                                            >
                                                Line {msg.lineReference}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {typingUsers.size > 0 && (
                        <div className="typing-indicator">
                            {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                        </div>
                    )}

                    <form className="chat-input-container" onSubmit={handleSendMessage}>
                        <div className="input-wrapper">
                            <input
                                type="text"
                                className="chat-input"
                                placeholder="Type a message..."
                                value={inputMessage}
                                onChange={handleInputChange}
                                autoComplete="off"
                            />
                            {currentLine && inputMessage && (
                                <button
                                    type="button"
                                    className="tag-line-button"
                                    onClick={handleTagCurrentLine}
                                    title={`Tag line ${currentLine}`}
                                >
                                    🔖 Line {currentLine}
                                </button>
                            )}
                        </div>
                        <button
                            type="submit"
                            className="send-button"
                            disabled={!inputMessage.trim()}
                        >
                            Send
                        </button>
                    </form>
                </>
            )}
        </div>
    );
};

export default ChatPanel;
