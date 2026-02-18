/**
 * BMO Credit Card Parser
 * LIABILITY account - Debit increases balance, Credit decreases balance
 */
class BMOCreditCardParser extends BaseBankParser {
    constructor() {
        super('BMO', 'CreditCard', 'BMO Credit Card - Liability account');
    }

    async parse(statementText, metadata = null, lineMetadata = []) {
        this.lastLineMetadata = lineMetadata;
        const lines = statementText.split('\n');
                // Extract balances using base helper
        const { openingBalance, closingBalance, statementPeriod } = this.extractBalances(statementText);

        const transactions = [];
        let currentYear = new Date().getFullYear();

        // Extract year
        const yearMatch = statementText.match(/(\d{4})/);
        if (yearMatch) currentYear = parseInt(yearMatch[1]);

        // Date: "Apr 01", "May 16"
        const dateRegex = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d{1,2})/i;
        const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.match(/Opening|Balance forward|Page \d/i)) continue;

            const dateMatch = line.match(dateRegex);
            if (!dateMatch) continue;

            const isoDate = `${currentYear}-${monthMap[dateMatch[1].toLowerCase()]}-${dateMatch[2].padStart(2, '0')}`;
            const remainder = line.substring(dateMatch[0].length).trim();

            // Find amounts
            const amounts = remainder.match(/([\d,]+\.\d{2})/g);
            if (!amounts || amounts.length < 1) continue;

            // Description
            const firstAmt = remainder.search(/[\d,]+\.\d{2}/);
            const description = remainder.substring(0, firstAmt).trim();
            if (!description) continue;

            // Credit card: positive = charge (debit), negative = payment (credit)
            const amount = parseFloat(amounts[0].replace(/,/g, ''));
            const balance = amounts.length > 1 ? parseFloat(amounts[amounts.length - 1].replace(/,/g, '')) : 0;

            // Determine type by keywords
            const isPayment = /payment|credit|refund/i.test(description);

            const auditData = this.buildAuditData(line, 'BMOCreditCardParser', { statementId: this._getStmtId(text), lineNumber: ++this._txSeq });

            transactions.push({
                date: isoDate,
                description,
                amount,
                debit: isPayment ? amount : 0,   // Payments REDUCE liability (debit)
                credit: isPayment ? 0 : amount,  // Purchases INCREASE liability (credit)
                balance,
                _brand: 'BMO',
                _tag: 'CreditCard',
                _accountType: 'CreditCard', // [NEW] Explicit liability flagging
                rawText: this.cleanRawText(line),
                parser_ref: this._getStmtId(text) + '-' + String(this._txSeq).padStart(3, '0'),
            pdfLocation: auditData.pdfLocation,
                audit: auditData.audit
            });
        }

        console.log(`[BMO-CC] Parsed ${transactions.length} transactions`);
        return {
            transactions,
            metadata: {
                _tag: 'CreditCard',
                cardNetwork: 'CreditCard',
                accountType: 'CreditCard',
                bankName: 'BMO'
            }
        };
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
        this._cachedStmtId = 'BMOCC-' + year + month;
        this._txSeq = 0; // Reset sequence for new statement
        return this._cachedStmtId;
    }
    _resetAuditState() { this._cachedStmtId = null; this._txSeq = 0; }

}

window.BMOCreditCardParser = BMOCreditCardParser;
window.bmoCreditCardParser = new BMOCreditCardParser();

// TEST

// PATCH_TEST
