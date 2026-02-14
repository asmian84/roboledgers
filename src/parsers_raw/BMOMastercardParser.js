/**
 * BMO Mastercard Parser
 * Regex-based parser for BMO Mastercard statements
 */
class BMOMastercardParser extends BaseBankParser {
  constructor() {
    const formatRules = `
BMO MASTERCARD FORMAT:
- Date format: MMM DD (e.g., Apr 01, May 16)
- Credit card: Debit = charges, Credit = payments
- Transaction types: PAYMENT RECEIVED, PURCHASE, CASH ADVANCE, INTEREST, FEE
    `;
    super('BMO', 'Mastercard', formatRules);
  }

  async parse(statementText, metadata = null, lineMetadata = []) {
    this.lastLineMetadata = lineMetadata;
    // LOUD DIAGNOSTIC
    console.warn('⚡ [EXTREME-BMO-MC] Starting metadata extraction for BMO Mastercard...');
    console.error('📄 [DEBUG-BMO-MC] First 1000 characters (RED for visibility):');
    console.log(statementText.substring(0, 1000));

    const lines = statementText.split('\n');
    // Extract balances using base helper
    const { openingBalance, closingBalance, statementPeriod } = this.extractBalances(statementText);
    console.log(`[BMO-MC] Extracted opening balance: ${openingBalance}`);

    const transactions = [];

    // EXTRACT METADATA (Institution, Transit, Account)
    const acctMatch = statementText.match(/(?:Account)[:#]?\s*([\d-]{7,})/i);
    const parsedMetadata = {
      _acct: acctMatch ? acctMatch[1].replace(/[-\s]/g, '') : '-----',
      accountNumber: acctMatch ? acctMatch[1].replace(/[-\s]/g, '') : '-----',
      _tag: 'Mastercard',
      cardNetwork: 'Mastercard',
      accountType: 'CreditCard',
      bankName: 'BMO',
      // Dual-icon system
      bankIcon: 'BMO',
      networkIcon: 'MC',
      // Legacy branding
      brand: 'MC',
      bankCode: 'MC',
      institution: 'MC'
    };
    console.warn('🏁 [BMO-MC] Extraction Phase Complete. Transit:', parsedMetadata.transit, 'Acct:', parsedMetadata.accountNumber);

    const yearMatch = statementText.match(/20\d{2}/);
    const currentYear = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

    const dateRegex = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i;
    const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

    let pendingDescription = '';
    let pendingRawLines = [];
    let pendingAuditLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed || trimmed.match(/Opening Balance|Previous Balance|Page \d/i)) continue;

      const dateMatch = trimmed.match(dateRegex);
      if (dateMatch) {
        const isoDate = `${currentYear}-${monthMap[dateMatch[1].toLowerCase()]}-${dateMatch[2].padStart(2, '0')}`;
        const remainder = trimmed.substring(dateMatch[0].length).trim();

        const extracted = this.extractTransaction(remainder, isoDate, line);
        if (extracted && extracted.amount) {
          if (pendingDescription) {
            extracted.description = pendingDescription + ' ' + extracted.description;
            extracted.rawText = [...pendingRawLines, extracted.rawText].join('\n');
            if (extracted.audit) {
              extracted.audit = this.mergeAuditMetadata([...pendingAuditLines, extracted.audit]);
            }
          }
          transactions.push(extracted);
          pendingDescription = '';
          pendingRawLines = [];
          pendingAuditLines = [];
        } else {
          // Start of multi-line
          pendingDescription = remainder;
          pendingRawLines = [line];
          pendingAuditLines = [this.getSpatialMetadata(line)];
        }
      } else if (pendingDescription && trimmed.length > 3) {
        // Continuation or maybe amount on this line
        const extracted = this.extractTransaction(trimmed, '', line);
        if (extracted && extracted.amount) {
          extracted.date = transactions[transactions.length - 1]?.date || '1900-01-01';
          extracted.description = pendingDescription + ' ' + extracted.description;
          extracted.rawText = [...pendingRawLines, line].join('\n');
          extracted.audit = this.mergeAuditMetadata([...pendingAuditLines, this.getSpatialMetadata(line)]);
          transactions.push(extracted);
          pendingDescription = '';
          pendingRawLines = [];
          pendingAuditLines = [];
        } else {
          pendingDescription += ' ' + trimmed;
          pendingRawLines.push(line);
          pendingAuditLines.push(this.getSpatialMetadata(line));
        }
      }
    }


    console.log(`[BMO-MC] Parsed ${transactions.length} transactions`);
    return { transactions, metadata: parsedMetadata, openingBalance, closingBalance, statementPeriod };
  };


  extractTransaction(text, isoDate, originalLine) {
    const amounts = text.match(/([\d,]+\.\d{2})/g);
    if (!amounts || amounts.length < 1) return null;

    const firstAmtIdx = text.search(/[\d,]+\.\d{2}/);
    let description = text.substring(0, firstAmtIdx).trim();

    description = this.cleanCreditDescription(description, [
      "PAYMENT RECEIVED", "PURCHASE", "CASH ADVANCE",
      "INTEREST", "FEE", "FOREIGN TRANSACTION FEE"
    ]);

    const amount = parseFloat(amounts[0].replace(/,/g, ''));
    const balance = amounts.length > 1 ? parseFloat(amounts[amounts.length - 1].replace(/,/g, '')) : 0;
    const isPayment = /payment|credit|refund/i.test(description);

    const auditData = this.buildAuditData(originalLine, 'BMOMastercardParser');

    return {
      date: isoDate,
      description,
      amount,
      debit: isPayment ? amount : 0,    // Payments REDUCE liability (debit)
      credit: isPayment ? 0 : amount,   // Purchases INCREASE liability (credit)
      balance,
      rawText: this.cleanRawText(originalLine),
      pdfLocation: auditData.pdfLocation,
      audit: auditData.audit
    };
  }

  cleanCreditDescription(desc, prefixes) {
    desc = desc.replace(/\s+/g, ' ').trim();
    desc = desc.replace(/\b\d{6,}\b/gi, '');

    const descUpper = desc.toUpperCase();
    for (const type of prefixes) {
      if (descUpper.startsWith(type + ' ')) {
        const name = desc.substring(type.length).trim();
        if (name) desc = `${name}, ${type.charAt(0) + type.slice(1).toLowerCase()} `;
        break;
      }
    }

    if (!desc.includes(',') && desc.includes(' - ')) {
      const parts = desc.split(' - ');
      desc = `${parts[1].trim()}, ${parts[0].trim()} `;
    }

    return desc.replace(/,\s*,/g, ',').trim();
  }
}

window.BMOMastercardParser = BMOMastercardParser;
window.bmoMastercardParser = new BMOMastercardParser();
