/**
 * CIBC Chequing Parser
 * Regex-based parser for CIBC chequing statements
 */
class CIBCChequingParser extends BaseBankParser {
    constructor() {
        const formatRules = `
CIBC CHEQUING FORMAT:
- Column headers: "Date | Description | Withdrawals ($) | Deposits ($) | Balance ($)"
- Date format: Mmm D (e.g., Apr 1, Apr 5)
- Multi-line descriptions common
- "DEBIT MEMO" and "E-TRANSFER" transactions are common
    `;
        super('CIBC', 'Chequing', formatRules);
    }

    /**
     * Parse CIBC Chequing statement using regex
     */
    async parse(statementText, metadata = null, lineMetadata = []) {
        this.lastLineMetadata = lineMetadata;

        const lines = statementText.split('\n');
        const transactions = [];

        // LOUD DIAGNOSTIC

        // EXTRACT METADATA (Institution, Transit, Account)
        // CIBC format: Account number 10-57618, Branch transit number 04729
        const transitMatch = statementText.match(/Branch transit number\s*(\d{5})/i);
        const acctMatch = statementText.match(/Account number\s*([\d-]{5,})/i);

        const parsedMetadata = {
            _inst: '010', // CIBC Institution Code
            _transit: transitMatch ? transitMatch[1] : '-----',
            _acct: acctMatch ? acctMatch[1].replace(/[-\s]/g, '') : '-----',
            institutionCode: '010',
            transit: transitMatch ? transitMatch[1] : '-----',
            accountNumber: acctMatch ? acctMatch[1].replace(/[-\s]/g, '') : '-----',
            _brand: 'CIBC',
            _bank: 'CIBC',
            _tag: 'Chequing'
        };

        // Extract year from statement
        const yearMatch = statementText.match(/20\d{2}/);
        this.currentYear = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

        let currentDate = null;
        let pendingDescription = '';
        let pendingRawLines = [];
        let pendingAuditData = [];
        let lastMonth = null;

        // Date regex: "Apr 1", "May 15", etc.
        const dateRegex = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i;


        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.length < 5) continue;

