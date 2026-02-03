/**
 * Scotiabank Chequing Parser
 * Refined for multi-line transaction support based on BankStatementWizard reference
 */
class ScotiaChequingParser extends BaseBankParser {
  constructor() {
    const formatRules = `
SCOTIABANK CHEQUING FORMAT:
- Date: MM/DD/YYYY (e.g., "12/04/2018") or MMM DD (e.g., "JAN 15")
- Columns: Date | Description | Withdrawal | Deposit | Balance
- Balance has trailing "-" for negative (e.g., "40,091.53-")

SMART PARSING RULES:
1. Skip "BALANCE FORWARD" lines (only have balance, no transaction amount)
2. Real transactions have TWO numbers at end: Amount + Balance
3. Multi-line descriptions: Accumulate lines until we find Amount + Balance
        `;
    super('Scotiabank', 'Chequing', formatRules);
  }

  /**
   * STRICT REGEX PARSER for Scotiabank Chequing
   * Based on actual PDF text structure from user's statements
   * [PHASE 4] Now accepts lineMetadata for spatial tracking
   */
  parseWithRegex(text, inputMetadata = null, lineMetadata = []) {
    this.lastLineMetadata = lineMetadata;
    const lines = text.split('\n');
    const transactions = [];

    // LOUD DIAGNOSTIC
    console.warn('⚡ [EXTREME-SCOTIA] Starting metadata extraction for Scotiabank...');
    console.error('📄 [DEBUG-SCOTIA] First 1000 characters (RED for visibility):');
    console.log(text.substring(0, 1000));

    // EXTRACT METADATA (Institution, Transit, Account)
    // Scotia format: Account Number: 02469 01458 15
    const combinedMatch = text.match(/Account Number:?\s*(\d{5})\s+([\d\s-]{7,})/i);
    const transitMatch = combinedMatch ? [combinedMatch[0], combinedMatch[1]] : text.match(/(?:Transit|Branch)[:#]?\s*(\d{5})/i);
    const acctMatch = combinedMatch ? [combinedMatch[0], combinedMatch[2]] : text.match(/(?:Account)[:#]?\s*([\d-]{7,})/i);

    const metadata = {
      _inst: inputMetadata?.institutionCode || '002', // Scotiabank Institution Code
      _transit: transitMatch ? transitMatch[1] : (inputMetadata?.transit || '-----'),
      _acct: acctMatch ? acctMatch[1].replace(/[-\s]/g, '') : (inputMetadata?.accountNumber || '-----'),
      institutionCode: inputMetadata?.institutionCode || '002',
      transit: transitMatch ? transitMatch[1] : (inputMetadata?.transit || '-----'),
      accountNumber: acctMatch ? acctMatch[1].replace(/[-\s]/g, '') : (inputMetadata?.accountNumber || '-----'),
      _brand: inputMetadata?.brand || 'Scotiabank',
      _bank: inputMetadata?.fullBrandName || 'Scotiabank',
      _tag: inputMetadata?.tag || 'Chequing'
    };
    console.warn('🏁 [SCOTIA] Extraction Phase Complete. Transit:', metadata.transit, 'Acct:', metadata.accountNumber);

    // Date patterns
    const dateRegex1 = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)[a-z]*\s+\d{1,2}/i;
    const dateRegex2 = /^(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/;

    // Amount pattern: TWO numbers at line end (Amount + Balance)
    // This distinguishes real transactions from "BALANCE FORWARD" lines (which have only 1 number)
    // Examples: "393.30   41,580.68-" or "1,450.00 37,835.92-"
    const twoAmountPattern = /([\d,]+\.\d{2}-?)\s+([\d,]+\.?\d{0,2}-?)(?:\s|$)/;

    // Single amount pattern (for fallback or BALANCE FORWARD detection)
    const singleAmountPattern = /([\d,]+\.\d{2}-?)(?:\s|$)/;

    console.log(`[SCOTIA] Starting parse with ${lines.length} lines`);

    let openingBalance = 0;
    const openingBalanceMatch = text.match(/BALANCE\s+FORWARD\s+.*?([\d,]+\.\d{2}-?)/i);
    if (openingBalanceMatch) {
      let rawBal = openingBalanceMatch[1].replace(/,/g, '');
      openingBalance = parseFloat(rawBal.replace(/-$/, ''));
      if (rawBal.endsWith('-')) openingBalance = -openingBalance;
      console.log(`[SCOTIA] Extracted opening balance: ${openingBalance}`);
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const meta = lineMetadata && lineMetadata[i];
      if (!line) continue;

      // Skip known headers
      if (line.match(/Statement Period|Account Details|No\. of Debits|Total Amount/i)) continue;
      if (line.match(/^Date\s+Description/i)) continue;

      // Check if line starts with a Date
      let dateMatch = line.match(dateRegex1) || line.match(dateRegex2);

      if (dateMatch) {
        const dateStr = dateMatch[0];

        // Skip BALANCE FORWARD lines (they only show balance, not a transaction)
        if (line.match(/BALANCE\s+FORWARD/i)) {
          console.log(`[SCOTIA] Skipping BALANCE FORWARD: "${line}"`);
          continue;
        }

        // Check if this line already has TWO amounts (complete transaction on one line)
        // Check for summary lines to skip
        if (line.match(/No\. of (?:Debits|Credits)|Total Amount|Service Charge Summary/i)) {
          console.log(`[SCOTIA] ℹ️ Skipping summary line: "${line.substring(0, 50)}..."`);
          continue;
        }

        const amountMatch = line.match(twoAmountPattern);
        if (amountMatch) {
          console.log(`[SCOTIA] ✓ Single-line match: "${line}"`);
          this.processTransaction(dateStr, line, amountMatch, transactions, metadata, meta);
          continue;
        }

        // MULTI-LINE: Accumulate lines until we find TWO amounts
        let combinedLine = line;
        let lookAheadIndex = 1;
        let foundAmount = false;

        let rawLines = [line];
        let auditLines = [this.getSpatialMetadata(line)];

        // Look ahead up to 4 lines (for multi-line descriptions)
        while (i + lookAheadIndex < lines.length && lookAheadIndex <= 4) {
          const nextLine = lines[i + lookAheadIndex].trim();
          if (!nextLine) {
            lookAheadIndex++;
            continue;
          }

          // If next line starts with a date, we've hit the next transaction
          if (nextLine.match(dateRegex1) || nextLine.match(dateRegex2)) {
            break;
          }

          // Skip summary info in multi-line lookahead
          if (nextLine.match(/No\. of (?:Debits|Credits)|Total Amount|No\. of Items|Total \$/i)) {
            break;
          }

          // Append the next line
          combinedLine += " " + nextLine;
          rawLines.push(nextLine);
          auditLines.push(this.getSpatialMetadata(nextLine));

          // Check if we NOW have two amounts
          const combinedMatch = combinedLine.match(twoAmountPattern);
          if (combinedMatch) {
            this.processTransaction(dateStr, combinedLine, combinedMatch, transactions, metadata, null); // passing null for meta to handle it manually
            // Patch the last transaction with merged data
            const lastTx = transactions[transactions.length - 1];
            lastTx.rawText = rawLines.join('\n');
            lastTx.audit = this.mergeAuditMetadata(auditLines);

            i += lookAheadIndex; // Skip consumed lines
            foundAmount = true;
            break;
          }

          lookAheadIndex++;
        }

        if (!foundAmount) {
          // Fallback: Try single amount on the same line (if not a balance forward)
          const singleMatch = line.match(singleAmountPattern);
          if (singleMatch && !line.includes("BALANCE FORWARD")) {
            console.log(`[SCOTIA] ✓ Single-amount fallback: "${line}"`);
            this.processTransaction(dateStr, line, [singleMatch[0], singleMatch[1], null], transactions, metadata, meta);
            foundAmount = true;
          }
        }

        if (!foundAmount) {
          console.log(`[SCOTIA] ✗ No amount found for date line: "${line}"`);
        }
      }
    }

    console.log(`[SCOTIA] Parsing complete. Found ${transactions.length} transactions.`);

    return {
      transactions: transactions,
      metadata: metadata,
      openingBalance: openingBalance
    };
  }

  processTransaction(dateStr, fullLine, amountMatch, transactions, fileMetadata, meta = null) {
    // [PHASE 4] Extract ref code from the raw description before cleaning
    let refCode = 'N/A';
    const refMatch = fullLine.match(/\b([A-Z0-9]{15,})\b/);
    if (refMatch) refCode = refMatch[0];

    // amountMatch[1] = Transaction Amount
    // amountMatch[2] = Balance (OPTIONAL if we only found 1 amount)
    let rawAmount = amountMatch[1].replace(/,/g, '');
    let rawBalance = amountMatch[2] ? amountMatch[2].replace(/,/g, '') : null;

    let amount = parseFloat(rawAmount.replace(/-$/, ''));
    let balance = rawBalance ? parseFloat(rawBalance.replace(/-$/, '')) : null;

    // Handle trailing negative sign
    if (rawAmount.endsWith('-')) amount = -amount;
    if (rawBalance && rawBalance.endsWith('-')) balance = -balance;

    // Use absolute for amount in grid, but we need to know if it's credit/debit
    // In Scotiabank, usually Withdrawal is the first column, Deposit is second.
    // Our twoAmountPattern captures what it finds.

    // Extract description (everything between date and amounts)
    let description = fullLine.substring(dateStr.length);
    description = description.replace(amountMatch[0], '').trim();

    // CLEANUP: Remove common trailing garbage from multi-line captures (e.g. Scotiabank summary footers)
    description = description.split(/No\. of (?:Debits|Credits)|Total Amount|Total \$/i)[0].trim();
    description = description.replace(/\s{2,}/g, ' '); // Collapse double spaces

    // Normalize Date to YYYY-MM-DD
    let isoDate = dateStr;
    if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      const parts = dateStr.split('/');
      isoDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }

    // Determine Debit vs Credit based on keywords
    let isCredit = false;
    const creditKeywords = /DEPOSIT|CREDIT\s+MEMO|REFUND|PAYROLL|EMAIL\s+MONEY\s+TRF|E-TRANSFER.*RECEIVED|ACCOUNTS\s+PAYABLE\s+DEPOSIT/i;
    if (description.match(creditKeywords)) {
      isCredit = true;
    }

    // UI FORMATTING: Insert comma after known transaction types
    // This triggers the "Gray Type / Bold Merchant" display in the grid
    const typePrefixes = [
      "BILL PAYMENT", "INSURANCE", "SERVICE CHARGE", "POINT OF SALE PURCHASE",
      "TRANSFER TO", "TRANSFER FROM", "ABM WITHDRAWAL", "CASH WITHDRAWAL",
      "SHARED ABM WITHDRAWAL", "DEBIT MEMO", "CREDIT MEMO", "MISC PAYMENT",
      "INTERAC ABM FEE", "OVERDRAFT PROTECTION FEE", "RETURNED NSF CHEQUE",
      "NSF SERVICE CHARGE", "BUSINESS PAD", "MB BILL PAYMENT", "PC BILL PAYMENT"
    ];

    for (const type of typePrefixes) {
      if (description.toUpperCase().startsWith(type)) {
        // Only insert if not already present and followed by space or end
        // We verify the next char isn't already a comma
        if (description.length > type.length && description[type.length] !== ',') {
          description = description.substring(0, type.length) + ',' + description.substring(type.length);
        }
        break;
      }
    }

    // Special handling for CHQ # (e.g., "CHQ 45 ...")
    if (description.match(/^CHQ\s+\d+/i)) {
      description = description.replace(/^(CHQ\s+\d+)(\s+)/i, '$1,$2');
    }

    const tx = {
      date: isoDate,
      description: description,
      amount: amount,
      debit: isCredit ? 0 : amount,
      credit: isCredit ? amount : 0,
      balance: balance,
      _inst: '002',
      _transit: fileMetadata._transit,
      _acct: fileMetadata._acct,
      _brand: 'Scotiabank',
      _bank: 'Scotiabank',
      _tag: 'Chequing',
      audit: meta ? { page: meta.page, y: meta.y, height: meta.height } : null,
      rawText: this.cleanRawText(fullLine), // Capture full uncleaned multi-line string
      refCode: refCode
    };

    transactions.push(tx);

    console.log('✅ Parsed:', {
      date: isoDate,
      desc: description.substring(0, 40) + (description.length > 40 ? '...' : ''),
      debit: tx.debit,
      credit: tx.credit,
      balance: balance
    });
  }
}

// Expose to window for file:// compatibility
window.ScotiaChequingParser = ScotiaChequingParser;
window.scotiaChequingParser = new ScotiaChequingParser();
