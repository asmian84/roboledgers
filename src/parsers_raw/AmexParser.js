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
        // Progress tracking for parse steps (heartbeat removed - was 100ms interval spam)
        let lastStep = 'START';
        const updateStep = (step) => {
            lastStep = step;
        };

        try {
            updateStep('Metadata extraction started');

            this.lastLineMetadata = lineMetadata;

            // EXTRACT METADATA - Full masked card (IIN: 15 digits for Amex)
            // Amex format often: "XXXX XXXXX6 91001" or "3XXX XXXXXX X1001"
            let accountNumber = 'XXXX XXXXXX XXXX'; // Default fallback (15 digits)

            updateStep('Extracting masked card number');
            // Try to match full 15-digit Amex format (3XXX-XXXXXX-X1001)
            const maskedMatch = statementText.match(/([3]\d{3}[\s-]*X{6}[\s-]*X?\d{4,5})/i) ||
                statementText.match(/(X{4}[\s-]*X{5}\d?[\s-]*\d{4,5})/i);

            if (maskedMatch) {
                accountNumber = maskedMatch[1].replace(/-/g, ' ').replace(/\s+/g, ' '); // Normalize
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
            updateStep('Extracting year');
            // YEAR DETECTION: Look for Statement Period or Closing Date year
            const yearRegex = /(?:Statement\s+Period|Closing\s+Date|Ending\s+in|20[23]\d)/gi;
            let currentYear = new Date().getFullYear();
            const yearMatches = statementText.match(yearRegex);
            if (yearMatches) {
                // Find the first 4-digit year in the matches
                const fullYearMatch = statementText.match(/20\d{2}/);
                if (fullYearMatch) currentYear = parseInt(fullYearMatch[0]);
            }
            const lines = statementText.split('\n');
            const transactions = [];

            updateStep('Extracting opening balance');
            // Extract opening balance (Previous Balance)
            let openingBalance = 0;
            let openingBalanceCoords = null;
            const previousBalanceMatch = statementText.match(/Previous\s+Balance\s+.*?([\d,]+\.\d{2})/i);
            if (previousBalanceMatch) {
                openingBalance = parseFloat(previousBalanceMatch[1].replace(/,/g, ''));

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
                    }
                }
            }

            updateStep('Extracting closing balance');
            // Extract closing balance (New Balance or Closing Balance)
            let closingBalance = 0;
            let closingBalanceCoords = null;
            const closingBalanceMatch = statementText.match(/(?:New Balance|Closing Balance|Balance on [A-Za-z]+ \d{1,2}, \d{4})\s+.*?([\d,]+\.\d{2})/i) ||
                statementText.match(/Closing balance on [A-Za-z]+\s+\d{1,2},\s+\d{4}\s+.*?\$([\d,]+\.\d{2})/i);
            if (closingBalanceMatch) {
                closingBalance = parseFloat(closingBalanceMatch[1].replace(/,/g, ''));

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
                    }
                }
            }

            updateStep('Extracting statement period');
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
                }
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

            updateStep('Starting dual-phase scan');

            // DUAL-PHASE: First scan for section boundaries and collect FX lines separately
            let currentSection = null;
            const sections = [];
            const fxLines = []; // NEW: Collect FX lines separately for later matching

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                // Detect start of transaction section (positive lookahead)
                if (line.match(/^New (Transactions|Purchases|Payments)/i)) {
                    if (currentSection) {
                        sections.push(currentSection);
                    }
                    currentSection = {
                        startLine: i,
                        startText: line,
                        descriptions: [],
                        amounts: [],
                        sectionIndex: sections.length + 1 // Add section index for logging
                    };
                }

                // Detect end of transaction section
                if (line.match(/^Total of/i) && currentSection) {
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
                }

                // If in active section, look for transaction lines AND amounts
                if (currentSection) {
                    // FIRST: Scan for amounts on ANY line (they may be separate from descriptions)
                    const lineAmountMatch = line.match(/([\d,]+\.\d{2})$/);
                    if (lineAmountMatch && !line.match(dateRegex)) {  // Only if NOT a transaction line
                        const amt = parseFloat(lineAmountMatch[1].replace(/,/g, ''));
                        const signedAmount = line.includes('-') ? -amt : amt;

                        // Store amount WITH metadata for spatial matching
                        const amountData = {
                            amount: signedAmount,
                            lineIndex: i,
                            coords: lineMetadata && lineMetadata[i] ? {
                                page: lineMetadata[i].page || 1,
                                y: lineMetadata[i].y || 0,
                                x: lineMetadata[i].x || 0
                            } : null
                        };

                        currentSection.amounts.push(amountData);
                    }

                    // SECOND: Capture transaction descriptions (lines with dates)
                    const dateMatch = line.match(dateRegex);
                    if (dateMatch) {
                        const [, month1, day1, month2, day2, description] = dateMatch;
                        const month = monthMap[month2.toLowerCase()];
                        const day = day2.padStart(2, '0');

                        // Try to extract amount from THIS line (fallback if on same line)
                        const amountMatch = line.match(/([\d,]+\.\d{2})$/);
                        if (amountMatch) {
                            const amt = parseFloat(amountMatch[1].replace(/,/g, ''));
                            const signedAmount = line.includes('-') ? -amt : amt;
                            currentSection.amounts.push(signedAmount);
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

            // Merge ALL sections that have transactions (not just the last one)
            // This prevents data loss when statements have multiple transaction sections
            // (e.g., pending + posted, or multi-period statements)
            if (sections.length === 0) {
                descriptionLines = [];
                amountLines = [];
            } else if (sections.length === 1) {
                descriptionLines = sections[0].descriptions;
                amountLines = sections[0].amounts;
            } else {
                // Multiple sections: use the one with the MOST transactions
                // (the actual statement section, not summary/header sections)
                const targetSection = sections.reduce((best, s) =>
                    s.descriptions.length > best.descriptions.length ? s : best
                , sections[0]);
                updateStep(`Processing section ${targetSection.sectionIndex} with ${targetSection.descriptions.length} descriptions (largest of ${sections.length} sections)`);
                descriptionLines = targetSection.descriptions;
                amountLines = targetSection.amounts;
            }

            // Match descriptions with amounts by SPATIAL PROXIMITY (not position!)
            updateStep('Matching descriptions with amounts by spatial proximity');

            // Create a copy of amounts for matching (to track which have been used)
            const availableAmounts = [...amountLines];

            for (let i = 0; i < descriptionLines.length; i++) {
                const desc = descriptionLines[i];
                let matchedAmount = null;
                let matchedIndex = -1;

                // If description has PDF coordinates, find the nearest amount by Y-coordinate
                if (desc.pdfCoords && desc.pdfCoords.top !== undefined) {
                    const descY = desc.pdfCoords.top;
                    const descPage = desc.pdfCoords.page;

                    let minDistance = Infinity;

                    // Find amount with closest Y-coordinate on same page
                    availableAmounts.forEach((amtData, idx) => {
                        if (!amtData || !amtData.coords) return;  // Skip if no coords

                        // Only match amounts on the same page and within reasonable distance (±100 pixels)
                        if (amtData.coords.page === descPage) {
                            const distance = Math.abs(amtData.coords.y - descY);
                            if (distance < minDistance && distance < 100) {  // Allow larger distance for Amex PDFs
                                minDistance = distance;
                                matchedAmount = amtData.amount;
                                matchedIndex = idx;
                            }
                        }
                    });

                    if (matchedIndex >= 0) {
                        // Remove matched amount from available pool
                        availableAmounts[matchedIndex] = null;
                    }
                } else {
                    // Fallback: use position-based matching if no coordinates
                    if (i < availableAmounts.length && availableAmounts[i]) {
                        matchedAmount = availableAmounts[i].amount || availableAmounts[i];  // Handle both formats
                        availableAmounts[i] = null;
                    }
                }

                if (matchedAmount === null) {
                    continue;  // Skip this transaction - no amount matched
                }

                const amount = Math.abs(matchedAmount);
                const isPayment = matchedAmount < 0 || desc.description.match(/PAYMENT|THANK YOU/i);

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
                    debit: isPayment ? amount : 0,
                    credit: isPayment ? 0 : amount,
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
            for (const fxLine of fxLines) {
                // Find transaction with matching CAD amount (within $0.50 tolerance for rounding)
                const matchedTx = transactions.find(tx => {
                    return tx.debit > 0 && Math.abs(tx.debit - fxLine.cadAmount) <= 0.50;
                });

                if (matchedTx) {
                    // Append FX line to rawText
                    matchedTx.audit.rawText += '\n' + fxLine.text;

                    // Add FX line to allPdfLines
                    matchedTx.audit.allPdfLines.push({
                        line: fxLine.text,
                        coords: fxLine.pdfCoords,
                        type: 'continuation'
                    });
                }
            }

            updateStep('Finalizing parse - building return object');
            return {
                transactions,
                metadata,
                openingBalance,
                closingBalance,
                statementPeriod,
                openingBalanceCoords,
                closingBalanceCoords
            };
        } finally {
            updateStep('COMPLETE');
        }
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

        // Amex PDF: negative amount = payment/refund; avoid bare "credit" which appears in "CREDIT PURCHASE"
        const hasCR = /[\d,]+\.\d{2}\s*CR\b/i.test(text);
        const isPayment = amount < 0 || hasCR || /payment|refund|thank you|CREDIT VOUCHER|CREDIT MEMO/i.test(description);
        const absAmount = Math.abs(amount);

        // Build audit data for source document viewing
        const auditData = this.buildAuditData(originalLine, 'AmexParser');

        return {
            date: isoDate,
            description,
            amount: absAmount,
            debit: isPayment ? absAmount : 0,
            credit: isPayment ? 0 : absAmount,
            balance: 0,
            pdfLocation: auditData.pdfLocation,
            audit: auditData.audit,
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
