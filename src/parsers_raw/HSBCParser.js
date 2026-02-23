/**
 * HSBC Bank Parser
 * Handles HSBC chequing and credit card statements
 */
class HSBCParser extends BaseBankParser {
    constructor() {
        const formatRules = `
HSBC BANK FORMAT:
- Date: DD MMM YYYY or MMM DD
- Columns: Date | Description | Withdrawal | Deposit | Balance
        `;
        super('HSBC', 'Chequing', formatRules);
    }

    async parse(statementText, metadata = null, lineMetadata = []) {
        this._resetAuditState(); // Reset per-file audit state (singleton parser reuse)
        this.lastLineMetadata = lineMetadata;
        const lines = statementText.split('\n');
        const transactions = [];

        // Identify Year
        const yearMatch = statementText.match(/20\d{2}/);
        let currentYear = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

        const dateRegex = /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+(\d{4}))?/i;
        const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

        let pendingDescription = '';
        let pendingRawLines = [];
        let pendingAuditLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (!trimmed || trimmed.match(/Opening Balance|Page \d/i)) continue;

            const dateMatch = trimmed.match(dateRegex);
            if (dateMatch) {
                const day = dateMatch[1].padStart(2, '0');
                const monthName = dateMatch[2].toLowerCase();
                const year = dateMatch[3] || currentYear;
                const monthNum = monthMap[monthName];

                const isoDate = `${year}-${monthNum}-${day}`;
                const remainder = trimmed.substring(dateMatch[0].length).trim();

                const extracted = this.extractTransaction(remainder, isoDate, trimmed);
                if (extracted) {
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
                    pendingRawLines = [trimmed];
                    pendingAuditLines = [this.getSpatialMetadata(trimmed)];
                }
            } else if (pendingDescription && trimmed.length > 3) {
                const extracted = this.extractTransaction(trimmed, '', trimmed);
                if (extracted && extracted.amount) {
                    extracted.date = transactions[transactions.length - 1]?.date || '1900-01-01';
                    extracted.description = pendingDescription + ' ' + extracted.description;
                    extracted.rawText = [...pendingRawLines, trimmed].join('\n');
                    extracted.audit = this.mergeAuditMetadata([...pendingAuditLines, this.getSpatialMetadata(trimmed)]);
                    transactions.push(extracted);
                    pendingDescription = '';
                    pendingRawLines = [];
                    pendingAuditLines = [];
                } else {
                    pendingDescription += ' ' + trimmed;
                    pendingRawLines.push(trimmed);
                    pendingAuditLines.push(this.getSpatialMetadata(trimmed));
                }
            }
        }

        return {
            transactions,
            metadata: {
                _brand: 'HSBC',
                bankIcon: 'HSBC',
                _tag: 'Chequing',
                institutionCode: '016'
            }
        };
    }

    extractTransaction(text, isoDate, originalLine) {
        const amounts = text.match(/([\d,]+\.\d{2})/g);
        if (!amounts) return null;

        const firstAmtIdx = text.search(/[\d,]+\.\d{2}/);
        let description = text.substring(0, firstAmtIdx).trim();

        const amount = parseFloat(amounts[0].replace(/,/g, ''));
        const balance = amounts.length > 1 ? parseFloat(amounts[amounts.length - 1].replace(/,/g, '')) : 0;

        let debit = 0, credit = 0;
        // HSBC format: Date | Description | Withdrawal | Deposit | Balance
        // When 3+ amounts: withdrawal=amounts[0], deposit=amounts[1], balance=amounts[last]
        // When 2 amounts:  only one column is populated; balance=amounts[last], amount=amounts[0]
        //   → use keyword heuristics to determine which column is non-zero
        if (amounts.length >= 3) {
            // Both withdrawal and deposit present on same row (rare: interest + balance)
            // amounts[0]=withdrawal, amounts[1]=deposit, amounts[last]=balance
            debit  = parseFloat(amounts[0].replace(/,/g, ''));
            credit = parseFloat(amounts[1].replace(/,/g, ''));
        } else {
            // Only one non-zero column — use description keywords to classify
            const isDeposit = /deposit|credit|interest earned|payroll|transfer from|e-transfer.*rec|refund|direct deposit|autodeposit/i.test(description);
            if (isDeposit) {
                credit = amount;
            } else {
                debit = amount;
            }
        }

        const auditData = this.buildAuditData(originalLine, 'HSBCParser', { statementId: this._getStmtId(text), lineNumber: ++this._txSeq });

        return {
            date: isoDate,
            description: description || 'HSBC Transaction',
            amount: debit || credit,
            debit,
            credit,
            balance,
            rawText: this.cleanRawText(originalLine),
            parser_ref: this._getStmtId(text) + '-' + String(this._txSeq).padStart(3, '0'),
            pdfLocation: auditData.pdfLocation,
            audit: auditData.audit,
            _brand: 'HSBC',
            _tag: 'Chequing'
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
        this._cachedStmtId = 'HSBC-' + year + month;
        this._txSeq = 0; // Reset sequence for new statement
        return this._cachedStmtId;
    }
    _resetAuditState() { this._cachedStmtId = null; this._txSeq = 0; }

}

window.HSBCParser = HSBCParser;
window.hsbcParser = new HSBCParser();
