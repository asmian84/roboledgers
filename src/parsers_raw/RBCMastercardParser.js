/**
 * RBC Mastercard Parser
 * Regex-based parser for RBC Mastercard statements
 * 
 * VERSION: 3.0 (Calibrated for User Statement Logic)
 */
class RBCMastercardParser extends BaseBankParser {
    constructor() {
        const formatRules = `
RBC MASTERCARD FORMAT:
- Date format: MMM DD (e.g. OCT 11)
- Amount format: $123.45 or -$123.45 (Negative = Payment/Debit, Positive = Expense/Credit)
- Transaction types: PAYMENT, PURCHASE, CASH ADVANCE, INTEREST, ANNUAL FEE
    `;
        super('RBC', 'Mastercard', formatRules);
    }

    async parse(statementText, metadata = null, lineMetadata = []) {
        this.lastLineMetadata = lineMetadata;
        console.warn('⚡ [RBC-MC] Starting CALIBRATED extraction...');

        const lines = statementText.split('\n');
        // Extract balances using base helper
        const { openingBalance, closingBalance, statementPeriod } = this.extractBalances(statementText);

        const transactions = [];
        let currentYear = new Date().getFullYear();

        // 1. Year Detection
        const periodMatch = statementText.match(/STATEMENT FROM.*?(\d{4})/i);
        if (periodMatch) currentYear = parseInt(periodMatch[1]);

        // 2. Metadata Detection - Full masked card (IIN: 16 digits for Mastercard)
        let acctMatch = statementText.match(/([5]\d{3}[\s-]+\d{2}\*\*[\s-]+\*{4}[\s-]+\d{4})/i) ||
            statementText.match(/(\d{4}[\s-]+\d{2}\*\*[\s-]+\*{4}[\s-]+\d{4})/i);

        const rawAcct = acctMatch ? acctMatch[1].replace(/-/g, ' ') : 'XXXX XXXX XXXX XXXX'; // Normalize to spaces

        const parsedMetadata = {
            _acct: rawAcct,
            accountNumber: rawAcct, // Full masked format for display
            _tag: 'Mastercard',
            cardNetwork: 'Mastercard',
            accountType: 'CreditCard',
            bankName: 'RBC',
            // Dual-icon system
            bankIcon: 'RBC',
            networkIcon: 'MC',
            // Legacy branding
            brand: 'MC',
            bankCode: 'MC',
            institution: 'MC'
            // NO transit, NO institutionCode - these are for bank accounts only
        };

        const monthMap = {
            jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
            'jan.': '01', 'feb.': '02', 'mar.': '03', 'apr.': '04', 'may.': '05', 'jun.': '06', 'jul.': '07', 'aug.': '08', 'sep.': '09', 'oct.': '10', 'nov.': '11', 'dec.': '12'
        };

        const dateStartRegex = /^\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z.]*\s+(\d{1,2})/i;

