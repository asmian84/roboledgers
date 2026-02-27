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
        this._resetAuditState(); // Reset per-file audit state (singleton parser reuse)
        // [PHASE 4] Store metadata for audit
        this.lastLineMetadata = lineMetadata;
        const pageCounts = {};

        const lines = statementText.split('\n');
        const transactions = [];

        // EXTRACT METADATA (Institution, Transit, Account)
        // TD format: Branch No. 9083, Account No. 0928-5217856
        const transitMatch = statementText.match(/(?:Branch No\.|Transit)[:#]?\s*(\d{4,5})/i);
        const acctMatch = statementText.match(/(?:Account No\.|Account)[:#]?\s*([\d-]{7,})/i);
        // [EasyWeb] TD online banking export: "TD BASIC BUSINESS PLAN - 5289507" or "Account :   TD ... - 5289507"
        const ewAcctMatch = !acctMatch ? (statementText.match(/PLAN\s*[-–]\s*(\d{5,})/i) || statementText.match(/Account\s*:.*?[-–]\s*(\d{5,})/i)) : null;
        const rawAcct = acctMatch ? acctMatch[1].replace(/[-\s]/g, '') : (ewAcctMatch ? ewAcctMatch[1] : '-----');

        const metaObj = {
            _inst: '004', // TD Institution Code
            _transit: transitMatch ? transitMatch[1] : '-----',
            _acct: rawAcct,
            institutionCode: '004',
            transit: transitMatch ? transitMatch[1] : '-----',
            accountNumber: rawAcct,
            _brand: 'TD',
            _bank: 'TD',
            bankIcon: 'TD',
            _tag: 'Chequing'
        };
        // Extract year from statement (usually at top)
        const yearMatch = statementText.match(/20\d{2}/);
        this.currentYear = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

        let currentDate = null;
        let pendingDescription = '';
        let pendingRawLines = [];
        let pendingAuditData = [];
        let pendingLineCount = 0; // Track lines for multi-line transactions
        let lastMonth = null;

        // [EasyWeb polarity] Delta-match approach for determining debit/credit.
        // EasyWeb is newest-first between days but chronological within days.
        // For consecutive EasyWeb transactions, we compare the balance delta to the amount:
        //   delta ≈ +amount → CREDIT (balance went up by exactly the transaction amount)
        //   delta ≈ -amount → DEBIT  (balance went down by exactly the transaction amount)
        // If delta doesn't match (cross-day boundary or gaps), falls back to keyword heuristic.
        let prevEWBalance = null; // last EasyWeb running balance

        // Date regex: "JAN 15", "FEB02" (flexible spacing, no start anchor)
        const dateRegex = /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*(\d{1,2})/i;

        // [EasyWeb] Two date formats observed in browser-printed TD EasyWeb PDFs:
        //   Format A (month-first): "Feb 1, 2026  DESCRIPTION  AMOUNT  BALANCE"
        //   Format B (year-first):  "2026 Feb 11  DESCRIPTION  AMOUNT  BALANCE"  ← most common
        //
        // IMPORTANT: EasyWeb PDFs (printed from browser) often have the date on its OWN line,
        // separate from the description and amounts. e.g.:
        //   Line 1: "Feb 11, 2026"              ← date cell only, nothing after the year
        //   Line 2: "CALGARY LOCK AN 167.95 92,287.08"  ← description + amounts
        //
        // The trailing (?:\s+|$) allows the regex to match a date-only line (end-of-line after
        // the year/day), so we can correctly set currentDate and clear pendingDescription before
        // the description+amounts line arrives. Without this, the date-only line fell through to
        // the QCM dateRegex which left the year ("2026") in pendingDescription, producing
        // descriptions like "2026 CALGARY LOCK AN" instead of "CALGARY LOCK AN".
        const easyWebDateRegex  = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s*(\d{4})(?:\s+|$)/i;
        const easyWebDateRegexB = /^(\d{4})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:\s+|$)/i;
        const ewMonthMap = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.length < 5) continue;

            // FILTER: Skip Aggregates, Headers, and Garbage
            if (trimmed.match(/AVER\.\s*CR\.\s*BAL|MIN\.\s*BAL|Statement\s*of\s*Account|Account\s*Type|Total\s*Credits|Total\s*Debits/i)) continue;
            if (trimmed.match(/DAILY\s*CHQ\s*BAL|SERVICE\s*CHARGES|INTEREST\s*PAID|OVERDRAFT\s*INTEREST/i)) continue;
            if (trimmed.match(/CAD\s*EVERY\s*DAY|CAD\s*BASIC|BUSINESS\s*CHEQUING/i)) continue;
            if (trimmed.match(/Description\s*Cheque|Date\s*Balance/i)) continue; // Table headers
            if (trimmed.match(/^(Debits|Credits)\s+\d/i)) continue; // Counts like "Debits 5"
            // [EasyWeb] Skip navigation and header lines from browser-printed TD EasyWeb pages
            if (trimmed.match(/^(TD Home|Account\s*:|Account Activity|Help\s*\||Current Balance|Available Balance|Balance Date|Direct deposit|Your transactions|30 days|Search by Month|View$|Month\s+Year|From\s+To\s+Search|Date\s+Transaction)/i)) continue;
            // [EasyWeb] Skip browser print timestamp/URL lines e.g. "Feb 11 2026 2/11/26, 6:20 PM EasyWeb https://..."
            if (trimmed.match(/EasyWeb\s+https?:\/\//i)) continue;
            if (trimmed.match(/^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}/)) continue; // timestamp like "2/11/26, 6:20 PM"

            // [EasyWeb] Handle date formats from browser-printed TD EasyWeb PDFs.
            // Format A (month-first): "Feb 1, 2026  DESCRIPTION  AMOUNT  BALANCE"
            // Format B (year-first):  "2026 Feb 11  DESCRIPTION  AMOUNT  BALANCE"
            let ewMatch = trimmed.match(easyWebDateRegex);
            let ewYear, ewMon, ewDay, lineAfterEWDate;

            if (ewMatch) {
                // Format A: month=group1, day=group2, year=group3
                ewMon  = ewMatch[1].substring(0, 3).toLowerCase();
                ewDay  = String(parseInt(ewMatch[2])).padStart(2, '0');
                ewYear = ewMatch[3];
                lineAfterEWDate = trimmed.substring(ewMatch[0].length).trim();
            } else {
                const ewMatchB = trimmed.match(easyWebDateRegexB);
                if (ewMatchB) {
                    // Format B: year=group1, month=group2, day=group3
                    ewYear = ewMatchB[1];
                    ewMon  = ewMatchB[2].substring(0, 3).toLowerCase();
                    ewDay  = String(parseInt(ewMatchB[3])).padStart(2, '0');
                    lineAfterEWDate = trimmed.substring(ewMatchB[0].length).trim();
                    ewMatch = ewMatchB; // treat as matched
                }
            }

            if (ewMatch) {
                currentDate = `${ewYear}-${ewMonthMap[ewMon]}-${ewDay}`;
                pendingDescription = '';
                pendingRawLines = [];
                pendingAuditData = [];
                // lineAfterEWDate was already computed above for both Format A and B
                const ewExtracted = this.extractTransaction(lineAfterEWDate, currentDate);
                if (ewExtracted) {
                    // [EasyWeb polarity fix] Delta-match approach.
                    // Compare balance delta to the transaction amount:
                    //   delta ≈ +amount → CREDIT (balance went up by exactly the tx amount)
                    //   delta ≈ -amount → DEBIT  (balance went down by exactly the tx amount)
                    // If delta doesn't match (cross-day gap, missing txns), keep keyword heuristic.
                    if (prevEWBalance !== null && ewExtracted.balance > 0 && prevEWBalance > 0) {
                        const delta = ewExtracted.balance - prevEWBalance;
                        const amt = ewExtracted.amount;
                        const tolerance = 0.02; // floating point tolerance
                        if (amt > 0 && Math.abs(delta - amt) < tolerance) {
                            // Balance increased by exactly the amount → CREDIT
                            ewExtracted.credit = amt;
                            ewExtracted.debit = 0;
                        } else if (amt > 0 && Math.abs(delta + amt) < tolerance) {
                            // Balance decreased by exactly the amount → DEBIT
                            ewExtracted.debit = amt;
                            ewExtracted.credit = 0;
                        }
                        // else: delta doesn't match → keep heuristic from extractTransaction
                    }

                    const _stId = this._getStmtId(statementText);
                    ewExtracted.parser_ref = _stId + '-' + String(++this._txSeq).padStart(3, '0');

                    prevEWBalance = ewExtracted.balance;

                    transactions.push(ewExtracted);
                }
                continue;
            }

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

                if (isDateFirst) {
                    // STANDARD PERSONAL FORMAT: Date | Description | Amounts...
                    // Remove date from line to get description part
                    const lineAfterDate = trimmed.substring(dateMatch[0].length).trim();

                    // ── [EasyWeb fallback] ──────────────────────────────────────────
                    // When EasyWeb date-only lines (e.g., "Dec 31, 2025") slip through
                    // the EasyWeb regex and land here, lineAfterDate is just ", 2025"
                    // or similar. Detect this pattern, extract the EXPLICIT year, set
                    // currentDate correctly, and continue without poisoning lastMonth
                    // or pendingDescription.
                    const ewDateOnlyMatch = lineAfterDate.match(/^[,.\s]*(20\d{2})\s*$/);
                    if (ewDateOnlyMatch) {
                        currentDate = this.formatDate(day, monthName, parseInt(ewDateOnlyMatch[1]));
                        pendingDescription = '';
                        pendingRawLines = [];
                        pendingAuditData = [];
                        pendingLineCount = 0;
                        continue; // desc+amounts follow on subsequent lines
                    }

                    // Year rollover detection (QCM only — skipped for EasyWeb date-only above)
                    const monthIndex = this.getMonthIndex(monthName);
                    if (lastMonth !== null && monthIndex < lastMonth) {
                        this.currentYear++;
                    }
                    lastMonth = monthIndex;
                    currentDate = this.formatDate(day, monthName, this.currentYear);

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
                    // Year rollover detection for business format lines
                    const monthIndex = this.getMonthIndex(monthName);
                    if (lastMonth !== null && monthIndex < lastMonth) {
                        this.currentYear++;
                    }
                    lastMonth = monthIndex;
                    currentDate = this.formatDate(day, monthName, this.currentYear);

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
                        // ── Audit identity parity (business format path) ──────────────
                        if (!extracted.parser_ref) {
                            const _stId = this._getStmtId(statementText);
                            const _seqN = ++this._txSeq;
                            extracted.parser_ref = _stId + '-' + String(_seqN).padStart(3, '0');
                            const _ar = typeof this.buildAuditData === 'function'
                                ? this.buildAuditData(trimmed, this.constructor.name, { statementId: _stId, lineNumber: _seqN })
                                : { pdfLocation: null, audit: null };
                            if (!extracted.pdfLocation) extracted.pdfLocation = _ar.pdfLocation;
                            if (!extracted.audit) extracted.audit = _ar.audit;
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

            // Default to DEBIT until the EasyWeb retroactive balance-delta fix overrides it.
            // The old heuristic (balance > amt) fired for virtually every transaction since
            // the running balance is almost always larger than any single transaction amount,
            // causing ALL transactions to be mis-classified as credits.
            if (this.isCredit(description)) {
                credit = amt; // keyword match (deposit, refund, etc.) — safe heuristic
            } else {
                debit = amt; // conservative default: assume debit, let balance-delta fix credits
            }
        } else {
            // Single amount - assume it's the balance
            balance = amounts[0];
        }

        // Handle OD (overdraft) indicator
        if (text.toUpperCase().includes('OD')) {
            balance = -Math.abs(balance);
        }

        // Build audit data for source document viewing
        const auditData = this.buildAuditData(text, 'TDChequingParser', { statementId: this._getStmtId(text), lineNumber: ++this._txSeq });

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
            parser_ref: this._getStmtId(text) + '-' + String(this._txSeq).padStart(3, '0'),
            pdfLocation: auditData.pdfLocation,
            audit: auditData.audit,
            rawText: this.cleanRawText(text)
        };
    }

    /**
     * Clean TD description with prefix matching
     */
    cleanTDDescription(desc) {
        // 1. Normalize whitespace
        desc = desc.replace(/\s+/g, ' ').trim();

        // 1b. Strip leading year prefix — artifact of EasyWeb date-only lines.
        // When "Dec 31, 2025" goes through QCM, ", 2025" becomes pendingDescription,
        // which gets prepended to the actual description → ", 2025 SERVICE CHARGE".
        // After whitespace normalization, this becomes "2025 SERVICE CHARGE" or
        // ", 2025 SERVICE CHARGE". Strip it.
        desc = desc.replace(/^[,.\s]*(20\d{2})\s+/, '');

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
            'interest earned', 'payment received',
            // EasyWeb-specific deposit patterns
            'send e-tfr', 'e-tfr', 'autodeposit', 'direct deposit',
            // TD cheque deposit format: "View Cheque CHQ#00001-"
            'view cheque', 'chq#',
            // Condo management companies (credits to property management account)
            'lockwood ccn', 'bellerose ccn', 'condominium cor', 'bonavista',
            // Government rebates/credits
            'carbon rebate', 'gst credit', 'gst/hst', 'canada carbon'
        ];

        const descLower = description.toLowerCase();
        return creditKeywords.some(kw => descLower.includes(kw));
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
        this._cachedStmtId = 'TDCHQ-' + year + month;
        this._txSeq = 0; // Reset sequence for new statement
        return this._cachedStmtId;
    }
    _resetAuditState() { this._cachedStmtId = null; this._txSeq = 0; }

}

// Expose to window for file:// compatibility
window.TDChequingParser = TDChequingParser;
window.tdChequingParser = new TDChequingParser();