            // Check if line starts with a date
            const dateMatch = trimmed.match(dateRegex);
            if (dateMatch) {
                const monthName = dateMatch[1];
                const day = dateMatch[2];

                // Year rollover detection
                const monthIndex = this.getMonthIndex(monthName);
                if (lastMonth !== null && monthIndex < lastMonth && monthIndex <= 1) {
                    this.currentYear++;
                }
                lastMonth = monthIndex;

                currentDate = this.formatDate(day, monthName, this.currentYear);

                // Remove date from line
                const lineAfterDate = trimmed.substring(dateMatch[0].length).trim();

                // Try to extract transaction
                const extracted = this.extractTransaction(lineAfterDate, currentDate, trimmed);
                if (extracted) {
                    extracted.audit = this.getSpatialMetadata(trimmed);
                    transactions.push(extracted);
                } else if (lineAfterDate) {
                    pendingDescription = lineAfterDate;
                    pendingRawLines = [trimmed];
                    pendingAuditData = [this.getSpatialMetadata(trimmed)];
                }
            } else if (currentDate) {
                // No date - continuation or new transaction for same date
                const extracted = this.extractTransaction(trimmed, currentDate, trimmed);
                if (extracted) {
                    // Merge pending description if exists
                    if (pendingDescription) {
                        extracted.description = pendingDescription + ' ' + extracted.description;
                        // CRITICAL: Re-clean concatenated description
                        extracted.description = this.cleanCIBCDescription(extracted.description);

                        extracted.rawText = [...pendingRawLines, trimmed].join('\n');
                        const allAudit = [...pendingAuditData, this.getSpatialMetadata(trimmed)];
                        extracted.audit = this.mergeAuditMetadata(allAudit);

                        pendingDescription = '';
                        pendingRawLines = [];
                        pendingAuditData = [];
                    }
                    transactions.push(extracted);
                } else {
                    // Accumulate multi-line description
                    if (pendingDescription) {
                        pendingDescription += ' ' + trimmed;
                        pendingRawLines.push(trimmed);
                        pendingAuditData.push(this.getSpatialMetadata(trimmed));
                    } else {
                        pendingDescription = trimmed;
                        pendingRawLines = [trimmed];
                        pendingAuditData = [this.getSpatialMetadata(trimmed)];
                    }
                }
            }
        }

        return { transactions, metadata: parsedMetadata };
    }

    /**
     * Extract transaction from line with amounts
     */
    extractTransaction(text, dateStr, originalLine = '') {
        if (!text) return null;

        // Pattern: Description | Withdrawals | Deposits | Balance
        const amountRegex = /([\d,]+\.\d{2})/g;
        const amounts = [];
        let match;

        while ((match = amountRegex.exec(text)) !== null) {
            amounts.push(parseFloat(match[1].replace(/,/g, '')));
        }

        if (amounts.length === 0) return null;

        // Extract description (everything before first amount)
        const firstAmountIndex = text.search(amountRegex);
        let description = text.substring(0, firstAmountIndex).trim();

        // Clean the description
        description = this.cleanCIBCDescription(description);

        // Determine amounts based on count
        let debit = 0, credit = 0, balance = 0;

        if (amounts.length >= 3) {
            // Format: Withdrawal | Deposit | Balance
            debit = amounts[0];
            credit = amounts[1];
            balance = amounts[2];
        } else if (amounts.length === 2) {
            // Format: Single amount | Balance
            const amt = amounts[0];
            balance = amounts[1];

            // Heuristic: If balance increased, it's a credit
            if (balance > amt) {
                credit = amt;
            } else {
                debit = amt;
            }
        } else {
            // Single amount - assume it's the balance
            balance = amounts[0];
        }

        // Build audit data for source document viewing
        const auditData = this.buildAuditData(originalLine || text, 'CIBCChequingParser', { statementId: this._getStmtId(text), lineNumber: ++this._txSeq });

        return {
            date: dateStr,
            description: description,
            amount: debit || credit,
            debit: debit,
            credit: credit,
            balance: balance,
            _inst: '010',
            _brand: 'CIBC',
            _bank: 'CIBC',
            _tag: 'Chequing',
            parser_ref: this._getStmtId(text) + '-' + String(this._txSeq).padStart(3, '0'),
            pdfLocation: auditData.pdfLocation,
            audit: auditData.audit,
            rawText: this.cleanRawText(originalLine || text)
        };
    }

    /**
     * Clean CIBC description with prefix matching
     */
    cleanCIBCDescription(desc) {
        // 1. Normalize whitespace
        desc = desc.replace(/\s+/g, ' ').trim();

        // 2. Remove CIBC-specific noise
        desc = desc.replace(/\b\d{6,}\b/gi, '');    // Long tracking numbers
        desc = desc.replace(/[a-f0-9]{16,}/gi, ''); // Hex codes
        desc = desc.replace(/ABM #\d+/gi, '');      // ABM numbers

        // 3. CIBC-specific transaction type prefixes
        const typePrefixes = [
            "BILL PAYMENT",
            "E-TRANSFER",
            "INTERAC E-TRANSFER",
            "DIRECT DEPOSIT",
            "ABM WITHDRAWAL",
            "DEBIT PURCHASE",
            "PURCHASE",
            "MONTHLY FEE",
            "SERVICE CHARGE",
            "NSF FEE",
            "OVERDRAFT FEE",
            "DEBIT MEMO",
            "CREDIT MEMO",
            "TRANSFER"
        ];

        // 4. Prefix matching with simple string comparison
        const descUpper = desc.toUpperCase();

        for (const type of typePrefixes) {
            const searchStr = type + ' ';
            if (descUpper.startsWith(searchStr)) {
                // Extract name after prefix
                const name = desc.substring(type.length).trim();
                if (name) {
                    // Format as "Name, Type" for 2-line display
                    const formattedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
                    desc = `${name}, ${formattedType}`;
                }
                break;
            }
        }

        // 5. Fallback: Split on dash if exists
        if (!desc.includes(',') && desc.includes(' - ')) {
            const parts = desc.split(' - ');
            if (parts.length === 2) {
                desc = `${parts[1].trim()}, ${parts[0].trim()}`;
            }
        }

        // 6. Final cleanup
        desc = desc.replace(/,\s*,/g, ',').trim();
        desc = desc.replace(/^[,\s]+|[,\s]+$/g, '');
        desc = desc.replace(/\s+/g, ' ');

        return desc;
    }

    /**
     * Format date as YYYY-MM-DD
     */
    formatDate(day, monthName, year) {
        const monthIndex = this.getMonthIndex(monthName);
        const month = String(monthIndex + 1).padStart(2, '0');
        const dayPadded = String(day).padStart(2, '0');
        return `${year}-${month}-${dayPadded}`;
    }

    /**
     * Get month index from month name
     */
    getMonthIndex(monthName) {
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        return months.indexOf(monthName.toLowerCase().substring(0, 3));
    }
    // ── Audit identity helpers (Amex parity) ─────────────────────────────────
    _getStmtId(text) {
        if (this._cachedStmtId) return this._cachedStmtId;
        let year = new Date().getFullYear().toString();
        let month = 'UNK';
        const ym = (text || '').match(/20\d{2}/);
        if (ym) year = ym[0];
        const mm = (text || '').match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i);
        if (mm) month = mm[1].substring(0, 3).toUpperCase();
        this._cachedStmtId = 'CIBCCHQ-' + year + month;
        this._txSeq = 0; // Reset sequence for new statement
        return this._cachedStmtId;
    }
    _resetAuditState() { this._cachedStmtId = null; this._txSeq = 0; }

}

// Expose to window for file:// compatibility
window.CIBCChequingParser = CIBCChequingParser;
window.cibcChequingParser = new CIBCChequingParser();