        let pending = null;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line || /Opening Balance|Previous Balance|Page \d/i.test(line)) continue;

            const dateMatch = line.match(dateStartRegex);

            if (dateMatch) {
                // Save previous pending if complete
                if (pending && pending.amountFound) {
                    transactions.push(this.finalizeTransaction(pending));
                }
                pending = null;

                const monthName = dateMatch[1].toLowerCase().substring(0, 3);
                const day = dateMatch[2].padStart(2, '0');
                const isoDate = `${currentYear}-${monthMap[monthName] || '01'}-${day}`;

                pending = {
                    date: isoDate,
                    rawDescLines: [line],
                    amountFound: false,
                    rawAmt: null,
                    fullRaw: line
                };

                // Look for amount: $123.45 or -$123.45 (RBC puts it at end)
                const amtMatch = line.match(/(-?\$?[\d,]+\.\d{2}-?)/);
                if (amtMatch) {
                    pending.amountFound = true;
                    pending.rawAmt = amtMatch[0];
                }
            }
            else if (pending) {
                const looseAmtMatch = line.match(/(-?\$?[\d,]+\.\d{2}-?)/);

                if (!pending.amountFound && looseAmtMatch) {
                    pending.amountFound = true;
                    pending.rawAmt = looseAmtMatch[0];
                    pending.rawDescLines.push(line);
                    pending.fullRaw += '\n' + line;
                } else if (!pending.amountFound) {
                    if (line.length > 2 && !line.includes("RBC ROYAL BANK") && !line.includes("PAGE ")) {
                        pending.rawDescLines.push(line);
                        pending.fullRaw += '\n' + line;
                    }
                }
            }
        }

        if (pending && pending.amountFound) {
            transactions.push(this.finalizeTransaction(pending));
        }

        console.log(`[RBC-MC] Parsed ${transactions.length} transactions`);
        return { transactions, metadata: parsedMetadata, openingBalance, closingBalance, statementPeriod };
    }

    finalizeTransaction(pending) {
        // 1. Combine Description Lines
        let fullDesc = pending.rawDescLines.join(" ");

        // 2. Remove Amounts from Desc
        if (pending.rawAmt) {
            const escapedAmt = pending.rawAmt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            fullDesc = fullDesc.replace(new RegExp(escapedAmt, 'g'), '');
        }

        // 3. FOOLPROOF Date Stripping (MMM DD)
        const globalDateRegex = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z.]*\s+\d{1,2}\b/gi;
        fullDesc = fullDesc.replace(globalDateRegex, '').replace(/[ \t]+/g, ' ').trim();

        // 4. Aggressive Cleaning (Garbage Removal)
        // a. Strip Province codes (AB, BC, etc.)
        const provinceRegex = /\b(AB|BC|MB|NB|NL|NS|ON|PE|QC|SK|NT|NU|YT)\b/gi;

        // b. Strip Reference Numbers (10+ digits or long trailing numbers)
        fullDesc = fullDesc.replace(/\d{10,}/g, '');
        fullDesc = fullDesc.replace(/\d{6,}$/g, ''); // Trailing 6+ digits often codes

        // c. Strip trailing City/Province patterns
        // Heuristic: Word followed by a recognized province code at the end
        const cityProvRegex = /[A-Z]{3,}\s+(?:AB|BC|MB|NB|NL|NS|ON|PE|QC|SK|NT|NU|YT)\b/gi;
        fullDesc = fullDesc.replace(cityProvRegex, '');
        fullDesc = fullDesc.replace(provinceRegex, '');

        // d. Strip common RBC Suffixes
        fullDesc = fullDesc.replace(/\s+(Purchase|Cash Advance|Interest|Payment)$/gi, '');

        // e. Final cleanup
        fullDesc = fullDesc.replace(/\d{4}\s\d{2}\*\*\s\*\*\*\*\s\d{4}/g, ''); // Masked card
        fullDesc = fullDesc.replace(/[#$]/g, '');
        fullDesc = fullDesc.replace(/^[ \t,\-]+|[ \t,\-]+$/g, '').replace(/[ \t]+/g, ' ').trim();

        // 5. Categorize Type
        let type = "Purchase";
        let cleanDesc = fullDesc;
        const upper = fullDesc.toUpperCase();

        if (upper.includes("PAYMENT") && (upper.includes("THANK YOU") || upper.includes("MERCI"))) {
            type = "Payment";
            cleanDesc = "Payment - Thank You";
        } else if (upper.includes("COSTCO")) {
            cleanDesc = "Costco Wholesale";
        } else if (upper.includes("AMAZON") || upper.includes("AMZN")) {
            cleanDesc = "Amazon";
        } else if (upper.includes("CASH BACK REWARD")) {
            type = "Reward";
            cleanDesc = "Cash Back Reward";
        } else if (upper.startsWith("INTEREST")) {
            type = "Fee";
            cleanDesc = "Interest Charge";
        } else if (upper.includes("FEE")) {
            type = "Fee";
            cleanDesc = cleanDesc.replace(/FEE/gi, '').trim() || "Bank Fee";
        }

        // 6. DEBIT/CREDIT Logic (User Validated)
        // RBC: "-$100.00" or "$100.00-" is a PAYMENT -> DEBIT
        // RBC: "$100.00" is a PURCHASE -> CREDIT

        let valStr = pending.rawAmt.replace(/[$,]/g, '');
        let isNegative = false;

        if (valStr.endsWith('-')) {
            isNegative = true;
            valStr = valStr.slice(0, -1);
        } else if (valStr.startsWith('-')) {
            isNegative = true;
            valStr = valStr.slice(1);
        }

        const value = parseFloat(valStr);
        let debit = 0;
        let credit = 0;

        if (isNegative) {
            // Payment/Refund -> MONEY IN -> CREDIT
            credit = value;
            if (type === "Purchase") type = "Refund";
        } else {
            // Expense -> MONEY OUT -> DEBIT
            debit = value;
        }

        // 7. ENSURE 2-LINE FORMAT
        // The grid expects 'Description\nType'
        const finalDescription = `${cleanDesc}\n${type}`;

        return {
            date: pending.date,
            description: finalDescription,
            amount: value,
            debit: debit,
            credit: credit,
            Debit: debit,
            Credit: credit,
            balance: 0,
            _brand: 'RBC',
            _bank: 'RBC Mastercard',
            _tag: 'Mastercard',
            _accountType: 'CreditCard',
            _inst: '003',
            _transit: '00000',
            _acct: pending.accountNumber || '',
            rawText: pending.fullRaw,
            audit: this.getSpatialMetadata(pending.rawDescLines[0])
        };
    }
}

window.RBCMastercardParser = RBCMastercardParser;
window.rbcMastercardParser = new RBCMastercardParser();
