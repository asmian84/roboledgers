/**
  * RBC Chequing Parser
    * Regex - based parser for RBC Chequing statements
      */
class RBCSavingsParser extends BaseBankParser {
  constructor() {
    const formatRules = `
RBC CHEQUING FORMAT:
- Date: D MMM (e.g., "7 May", "15 Jan")
- Column Anchors: A gap of 2 or more spaces separation usually indicates a column boundary.
- Fields: Date | Description | Cheques&Debits | Deposits&Credits | Balance

SMART PARSING RULES:
1. Date year is not in transaction rows; extract it from the statement header.
2. If "Jan" appears after "Dec", increment the year (year rollover).
3. Skip lines containing "Opening Balance" or "Closing Balance".
4. Cleanup: Remove "Reference XXXXXXXXX" from descriptions.
        `;
    super('RBC', 'Chequing', formatRules);
    this.currentYear = new Date().getFullYear();
  }

  /**
   * REGEX PARSER for RBC Chequing
   * Format: Date (D Mon) | Description | Debit | Credit | Balance
   * KEY INSIGHT: Multiple transactions can occur on the same date
   * A new transaction starts when we see an AMOUNT (not a new date)
   */
  async parse(text, metadata = null, lineMetadata = []) {
        // ── AUDIT IDENTITY: statement ID + sequence counter ──────────────────
        // Produces parser_ref like "RBCSAV-2024NOV-001" on every transaction.
        // Mirrors AmexParser audit structure for consistent audit drawer display.
        let _statementYear = new Date().getFullYear().toString();
        let _statementMonth = 'UNK';
        const _yearMatch = text.match(/20\d{2}/);
        if (_yearMatch) _statementYear = _yearMatch[0];
        const _monthMatch = text.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i);
        if (_monthMatch) _statementMonth = _monthMatch[1].substring(0, 3).toUpperCase();
        const _statementId = 'RBCSAV-' + _statementYear + _statementMonth;
        let _seqNum = 0;

        // ── Audit helper — call this when building each transaction ──────────
        const _makeAuditRef = (rawLine, lineMetadata) => {
            _seqNum++;
            const auditResult = typeof this.buildAuditData === 'function'
                ? this.buildAuditData(rawLine, this.constructor.name, { statementId: _statementId, lineNumber: _seqNum })
                : { pdfLocation: null, audit: null };
            return {
                parser_ref: _statementId + '-' + String(_seqNum).padStart(3, '0'),
                pdfLocation: auditResult.pdfLocation,
                audit: auditResult.audit,
            };
        };

    const lines = text.split('\n');
    const transactions = [];

    // [PHASE 4] Store lineMetadata for audit lookups
    this.lastLineMetadata = lineMetadata;

    // 1. EXTRACT OPENING BALANCE (Robust Regex)

    let openingBalance = null;
    // Look for lines like "Opening balance on June 5, 2023 $24,840.89"
    // Handle cases where $ is missing or space is weird
    const openingMatch = text.match(/Opening\s+balance.*?(?:on\s+.*?)?[\$:]?\s*([\d,]+\.\d{2})/i);

    if (openingMatch) {
      openingBalance = parseFloat(openingMatch[1].replace(/,/g, ''));
    } else {
    }

    // 1.1 EXTRACT ACCOUNT INFO
    let transit = '-----';
    let acctFromText = '-----';

    // RBC Patterns (Priority Order)

    // STRATEGY 1: Exact Match based on User Dump (Most likely to succeed)
    // Matches: "Account number:", variable spaces, 5-digit transit, variable spaces, Account ID (digits/dashes)
    // Regex Note: [\s\u00A0]* matches normal spaces and non-breaking spaces
    const exactLabelMatch = text.match(/Account\s+number[:\s\u00A0]*(\d{5})[\s\u00A0]+([\d-]+)/i);

    // STRATEGY 2: "Your Account Number" (Older statements)
    const yourAcctMatch = text.match(/Your\s+account\s+number[:\s\u00A0]*(\d{5})[\s\u00A0]+([\d-]+)/i);

    // STRATEGY 3: Scorched Earth - Transit/Account Pattern (Ignore Label)
    // Looks for: 5 digits, space, 3 digits, dash, 3 digits, dash, 1 digit (RBC standard)
    // e.g. "01259 100-244-3"
    const patternMatch = text.match(/\b(\d{5})[\s\u00A0]+(\d{3}-\d{3}-\d)\b/);

