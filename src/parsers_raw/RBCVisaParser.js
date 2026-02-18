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

        let pendingDescription = '';
        let pendingRawLines = [];
        let pendingAuditLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (!trimmed || trimmed.match(/Opening Balance|Previous Balance|Page \d/i)) continue;

            // Check if line contains a date AND an amount (complete transaction line)
            const dateMatch = trimmed.match(dateRegex);
            const hasAmount = /[\d,]+\.\d{2}/.test(trimmed);

            if (dateMatch && hasAmount) {
                // Extract date from the match
                const isoDate = `${currentYear}-${monthMap[dateMatch[1].toLowerCase()]}-${dateMatch[2].padStart(2, '0')}`;

                // Extract transaction from full line (date is part of description)
                const extracted = this.extractTransaction(trimmed, isoDate, line);
                if (extracted && extracted.amount) {
                    if (pendingDescription) {
                        extracted.description = pendingDescription + ' ' + extracted.description;
                        extracted.rawText = [...pendingRawLines, extracted.rawText].join('\n');
                        if (extracted.audit) {
                            extracted.audit = this.mergeAuditMetadata([...pendingAuditLines, extracted.audit]);
                        }
                    }
                    transactions.push(extracted);
                    pendingDescription = '';
                    pendingRawLines = [];
                    pendingAuditLines = [];
                } else {
                    // Start of multi-line
                    pendingDescription = trimmed;
                    pendingRawLines = [line];
                    pendingAuditLines = [this.getSpatialMetadata(line)];
                }
            } else if (pendingDescription && trimmed.length > 3) {
                // Check if this line has an amount (sometimes lines wrap and amount is on next line)
                const extracted = this.extractTransaction(trimmed, '', line);
                if (extracted && extracted.amount) {
                    extracted.date = transactions[transactions.length - 1]?.date || '1900-01-01';
                    extracted.description = pendingDescription + ' ' + extracted.description;
                    extracted.rawText = [...pendingRawLines, line].join('\n');
                    extracted.audit = this.mergeAuditMetadata([...pendingAuditLines, this.getSpatialMetadata(line)]);
                    transactions.push(extracted);
                    pendingDescription = '';
                    pendingRawLines = [];
                    pendingAuditLines = [];
                } else {
                    pendingDescription += ' ' + trimmed;
                    pendingRawLines.push(line);
                    pendingAuditLines.push(this.getSpatialMetadata(line));
                }
            }
        }
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
        const isPayment = /payment|credit|refund|THANK YOU|REWARD/i.test(description);

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
