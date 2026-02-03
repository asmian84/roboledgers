/**
 * Base Bank Parser
 * Template for brand-specific parsers
 */
class BaseBankParser {
    constructor(bankName, accountType, formatRules) {
        this.bankName = bankName;
        this.accountType = accountType;
        this.formatRules = formatRules;
    }

    /**
     * Abstract method for Regex parsing - to be implemented by child classes
     * [PHASE 4] Now accepts lineMetadata for spatial tracking
     * @param {string} text 
     * @param {Object} metadata
     * @param {Array} lineMetadata
     * @returns {Object|null} { transactions: [] } or null if not implemented/failed
     */
    parseWithRegex(text, metadata = null, lineMetadata = []) {
        return null; // Default implementation returns null to trigger AI fallback
    }

    /**
     * [PHASE 4] Helper to find spatial metadata (Page/Y) for a line
     */
    getSpatialMetadata(lineText) {
        if (!this.lastLineMetadata) return null;
        return this.findAuditMetadata(lineText, this.lastLineMetadata);
    }

    /**
     * Merge multiple audit objects into a single bounding box
     */
    mergeAuditMetadata(auditLines) {
        if (!auditLines || auditLines.length === 0) return null;

        // Filter out nulls
        const valid = auditLines.filter(a => a && a.y !== undefined);
        if (valid.length === 0) return null;

        const page = valid[0].page;

        // PDF Coordinates: 0,0 is Bottom-Left. Y increases UP.
        // We want the absolute MIN Y and the absolute MAX Y (Y + Height).
        let minY = Infinity;
        let maxY = -Infinity;

        valid.forEach(a => {
            minY = Math.min(minY, a.y);
            maxY = Math.max(maxY, a.y + (a.height || 12));
        });

        return {
            page: page,
            y: minY,
            height: maxY - minY,
            lineCount: valid.length
        };
    }

    /**
     * Find audit metadata for a specific line of text
     */
    findAuditMetadata(targetText, lineMetadata) {
        if (!lineMetadata || lineMetadata.length === 0 || !targetText) return null;

        const cleanTarget = targetText.toLowerCase().replace(/\s+/g, ' ').trim();

        // 1. Exact/Substring Match
        for (const line of lineMetadata) {
            const cleanLine = line.text ? line.text.toLowerCase().replace(/\s+/g, ' ').trim() : '';
            if (cleanLine.includes(cleanTarget)) {
                return {
                    page: line.page,
                    y: line.y,
                    height: line.height,
                    raw: line.text
                };
            }
        }

        // 2. Partial Match
        if (cleanTarget.length > 10) {
            const partial = cleanTarget.substring(0, 15);
            for (const line of lineMetadata) {
                const cleanLine = line.text ? line.text.toLowerCase().replace(/\s+/g, ' ').trim() : '';
                if (cleanLine.includes(partial)) {
                    return {
                        page: line.page,
                        y: line.y,
                        height: line.height,
                        raw: line.text
                    };
                }
            }
        }

        return null;
    }

    /**
     * Parse statement text using Hybrid Strategy (Regex First -> AI Fallback)
     * @param {string} statementText 
     * @param {Object} metadata
     * @param {Array} lineMetadata - [PHASE 4] Spatial info
     * @returns {Promise<Object>}
     */
    async parse(statementText, metadata = null, lineMetadata = []) {
        // [PHASE 4] Store metadata for use in description cleaning or audit attachment
        this.lastLineMetadata = lineMetadata;

        // 1. Try Local Regex Parsing First (Free, Private, Fast)
        try {
            console.log(`⚡ BaseBankParser: Attempting local REGEX parsing for ${this.bankName}...`);
            const regexResult = this.parseWithRegex(statementText, metadata, lineMetadata);

            if (regexResult && regexResult.transactions && regexResult.transactions.length > 0) {
                console.log(`✅ Regex parsing successful: ${regexResult.transactions.length} transactions found.`);
                return regexResult; // Return immediately, skipping AI
            }

            console.log('⚠️ Regex parsing found 0 transactions.');

            // STRICT LOCAL MODE: As requested, do NOT fall back to AI for parsing.
            // We return an empty list so the user sees "0 transactions" instead of an API error.
            return {
                bank: this.bankName,
                accountType: this.accountType,
                accountHolder: 'Unknown',
                institutionCode: '---',
                transit: '-----',
                accountNumber: '-----',
                transactions: []
            };

        } catch (e) {
            // console.warn('⚠️ Regex parsing error:', e);
            return {
                bank: this.bankName,
                accountType: this.accountType,
                accountHolder: 'Unknown',
                institutionCode: '---',
                transit: '-----',
                accountNumber: '-----',
                transactions: []
            };
        }

        // 2. Fallback to Gemini AI (DISABLED)
        /*
        const prompt = this.buildPrompt(statementText);
        const apiKey = window.VITE_GEMINI_API_KEY;

        if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
            throw new Error('VITE_GEMINI_API_KEY not found or not set');
        }

        try {
            // console.log(`🤖 BaseBankParser: Sending request to Gemini for ${this.bankName} ${this.accountType}...`);

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        responseMimeType: 'application/json',
                        maxOutputTokens: 8192
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `API error: ${response.status}`);
            }

            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;

            // Parse JSON response
            const parsed = JSON.parse(text);

            // Post-process descriptions with regex cleaning
            parsed.transactions = parsed.transactions.map(tx => ({
                ...tx,
                description: this.cleanDescription(tx.description)
            }));

            // Validate and return
            this.validateOutput(parsed);
            return parsed;

        } catch (error) {
            console.error(`${this.bankName} parser failed:`, error);
            throw error;
        }
        */
    }