    // 3. Header Scan: "500 ROYAL BANK... 00000 000-000-0" (Specific RBC header format)
    const headerLines = lines.slice(0, 50).join('\n'); // Increased to 50 lines
    const rawPatternMatch = headerLines.match(/\b(\d{5})\s+(\d{3}-\d{3}-\d)\b/);

    // Select the best match
    let acctInfoMatch = exactLabelMatch || yourAcctMatch || patternMatch;

    // Log the wins for debugging
    if (window.ProcessingEngine) {
      window.ProcessingEngine.log('info', '[RBC Parser] Extraction Strategy', {
        strategy: exactLabelMatch ? 'Exact Label' : (yourAcctMatch ? 'Your Account' : (patternMatch ? 'Pattern Only' : 'None')),
        match: acctInfoMatch ? acctInfoMatch[0] : 'null'
      });
    }
    // 4. SCORCHED EARTH VARIATIONS
    // Matches: "12345 123-456-7" OR "12345 1234567"
    const anyTransitAcctMatch = headerLines.match(/(\d{5})\s+(\d{3}[-\s]?\d{3}[-\s]?\d)/);

    // 5. KEYWORD PROXIMITY (Last Resort)
    // Look for "Account" followed by digits within 20 chars
    const keywordMatch = headerLines.match(/Account\D{0,20}(\d{7,12})/i);
    const transitMatch = headerLines.match(/Transit\D{0,20}(\d{5})/i);

    if (acctInfoMatch) {
      transit = acctInfoMatch[1];
      acctFromText = acctInfoMatch[2].replace(/[-\s]/g, '');

      // Store in metadata for processing engine
      if (metadata) {
        metadata.transit = transit;
        metadata.accountNumber = acctFromText;
      }
    } else if (anyTransitAcctMatch) {
      transit = anyTransitAcctMatch[1];
      acctFromText = anyTransitAcctMatch[2].replace(/[-\s]/g, '');
      if (metadata) {
        metadata.transit = transit;
        metadata.accountNumber = acctFromText;
      }
    } else if (keywordMatch) {
      acctFromText = keywordMatch[1];
    }

    // Detect account type (Savings vs Chequing) from statement text
    const isSavings = text.includes('Savings Account') || text.includes('SAVINGS');
    const accountType = isSavings ? 'SAVINGS' : 'Chequing';


    if (window.ProcessingEngine) {
      window.ProcessingEngine.log('info', '[RBC Parser] Extraction Result', { transit, acct: acctFromText });
    }

    // Capture metadata
    this.metadata = {
      institutionCode: '003',
      inst: '003',
      transit: transit,
      accountNumber: acctFromText,
      // NOTE: Do NOT set `brand` here — brand is for card networks (MASTERCARD, VISA).
      // Setting brand: 'RBC' caused updateMetadata() to treat this as a credit card.
      bankName: 'RBC',          // ← correct field for the issuing bank
      bankIcon: 'RBC',
      bank: 'RBC',
      tag: 'Savings',
      accountType: 'SAVINGS',   // downstream name builder uses this for "RBC - Savings #XXXX"
      openingBalance: openingBalance,
      debug_raw_header: headerLines // Store for UI debugging
    };

    // Calculate metadata similar to before (abbreviated for this replacement to focus on grid logic)
    // ... [Transit extraction logic can remain or be re-injected if needed, but keeping it simple for now]

    // 2. GRID PARSING STRATEGY
    // We maintain a running balance to verify columns
    let currentCalculatedBalance = openingBalance;
    let currentYear = new Date().getFullYear(); // We should extract this from header ideally

    // Extract year from header
    const yearMatch = text.match(/,\s+(20\d{2})/);
    if (yearMatch) currentYear = parseInt(yearMatch[1]);


    let pendingDescription = '';
    let pendingDate = null;

    // 3. TWO-PASS PARSING STRATEGY (Gap Solver)
    // Pass 1: Extract all potential transaction rows
    // 3. TWO-PASS PARSING STRATEGY (Gap Solver) [REFACTORED for BOUNDARY SAFETY]
    // Pass 1: Extract all potential transaction rows INSIDE THE BOX
    const rawRows = [];
    let pendingLineDesc = '';
    let pendingLineDate = null;

