import React, { useState } from 'react';
import './css/CodeRunner.css';

const CodeRunner = ({ code, language }) => {
    const [output, setOutput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState(null);

    const runJavaScript = () => {
        setIsRunning(true);
        setError(null);
        setOutput('');

        try {
            // Create a sandboxed environment
            const logs = [];

            // Override console methods to capture output
            const customConsole = {
                log: (...args) => logs.push(args.map(arg =>
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' ')),
                error: (...args) => logs.push('ERROR: ' + args.join(' ')),
                warn: (...args) => logs.push('WARNING: ' + args.join(' ')),
                info: (...args) => logs.push('INFO: ' + args.join(' '))
            };

            // Execute code with custom console
            const wrappedCode = `
        (function() {
          const console = ${JSON.stringify(customConsole)};
          ${code}
        })();
      `;

            // Use Function constructor instead of eval for slightly better safety
            const func = new Function('console', code);
            func(customConsole);

            setOutput(logs.length > 0 ? logs.join('\n') : '✓ Code executed successfully (no output)');
        } catch (err) {
            setError(err.message);
            setOutput(`Error: ${err.message}\n${err.stack}`);
        } finally {
            setIsRunning(false);
        }
    };

    const runWithPiston = async () => {
        setIsRunning(true);
        setError(null);
        setOutput('Running code...\n');

        try {
            const response = await fetch('https://emkc.org/api/v2/piston/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    language: language || 'javascript',
                    version: '*',
                    files: [
                        {
                            name: 'main.' + (language === 'python' ? 'py' : 'js'),
                            content: code
                        }
                    ]
                })
            });

            const result = await response.json();

            if (result.run) {
                let output = '';
                if (result.run.stdout) output += result.run.stdout;
                if (result.run.stderr) output += '\n' + result.run.stderr;
                if (result.run.output) output += '\n' + result.run.output;

                setOutput(output || '✓ Code executed successfully (no output)');
            } else {
                setError('Execution failed');
                setOutput('Failed to execute code');
            }
        } catch (err) {
            setError(err.message);
            setOutput(`Network Error: ${err.message}\nUsing local execution instead...`);

            // Fallback to local execution for JavaScript
            if (language === 'javascript' || !language) {
                setTimeout(runJavaScript, 1000);
            }
        } finally {
            setIsRunning(false);
        }
    };

    const handleRun = () => {
        // Use Piston API for better language support, fallback to local for JS
        if (language === 'javascript' || !language) {
            runJavaScript();
        } else {
            runWithPiston();
        }
    };

    const clearOutput = () => {
        setOutput('');
        setError(null);
    };

    return (
        <div className="code-runner">
            <div className="runner-header">
                <div className="runner-title">
                    <span className="runner-icon">▶️</span>
                    <span>Output</span>
                </div>
                <div className="runner-actions">
                    <button
                        className="run-button"
                        onClick={handleRun}
                        disabled={isRunning || !code.trim()}
                    >
                        {isRunning ? (
                            <>
                                <span className="spinner-small"></span>
                                Running...
                            </>
                        ) : (
                            <>
                                <span>▶</span>
                                Run Code
                            </>
                        )}
                    </button>
                    <button
                        className="clear-button"
                        onClick={clearOutput}
                        disabled={!output}
                    >
                        🗑️ Clear
                    </button>
                </div>
            </div>

            <div className={`runner-output ${error ? 'error' : ''}`}>
                {output ? (
                    <pre>{output}</pre>
                ) : (
                    <div className="output-placeholder">
                        <p>👆 Click "Run Code" to execute your {language || 'JavaScript'}</p>
                        <small>Supports: JavaScript (local), Python, C++, Java (via Piston API)</small>
                    </div>
                )}
            </div>

            {error && (
                <div className="runner-error">
                    ⚠️ {error}
                </div>
            )}
        </div>
    );
};

export default CodeRunner;
