/**
 * RoboLedger V5: Core Ledger Engine (Browser Port)
 * Responsibility: Truth Vault, Ingestion, and UI Projections.
 * This file ports the hardened logic from the TS core into a browser-native implementation.
 */

window.RoboLedger = (function () {

    // --- TYPES & CONSTANTS ---
    const TransactionStatus = {
        RAW: 'RAW',
        PREDICTED: 'PREDICTED',
        CONFIRMED: 'CONFIRMED',
        RECONCILED: 'RECONCILED',
        LOCKED: 'LOCKED',
        VOIDED: 'VOIDED'
    };

    const Polarity = {
        DEBIT: 'DEBIT',
        CREDIT: 'CREDIT'
    };

    const STORAGE_KEY = 'roboledger_v5_data';

    // --- STATE ---
    let state = {
        transactions: {}, // tx_id -> tx
        sigIndex: {},    // txsig -> tx_id
        accounts: [
            { id: 'ACC-001', name: 'RBC Royal Bank', type: 'CHECKING', balance: 12500.50, openingBalance: 12500.50, inst: '003', transit: '12345', accountNumber: '8822991', ref: 'CHQ1' }
        ],
        coa: {},         // account_code -> entry
        categoryPredictions: {}, // raw_desc -> account_code
        fileStorage: new Map()   // fileId -> Blob (In-memory for v5.1)
    };

    // --- COA DATA (V5 PRE-SEED) ---
    const COA_DEFAULTS = [
        // ASSETS (1000 - 1999)
        { code: '1000', name: 'Bank - chequing', class: 'CASH_LIQ', root: 'ASSET', balance: 0 },
        { code: '1030', name: 'Bank - US account', class: 'CASH_LIQ', root: 'ASSET', balance: 0 },
        { code: '1035', name: 'Savings account', class: 'CASH_LIQ', root: 'ASSET', balance: 0 },
        { code: '1040', name: 'Savings account #2', class: 'CASH_LIQ', root: 'ASSET', balance: 0 },
        { code: '1100', name: 'Investments - Marketable securities', class: 'INVEST_ST', root: 'ASSET', balance: 0 },
        { code: '1210', name: 'Accounts receivable', class: 'AR_TRADE', root: 'ASSET', balance: 0 },
        { code: '1220', name: 'Accounts receivable-employee loan', class: 'AR_OTHER', root: 'ASSET', balance: 0 },
        { code: '1221', name: 'Advances', class: 'AR_OTHER', root: 'ASSET', balance: 0 },
        { code: '1240', name: 'Interest receivable', class: 'AR_OTHER', root: 'ASSET', balance: 0 },
        { code: '1245', name: 'Loans receivable - current', class: 'AR_OTHER', root: 'ASSET', balance: 0 },
        { code: '1250', name: 'NSF cheques', class: 'AR_OTHER', root: 'ASSET', balance: 0 },
        { code: '1255', name: 'Allowance for doubtful accounts', class: 'AR_CONTRA', root: 'ASSET', balance: 0 },
        { code: '1260', name: 'Agreement of sale', class: 'AR_OTHER', root: 'ASSET', balance: 0 },
        { code: '1270', name: 'Prepaid Expenses', class: 'PREPAID', root: 'ASSET', balance: 0 },
        { code: '1500', name: 'Furniture & Equipment', class: 'PPE', root: 'ASSET', balance: 0 },
        { code: '1550', name: 'Accumulated Depreciation', class: 'PPE_CONTRA', root: 'ASSET', balance: 0 },

        // LIABILITIES (2000 - 2999)
        { code: '2100', name: 'Accounts Payable', class: 'AP_TRADE', root: 'LIABILITY', balance: 0 },
        { code: '2120', name: 'Credit Card - Primary', class: 'DEBT_ST', root: 'LIABILITY', balance: 0 },
        { code: '2125', name: 'Credit Card - Secondary', class: 'DEBT_ST', root: 'LIABILITY', balance: 0 },
        { code: '2150', name: 'GST/HST Payable', class: 'TAX_SALES', root: 'LIABILITY', balance: 0 },
        { code: '2160', name: 'PST Payable', class: 'TAX_SALES', root: 'LIABILITY', balance: 0 },
        { code: '2200', name: 'Accrued Liabilities', class: 'ACCRUED', root: 'LIABILITY', balance: 0 },
        { code: '2400', name: 'Payroll Liabilities', class: 'ACCRUED', root: 'LIABILITY', balance: 0 },
        { code: '2410', name: 'WCB Payable', class: 'ACCRUED', root: 'LIABILITY', balance: 0 },
        { code: '2500', name: 'Corporate Income Tax Payable', class: 'TAX_INC', root: 'LIABILITY', balance: 0 },
        { code: '2600', name: 'Deferred Revenue', class: 'DEFERRED', root: 'LIABILITY', balance: 0 },
        { code: '2800', name: 'Loans from Shareholders', class: 'DEBT_ST', root: 'LIABILITY', balance: 0 },
        { code: '2900', name: 'Bank Loan - Long Term', class: 'DEBT_LT', root: 'LIABILITY', balance: 0 },

        // EQUITY (3000 - 3999)
        { code: '3000', name: 'Common Shares', class: 'EQUITY_CAP', root: 'EQUITY', balance: 0 },
        { code: '3100', name: 'Preferred Shares', class: 'EQUITY_CAP', root: 'EQUITY', balance: 0 },
        { code: '3200', name: 'Owner Contributions', class: 'EQUITY_CONTRIB', root: 'EQUITY', balance: 0 },
        { code: '3300', name: 'Owner Draws', class: 'EQUITY_DRAW', root: 'EQUITY', balance: 0 },
        { code: '3400', name: 'Opening Balance Equity', class: 'EQUITY_RE', root: 'EQUITY', balance: 0 },
        { code: '3500', name: 'Retained Earnings', class: 'EQUITY_RE', root: 'EQUITY', balance: 0 },
        { code: '3600', name: 'Dividends Paid', class: 'EQUITY_DRAW', root: 'EQUITY', balance: 0 },

        // REVENUE (4000 - 4999)
        { code: '4000', name: 'Sales Revenue', class: 'REV_OP', root: 'REVENUE', balance: 0 },
        { code: '4100', name: 'Consulting Income', class: 'REV_OP', root: 'REVENUE', balance: 0 },
        { code: '4200', name: 'Product Sales', class: 'REV_OP', root: 'REVENUE', balance: 0 },
        { code: '4300', name: 'Shipping Income', class: 'REV_OP_OTHER', root: 'REVENUE', balance: 0 },
        { code: '4400', name: 'Refunds and Allowances', class: 'REV_CONTRA', root: 'REVENUE', balance: 0 },
        { code: '4500', name: 'Interest Income', class: 'REV_NON_OP', root: 'REVENUE', balance: 0 },
        { code: '4600', name: 'Dividend Income', class: 'REV_NON_OP', root: 'REVENUE', balance: 0 },

        // EXPENSES (5000 - 9999)
        { code: '5000', name: 'Cost of Goods Sold', class: 'COGS', root: 'EXPENSE', balance: 0 },
        { code: '5100', name: 'Direct Labor', class: 'COGS', root: 'EXPENSE', balance: 0 },
        { code: '5200', name: 'Materials & Supplies', class: 'COGS', root: 'EXPENSE', balance: 0 },
        { code: '6000', name: 'Salaries & Wages', class: 'EXP_OP_SAL', root: 'EXPENSE', balance: 0 },
        { code: '6100', name: 'Employee Benefits', class: 'EXP_OP_SAL', root: 'EXPENSE', balance: 0 },
        { code: '6200', name: 'Rent or Lease', class: 'EXP_OP_G_A', root: 'EXPENSE', balance: 0 },
        { code: '6300', name: 'Utilities', class: 'EXP_OP_G_A', root: 'EXPENSE', balance: 0 },
        { code: '6400', name: 'Telephone & Internet', class: 'EXP_OP_G_A', root: 'EXPENSE', balance: 0 },
        { code: '6500', name: 'Insurance', class: 'EXP_OP_G_A', root: 'EXPENSE', balance: 0 },
        { code: '6600', name: 'Repair & Maintenance', class: 'EXP_OP_G_A', root: 'EXPENSE', balance: 0 },
        { code: '7000', name: 'Advertising & Promotion', class: 'EXP_OP_G_A', root: 'EXPENSE', balance: 0 },
        { code: '7100', name: 'Marketing', class: 'EXP_OP_G_A', root: 'EXPENSE', balance: 0 },
        { code: '7200', name: 'Software & Subscriptions', class: 'EXP_OP_G_A', root: 'EXPENSE', balance: 0 },
        { code: '7300', name: 'Computer & Internet', class: 'EXP_OP_G_A', root: 'EXPENSE', balance: 0 },
        { code: '8100', name: 'Rent & Utilities', class: 'EXP_OP_G_A', root: 'EXPENSE', balance: 0 },
        { code: '8200', name: 'Automobile Expenses', class: 'EXP_OP_G_A', root: 'EXPENSE', balance: 0 },
        { code: '8300', name: 'Fuel', class: 'EXP_OP_G_A', root: 'EXPENSE', balance: 0 },
        { code: '8400', name: 'Office Supplies', class: 'EXP_OP_G_A', root: 'EXPENSE', balance: 0 },
        { code: '8500', name: 'Travel & Local Transportation', class: 'EXP_OP_G_A', root: 'EXPENSE', balance: 0 },
        { code: '8550', name: 'Meals & Entertainment', class: 'EXP_OP_G_A', root: 'EXPENSE', balance: 0 },
        { code: '8600', name: 'Dues & Subscriptions', class: 'EXP_OP_G_A', root: 'EXPENSE', balance: 0 },
        { code: '8700', name: 'Bank Charges', class: 'EXP_OP_FIN', root: 'EXPENSE', balance: 0 },
        { code: '8800', name: 'Bank & Interest Charges', class: 'EXP_OP_FIN', root: 'EXPENSE', balance: 0 },
        { code: '8900', name: 'Professional Fees (Accounting/Legal)', class: 'EXP_OP_G_A', root: 'EXPENSE', balance: 0 },
        { code: '9000', name: 'Depreciation Expense', class: 'EXP_NON_CASH', root: 'EXPENSE', balance: 0 }
    ];

    // --- STORAGE ENGINE ---
    function load() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                state.transactions = parsed.transactions || {};
                state.sigIndex = parsed.sigIndex || {};
                console.log('[LEDGER] State loaded.');
            } catch (e) {
                console.error('[LEDGER] Failed to load state', e);
            }
        }
    }

    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            transactions: state.transactions,
            sigIndex: state.sigIndex
        }));
    }

    // --- CRYPTO (txsig) ---
    async function generateTxSig(inputs) {
        const { account_id, date, amount_cents, currency, raw_description } = inputs;
        const source = [
            account_id,
            date,
            Math.abs(amount_cents).toString(),
            currency.toUpperCase(),
            raw_description.trim()
        ].join('|');

        const encoder = new TextEncoder();
        const data = encoder.encode(source);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // --- LEDGER SERVICE ---
    const Ledger = {
        post: function (tx) {
            if (state.sigIndex[tx.txsig]) {
                console.warn(`[LEDGER] DUPLICATE DETECTED: ${tx.txsig}`);
                return false;
            }
            state.transactions[tx.tx_id] = tx;
            state.sigIndex[tx.txsig] = tx.tx_id;
            save();
            return true;
        },

        getAll: function () {
            // Sort ASCENDING for benchmark parity (oldest first)
            const raw = Object.values(state.transactions).sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));

            let currentBalance = 0;
            return raw.map((tx, i) => {
                // Opening Balance Logic: Balance reflects state BEFORE this transaction
                tx.calculated_balance = currentBalance;

                // Update for next row's opening
                currentBalance += (tx.polarity === Polarity.CREDIT ? tx.amount_cents : -tx.amount_cents);

                return tx;
            });
        },

        get: function (tx_id) {
            return state.transactions[tx_id];
        },

        confirm: function (tx_id) {
            const tx = state.transactions[tx_id];
            if (tx && tx.status === TransactionStatus.PREDICTED) {
                tx.status = TransactionStatus.CONFIRMED;
                save();
                return true;
            }
            return false;
        },

        delete: function (tx_id) {
            if (state.transactions[tx_id]) {
                const sig = state.transactions[tx_id].txsig;
                delete state.transactions[tx_id];
                delete state.sigIndex[sig];
                save();
                return true;
            }
            return false;
        },

        save: function () {
            save();
            return true;
        },

        swapPolarity: function (tx_id) {
            const tx = state.transactions[tx_id];
            if (tx) {
                tx.polarity = tx.polarity === Polarity.DEBIT ? Polarity.CREDIT : Polarity.DEBIT;
                save();
                return true;
            }
            return false;
        },

        createManual: function (account_id) {
            const tx_id = crypto.randomUUID();
            const tx = {
                tx_id,
                account_id,
                ref: 'MANUAL',
                date: new Date().toISOString().split('T')[0],
                raw_description: 'NEW TRANSACTION  Forensic Entry',
                amount_cents: 0,
                balance_cents: 0,
                currency: 'CAD',
                polarity: Polarity.DEBIT,
                status: TransactionStatus.RAW,
                category_name: 'UNCATEGORIZED',
                txsig: 'man-' + tx_id,
                created_at: new Date().toISOString()
            };
            state.transactions[tx_id] = tx;
            save();
            return tx;
        },
        reset: function () {
            state.transactions = {};
            state.sigIndex = {};
            save();
            console.log('[LEDGER] Core reset: All transactions purged.');
            return true;
        },
        getRawState: function () {
            return {
                transactions: state.transactions,
                sigIndex: state.sigIndex
            };
        }
    };

    // --- ACCOUNT SERVICE ---
    const Accounts = {
        getAll: function () {
            return state.accounts;
        },
        get: function (id) {
            return state.accounts.find(a => a.id === id);
        },
        updateMetadata: function (id, metadata) {
            const acc = this.get(id);
            if (acc) {
                acc.inst = metadata.id || acc.inst;
                acc.transit = metadata.transit || acc.transit;
                acc.name = metadata.name || acc.name;
                acc.accountNumber = metadata.accountNumber || acc.accountNumber || metadata.account_num;
                acc.accountType = metadata.accountType || acc.accountType;
                acc.period = metadata.period || acc.period;
                acc.holder = metadata.holder || acc.holder;
                acc.brand = metadata.brand || acc.brand;

                // SMART REF SELECTION: Don't stick with 'CHQ' if we know it's a CC
                if (acc.brand === 'MASTERCARD' && acc.ref === 'CHQ1') acc.ref = 'MC1';
                else if (acc.brand === 'VISA' && acc.ref === 'CHQ1') acc.ref = 'VISA1';
                else if (acc.brand === 'AMEX' && acc.ref === 'CHQ1') acc.ref = 'AMEX1';

                save();
            }
        },
        setOpeningBalance: function (id, amountCents) {
            const acc = this.get(id);
            if (acc) {
                acc.openingBalance = amountCents / 100;
                save();
            }
        },
        setRef: function (id, newRef) {
            const acc = this.get(id);
            if (!acc) return { success: false, error: 'Account not found' };

            // Check uniqueness
            const exists = state.accounts.some(a => a.id !== id && a.ref.toUpperCase() === newRef.toUpperCase());
            if (exists) return { success: false, error: 'Reference already in use' };

            acc.ref = newRef.toUpperCase();
            save();
            return { success: true };
        },
        getFile: function (id) {
            return state.fileStorage.get(id);
        },
        storeFile: function (blob) {
            const id = 'file-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
            state.fileStorage.set(id, blob);
            return id;
        }
    };

    // --- INGESTION SERVICE ---
    const Ingestion = {
        /**
         * Minimal CSV Parser for the demo/live system
         */
        parseCSV: function (text) {
            const lines = text.split('\n').filter(l => l.trim());
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

            return lines.slice(1).map(line => {
                const values = line.split(',').map(v => v.trim());
                const entry = {};
                headers.forEach((h, i) => entry[h] = values[i]);
                return entry;
            });
        },

        /**
         * PDF.js Text Extraction (Forensic Reconstruction)
         */
        extractTextFromPDF: async function (arrayBuffer) {
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                fullText += content.items.map(item => item.str).join(' ') + '\n';
            }
            return fullText;
        },

        /**
         * Smart Regex Parsers (RBC Example)
         */
        parsePDFText: function (text) {
            console.log("[FORENSICS] Scanning PDF text segment (First 200 chars):", text.substring(0, 200));
            const transactions = [];

            // Matches RBC Pattern: D MMM (7 May) | Description | Amount
            const rbcRegex = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))\s+([^\n\r]*?)\s+(-?[\d,]+\.\d{2})/gi;

            // Matches Mastercard Pattern: (Posting Date) (Activity Date) | Description | LongRef | Amount
            // Example: MAR 25   MAR 26   COSTCO CANADA ... 55134424085800182155271  $704.36
            const mcRegex = /([A-Z]{3})\s+(\d{1,2})\s+[A-Z]{3}\s+\d{1,2}\s+(.*?)\s+(\d{12,})\s+(-?\$[\d,]+\.\d{2}|-?[\d,]+\.\d{2}(?!\s*%))/gi;

            let match;
            // 1. Scan for RBC Standard Deposits/Verbs
            while ((match = rbcRegex.exec(text)) !== null) {
                transactions.push({
                    date: match[1].trim() + ' 2024',
                    description: match[2].trim(),
                    amount: parseFloat(match[3].replace(/[$,]/g, '')),
                    ref: null
                });
            }

            // 2. Scan for Mastercard Signature (Business Dash)
            if (transactions.length === 0) {
                while ((match = mcRegex.exec(text)) !== null) {
                    const monthRaw = match[1].toLowerCase();
                    const day = match[2].padStart(2, '0');
                    const desc = match[3].trim();
                    const amountStr = match[5].replace(/[$,]/g, '');

                    const month = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1);

                    transactions.push({
                        date: `${day} ${month} 2024`,
                        description: desc,
                        amount: parseFloat(amountStr),
                        ref: match[4].substring(match[4].length - 6)
                    });
                }
            }

            console.log(`[FORENSICS] Identified ${transactions.length} potential transitions.`);
            return transactions;
        },

        /**
         * Institutional Fingerprinting (Transit/Inst/Account Detection)
         */
        detectInstitution: function (text) {
            const up = text.toUpperCase();

            // IIN / Brand Intelligence (Handles Masked Numbers ****)
            const brands = [
                { name: 'VISA', pattern: /4[\d\*]{3}[\s-]?[\d\*]{4}[\s-]?[\d\*]{4}[\s-]?[\d\*]{4}/, digits: 16 },
                { name: 'MASTERCARD', pattern: /5[1-5][\d\*]{2}[\s-]?[\d\*]{4}[\s-]?[\d\*]{4}[\s-]?[\d\*]{4}/, digits: 16 },
                { name: 'AMEX', pattern: /3[47][\d\*]{2}[\s-]?[\d\*]{6}[\s-]?[\d\*]{5}/, digits: 15 }
            ];

            let matchedBrand = null;
            let matchedAcc = null;

            // Sort by occurrence position to get the ACTUAL card number (not references)
            let bestMatch = null;
            for (const b of brands) {
                const results = [...text.matchAll(new RegExp(b.pattern, 'g'))];
                if (results.length > 0) {
                    // Use the last match in the header section (usually the specific card number)
                    const m = results[results.length - 1];
                    matchedBrand = b.name;
                    matchedAcc = m[0].replace(/[\s-]/g, '');
                    break;
                }
            }

            const markers = {
                '003': { name: 'RBC Royal Bank', anchors: ['ROYAL BANK', 'RBC', 'Transit'], transitRegex: /TRANSIT\s*(\d{5})/i },
                '001': { name: 'BMO Bank of Montreal', anchors: ['BMO', 'MONTREAL'], transitRegex: /TRANSIT\s*(\d{5})/i },
                '004': { name: 'TD Canada Trust', anchors: ['TD CANADA'], transitRegex: /STRATFORD\s*(\d{5})/i }
            };

            for (const [id, info] of Object.entries(markers)) {
                const foundAnchor = info.anchors.some(a => up.includes(a));
                if (foundAnchor || text.includes(`INSTITUTION ${id}`)) {
                    const transitMatch = text.match(info.transitRegex);

                    let finalName = info.name;
                    if (matchedBrand) {
                        // Advanced Branding Logic
                        if (up.includes('AVION')) finalName = `${info.name} AVION ${matchedBrand}`;
                        else if (up.includes('PASSPORT')) finalName = `${info.name} PASSPORT ${matchedBrand}`;
                        else if (up.includes('BUSINESS CASH BACK')) finalName = `${info.name} Business Cash Back ${matchedBrand}`;
                        else finalName = `${info.name} ${matchedBrand}`;
                    }

                    return {
                        id,
                        name: finalName,
                        brand: matchedBrand,
                        accountNumber: matchedAcc,
                        transit: transitMatch ? transitMatch[1] : 'UNKNOWN'
                    };
                }
            }

            if (matchedBrand) {
                return { id: 'CC', name: matchedBrand, brand: matchedBrand, accountNumber: matchedAcc, transit: 'N/A' };
            }

            return { id: '000', name: 'GENERIC PARSER', transit: 'UNKNOWN' };
        },

        processUpload: async function (file, account_id) {
            // Fix Ingestion Routing (Resolve 'ALL' to primary account)
            if (account_id === 'ALL') {
                const primary = Accounts.getAll()[0];
                account_id = primary ? primary.id : 'ACC-001';
            }

            let rows = [];
            let metadata = { name: 'CSV File', transit: 'N/A' };

            // Store the file blob for the workbench
            const sourceFileId = Accounts.storeFile(file);

            if (file.name.toLowerCase().endsWith('.pdf')) {
                const buffer = await file.arrayBuffer();
                const text = await this.extractTextFromPDF(buffer);

                metadata = this.detectInstitution(text);
                Accounts.updateMetadata(account_id, metadata);
                console.log(`[INGEST] DETECTED & UPDATED: ${metadata.name} (Transit: ${metadata.transit})`);

                rows = this.parsePDFText(text);
            } else {
                const text = await file.text();
                rows = this.parseCSV(text);
            }

            let importedCount = 0;

            for (const row of rows) {
                // Map common headers (CSV or PDF Regex)
                const date = row.date || row.transaction_date;
                const raw_description = row.description || row.memo || row.payee; // This is the Dirty Match
                const amount = parseFloat(row.amount || 0);

                if (!date || isNaN(amount)) continue;

                // CLEAN THE NAME
                const clean_description = Brain.cleanDescription(raw_description);

                const amount_cents = Math.round(amount * 100);
                const tx_id = crypto.randomUUID();

                const inputs = {
                    account_id,
                    date,
                    amount_cents,
                    currency: 'CAD',
                    raw_description: raw_description // Hash assumes original uniqueness
                };

                const txsig = await generateTxSig(inputs);

                // 3. Trigger Categorization Brain (Decision Layer)
                const predicted_code = Brain.predict(clean_description); // Predict based on clean name
                const category = predicted_code ? COA.get(predicted_code) : null;

                // SMARTER POLARITY DETECTION (V5.2.29 AUDIT)
                const isLiability = metadata.brand || /VISA|MC|AMEX|MASTERCARD|CREDIT/i.test(metadata.name);

                // 1. Initial polarity based on sign (Normal Assets: pos=Credit, neg=Debit)
                // For Credit Cards (Liabilities), we flip this: pos=Debit (Purchase), neg=Credit (Payment)
                let polarity;
                if (isLiability) {
                    polarity = amount_cents >= 0 ? Polarity.DEBIT : Polarity.CREDIT;
                } else {
                    polarity = amount_cents >= 0 ? Polarity.CREDIT : Polarity.DEBIT;
                }

                // 2. Keyword Heuristic (Override for ambiguous markers)
                const upperDesc = raw_description.toUpperCase();
                const debitKeywords = ['PURCHASE', 'WITHDRAWAL', 'DEBIT', 'TRANSFER TO', 'PAYMENT TO', 'INTEREST CHARGE', 'FEE', 'FX RATE'];
                const creditKeywords = ['DEPOSIT', 'TRANSFER FROM', 'PAYMENT RECEIVED', 'INTEREST EARNED', 'CREDIT', 'REFUND', 'PAYMENT - THANK YOU', 'PAIEMENT - MERCI', 'CASH BACK'];

                if (debitKeywords.some(k => upperDesc.includes(k))) {
                    polarity = Polarity.DEBIT;
                } else if (creditKeywords.some(k => upperDesc.includes(k))) {
                    polarity = Polarity.CREDIT;
                }

                const canonical = {
                    tx_id,
                    account_id,
                    date,
                    ref: row.ref || null, // Capture Ref# from parser
                    amount_cents: Math.abs(amount_cents),
                    currency: 'CAD',
                    polarity: polarity,
                    description: clean_description, // PRIMARY LINE (CLEAN)
                    raw_description: raw_description, // SECONDARY LINE (DIRTY)
                    sourceFileId: sourceFileId, // Link to workbench blob
                    txsig,
                    metadata: {
                        source: metadata.name,
                        transit: metadata.transit,
                        sub_detail: row.sub_detail || null
                    },
                    category_code: predicted_code || null,
                    category_name: category ? category.name : 'UNCATEGORIZED',
                    status: predicted_code ? TransactionStatus.PREDICTED : TransactionStatus.RAW,
                    version: 1,
                    created_at: new Date().toISOString()
                };

                if (Ledger.post(canonical)) {
                    importedCount++;
                }
            }

            return importedCount;
        }
    };

    // --- COA SERVICE ---
    const COA = {
        init: function () {
            COA_DEFAULTS.forEach(entry => state.coa[entry.code] = entry);
        },
        getAll: function () {
            return Object.values(state.coa);
        },
        get: function (code) {
            return state.coa[code];
        }
    };

    // --- CATEGORIZATION BRAIN ---
    const Brain = {
        rules: [
            { pattern: /adobe|google|aws|github/i, code: '4000' },
            { pattern: /starbucks|uber|tim hortons/i, code: '8500' },
            { pattern: /rent|lease|office/i, code: '8100' },
            { pattern: /salary|payroll|wage/i, code: '6000' },
            { pattern: /monthly fee|service charge/i, code: '8800' }
        ],

        predict: function (description) {
            for (const rule of this.rules) {
                if (rule.pattern.test(description)) {
                    return rule.code;
                }
            }
            return null; // Uncategorized
        },

        cleanDescription: function (text) {
            if (!text) return "";

            let clean = text;

            // Phase 1: RECURSIVE PREFIX STRIP (Action/Verb Layer)
            const prefixes = [
                /^e-Transfer\s*(?:sent|received|to|from|autodeposit)?\s*/gi,
                /^Online\s*Banking\s*transfer\s*-?\s*\d*/gi,
                /^Interac\s*e-Transfer\s*/gi,
                /^-?\s*Autodeposit\s*/gi,
                /^-?\s*Deposit\s+-\s*/gi,
                /^Pay\s+Employee-Vendor\s*/gi,
                /^Mobile\s+cheque\s+deposit\s*/gi,
                /^Direct\s+Deposits\s*\(PDS\)\s*service\s*total/gi,
                /^Misc\s*Payment\s*PAY-FILE\s*FEES/gi,
                /^Misc\s*Payment/gi,
                /^BR\s*TO\s*BR\s*-?\s*/gi,
                /^Vortex\s*Strip/gi,
                /^-+\s*/g
            ];

            prefixes.forEach(p => clean = clean.replace(p, ''));

            // Phase 2: TECHNICAL TRASH STRIP (Hash/ID Layer)
            // Only remove strings that look like actual hashes (have BOTH letters and numbers)
            clean = clean
                .replace(/\b(?=\w*\d)(?=\w*[a-z])[a-z0-9]{8,15}\b/gi, '') // Smart hash detection
                .replace(/\b[0-9]{10,20}\b/g, '')    // Long numeric sequences
                .replace(/continued\s*Date\s*Desc/gi, '');

            // Phase 3: LOCATION & METADATA STRIP (keep intact names)
            // Only strip trailing location/metadata, not split the core name
            clean = clean
                .replace(/,\s*[A-Z]{2,}\s*$/gi, '') // Strip trailing province codes
                .replace(/#\d+$/g, '');              // Strip trailing store numbers

            // Phase 4: FLUFF & BANK NOISE
            clean = clean
                .replace(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{1,2}.*$/gi, '')
                .replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, '')
                .replace(/\b\d{4,8}\b/g, '')
                .replace(/store\s*#?\d+/gi, '')
                .replace(/^0?EBIT\s*CARD\s*(PURCHASE|PUR)/i, '')
                .replace(/^(visa|mastercard|amex)\s*(debit|credit)?/i, '')
                .replace(/^(pos|point\s*of\s*sale)/i, '')
                .replace(/\s+(CALGARY|TORONTO|VANCOUVER|AB|BC|ON)\b.*$/i, '')
                .replace(/\s+(INC|LTD|CORP|CO)\.?$/i, '');

            // Phase 5: CANONICAL MERGE
            let final = clean.trim().replace(/\s+/g, ' ');
            if (!final || final.length < 2) return "Miscellaneous";

            // Master Brand Force
            const MASTERS = [
                'UBER', 'STARBUCKS', 'TIM HORTONS', 'AMAZON', 'WALMART',
                'SHELL', 'PETRO CANADA', 'ESSO', 'CHEVRON',
                'SAFEWAY', 'COSTCO', 'BEST BUY', 'APPLE',
                'GOOGLE', 'MICROSOFT', 'ADOBE', 'AWS',
                'DOORDASH', 'SKIP THE DISHES', 'NETFLIX', 'SPOTIFY'
            ];

            // Master Brand Force (Disabled - too aggressive for Payee names)
            // Only return the brand if the whole string IS just the brand
            const upper = final.toUpperCase();
            for (const m of MASTERS) {
                if (upper === m) {
                    return m;
                }
            }

            return final;
        }
    };

    // --- INITIALIZE ---
    load();
    COA.init();

    return {
        Ledger,
        Ingestion,
        Accounts,
        COA,
        Brain,
        TransactionStatus,
        Polarity
    };

})();
