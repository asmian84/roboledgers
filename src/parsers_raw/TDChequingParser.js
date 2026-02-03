/**
 * TD Chequing Parser
 * Regex-based parser for TD Bank Chequing statements
 */
class TDChequingParser extends BaseBankParser {
    constructor() {
        const formatRules = `
TD CHEQUING FORMAT:
- Date: MMM DD (often concatenated like "AUG02")
- Columns: DESCRIPTION | CHEQUE/DEBIT | DEPOSIT/CREDIT | DATE | BALANCE

SMART PARSING RULES:
1. Date location: Often inside the description block or in its own tight column.
2. Polarity: "OD" suffix on balance indicates overdraft.
3. Cleanup: Remove "CHQ#XXXXX-XXXXXXXXXX" and "MSP" codes from descriptions.
4. Merchant Focus: Keep ONLY the merchant name (e.g., "BIG BUCKET CAR").
    `;
        super('TD', 'Chequing', formatRules);
    }

    /**
     * Parse TD Chequing statement using regex
     */
    async parse(statementText, metadata = null, lineMetadata = []) {
        console.log('⚡ TD Chequing: Starting regex-based parsing...');
        console.log('[TD-DEBUG] First 500 chars of text:', statementText.substring(0, 500));

        // [PHASE 4] Store metadata for audit
        this.lastLineMetadata = lineMetadata;
        const pageCounts = {};

        const lines = statementText.split('\n');
        const transactions = [];

        // LOUD DIAGNOSTIC
        console.warn('⚡ [EXTREME-TD] Starting metadata extraction for TD...');
        console.error('📄 [DEBUG-TD] First 1000 characters (RED for visibility):');
        console.log(statementText.substring(0, 1000));

        // EXTRACT METADATA (Institution, Transit, Account)
        // TD format: Branch No. 9083, Account No. 0928-5217856
        const transitMatch = statementText.match(/(?:Branch No\.|Transit)[:#]?\s*(\d{4,5})/i);
        const acctMatch = statementText.match(/(?:Account No\.|Account)[:#]?\s*([\d-]{7,})/i);

        const metaObj = {
            _inst: '004', // TD Institution Code
            _transit: transitMatch ? transitMatch[1] : '-----',
            _acct: acctMatch ? acctMatch[1].replace(/[-\s]/g, '') : '-----',
            institutionCode: '004',
            transit: transitMatch ? transitMatch[1] : '-----',
            accountNumber: acctMatch ? acctMatch[1].replace(/[-\s]/g, '') : '-----',
            _brand: 'TD',
            _bank: 'TD',
            _tag: 'Chequing'
        };
        console.warn('🏁 [TD] Extraction Phase Complete. Transit:', metaObj.transit, 'Acct:', metaObj.accountNumber);

        // Extract year from statement (usually at top)
        const yearMatch = statementText.match(/20\d{2}/);
        this.currentYear = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
        console.log(`[TD] Extracted year: ${this.currentYear}`);

        let currentDate = null;
        let pendingDescription = '';
        let pendingRawLines = [];
        let pendingAuditData = [];
        let pendingLineCount = 0; // Track lines for multi-line transactions
        let lastMonth = null;

        // Date regex: "JAN 15", "FEB02" (flexible spacing, no start anchor)
        const dateRegex = /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*(\d{1,2})/i;

        console.log(`[TD] Starting parse with ${lines.length} lines, year: ${this.currentYear}`);

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.length < 5) continue;

            // FILTER: Skip Aggregates, Headers, and Garbage
            if (trimmed.match(/AVER\.\s*CR\.\s*BAL|MIN\.\s*BAL|Statement\s*of\s*Account|Account\s*Type|Total\s*Credits|Total\s*Debits/i)) continue;
            if (trimmed.match(/DAILY\s*CHQ\s*BAL|SERVICE\s*CHARGES|INTEREST\s*PAID|OVERDRAFT\s*INTEREST/i)) continue;
            if (trimmed.match(/CAD\s*EVERY\s*DAY|CAD\s*BASIC|BUSINESS\s*CHEQUING/i)) continue;
            if (trimmed.match(/Description\s*Cheque|Date\s*Balance/i)) continue; // Table headers
            if (trimmed.match(/^(Debits|Credits)\s+\d/i)) continue; // Counts like "Debits 5"

            console.log('[TD-DEBUG] Line:', trimmed);

            // Find valid audit metadata for this line
            const currentAudit = this.findAuditMetadata(trimmed, this.lastLineMetadata);

            // Find date anywhere in the line
            const dateMatch = trimmed.match(dateRegex);

            if (dateMatch) {
                // If we found a date
                const monthName = dateMatch[1];
                const day = dateMatch[2];
                const matchIndex = dateMatch.index;

                // Determine Format: Personal (Date First) vs Business (Date Middle/Fourth Column)
                const isDateFirst = matchIndex === 0;

                // Year rollover detection
                const monthIndex = this.getMonthIndex(monthName);
                if (lastMonth !== null && monthIndex < lastMonth && monthIndex <= 1) {
                    this.currentYear++;
                    console.log(`[TD] Year rollover detected: ${this.currentYear}`);
                }
                lastMonth = monthIndex;

                currentDate = this.formatDate(day, monthName, this.currentYear);

                if (isDateFirst) {
                    // STANDARD PERSONAL FORMAT: Date | Description | Amounts...
                    // Remove date from line to get description part
                    const lineAfterDate = trimmed.substring(dateMatch[0].length).trim();

                    const extracted = this.extractTransaction(lineAfterDate, currentDate);
                    if (extracted) {
                        if (currentAudit) {
                            if (!pageCounts[currentAudit.page]) pageCounts[currentAudit.page] = 0;
                            const idx = ++pageCounts[currentAudit.page];
                            extracted.audit = {
                                ...currentAudit,
                                lineCount: 1,
                                lineIndex: idx
                            };
                        }
                        transactions.push(extracted);
                    } else if (lineAfterDate) {
                        // Start of multi-line
                        pendingDescription = lineAfterDate;
                        pendingRawLines = [trimmed];
                        pendingAuditData = [currentAudit];
                        pendingLineCount = 1;
                    }

                } else {
                    // BUSINESS FORMAT: Description | Debit/Credit | Date | Balance
                    const extracted = this.extractBusinessTransaction(trimmed, dateMatch, currentDate);
                    if (extracted) {
                        if (currentAudit) {
                            if (!pageCounts[currentAudit.page]) pageCounts[currentAudit.page] = 0;
                            const idx = ++pageCounts[currentAudit.page];
                            extracted.audit = {
                                ...currentAudit,
                                lineCount: 1,
                                lineIndex: idx
                            };
                        }
                        transactions.push(extracted);
                    }
                }

            } else if (currentDate) {
                // No date - continuation line?
                const extracted = this.extractTransaction(trimmed, currentDate);
                if (extracted) {
                    // Transaction matched on THIS line (the continuation/end line)
                    if (pendingDescription) {
                        extracted.description = pendingDescription + ' ' + extracted.description;
                        extracted.description = this.cleanTDDescription(extracted.description);

                        extracted.rawText = [...pendingRawLines, trimmed].join('\n');
                        const allAudit = [...pendingAuditData, currentAudit];
                        extracted.audit = this.mergeAuditMetadata(allAudit);
                    }

                    if (extracted.audit && extracted.audit.page) {
                        if (!pageCounts[extracted.audit.page]) pageCounts[extracted.audit.page] = 0;
                        extracted.audit.lineIndex = ++pageCounts[extracted.audit.page];
                    }

                    pendingDescription = '';
                    pendingRawLines = [];
                    pendingAuditData = [];
                    pendingLineCount = 0;
                    transactions.push(extracted);
                } else {
                    // Accumulate description logic
                    if (pendingDescription) {
                        pendingDescription += ' ' + trimmed;
                        pendingRawLines.push(trimmed);
                        pendingAuditData.push(currentAudit);
                        pendingLineCount++;
                    } else if (trimmed.match(/^[A-Za-z]/)) {
                        // Only accumulate if it looks like text, not numbers
                        pendingDescription = trimmed;
                        pendingRawLines = [trimmed];
                        pendingAuditData = [currentAudit];
                        pendingLineCount = 1;
                    }
                }
            }
        }

        console.log(`[TD] Parsing complete. Found ${transactions.length} transactions.`);
        return { transactions, metadata: metaObj };
    }

    /**
     * Extract transaction for Business Format (Desc | Amt | Date | Bal)
     */
    extractBusinessTransaction(line, dateMatch, dateStr) {
        // Line structure: [Pre-Date Part] [Date] [Post-Date Part]
        // Pre-Date: "Description Amount(s)"
        // Post-Date: "Balance"

        const preDate = line.substring(0, dateMatch.index).trim();
        const postDate = line.substring(dateMatch.index + dateMatch[0].length).trim();

        // 1. Extract Balance from Post-Date (should be the last number)
        // postDate example: "10,062.72" or empty
        const postAmounts = postDate.match(/([\d,]+\.\d{2})/g);
        let balance = 0;
        if (postAmounts && postAmounts.length > 0) {
            balance = parseFloat(postAmounts[postAmounts.length - 1].replace(/,/g, ''));
        }

        // 2. Extract Transaction Amount from Pre-Date
        // preDate example: "Monthly Fee 19.00" or "Deposit 500.00"
        // The transaction amount is usually the LAST number in the pre-date string.
        const preAmounts = preDate.match(/([\d,]+\.\d{2})/g);

        if (!preAmounts || preAmounts.length === 0) {
            // No amount found?
            console.log('[TD-DEBUG] No amounts found in pre-date section:', preDate);
            return null;
        }

        // The txn amount is the last one found before the date
        const amountStr = preAmounts[preAmounts.length - 1];
        const amount = parseFloat(amountStr.replace(/,/g, ''));

        // 3. Extract Description
        // Remove the amount from the pre-date string
        let description = preDate.substring(0, preDate.lastIndexOf(amountStr)).trim();

        description = this.cleanTDDescription(description);

        // 4. Determine Debit vs Credit
        // In Business format (Desc | Debit | Credit | Date | Balance), position matters.
        // But since we lost column alignment in text extraction, we often rely on:
        // A) Keyword heuristics
        // B) Balance Delta logic (if we had previous balance, which we don't robustly here)

        // Heuristic: Check keywords first
        let isCredit = this.isCredit(description);

        // Refined Heuristic for Business Format: 
        // If there are TWO amounts in preDate, 1st = Debit, 2nd = Credit?
        // Actually, usually only one is populated. 
        // We really need to know if it's a debit or credit. 

        // Let's rely on keywords + "OD" logic if applicable.
        // Note: For now, keywords are safest unless we track running balance.

        return {
            date: dateStr,
            description: description,
            amount: amount,
            debit: isCredit ? 0 : amount,
            credit: isCredit ? amount : 0,
            balance: balance,
            _inst: '004',
            _brand: 'TD',
            _bank: 'TD',
            _tag: 'Chequing',
            rawText: this.cleanRawText(line)
        };
    }

    /**
     * Extract transaction from line with amounts
     */
    extractTransaction(text, dateStr) {
        if (!text) return null;

        // Pattern: Description | Debit | Credit | Balance
        // Amounts: 1,234.56 or 1234.56
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
        description = this.cleanTDDescription(description);

        // Determine amounts based on count
        let debit = 0, credit = 0, balance = 0;

        if (amounts.length >= 3) {
            // Format: Debit | Credit | Balance
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

        // Handle OD (overdraft) indicator
        if (text.toUpperCase().includes('OD')) {
            balance = -Math.abs(balance);
        }

        return {
            date: dateStr,
            description: description,
            amount: debit || credit,
            debit: debit,
            credit: credit,
            balance: balance,
            _inst: '004',
            _brand: 'TD',
            _bank: 'TD',
            _tag: 'Chequing',
            rawText: this.cleanRawText(text)
        };
    }

    /**
     * Clean TD description with prefix matching
     */
    cleanTDDescription(desc) {
        // 1. Normalize whitespace
        desc = desc.replace(/\s+/g, ' ').trim();

        // 2. Remove TD-specific noise
        desc = desc.replace(/CHQ#\d+-\d+/gi, '');  // Cheque numbers
        desc = desc.replace(/\bMSP\b/gi, '');       // MSP codes
        desc = desc.replace(/\b\d{6,}\b/gi, '');    // Long tracking numbers
        desc = desc.replace(/[a-f0-9]{16,}/gi, ''); // Hex codes

        // 3. TD-specific transaction type prefixes
        const typePrefixes = [
            "ONLINE BILL PAYMENT",
            "BILL PAYMENT",
            "INTERAC E-TRANSFER",
            "E-TRANSFER",
            "DIRECT DEPOSIT",
            "ATM WITHDRAWAL",
            "DEBIT CARD PURCHASE",
            "DEBIT PURCHASE",
            "POINT OF SALE",
            "POS PURCHASE",
            "MONTHLY FEE",
            "SERVICE CHARGE",
            "NSF FEE",
            "OVERDRAFT FEE",
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

    /**
     * Determine if transaction is credit (increases balance)
     */
    isCredit(description) {
        const creditKeywords = [
            'deposit', 'credit', 'transfer in', 'refund', 'reversal',
            'interest earned', 'payment received'
        ];

        const descLower = description.toLowerCase();
        return creditKeywords.some(kw => descLower.includes(kw));
    }
}

// Expose to window for file:// compatibility
window.TDChequingParser = TDChequingParser;
window.tdChequingParser = new TDChequingParser();
