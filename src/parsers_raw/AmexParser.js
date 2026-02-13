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
            // Amex displays single full-height logo (NOT dual-icon split)
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
        let openingBalanceCoords = null;
        const previousBalanceMatch = statementText.match(/Previous\s+Balance\s+.*?([\d,]+\.\d{2})/i);
        if (previousBalanceMatch) {
            openingBalance = parseFloat(previousBalanceMatch[1].replace(/,/g, ''));
            console.log(`[AMEX] Extracted opening balance: ${openingBalance}`);

            // Find exact coordinates from lineMetadata
            if (lineMetadata && lineMetadata.length > 0) {
                const balanceLine = lineMetadata.find(line =>
                    line.text && line.text.toLowerCase().includes('previous balance')
                );
                if (balanceLine) {
                    openingBalanceCoords = {
                        page: balanceLine.page || 1,
                        y: balanceLine.y,
                        height: balanceLine.height || 12,
                        width: 500  // Approx width to show full balance line
                    };
                    console.log(`[AMEX] Found opening balance coords:`, openingBalanceCoords);
                }
            }
        }

        // Extract closing balance (New Balance or Closing Balance)
        let closingBalance = 0;
        let closingBalanceCoords = null;
        const closingBalanceMatch = statementText.match(/(?:New Balance|Closing Balance|Balance on [A-Za-z]+ \d{1,2}, \d{4})\s+.*?([\d,]+\.\d{2})/i) ||
            statementText.match(/Closing balance on [A-Za-z]+\s+\d{1,2},\s+\d{4}\s+.*?\$([\d,]+\.\d{2})/i);
        if (closingBalanceMatch) {
            closingBalance = parseFloat(closingBalanceMatch[1].replace(/,/g, ''));
            console.log(`[AMEX] Extracted closing balance: ${closingBalance}`);

            // Find exact coordinates from lineMetadata
            if (lineMetadata && lineMetadata.length > 0) {
                const balanceLine = lineMetadata.find(line =>
                    line.text && (
                        line.text.toLowerCase().includes('new balance') ||
                        line.text.toLowerCase().includes('closing balance')
                    )
                );
                if (balanceLine) {
                    closingBalanceCoords = {
                        page: balanceLine.page || 1,
                        y: balanceLine.y,
                        height: balanceLine.height || 12,
                        width: 500
                    };
                    console.log(`[AMEX] Found closing balance coords:`, closingBalanceCoords);
                }
            }
        }

        // Extract statement period
        let statementPeriod = '';
        let statementId = `AMEX-${currentYear}`;
        const periodMatch = statementText.match(/Statement Period:?\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})\s+to\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i) ||
            statementText.match(/([A-Za-z]+\s+\d{1,2},\s+\d{4})\s+to\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
        if (periodMatch) {
            statementPeriod = `${periodMatch[1]} - ${periodMatch[2]}`;
            // Extract month from end date for statement ID (AMEX-2022NOV)
            const endDateMatch = periodMatch[2].match(/([A-Za-z]+)\s+\d{1,2},\s+(\d{4})/);
            if (endDateMatch) {
                const month = endDateMatch[1].toUpperCase().substring(0, 3);
                const year = endDateMatch[2];
                statementId = `AMEX-${year}${month}`;
                console.log(`[AMEX] Generated statement ID: ${statementId}`);
            }
            console.log(`[AMEX] Extracted statement period: ${statementPeriod}`);
        }

        // NEW APPROACH: Amex PDFs have fragmented structure
        // - Description lines: "Mar 21 Mar 21 AMZN MKTP CA*H72MJ7G40  WWW.AMAZON.CA"
        // - Amount-only lines: "142.12"
        // - Need to collect both separately and match by position

        let descriptionLines = [];
        let amountLines = [];
        let collectDescriptions = false;
        let collectAmounts = false;

        // Store for debugging
        window._lastAmexText = statementText;

        // Date regex: "Nov 28   Nov 29   DESCRIPTION" or "Nov 28 Nov 29 DESCRIPTION"
        const dateRegex = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(.+)/i;
        const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

        console.log('%c[AMEX-DEBUG] Starting dual-phase scan...', 'color: orange; font-weight: bold');

        // DUAL-PHASE: First scan for section boundaries and collect FX lines separately
        console.log('[AMEX-DEBUG] Starting dual-phase scan...');
        let currentSection = null;
        const sections = [];
        const fxLines = []; // NEW: Collect FX lines separately for later matching

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Detect start of transaction section (positive lookahead)
            if (line.match(/^New (Transactions|Purchases|Payments)/i)) {
                console.log(`%c✅ START SECTION ${sections.length + 1}: Line ${i} ${line}`, 'background: green; color: white; padding: 2px;');
                if (currentSection) {
                    sections.push(currentSection);
                }
                currentSection = {
                    startLine: i,
                    startText: line,
                    descriptions: [],
                    amounts: []
                };
            }

            // Detect end of transaction section
            if (line.match(/^Total of/i) && currentSection) {
                console.log(`%c🛑 STOP SECTION ${sections.length + 1}: Line ${i} ${line}`, 'background: red; color: white; padding: 2px;');
                currentSection.endLine = i;
                currentSection.endText = line;
                sections.push(currentSection);
                currentSection = null;
                continue;
            }

            // Capture FX lines ANYWHERE in the document (not just in sections)
            const fxPattern = /(?:UNITED STATES|CANADIAN|EUROS?|POUNDS?|YEN)\s+(?:DOLLAR|POUND|EUR)\s+([\d,]+\.?\d*)\s+([@\d.]+)/i;
            const fxMatch = line.match(fxPattern);
            if (fxMatch) {
                const usdAmount = parseFloat(fxMatch[1].replace(/,/g, ''));
                const rateStr = fxMatch[2].replace('@', '').trim();
                const rate = parseFloat(rateStr);
                const cadAmount = usdAmount * rate;

                // Capture PDF coordinates for FX line
                let fxCoords = null;
                if (lineMetadata && lineMetadata[i]) {
                    const metaLine = lineMetadata[i];
                    fxCoords = {
                        page: metaLine.page || 1,
                        top: metaLine.y || 0,
                        left: metaLine.x || 0,
                        width: metaLine.width || 500,
                        height: metaLine.height || 12,
                        lineText: metaLine.text
                    };
                }

                fxLines.push({
                    text: line,
                    usdAmount,
                    rate,
                    cadAmount,
                    pdfCoords: fxCoords,
                    lineIndex: i
                });
                console.log(`[FX-COLLECT] Line ${i}: USD ${usdAmount} @ ${rate} = CAD ${cadAmount.toFixed(2)}`);
            }

            // If in active section, look for transaction lines
            if (currentSection) {

                // Capture transaction descriptions (lines with dates)
                const dateMatch = line.match(dateRegex);
                if (dateMatch) {
                    const [, month1, day1, month2, day2, description] = dateMatch;
                    const month = monthMap[month2.toLowerCase()];
                    const day = day2.padStart(2, '0');

                    // Extract amount from THIS line (at the end, after description)
                    const amountMatch = line.match(/([\d,]+\.\d{2})$/);
                    if (amountMatch) {
                        const amt = parseFloat(amountMatch[1].replace(/,/g, ''));
                        const signedAmount = line.includes('-') ? -amt : amt;
                        currentSection.amounts.push(signedAmount);
                        console.log(`[TX-EXTRACT] Line ${i}: "${description.substring(0, 30)}" → $${amt}`);
                    } else {
                        console.log(`[TX-NO-AMT] Line ${i}: "${description.substring(0, 30)}" (no amount on line)`);
                    }

                    // Capture PDF coordinates for this line
                    let pdfCoords = null;
                    if (lineMetadata && lineMetadata[i]) {
                        const metaLine = lineMetadata[i];
                        pdfCoords = {
                            page: metaLine.page || 1,
                            top: metaLine.y || 0,
                            left: metaLine.x || 0,
                            width: metaLine.width || 500,
                            height: metaLine.height || 12,
                            lineText: metaLine.text
                        };
                        console.log(`[AMEX] Line ${i}: Matched "${description.substring(0, 40)}" to PDF coords page ${pdfCoords.page} Y=${pdfCoords.top}`);
                    }

                    currentSection.descriptions.push({
                        date: `${currentYear}-${month}-${day}`,
                        description,
                        rawLine: line,
                        pdfLineIndex: i,  // Track which PDF line this came from
                        pdfCoords
                    });
                }
            }

        }

        // Log all detected sections
        console.log(`%c📋 Found ${sections.length} transaction sections`, 'background: orange; color: white; padding: 4px; font-weight: bold;');
        sections.forEach((s, idx) => {
            console.log(`%cSection ${idx + 1}: ${s.descriptions.length} descriptions, ${s.amounts.length} amounts`, 'color: blue');
            console.log(`  Start: "${s.startText?.substring(0, 60)}"`);
            console.log(`  End: "${s.endText?.substring(0, 60)}"`);
            if (s.descriptions.length > 0) {
                console.log(`  First desc: "${s.descriptions[0].rawLine.substring(0, 60)}"`);
            }
        });

        // Use the LAST section (typically the actual statement period transactions)
        // Earlier sections are often summary/bulk categorizations
        const targetSection = sections[sections.length - 1];
        if (!targetSection) {
            console.warn('[AMEX] No transaction sections found!');
            descriptionLines = [];
            amountLines = [];
        } else {
            console.log(`%c🎯 Using Section ${sections.length} (last section)`, 'background: green; color: white; padding: 4px;');
            descriptionLines = targetSection.descriptions;
            amountLines = targetSection.amounts;
        }

        // Match descriptions with amounts by position
        console.log(`[AMEX] Found ${descriptionLines.length} descriptions, ${amountLines.length} amounts`);
        const minLen = Math.min(descriptionLines.length, amountLines.length);
        for (let i = 0; i < minLen; i++) {
            const desc = descriptionLines[i];
            const amount = Math.abs(amountLines[i]);
            const isPayment = amountLines[i] < 0 || desc.description.match(/PAYMENT|THANK YOU/i);

            // Generate unique parser_ref for this transaction
            const sequenceNum = String(i + 1).padStart(3, '0');
            const parser_ref = `${statementId}-${sequenceNum}`;

            transactions.push({
                date: desc.date,
                ref: null, // Will be assigned by ledger system
                description: this.cleanCreditDescription(desc.description, [
                    "PAYMENT THANK YOU", "PURCHASE", "CASH ADVANCE",
                    "INTEREST CHARGE", "MEMBERSHIP FEE", "LATE FEE"
                ]),
                debit: isPayment ? 0 : amount,
                credit: isPayment ? amount : 0,
                balance: 0,  // Not used by ledger
                parser_ref,  // Unique parser ID
                pdfLocation: desc.pdfCoords,  // Exact PDF coordinates for main line
                audit: {
                    parser: 'AmexParser',
                    parsedAt: new Date().toISOString(),
                    statementId,
                    lineNumber: i + 1,
                    rawText: desc.rawLine,  // Will be updated if FX line matches
                    allPdfLines: [{ line: desc.rawLine, coords: desc.pdfCoords, type: 'main' }]  // Will be extended if FX matches
                }
            });
        }

        // POST-PROCESSING: Match FX lines to transactions by amount
        console.log(`[FX-MATCH] Attempting to match ${fxLines.length} FX lines to ${transactions.length} transactions`);

        for (const fxLine of fxLines) {
            // Find transaction with matching CAD amount (within $0.50 tolerance for rounding)
            const matchedTx = transactions.find(tx =>
                tx.debit > 0 && Math.abs(tx.debit - fxLine.cadAmount) <= 0.50
            );

            if (matchedTx) {
                // Append FX line to rawText
                matchedTx.audit.rawText += '\n' + fxLine.text;

                // Add FX line to allPdfLines
                matchedTx.audit.allPdfLines.push({
                    line: fxLine.text,
                    coords: fxLine.pdfCoords,
                    type: 'continuation'
                });

                console.log(`[FX-MATCH] ✅ Matched FX line (USD ${fxLine.usdAmount} @ ${fxLine.rate} = CAD ${fxLine.cadAmount.toFixed(2)}) to transaction: ${matchedTx.description} (CAD ${matchedTx.debit.toFixed(2)})`);
            } else {
                console.log(`[FX-MATCH] ❌ No match for FX line: CAD ${fxLine.cadAmount.toFixed(2)} (USD ${fxLine.usdAmount} @ ${fxLine.rate})`);
            }
        }

        console.log(`[AMEX] Parsed ${transactions.length} transactions`);
        return {
            transactions,
            metadata,
            openingBalance,
            closingBalance,
            statementPeriod,
            openingBalanceCoords,
            closingBalanceCoords
        };
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
