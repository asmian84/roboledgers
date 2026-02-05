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
        this.lastLineMetadata = lineMetadata;
        console.log('⚡ Scotia Mastercard: Starting regex-based parsing...');

        const lines = statementText.split('\n');
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

        console.log(`[SCOTIA-MC] Parsed ${transactions.length} transactions`);
        return {
            transactions,
            metadata: {
                _inst: '002', // Scotiabank Institution Code
                _transit: '-----',
                _acct: '-----', // Would need account number from statement
                institutionCode: '002',
                transit: '-----',
                accountNumber: '-----',
                _brand: 'Scotiabank',
                _bank: 'Scotiabank Mastercard',
                _tag: 'Mastercard'
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
        const isNegative = rawAmt.endsWith('-');
        const amount = parseFloat(rawAmt.replace(/[,-]/g, ''));
        const balance = amounts.length > 1 ? parseFloat(amounts[amounts.length - 1].replace(/[,-]/g, '')) : 0;
        const isPayment = isNegative || /payment|credit|refund/i.test(description);

        return {
            date: isoDate,
            description,
            amount,
            debit: isPayment ? 0 : amount,
            credit: isPayment ? amount : 0,
            balance,
            rawText: this.cleanRawText(originalLine),
            audit: this.getSpatialMetadata(originalLine)
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
}

window.ScotiaMastercardParser = ScotiaMastercardParser;
window.scotiaMastercardParser = new ScotiaMastercardParser();
