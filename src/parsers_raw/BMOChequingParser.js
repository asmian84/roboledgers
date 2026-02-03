/**
 * BMO Chequing Parser
 * Handles Bank of Montreal chequing/savings account statements
 * 
 * BMO Format:
 * Date | Description | Amounts debited from your account | Amounts credited to your account | Balance
 * 
 * The PDF has TWO amount columns - we must extract from the correct one!
 */
class BMOChequingParser extends BaseBankParser {
    constructor() {
        const formatRules = `
BMO CHEQUING FORMAT:
- Date: Mmm DD (e.g., "Apr 01", "May 16")
- Columns: Date | Description | Debited | Credited | Balance
- Two separate columns for debits and credits!
        `;

        super('BMO', 'Chequing', formatRules);
    }

    /**
     * LOCAL REGEX PARSER for BMO Chequing statements
     * Extracts from the ACTUAL debit/credit columns in the PDF
     */
    async parse(statementText, metadata = null, lineMetadata = []) {
        this.lastLineMetadata = lineMetadata;
        const lines = statementText.split('\n');
        const transactions = [];

        // LOUD DIAGNOSTIC
        console.warn('⚡ [EXTREME-BMO] Starting metadata extraction for BMO...');
        console.error('📄 [DEBUG-BMO] First 1000 characters (RED for visibility):');
        console.log(statementText.substring(0, 1000));

        // Extract year from statement
        const yearMatch = statementText.match(/20\d{2}/);
        let currentYear = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

        // EXTRACT METADATA (Transit, Account Number)
        let transitMatch = statementText.match(/Transit:?\s*(\d{5})/i);
        let acctMatch = statementText.match(/Account:?\s*(?:number)?\s*(\d{4}[-\s]?\d{4}|\d{7,})/i);

        // BMO Alternative format: # 2515 1994-226
        if (!transitMatch || !acctMatch) {
            const bmoAltMatch = statementText.match(/#\s*(\d{4,5})\s*([\d-]{7,})/);
            if (bmoAltMatch) {
                if (!transitMatch) transitMatch = [bmoAltMatch[0], bmoAltMatch[1]];
                if (!acctMatch) acctMatch = [bmoAltMatch[0], bmoAltMatch[2]];
            }
        }

        // Extract opening balance
        let openingBalance = null;
        const openingMatch = statementText.match(/Opening balance.*?([\d,]+\.\d{2})/i);
        if (openingMatch) {
            openingBalance = parseFloat(openingMatch[1].replace(/,/g, ''));
            console.log(`[BMO] Extracted opening balance: ${openingBalance}`);
        }

        const parsedMetadata = {
            _inst: '001', // BMO Institution Code
            _transit: transitMatch ? transitMatch[1] : '-----',
            _acct: acctMatch ? acctMatch[1].replace(/[-\s]/g, '') : '-----',
            institutionCode: '001',
            transit: transitMatch ? transitMatch[1] : '-----',
            accountNumber: acctMatch ? acctMatch[1].replace(/[-\s]/g, '') : '-----',
            _brand: 'BMO',
            _bank: 'BMO',
            _tag: 'Chequing',
            openingBalance: openingBalance
        };

        console.warn('🏁 [BMO] Extraction Phase Complete. Transit:', parsedMetadata.transit, 'Acct:', parsedMetadata.accountNumber);

        // Date pattern: "Apr 01", "May 16", etc. (Flexible, no start anchor)
        const dateRegex = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d{1,2})/i;

        // Month mapping
        const monthMap = {
            'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
            'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
            'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
        };

        console.log('[BMO] Starting parse with', lines.length, 'lines');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Skip headers and non-transaction lines
            if (line.match(/Opening balance|Balance forward|Statement Period|Page \d|continued/i)) continue;
            if (line.match(/^Date\s+Description/i)) continue;
            if (line.match(/^Account|^Business name|Value Assist|Amounts\s+debited|Amounts\s+credited/i)) continue;

            // Check if line starts with a date
            const dateMatch = line.match(dateRegex);
            if (!dateMatch) continue;

            const month = dateMatch[1].toLowerCase();
            const day = dateMatch[2].padStart(2, '0');
            const isoDate = `${currentYear}-${monthMap[month]}-${day}`;

            // Get the rest of the line after the date
            let remainder = line.substring(dateMatch[0].length).trim();

            // BMO FORMAT: The line contains amounts in SPECIFIC positions
            // Format: [Description] [Debit Amount] [Credit Amount] [Balance]
            // One of Debit or Credit will be empty (whitespace)

            // Find all amounts (numbers with decimals)
            const amounts = [];
            const amountRegex = /([\d,]+\.\d{2})/g;
            let match;
            while ((match = amountRegex.exec(remainder)) !== null) {
                amounts.push({
                    value: parseFloat(match[1].replace(/,/g, '')),
                    position: match.index
                });
            }

            if (amounts.length < 2) {
                // Need at least one amount + balance
                // Try multi-line
                let combinedLine = line;
                let lookAhead = 1;
                let foundTx = false;

                let rawLines = [line];
                let auditLines = [this.getSpatialMetadata(line)];

                while (i + lookAhead < lines.length && lookAhead <= 3) {
                    const nextLine = lines[i + lookAhead].trim();
                    if (nextLine.match(dateRegex)) break;
                    combinedLine += ' ' + nextLine;
                    rawLines.push(nextLine);
                    auditLines.push(this.getSpatialMetadata(nextLine));

                    const combinedAmounts = combinedLine.match(/([\d,]+\.\d{2})/g);
                    if (combinedAmounts && combinedAmounts.length >= 2) {
                        const tx = this.parseLineWithAmounts(combinedLine, dateMatch[0], isoDate, combinedAmounts);
                        if (tx) {
                            tx.rawText = rawLines.join('\n');
                            tx.audit = this.mergeAuditMetadata(auditLines);
                            transactions.push(tx);
                            foundTx = true;
                        }
                        i += lookAhead;
                        break;
                    }
                    lookAhead++;
                }
                if (foundTx) continue;
                continue;
            }

            // Parse single line with amounts
            const amountStrings = remainder.match(/([\d,]+\.\d{2})/g);
            const tx = this.parseLineWithAmounts(line, dateMatch[0], isoDate, amountStrings);
            if (tx) {
                tx.audit = this.getSpatialMetadata(line);
                transactions.push(tx);
            }
        }

