const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('Gemini API key is required');
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Rate limiting: userId -> { count, resetTime }
        this.rateLimits = new Map();
        this.MAX_REQUESTS_PER_MINUTE = 10;
    }

    /**
     * Check if user has exceeded rate limit
     */
    checkRateLimit(userId) {
        const now = Date.now();
        const userLimit = this.rateLimits.get(userId);

        if (!userLimit || now > userLimit.resetTime) {
            // Reset or create new limit
            this.rateLimits.set(userId, {
                count: 1,
                resetTime: now + 60000 // 1 minute from now
            });
            return true;
        }

        if (userLimit.count >= this.MAX_REQUESTS_PER_MINUTE) {
            return false;
        }

        userLimit.count++;
        return true;
    }

    /**
     * Build context-aware prompt for code generation
     */
    buildPrompt(data) {
        const {
            code = '',
            language = 'javascript',
            cursorPosition = null,
            userPrompt = '',
            action = 'complete' // 'complete', 'refactor', 'explain', 'debug'
        } = data;

        const lines = code.split('\n');
        const cursorLine = cursorPosition ? cursorPosition.lineNumber : lines.length;
        const beforeCursor = lines.slice(0, cursorLine).join('\n');
        const afterCursor = lines.slice(cursorLine).join('\n');

        let systemPrompt = '';

        switch (action) {
            case 'complete':
                systemPrompt = `You are an expert ${language} programmer. Complete the following code thoughtfully and concisely. Provide ONLY the code that should be added, without explanations, markdown formatting, or code fences. Do not repeat the existing code.`;
                break;
            case 'refactor':
                systemPrompt = `You are an expert code reviewer. Refactor the following ${language} code to improve readability, performance, and best practices. Return ONLY the refactored code without explanations.`;
                break;
            case 'explain':
                systemPrompt = `You are a coding mentor. Explain the following ${language} code clearly and concisely. Focus on what it does and why.`;
                break;
            case 'debug':
                systemPrompt = `You are a debugging expert. Analyze the following ${language} code for bugs and issues. Suggest fixes with brief explanations.`;
                break;
            default:
                systemPrompt = `You are a helpful coding assistant for ${language}.`;
        }

        let prompt = `${systemPrompt}\n\n`;

        if (userPrompt) {
            prompt += `User request: ${userPrompt}\n\n`;
        }

        if (beforeCursor) {
            prompt += `Code before cursor:\n\`\`\`${language}\n${beforeCursor}\n\`\`\`\n\n`;
        }

        if (action === 'complete') {
            prompt += `Continue the code from this point. Provide the next logical lines of code.\n`;
        }

        if (afterCursor && action !== 'complete') {
            prompt += `Code after cursor:\n\`\`\`${language}\n${afterCursor}\n\`\`\`\n`;
        }

        return prompt;
    }

    /**
     * Generate code using streaming
     */
    async *generateCodeStream(data, userId) {
        // Check rate limit
        if (!this.checkRateLimit(userId)) {
            throw new Error('Rate limit exceeded. Please try again in a minute.');
        }

        const prompt = this.buildPrompt(data);

        try {
            const result = await this.model.generateContentStream(prompt);

            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                yield chunkText;
            }
        } catch (error) {
            console.error('AI Generation Error:', error);
            throw new Error(`AI generation failed: ${error.message}`);
        }
    }

    /**
     * Generate code without streaming (for simpler cases)
     */
    async generateCode(data, userId) {
        // Check rate limit
        if (!this.checkRateLimit(userId)) {
            throw new Error('Rate limit exceeded. Please try again in a minute.');
        }

        const prompt = this.buildPrompt(data);

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('AI Generation Error:', error);
            throw new Error(`AI generation failed: ${error.message}`);
        }
    }

    /**
     * Extract code blocks from AI response
     */
    extractCode(response) {
        // Remove markdown code fences if present
        const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
        const matches = [...response.matchAll(codeBlockRegex)];

        if (matches.length > 0) {
            return matches.map(m => m[1].trim()).join('\n\n');
        }

        return response.trim();
    }

    /**
     * Clean up rate limit cache periodically
     */
    cleanupRateLimits() {
        const now = Date.now();
        for (const [userId, limit] of this.rateLimits.entries()) {
            if (now > limit.resetTime) {
                this.rateLimits.delete(userId);
            }
        }
    }
}

// Singleton instance
let aiServiceInstance = null;

function getAIService() {
    if (!aiServiceInstance) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn('⚠️  GEMINI_API_KEY not set. AI features will be disabled.');
            return null;
        }
        aiServiceInstance = new AIService(apiKey);

        // Cleanup rate limits every 5 minutes
        setInterval(() => {
            aiServiceInstance.cleanupRateLimits();
        }, 300000);
    }
    return aiServiceInstance;
}

module.exports = { AIService, getAIService };
