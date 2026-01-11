import React, { useState, useEffect } from 'react';
import './css/AIAssistant.css';

const AIAssistant = ({ socket, documentId, code, language, cursorPosition, onAccept, onClose }) => {
    const [generatedCode, setGeneratedCode] = useState('');
    const [isGenerating, setIsGenerating] = useState(true);
    const [error, setError] = useState(null);
    const [prompt, setPrompt] = useState('');
    const [action, setAction] = useState('complete');

    useEffect(() => {
        if (!socket) return;

        // Listen for AI chunks
        socket.on('ai-chunk', ({ chunk }) => {
            setGeneratedCode((prev) => prev + chunk);
        });

        // Listen for AI completion
        socket.on('ai-complete', () => {
            setIsGenerating(false);
        });

        // Listen for AI errors
        socket.on('ai-error', ({ message }) => {
            setError(message);
            setIsGenerating(false);
        });

        return () => {
            socket.off('ai-chunk');
            socket.off('ai-complete');
            socket.off('ai-error');
        };
    }, [socket]);

    const handleGenerate = () => {
        setGeneratedCode('');
        setIsGenerating(true);
        setError(null);

        socket.emit('ai-generate', {
            documentId,
            code,
            language,
            cursorPosition,
            userPrompt: prompt,
            action
        });
    };

    const handleAccept = () => {
        onAccept(generatedCode);
        onClose();
    };

    return (
        <div className="ai-assistant-overlay">
            <div className="ai-assistant-panel">
                <div className="ai-header">
                    <div className="ai-title">
                        <span className="ai-icon">🤖</span>
                        <span>AI Assistant</span>
                        {isGenerating && <div className="ai-loading-spinner"></div>}
                    </div>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                <div className="ai-controls">
                    <select
                        className="action-select"
                        value={action}
                        onChange={(e) => setAction(e.target.value)}
                        disabled={isGenerating}
                    >
                        <option value="complete">Complete Code</option>
                        <option value="refactor">Refactor</option>
                        <option value="explain">Explain</option>
                        <option value="debug">Debug</option>
                    </select>

                    <input
                        type="text"
                        className="prompt-input"
                        placeholder="Optional: Describe what you want..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={isGenerating}
                    />

                    {!isGenerating && !generatedCode && !error && (
                        <button className="generate-button" onClick={handleGenerate}>
                            Generate
                        </button>
                    )}
                </div>

                <div className="ai-content">
                    {error ? (
                        <div className="ai-error">
                            <span className="error-icon">⚠️</span>
                            <p>{error}</p>
                            <button className="retry-button" onClick={handleGenerate}>
                                Try Again
                            </button>
                        </div>
                    ) : generatedCode ? (
                        <div className="ai-result">
                            <div className="result-header">
                                <span className="result-label">Generated Code:</span>
                                <span className="result-info">
                                    {generatedCode.split('\n').length} lines
                                </span>
                            </div>
                            <pre className="code-preview">
                                <code>{generatedCode}</code>
                            </pre>
                        </div>
                    ) : isGenerating ? (
                        <div className="ai-loading">
                            <div className="loading-animation">
                                <div className="loading-dot"></div>
                                <div className="loading-dot"></div>
                                <div className="loading-dot"></div>
                            </div>
                            <p>Generating code...</p>
                            {generatedCode && (
                                <pre className="code-preview streaming">
                                    <code>{generatedCode}<span className="cursor-blink">|</span></code>
                                </pre>
                            )}
                        </div>
                    ) : (
                        <div className="ai-empty">
                            <span className="empty-icon">✨</span>
                            <p>Press Generate to get AI suggestions</p>
                        </div>
                    )}
                </div>

                {generatedCode && !isGenerating && !error && (
                    <div className="ai-actions">
                        <button className="accept-button" onClick={handleAccept}>
                            ✓ Accept
                        </button>
                        <button className="reject-button" onClick={onClose}>
                            ✗ Reject
                        </button>
                        <button className="regenerate-button" onClick={handleGenerate}>
                            🔄 Regenerate
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIAssistant;
