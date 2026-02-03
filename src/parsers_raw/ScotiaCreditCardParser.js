/**
 * Scotiabank Credit Card Parser
 * LIABILITY account - Debit increases balance, Credit decreases balance
 */
class ScotiaCreditCardParser extends BaseBankParser {
    constructor() {
        super('Scotiabank', 'CreditCard', 'Scotiabank Credit Card - Liability account');
    }

    async parse(statementText, metadata = null, lineMetadata = []) {
        this.lastLineMetadata = lineMetadata;
        // LOUD DIAGNOSTIC
        console.warn('⚡ [EXTREME-SCOTIA-CC] Starting metadata extraction for Scotiabank CC...');
        console.error('📄 [DEBUG-SCOTIA-CC] First 1000 characters (RED for visibility):');
        console.log(statementText.substring(0, 1000));

        const lines = statementText.split('\n');
        const transactions = [];

        // Extract opening balance (Previous Balance)
        let openingBalance = 0;
        const previousBalanceMatch = statementText.match(/Previous\s+Balance\s+.*?([\d,]+\.\d{2})/i);
        if (previousBalanceMatch) {
            openingBalance = parseFloat(previousBalanceMatch[1].replace(/,/g, ''));
            console.log(`[SCOTIA-CC] Extracted opening balance: ${openingBalance}`);
        }

        // EXTRACT METADATA (Institution, Transit, Account)
        const acctMatch = statementText.match(/(?:Account)[:#]?\s*([\d-]{7,})/i);
        const parsedMetadata = {
            _inst: '002', // Scotiabank Institution Code
            _transit: '-----',
            _acct: acctMatch ? acctMatch[1].replace(/[-\s]/g, '') : '-----',
            institutionCode: '002',
            transit: '-----',
            accountNumber: acctMatch ? acctMatch[1].replace(/[-\s]/g, '') : '-----',
            _brand: 'Scotiabank',
            _bank: 'Scotiabank',
            _tag: 'CreditCard'
        };
        console.warn('🏁 [SCOTIA-CC] Extraction Phase Complete. Transit:', parsedMetadata.transit, 'Acct:', parsedMetadata.accountNumber);

        let currentYear = new Date().getFullYear();

        // Extract year
        const yearMatch = statementText.match(/(\d{4})/);
        if (yearMatch) currentYear = parseInt(yearMatch[1]);

        // Date formats: "MM/DD/YYYY" or "MMM DD"
        const dateRegex1 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/;
        const dateRegex2 = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d{1,2})/i;
        const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

        let pendingDescription = '';
        let pendingRawLines = [];
        let pendingAuditLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (!trimmed || trimmed.match(/Opening|Balance forward|Page \d/i)) continue;

            let isoDate = null;
            let dateMatch = trimmed.match(dateRegex1) || trimmed.match(dateRegex2);

            if (dateMatch) {
                if (dateMatch.length === 4) {
                    // MM/DD/YYYY
                    isoDate = `${dateMatch[3]}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`;
                } else if (dateMatch[1].length === 3 || isNaN(parseInt(dateMatch[1]))) {
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

        console.log(`[SCOTIA-CC] Parsed ${transactions.length} transactions`);
        return { transactions, metadata: parsedMetadata, openingBalance };
    }

    extractTransaction(text, isoDate, originalLine) {
        const amounts = text.match(/([\d,]+\.\d{2}-?)/g);
        if (!amounts || amounts.length < 1) return null;

        const firstAmt = text.search(/[\d,]+\.\d{2}/);
        let description = text.substring(0, firstAmt).trim();

        // UI FORMATTING: Insert comma after known transaction types
        const typePrefixes = [
            "BILL PAYMENT", "INSURANCE", "SERVICE CHARGE", "POINT OF SALE PURCHASE",
            "TRANSFER TO", "TRANSFER FROM", "ABM WITHDRAWAL", "CASH WITHDRAWAL",
            "SHARED ABM WITHDRAWAL", "DEBIT MEMO", "CREDIT MEMO", "MISC PAYMENT",
            "INTERAC ABM FEE", "OVERDRAFT PROTECTION FEE", "RETURNED NSF CHEQUE",
            "NSF SERVICE CHARGE", "BUSINESS PAD", "MB BILL PAYMENT", "PC BILL PAYMENT"
        ];

        for (const type of typePrefixes) {
            if (description.toUpperCase().startsWith(type)) {
                if (description.length > type.length && description[type.length] !== ',') {
                    description = description.substring(0, type.length) + ',' + description.substring(type.length);
                }
                break;
            }
        }

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
            refCode: originalLine.match(/\b([A-Z0-9]{15,})\b/)?.[1] || 'N/A',
            audit: this.getSpatialMetadata(originalLine)
        };
    }
}

window.ScotiaCreditCardParser = ScotiaCreditCardParser;
window.scotiaCreditCardParser = new ScotiaCreditCardParser();
