/**
 * American Express Parser
 * Regex-based parser for Amex credit card statements
 */
class AmexParser extends BaseBankParser {
    constructor() {
        const formatRules = `
AMEX FORMAT:
- Date format: MM/DD or MMM DD
- Credit card: Debit = charges, Credit = payments
- Transaction types: PAYMENT THANK YOU, PURCHASE, CASH ADVANCE, INTEREST CHARGE, MEMBERSHIP FEE
    `;
        super('American Express', 'Amex', formatRules);
    }

    /**
     * Parse Amex statement
     * [PHASE 4] Now accepts lineMetadata for spatial tracking
     */
    async parse(statementText, inputMetadata = null, lineMetadata = []) {
        this.lastLineMetadata = lineMetadata;
        // LOUD DIAGNOSTIC
        console.warn('⚡ [EXTREME-AMEX] Starting metadata extraction for Amex...');
        console.error('📄 [DEBUG-AMEX] First 1000 characters (RED for visibility):');
        console.log(statementText.substring(0, 1000));

        // EXTRACT METADATA (Institution, Transit, Account)
        // Amex format often: XXXX XXXXX6 91001 or Account Number: 1234-567890-12345
        // Flexible regex for X's and account number parts
        const acctMatch = statementText.match(/(?:Account Number|Credit Card)[:#]?\s*(?:X{4,}\s*X{5,}\d?\s*|[\d-]{7,})(\d{5,6})/i)
            || statementText.match(/(?:Account)[:#]?\s*([\d-]{7,})/i);

        // EXTRACTION FOR CARD TYPE (Platinum, Gold, etc)
        const cardTypeMatch = statementText.match(/(?:The\s+)?(?:Business\s+)?(Platinum|Gold|Silver|Standard|Green)(?:\s+Card)?(?:\s+Statement)?/i);
        const cardType = cardTypeMatch ? cardTypeMatch[1] : 'Amex';

        const metadata = {
            _inst: '303', // Amex Institution Code
            _transit: '-----',
            _acct: acctMatch ? acctMatch[1].replace(/[-\s]/g, '') : '-----',
            institutionCode: '303',
            transit: '-----',
            accountNumber: acctMatch ? acctMatch[1].replace(/[-\s]/g, '') : '-----',
            _brand: 'Amex',
            _bank: 'American Express',
            _tag: cardType, // Use specific card type for tag
            _cardType: cardType
        };
        console.warn('🏁 [AMEX] Extraction Phase Complete. Transit:', metadata.transit, 'Acct:', metadata.accountNumber);

        // YEAR DETECTION: Look for Statement Period or Closing Date year
        const yearRegex = /(?:Statement\s+Period|Closing\s+Date|Ending\s+in|20[23]\d)/gi;
        let currentYear = new Date().getFullYear();
        const yearMatches = statementText.match(yearRegex);
        if (yearMatches) {
            // Find the first 4-digit year in the matches
            const fullYearMatch = statementText.match(/20\d{2}/);
            if (fullYearMatch) currentYear = parseInt(fullYearMatch[0]);
        }
        console.warn(`[AMEX] Detected Year: ${currentYear}`);

        const lines = statementText.split('\n');
        const transactions = [];

        // Extract opening balance (Previous Balance)
        let openingBalance = 0;
        const previousBalanceMatch = statementText.match(/Previous\s+Balance\s+.*?([\d,]+\.\d{2})/i);
        if (previousBalanceMatch) {
            openingBalance = parseFloat(previousBalanceMatch[1].replace(/,/g, ''));
            console.log(`[AMEX] Extracted opening balance: ${openingBalance}`);
        }

        let inTransactionBlock = false;
        let txnCounter = 1;

        const dateRegex1 = /^(\d{1,2})\/(\d{1,2})/;
        const dateRegex2 = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i;
        const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

        let pendingDescription = '';
        let pendingRawLines = [];
        let pendingAuditLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // TRACK BLOCK STATE
            if (line.match(/Your Transactions|New Transactions for/i)) {
                inTransactionBlock = true;
                continue;
            }
            if (inTransactionBlock && line.match(/Total of (?:New Transactions|Payment Activity|Activity)/i)) {
                inTransactionBlock = false;
                continue;
            }
            if (!inTransactionBlock || line.match(/Transaction\s+Posting\s+Details\s+Amount/i)) continue;

            let isoDate = null;
            let dateMatch = line.match(dateRegex1) || line.match(dateRegex2);
            if (dateMatch) {
                if (dateMatch[1].length === 3) {
                    isoDate = `${currentYear}-${monthMap[dateMatch[1].toLowerCase()]}-${dateMatch[2].padStart(2, '0')}`;
                } else {
                    isoDate = `${currentYear}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`;
                }
                const remainder = line.substring(dateMatch[0].length).trim();

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
            } else if (pendingDescription && line.length > 3) {
                const extracted = this.extractTransaction(line, '', line);
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
                    pendingDescription += ' ' + line;
                    pendingRawLines.push(line);
                    pendingAuditLines.push(this.getSpatialMetadata(line));
                }
            }
        }

        console.log(`[AMEX] Parsed ${transactions.length} transactions`);
        return { transactions, metadata, openingBalance };
    }

    extractTransaction(text, isoDate, originalLine) {
        const amountsAtEnd = text.match(/(-?[\d,]+\.\d{2})|([\d,]+\.\d{2}-?)$/);
        if (!amountsAtEnd) return null;

        const rawAmt = amountsAtEnd[0];
        const amount = parseFloat(rawAmt.replace(/[,]/g, ''));
        const descEndIdx = text.lastIndexOf(rawAmt);
        let description = text.substring(0, descEndIdx).trim().replace(/^\/+\s*/, '').trim();

        description = this.cleanCreditDescription(description, [
            "PAYMENT THANK YOU", "PURCHASE", "CASH ADVANCE",
            "INTEREST CHARGE", "MEMBERSHIP FEE", "LATE FEE", "FOREIGN TRANSACTION FEE"
        ]);

        const isPayment = amount < 0 || /payment|credit|thank you/i.test(description);
        const absAmount = Math.abs(amount);

        return {
            date: isoDate,
            description,
            amount: absAmount,
            debit: isPayment ? 0 : absAmount,
            credit: isPayment ? absAmount : 0,
            balance: 0,
            audit: this.getSpatialMetadata(originalLine),
            rawText: this.cleanRawText(originalLine),
            refCode: originalLine.match(/\b([A-Z0-9]{15,})\b/)?.[1] || 'N/A'
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

window.AmexParser = AmexParser;
window.amexParser = new AmexParser();
