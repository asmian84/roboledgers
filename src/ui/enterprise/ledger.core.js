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
        accounts: [],
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
        { code: '9000', name: 'Depreciation Expense', class: 'EXP_NON_CASH', root: 'EXPENSE', balance: 0 },
        { code: '9970', name: 'Uncategorized', class: 'EXP_OP_G_A', root: 'EXPENSE', balance: 0 }
    ];

    // --- STORAGE ENGINE ---
    const LEDGER_VERSION = '2.0.0'; // Increment when schema/logic changes

    function load() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);

                // Version check - auto-clear incompatible cache
                const savedVersion = parsed.version || '1.0.0';
                if (savedVersion !== LEDGER_VERSION) {
                    console.warn(`[LEDGER] Version mismatch: saved=${savedVersion}, current=${LEDGER_VERSION}`);
                    console.warn('[LEDGER] Clearing incompatible cache and starting fresh');
                    localStorage.removeItem(STORAGE_KEY);
                    return; // Start with empty state
                }

                state.transactions = parsed.transactions || {};
                state.sigIndex = parsed.sigIndex || {};
                state.accounts = parsed.accounts || [];
                state.coa = parsed.coa || DEFAULT_COA_TEMPLATE;
                console.log(`[LEDGER] State loaded (v${LEDGER_VERSION})`);
            } catch (e) {
                console.error('[LEDGER] Failed to load state', e);
                localStorage.removeItem(STORAGE_KEY); // Clear corrupted data
            }
        }
    }

    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: LEDGER_VERSION, // Include version for validation
            transactions: state.transactions,
            sigIndex: state.sigIndex,
            accounts: state.accounts,
            coa: state.coa
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
            (raw_description || '').trim() // NULL SAFETY: default to empty string
        ].join('|');


        const encoder = new TextEncoder();
        const data = encoder.encode(source);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // --- DESCRIPTION PARSER ---
    function toTitleCase(str) {
        return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
    }

    function parseTransactionDescription(rawDesc) {
        if (!rawDesc) return { payee: null, transaction_type_label: null };

        const upper = rawDesc.toUpperCase();

        // E-Transfer patterns
        if (upper.includes('INTERAC') || upper.includes('E-TRANSFER') || upper.includes('E-TRF')) {
            const cleaned = rawDesc
                .replace(/INTERAC/gi, '')
                .replace(/e-Transfer/gi, '')
                .replace(/E-TRANSFER/gi, '')
                .replace(/E-TRF/gi, '')
                .trim();

            return {
                payee: toTitleCase(cleaned) || 'E-Transfer',
                transaction_type_label: 'e-transfer • direct deposit'
            };
        }

        // Direct Deposit / Payroll
        if (upper.includes('DD') || upper.includes('DIRECT DEP') || upper.includes('PAYROLL')) {
            return {
                payee: 'Payroll Deposit',
                transaction_type_label: 'direct deposit • payroll'
            };
        }

        // Subcontractor
        if (upper.includes('SUBCONTRACTOR') || upper.includes('SUB-CONTRACT')) {
            return {
                payee: 'Contractor Payment',
                transaction_type_label: 'e-transfer • sub-contract'
            };
        }

        // VISA/MC Purchase
        if (upper.includes('VISA') || upper.includes('MASTERCARD') || upper.includes('MC')) {
            const cleaned = rawDesc
                .replace(/VISA/gi, '')
                .replace(/MASTERCARD/gi, '')
                .replace(/MC/gi, '')
                .replace(/PURCHASE/gi, '')
                .trim();

            return {
                payee: toTitleCase(cleaned) || 'Purchase',
                transaction_type_label: 'card purchase'
            };
        }

        // Default: return cleaned up version
        return {
            payee: toTitleCase(rawDesc),
            transaction_type_label: null
        };
    }

    // --- AUTO-CATEGORIZATION ENGINE ---
    const AUTO_CATEGORIZE_RULES = [
        {
            pattern: /e-transfer|interac|e-trf/i,
            test: (tx) => tx.polarity === 'CREDIT',
            category: '4000', // Revenue
            confidence: 0.7,
            status: 'needs_review'
        },
        {
            pattern: /e-transfer|interac|e-trf/i,
            test: (tx) => tx.polarity === 'DEBIT',
            category: '5100', // Direct Labor (sub-contractors)
            confidence: 0.6,
            status: 'needs_review'
        },
        // High-confidence rules (auto_categorized)
        {
            pattern: /^e-transfer.*autodeposit$/i,
            category: '4100', // Revenue
            confidence: 0.95,
            status: 'auto_categorized'
        },
        {
            pattern: /petro|shell|esso|gas station|fuel/i,
            category: '8300', // Fuel
            confidence: 0.8,
            status: 'auto_categorized'
        },
        {
            pattern: /bank charge|service fee|monthly fee|transaction fee/i,
            category: '8700', // Bank Charges
            confidence: 0.9,
            status: 'auto_categorized'
        },
        {
            pattern: /payroll|salary|wages|cpp|ei deduction/i,
            category: '7100', // Payroll Expenses
            confidence: 0.85,
            status: 'auto_categorized'
        },
        {
            pattern: /rent|lease payment|landlord/i,
            category: '8200', // Rent
            confidence: 0.8,
            status: 'auto_categorized'
        },

        // Medium-confidence rules (needs_review)
        {
            pattern: /restaurant|cafe|coffee|tim hortons|starbucks|food|dining/i,
            category: '8550', // Meals & Entertainment
            confidence: 0.7,
            status: 'needs_review'
        },
        {
            pattern: /amazon|office depot|staples|supplies/i,
            category: '8400', // Office Supplies
            confidence: 0.6,
            status: 'needs_review'
        },
        {
            pattern: /grocery|supermarket|safeway|walmart|loblaws|sobeys/i,
            category: '8410', // Groceries (if business)
            confidence: 0.65,
            status: 'needs_review'
        },
        {
            pattern: /insurance|liability coverage|policy premium/i,
            category: '8600', // Insurance
            confidence: 0.75,
            status: 'needs_review'
        },
        {
            pattern: /contractor|freelancer|consulting|professional services/i,
            category: '7200', // Contract Labor
            confidence: 0.7,
            status: 'needs_review'
        },
        {
            pattern: /software|saas|subscription|microsoft|adobe|google workspace/i,
            category: '8450', // Software & Subscriptions
            confidence: 0.75,
            status: 'needs_review'
        },
        {
            pattern: /fedex|ups|purolator|canada post|shipping|freight/i,
            category: '8350', // Shipping & Delivery
            confidence: 0.8,
            status: 'needs_review'
        },
        {
            pattern: /advertising|marketing|google ads|facebook ads|promotion/i,
            category: '8100', // Advertising & Marketing
            confidence: 0.75,
            status: 'needs_review'
        },
        {
            pattern: /lawyer|legal|attorney|accounting|bookkeeping|cpa/i,
            category: '8500', // Professional Fees
            confidence: 0.8,
            status: 'needs_review'
        },
        {
            pattern: /telus|rogers|bell|phone|mobile|internet|data plan/i,
            category: '8650', // Telecommunications
            confidence: 0.75,
            status: 'needs_review'
        },
        {
            pattern: /utility|hydro|electric|water|gas bill|energy/i,
            category: '8250', // Utilities
            confidence: 0.75,
            status: 'needs_review'
        }
    ];

    function autoCategorizTransaction(tx) {
        const desc = (tx.raw_description || tx.description || '').toUpperCase();

        for (const rule of AUTO_CATEGORIZE_RULES) {
            const matches = rule.pattern.test(desc);
            const testPasses = !rule.test || rule.test(tx);

            if (matches && testPasses) {
                const coaEntry = state.coa[rule.category];
                return {
                    gl_account_code: rule.category,
                    gl_account_name: coaEntry ? coaEntry.name : 'Unknown',
                    confidence: rule.confidence,
                    status: rule.status
                };
            }
        }

        return { status: 'needs_review', confidence: 0 };
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

        // Expose transactions as an array (for backward compatibility)
        get transactions() {
            return this.getAll();
        },

        getAll: function () {
            // Sort ASCENDING for benchmark parity (oldest first)
            const raw = Object.values(state.transactions).sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));

            // Map of starting balances per account
            const startingBalances = {};
            state.accounts.forEach(acc => {
                startingBalances[acc.id] = (acc.openingBalance || 0) * 100; // to cents
            });

            // If in "ALL" mode, we track balances per account while mapping
            const runBalances = { ...startingBalances };

            return raw.map((tx) => {
                const accId = tx.account_id || 'ACC-001';

                // Initialize if not exists (defensive)
                if (runBalances[accId] === undefined) runBalances[accId] = 0;

                // Balance represents state BEFORE this transaction in current view?
                // Actually, standard ledgers show the balance AFTER the transaction.
                runBalances[accId] += (tx.polarity === Polarity.CREDIT ? tx.amount_cents : -tx.amount_cents);

                tx.balance_cents = runBalances[accId];
                tx.calculated_balance = runBalances[accId]; // Keep legacy support

                return tx;
            });
        },

        get: function (tx_id) {
            return state.transactions[tx_id];
        },

        getByParserRef: function (parser_ref) {
            return Object.values(state.transactions).find(tx => tx.parser_ref === parser_ref);
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

        updateMetadata: function (tx_id, patch) {
            const tx = state.transactions[tx_id];
            if (!tx) throw new Error("TX_NOT_FOUND");

            const forbidden = ["amount_cents", "date", "account_id", "currency"];
            Object.keys(patch).forEach(key => {
                if (forbidden.includes(key)) {
                    throw new Error("INVARIANT_VIOLATION_IMMUTABLE_FIELD");
                }
            });

            Object.assign(tx, patch);
            save();
            return tx;
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

        updateCategory: function (tx_id, category_code) {
            const tx = state.transactions[tx_id];
            if (tx) {
                tx.category = category_code;
                tx.category_code = category_code; // Fallback field
                const account = COA.get(category_code);
                if (account) {
                    tx.category_name = account.name;
                }
                save();
                console.log(`[LEDGER] Updated category for ${tx_id}: ${category_code}`);
                return true;
            }
            return false;
        },

        updateDescription: function (tx_id, new_description) {
            const tx = state.transactions[tx_id];
            if (tx) {
                const old_value = tx.payee || tx.description || '';

                // Skip if no change
                if (old_value === new_description) {
                    return false;
                }

                // Initialize edit history if not exists
                if (!tx.edit_history) {
                    tx.edit_history = [];
                }

                // Track the edit for audit transparency
                tx.edit_history.push({
                    field: 'description',
                    old_value: old_value,
                    new_value: new_description,
                    timestamp: new Date().toISOString(),
                    edited_by: 'user' // Can be enhanced with actual user ID later
                });

                // Update the fields
                tx.payee = new_description;
                tx.description = new_description;

                save();
                console.log(`[LEDGER] Updated description for ${tx_id}: "${old_value}" → "${new_description}"`);
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
        reset: function () {
            state.accounts = [];
            save();
            console.log('[ACCOUNTS] All accounts cleared.');
        },
        remove: function (id) {
            const index = state.accounts.findIndex(a => a.id === id);
            if (index !== -1) {
                const removed = state.accounts.splice(index, 1)[0];
                save();
                console.log(`[ACCOUNTS] Removed account: ${id} - ${removed.name}`);
                return true;
            }
            return false;
        },
        updateMetadata: function (id, metadata) {
            let acc = this.get(id);
            const isNewAccount = !acc;

            if (!acc) {
                console.log(`[ACCOUNTS] Creating new account record: ${id}`);
                acc = {
                    id: id,
                    name: metadata.name || 'New Account',
                    ref: 'TEMP', // Will be auto-assigned below
                    openingBalance: 0,
                    expectedBalance: 0,
                    currency: 'CAD',
                    created_at: new Date().toISOString()
                };
                state.accounts.push(acc);
            }

            // Update metadata fields - ONLY if provided (prevent contamination)
            if (metadata.id !== undefined) acc.inst = metadata.id;
            if (metadata.transit !== undefined) acc.transit = metadata.transit;
            if (metadata.accountNumber !== undefined) acc.accountNumber = metadata.accountNumber;
            if (metadata.account_num !== undefined && !acc.accountNumber) acc.accountNumber = metadata.account_num;
            if (metadata.accountType !== undefined) acc.accountType = metadata.accountType;
            if (metadata.period !== undefined) acc.period = metadata.period;
            if (metadata.holder !== undefined) acc.holder = metadata.holder;

            // Brand/cardNetwork: For credit cards ONLY
            if (metadata.cardNetwork !== undefined) {
                acc.cardNetwork = metadata.cardNetwork;
                acc.brand = metadata.cardNetwork; // Normalize to brand
            } else if (metadata.brand !== undefined) {
                acc.brand = metadata.brand;
            } else if (metadata._tag !== undefined && !acc.brand) {
                acc.brand = metadata._tag;
            }

            // Bank name
            if (metadata.bankName !== undefined) acc.bankName = metadata.bankName;
            else if (metadata._bank !== undefined && !acc.bankName) acc.bankName = metadata._bank;
            else if (metadata.name !== undefined && !acc.bankName) acc.bankName = metadata.name;

            if (metadata.statementClosingDay !== undefined) acc.statementClosingDay = metadata.statementClosingDay;
            if (metadata.currency !== undefined) acc.currency = metadata.currency;
            if (!acc.currency) acc.currency = 'CAD';

            // Auto-assign ref# ONLY for brand-new accounts (never re-assign existing refs)
            if (isNewAccount || acc.ref === 'TEMP') {
                const brand = (acc.brand || acc.cardNetwork || acc._tag || '').toUpperCase();
                const accountName = (acc.name || acc.bankName || '').toUpperCase();
                let refPrefix = 'CHQ'; // Default

                if (brand.includes('MASTERCARD') || brand.includes('MC')) refPrefix = 'MC';
                else if (brand.includes('VISA')) refPrefix = 'VISA';
                else if (brand.includes('AMEX')) refPrefix = 'AMEX';
                else if (acc.accountType === 'SAVINGS' || accountName.includes('SAVINGS')) refPrefix = 'SAV';

                // Count existing accounts with same prefix
                const existing = state.accounts.filter(a =>
                    a.id !== id && a.ref && a.ref.startsWith(refPrefix)
                ).length;
                acc.ref = `${refPrefix}${existing + 1}`;
                console.log(`[ACCOUNTS] Auto-assigned ref#: ${acc.ref}`);
            }

            // Generate short display name
            const bankShortNames = {
                'Royal Bank of Canada': 'RBC',
                'Toronto-Dominion Bank': 'TD',
                'Toronto-Dominion': 'TD',
                'Canadian Imperial Bank of Commerce': 'CIBC',
                'CIBC': 'CIBC',
                'Bank of Montreal': 'BMO',
                'Scotiabank': 'Scotia',
                'The Bank of Nova Scotia': 'Scotia'
            };
            const bankShort = bankShortNames[acc.bankName] || acc.bankName || metadata.name || 'Bank';
            const last4 = acc.accountNumber?.slice(-4) || '0000';

            if (acc.brand || acc.cardNetwork) {
                // Credit Card
                const brand = (acc.brand || acc.cardNetwork).split(' ')[0]; // "MASTERCARD" -> "MASTERCARD"
                const brandShort = brand === 'MASTERCARD' ? 'MC' : brand;
                acc.name = `${bankShort} - ${brandShort} #${last4}`;
            } else {
                // Bank Account
                const typeShort = acc.accountType === 'SAVINGS' ? 'Savings' : 'Chequing';
                acc.name = `${bankShort} - ${typeShort} #${last4}`;
            }

            save();
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
         * Preserves line breaks by detecting Y-coordinate changes
         * NOW ALSO RETURNS LINE COORDINATES for highlighting
         */
        extractTextFromPDF: async function (arrayBuffer) {
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            const lineCoordinates = []; // Store coordinates for each line

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const content = await page.getTextContent();

                // Group items by Y-coordinate (line detection)
                const lines = [];
                let currentLine = [];
                let lastY = null;
                let lineStartY = null;
                let lineHeight = null;

                content.items.forEach((item, idx) => {
                    const y = Math.round(item.transform[5]); // Y-coordinate
                    const height = item.height || 12; // Approximate height from font size

                    // New line if Y changes by more than 2 pixels
                    if (lastY !== null && Math.abs(y - lastY) > 2) {
                        if (currentLine.length > 0) {
                            const lineText = currentLine.join(' ');
                            lines.push(lineText);

                            // Store coordinate for this line
                            lineCoordinates.push({
                                page: pageNum,
                                text: lineText,
                                y: lineStartY,
                                height: lineHeight
                            });

                            currentLine = [];
                            lineStartY = null;
                        }
                    }

                    // Track first Y-coordinate of the line
                    if (lineStartY === null) {
                        lineStartY = y;
                        lineHeight = height;
                    }

                    currentLine.push(item.str);
                    lastY = y;
                });

                // Don't forget last line
                if (currentLine.length > 0) {
                    const lineText = currentLine.join(' ');
                    lines.push(lineText);

                    lineCoordinates.push({
                        page: pageNum,
                        text: lineText,
                        y: lineStartY,
                        height: lineHeight
                    });
                }

                fullText += lines.join('\n') + '\n';
            }

            // Return both text and coordinates
            return { text: fullText, lineCoordinates };
        },

        /**
         * Smart Parser Dispatcher (Routes to bank-specific parsers)
         * NOW ACCEPTS lineCoordinates for balance highlighting
         */
        parsePDFText: async function (text, lineCoordinates = []) {
            console.log("[FORENSICS] Scanning PDF text segment (First 300 chars):", text.substring(0, 300));
            console.log(`[FORENSICS] Line coordinates available: ${lineCoordinates.length} lines`);

            const upper = text.toUpperCase();
            let result = null;

            // ==================== TD PARSERS (CHECK FIRST!) ====================
            // CRITICAL: Must check TD before RBC because "TD" alone is too generic
            // TD Aeroplan cards say "TD® Aeroplan® Visa" not "TD CANADA TRUST"
            if ((upper.includes('TD CANADA') || upper.includes('TD TRUST') || upper.includes('AEROPLAN') ||
                (upper.includes('TD') && upper.includes('VISA') && !upper.includes('RBC') && !upper.includes('ROYAL BANK'))) &&
                !upper.includes('AMERICAN EXPRESS') && !upper.includes('AMEX BANK')) {
                console.log('[PARSER] Detected TD statement');

                if (upper.includes('VISA') || upper.includes('AEROPLAN')) {
                    console.log('[PARSER] Routing to TD Visa Parser');
                    if (window.tdVisaParser) {
                        result = await window.tdVisaParser.parse(text);
                        if (result) console.log('[PARSER] TD Visa returned:', result);
                    }
                } else {
                    console.log('[PARSER] Routing to TD Chequing Parser');
                    if (window.tdChequingParser) {
                        result = await window.tdChequingParser.parse(text);
                        if (result) console.log('[PARSER] TD Chequing returned:', result);
                    }
                }
            }

            // ==================== RBC PARSERS ====================
            else if (upper.includes('RBC') || upper.includes('ROYAL BANK')) {
                console.log('[PARSER] Detected RBC statement');

                if (upper.includes('SAVINGS ACCOUNT') || upper.includes('BUSINESS ESSENTIALS') && upper.includes('SAVINGS')) {
                    console.log('[PARSER] Routing to RBC Savings Parser');
                    if (window.rbcSavingsParser) {
                        result = await window.rbcSavingsParser.parseWithRegex(text);
                        if (result) console.log('[PARSER] RBC Savings returned:', result);
                    }
                } else if (upper.includes('BUSINESS ACCOUNT STATEMENT') || upper.includes('CHEQU')) {
                    console.log('[PARSER] Routing to RBC Chequing Parser');
                    if (window.rbcChequingParser) {
                        result = await window.rbcChequingParser.parseWithRegex(text);
                        if (result) console.log('[PARSER] RBC Chequing returned:', result);
                    }
                } else if (upper.includes('MASTERCARD') || upper.includes('BUSINESS CASH BACK')) {
                    console.log('[PARSER] Routing to RBC Mastercard Parser');
                    if (window.rbcMastercardParser) {
                        result = await window.rbcMastercardParser.parse(text);
                        if (result) console.log('[PARSER] RBC Mastercard returned:', result);
                    }
                } else if (upper.includes('VISA')) {
                    console.log('[PARSER] Routing to RBC Visa Parser');
                    if (window.rbcVisaParser) {
                        result = await window.rbcVisaParser.parse(text);
                        if (result) console.log('[PARSER] RBC Visa returned:', result);
                    }
                }
            }

            // ==================== BMO PARSERS ====================
            else if (upper.includes('BMO') || upper.includes('BANK OF MONTREAL')) {
                console.log('[PARSER] Detected BMO statement');

                if (upper.includes('CHEQU') || upper.includes('SAVINGS')) {
                    console.log('[PARSER] Routing to BMO Chequing Parser');
                    if (window.bmoChequingParser) {
                        result = await window.bmoChequingParser.parse(text);
                        if (result) console.log('[PARSER] BMO Chequing returned:', result);
                    }
                } else if (upper.includes('MASTERCARD')) {
                    console.log('[PARSER] Routing to BMO Mastercard Parser');
                    if (window.bmoMastercardParser) {
                        result = await window.bmoMastercardParser.parse(text);
                        if (result) console.log('[PARSER] BMO Mastercard returned:', result);
                    }
                } else if (upper.includes('VISA')) {
                    console.log('[PARSER] Routing to BMO Visa Parser');
                    if (window.bmoVisaParser) {
                        result = await window.bmoVisaParser.parse(text);
                        if (result) console.log('[PARSER] BMO Visa returned:', result);
                    }
                } else if (upper.includes('CREDIT CARD')) {
                    console.log('[PARSER] Routing to BMO Credit Card Parser');
                    if (window.bmoCreditCardParser) {
                        result = await window.bmoCreditCardParser.parse(text);
                        if (result) console.log('[PARSER] BMO CC returned:', result);
                    }
                } else if (upper.includes('USD') || upper.includes('US ACCOUNT')) {
                    console.log('[PARSER] Routing to BMO US Account Parser');
                    if (window.bmoUSParser) {
                        result = await window.bmoUSParser.parse(text);
                        if (result) console.log('[PARSER] BMO US returned:', result);
                    }
                }
            }

            // ==================== TD PARSERS ====================
            else if (upper.includes('TD CANADA') || upper.includes('TD BANK')) {
                console.log('[PARSER] Detected TD statement');

                if (upper.includes('VISA')) {
                    console.log('[PARSER] Routing to TD Visa Parser');
                    if (window.tdVisaParser) {
                        result = await window.tdVisaParser.parse(text);
                        if (result) console.log('[PARSER] TD Visa returned:', result);
                    }
                } else {
                    console.log('[PARSER] Routing to TD Chequing Parser');
                    if (window.tdChequingParser) {
                        result = await window.tdChequingParser.parse(text);
                        if (result) console.log('[PARSER] TD Chequing returned:', result);
                    }
                }
            }

            // ==================== SCOTIA PARSERS ====================
            else if (upper.includes('SCOTIA') || upper.includes('SCOTIABANK')) {
                console.log('[PARSER] Detected Scotia statement');

                if (upper.includes('AMEX') || upper.includes('AMERICAN EXPRESS')) {
                    console.log('[PARSER] Routing to Scotia Amex Parser');
                    if (window.scotiaAmexParser) {
                        result = await window.scotiaAmexParser.parse(text);
                        if (result) console.log('[PARSER] Scotia Amex returned:', result);
                    }
                } else if (upper.includes('MASTERCARD')) {
                    console.log('[PARSER] Routing to Scotia Mastercard Parser');
                    if (window.scotiaMastercardParser) {
                        result = await window.scotiaMastercardParser.parse(text);
                        if (result) console.log('[PARSER] Scotia MC returned:', result);
                    }
                } else if (upper.includes('VISA')) {
                    console.log('[PARSER] Routing to Scotia Visa Parser');
                    if (window.scotiaVisaParser) {
                        result = await window.scotiaVisaParser.parse(text);
                        if (result) console.log('[PARSER] Scotia Visa returned:', result);
                    }
                } else if (upper.includes('CREDIT CARD')) {
                    console.log('[PARSER] Routing to Scotia Credit Card Parser');
                    if (window.scotiaCreditCardParser) {
                        result = await window.scotiaCreditCardParser.parse(text);
                        if (result) console.log('[PARSER] Scotia CC returned:', result);
                    }
                } else {
                    console.log('[PARSER] Routing to Scotia Chequing Parser');
                    if (window.scotiaChequingParser) {
                        result = await window.scotiaChequingParser.parse(text);
                        if (result) console.log('[PARSER] Scotia Chequing returned:', result);
                    }
                }
            }

            // ==================== CIBC PARSERS ====================
            else if (upper.includes('CIBC')) {
                console.log('[PARSER] Detected CIBC statement');

                if (upper.includes('VISA')) {
                    console.log('[PARSER] Routing to CIBC Visa Parser');
                    if (window.cibcVisaParser) {
                        result = await window.cibcVisaParser.parse(text);
                        if (result) console.log('[PARSER] CIBC Visa returned:', result);
                    }
                } else {
                    console.log('[PARSER] Routing to CIBC Chequing Parser');
                    if (window.cibcChequingParser) {
                        result = await window.cibcChequingParser.parse(text);
                        if (result) console.log('[PARSER] CIBC Chequing returned:', result);
                    }
                }
            }

            // ==================== AMEX PARSER ====================
            else if (upper.includes('AMERICAN EXPRESS') || upper.includes('AMEX')) {
                console.log('[PARSER] Detected Amex statement');
                if (window.amexParser) {
                    result = await window.amexParser.parse(text, null, lineCoordinates);
                    if (result) console.log('[PARSER] Amex returned:', result);
                }
            }

            // ==================== ATB PARSER ====================
            else if (upper.includes('ATB FINANCIAL') || upper.includes('ATB')) {
                console.log('[PARSER] Detected ATB statement');
                if (window.atbParser) {
                    result = await window.atbParser.parse(text);
                    if (result) console.log('[PARSER] ATB returned:', result);
                }
            }

            // ==================== HSBC PARSER ====================
            else if (upper.includes('HSBC')) {
                console.log('[PARSER] Detected HSBC statement');
                if (window.hsbcParser) {
                    result = await window.hsbcParser.parse(text);
                    if (result) console.log('[PARSER] HSBC returned:', result);
                }
            }

            // Fallback to legacy regex if no parser matched or returned nothing
            if (!result || !result.transactions || result.transactions.length === 0) {
                console.warn('[PARSER] No specialized parser matched or returned empty. Using legacy regex fallback.');
                const legacyTransactions = this.legacyRegexParser(text);
                result = {
                    transactions: legacyTransactions,
                    metadata: this.detectInstitution(text)
                };
            }

            console.log(`[PARSER] Final result: ${result.transactions.length} transactions, metadata:`, result.metadata);
            return result;
        },

        /**
         * Legacy Regex Parser (Fallback)
         */
        legacyRegexParser: function (text) {
            const transactions = [];
            const rbcRegex = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))\s+([^\n\r]*?)\s+(-?[\d,]+\.\d{2})/gi;
            let match;
            while ((match = rbcRegex.exec(text)) !== null) {
                transactions.push({
                    date: match[1].trim() + ' 2024',
                    description: match[2].trim(),
                    amount: parseFloat(match[3].replace(/[$,]/g, '')),
                    ref: null
                });
            }
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

        // Generate unique account ID based on metadata
        generateAccountId: function (metadata) {
            // Credit Cards: Use brand + last 4 digits (handles masked numbers like 5526 12** **** 1999)
            const tag = (metadata._tag || metadata.tag || metadata.cardNetwork || metadata.brand || "").toUpperCase();
            if (tag.includes("MASTERCARD") || tag.includes("VISA") || tag.includes("MC")) {
                const cardNum = (metadata._acct || metadata.accountNumber || "").replace(/\D/g, "");
                if (cardNum.length >= 4) {
                    const last4 = cardNum.slice(-4);
                    const brand = (tag.includes("MASTERCARD") || tag.includes("MC")) ? "MC" : "VISA";
                    return `CC-${brand}-${last4}`;
                }
            }
            // Amex: Check both tag AND cardNetwork (tag may be "Platinum" not "Amex")
            if (tag.includes("AMEX") || tag.includes("AMERICAN EXPRESS") ||
                (metadata.cardNetwork && metadata.cardNetwork.toUpperCase().includes("AMEX"))) {
                const cardNum = (metadata._acct || metadata.accountNumber || "").replace(/\D/g, "");
                if (cardNum.length >= 4) {
                    const last4 = cardNum.slice(-4);
                    return `CC-AMEX-${last4}`;
                }
            }









            // Bank Accounts: Use transit + account last 4
            if (metadata.transit && metadata.transit !== 'N/A' && metadata.transit !== '-----' && metadata.transit !== 'UNKNOWN') {
                const accountNum = (metadata.accountNumber || metadata.account_num || '').replace(/\D/g, '');
                const last4 = accountNum.slice(-4) || '0000';
                return `BANK-${metadata.transit}-${last4}`;
            }

            // Fallback: timestamp-based ID
            return `ACC-${Date.now()}`;
        },

        processUpload: async function (file, account_id) {
            // Note: We'll generate account_id AFTER parsing metadata
            // Keep original account_id for now as placeholder
            let originalAccountId = account_id;

            let rows = [];
            let metadata = { name: 'CSV File', transit: 'N/A' };

            // Store the file blob for the workbench
            const sourceFileId = Accounts.storeFile(file);

            // Create blob URL for PDF viewing
            let pdfBlobUrl = null;

            if (file.name.toLowerCase().endsWith('.pdf')) {
                console.log('[INGEST] 📄 PDF detected:', file.name);

                // Create blob URL that can be used by PDF viewer
                pdfBlobUrl = URL.createObjectURL(file);
                console.log('[INGEST] 🔗 Created blob URL:', pdfBlobUrl);

                const buffer = await file.arrayBuffer();
                console.log('[INGEST] 📦 Buffer size:', buffer.byteLength, 'bytes');

                const pdfData = await this.extractTextFromPDF(buffer);
                const text = pdfData.text; // Destructure text
                const lineCoordinates = pdfData.lineCoordinates; // Get coordinates

                console.log('[INGEST] 📝 Extracted text length:', text.length, 'characters');
                console.log('[INGEST] 📍 Line coordinates captured:', lineCoordinates.length, 'lines');
                console.log('[INGEST] 📝 First 500 chars:', text.substring(0, 500));

                // Try specialized parser first, fallback to detection
                console.log('[INGEST] 🔍 Calling parsePDFText...');
                const parseResult = await this.parsePDFText(text, lineCoordinates); // PASS LINE COORDS
                console.log('[INGEST] ✅ Parser returned:', parseResult);
                console.log('[INGEST] 📊 Transactions found:', parseResult?.transactions?.length || 0);

                // Extract balance coordinates from parser if available
                if (parseResult?.openingBalanceCoords) {
                    console.log('[INGEST] 📍 Opening balance coords:', parseResult.openingBalanceCoords);
                }
                if (parseResult?.closingBalanceCoords) {
                    console.log('[INGEST] 📍 Closing balance coords:', parseResult.closingBalanceCoords);
                }

                if (parseResult && parseResult.metadata && Object.keys(parseResult.metadata).length > 0) {
                    metadata = parseResult.metadata;
                    rows = parseResult.transactions || [];
                    console.log(`[INGEST] Parser extracted metadata:`, metadata);
                } else {
                    // Fallback to old detection method
                    console.warn('[INGEST] ⚠️ Parser returned no metadata, using fallback detection');
                    metadata = this.detectInstitution(text);
                    rows = parseResult || [];
                }

                // Attach source file id AND PDF blob URL to each parsed row
                // NOW with coordinate matching for highlights!
                rows = rows.map(r => {
                    // Try to find matching coordinate for this transaction
                    const searchText = (r.description || '').substring(0, 30);
                    const searchAmount = r.debit || r.credit || '';

                    let matchedCoord = null;
                    for (const coord of lineCoordinates) {
                        // Match if line contains description or amount
                        if ((searchText && coord.text.includes(searchText)) ||
                            (searchAmount && coord.text.includes(searchAmount))) {
                            matchedCoord = coord;
                            break;
                        }
                    }

                    return {
                        ...r,
                        source_file_id: sourceFileId,
                        source_pdf: {
                            url: pdfBlobUrl,
                            filename: file.name,
                            page: matchedCoord?.page || 1,
                            raw_line: r.raw_line || `${r.date} ${r.description} ${r.debit || r.credit}`,
                            line_position: matchedCoord ? {
                                top: matchedCoord.y,
                                left: 50,
                                width: 500,
                                height: matchedCoord.height
                            } : null
                        }
                    };
                });


                // ===== INTELLIGENT ACCOUNT ID GENERATION =====
                if (originalAccountId === 'ALL' || !originalAccountId) {
                    account_id = this.generateAccountId(metadata);
                    console.log(`[INGEST] Generated account_id: ${account_id} from metadata`);
                }

                // Update or create account metadata
                Accounts.updateMetadata(account_id, metadata);

                // STORE BALANCE COORDINATES if parser extracted them
                const account = Accounts.get(account_id);
                if (account) {
                    if (parseResult?.openingBalanceCoords) {
                        account.openingBalanceCoords = parseResult.openingBalanceCoords;
                        console.log('[INGEST] ✅ Stored opening balance coords:', account.openingBalanceCoords);
                    }
                    if (parseResult?.closingBalanceCoords) {
                        account.closingBalanceCoords = parseResult.closingBalanceCoords;
                        console.log('[INGEST] ✅ Stored closing balance coords:', account.closingBalanceCoords);
                    }
                    // Save to localStorage
                    save();
                }

                // RECONCILIATION SOURCE LINKS: Store PDF URL and balances
                const existingAccount = state.accounts.find(a => a.id === account_id);
                if (existingAccount && pdfBlobUrl) {
                    existingAccount.pdfUrl = pdfBlobUrl;
                    existingAccount.pdfFilename = file.name;
                    console.log(`[RECON] Stored PDF URL for ${account_id}:`, pdfBlobUrl);
                }

                //Store opening balance if parser provided it
                if (existingAccount && parseResult && parseResult.openingBalance !== undefined) {
                    existingAccount.openingBalance = parseResult.openingBalance;
                    console.log(`[RECON] Stored opening balance for ${account_id}:`, parseResult.openingBalance);
                }

                // Store closing balance if parser provided it
                if (existingAccount && parseResult && parseResult.closingBalance !== undefined) {
                    existingAccount.statementEndingBalance = parseResult.closingBalance;
                    console.log(`[RECON] Stored closing balance for ${account_id}:`, parseResult.closingBalance);
                }

                // Store statement period if available
                if (existingAccount && parseResult && parseResult.statementPeriod) {
                    existingAccount.statementPeriod = parseResult.statementPeriod;
                    console.log(`[RECON] Stored statement period for ${account_id}:`, parseResult.statementPeriod);
                }

                // Store balance coordinates if available (for PDF snippet highlighting)
                if (existingAccount && parseResult) {
                    if (parseResult.openingBalanceCoords) {
                        existingAccount.openingBalanceCoords = parseResult.openingBalanceCoords;
                        console.log(`[RECON] Stored opening balance coordinates for ${account_id}:`, parseResult.openingBalanceCoords);
                    }
                    if (parseResult.closingBalanceCoords) {
                        existingAccount.closingBalanceCoords = parseResult.closingBalanceCoords;
                        console.log(`[RECON] Stored closing balance coordinates for ${account_id}:`, parseResult.closingBalanceCoords);
                    }
                }

                console.log(`[INGEST] DETECTED & UPDATED: ${metadata.name} (Transit: ${metadata.transit})`);
            } else {
                const text = await file.text();
                rows = this.parseCSV(text);
                rows = rows.map(r => ({ ...r, source_file_id: sourceFileId }));
            }

            let importedCount = 0;

            for (const row of rows) {
                // Map common headers (CSV or PDF Regex)
                const date = row.date || row.transaction_date;
                const raw_description = row.description || row.memo || row.payee; // This is the Dirty Match

                // Check if parser already provided debit/credit breakdown
                let amount, amount_cents, polarity;

                if (row.debit !== undefined && row.credit !== undefined) {
                    // Parser provided debit/credit columns (more accurate)
                    const debitVal = parseFloat(row.debit || 0);
                    const creditVal = parseFloat(row.credit || 0);

                    if (debitVal > 0) {
                        amount = debitVal;
                        polarity = Polarity.DEBIT;
                    } else if (creditVal > 0) {
                        amount = creditVal;
                        polarity = Polarity.CREDIT;
                    } else {
                        amount = parseFloat(row.amount || 0);
                        polarity = amount >= 0 ? Polarity.CREDIT : Polarity.DEBIT;
                    }
                } else {
                    // Fallback to amount column
                    amount = parseFloat(row.amount || 0);
                }

                if (!date || isNaN(amount)) continue;

                // CLEAN THE NAME
                const clean_description = Brain.cleanDescription(raw_description);

                amount_cents = Math.round(Math.abs(amount) * 100);
                const tx_id = crypto.randomUUID();

                const inputs = {
                    account_id,
                    date,
                    amount_cents,
                    currency: 'CAD',
                    raw_description: raw_description // Hash assumes original uniqueness
                };

                const txsig = await generateTxSig(inputs);

                // === POLARITY DETECTION (must happen before canonical object creation) ===
                // If parser didn't provide polarity, detect it
                if (!polarity) {
                    const isLiability = metadata.brand || /VISA|MC|AMEX|MASTERCARD|CREDIT/i.test(metadata.name);
                    if (isLiability) {
                        polarity = amount_cents >= 0 ? Polarity.DEBIT : Polarity.CREDIT;
                    } else {
                        polarity = amount_cents >= 0 ? Polarity.CREDIT : Polarity.DEBIT;
                    }
                }

                // Keyword Heuristic (Override for ambiguous markers)
                const upperDesc = raw_description.toUpperCase();
                const debitKeywords = ['PURCHASE', 'WITHDRAWAL', 'DEBIT', 'TRANSFER TO', 'PAYMENT TO', 'INTEREST CHARGE', 'FEE', 'FX RATE'];
                const creditKeywords = ['DEPOSIT', 'TRANSFER FROM', 'PAYMENT RECEIVED', 'INTEREST EARNED', 'CREDIT', 'REFUND', 'PAYMENT - THANK YOU', 'PAIEMENT - MERCI', 'CASH BACK'];

                if (debitKeywords.some(k => upperDesc.includes(k))) {
                    polarity = Polarity.DEBIT;
                } else if (creditKeywords.some(k => upperDesc.includes(k))) {
                    polarity = Polarity.CREDIT;
                }

                // 3. Trigger Categorization Brain (Decision Layer)
                const predicted_code = Brain.predict(clean_description); // Predict based on clean name
                const category = predicted_code ? COA.get(predicted_code) : null;

                // === PHASE 3: APPLY DESCRIPTION PARSER ===
                const parsedDesc = parseTransactionDescription(raw_description);

                // Build canonical transaction object
                const canonical = {
                    tx_id,
                    account_id,
                    date,
                    ref: row.ref || null, // Capture Ref# from parser
                    amount_cents: Math.abs(amount_cents),
                    currency: 'CAD',
                    polarity: polarity, // NOW polarity is defined!

                    // Use parsed description or fallback to original
                    description: clean_description, // PRIMARY LINE (CLEAN)
                    payee: parsedDesc.payee || clean_description, // Parsed name
                    transaction_type_label: parsedDesc.transaction_type_label, // Parsed type
                    raw_description: raw_description, // SECONDARY LINE (DIRTY)

                    sourceFileId: sourceFileId, // Link to workbench blob
                    source_pdf: row.source_pdf || null, // PDF metadata for audit viewer
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

                // === PHASE 4: APPLY AUTO-CATEGORIZATION (Respect Settings) ===
                const settings = window.UI_STATE || {};
                const isAutocatOn = settings.autocatEnabled !== false; // Default true
                const minConfidence = settings.confidenceThreshold || 0.8;

                if (isAutocatOn) {
                    const autoCat = autoCategorizTransaction(canonical);
                    if (autoCat.gl_account_code && !canonical.category_code) {
                        // Check confidence vs threshold
                        if (autoCat.confidence >= minConfidence) {
                            canonical.gl_account_code = autoCat.gl_account_code;
                            canonical.gl_account_name = autoCat.gl_account_name;
                            canonical.category_confidence = autoCat.confidence;
                            canonical.status = autoCat.status;
                        } else {
                            // Low confidence -> needs review
                            canonical.status = 'needs_review';
                            canonical.category_confidence = autoCat.confidence;
                        }
                    }
                }

                // === FALLBACK: Ensure all transactions have a COA code ===
                if (!canonical.gl_account_code && !canonical.category_code) {
                    // No category assigned - use 9970 (Uncategorized) as fallback
                    const fallbackCOA = COA.get('9970');
                    canonical.gl_account_code = '9970';
                    canonical.gl_account_name = fallbackCOA ? fallbackCOA.name : 'Uncategorized';
                    canonical.category_confidence = 0;
                    canonical.category_source = 'fallback';
                    canonical.status = 'needs_review';
                }


                // === PHASE 5: SALES TAX (GST/HST) CALCULATION ===
                if (settings.gstEnabled) {
                    const province = settings.province || 'ON';
                    const taxRates = {
                        'ON': 0.13,
                        'BC': 0.05, // Just GST for now, PST usually ignored in simple ledger
                        'AB': 0.05,
                        'QC': 0.05
                    };
                    const rate = taxRates[province] || 0.13;

                    // Tax = Total / (1 + rate) * rate
                    // We only calculate tax if it's a debit (expense)
                    if (canonical.polarity === 'DEBIT') {
                        const amount = canonical.amount_cents / 100;
                        const taxAmount = (amount / (1 + rate)) * rate;
                        canonical.tax_cents = Math.round(taxAmount * 100);
                        // console.log(`[TAX] Calculated ${province} tax: $${taxAmount.toFixed(2)} on $${amount.toFixed(2)}`);
                    }
                }

                // === PHASE 6: PERSISTENT REF# ASSIGNMENT ===
                // Assign permanent REF# based on account, BEFORE storing
                if (!canonical.ref) {
                    // Get account to find prefix
                    const account = Accounts.get(canonical.account_id);
                    const accountRef = (account && account.ref) || 'TXN';

                    // Calculate next counter by finding highest existing REF# for this account
                    // NOTE: state.transactions is an OBJECT (keyed by tx ID), not array!
                    const allTransactions = Object.values(state.transactions);
                    const existingForAccount = allTransactions.filter(t => t.account_id === canonical.account_id);
                    let maxCounter = 0;
                    existingForAccount.forEach(tx => {
                        if (tx.ref) {
                            // Extract number from "AMEX1-034" -> 34
                            const parts = tx.ref.split('-');
                            if (parts.length === 2) {
                                const num = parseInt(parts[1], 10);
                                if (!isNaN(num) && num > maxCounter) {
                                    maxCounter = num;
                                }
                            }
                        }
                    });

                    const nextCounter = maxCounter + 1;
                    canonical.ref = `${accountRef}-${String(nextCounter).padStart(3, '0')}`;
                    console.log(`[LEDGER] Assigned persistent REF#: ${canonical.ref} to ${canonical.description}`);
                }

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

            // ═══════════════════════════════════════════════════════════
            // DESCRIPTION CLEANING RULEBOOK v1.0
            // Based on 905 user manual corrections (2026-02-11)
            // ═══════════════════════════════════════════════════════════

            // RULE 1: Remove date prefixes (Month DD, )
            // Examples: "June 5, NAME" → "NAME"
            clean = clean.replace(/^[A-Z][a-z]+\s+\d+,\s+/, '');

            // RULE 2: Remove reference number prefixes (NNNN, )
            // Examples: "0578, Online Banking" → "Online Banking"
            clean = clean.replace(/^\d{4,},\s+/, '');

            // RULE 3: Remove leading commas and spaces
            // Examples: ",   NAME" → "NAME"
            clean = clean.replace(/^,\s*/, '');

            // RULE 4: Normalize E-Transfer labels
            // Ensure consistent format: ", E-Transfer - Autodeposit"
            if (clean.includes('Autodeposit') && !clean.includes('E-Transfer')) {
                clean = clean.replace(/\s*-?\s*Autodeposit/, ', E-Transfer - Autodeposit');
            }

            // RULE 5: Normalize transaction type labels
            // Inter-Fi → Inter-FI
            clean = clean.replace(/Inter-Fi\s/i, 'Inter-FI ');

            // Swap transaction type and merchant for certain patterns
            // "Automobile Rent TOYOTA" → "TOYOTA,Automobile Rent"
            clean = clean.replace(/(Automobile Rent)\s+([A-Z\s]+)/i, (match, type, provider) => {
                return provider.toUpperCase().trim() + ',' + type;
            });

            // "Funds transfer PROVIDER" → "PROVIDER,Funds transfer"
            clean = clean.replace(/(Funds [Tt]ransfer)\s+([A-Z\s]+)/i, (match, type, provider) => {
                return provider.toUpperCase().trim() + ',Funds transfer';
            });

            // RULE 6: Remove trailing account/reference numbers
            // "Online Transfer to Deposit Account-8212" → "...Account-"
            clean = clean.replace(/-\d{4,}$/, '-');
            clean = clean.replace(/\s+\d{4,}$/, '');

            // RULE 7: Collapse multiple spaces
            clean = clean.replace(/\s{2,}/g, ' ');

            // RULE 8: Trim whitespace
            clean = clean.trim();

            // ═══════════════════════════════════════════════════════════
            // LEGACY CLEANING (Keep for backward compatibility)
            // ═══════════════════════════════════════════════════════════

            // Remove remaining technical noise
            clean = clean
                .replace(/\b(?=\w*\d)(?=\w*[a-z])[a-z0-9]{8,15}\b/gi, '') // Hash detection
                .replace(/\b[0-9]{10,20}\b/g, '')    // Long numeric sequences
                .replace(/continued\s*Date\s*Desc/gi, '');

            // Remove generic payment prefixes if they're standalone
            const genericPrefixes = [
                /^e-Transfer\s*(?:sent|received|to|from)?\s*/gi,
                /^Online\s*Banking\s*transfer\s*-?\s*\d*/gi,
                /^Interac\s*e-Transfer\s*/gi,
                /^Pay\s+Employee-Vendor\s*/gi,
                /^Mobile\s+cheque\s+deposit\s*/gi,
                /^Direct\s+Deposits\s*\(PDS\)\s*service\s*total/gi,
                /^Misc\s*Payment\s*PAY-FILE\s*FEES/gi,
                /^BR\s*TO\s*BR\s*-?\s*/gi,
                /^-+\s*/g
            ];

            genericPrefixes.forEach(p => clean = clean.replace(p, ''));

            // Final cleanup
            clean = clean.trim().replace(/\s+/g, ' ');

            if (!clean || clean.length < 2) return "Miscellaneous";

            return clean;
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
        Polarity,
        parseTransactionDescription,
        autoCategorizTransaction
    };

})();
