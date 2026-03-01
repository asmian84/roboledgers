/**
 * Scotiabank American Express Parser
 * Regex-based parser for Scotiabank Amex statements
 */
class ScotiaAmexParser extends BaseBankParser {
    constructor() {
        const formatRules = `
SCOTIABANK AMEX FORMAT:
- Date format: Apr-11, Apr-14 (MMM-DD)
- Credit card: Debit = charges, Credit = payments/refunds
- Transaction types: PAYMENT, PURCHASE, ANNUAL FEE, INTEREST
    `;
        super('Scotiabank', 'Amex', formatRules);
    }

    async parse(statementText, metadata = null, lineMetadata = []) {
        this._resetAuditState(); // Reset per-file audit state (singleton parser reuse)
        this.lastLineMetadata = lineMetadata;

        const lines = statementText.split('\n');
        // Extract balances using base helper
        const { openingBalance, closingBalance, statementPeriod } = this.extractBalances(statementText);

        const transactions = [];

        // EXTRACT METADATA - Amex format: 3704-000228-17271
        const acctMatch = statementText.match(/(?:Account\s*#?)\s*(\d{4}-\d{6}-\d{5})/i);
        const parsedMetadata = {
            _acct: acctMatch ? acctMatch[1].replace(/-/g, '') : '-----',
            accountNumber: acctMatch ? acctMatch[1].replace(/-/g, '') : '-----',
            _tag: 'Amex',
            cardNetwork: 'Amex',
            accountType: 'CreditCard',
            bankName: 'Scotiabank',
            bankIcon: 'SCOTIA'
        };

        const yearMatch = statementText.match(/20\d{2}/);
        const currentYear = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

        // Date regex: "Apr-11 Apr-14" or just "Apr-14"
        const dateRegex = /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{1,2})/i;
        const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

        let pendingDescription = '';
        let pendingRawLines = [];
        let pendingAuditLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (!trimmed || trimmed.match(/Opening Balance|Previous Balance|Page \d|Scotia Rewards/i)) continue;

            const dateMatch = trimmed.match(dateRegex);
            if (dateMatch) {
                // Extract month from line (before the dash)
                const monthMatch = trimmed.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
                if (monthMatch) {
                    const month = monthMatch[1].toLowerCase();
                    const day = dateMatch[1];
                    const isoDate = `${currentYear}-${monthMap[month]}-${day.padStart(2, '0')}`;

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

        return { transactions, metadata: parsedMetadata, openingBalance, closingBalance, statementPeriod };
    };

    extractTransaction(text, isoDate, originalLine) {
        const amounts = text.match(/([\d,]+\.\d{2})/g);
        if (!amounts || amounts.length < 1) return null;

        const firstAmtIdx = text.search(/[\d,]+\.\d{2}/);
        let description = text.substring(0, firstAmtIdx).trim();

        description = this.cleanCreditDescription(description, [
            "PAYMENT", "PAYMENT THANK YOU", "PURCHASE", "CASH ADVANCE",
            "INTEREST", "ANNUAL FEE", "FEE"
        ]);

        const amount = parseFloat(amounts[0].replace(/,/g, ''));
        const balance = amounts.length > 1 ? parseFloat(amounts[amounts.length - 1].replace(/,/g, '')) : 0;
        // Detect negative prefix, trailing minus, CR suffix — bulletproof sign detection
        const negMatch = text.match(/-\s*([\d,]+\.\d{2})/);
        const isNegPrefix = negMatch && parseFloat(negMatch[1].replace(/,/g, '')) === amount;
        const hasCR = /[\d,]+\.\d{2}\s*CR\b/i.test(text);
        // Keyword fallback — avoid bare "credit" which appears in "CREDIT PURCHASE"
        const isPaymentKeyword = /payment|paiement|merci|refund|thank you|CREDIT VOUCHER|CREDIT MEMO/i.test(description);
        const isPayment = isNegPrefix || hasCR || isPaymentKeyword;

        const auditData = this.buildAuditData(originalLine, 'ScotiaAmexParser', { statementId: this._getStmtId(text), lineNumber: ++this._txSeq });

        return {
            date: isoDate,
            description,
            amount,
            debit: isPayment ? amount : 0,    // Payments REDUCE liability (debit)
            credit: isPayment ? 0 : amount,  // Purchases INCREASE liability (credit)
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
        this._cachedStmtId = 'SCOTIAAX-' + year + month;
        this._txSeq = 0; // Reset sequence for new statement
        return this._cachedStmtId;
    }
    _resetAuditState() { this._cachedStmtId = null; this._txSeq = 0; }

}

window.ScotiaAmexParser = ScotiaAmexParser;
window.scotiaAmexParser = new ScotiaAmexParser();
