/**
 * Scotia Mastercard Parser
 * Regex-based parser for Scotiabank Mastercard statements
 */
class ScotiaMastercardParser extends BaseBankParser {
    constructor() {
        const formatRules = `
SCOTIA MASTERCARD FORMAT:
- Date format: MM/DD or MMM DD
- Credit card: Debit = charges, Credit = payments
- Transaction types: PAYMENT, PURCHASE, CASH ADVANCE, INTEREST CHARGE, ANNUAL FEE
    `;
        super('Scotiabank', 'Mastercard', formatRules);
    }

    async parse(statementText, metadata = null, lineMetadata = []) {
        this._resetAuditState(); // Reset per-file audit state (singleton parser reuse)
        this.lastLineMetadata = lineMetadata;

        const lines = statementText.split('\n');
                // Extract balances using base helper
        const { openingBalance, closingBalance, statementPeriod } = this.extractBalances(statementText);

        const transactions = [];

        const yearMatch = statementText.match(/20\d{2}/);
        const currentYear = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

        const dateRegex1 = /^(\d{1,2})\/(\d{1,2})/;
        const dateRegex2 = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i;
        const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

        let pendingDescription = '';
        let pendingRawLines = [];
        let pendingAuditLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (!trimmed || trimmed.match(/Opening Balance|Previous Balance|Page \d/i)) continue;

            let isoDate = null;
            let dateMatch = trimmed.match(dateRegex1) || trimmed.match(dateRegex2);

            if (dateMatch) {
                if (dateMatch[1].length === 3 || isNaN(parseInt(dateMatch[1]))) {
                    // MMM DD
                    const m = dateMatch[1].toLowerCase();
                    isoDate = `${currentYear}-${monthMap[m] || '01'}-${dateMatch[2].padStart(2, '0')}`;
                } else {
                    // MM/DD
                    isoDate = `${currentYear}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`;
                }
                const remainder = trimmed.substring(dateMatch[0].length).trim();

                const extracted = this.extractTransaction(remainder, isoDate, line);
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
                    pendingDescription = remainder;
                    pendingRawLines = [line];
                    pendingAuditLines = [this.getSpatialMetadata(line)];
                }
            } else if (pendingDescription && trimmed.length > 3) {
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

        return {
            transactions,
            metadata: {
                _acct: '-----',
                accountNumber: '-----',
                _tag: 'Mastercard',
                cardNetwork: 'Mastercard',
                accountType: 'CreditCard',
                bankName: 'Scotiabank',
                // Dual-icon system
                bankIcon: 'SCOTIA',
                networkIcon: 'MC',
                // Legacy branding
                brand: 'MC',
                bankCode: 'MC',
                institution: 'MC'
            }
        };
    }

    extractTransaction(text, isoDate, originalLine) {
        const amounts = text.match(/([\d,]+\.\d{2}-?)/g);
        if (!amounts || amounts.length < 1) return null;

        const firstAmtIdx = text.search(/[\d,]+\.\d{2}/);
        let description = text.substring(0, firstAmtIdx).trim();

        description = this.cleanCreditDescription(description, [
            "PAYMENT", "PURCHASE", "CASH ADVANCE",
            "INTEREST CHARGE", "ANNUAL FEE", "SERVICE CHARGE"
        ]);

        let rawAmt = amounts[0];
        // Scotia CC PDF convention: trailing minus = payment/refund/credit (e.g. "79.00-")
        const isTrailingMinus = rawAmt.endsWith('-');
        const amount = parseFloat(rawAmt.replace(/[,-]/g, ''));
        const balance = amounts.length > 1 ? parseFloat(amounts[amounts.length - 1].replace(/[,-]/g, '')) : 0;
        // Negative prefix (defensive), CR suffix (defensive)
        const negMatch = text.match(/-\s*([\d,]+\.\d{2})/);
        const isNegPrefix = negMatch && parseFloat(negMatch[1].replace(/,/g, '')) === amount;
        const hasCR = /[\d,]+\.\d{2}\s*CR\b/i.test(text);
        // Keyword fallback — NOTE: avoid bare "credit" which appears in "CREDIT PURCHASE"
        const isPaymentKeyword = /payment|paiement|merci|refund|CREDIT VOUCHER|CREDIT MEMO/i.test(description);
        const isPayment = isTrailingMinus || isNegPrefix || hasCR || isPaymentKeyword;

        const auditData = this.buildAuditData(originalLine, 'ScotiaMastercardParser', { statementId: this._getStmtId(text), lineNumber: ++this._txSeq });

        return {
            date: isoDate,
            description,
            amount,
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
                if (name) desc = `${name}, ${type.charAt(0) + type.slice(1).toLowerCase()}`;
                break;
            }
        }

        if (!desc.includes(',') && desc.includes(' - ')) {
            const parts = desc.split(' - ');
            desc = `${parts[1].trim()}, ${parts[0].trim()}`;
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
        this._cachedStmtId = 'SCOTIAMC-' + year + month;
        this._txSeq = 0; // Reset sequence for new statement
        return this._cachedStmtId;
    }
    _resetAuditState() { this._cachedStmtId = null; this._txSeq = 0; }

}

window.ScotiaMastercardParser = ScotiaMastercardParser;
window.scotiaMastercardParser = new ScotiaMastercardParser();
