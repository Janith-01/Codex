import React from 'react';
import './css/WhosOnline.css';

const WhosOnline = ({ users, currentUserId }) => {
    const getInitials = (name) => {
        if (!name) return '?';
        return name
            .split(' ')
            .map(part => part[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();
    };

    const getAvatarColor = (color) => {
        return color || '#667eea';
    };

    return (
        <div className="whos-online">
            <div className="whos-online-header">
                <span className="online-icon">👥</span>
                <span className="online-title">Online ({users.length})</span>
            </div>

            <div className="online-users-list">
                {users.length === 0 ? (
                    <div className="no-users">
                        <p>No other users online</p>
                    </div>
                ) : (
                    users.map((user) => (
                        <div
                            key={user.socketId}
                            className={`online-user ${user.socketId === currentUserId ? 'current-user' : ''}`}
                        >
                            <div
                                className="user-avatar"
                                style={{ backgroundColor: getAvatarColor(user.color) }}
                                title={user.username}
                            >
                                {getInitials(user.username)}
                            </div>
                            <div className="user-info">
                                <div className="user-name">
                                    {user.username}
                                    {user.socketId === currentUserId && (
                                        <span className="you-badge">You</span>
                                    )}
                                </div>
                                <div className="user-status">
                                    <span className="status-dot active"></span>
                                    <span>Active</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="whos-online-footer">
                <button className="invite-button" onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert('Link copied! Share it to invite others.');
                }}>
                    <span>🔗</span>
                    Invite Others
                </button>
            </div>
        </div>
    );
};

export default WhosOnline;
