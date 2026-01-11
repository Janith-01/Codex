import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './css/LandingPage.css';

const LandingPage = () => {
    const navigate = useNavigate();
    const [isCreating, setIsCreating] = useState(false);

    const handleCreateNewDocument = async () => {
        setIsCreating(true);
        try {
            // Insert a new document with default empty content
            const { data, error } = await supabase
                .from('documents')
                .insert([{ content: '' }])
                .select()
                .single();

            if (error) {
                console.error('Error creating document:', error);
                alert('Failed to create document. Please check your database configuration.');
                return;
            }

            // Navigate to the new document's editor page
            navigate(`/document/${data.id}`);
        } catch (err) {
            console.error('Unexpected error:', err);
            alert('An unexpected error occurred.');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="landing-container">
            <div className="landing-content">
                <div className="hero-section">
                    <h1 className="hero-title">
                        <span className="gradient-text">Codex Editor</span>
                    </h1>
                    <p className="hero-subtitle">
                        A persistent, cloud-powered code editor built with React and Monaco
                    </p>
                </div>

                <button
                    className="new-doc-button"
                    onClick={handleCreateNewDocument}
                    disabled={isCreating}
                >
                    {isCreating ? (
                        <>
                            <span className="spinner"></span>
                            Creating...
                        </>
                    ) : (
                        <>
                            <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            New Document
                        </>
                    )}
                </button>

                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon">💾</div>
                        <h3>Auto-Save</h3>
                        <p>Your code is automatically saved as you type</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🔒</div>
                        <h3>Persistent</h3>
                        <p>Access your documents anytime, anywhere</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">⚡</div>
                        <h3>Fast</h3>
                        <p>Powered by Monaco Editor and Supabase</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
