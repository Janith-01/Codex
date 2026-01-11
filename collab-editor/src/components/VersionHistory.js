import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './css/VersionHistory.css';

const VersionHistory = ({ documentId, onRestore, onClose }) => {
    const [versions, setVersions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedVersion, setSelectedVersion] = useState(null);
    const [previewContent, setPreviewContent] = useState('');

    useEffect(() => {
        fetchVersions();
    }, [documentId]);

    const fetchVersions = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('document_versions')
                .select('*')
                .eq('document_id', documentId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.error('Error fetching versions:', error);
                return;
            }

            setVersions(data || []);
        } catch (err) {
            console.error('Unexpected error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVersionClick = (version) => {
        setSelectedVersion(version);
        setPreviewContent(version.content);
    };

    const handleRestore = () => {
        if (selectedVersion && window.confirm(`Restore version ${selectedVersion.version_number}? This will create a new snapshot of the current version before restoring.`)) {
            onRestore(selectedVersion.content);
            onClose();
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };

    const getVersionIcon = (type) => {
        switch (type) {
            case 'manual':
                return '💾';
            case 'restored':
                return '↩️';
            default:
                return '⚡';
        }
    };

    return (
        <div className="version-history-overlay" onClick={onClose}>
            <div className="version-history-panel" onClick={(e) => e.stopPropagation()}>
                <div className="version-history-header">
                    <h2>📜 Version History</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                <div className="version-history-content">
                    <div className="versions-list">
                        <div className="versions-list-header">
                            <h3>Versions ({versions.length})</h3>
                            <button className="refresh-button" onClick={fetchVersions} disabled={isLoading}>
                                🔄
                            </button>
                        </div>

                        {isLoading ? (
                            <div className="loading-state">
                                <div className="spinner"></div>
                                <p>Loading versions...</p>
                            </div>
                        ) : versions.length === 0 ? (
                            <div className="empty-state">
                                <p>📭 No version history yet</p>
                                <small>Versions are created automatically every 5 minutes</small>
                            </div>
                        ) : (
                            <div className="versions-items">
                                {versions.map((version) => (
                                    <div
                                        key={version.id}
                                        className={`version-item ${selectedVersion?.id === version.id ? 'selected' : ''}`}
                                        onClick={() => handleVersionClick(version)}
                                    >
                                        <div className="version-icon">
                                            {getVersionIcon(version.snapshot_type)}
                                        </div>
                                        <div className="version-details">
                                            <div className="version-title">
                                                Version {version.version_number}
                                                {version.snapshot_type === 'manual' && (
                                                    <span className="badge">Manual</span>
                                                )}
                                            </div>
                                            <div className="version-meta">
                                                {formatDate(version.created_at)}
                                                {version.created_by && ` • ${version.created_by}`}
                                            </div>
                                            <div className="version-size">
                                                {version.content.length} characters
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="version-preview">
                        {selectedVersion ? (
                            <>
                                <div className="preview-header">
                                    <h3>Preview - Version {selectedVersion.version_number}</h3>
                                    <button className="restore-button" onClick={handleRestore}>
                                        ↩️ Restore This Version
                                    </button>
                                </div>
                                <pre className="preview-content">{previewContent}</pre>
                            </>
                        ) : (
                            <div className="preview-placeholder">
                                <p>👈 Select a version to preview</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="version-history-footer">
                    <p>💡 Tip: Versions are automatically saved every 5 minutes</p>
                </div>
            </div>
        </div>
    );
};

export default VersionHistory;
