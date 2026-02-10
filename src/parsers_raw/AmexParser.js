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

        // EXTRACT METADATA - Full masked card (IIN: 15 digits for Amex)
        // Amex format often: "XXXX XXXXX6 91001" or "3XXX XXXXXX X1001"
        let accountNumber = 'XXXX XXXXXX XXXX'; // Default fallback (15 digits)

        // Try to match full 15-digit Amex format (3XXX-XXXXXX-X1001)
        const maskedMatch = statementText.match(/([3]\d{3}[\s-]*X{6}[\s-]*X?\d{4,5})/i) ||
            statementText.match(/(X{4}[\s-]*X{5}\d?[\s-]*\d{4,5})/i);

        if (maskedMatch) {
            accountNumber = maskedMatch[1].replace(/-/g, ' ').replace(/\s+/g, ' '); // Normalize
            console.log(`[AMEX] Extracted full masked card: ${accountNumber}`);
        }

        // EXTRACTION FOR CARD TYPE (Platinum, Gold, etc)
        const cardTypeMatch = statementText.match(/(?:The\s+)?(?:Business\s+)?(Platinum|Gold|Silver|Standard|Green)(?:\s+Card)?(?:\s+Statement)?/i);
        const cardType = cardTypeMatch ? cardTypeMatch[1] : 'Amex';

        const metadata = {
            _acct: accountNumber,
            accountNumber: accountNumber,
            _tag: cardType,
            cardNetwork: 'Amex',
            accountType: 'CreditCard',
            bankName: 'American Express',
            _cardType: cardType,
            // Dual-icon system: bank + network
            bankIcon: 'AMEX',
            networkIcon: 'AMEX',
            // Legacy branding fields
            bankCode: 'AMEX',
            institution: 'AMEX',
            brand: 'AMEX',
            id: 'CC-AMEX'
        };
        console.warn('🏁 [AMEX] Extraction Phase Complete. Card:', metadata.accountNumber);

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

        // NEW APPROACH: Amex PDFs have fragmented structure
        // - Description lines: "Mar 21 Mar 21 AMZN MKTP CA*H72MJ7G40  WWW.AMAZON.CA"
        // - Amount-only lines: "142.12"
        // - Need to collect both separately and match by position

        const descriptionLines = [];
        const amountLines = [];
        let collectDescriptions = false;
        let collectAmounts = false;

        // Store for debugging
        window._lastAmexText = statementText;

        // Date regex: "Nov 28   Nov 29   DESCRIPTION" or "Nov 28 Nov 29 DESCRIPTION"
        const dateRegex = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(.+)/i;
        const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

        console.log('%c[AMEX-DEBUG] Starting dual-phase scan...', 'color: orange; font-weight: bold');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // PHASE 1: Start collecting amounts after "New Transactions for" or "New Payments"
            if (line.match(/New Transactions for|New Payments/i)) {
                console.log(`%c✅ AMOUNTS: Line ${i}`, 'color: green; font-weight: bold', line.substring(0, 60));
                collectAmounts = true;
                collectDescriptions = false;
                continue;
            }

            // PHASE 2: Start collecting descriptions after "@" marker
            if (line.trim() === '@') {
                console.log(`%c📍 DESCRIPTIONS: Line ${i} (@)`, 'color: blue; font-weight: bold');
                collectDescriptions = true;
                collectAmounts = false;
                continue;
            }

            // Stop at page boundaries or totals
            if (line.match(/^Page \d+|Total of (?:New Transactions|Payment Activity)/i)) {
                if (collectAmounts || collectDescriptions) {
                    console.log(`%c🛑 STOP: Line ${i}`, 'color: red', line.substring(0, 60));
                }
                collectAmounts = false;
                collectDescriptions = false;
                continue;
            }

            // Collect amounts (phase 1: after "New Transactions for", before "@")
            if (collectAmounts && line.match(/^-?[\d,]+\.\d{2}$/)) {
                const amount = parseFloat(line.replace(/,/g, ''));
                amountLines.push(amount);
                console.log(`%c💰 AMT ${amountLines.length}: Line ${i}`, 'color: purple', amount);
            }

            // Collect descriptions (phase 2: after "@", with date pattern)
            if (collectDescriptions) {
                const dateMatch = line.match(dateRegex);
                if (dateMatch) {
                    const month = monthMap[dateMatch[1].toLowerCase()];
                    const day = dateMatch[2].padStart(2, '0');
                    const description = dateMatch[5].trim();
                    descriptionLines.push({
                        date: `${currentYear}-${month}-${day}`,
                        description,
                        rawLine: line
                    });
                    console.log(`%c📅 DESC ${descriptionLines.length}: Line ${i}`, 'color: blue', line.substring(0, 80));
                }
            }
        }

        // Match descriptions with amounts by position
        console.log(`[AMEX] Found ${descriptionLines.length} descriptions, ${amountLines.length} amounts`);

        const minLen = Math.min(descriptionLines.length, amountLines.length);
        for (let i = 0; i < minLen; i++) {
            const desc = descriptionLines[i];
            const amount = Math.abs(amountLines[i]);
            const isPayment = amountLines[i] < 0 || desc.description.match(/PAYMENT|THANK YOU/i);

            transactions.push({
                date: desc.date,
                description: this.cleanCreditDescription(desc.description, [
                    "PAYMENT THANK YOU", "PURCHASE", "CASH ADVANCE",
                    "INTEREST CHARGE", "MEMBERSHIP FEE", "LATE FEE"
                ]),
                amount,
                debit: isPayment ? 0 : amount,
                credit: isPayment ? amount : 0,
                balance: 0,
                audit: this.getSpatialMetadata(desc.description),
                rawText: this.cleanRawText(`${desc.date} ${desc.description} ${amount}`),
                refCode: desc.description.match(/\b([A-Z0-9]{15,})\b/)?.[1] || 'N/A'
            });
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
