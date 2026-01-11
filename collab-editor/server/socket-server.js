require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { getAIService } = require('./ai-service');

const app = express();
app.use(cors());

const server = http.createServer(app);

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Socket.io with CORS
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Initialize AI Service
const aiService = getAIService();
if (aiService) {
    console.log('✅ AI Service initialized');
} else {
    console.log('⚠️  AI Service disabled (no API key)');
}

// ========================================
// SERVER-SIDE STATE MANAGEMENT
// ========================================

// Document state cache: documentId -> { content, lastModified, version }
const documentCache = new Map();

// Active users per document: documentId -> Set of socket IDs
const documentUsers = new Map();

// User metadata: socketId -> { username, color, documentId }
const userMetadata = new Map();

// Document locks for sequential processing
const documentLocks = new Map();

// Workspace state: documentId -> Map<filename, fileData>
const workspaceCache = new Map();

// Active file tracking: documentId -> filename
const activeFiles = new Map();

/**
 * Get or initialize document state
 */
async function getDocumentState(documentId) {
    if (documentCache.has(documentId)) {
        return documentCache.get(documentId);
    }

    // Fetch from Supabase
    try {
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('id', documentId)
            .single();

        if (error) {
            console.error('Error fetching document:', error);
            return null;
        }

        const state = {
            content: data.content || '',
            lastModified: new Date(),
            version: 1
        };

        documentCache.set(documentId, state);
        return state;
    } catch (err) {
        console.error('Unexpected error fetching document:', err);
        return null;
    }
}

/**
 * Update document state and persist to Supabase
 */
async function updateDocumentState(documentId, newContent, socketId) {
    const state = documentCache.get(documentId);

    if (!state) {
        console.error(`No state found for document ${documentId}`);
        return false;
    }

    // Update server state
    state.content = newContent;
    state.lastModified = new Date();
    state.version += 1;

    // Persist to Supabase (async, don't wait)
    supabase
        .from('documents')
        .update({ content: newContent })
        .eq('id', documentId)
        .then(({ error }) => {
            if (error) {
                console.error('Error persisting to Supabase:', error);
            } else {
                console.log(`💾 Persisted document ${documentId.substring(0, 8)}... (v${state.version})`);
            }
        });

    console.log(`📝 Server state updated for ${documentId.substring(0, 8)}... by ${socketId} (v${state.version})`);
    return true;
}

// ========================================
// SOCKET.IO EVENT HANDLERS
// ========================================

