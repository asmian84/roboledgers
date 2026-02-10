/**
 * TD Visa Parser
 * Regex-based parser for TD Visa credit card statements
 */
class TDVisaParser extends BaseBankParser {
    constructor() {
        const formatRules = `
TD VISA FORMAT:
- Date format: MMM DD (e.g., JAN 05, FEB 15)
- Credit card: Debit = charges (increase balance), Credit = payments (decrease balance)
- Common transactions: PAYMENT THANK YOU, PURCHASE, CASH ADVANCE, INTEREST CHARGE
    `;
        super('TD', 'Visa', formatRules);
    }

    /**
     * Parse TD Visa statement using regex
     */
    async parse(statementText, metadata = null, lineMetadata = []) {
        this.lastLineMetadata = lineMetadata;
        // LOUD DIAGNOSTIC
        console.warn('⚡ [EXTREME-TD-VISA] Starting metadata extraction for TD Visa...');
        console.error('📄 [DEBUG-TD-VISA] First 1000 characters (RED for visibility):');
        console.log(statementText.substring(0, 1000));

        const lines = statementText.split('\n');
        const transactions = [];

        // EXTRACT METADATA - Account number from masked card format
        // TD format: "4520 70XX XXXX 7298" or "Account Number: 4520 70XX XXXX 7298"
        let accountNumber = '-----';

        // Try to extract from masked card number format
        const maskedMatch = statementText.match(/(?:Account\s+Number[:\s]+)?[\dX]{4}\s+[\dX]{2,4}\s+[\dX]{4}\s+(\d{4})/i);
        if (maskedMatch) {
            accountNumber = maskedMatch[1]; // Last 4 digits
            console.log(`[TD-VISA] Extracted last 4 from masked: ${accountNumber}`);
        } else {
            // Fallback: Try full account number
            const fullMatch = statementText.match(/(?:Account\s+Number)[:\s]+(\d{7,})/i);
            if (fullMatch) {
                accountNumber = fullMatch[1];
                console.log(`[TD-VISA] Extracted full account: ${accountNumber}`);
            }
        }

        // Extract opening balance (Previous Balance for credit cards)
        let openingBalance = null;
        const openingMatch = statementText.match(/(Opening|Previous) Balance.*?\$?([\d,]+\.\d{2})/i);
        if (openingMatch) {
            openingBalance = parseFloat(openingMatch[2].replace(/,/g, ''));
            console.log(`[TD-VISA] Extracted opening balance: ${openingBalance}`);
        }

        const parsedMetadata = {
            _acct: accountNumber,
            accountNumber: accountNumber,
            _tag: 'Visa',
            cardNetwork: 'Visa',
            accountType: 'CreditCard',
            bankName: 'TD',
            openingBalance: openingBalance
        };
        console.warn('🏁 [TD-VISA] Extraction Phase Complete. Transit:', parsedMetadata.transit, 'Acct:', parsedMetadata.accountNumber);

        const yearMatch = statementText.match(/20\d{2}/);
        const currentYear = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

        // TD Visa has TWO dates per line: TRANSACTION DATE + POSTING DATE
        // Format: "AUG 10       AUG 12   KILKENNY PUB CALGARY             $146.59"
        const dateRegex = /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{1,2})/i;
        const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Skip headers, balances, page numbers
            if (!trimmed || trimmed.length < 10) continue;
            if (trimmed.match(/Opening Balance|Previous|PREVIOUS|Page \d|TRANSACTION.*DATE|AMOUNT\(\$\)|Continued|STATEMENT/i)) continue;

            // Try to match TWO dates at the start of line
            // Pattern: "AUG 10       AUG 12   DESCRIPTION   $146.59"
            const firstDateMatch = trimmed.match(dateRegex);
            if (!firstDateMatch) continue;

            // Remove first date, look for second date
            const afterFirstDate = trimmed.substring(firstDateMatch[0].length).trim();
            const secondDateMatch = afterFirstDate.match(dateRegex);

            if (!secondDateMatch) continue; // TD Visa MUST have two dates

            // Use posting date (second date) as the transaction date
            const postingDate = `${currentYear}-${monthMap[secondDateMatch[1].toLowerCase()]}-${secondDateMatch[2].padStart(2, '0')}`;

            // Everything after the second date is: DESCRIPTION + AMOUNT
            const remainder = afterFirstDate.substring(secondDateMatch[0].length).trim();

            // Extract transaction from remainder
            const extracted = this.extractTransaction(remainder, postingDate, line);
            if (extracted && extracted.amount) {
                transactions.push(extracted);
            }
        }

        console.log(`[TD-VISA] Parsed ${transactions.length} transactions`);
        return { transactions, metadata: parsedMetadata };
    }

    extractTransaction(text, isoDate, originalLine) {
        console.log(`[TD-VISA-EXTRACT] Input text: "${text}"`);
        console.log(`[TD-VISA-EXTRACT] Date: ${isoDate}`);

        const amounts = text.match(/([\d,]+\.\d{2})/g);
        if (!amounts || amounts.length < 1) {
            console.log(`[TD-VISA-EXTRACT] No amounts found, skipping`);
            return null;
        }

        console.log(`[TD-VISA-EXTRACT] Found amounts:`, amounts);

        const firstAmtIdx = text.search(/[\d,]+\.\d{2}/);
        let description = text.substring(0, firstAmtIdx).trim();

        console.log(`[TD-VISA-EXTRACT] Raw description: "${description}"`);

        description = this.cleanCreditDescription(description, [
            "PAYMENT THANK YOU", "PURCHASE", "CASH ADVANCE",
            "INTEREST CHARGE", "ANNUAL FEE", "FOREIGN TRANSACTION FEE"
        ]);

        console.log(`[TD-VISA-EXTRACT] Cleaned description: "${description}"`);

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
            _brand: 'TD',
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
                if (name) {
                    desc = `${name}, ${type.charAt(0) + type.slice(1).toLowerCase()}`;
                }
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

window.TDVisaParser = TDVisaParser;
window.tdVisaParser = new TDVisaParser();
