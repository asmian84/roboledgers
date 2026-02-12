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
                // Extract balances using base helper
        const { openingBalance, closingBalance, statementPeriod } = this.extractBalances(statementText);

        const transactions = [];

        // EXTRACT METADATA - Full masked card number (IIN standard: 16 digits for Visa)
        // TD format: "4520 70XX XXXX 7298" or "Account Number: 4520 70XX XXXX 7298"
        let accountNumber = 'XXXX XXXX XXXX XXXX'; // Default fallback

        // Extract full 16-digit masked card number (Visa standard)
        const maskedMatch = statementText.match(/(?:Account\s+Number[:\s]+)?([4-6]\d{3}\s+[X\d]{2,4}\s+[X\d]{4}\s+\d{4})/i);
        if (maskedMatch) {
            accountNumber = maskedMatch[1]; // Full masked format: "4520 70XX XXXX 7298"
            console.log(`[TD-VISA] Extracted full masked card: ${accountNumber}`);
        } else {
            // Fallback: Try unformatted (no spaces)
            const unformattedMatch = statementText.match(/(?:Account\s+Number[:\s]+)?([4-6]\d{3}[X\d]{8}\d{4})/i);
            if (unformattedMatch) {
                const raw = unformattedMatch[1];
                // Format as XXXX XXXX XXXX XXXX
                accountNumber = raw.match(/.{1,4}/g).join(' ');
                console.log(`[TD-VISA] Extracted and formatted: ${accountNumber}`);
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
            // Dual-icon system
            bankIcon: 'TD',
            networkIcon: 'VISA',
            // Legacy branding
            brand: 'VISA',
            bankCode: 'VISA',
            institution: 'VISA',
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
        return { transactions, metadata: parsedMetadata , openingBalance, closingBalance, statementPeriod };
    }

    extractTransaction(text, isoDate, originalLine) {
        // TD format: Amount comes FIRST, then description
        // Example: "$99.56 FiverrEU Nicosia" or "-$1.00 ROYAL BANK OF CANADA"
        const amounts = text.match(/(-?\$?[\d,]+\.\d{2})/g);
        if (!amounts || amounts.length < 1) {
            return null;
        }

        // Find where the first amount ENDS (not starts!)
        const firstAmountMatch = text.match(/(-?\$?[\d,]+\.\d{2})/);
        const amountEndIdx = firstAmountMatch.index + firstAmountMatch[0].length;

        // Description is everything AFTER the first amount
        let description = text.substring(amountEndIdx).trim();

        // Clean up the description
        description = this.cleanCreditDescription(description, [
            "PAYMENT THANK YOU", "PURCHASE", "CASH ADVANCE",
            "INTEREST CHARGE", "ANNUAL FEE", "FOREIGN TRANSACTION FEE"
        ]);

        // Parse amount (remove $ and - signs, keep just the number)
        const amountStr = amounts[0].replace(/[\$-]/g, '');
        const amount = parseFloat(amountStr.replace(/,/g, ''));
        const isNegative = amounts[0].includes('-');
        const isPayment = /payment|credit|refund/i.test(description) || isNegative;

        return {
            date: isoDate,
            description: description || 'Transaction',
            amount,
            debit: isPayment ? amount : 0,    // Payments REDUCE liability (debit)
            credit: isPayment ? 0 : amount,   // Purchases INCREASE liability (credit)
            balance: 0,
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
