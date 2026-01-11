import React, { useState, useEffect } from 'react';
import './css/UsernameModal.css';

const COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F8B195', '#C06C84', '#6C5B7B', '#355C7D'
];

const UsernameModal = ({ onUsernameSubmit }) => {
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        // Check if username is already saved
        const savedUsername = localStorage.getItem('codex-username');
        const savedColor = localStorage.getItem('codex-user-color');

        if (savedUsername && savedColor) {
            onUsernameSubmit(savedUsername, savedColor);
        }
    }, [onUsernameSubmit]);

    const handleSubmit = (e) => {
        e.preventDefault();

        const trimmed = username.trim();

        if (!trimmed) {
            setError('Please enter a username');
            return;
        }

        if (trimmed.length < 2) {
            setError('Username must be at least 2 characters');
            return;
        }

        if (trimmed.length > 20) {
            setError('Username must be less than 20 characters');
            return;
        }

        // Generate random color for user
        const userColor = COLORS[Math.floor(Math.random() * COLORS.length)];

        // Save to localStorage
        localStorage.setItem('codex-username', trimmed);
        localStorage.setItem('codex-user-color', userColor);

        onUsernameSubmit(trimmed, userColor);
    };

    const handleChange = (e) => {
        setUsername(e.target.value);
        setError('');
    };

    return (
        <div className="username-modal-overlay">
            <div className="username-modal">
                <div className="username-modal-header">
                    <h2>Welcome to Codex Editor! 👋</h2>
                    <p>Choose a username to start collaborating</p>
                </div>

                <form onSubmit={handleSubmit} className="username-form">
                    <div className="input-group">
                        <input
                            type="text"
                            value={username}
                            onChange={handleChange}
                            placeholder="Enter your username..."
                            autoFocus
                            className={error ? 'error' : ''}
                            maxLength={20}
                        />
                        {error && <span className="error-message">{error}</span>}
                    </div>

                    <button type="submit" className="submit-button">
                        Start Coding
                    </button>

                    <p className="hint">
                        💡 Your username will be visible to other collaborators
                    </p>
                </form>
            </div>
        </div>
    );
};

export default UsernameModal;
