import React, { useState, useEffect } from 'react';
import './css/FileExplorer.css';

const FileExplorer = ({ socket, documentId, currentFileId, onFileSelect, onFileCreate, onFileDelete, onFileRename }) => {
    const [files, setFiles] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newFilename, setNewFilename] = useState('');
    const [contextMenu, setContextMenu] = useState(null);
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        if (!socket) return;

        // Load workspace files
        socket.emit('load-workspace', documentId);

        // Listen for workspace loaded
        socket.on('workspace-loaded', (loadedFiles) => {
            setFiles(loadedFiles);
            // Auto-select first file or active file
            const activeFile = loadedFiles.find(f => f.isActive) || loadedFiles[0];
            if (activeFile && !currentFileId) {
                onFileSelect(activeFile);
            }
        });

        // Listen for file created
        socket.on('file-created', (file) => {
            setFiles((prev) => [...prev, file].sort((a, b) => a.filename.localeCompare(b.filename)));
        });

        // Listen for file deleted
        socket.on('file-deleted', ({ fileId }) => {
            setFiles((prev) => prev.filter(f => f.id !== fileId));
        });

        // Listen for file renamed
        socket.on('file-renamed', ({ fileId, newFilename }) => {
            setFiles((prev) =>
                prev.map(f => f.id === fileId ? { ...f, filename: newFilename } : f)
                    .sort((a, b) => a.filename.localeCompare(b.filename))
            );
        });

        // Listen for file updated
        socket.on('file-updated', ({ fileId, content }) => {
            setFiles((prev) =>
                prev.map(f => f.id === fileId ? { ...f, content } : f)
            );
        });

        // Listen for user switched file
        socket.on('user-switched-file', ({ username, filename }) => {
            console.log(`${username} switched to ${filename}`);
        });

        // Listen for errors
        socket.on('file-error', ({ message }) => {
            alert(`File error: ${message}`);
        });

        return () => {
            socket.off('workspace-loaded');
            socket.off('file-created');
            socket.off('file-deleted');
            socket.off('file-renamed');
            socket.off('file-updated');
            socket.off('user-switched-file');
            socket.off('file-error');
        };
    }, [socket, documentId]);

    const getFileIcon = (filename) => {
        const ext = filename.split('.').pop().toLowerCase();
        const iconMap = {
            js: '📜',
            jsx: '⚛️',
            ts: '📘',
            tsx: '⚛️',
            py: '🐍',
            java: '☕',
            cpp: '⚙️',
            c: '⚙️',
            html: '🌐',
            css: '🎨',
            json: '📋',
            md: '📝',
            txt: '📄',
            xml: '📰',
            yml: '⚙️',
            yaml: '⚙️',
        };
        return iconMap[ext] || '📄';
    };

    const getLanguageFromFilename = (filename) => {
        const ext = filename.split('.').pop().toLowerCase();
        const langMap = {
            js: 'javascript',
            jsx: 'javascript',
            ts: 'typescript',
            tsx: 'typescript',
            py: 'python',
            java: 'java',
            cpp: 'cpp',
            c: 'c',
            html: 'html',
            css: 'css',
            json: 'json',
            md: 'markdown',
            txt: 'plaintext',
            xml: 'xml',
            yml: 'yaml',
            yaml: 'yaml',
        };
        return langMap[ext] || 'plaintext';
    };

    const handleCreateFile = () => {
        if (!newFilename.trim()) {
            alert('Please enter a filename');
            return;
        }

        // Check for duplicates
        if (files.some(f => f.filename === newFilename)) {
            alert('File already exists');
            return;
        }

        const language = getLanguageFromFilename(newFilename);
        socket.emit('create-file', {
            documentId,
            filename: newFilename,
            language
        });

        setNewFilename('');
        setIsCreating(false);
    };

    const handleDeleteFile = (fileId) => {
        if (files.length === 1) {
            alert('Cannot delete the last file');
            return;
        }

        if (confirm('Are you sure you want to delete this file?')) {
            socket.emit('delete-file', { documentId, fileId });
        }
    };

    const handleRenameFile = (fileId) => {
        const file = files.find(f => f.id === fileId);
        const newName = prompt('Enter new filename:', file.filename);

        if (newName && newName.trim() && newName !== file.filename) {
            // Check for duplicates
            if (files.some(f => f.filename === newName)) {
                alert('File with this name already exists');
                return;
            }

            socket.emit('rename-file', {
                documentId,
                fileId,
                newFilename: newName
            });
        }
    };

    const handleFileClick = (file) => {
        onFileSelect(file);
        socket.emit('switch-file', { documentId, fileId: file.id });
    };

    const handleRightClick = (e, file) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            file
        });
    };

    const closeContextMenu = () => {
        setContextMenu(null);
    };

    useEffect(() => {
        if (contextMenu) {
            document.addEventListener('click', closeContextMenu);
            return () => document.removeEventListener('click', closeContextMenu);
        }
    }, [contextMenu]);

    return (
        <div className={`file-explorer ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="explorer-header">
                <div className="explorer-title">
                    <span className="explorer-icon">📁</span>
                    <span>Files</span>
                    <span className="file-count">{files.length}</span>
                </div>
                <div className="header-actions">
                    <button
                        className="new-file-button"
                        onClick={() => setIsCreating(true)}
                        title="New File"
                    >
                        +
                    </button>
                    <button
                        className="collapse-button"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        title={isCollapsed ? 'Expand' : 'Collapse'}
                    >
                        {isCollapsed ? '→' : '←'}
                    </button>
                </div>
            </div>

            {!isCollapsed && (
                <>
                    {isCreating && (
                        <div className="create-file-form">
                            <input
                                type="text"
                                className="filename-input"
                                placeholder="filename.ext"
                                value={newFilename}
                                onChange={(e) => setNewFilename(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleCreateFile()}
                                autoFocus
                            />
                            <div className="form-actions">
                                <button className="confirm-button" onClick={handleCreateFile}>
                                    Create
                                </button>
                                <button className="cancel-button" onClick={() => {
                                    setIsCreating(false);
                                    setNewFilename('');
                                }}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="files-list">
                        {files.map((file) => (
                            <div
                                key={file.id}
                                className={`file-item ${file.id === currentFileId ? 'active' : ''}`}
                                onClick={() => handleFileClick(file)}
                                onContextMenu={(e) => handleRightClick(e, file)}
                            >
                                <span className="file-icon">{getFileIcon(file.filename)}</span>
                                <span className="file-name">{file.filename}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {contextMenu && (
                <div
                    className="context-menu"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <div
                        className="context-menu-item"
                        onClick={() => {
                            handleRenameFile(contextMenu.file.id);
                            closeContextMenu();
                        }}
                    >
                        ✏️ Rename
                    </div>
                    <div
                        className="context-menu-item delete"
                        onClick={() => {
                            handleDeleteFile(contextMenu.file.id);
                            closeContextMenu();
                        }}
                    >
                        🗑️ Delete
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileExplorer;
