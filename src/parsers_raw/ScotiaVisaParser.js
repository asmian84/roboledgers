/**
 * Scotiabank Visa Parser
 * Regex-based parser for Scotiabank Visa credit card statements
 */
class ScotiaVisaParser extends BaseBankParser {
    constructor() {
        const formatRules = `
SCOTIABANK VISA FORMAT:
- Date format: MMM DD (e.g., "Nov 21", "Dec 15")
- Two dates per transaction: Trans Date | Post Date
- Credit card: Debit = charges, Credit = payments/refunds
- Transaction types: PAYMENT, PURCHASE, CASH ADVANCE, INTEREST, ANNUAL FEE
    `;
        super('Scotiabank', 'Visa', formatRules);
    }

    async parse(statementText, metadata = null, lineMetadata = []) {
        this.lastLineMetadata = lineMetadata;
        console.warn('⚡ [EXTREME-SCOTIA-VISA] Starting metadata extraction for Scotiabank Visa...');
        console.error('📄 [DEBUG-SCOTIA-VISA] First 1000 characters (RED for visibility):');
        console.log(statementText.substring(0, 1000));

        const lines = statementText.split('\n');
        // Extract balances using base helper
        const { openingBalance, closingBalance, statementPeriod } = this.extractBalances(statementText);
        console.log(`[SCOTIA-VISA] Extracted opening balance: ${openingBalance}`);

        const transactions = [];

        // EXTRACT METADATA (Institution, Transit, Account)
        // EXTRACT METADATA (Institution, Transit, Account)
        // [FIX] Strict 1:1 fidelity for account number, allowing masked digits (asterisks)
        const acctMatch = statementText.match(/(?:Account\s*#?)\s*((?:[\d\*]{4}\s*){3}[\d\*]{3,4})/i);
        const rawAccount = acctMatch ? acctMatch[1].trim() : '-----';

        const parsedMetadata = {
            _acct: rawAccount,
            accountNumber: rawAccount,
            _tag: 'Visa',
            cardNetwork: 'Visa',
            accountType: 'CreditCard',
            bankName: 'Scotiabank',
            // Dual-icon system
            bankIcon: 'SCOTIA',
            networkIcon: 'VISA',
            // Legacy branding
            brand: 'VISA',
            bankCode: 'VISA',
            institution: 'VISA'
        };
        console.warn('🏁 [SCOTIA-VISA] Extraction Phase Complete. Transit:', parsedMetadata.transit, 'Acct:', parsedMetadata.accountNumber);

        const yearMatch = statementText.match(/20\d{2}/);
        const currentYear = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

        // Date regex for Scotiabank format: "Nov 21 Nov 23" (trans date, post date)
        const dateRegex = /^[HN]\s+(\d{3})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i;
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
                // Use POST date (second date) for consistency
                const postMonth = dateMatch[4].toLowerCase();
                const postDay = dateMatch[5];
                const isoDate = `${currentYear}-${monthMap[postMonth]}-${postDay.padStart(2, '0')}`;

                // Extract remainder after dates
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
                // Continuation or maybe amount on this line
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

        console.log(`[SCOTIA-VISA] Parsed ${transactions.length} transactions`);
        return { transactions, metadata: parsedMetadata, openingBalance, closingBalance, statementPeriod };
    };

    extractTransaction(text, isoDate, originalLine) {
        const amounts = text.match(/([\d,]+\.\d{2})/g);
        if (!amounts || amounts.length < 1) return null;

        const firstAmtIdx = text.search(/[\d,]+\.\d{2}/);
        let description = text.substring(0, firstAmtIdx).trim();

        description = this.cleanCreditDescription(description, [
            "PAYMENT", "PAYMENT THANK YOU", "PURCHASE", "CASH ADVANCE",
            "INTEREST", "INTEREST CHARGE", "ANNUAL FEE", "FEE", "FOREIGN TRANSACTION FEE"
        ]);

        const amount = parseFloat(amounts[0].replace(/,/g, ''));
        const balance = amounts.length > 1 ? parseFloat(amounts[amounts.length - 1].replace(/,/g, '')) : 0;
        const isPayment = /payment|credit|refund|THANK YOU|REWARD/i.test(description);

        return {
            date: isoDate,
            description,
            amount,
            debit: isPayment ? amount : 0,    // Payments REDUCE liability (debit)
            credit: isPayment ? 0 : amount,   // Purchases INCREASE liability (credit)
            balance,
            _brand: 'Scotiabank',
            _tag: 'Visa',
            _accountType: 'CreditCard',
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

window.ScotiaVisaParser = ScotiaVisaParser;
window.scotiaVisaParser = new ScotiaVisaParser();