    // BOUNDARY FLAGS
    let insideTransactionBlock = false;
    const startMarkers = [/Account Activity Details/i, /Date\s+Description\s+Cheques/i];
    const endMarkers = [/Closing balance/i, /Account Fees:/i];

    // GARBAGE FILTERS - Only apply BEFORE entering transaction block
    const preBlockGarbagePatterns = [
      /Opening\s+balance\s+on/i,
      /Total\s+deposits\s+&\s+credits/i,
      /Total\s+cheques\s+&\s+debits/i,
      /Please contact/i,
      /royalbank\.com/i,
      /How to reach us/i
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // 1. STATE MACHINE TRANSITIONS
      // Start Trigger: "Account Activity Details" OR Table Header
      if (!insideTransactionBlock) {
        // Filter obvious garbage BEFORE entering block
        if (preBlockGarbagePatterns.some(p => line.match(p))) {
          continue;
        }

        if (startMarkers.some(m => line.match(m))) {
          insideTransactionBlock = true;
          continue; // Skip the marker line itself
        }
      }

      // Stop Trigger: Summary lines  
      if (insideTransactionBlock) {
        if (endMarkers.some(m => line.match(m))) {
          insideTransactionBlock = false;
          break;
        }
      }

      // If we are NOT in the block yet, skip
      if (!insideTransactionBlock) continue;

      // Skip page break headers and repeated table headers INSIDE the block
      if (line.match(/Business Account Statement/i)) continue;
      if (line.match(/Account number:/i)) continue;
      if (line.match(/^Date\s+Description/i)) continue;
      if (line.match(/ROYAL BANK OF CANADA/i)) continue;
      if (line.match(/^Account Activity Details/i)) continue;

      // ===================================
      // CORE PARSING LOGIC (Existing logic adapted)
      // ===================================

      // Date extraction
      const dateMatch = line.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
      let dateStr = null;
      let content = line;

      if (dateMatch) {
        const day = dateMatch[1];
        const month = dateMatch[2];
        dateStr = this.formatDate(day, month, currentYear);
        content = line.substring(dateMatch[0].length).trim();
        pendingLineDate = dateStr;
      }

      // Amount extraction - avoid matching standalone 4-digit years
      // Match: digits with optional commas, followed by decimal point and exactly 2 digits
      // This ensures we only match currency amounts (e.g., 1,234.56) not years (e.g., 2024)
      const amountMatches = [...content.matchAll(/(\d{1,3}(?:,\d{3})*\.\d{2})/g)];

      if (amountMatches.length >= 2) {
        // Anchor Row (Amount + Balance)
        const balanceStr = amountMatches[amountMatches.length - 1][1];
        const amountStr = amountMatches[amountMatches.length - 2][1];
        const rowBalance = parseFloat(balanceStr.replace(/,/g, ''));
        const rowAmount = parseFloat(amountStr.replace(/,/g, ''));

        // Validation: Ensure amounts are reasonable (not concatenated)
        // If balance jumped by more than 10x the amount, likely a parsing error
        if (rowAmount > 1000000 || rowBalance > 10000000) {
          pendingLineDesc += ' ' + content;
          continue;
        }

        // Clean Desc
        let desc = content;
        const lastIdx = content.lastIndexOf(balanceStr);
        if (lastIdx > -1) desc = desc.substring(0, lastIdx).trim();
        const secondIdx = desc.lastIndexOf(amountStr);
        if (secondIdx > -1) desc = desc.substring(0, secondIdx).trim();

        if (pendingLineDesc) { desc = pendingLineDesc + ' ' + desc; pendingLineDesc = ''; }

        rawRows.push({
          type: 'ANCHOR',
          date: dateStr || pendingLineDate || this.formatDate(1, 'Jan', currentYear),
          description: this.cleanRBCDescription(desc),
          amount: rowAmount,
          balance: rowBalance,
          line: line
        });
        pendingLineDesc = ''; // Reset
      } else if (amountMatches.length === 1) {
        // Gap Row (Amount only, No balance)
        const amountStr = amountMatches[0][1];
        const rowAmount = parseFloat(amountStr.replace(/,/g, ''));

        // Validation
        if (rowAmount > 1000000) {
          pendingLineDesc += ' ' + content;
          continue;
        }

        let desc = content.replace(amountStr, '').trim();
        if (pendingLineDesc) { desc = pendingLineDesc + ' ' + desc; pendingLineDesc = ''; }

        rawRows.push({
          type: 'GAP',
          date: dateStr || pendingLineDate || this.formatDate(1, 'Jan', currentYear),
          description: this.cleanRBCDescription(desc),
          amount: rowAmount,
          line: line
        });
        pendingLineDesc = '';
      } else {
        // Description continuation
        if (content.length > 3) pendingLineDesc += ' ' + content;
      }
    }

