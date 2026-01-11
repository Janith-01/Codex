import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { supabase } from '../supabaseClient';
import io from 'socket.io-client';
import './css/EditorPage.css';

const SOCKET_SERVER_URL = 'http://localhost:4000';

const EditorPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [content, setContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState('saved');
    const [lastSaved, setLastSaved] = useState(null);
    const [language, setLanguage] = useState('javascript');
    const [theme, setTheme] = useState('vs-dark');
    const [activeUsers, setActiveUsers] = useState(1);
    const [isConnected, setIsConnected] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [serverVersion, setServerVersion] = useState(0);

    const editorRef = useRef(null);
    const saveTimeoutRef = useRef(null);
    const socketRef = useRef(null);
    const isRemoteChangeRef = useRef(false);
    const pendingChangeRef = useRef(false);

    // Fetch document content on mount
    useEffect(() => {
        const fetchDocument = async () => {
            try {
                const { data, error } = await supabase
                    .from('documents')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) {
                    console.error('Error fetching document:', error);
                    alert('Document not found!');
                    navigate('/');
                    return;
                }

                setContent(data.content || '');
                setLastSaved(new Date(data.created_at));
            } catch (err) {
                console.error('Unexpected error:', err);
                alert('Failed to load document.');
                navigate('/');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDocument();
    }, [id, navigate]);

    // Socket.io Setup with Conflict Resolution
    useEffect(() => {
        if (!id || isLoading) return;

        // Initialize socket connection
        socketRef.current = io(SOCKET_SERVER_URL, {
            transports: ['websocket', 'polling'],
        });

        const socket = socketRef.current;

        // Connection established
        socket.on('connect', () => {
            console.log('✅ Socket connected:', socket.id);
            setIsConnected(true);

            // Join the document room
            socket.emit('join-document', id);
        });

        // Connection error
        socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error);
            setIsConnected(false);
            setIsSyncing(false);
        });

        // Disconnection
        socket.on('disconnect', () => {
            console.log('❌ Socket disconnected');
            setIsConnected(false);
            setIsSyncing(false);
        });

        // Receive initial server state when joining
        socket.on('document-state', ({ content: serverContent, version }) => {
            console.log(`📥 Received server state (v${version})`);

            isRemoteChangeRef.current = true;
            setContent(serverContent);
            setServerVersion(version);
            setIsSyncing(false);

            // Update editor with server state
            if (editorRef.current && serverContent !== editorRef.current.getValue()) {
                const position = editorRef.current.getPosition();
                editorRef.current.setValue(serverContent);

                // Restore cursor position
                if (position) {
                    editorRef.current.setPosition(position);
                }
            }
        });

        // Receive changes from server (FULL DOCUMENT STATE)
        socket.on('receive-changes', ({ content: serverContent, version, from }) => {
            // Don't apply our own changes back to us
            if (from === socket.id) {
                console.log(`✅ Server confirmed our change (v${version})`);
                setIsSyncing(false);
                setServerVersion(version);
                setSaveStatus('saved');
                setLastSaved(new Date());
                return;
            }

            console.log(`📥 Received changes from another user (v${version})`);

            // Mark as remote change to prevent feedback loop
            isRemoteChangeRef.current = true;
            setContent(serverContent);
            setServerVersion(version);
            setIsSyncing(false);

            // Update editor with cursor position preservation
            if (editorRef.current) {
                const currentContent = editorRef.current.getValue();

                // Only update if content actually changed
                if (currentContent !== serverContent) {
                    const position = editorRef.current.getPosition();
                    const scrollPosition = editorRef.current.getScrollTop();

                    editorRef.current.setValue(serverContent);

                    // Restore cursor and scroll position
                    if (position) {
                        try {
                            editorRef.current.setPosition(position);
                            editorRef.current.setScrollTop(scrollPosition);
                        } catch (e) {
                            // Position might be out of bounds after update
                            console.warn('Could not restore cursor position');
                        }
                    }
                }
            }
        });

        // User count updates
        socket.on('user-count-update', (count) => {
            console.log('👥 Active users:', count);
            setActiveUsers(count);
        });

        // Error handling
        socket.on('error', ({ message }) => {
            console.error('Server error:', message);
            alert(`Server error: ${message}`);
            setIsSyncing(false);
        });

        // Cleanup on unmount
        return () => {
            if (socket) {
                socket.emit('leave-document', id);
                socket.disconnect();
            }
        };
    }, [id, isLoading]);

    // Manual save function (forces sync with server)
    const handleSave = async () => {
        if (isSaving || isSyncing) return;

        setIsSaving(true);
        setIsSyncing(true);
        setSaveStatus('saving');

        try {
            // Save to Supabase
            const { error } = await supabase
                .from('documents')
                .update({ content })
                .eq('id', id);

            if (error) {
                console.error('Error saving document:', error);
                alert('Failed to save document.');
                setSaveStatus('unsaved');
                setIsSyncing(false);
                return;
            }

            // Also sync with server if connected
            if (socketRef.current && socketRef.current.connected) {
                socketRef.current.emit('send-changes', {
                    documentId: id,
                    content: content
                });
            } else {
                setSaveStatus('saved');
                setIsSyncing(false);
            }

            setLastSaved(new Date());
        } catch (err) {
            console.error('Unexpected error:', err);
            setSaveStatus('unsaved');
            setIsSyncing(false);
        } finally {
            setIsSaving(false);
        }
    };

    // Debounced auto-save with server sync
    const debouncedSave = useCallback(
        (newContent) => {
            setSaveStatus('unsaved');

            // Clear existing timeout
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }

            // Set new timeout for auto-save AND server sync
            saveTimeoutRef.current = setTimeout(async () => {
                setSaveStatus('saving');
                setIsSyncing(true);

                try {
                    // Save to Supabase
                    const { error } = await supabase
                        .from('documents')
                        .update({ content: newContent })
                        .eq('id', id);

                    if (error) {
                        console.error('Auto-save error:', error);
                        setSaveStatus('unsaved');
                        setIsSyncing(false);
                        return;
                    }

                    // Sync with server - server will broadcast to all clients
                    if (socketRef.current && socketRef.current.connected) {
                        socketRef.current.emit('send-changes', {
                            documentId: id,
                            content: newContent
                        });
                        // Don't set saved yet - wait for server confirmation
                    } else {
                        setSaveStatus('saved');
                        setLastSaved(new Date());
                        setIsSyncing(false);
                    }
                } catch (err) {
                    console.error('Auto-save unexpected error:', err);
                    setSaveStatus('unsaved');
                    setIsSyncing(false);
                }
            }, 1000); // 1 second debounce
        },
        [id]
    );

    // Handle editor content change
    const handleEditorChange = (value) => {
        // Ignore if this is a remote change
        if (isRemoteChangeRef.current) {
            isRemoteChangeRef.current = false;
            return;
        }

        const newContent = value || '';
        setContent(newContent);
        debouncedSave(newContent);
    };

    // Handle editor mount
    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;

        // Add keyboard shortcut for manual save (Ctrl+S / Cmd+S)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            handleSave();
        });

        // Add keyboard shortcut for sync request (Ctrl+Shift+S)
        editor.addCommand(
            monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS,
            () => {
                if (socketRef.current && socketRef.current.connected) {
                    console.log('🔄 Requesting server state...');
                    setIsSyncing(true);
                    socketRef.current.emit('request-sync', id);
                }
            }
        );
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    // Format last saved time
    const formatLastSaved = () => {
        if (!lastSaved) return '';

        const now = new Date();
        const diff = Math.floor((now - lastSaved) / 1000);

        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return lastSaved.toLocaleDateString();
    };

    const copyDocumentLink = () => {
        navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
    };

    if (isLoading) {
        return (
            <div className="editor-loading">
                <div className="loading-spinner"></div>
                <p>Loading document...</p>
            </div>
        );
    }

    return (
        <div className="editor-container">
            <header className="editor-header">
                <div className="header-left">
                    <button className="home-button" onClick={() => navigate('/')} title="Home">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                    </button>
                    <h1 className="editor-title">Codex Editor</h1>
                    <span className="document-id">Document: {id.substring(0, 8)}...</span>

                    {/* Real-time collaboration indicator */}
                    <div className="collaboration-status">
                        <span className={`connection-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
                        <span className="user-count">
                            {activeUsers} {activeUsers === 1 ? 'user' : 'users'} online
                        </span>
                        {serverVersion > 0 && (
                            <span className="version-badge">v{serverVersion}</span>
                        )}
                    </div>
                </div>

                <div className="header-controls">
                    <select
                        className="language-select"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                    >
                        <option value="javascript">JavaScript</option>
                        <option value="typescript">TypeScript</option>
                        <option value="python">Python</option>
                        <option value="java">Java</option>
                        <option value="html">HTML</option>
                        <option value="css">CSS</option>
                        <option value="json">JSON</option>
                        <option value="markdown">Markdown</option>
                    </select>

                    <select
                        className="theme-select"
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                    >
                        <option value="vs-dark">Dark</option>
                        <option value="light">Light</option>
                        <option value="hc-black">High Contrast</option>
                    </select>

                    <button className="link-button" onClick={copyDocumentLink} title="Copy Link">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </button>
                </div>

                <div className="header-right">
                    <div className="save-status">
                        {isSyncing && (
                            <>
                                <span className="status-spinner"></span>
                                <span>Syncing...</span>
                            </>
                        )}
                        {!isSyncing && saveStatus === 'saving' && (
                            <>
                                <span className="status-spinner"></span>
                                <span>Saving...</span>
                            </>
                        )}
                        {!isSyncing && saveStatus === 'saved' && (
                            <>
                                <span className="status-dot saved"></span>
                                <span>Saved {formatLastSaved()}</span>
                            </>
                        )}
                        {!isSyncing && saveStatus === 'unsaved' && (
                            <>
                                <span className="status-dot unsaved"></span>
                                <span>Unsaved changes</span>
                            </>
                        )}
                    </div>

                    <button
                        className="save-button"
                        onClick={handleSave}
                        disabled={isSaving || isSyncing || saveStatus === 'saved'}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Save
                    </button>
                </div>
            </header>

            <div className="editor-wrapper">
                <Editor
                    height="100%"
                    language={language}
                    theme={theme}
                    value={content}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    options={{
                        minimap: { enabled: true },
                        fontSize: 14,
                        lineNumbers: 'on',
                        roundedSelection: false,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2,
                        wordWrap: 'on',
                    }}
                />
            </div>

            <footer className="editor-footer">
                <div className="footer-info">
                    <span>
                        {isConnected ? (
                            <>
                                🟢 Real-time sync active {isSyncing && '• Syncing...'}
                            </>
                        ) : (
                            '🔴 Offline mode'
                        )}
                        {' • '}
                        Auto-save enabled • Press Ctrl+S to save manually
                        {isConnected && ' • Ctrl+Shift+S to force sync'}
                    </span>
                </div>
            </footer>
        </div>
    );
};

export default EditorPage;