io.on('connection', (socket) => {
    console.log(`✅ New connection: ${socket.id}`);

    // Handle joining a document room
    socket.on('join-document', async (documentId) => {
        console.log(`📄 Socket ${socket.id} joining document: ${documentId}`);

        // Leave any previous rooms
        const rooms = Array.from(socket.rooms);
        rooms.forEach(room => {
            if (room !== socket.id) {
                socket.leave(room);
                if (documentUsers.has(room)) {
                    documentUsers.get(room).delete(socket.id);
                    if (documentUsers.get(room).size === 0) {
                        documentUsers.delete(room);
                        documentCache.delete(room); // Clean up cache
                    }
                }
            }
        });

        // Join the new document room
        socket.join(documentId);

        // Track users in this document
        if (!documentUsers.has(documentId)) {
            documentUsers.set(documentId, new Set());
        }
        documentUsers.get(documentId).add(socket.id);

        // Load document state
        const state = await getDocumentState(documentId);

        if (state) {
            // Send current server state to the newly joined client
            socket.emit('document-state', {
                content: state.content,
                version: state.version
            });
            console.log(`📤 Sent initial state to ${socket.id} (v${state.version})`);
        }

        // Notify the room about user count
        const userCount = documentUsers.get(documentId).size;
        io.to(documentId).emit('user-count-update', userCount);

        console.log(`👥 Document ${documentId.substring(0, 8)}... now has ${userCount} user(s)`);
    });

    // Handle content changes - SERVER IS THE SINGLE SOURCE OF TRUTH
    socket.on('send-changes', async ({ documentId, content }) => {
        console.log(`📥 Change request from ${socket.id} for document ${documentId.substring(0, 8)}...`);

        // Ensure document state exists
        let state = documentCache.get(documentId);
        if (!state) {
            state = await getDocumentState(documentId);
            if (!state) {
                console.error('Document not found');
                socket.emit('error', { message: 'Document not found' });
                return;
            }
        }

        // Update server state
        const success = await updateDocumentState(documentId, content, socket.id);

        if (success) {
            // Broadcast the FULL SERVER STATE to ALL clients in the room
            // This ensures everyone has the exact same content
            io.to(documentId).emit('receive-changes', {
                content: state.content,
                version: state.version,
                from: socket.id
            });

            console.log(`📤 Broadcasted state to room ${documentId.substring(0, 8)}... (v${state.version})`);
        }
    });

    // Request latest state
    socket.on('request-sync', async (documentId) => {
        const state = await getDocumentState(documentId);
        if (state) {
            socket.emit('document-state', {
                content: state.content,
                version: state.version
            });
            console.log(`🔄 Sync requested by ${socket.id} for ${documentId.substring(0, 8)}...`);
        }
    });

    // Handle user identity
    socket.on('set-user-identity', ({ documentId, username, color }) => {
        userMetadata.set(socket.id, { username, color, documentId });
        console.log(`👤 User ${username} (${socket.id}) joined document ${documentId.substring(0, 8)}...`);

        // Broadcast updated user list to all clients in the room
        const users = Array.from(documentUsers.get(documentId) || []).map(sid => {
            const meta = userMetadata.get(sid);
            return meta ? { socketId: sid, username: meta.username, color: meta.color } : null;
        }).filter(Boolean);

        io.to(documentId).emit('users-update', users);
    });

    // Handle cursor position updates with throttling
    socket.on('cursor-move', ({ documentId, position, selection }) => {
        const metadata = userMetadata.get(socket.id);
        if (metadata) {
            socket.to(documentId).emit('cursor-update', {
                socketId: socket.id,
                username: metadata.username,
                color: metadata.color,
                position,
                selection
            });
        }
    });

    // ========================================
    // CHAT HANDLERS (Milestone 07)
    // ========================================

    // Send chat message
    socket.on('send-chat-message', async ({ documentId, message, lineReference }) => {
        const metadata = userMetadata.get(socket.id);
        if (!metadata) {
            console.error('User metadata not found for chat message');
            return;
        }

        try {
            // Save to Supabase
            const { data, error } = await supabase
                .from('chat_messages')
                .insert({
                    document_id: documentId,
                    username: metadata.username,
                    user_color: metadata.color,
                    message: message,
                    line_reference: lineReference || null
                })
                .select()
                .single();

            if (error) {
                console.error('Error saving chat message:', error);
                socket.emit('chat-error', { message: 'Failed to send message' });
                return;
            }

            // Broadcast to all users in the room
            io.to(documentId).emit('receive-chat-message', {
                id: data.id,
                username: metadata.username,
                userColor: metadata.color,
                message: message,
                lineReference: lineReference || null,
                createdAt: data.created_at
            });

            console.log(`💬 Chat message from ${metadata.username} in ${documentId.substring(0, 8)}...`);
        } catch (err) {
            console.error('Unexpected error sending chat message:', err);
            socket.emit('chat-error', { message: 'Failed to send message' });
        }
    });

    // Load chat history
    socket.on('load-chat-history', async (documentId) => {
        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('document_id', documentId)
                .order('created_at', { ascending: true })
                .limit(100); // Load last 100 messages

            if (error) {
                console.error('Error loading chat history:', error);
                return;
            }

            const messages = data.map(msg => ({
                id: msg.id,
                username: msg.username,
                userColor: msg.user_color,
                message: msg.message,
                lineReference: msg.line_reference,
                createdAt: msg.created_at
            }));

            socket.emit('chat-history', messages);
            console.log(`📜 Sent ${messages.length} chat messages to ${socket.id}`);
        } catch (err) {
            console.error('Unexpected error loading chat history:', err);
        }
    });

    // Typing indicator
    socket.on('chat-typing', ({ documentId, isTyping }) => {
        const metadata = userMetadata.get(socket.id);
        if (metadata) {
            socket.to(documentId).emit('user-typing', {
                username: metadata.username,
                isTyping
            });
        }
    });

    // ========================================
    // WORKSPACE HANDLERS (Milestone 07)
    // ========================================

    // Load workspace files
    socket.on('load-workspace', async (documentId) => {
        try {
            const { data, error } = await supabase
                .from('workspace_files')
                .select('*')
                .eq('document_id', documentId)
                .order('filename', { ascending: true });

            if (error) {
                console.error('Error loading workspace:', error);
                return;
            }

            const files = data.map(file => ({
                id: file.id,
                filename: file.filename,
                content: file.content,
                language: file.language,
                isActive: file.is_active,
                updatedAt: file.updated_at
            }));

            socket.emit('workspace-loaded', files);
            console.log(`📁 Sent ${files.length} files to ${socket.id}`);
        } catch (err) {
            console.error('Unexpected error loading workspace:', err);
        }
    });

    // Create file
    socket.on('create-file', async ({ documentId, filename, language }) => {
        try {
            const { data, error } = await supabase
                .from('workspace_files')
                .insert({
                    document_id: documentId,
                    filename: filename,
                    content: '',
                    language: language || 'javascript',
                    is_active: false
                })
                .select()
                .single();

            if (error) {
                console.error('Error creating file:', error);
                socket.emit('file-error', { message: 'Failed to create file' });
                return;
            }

            const fileData = {
                id: data.id,
                filename: data.filename,
                content: data.content,
                language: data.language,
                isActive: data.is_active
            };

            // Broadcast to all users
            io.to(documentId).emit('file-created', fileData);
            console.log(`📄 File created: ${filename} in ${documentId.substring(0, 8)}...`);
        } catch (err) {
            console.error('Unexpected error creating file:', err);
            socket.emit('file-error', { message: 'Failed to create file' });
        }
    });

    // Update file content
    socket.on('update-file', async ({ documentId, fileId, content }) => {
        try {
            const { error } = await supabase
                .from('workspace_files')
                .update({ content: content })
                .eq('id', fileId);

            if (error) {
                console.error('Error updating file:', error);
                return;
            }

            // Broadcast to other users
            socket.to(documentId).emit('file-updated', {
                fileId: fileId,
                content: content
            });
        } catch (err) {
            console.error('Unexpected error updating file:', err);
        }
    });

    // Delete file
    socket.on('delete-file', async ({ documentId, fileId }) => {
        try {
            const { error } = await supabase
                .from('workspace_files')
                .delete()
                .eq('id', fileId);

            if (error) {
                console.error('Error deleting file:', error);
                socket.emit('file-error', { message: 'Failed to delete file' });
                return;
            }

            // Broadcast to all users
            io.to(documentId).emit('file-deleted', { fileId });
            console.log(`🗑️  File deleted: ${fileId}`);
        } catch (err) {
            console.error('Unexpected error deleting file:', err);
        }
    });

    // Rename file
    socket.on('rename-file', async ({ documentId, fileId, newFilename }) => {
        try {
            const { error } = await supabase
                .from('workspace_files')
                .update({ filename: newFilename })
                .eq('id', fileId);

            if (error) {
                console.error('Error renaming file:', error);
                socket.emit('file-error', { message: 'Failed to rename file' });
                return;
            }

            // Broadcast to all users
            io.to(documentId).emit('file-renamed', {
                fileId: fileId,
                newFilename: newFilename
            });
            console.log(`✏️  File renamed to: ${newFilename}`);
        } catch (err) {
            console.error('Unexpected error renaming file:', err);
        }
    });

    // Switch active file
    socket.on('switch-file', async ({ documentId, fileId }) => {
        const metadata = userMetadata.get(socket.id);
        if (!metadata) return;

        try {
            // Get file data
            const { data, error } = await supabase
                .from('workspace_files')
                .select('*')
                .eq('id', fileId)
                .single();

            if (error) {
                console.error('Error switching file:', error);
                return;
            }

            // Notify other users about the switch
            socket.to(documentId).emit('user-switched-file', {
                username: metadata.username,
                filename: data.filename
            });
        } catch (err) {
            console.error('Unexpected error switching file:', err);
        }
    });

    // ========================================
    // AI GENERATION HANDLERS (Milestone 07)
    // ========================================

    // Generate code with AI
    socket.on('ai-generate', async ({ documentId, code, language, cursorPosition, userPrompt, action }) => {
        const metadata = userMetadata.get(socket.id);
        if (!metadata) {
            socket.emit('ai-error', { message: 'User not authenticated' });
            return;
        }

        if (!aiService) {
            socket.emit('ai-error', { message: 'AI service is not available' });
            return;
        }

        console.log(`🤖 AI generation requested by ${metadata.username}`);

        try {
            // Use streaming generation
            const generator = aiService.generateCodeStream(
                {
                    code,
                    language,
                    cursorPosition,
                    userPrompt,
                    action: action || 'complete'
                },
                socket.id // Use socket ID for rate limiting
            );

            // Stream chunks back to client
            for await (const chunk of generator) {
                socket.emit('ai-chunk', { chunk });
            }

            // Signal completion
            socket.emit('ai-complete');
            console.log(`✅ AI generation completed for ${metadata.username}`);
        } catch (err) {
            console.error('AI generation error:', err);
            socket.emit('ai-error', { message: err.message });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`❌ Disconnected: ${socket.id}`);

        const metadata = userMetadata.get(socket.id);

        // Clean up user tracking
        documentUsers.forEach((users, docId) => {
            if (users.has(socket.id)) {
                users.delete(socket.id);

                const userCount = users.size;
                io.to(docId).emit('user-count-update', userCount);

                // Send updated user list
                const userList = Array.from(users).map(sid => {
                    const meta = userMetadata.get(sid);
                    return meta ? { socketId: sid, username: meta.username, color: meta.color } : null;
                }).filter(Boolean);
                io.to(docId).emit('users-update', userList);

                // Notify that this user's cursor should be removed
                if (metadata) {
                    io.to(docId).emit('cursor-remove', socket.id);
                }

                console.log(`👥 Document ${docId.substring(0, 8)}... now has ${userCount} user(s)`)

                // Clean up empty documents
                if (users.size === 0) {
                    documentUsers.delete(docId);
                    documentCache.delete(docId);
                    console.log(`🗑️  Cleaned up cache for ${docId.substring(0, 8)}...`);
                }
            }
        });

        // Clean up user metadata
        userMetadata.delete(socket.id);
    });

    // Handle leave document
    socket.on('leave-document', (documentId) => {
        console.log(`👋 Socket ${socket.id} leaving document: ${documentId}`);
        socket.leave(documentId);

        if (documentUsers.has(documentId)) {
            documentUsers.get(documentId).delete(socket.id);
            const userCount = documentUsers.get(documentId).size;
            io.to(documentId).emit('user-count-update', userCount);

            // Send updated user list
            const users = Array.from(documentUsers.get(documentId) || []).map(sid => {
                const meta = userMetadata.get(sid);
                return meta ? { socketId: sid, username: meta.username, color: meta.color } : null;
            }).filter(Boolean);
            io.to(documentId).emit('users-update', users);

            // Remove cursor
            io.to(documentId).emit('cursor-remove', socket.id);

            if (userCount === 0) {
                documentUsers.delete(documentId);
                documentCache.delete(documentId);
            }
        }

        // Clean up user metadata
        userMetadata.delete(socket.id);
    });
});

// ========================================
// HEALTH & DEBUG ENDPOINTS
// ========================================

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        activeDocuments: documentUsers.size,
        cachedDocuments: documentCache.size,
        connections: io.engine.clientsCount
    });
});

app.get('/debug/:documentId', (req, res) => {
    const { documentId } = req.params;
    const state = documentCache.get(documentId);
    const users = documentUsers.get(documentId);

    res.json({
        documentId,
        state: state || 'Not cached',
        activeUsers: users ? users.size : 0,
        userIds: users ? Array.from(users) : []
    });
});

const PORT = process.env.SOCKET_PORT || 4000;

server.listen(PORT, () => {
    console.log(`🚀 Socket.io server running on http://localhost:${PORT}`);
    console.log(`📡 Accepting connections from http://localhost:3000`);
    console.log(`✨ Server-side state management enabled`);
    console.log(`🔒 Conflict resolution active - Server is single source of truth`);
});
