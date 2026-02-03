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
        this.lastLineMetadata = lineMetadata;
        // LOUD DIAGNOSTIC
        console.warn('⚡ [EXTREME-RBC-VISA] Starting metadata extraction for RBC Visa...');
        console.error('📄 [DEBUG-RBC-VISA] First 1000 characters (RED for visibility):');
        console.log(statementText.substring(0, 1000));

        const lines = statementText.split('\n');
        const transactions = [];

        // EXTRACT METADATA (Institution, Transit, Account)
        const acctMatch = statementText.match(/(?:Account)[:#]?\s*([\d-]{7,})/i);

        // Extract opening balance (Previous Balance for credit cards)
        let openingBalance = null;
        const openingMatch = statementText.match(/Previous Balance.*?\$?([\d,]+\.\d{2})/i);
        if (openingMatch) {
            openingBalance = parseFloat(openingMatch[1].replace(/,/g, ''));
            console.log(`[RBC-VISA] Extracted opening balance: ${openingBalance}`);
        }

        const parsedMetadata = {
            _inst: '003', // RBC Institution Code
            _transit: '-----',
            _acct: acctMatch ? acctMatch[1].replace(/[-\s]/g, '') : '-----',
            institutionCode: '003',
            transit: '-----',
            accountNumber: acctMatch ? acctMatch[1].replace(/[-\s]/g, '') : '-----',
            _brand: 'RBC',
            _bank: 'RBC Visa',
            _tag: 'Visa',
            openingBalance: openingBalance
        };
        console.warn('🏁 [RBC-VISA] Extraction Phase Complete. Transit:', parsedMetadata.transit, 'Acct:', parsedMetadata.accountNumber);

        const yearMatch = statementText.match(/20\d{2}/);
        const currentYear = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

        const dateRegex = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{1,2})/i;
        const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

        let pendingDescription = '';
        let pendingRawLines = [];
        let pendingAuditLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (!trimmed || trimmed.match(/Opening Balance|Previous Balance|Page \d/i)) continue;

            const dateMatch = trimmed.match(dateRegex);
            if (dateMatch) {
                const isoDate = `${currentYear}-${monthMap[dateMatch[1].toLowerCase()]}-${dateMatch[2].padStart(2, '0')}`;
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
                    // Start of multi-line
                    pendingDescription = remainder;
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
        console.log(`[RBC-VISA] Parsed ${transactions.length} transactions`);
        return { transactions, metadata: parsedMetadata };
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

        return {
            date: isoDate,
            description,
            amount: amount,
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
}

window.RBCVisaParser = RBCVisaParser;
window.rbcVisaParser = new RBCVisaParser();
