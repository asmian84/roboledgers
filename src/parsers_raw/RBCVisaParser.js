/**
 * RBC Visa Parser
 * Regex-based parser for RBC Visa credit card statements
 */
class RBCVisaParser extends BaseBankParser {
    constructor() {
        const formatRules = `
RBC VISA FORMAT:
- Date format: MMM DD (e.g., JAN 05,  FEB 15)
- Credit card: Debit = charges, Credit = payments
- Transaction types: PAYMENT THANK YOU, PURCHASE, CASH ADVANCE, INTEREST, ANNUAL FEE
    `;
        super('RBC', 'Visa', formatRules);
    }

    async parse(statementText, metadata = null, lineMetadata = []) {
        this._resetAuditState(); // Reset per-file audit state (singleton parser reuse)
        this.lastLineMetadata = lineMetadata;
        // LOUD DIAGNOSTIC

        const lines = statementText.split('\n');
        const transactions = [];

        // Diagnostic: log first 20 non-empty lines so we can see the raw PDF text layout
        const sampleLines = lines.filter(l => l.trim()).slice(0, 20);
        console.log('[PARSER] RBC Visa — first 20 lines:', sampleLines);

        // EXTRACT METADATA - Full masked card number (IIN standard: 16 digits for Visa)
        // RBC format: Can vary, try to extract full 16-digit masked format
        let accountNumber = 'XXXX XXXX XXXX XXXX'; // Default fallback

        // Try formatted (with spaces/dashes): "4XXX-XXXX-XXXX-1234" or "4XXX XXXX XXXX 1234"
        const maskedMatch = statementText.match(/([4-6]\d{3}[\s-]+[X\d]{4}[\s-]+[X\d]{4}[\s-]+\d{4})/i);
        if (maskedMatch) {
            accountNumber = maskedMatch[1].replace(/-/g, ' '); // Normalize to spaces
        } else {
            // Fallback: Try unformatted
            const unformattedMatch = statementText.match(/([4-6]\d{3}[X\d]{8}\d{4})/i);
            if (unformattedMatch) {
                const raw = unformattedMatch[1];
                accountNumber = raw.match(/.{1,4}/g).join(' ');
            }
        }

        // Extract balances using base helper
        const { openingBalance, closingBalance, statementPeriod } = this.extractBalances(statementText);

        const parsedMetadata = {
            _acct: accountNumber,
            accountNumber: accountNumber,
            _tag: 'Visa',
            cardNetwork: 'Visa',
            accountType: 'CreditCard',
            bankName: 'RBC',
            // Dual-icon system
            bankIcon: 'RBC',
            networkIcon: 'VISA',
            // Legacy branding
            brand: 'VISA',
            bankCode: 'VISA',
            institution: 'VISA'
            // NO transit, NO institutionCode - these are for bank accounts only
        };

        const yearMatch = statementText.match(/20\d{2}/);
        const currentYear = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

        // RBC Visa format: Date is embedded in description like "JUL 11 PAYMENT - THANK YOU"
        // NOT at the start of line
        const dateRegex = /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{1,2})/i;
        const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

        // Two parsing modes supported:
        // MODE A (single-line): "JAN 05 PAYMENT - THANK YOU   1,000.00   5,000.00" — date + desc + amount on one line
        // MODE B (column-separated): PDF.js extracts tabular PDFs one column at a time, so the same
        //   transaction becomes: "JAN 05" / "PAYMENT - THANK YOU" / "1,000.00" on three separate lines.
        // We detect which mode we're in after the first few lines and apply accordingly.
        // Both modes are handled simultaneously via pendingDate + pendingDescription state.

        let pendingDate        = null;  // ISO date from a date-only line (MODE B)
        let pendingDescription = '';
        let pendingRawLines    = [];
        let pendingAuditLines  = [];

        // Skip patterns — lines that are never transactions
        const SKIP_RE = /Opening\s+Balance|Previous\s+Balance|Credit\s+Limit|Minimum\s+Payment|Payment\s+Due\s+Date|Statement\s+Date|Account\s+Number|Page\s+\d|^\d+\s*$|Interest\s+Charged|Annual\s+Fee\s+Summary/i;

        const _flush = () => {
            pendingDate        = null;
            pendingDescription = '';
            pendingRawLines    = [];
            pendingAuditLines  = [];
        };

