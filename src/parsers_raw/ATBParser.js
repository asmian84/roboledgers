/**
 * ATB Financial Parser
 * Handles ATB Financial chequing and credit card statements
 */
class ATBParser extends BaseBankParser {
    constructor() {
        const formatRules = `
ATB FINANCIAL FORMAT:
- Date: MMM DD (e.g., "Apr 01", "May 16")
- Columns: Date | Description | Withdrawals | Deposits | Balance
- Mastercard: Date | Description | Amount
        `;
        super('ATB', 'Chequing', formatRules);
    }

    async parse(statementText, metadata = null, lineMetadata = []) {
        this.lastLineMetadata = lineMetadata;
        const lines = statementText.split('\n');
        const transactions = [];

        // Identify Year
        const yearMatch = statementText.match(/20\d{2}/);
        let currentYear = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

        // Detect Account Type (Mastercard vs Chequing)
        const isMastercard = /Mastercard|MyBusiness Rewards/i.test(statementText);
        const tag = isMastercard ? 'Mastercard' : 'Chequing';

        const dateRegex = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i;
        const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

        let pendingDescription = '';
        let pendingRawLines = [];
        let pendingAuditLines = [];
        let lastMonth = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (!trimmed || trimmed.match(/Opening|Balance|Page \d/i)) continue;

            const dateMatch = trimmed.match(dateRegex);
            if (dateMatch) {
                const monthName = dateMatch[1].toLowerCase();
                const day = dateMatch[2].padStart(2, '0');
                const monthNum = monthMap[monthName];

                // Year rollover
                const monthIndex = parseInt(monthNum) - 1;
                if (lastMonth !== null && monthIndex < lastMonth && monthIndex <= 1) {
                    currentYear++;
                }
                lastMonth = monthIndex;

                const isoDate = `${currentYear}-${monthNum}-${day}`;
                const remainder = trimmed.substring(dateMatch[0].length).trim();

                const extracted = this.extractTransaction(remainder, isoDate, trimmed, isMastercard);
                if (extracted) {
                    // Prepend any multi-line description from before
                    if (pendingDescription) {
                        extracted.description = pendingDescription + ' ' + extracted.description;
                        const combinedRaw = [...pendingRawLines, extracted.rawText].join('\n');
                        extracted.rawText = combinedRaw;

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
                    pendingDescription = remainder;
                    pendingRawLines = [trimmed];
                    pendingAuditLines = [this.getSpatialMetadata(trimmed)];
                }
            } else if (pendingDescription && trimmed.length > 3) {
                // Continuation
                const extracted = this.extractTransaction(trimmed, '', trimmed, isMastercard);
                if (extracted && extracted.amount) {
                    // Found amounts on THIS line
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
                _brand: 'ATB',
                _tag: tag,
                institutionCode: '---'
            }
        };
    }

    extractTransaction(text, isoDate, originalLine, isMastercard) {
        const amounts = text.match(/([\d,]+\.\d{2})/g);
        if (!amounts) return null;

        const firstAmtIdx = text.search(/[\d,]+\.\d{2}/);
        let description = text.substring(0, firstAmtIdx).trim();

        const amount = parseFloat(amounts[0].replace(/,/g, ''));
        const balance = amounts.length > 1 ? parseFloat(amounts[amounts.length - 1].replace(/,/g, '')) : 0;

        let debit = 0, credit = 0;
        if (isMastercard) {
            const isPayment = /payment|credit|refund/i.test(description);
            debit = isPayment ? 0 : amount;
            credit = isPayment ? amount : 0;
        } else {
            // Chequing format: Date Description Withdrawal Deposit Balance
            // If text has two amounts before balance, first is withdrawal
            if (amounts.length >= 3) {
                debit = amount;
                credit = parseFloat(amounts[1].replace(/,/g, ''));
            } else {
                // Heuristic: determine if it's withdrawal or deposit
                // Often hard without position. We'll use keyword heuristics or balance trend?
                // For now: assume first is amount. V5 grid allows user to flip.
                debit = amount;
            }
        }

        return {
            date: isoDate,
            description: description || 'ATB Transaction',
            amount: debit || credit,
            debit,
            credit,
            balance,
            rawText: this.cleanRawText(originalLine),
            audit: this.getSpatialMetadata(originalLine),
            _brand: 'ATB',
            _tag: isMastercard ? 'Mastercard' : 'Chequing'
        };
    }
}

window.ATBParser = ATBParser;
window.atbParser = new ATBParser();