    buildPrompt(statementText) {
        return `You are parsing a ${this.bankName} ${this.accountType} statement SPECIFICALLY.
            
BANK-SPECIFIC FORMAT:
${this.formatRules}

SPATIAL LAYOUT INSTRUCTIONS:
- The text below preserves relative spacing. 
- Use 2 or more spaces as a strong indicator of a column boundary.
- If a line has no date and no amount, but is indented near a description, it is a continuation of that description.

CRITICAL RULES:
1. Parse ONLY: date, description, debit, credit
2. DO NOT parse balance (we calculate it)
3. Debit = money OUT (${this.accountType === 'Chequing' ? 'withdrawals, fees, transfers sent' : 'charges, purchases'})
4. Credit = money IN (${this.accountType === 'Chequing' ? 'deposits, transfers received, cheque deposits' : 'payments, refunds'})
5. BOTH amounts must be POSITIVE numbers in the JSON.
6. NEVER put values in BOTH debit AND credit for the same transaction.
7. CRITICAL: Words like "DEPOSIT", "CREDIT", "REFUND", "PAYMENT RECEIVED", "INTERAC e-Transfer - Received" MUST ALWAYS be in the \`credit\` field.
8. EXCLUDE header/footer text like "Opening Balance", "Balance Forward", "Page X of Y".

DESCRIPTION CLEANING (CRITICAL):
This is the MOST IMPORTANT rule. Clean ALL junk from descriptions:
1. **Remove ALL leading dates** (e.g., "01 Oct", "JAN 15", "14/02").
2. **Remove reference codes** (e.g., "70599 04513 20", "59351291").
3. **Remove merchant IDs** (e.g., "SQ *", "TST*").
4. **Remove trailing codes** (e.g., "- S", "- 8").
5. **Combine multi-line descriptions** into a single readable string.

Return ONLY valid JSON:
{
  "accountHolder": "name",
  "accountNumber": "last 4",
  "statementPeriod": "range",
  "openingBalance": number,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "CLEAN merchant name",
      "debit": number or null,
      "credit": number or null
    }
  ]
}

STATEMENT TEXT:
${statementText}`;
    }

    /**
     * Clean description using regex (fallback/enhancement to AI)
     */
    cleanDescription(description) {
        if (!description) return '';

        let cleaned = description.trim();

        // 1. Remove leading date patterns (various formats)
        // MMDD or DDMM numeric
        cleaned = cleaned.replace(/^\d{1,2}[\/\-]\d{1,2}\s+/g, '');
        // "01 Oct", "14 Feb", "23 Apr"
        cleaned = cleaned.replace(/^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+/i, '');
        // "Oct 01", "Feb 14"
        cleaned = cleaned.replace(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+/i, '');
        // "Wed, Jan. 31,"
        cleaned = cleaned.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s*/i, '');

        // 2. Remove common merchant ID prefixes/noise
        cleaned = cleaned.replace(/^(SQ\s*\*|TST\s*\*|PY\s*\*|INC\s*\*)/i, '');

        // 3. Remove reference numbers and long digit strings (6+ digits)
        cleaned = cleaned.replace(/\b\d{6,}\b/g, '');

        // 4. Remove trailing single character codes or small numbers
        cleaned = cleaned.replace(/\s+-\s+[A-Z0-9]$/i, '');
        cleaned = cleaned.replace(/\s+[A-Z\d]{1,2}$/, '');

        // 5. Cleanup whitespace
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        return cleaned;
    }

    validateOutput(parsed) {
        if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
            throw new Error('Invalid AI response: missing transactions array');
        }

        parsed.transactions.forEach((tx, idx) => {
            if (!tx.date || !tx.description) {
                console.warn(`Transaction ${idx} is incomplete:`, tx);
            }
        });
    }

    /**
     * Standardize Raw Text by removing the trailing balance if present.
     * User wants the transaction amount, but NOT the running balance.
     */
    cleanRawText(line) {
        if (!line) return '';
        let cleaned = line.trim();

        // Regex to match currency amounts: $? 1,234.56 or 1234.56
        // We look for patterns like: [Amount] [Balance]
        const amountRegex = /(\$?\s?-?\d[\d,]*\.\d{2})/g;
        const matches = cleaned.match(amountRegex);

        if (matches && matches.length >= 2) {
            // Find the last amount (likely the balance)
            const lastAmount = matches[matches.length - 1];

            // Safety check: The balance usually comes after the transaction amount.
            // We find the LAST occurrence of the last amount and strip it.
            const lastIndex = cleaned.lastIndexOf(lastAmount);

            // Verify there's enough space/delimiters between amounts to be reasonably sure it's a balance column
            if (lastIndex > 0) {
                const before = cleaned.substring(0, lastIndex).trim();
                return before;
            }
        }

        return cleaned;
    }
}

// Expose to window for file:// compatibility
window.BaseBankParser = BaseBankParser;