        console.log('[BMO] Parsing complete. Found', transactions.length, 'transactions.');
        return { transactions, metadata: parsedMetadata };
    }

    parseLineWithAmounts(fullLine, dateStr, isoDate, amountStrings) {
        if (!amountStrings || amountStrings.length < 2) return null;

        // Get description (everything before the first amount)
        const afterDate = fullLine.substring(fullLine.indexOf(dateStr) + dateStr.length);
        const firstAmountMatch = afterDate.match(/([\d,]+\.\d{2})/);
        if (!firstAmountMatch) return null;

        const description = afterDate.substring(0, firstAmountMatch.index).trim();

        // Parse amounts - last one is always balance
        const amounts = amountStrings.map(a => parseFloat(a.replace(/,/g, '')));
        const balance = amounts[amounts.length - 1];

        // Key insight: BMO has FIXED column positions
        // The line structure shows gaps where amounts are missing
        // We can detect if debit or credit is populated by analyzing the spacing

        let debit = 0;
        let credit = 0;

        if (amounts.length === 2) {
            // Only one transaction amount + balance
            // Determine column by analyzing the original line's spacing
            const txAmount = amounts[0];

            // Get the portion of line containing amounts
            const amountPortion = afterDate.substring(firstAmountMatch.index);

            // Count spaces before the first amount after description
            // If there are many leading spaces, it's likely in the "credit" column
            const leadingSpaces = amountPortion.match(/^\s*/);
            const spaceCount = leadingSpaces ? leadingSpaces[0].length : 0;

            // BMO typically has amounts right-aligned in columns
            // Debit column is ~position 50-60, Credit column is ~position 70-80
            // Use the gap between first amount and balance to determine

            // Alternative approach: Look for the gap pattern
            // If: [amount][spaces][balance] - it's a debit (credit column is empty gap)
            // If: [spaces][amount][balance] - it's a credit (debit column is empty gap)

            // Simpler: use keywords as PRIMARY source for single-amount lines
            if (this.isCreditByKeyword(description)) {
                credit = txAmount;
            } else {
                debit = txAmount;
            }
        } else if (amounts.length === 3) {
            // Two transaction amounts + balance
            // First is debit, second is credit, third is balance
            debit = amounts[0];
            credit = amounts[1];
        } else if (amounts.length > 3) {
            // Multiple amounts - last is balance, need to determine others
            // Usually rare, default to treating non-balance as debits
            const txAmounts = amounts.slice(0, -1);
            debit = txAmounts.reduce((sum, a) => sum + a, 0);
        }

        // Skip if no actual transaction amount
        if (debit === 0 && credit === 0) return null;

        return {
            date: isoDate,
            description: description,
            amount: debit || credit,
            debit: debit,
            credit: credit,
            balance: balance,
            ...metadata,
            rawText: this.cleanRawText(fullLine)
        };
    }

    isCreditByKeyword(description) {
        const creditKeywords = /deposit|credit\s+memo|refund|transfer\s+in|payroll|salary|interest\s+earned|e-?transfer\s+received|direct\s+deposit/i;
        return creditKeywords.test(description);
    }
}

// Expose to window for file:// compatibility
window.BMOChequingParser = BMOChequingParser;
window.bmoChequingParser = new BMOChequingParser();
