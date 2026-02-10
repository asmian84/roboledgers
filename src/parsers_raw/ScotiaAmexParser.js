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
        this.lastLineMetadata = lineMetadata;
        console.warn('⚡ [EXTREME-SCOTIA-AMEX] Starting metadata extraction for Scotiabank Amex...');
        console.error('📄 [DEBUG-SCOTIA-AMEX] First 1000 characters (RED for visibility):');
        console.log(statementText.substring(0, 1000));

        const lines = statementText.split('\n');
        const transactions = [];

        // Extract opening balance
        let openingBalance = 0;
        const previousBalanceMatch = statementText.match(/(?:Previous\s+balance|Balance\s+forward).*?(\d+[\d,]*\.\d{2})/i);
        if (previousBalanceMatch) {
            openingBalance = parseFloat(previousBalanceMatch[1].replace(/,/g, ''));
            console.log(`[SCOTIA-AMEX] Extracted opening balance: ${openingBalance}`);
        }

        // EXTRACT METADATA - Amex format: 3704-000228-17271
        const acctMatch = statementText.match(/(?:Account\s*#?)\s*(\d{4}-\d{6}-\d{5})/i);
        const parsedMetadata = {
            _acct: acctMatch ? acctMatch[1].replace(/-/g, '') : '-----',
            accountNumber: acctMatch ? acctMatch[1].replace(/-/g, '') : '-----',
            _tag: 'Amex',
            cardNetwork: 'Amex',
            accountType: 'CreditCard',
            bankName: 'Scotiabank'
        };
        console.warn('🏁 [SCOTIA-AMEX] Extraction Phase Complete. Transit:', parsedMetadata.transit, 'Acct:', parsedMetadata.accountNumber);

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

        console.log(`[SCOTIA-AMEX] Parsed ${transactions.length} transactions`);
        return { transactions, metadata: parsedMetadata, openingBalance };
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
        const isPayment = /payment|credit|refund/i.test(description);

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

        return desc.replace(/,\s*,/g, ',').trim();
    }
}

window.ScotiaAmexParser = ScotiaAmexParser;
window.scotiaAmexParser = new ScotiaAmexParser();
