export function createDelta(change) {
    return {
        range: {
            startLineNumber: change.range.startLineNumber,
            startColumn: change.range.startColumn,
            endLineNumber: change.range.endLineNumber,
            endColumn: change.range.endColumn
        },
        text: change.text,
        rangeLength: change.rangeLength,
        rangeOffset: change.rangeOffset,
        timestamp: Date.now()
    };
}

/**
 * Apply a delta to content
 * @param {string} content - Current content
 * @param {Object} delta - Delta to apply
 * @returns {string} Updated content
 */
export function applyDelta(content, delta) {
    const lines = content.split('\n');
    const { range, text } = delta;

    // Get the start and end positions
    const startLine = range.startLineNumber - 1;
    const startCol = range.startColumn - 1;
    const endLine = range.endLineNumber - 1;
    const endCol = range.endColumn - 1;

    // Handle single-line change
    if (startLine === endLine) {
        const line = lines[startLine] || '';
        lines[startLine] =
            line.substring(0, startCol) +
            text +
            line.substring(endCol);

        return lines.join('\n');
    }

    // Handle multi-line change
    const startLineBefore = (lines[startLine] || '').substring(0, startCol);
    const endLineAfter = (lines[endLine] || '').substring(endCol);
    const newLines = text.split('\n');

    // Replace the range with new lines
    const beforeLines = lines.slice(0, startLine);
    const afterLines = lines.slice(endLine + 1);

    newLines[0] = startLineBefore + newLines[0];
    newLines[newLines.length - 1] += endLineAfter;

    return [...beforeLines, ...newLines, ...afterLines].join('\n');
}

/**
 * Create a batch of deltas from Monaco onChange event
 * @param {Array} changes - Monaco content changes
 * @returns {Array} Array of delta objects
 */
export function createDeltaBatch(changes) {
    return changes.map(createDelta);
}

/**
 * Apply multiple deltas in sequence
 * @param {string} content - Starting content
 * @param {Array} deltas - Array of deltas to apply
 * @returns {string} Final content after all deltas applied
 */
export function applyDeltaBatch(content, deltas) {
    return deltas.reduce((currentContent, delta) => {
        try {
            return applyDelta(currentContent, delta);
        } catch (err) {
            console.error('Error applying delta:', err, delta);
            return currentContent;
        }
    }, content);
}

/**
 * Calculate delta size for performance monitoring
 * @param {Object|Array} delta - Single delta or array of deltas
 * @returns {number} Size in bytes
 */
export function getDeltaSize(delta) {
    return new Blob([JSON.stringify(delta)]).size;
}

/**
 * Compress deltas for transmission (basic)
 * @param {Array} deltas - Array of deltas
 * @returns {Object} Compressed delta object
 */
export function compressDeltas(deltas) {
    if (deltas.length === 0) return null;
    if (deltas.length === 1) return deltas[0];

    // For multiple deltas, send them as a batch
    return {
        type: 'batch',
        deltas: deltas,
        count: deltas.length
    };
}

/**
 * Decompress delta batch
 * @param {Object} compressed - Compressed delta
 * @returns {Array} Array of individual deltas
 */
export function decompressDeltas(compressed) {
    if (!compressed) return [];
    if (compressed.type === 'batch') return compressed.deltas;
    return [compressed];
}

/**
 * Throttle function for limiting event frequency
 * @param {Function} func - Function to throttle
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Throttled function
 */
export function throttle(func, wait) {
    let timeout = null;
    let lastArgs = null;
    let lastThis = null;

    const later = () => {
        timeout = null;
        if (lastArgs) {
            func.apply(lastThis, lastArgs);
            lastArgs = lastThis = null;
            timeout = setTimeout(later, wait);
        }
    };

    return function (...args) {
        lastArgs = args;
        lastThis = this;

        if (!timeout) {
            func.apply(this, args);
            timeout = setTimeout(later, wait);
        }
    };
}

/**
 * Debounce function for delaying execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Validate delta structure
 * @param {Object} delta - Delta to validate
 * @returns {boolean} True if valid
 */
export function isValidDelta(delta) {
    return (
        delta &&
        delta.range &&
        typeof delta.range.startLineNumber === 'number' &&
        typeof delta.range.startColumn === 'number' &&
        typeof delta.range.endLineNumber === 'number' &&
        typeof delta.range.endColumn === 'number' &&
        typeof delta.text === 'string'
    );
}

/**
 * Performance metrics tracker
 */
export class DeltaMetrics {
    constructor() {
        this.deltasSent = 0;
        this.deltasReceived = 0;
        this.bytesSent = 0;
        this.bytesReceived = 0;
        this.errors = 0;
        this.startTime = Date.now();
    }

    recordSent(delta) {
        this.deltasSent++;
        this.bytesSent += getDeltaSize(delta);
    }

    recordReceived(delta) {
        this.deltasReceived++;
        this.bytesReceived += getDeltaSize(delta);
    }

    recordError() {
        this.errors++;
    }

    getStats() {
        const elapsed = (Date.now() - this.startTime) / 1000;
        return {
            deltasSent: this.deltasSent,
            deltasReceived: this.deltasReceived,
            bytesSent: this.bytesSent,
            bytesReceived: this.bytesReceived,
            errors: this.errors,
            uptime: elapsed,
            avgSendRate: (this.deltasSent / elapsed).toFixed(2),
            avgReceiveRate: (this.deltasReceived / elapsed).toFixed(2)
        };
    }

    reset() {
        this.deltasSent = 0;
        this.deltasReceived = 0;
        this.bytesSent = 0;
        this.bytesReceived = 0;
        this.errors = 0;
        this.startTime = Date.now();
    }
}

export default {
    createDelta,
    applyDelta,
    createDeltaBatch,
    applyDeltaBatch,
    getDeltaSize,
    compressDeltas,
    decompressDeltas,
    throttle,
    debounce,
    isValidDelta,
    DeltaMetrics
};
