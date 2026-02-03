/**
 * BMO Credit Card Parser
 * LIABILITY account - Debit increases balance, Credit decreases balance
 */
class BMOCreditCardParser extends BaseBankParser {
    constructor() {
        super('BMO', 'CreditCard', 'BMO Credit Card - Liability account');
    }

    async parse(statementText, metadata = null, lineMetadata = []) {
        this.lastLineMetadata = lineMetadata;
        const lines = statementText.split('\n');
        const transactions = [];
        let currentYear = new Date().getFullYear();

        // Extract year
        const yearMatch = statementText.match(/(\d{4})/);
        if (yearMatch) currentYear = parseInt(yearMatch[1]);

        // Date: "Apr 01", "May 16"
        const dateRegex = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d{1,2})/i;
        const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.match(/Opening|Balance forward|Page \d/i)) continue;

            const dateMatch = line.match(dateRegex);
            if (!dateMatch) continue;

            const isoDate = `${currentYear}-${monthMap[dateMatch[1].toLowerCase()]}-${dateMatch[2].padStart(2, '0')}`;
            const remainder = line.substring(dateMatch[0].length).trim();

            // Find amounts
            const amounts = remainder.match(/([\d,]+\.\d{2})/g);
            if (!amounts || amounts.length < 1) continue;

            // Description
            const firstAmt = remainder.search(/[\d,]+\.\d{2}/);
            const description = remainder.substring(0, firstAmt).trim();
            if (!description) continue;

            // Credit card: positive = charge (debit), negative = payment (credit)
            const amount = parseFloat(amounts[0].replace(/,/g, ''));
            const balance = amounts.length > 1 ? parseFloat(amounts[amounts.length - 1].replace(/,/g, '')) : 0;

            // Determine type by keywords
            const isPayment = /payment|credit|refund/i.test(description);

            transactions.push({
                date: isoDate,
                description,
                amount,
                debit: isPayment ? 0 : amount,   // Charge = debit (balance up)
                credit: isPayment ? amount : 0,  // Payment = credit (balance down)
                balance,
                _brand: 'BMO',
                _tag: 'CreditCard',
                _accountType: 'CreditCard', // [NEW] Explicit liability flagging
                rawText: this.cleanRawText(line),
                audit: this.getSpatialMetadata(line)
            });
        }

        console.log(`[BMO-CC] Parsed ${transactions.length} transactions`);
        return { transactions };
    }
}

window.BMOCreditCardParser = BMOCreditCardParser;
window.bmoCreditCardParser = new BMOCreditCardParser();