        for (let i = 0; i < lines.length; i++) {
            const line    = lines[i];
            const trimmed = line.trim();
            if (!trimmed || SKIP_RE.test(trimmed)) continue;

            const dateMatch = trimmed.match(dateRegex);
            const hasAmount = /[\d,]+\.\d{2}/.test(trimmed);
            // A "pure amount" line has an amount but NO month-name date token
            const isPureAmount = hasAmount && !dateMatch;

            // ── CASE 1: Line has BOTH date AND amount  (MODE A — single-line format) ──
            if (dateMatch && hasAmount) {
                // Flush any lingering column-separated pending first
                _flush();
                const isoDate   = `${currentYear}-${monthMap[dateMatch[1].toLowerCase()]}-${dateMatch[2].padStart(2, '0')}`;
                const extracted = this.extractTransaction(trimmed, isoDate, line);
                if (extracted && extracted.amount) {
                    transactions.push(extracted);
                } else {
                    // Amount couldn't be extracted — treat as pending start
                    pendingDate        = isoDate;
                    pendingDescription = trimmed;
                    pendingRawLines    = [line];
                    pendingAuditLines  = [this.getSpatialMetadata(line)];
                }
                continue;
            }

            // ── CASE 2: Line has date but NO amount  (MODE B — date-only column) ──
            if (dateMatch && !hasAmount) {
                // Close any prior pending (shouldn't happen often, but guard it)
                _flush();
                const isoDate      = `${currentYear}-${monthMap[dateMatch[1].toLowerCase()]}-${dateMatch[2].padStart(2, '0')}`;
                const afterDate    = trimmed.replace(dateRegex, '').trim();
                pendingDate        = isoDate;
                pendingDescription = afterDate; // text on same line after the date (may be empty)
                pendingRawLines    = [line];
                pendingAuditLines  = [this.getSpatialMetadata(line)];
                continue;
            }

            // ── CASE 3: No date, but we have a pending entry ──
            if (pendingDate || pendingDescription) {
                if (isPureAmount) {
                    // Amount line → finalise the pending transaction
                    const combinedText = (pendingDescription ? pendingDescription + ' ' : '') + trimmed;
                    const isoDate      = pendingDate || (transactions[transactions.length - 1]?.date) || `${currentYear}-01-01`;
                    const extracted    = this.extractTransaction(combinedText, isoDate, line);
                    if (extracted && extracted.amount) {
                        extracted.date    = isoDate;
                        // extracted.description already contains cleaned combinedText; don't override
                        extracted.rawText = [...pendingRawLines, line].join('\n');
                        if (extracted.audit && pendingAuditLines.length) {
                            extracted.audit = this.mergeAuditMetadata([...pendingAuditLines, this.getSpatialMetadata(line)]);
                        }
                        transactions.push(extracted);
                    }
                    _flush();
                } else if (trimmed.length > 2) {
                    // Description continuation line
                    pendingDescription += (pendingDescription ? ' ' : '') + trimmed;
                    pendingRawLines.push(line);
                    pendingAuditLines.push(this.getSpatialMetadata(line));
                }
            }
        }

        console.log(`[PARSER] RBC Visa parsed ${transactions.length} transactions`);
        return { transactions, metadata: parsedMetadata, openingBalance, closingBalance, statementPeriod };
    }

    extractTransaction(text, isoDate, originalLine) {
        const amounts = text.match(/([\d,]+\.\d{2})/g);
        if (!amounts || amounts.length < 1) return null;

        const firstAmtIdx = text.search(/[\d,]+\.\d{2}/);
        let description = text.substring(0, firstAmtIdx).trim();

        description = this.cleanCreditDescription(description, [
            "PAYMENT THANK YOU", "PURCHASE", "CASH ADVANCE",
            "INTEREST", "ANNUAL FEE", "FOREIGN TRANSACTION FEE"
        ]);

        const amount = parseFloat(amounts[0].replace(/,/g, ''));
        const balance = amounts.length > 1 ? parseFloat(amounts[amounts.length - 1].replace(/,/g, '')) : 0;
        // Detect negative prefix, trailing minus, CR suffix — bulletproof sign detection
        const negMatch = text.match(/-\s*([\d,]+\.\d{2})/);
        const isNegPrefix = negMatch && parseFloat(negMatch[1].replace(/,/g, '')) === amount;
        const isTrailingMinus = text.match(new RegExp(amounts[0].replace(/[.]/g, '\\.') + '\\s*-'));
        const hasCR = /[\d,]+\.\d{2}\s*CR\b/i.test(text);
        // Keyword fallback — avoid bare "credit" which appears in "CREDIT PURCHASE"/"ONLINE CREDIT"
        const isPaymentKeyword = /payment|paiement|merci|refund|thank you|reward|CREDIT VOUCHER|CREDIT MEMO/i.test(description);
        const isPayment = isNegPrefix || !!isTrailingMinus || hasCR || isPaymentKeyword;

        const auditData = this.buildAuditData(originalLine, 'RBCVisaParser', { statementId: this._getStmtId(text), lineNumber: ++this._txSeq });

        return {
            date: isoDate,
            description,
            amount: amount,
            debit: isPayment ? amount : 0,    // Payments REDUCE liability (debit)
            credit: isPayment ? 0 : amount,   // Purchases INCREASE liability (credit)
            balance,
            rawText: this.cleanRawText(originalLine),
            parser_ref: this._getStmtId(text) + '-' + String(this._txSeq).padStart(3, '0'),
            pdfLocation: auditData.pdfLocation,
            audit: auditData.audit
        };
    }

    cleanCreditDescription(desc, prefixes) {
        desc = desc.replace(/\s+/g, ' ').trim();
        desc = desc.replace(/\b\d{6,}\b/gi, '');

        const descUpper = desc.toUpperCase();
        for (const type of prefixes) {
            if (descUpper.startsWith(type + ' ')) {
                const name = desc.substring(type.length).trim();
                if (name) desc = `${name}, ${type.charAt(0) + type.slice(1).toLowerCase()} `;
                break;
            }
        }

        // Fix: Ensure the remainder is not empty after splitting on " - "
        if (!desc.includes(',') && desc.includes(' - ')) {
            const parts = desc.split(' - ');
            if (parts.length > 1 && parts[1].trim()) {
                desc = `${parts[1].trim()}, ${parts[0].trim()} `;
            } else if (parts[0]) {
                desc = parts[0].trim();
            }
        }

        return desc.replace(/,\s*,/g, ',').trim();
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
        this._cachedStmtId = 'RBCVISA-' + year + month;
        this._txSeq = 0; // Reset sequence for new statement
        return this._cachedStmtId;
    }
    _resetAuditState() { this._cachedStmtId = null; this._txSeq = 0; }

}

window.RBCVisaParser = RBCVisaParser;
window.rbcVisaParser = new RBCVisaParser();