    // Pass 2: Solve Gaps (The "Sudoku" Logic)
    let runningBalance = openingBalance || 0;
    let gapBuffer = [];

    // Helper: Solve a batch of gaps given start/end balances
    const solveGapBatch = (startBal, endBal, gaps) => {
      // Try all permutations of Debit/Credit for gaps
      // Optimization: Limit to 2^12 (4096) to prevent freezing. If > 12, use Keyword Fallback.
      if (gaps.length > 12) {
        return gaps.map(g => ({ ...g, isCredit: this.isCredit(g.description) }));
      }

      const count = gaps.length;
      const perms = 1 << count; // 2^N

      for (let i = 0; i < perms; i++) {
        let tempBal = startBal;
        for (let j = 0; j < count; j++) {
          const isCred = (i >> j) & 1;
          if (isCred) tempBal += gaps[j].amount;
          else tempBal -= gaps[j].amount;
        }

        // Check if matches endBal (with floating point tolerance)
        if (Math.abs(tempBal - endBal) < 0.05) {
          // FOUND SOLUTION!
          return gaps.map((g, idx) => ({
            ...g,
            isCredit: !!((i >> idx) & 1)
          }));
        }
      }

      // No solution found? Fallback to keywords
      return gaps.map(g => ({ ...g, isCredit: this.isCredit(g.description) }));
    };

    const processBuffer = (targetBalance) => {
      if (gapBuffer.length === 0) return;

      const solved = solveGapBatch(runningBalance, targetBalance, gapBuffer);

      solved.forEach(g => {
        // Update running balance naturally
        if (g.isCredit) runningBalance += g.amount;
        else runningBalance -= g.amount;

        const _auditRef1 = _makeAuditRef(g.line, lineMetadata);
        transactions.push({
          date: g.date,
          description: g.description,
          amount: g.amount,
          debit: g.isCredit ? 0 : g.amount,
          credit: g.isCredit ? g.amount : 0,
          balance: runningBalance,
          _brand: 'RBC', _tag: 'Savings',
          parser_ref: _auditRef1.parser_ref,
          pdfLocation: _auditRef1.pdfLocation,
          audit: _auditRef1.audit,
        });
      });
      gapBuffer = [];
    };

    // Main Processing Loop
    for (const row of rawRows) {
      if (row.type === 'ANCHOR') {
        // Solve gaps BEFORE this anchor (using anchor balance as target)
        if (gapBuffer.length > 0) {
          const solvedBatch = solveGapBatch(runningBalance, row.balance, gapBuffer);

          solvedBatch.forEach(g => {
            // Update running balance
            if (g.isCredit) runningBalance += g.amount;
            else runningBalance -= g.amount;

            const _auditRef2 = _makeAuditRef(g.line, lineMetadata);
            transactions.push({
              date: g.date,
              description: g.description,
              amount: g.amount,
              debit: g.isCredit ? 0 : g.amount,
              credit: g.isCredit ? g.amount : 0,
              balance: runningBalance,
              _brand: 'RBC', _tag: 'Savings', _accountType: 'SAVINGS',
              parser_ref: _auditRef2.parser_ref,
              pdfLocation: _auditRef2.pdfLocation,
              audit: _auditRef2.audit,
            });
          });
          gapBuffer = [];
        }

        // Now process the anchor itself
        const isCredit = this.isCredit(row.description);
        if (isCredit) runningBalance += row.amount;
        else runningBalance -= row.amount;

        // Sync to anchor balance if there's drift
        if (Math.abs(runningBalance - row.balance) > 0.05) {
          runningBalance = row.balance;
        }

        const _auditRef3 = _makeAuditRef(row.line, lineMetadata);
        transactions.push({
          date: row.date,
          description: row.description,
          amount: row.amount,
          debit: isCredit ? 0 : row.amount,
          credit: isCredit ? row.amount : 0,
          balance: runningBalance,
          _brand: 'RBC', _tag: 'Savings', _accountType: 'SAVINGS',
          parser_ref: _auditRef3.parser_ref,
          pdfLocation: _auditRef3.pdfLocation,
          audit: _auditRef3.audit,
        });

      } else {
        // Gap Row - Buffer it
        gapBuffer.push(row);
      }
    }

