/**
 * BMO US (BMO Bank N.A.) Parser
 * Handles BMO Harris / BMO Bank (US) statements
 */
class BMOUSParser extends BaseBankParser {
    constructor() {
        const formatRules = `
BMO US FORMAT:
- Date: MM/DD/YYYY or MMM DD
- Columns: Date | Description | Amount | Balance
- Currency: USD
        `;
        super('BMOUS', 'Chequing', formatRules);
    }

    async parse(statementText, metadata = null, lineMetadata = []) {
        this.lastLineMetadata = lineMetadata;
        const lines = statementText.split('\n');
        const transactions = [];

        // Identify Currency
        const isUSD = /USD|US\s+Dollar|United\s+States/i.test(statementText);

        // Date pattern: MM/DD/YYYY or MM/DD
        const dateRegex = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/;

        let pendingDescription = '';
        let pendingRawLines = [];
        let pendingAuditLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (!trimmed || trimmed.match(/Opening|Balance|Page \d/i)) continue;

            const dateMatch = trimmed.match(dateRegex);
            if (dateMatch) {
                const month = dateMatch[1].padStart(2, '0');
                const day = dateMatch[2].padStart(2, '0');
                const year = dateMatch[3] ? (dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3]) : new Date().getFullYear();

                const isoDate = `${year}-${month}-${day}`;
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
                _brand: 'BMOUS',
                _tag: 'Chequing',
                currency: isUSD ? 'USD' : 'CAD'
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
        // Basic heuristic for US banks: check for minus sign or keywords
        const isDebit = text.includes('-') || /withdrawal|purchase|debit/i.test(description);
        if (isDebit) {
            debit = amount;
        } else {
            credit = amount;
        }

        return {
            date: isoDate,
            description: description || 'BMO US Transaction',
            amount: debit || credit,
            debit,
            credit,
            balance,
            rawText: this.cleanRawText(originalLine),
            audit: this.getSpatialMetadata(originalLine),
            _brand: 'BMOUS',
            _tag: 'Chequing'
        };
    }
}

window.BMOUSParser = BMOUSParser;
window.bmousParser = new BMOUSParser();