    // Handle Trailing Gaps (no closing anchor)
    if (gapBuffer.length > 0) {
      gapBuffer.forEach(g => {
        const isCredit = this.isCredit(g.description);
        if (isCredit) runningBalance += g.amount;
        else runningBalance -= g.amount;

        const _auditRef4 = _makeAuditRef(g.line, lineMetadata);
        transactions.push({
          date: g.date,
          description: g.description,
          amount: g.amount,
          debit: isCredit ? 0 : g.amount,
          credit: isCredit ? g.amount : 0,
          balance: runningBalance,
          _brand: 'RBC', _tag: 'Savings',
          parser_ref: _auditRef4.parser_ref,
          pdfLocation: _auditRef4.pdfLocation,
          audit: _auditRef4.audit,
        });
      });
    }

    return {
      transactions,
      metadata: this.metadata,
      openingBalance: openingBalance || 0
    };
  }

  /**
   * Extract a transaction from a line if it has an amount
   */
  extractTransaction(text, dateStr, fullLine = null, meta) {
    if (!text) return null;

    // Pattern: Description ending with Amount Balance
    // Example: "e-Transfer - Autodeposit COMPANY   1,234.56   67,890.12"
    const twoAmountMatch = text.match(/([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/);
    const singleAmountMatch = text.match(/([\d,]+\.\d{2})$/);

    let amount = 0;
    let balance = 0;
    let description = text;

    if (twoAmountMatch) {
      amount = parseFloat(twoAmountMatch[1].replace(/,/g, ''));
      balance = parseFloat(twoAmountMatch[2].replace(/,/g, ''));
      description = text.replace(twoAmountMatch[0], '').trim();
    } else if (singleAmountMatch) {
      amount = parseFloat(singleAmountMatch[1].replace(/,/g, ''));
      description = text.replace(singleAmountMatch[0], '').trim();
    } else {
      return null; // No amount found
    }

    // Clean the description
    description = this.cleanRBCDescription(description);

    // Determine debit vs credit
    const isCredit = this.isCredit(description);

    // [PHASE 4] Spatial Metadata Lookup
    let auditData = null;

    // Use the RAW line text (fullLine or text) to find the matching lineMetadata
    // This is the original PDF line before any reformatting
    const searchLine = fullLine || text;

    if (this.lastLineMetadata && this.lastLineMetadata.length > 0 && searchLine) {
      // Extract key parts of the line for fuzzy matching
      // Remove extra whitespace but keep the structure
      const normalizedSearch = searchLine.replace(/\s+/g, ' ').trim();

      // Try exact match first (with whitespace normalization)
      for (const lineMeta of this.lastLineMetadata) {
        if (!lineMeta.text) continue;

        const normalizedMeta = lineMeta.text.replace(/\s+/g, ' ').trim();

        // Check if the search line is contained in (or contains) the metadata line
        // This handles cases where lines might be split differently
        if (normalizedMeta.includes(normalizedSearch) || normalizedSearch.includes(normalizedMeta)) {
          auditData = {
            page: lineMeta.page,
            y: lineMeta.y,
            height: lineMeta.height || 12
          };
          break;
        }
      }

      // If no exact match, try partial match using distinctive parts
      if (!auditData) {
        // Extract the most distinctive part: the description (before any amount)
        const descPart = searchLine.replace(/[\d,]+\.?\d*\s*$/g, '').trim();

        if (descPart.length > 10) { // Only try if we have meaningful text
          for (const lineMeta of this.lastLineMetadata) {
            if (!lineMeta.text) continue;

            // Look for the description part in the metadata
            if (lineMeta.text.includes(descPart.substring(0, Math.min(30, descPart.length)))) {
              auditData = {
                page: lineMeta.page,
                y: lineMeta.y,
                height: lineMeta.height || 12
              };
              break;
            }
          }
        }
      }

      // Last resort: try matching by amount only if it's a distinctive amount
      if (!auditData && amount && amount > 10) { // Avoid matching common small amounts
        const amountStr = amount.toFixed(2).replace(/\.00$/, '');
        for (const lineMeta of this.lastLineMetadata) {
          if (lineMeta.text && lineMeta.text.includes(amountStr)) {
            auditData = {
              page: lineMeta.page,
              y: lineMeta.y,
              height: lineMeta.height || 12
            };
            break;
          }
        }
      }
    }

    // [PHASE 5] Multi-line Height Calculation
    // If we have audit data, check if the transaction spans multiple lines
    if (auditData) {
      // Estimate line count from raw text
      const lineCount = (fullLine || text).split('\n').length;

      // Store lineCount for Smart Popper cropping
      auditData.lineCount = lineCount;

      if (lineCount > 1) {
        // Expand height to cover multiple lines (approx 12-14px per line)
        auditData.height = Math.max(auditData.height, lineCount * 14);
      }
      // Also check description length as a backup (RBC descriptions can be long)
      else if (description.length > 80) {
        auditData.height = Math.max(auditData.height, 28); // Assume 2 lines
        if (auditData.lineCount < 2) auditData.lineCount = 2;
      }
    }

    const finalTxn = {
      date: dateStr,
      description: description,
      amount: amount,
      debit: isCredit ? 0 : amount,
      credit: isCredit ? amount : 0,
      balance: balance,
      _inst: this.metadata?.institutionCode || '003',
      _transit: this.metadata?.transit || '-----',
      _acct: this.metadata?.accountNumber || '-----',
      _brand: 'RBC',
      _bank: 'RBC',
      _tag: 'Savings',
      _accountType: 'SAVINGS',
      rawText: (() => {
        // Get the line without balance
        const lineWithoutBalance = fullLine ? fullLine.replace(/\s+[\d,]+\.\d{2}$/, '').trim() : text;

        // If line already starts with date, use as-is
        if (lineWithoutBalance.match(/^\d{1,2}\s+\w{3}/)) {
          return lineWithoutBalance;
        }

        // Otherwise prepend formatted date from dateStr (YYYY-MM-DD format)
        const dateParts = dateStr.split('-');
        if (dateParts.length === 3) {
          const day = parseInt(dateParts[2]);
          const monthIndex = parseInt(dateParts[1]) - 1;
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const formattedDate = `${day.toString().padStart(2, '0')} ${monthNames[monthIndex]} `;
          return `${formattedDate}   ${lineWithoutBalance} `;
        }

        return lineWithoutBalance;
      })(),
      audit: auditData
    };

    // DEBUG: Log audit data for inspection

    return finalTxn;
  }

  getMonthIndex(monthName) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    return months.indexOf(monthName.toLowerCase().substring(0, 3));
  }

  formatDate(day, monthName, year) {
    const month = this.getMonthIndex(monthName) + 1;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  isCredit(description) {
    const creditKeywords = /DEPOSIT|CREDIT|REFUND|PAYROLL|TRANSFER\s+FROM|E-TRANSFER.*RECEIVED|INTERAC.*REC|DIRECT\s+DEPOSIT|AUTODEPOSIT/i;
    return creditKeywords.test(description);
  }

  cleanRBCDescription(desc) {
    // console.log('[RBC] cleanRBCDescription CALLED with:', JSON.stringify(desc));
    // =====================================================
    // RBC DESCRIPTION CLEANUP & REFORMATTING
    // Goal: Convert "Type Name Garbage" → "Name, Type"
    // Uses Scotia-inspired prefix matching for consistency
    // =====================================================

    // 0. EARLY NORMALIZATION: Collapse all whitespace/newlines into single spaces
    desc = desc.replace(/\s+/g, ' ').trim();

    // 1. HARD RULE: AGGRESSIVE DATE REMOVAL (User Request)
    // Matches "09 Jun", "15 Jan", "4 Jul", etc. anywhere in the string
    desc = desc.replace(/\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/gi, '');
    // Matches "06/05", "10/12" (only if standalone to avoid fraction confusion, though rare in desc)
    desc = desc.replace(/\b\d{2}\/\d{2}\b/g, '');
    // Matches "YYYY" (2023, 2024...)
    desc = desc.replace(/\b20\d{2}\b/g, '');
    // Remove "continued" artifacts
    desc = desc.replace(/continued\s+/gi, '');
    desc = desc.replace(/to\s+-\s+/gi, ''); // Fix "to - continued" artifact

    // 2. REMOVE GIBBERISH CODES (Aggressive & Case-Insensitive)
    desc = desc.replace(/C1A[a-zA-Z0-9]{4,}/gi, '');
    desc = desc.replace(/CA[a-zA-Z0-9]{5,}/gi, '');
    desc = desc.replace(/[a-f0-9]{16,}/gi, '');
    desc = desc.replace(/[\w.-]+@[\w.-]+\b/g, ''); // Email fix
    desc = desc.replace(/\b\d{6,}\b/gi, ''); // Long numbers
    desc = desc.replace(/\b(\d{5,})\s+\1\b/gi, ''); // Duplicate numbers

    // 2.2. SYSTEMATIC GARBAGE REMOVAL
    // 2.2. SYSTEMATIC GARBAGE REMOVAL
    // Removes the long bank address prefix found in many RBC transactions
    // Matches: "P.O. BAG SERVICE 2650 AB T2P 2 M7" (with flexible spacing/dots)
    // Also handling the "to July 5," context often following it
    const bagServiceRegex = /(?:ROYAL\s+BANK\s+OF\s+CANADA\s+)?P\.?O\.?\s+BAG\s+SERVICE\s+\d+\s+AB\s+[A-Z0-9\s]+/gi;
    desc = desc.replace(bagServiceRegex, '').trim();

    // Remove "to [Month] [Day]" prefix that remains (e.g. "to July 5,")
    desc = desc.replace(/^to\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s*/i, '');
    desc = desc.replace(/^to\s+/i, ''); // plain "to" remnant

    // 2.5. SPECIFIC OVERRIDES (High Priority)
    desc = desc.replace(/Continued\s+[A-Z]{3}.*?Details/gi, '');
    desc = desc.replace(/Account Activity Details/gi, '');
    desc = desc.replace(/Royal Bank of Canada/gi, '');
    desc = desc.replace(/Your account activity details/gi, '');

    const descUpper = desc.toUpperCase();

    // 3. PREFIX MATCHING & REFORMATTING (RBC Format: "Type - Name" -> "Name, Type")
    // Specific logic for E-Transfers to ensure 2-line display in Grid (via comma)

    // Pattern: "e-Transfer - Autodeposit [NAME]"
    if (descUpper.includes('E-TRANSFER') || descUpper.includes('AUTODEPOSIT')) {
      // Extract Name: Remove "e-Transfer", "Autodeposit", "Sent", "Received"
      let name = desc.replace(/e-Transfer/gi, '')
        .replace(/Autodeposit/gi, '')
        .replace(/Sent/gi, '')
        .replace(/Received/gi, '')
        .replace(/ - /g, '')
        .replace(/RBC/g, '') // Remove RBC prefix artifacts
        .trim();

      // Force Comma for Grid splitting
      return `${name}, E-Transfer - Autodeposit`;
    }

    // Pattern: "Online Banking payment - [NAME]"
    if (descUpper.includes('ONLINE BANKING PAYMENT') || descUpper.includes('ONLINE BANKING TRANSFER')) {
      let name = desc.replace(/Online Banking payment/gi, '')
        .replace(/Online Banking transfer/gi, '')
        .replace(/ - /g, '')
        .replace(/^\d+\s+/, '') // Remove leading account digits often found here
        .trim();
      return `${name}, Online Banking Payment`;
    }

    // Rule for Account Fees
    if (descUpper.includes('TO ACCOUNT FEES') || descUpper.includes('MONTHLY FEE')) {
      return `Account Fees, RBC Service Charge`;
    }

    // Rule for Overdraft Interest
    if (descUpper.includes('OVERDRAFT INTEREST')) {
      return `Overdraft Interest, RBC Lending`;
    }

    // 4. FALLBACK: Split on dash if no prefix matched but dash exists
    if (!desc.includes(',') && desc.includes(' - ')) {
      const parts = desc.split(' - ');
      if (parts.length === 2) {
        // Format: "Type - Name" → "Name, Type"
        desc = `${parts[1].trim()}, ${parts[0].trim()}`;
      }
    }

    // 5. Final cleanup
    desc = desc.replace(/,\s*,/g, ','); // Remove double commas
    desc = desc.replace(/\s+/g, ' ').trim();
    desc = desc.replace(/^[,\s]+|[,\s]+$/g, ''); // Trim leading/trailing commas and spaces

    return desc;
  }
}

// Expose to window for file:// compatibility
window.RBCSavingsParser = RBCSavingsParser;
window.rbcSavingsParser = new RBCSavingsParser();
