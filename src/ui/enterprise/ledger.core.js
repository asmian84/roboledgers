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
        fileStorage: new Map(),  // fileId -> Blob (In-memory for v5.1)
        lockedPeriods: [],       // [{period:"2024-01", lockedAt:ISO, lockedBy:"admin"}, ...]
        journalEntries: {},      // journalId -> {lines:[tx_id,...], date, description, type}
    };

    // --- COA DATA (V5 PRE-SEED) ---
    // Caseware Leadsheet Names (standard Canadian accounting leadsheet codes)
    const LEADSHEET_NAMES = {
        'A': 'Cash & Bank', 'B': 'Investments - Marketable Securities', 'C': 'Receivables',
        'D': 'Inventories', 'E': 'Loans Receivable - Current', 'L': 'Deposits & Prepaids',
        'M': 'Loans Receivable - Long Term', 'N': 'Long-term Investments', 'U': 'Capital Assets',
        'W': 'Intangibles', 'PP': 'Future Income Taxes', 'AA': 'Demand Loans',
        'BB': 'Accounts Payable & Accrued Liabilities', 'CC': 'GST/HST',
        'DD': 'Shareholder Loans (Short-term)', 'EE': 'Related Companies',
        'FF': 'Income Taxes Payable', 'HH': 'Deferred Revenue & Current Portion LTD',
        'KK': 'Long-term Debt', 'MM': 'Long-term Shareholder & Related',
        'SS': 'Share Capital', 'TT': 'Retained Earnings & Dividends',
        '20': 'Revenue', '30': 'Cost of Sales', '40': 'General & Administrative',
        '70': 'Other Income & Gains', '80': 'Income Taxes'
    };

    // Leadsheet display order (Balance Sheet first, then Income Statement)
    const LEADSHEET_ORDER = [
        'A','B','C','D','E','L','M','N','U','W',
        'PP','AA','BB','CC','DD','EE','FF','HH','KK','MM','SS','TT',
        '20','30','40','70','80'
    ];

    // Helper: infer root type from account code range
    function inferRoot(code) {
        const n = parseInt(code);
        if (n >= 1000 && n <= 1999) return 'ASSET';
        if (n >= 2000 && n <= 2999) return 'LIABILITY';
        if (n >= 3000 && n <= 3999) return 'EQUITY';
        if (n >= 4000 && n <= 4999) return 'REVENUE';
        if (n >= 5000 && n <= 9999) return 'EXPENSE';
        return 'EXPENSE';
    }

    // Full Chart of Accounts — Master template (from coa with map and type.xlsx)
    // Fields: code, name, root, leadsheet, sign, type, ls (leadsheet alias), mapNo (GIFI), balance
    const COA_DEFAULTS = [
        // ── ASSETS (1000-1961) ──────────────────────────────────────────────────
        { code: '1000', name: 'Bank - chequing', root: 'ASSET', leadsheet: 'A', sign: 'Debit', type: 'Balance sheet', ls: 'A', mapNo: 111, balance: 0 },
        { code: '1030', name: 'Bank - US account', root: 'ASSET', leadsheet: 'A', sign: 'Debit', type: 'Balance sheet', ls: 'A', mapNo: 111, balance: 0 },
        { code: '1035', name: 'Savings account', root: 'ASSET', leadsheet: 'A', sign: 'Debit', type: 'Balance sheet', ls: 'A', mapNo: 111, balance: 0 },
        { code: '1040', name: 'Savings account #2', root: 'ASSET', leadsheet: 'A', sign: 'Debit', type: 'Balance sheet', ls: 'A', mapNo: 111, balance: 0 },
        { code: '1100', name: 'Investments - Marketable securities', root: 'ASSET', leadsheet: 'B', sign: 'Debit', type: 'Balance sheet', ls: 'B', mapNo: 113, balance: 0 },
        { code: '1210', name: 'Accounts receivable', root: 'ASSET', leadsheet: 'C', sign: 'Debit', type: 'Balance sheet', ls: 'C', mapNo: 115, balance: 0 },
        { code: '1220', name: 'Accounts receivable-employee loan', root: 'ASSET', leadsheet: 'C', sign: 'Debit', type: 'Balance sheet', ls: 'C', mapNo: 115, balance: 0 },
        { code: '1221', name: 'Advances', root: 'ASSET', leadsheet: 'C', sign: 'Debit', type: 'Balance sheet', ls: 'C', mapNo: 115, balance: 0 },
        { code: '1240', name: 'Interest receivable', root: 'ASSET', leadsheet: 'C', sign: 'Debit', type: 'Balance sheet', ls: 'C', mapNo: 115, balance: 0 },
        { code: '1245', name: 'Loans receivable - current', root: 'ASSET', leadsheet: 'E', sign: 'Debit', type: 'Balance sheet', ls: 'E', mapNo: 118, balance: 0 },
        { code: '1250', name: 'NSF cheques', root: 'ASSET', leadsheet: 'C', sign: 'Debit', type: 'Balance sheet', ls: 'C', mapNo: 115, balance: 0 },
        { code: '1255', name: 'Allowance for doubtful accounts', root: 'ASSET', leadsheet: 'C', sign: 'Debit', type: 'Balance sheet', ls: 'C', mapNo: 115, balance: 0 },
        { code: '1260', name: 'Agreement of sale', root: 'ASSET', leadsheet: 'C', sign: 'Debit', type: 'Balance sheet', ls: 'C', mapNo: 115, balance: 0 },
        { code: '1270', name: 'Agreement of sale', root: 'ASSET', leadsheet: 'C', sign: 'Debit', type: 'Balance sheet', ls: 'C', mapNo: 115, balance: 0 },
        { code: '1280', name: 'Agreement of sale', root: 'ASSET', leadsheet: 'C', sign: 'Debit', type: 'Balance sheet', ls: 'C', mapNo: 115, balance: 0 },
        { code: '1290', name: 'Deposit', root: 'ASSET', leadsheet: 'L', sign: 'Debit', type: 'Balance sheet', ls: 'L', mapNo: 128, balance: 0 },
        { code: '1300', name: 'Inventories-merchandise', root: 'ASSET', leadsheet: 'D', sign: 'Debit', type: 'Balance sheet', ls: 'D', mapNo: 125, balance: 0 },
        { code: '1310', name: 'Inventories-supplies', root: 'ASSET', leadsheet: 'D', sign: 'Debit', type: 'Balance sheet', ls: 'D', mapNo: 125, balance: 0 },
        { code: '1320', name: 'Inventories-other', root: 'ASSET', leadsheet: 'D', sign: 'Debit', type: 'Balance sheet', ls: 'D', mapNo: 125, balance: 0 },
        { code: '1350', name: 'Prepaid expenses', root: 'ASSET', leadsheet: 'L', sign: 'Debit', type: 'Balance sheet', ls: 'L', mapNo: 128, balance: 0 },
        { code: '1400', name: 'Investments', root: 'ASSET', leadsheet: 'N', sign: 'Debit', type: 'Balance sheet', ls: 'N', mapNo: 131, balance: 0 },
        { code: '1500', name: 'Land', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: 151, balance: 0 },
        { code: '1600', name: 'Buildings', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: 155, balance: 0 },
        { code: '1650', name: 'Accum amort - buildings', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: 156, balance: 0 },
        { code: '1760', name: 'Office equipment', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: 157, balance: 0 },
        { code: '1761', name: 'Accum amort - office equipment', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: 158, balance: 0 },
        { code: '1762', name: 'Office furnishings', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: 157, balance: 0 },
        { code: '1763', name: 'Accum amort - office furnishings', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: 158, balance: 0 },
        { code: '1765', name: 'Heavy equipment', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: 157, balance: 0 },
        { code: '1766', name: 'Accum amort - heavy equipment', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: 158, balance: 0 },
        { code: '1768', name: 'Equipment', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: 157, balance: 0 },
        { code: '1769', name: 'Accum amort - equipment', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: 158, balance: 0 },
        { code: '1800', name: 'Vehicles', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: 157, balance: 0 },
        { code: '1820', name: 'Accum amort - vehicles', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: 158, balance: 0 },
        { code: '1840', name: 'Leasehold improvements', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: 167, balance: 0 },
        { code: '1845', name: 'Accum amort - leaseholds', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: 168, balance: 0 },
        { code: '1855', name: 'Computer equipment', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: '157.1774.01', balance: 0 },
        { code: '1856', name: 'Accum amort - computer equipment', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: '158.1775.01', balance: 0 },
        { code: '1857', name: 'Computer software', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: '157.1774.02', balance: 0 },
        { code: '1858', name: 'Accum amort - software', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: '158.1775.02', balance: 0 },
        { code: '1860', name: 'Capital assets - other', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: '167.1900.01', balance: 0 },
        { code: '1865', name: 'Accum amort - other', root: 'ASSET', leadsheet: 'U', sign: 'Debit', type: 'Balance sheet', ls: 'U', mapNo: '168.1901.01', balance: 0 },
        { code: '1900', name: 'Deposits', root: 'ASSET', leadsheet: 'L', sign: 'Debit', type: 'Balance sheet', ls: 'L', mapNo: 128, balance: 0 },
        { code: '1945', name: 'Loans receivable - long term', root: 'ASSET', leadsheet: 'M', sign: 'Debit', type: 'Balance sheet', ls: 'M', mapNo: 133, balance: 0 },
        { code: '1950', name: 'Goodwill', root: 'ASSET', leadsheet: 'W', sign: 'Debit', type: 'Balance sheet', ls: 'W', mapNo: 171, balance: 0 },
        { code: '1951', name: 'Accum amort - Goodwill', root: 'ASSET', leadsheet: 'W', sign: 'Debit', type: 'Balance sheet', ls: 'W', mapNo: 172, balance: 0 },
        { code: '1960', name: 'Incorporation costs', root: 'ASSET', leadsheet: 'W', sign: 'Debit', type: 'Balance sheet', ls: 'W', mapNo: 171, balance: 0 },
        { code: '1961', name: 'Accum amort - Incorporation', root: 'ASSET', leadsheet: 'W', sign: 'Debit', type: 'Balance sheet', ls: 'W', mapNo: 172, balance: 0 },

        // ── LIABILITIES (2000-2995) ─────────────────────────────────────────────
        { code: '2000', name: 'Future income taxes-long-term', root: 'LIABILITY', leadsheet: 'PP', sign: 'Credit', type: 'Balance sheet', ls: 'PP', mapNo: 241, balance: 0 },
        { code: '2010', name: 'Demand loan', root: 'LIABILITY', leadsheet: 'AA', sign: 'Credit', type: 'Balance sheet', ls: 'AA', mapNo: 213, balance: 0 },
        { code: '2020', name: 'Demand loan', root: 'LIABILITY', leadsheet: 'AA', sign: 'Credit', type: 'Balance sheet', ls: 'AA', mapNo: 213, balance: 0 },
        { code: '2030', name: 'Demand loan', root: 'LIABILITY', leadsheet: 'AA', sign: 'Credit', type: 'Balance sheet', ls: 'AA', mapNo: 213, balance: 0 },
        { code: '2100', name: 'Accounts payable', root: 'LIABILITY', leadsheet: 'BB', sign: 'Credit', type: 'Balance sheet', ls: 'BB', mapNo: 215, balance: 0 },
        { code: '2101', name: 'Visa payable', root: 'LIABILITY', leadsheet: 'BB', sign: 'Credit', type: 'Balance sheet', ls: 'BB', mapNo: 215, balance: 0 },
        { code: '2103', name: 'Bonus Payable', root: 'LIABILITY', leadsheet: 'BB', sign: 'Credit', type: 'Balance sheet', ls: 'BB', mapNo: 215, balance: 0 },
        { code: '2120', name: 'Unearned revenue', root: 'LIABILITY', leadsheet: 'HH', sign: 'Credit', type: 'Balance sheet', ls: 'HH', mapNo: 218, balance: 0 },
        { code: '2140', name: 'Accrued liabilities', root: 'LIABILITY', leadsheet: 'BB', sign: 'Credit', type: 'Balance sheet', ls: 'BB', mapNo: 215, balance: 0 },
        { code: '2148', name: 'GST balance from prior year', root: 'LIABILITY', leadsheet: 'CC', sign: 'Credit', type: 'Balance sheet', ls: 'CC', mapNo: '217.2680.10', balance: 0 },
        { code: '2149', name: 'GST payments to Revenue Canada', root: 'LIABILITY', leadsheet: 'CC', sign: 'Credit', type: 'Balance sheet', ls: 'CC', mapNo: '217.2680.10', balance: 0 },
        { code: '2150', name: 'GST paid on purchases', root: 'LIABILITY', leadsheet: 'CC', sign: 'Credit', type: 'Balance sheet', ls: 'CC', mapNo: '217.2680.10', balance: 0 },
        { code: '2160', name: 'GST collected on sales', root: 'LIABILITY', leadsheet: 'CC', sign: 'Credit', type: 'Balance sheet', ls: 'CC', mapNo: '217.2680.10', balance: 0 },
        { code: '2170', name: 'GST Installments', root: 'LIABILITY', leadsheet: 'CC', sign: 'Credit', type: 'Balance sheet', ls: 'CC', mapNo: '217.2680.10', balance: 0 },
        { code: '2171', name: 'GST Q1 - FILED', root: 'LIABILITY', leadsheet: 'CC', sign: 'Credit', type: 'Balance sheet', ls: 'CC', mapNo: '217.2680.10', balance: 0 },
        { code: '2172', name: 'GST Q2 - FILED', root: 'LIABILITY', leadsheet: 'CC', sign: 'Credit', type: 'Balance sheet', ls: 'CC', mapNo: '217.2680.10', balance: 0 },
        { code: '2173', name: 'GST Q3 - FILED', root: 'LIABILITY', leadsheet: 'CC', sign: 'Credit', type: 'Balance sheet', ls: 'CC', mapNo: '217.2680.10', balance: 0 },
        { code: '2174', name: 'GST Q4 - FILED', root: 'LIABILITY', leadsheet: 'CC', sign: 'Credit', type: 'Balance sheet', ls: 'CC', mapNo: '217.2680.10', balance: 0 },
        { code: '2180', name: 'Accrued wages', root: 'LIABILITY', leadsheet: 'BB', sign: 'Credit', type: 'Balance sheet', ls: 'BB', mapNo: 215, balance: 0 },
        { code: '2300', name: 'Income tax deductions', root: 'LIABILITY', leadsheet: 'BB', sign: 'Credit', type: 'Balance sheet', ls: 'BB', mapNo: 215, balance: 0 },
        { code: '2330', name: 'CPP deductions', root: 'LIABILITY', leadsheet: 'BB', sign: 'Credit', type: 'Balance sheet', ls: 'BB', mapNo: 215, balance: 0 },
        { code: '2340', name: 'EI deductions', root: 'LIABILITY', leadsheet: 'BB', sign: 'Credit', type: 'Balance sheet', ls: 'BB', mapNo: 215, balance: 0 },
        { code: '2600', name: 'Income taxes payable-Federal-current year', root: 'LIABILITY', leadsheet: 'FF', sign: 'Credit', type: 'Balance sheet', ls: 'FF', mapNo: '217.2680.01', balance: 0 },
        { code: '2601', name: 'Income taxes payable - Federal - PY', root: 'LIABILITY', leadsheet: 'FF', sign: 'Credit', type: 'Balance sheet', ls: 'FF', mapNo: '217.2680.01', balance: 0 },
        { code: '2602', name: 'Income tax installments - Federal - Installments', root: 'LIABILITY', leadsheet: 'FF', sign: 'Credit', type: 'Balance sheet', ls: 'FF', mapNo: '217.2680.01', balance: 0 },
        { code: '2620', name: 'Income taxes payable-Prov.-current year', root: 'LIABILITY', leadsheet: 'FF', sign: 'Credit', type: 'Balance sheet', ls: 'FF', mapNo: '217.2680.02', balance: 0 },
        { code: '2621', name: 'Income taxes payable - Provincial - PY', root: 'LIABILITY', leadsheet: 'FF', sign: 'Credit', type: 'Balance sheet', ls: 'FF', mapNo: '217.2680.02', balance: 0 },
        { code: '2622', name: 'Income taxes payable - Provincial - Installments', root: 'LIABILITY', leadsheet: 'FF', sign: 'Credit', type: 'Balance sheet', ls: 'FF', mapNo: '217.2680.02', balance: 0 },
        { code: '2650', name: 'Shareholder loan #1 -short term', root: 'LIABILITY', leadsheet: 'DD', sign: 'Credit', type: 'Balance sheet', ls: 'DD', mapNo: '221.2781.01', balance: 0 },
        { code: '2652', name: 'Shareholder loan #2 -short term', root: 'LIABILITY', leadsheet: 'DD', sign: 'Credit', type: 'Balance sheet', ls: 'DD', mapNo: '221.2781.02', balance: 0 },
        { code: '2654', name: 'Shareholder loan #3 -short term', root: 'LIABILITY', leadsheet: 'DD', sign: 'Credit', type: 'Balance sheet', ls: 'DD', mapNo: '221.2781.03', balance: 0 },
        { code: '2656', name: 'Shareholder loan #4 -short term', root: 'LIABILITY', leadsheet: 'DD', sign: 'Credit', type: 'Balance sheet', ls: 'DD', mapNo: '221.2781.04', balance: 0 },
        { code: '2658', name: 'Shareholder loan #5 -short term', root: 'LIABILITY', leadsheet: 'DD', sign: 'Credit', type: 'Balance sheet', ls: 'DD', mapNo: '221.2781.05', balance: 0 },
        { code: '2660', name: 'Shareholder loan #6 -short term', root: 'LIABILITY', leadsheet: 'DD', sign: 'Credit', type: 'Balance sheet', ls: 'DD', mapNo: '221.2781.06', balance: 0 },
        { code: '2662', name: 'Shareholder loan #7 -short term', root: 'LIABILITY', leadsheet: 'DD', sign: 'Credit', type: 'Balance sheet', ls: 'DD', mapNo: '221.2781.07', balance: 0 },
        { code: '2664', name: 'Shareholder loan #8 -short term', root: 'LIABILITY', leadsheet: 'DD', sign: 'Credit', type: 'Balance sheet', ls: 'DD', mapNo: '221.2781.08', balance: 0 },
        { code: '2670', name: 'Due from (to) related company #A-short term', root: 'LIABILITY', leadsheet: 'EE', sign: 'Credit', type: 'Balance sheet', ls: 'EE', mapNo: '223.2860.01', balance: 0 },
        { code: '2672', name: 'Due from (to) related company #B-short term', root: 'LIABILITY', leadsheet: 'EE', sign: 'Credit', type: 'Balance sheet', ls: 'EE', mapNo: '223.2860.02', balance: 0 },
        { code: '2674', name: 'Due from (to) related company #C-short term', root: 'LIABILITY', leadsheet: 'EE', sign: 'Credit', type: 'Balance sheet', ls: 'EE', mapNo: '223.2860.03', balance: 0 },
        { code: '2676', name: 'Due from (to) related company #D-short term', root: 'LIABILITY', leadsheet: 'EE', sign: 'Credit', type: 'Balance sheet', ls: 'EE', mapNo: '223.2860.04', balance: 0 },
        { code: '2678', name: 'Due from (to) related company #E-short term', root: 'LIABILITY', leadsheet: 'EE', sign: 'Credit', type: 'Balance sheet', ls: 'EE', mapNo: '223.2860.05', balance: 0 },
        { code: '2680', name: 'Due from (to) related company #F-short term', root: 'LIABILITY', leadsheet: 'EE', sign: 'Credit', type: 'Balance sheet', ls: 'EE', mapNo: '223.2860.06', balance: 0 },
        { code: '2682', name: 'Due from (to) related company #G-short term', root: 'LIABILITY', leadsheet: 'EE', sign: 'Credit', type: 'Balance sheet', ls: 'EE', mapNo: '223.2860.07', balance: 0 },
        { code: '2684', name: 'Due from (to) related company #H-short term', root: 'LIABILITY', leadsheet: 'EE', sign: 'Credit', type: 'Balance sheet', ls: 'EE', mapNo: '223.2860.08', balance: 0 },
        { code: '2685', name: 'Contingent liabilities', root: 'LIABILITY', leadsheet: 'BB', sign: 'Credit', type: 'Balance sheet', ls: 'BB', mapNo: 215, balance: 0 },
        { code: '2690', name: 'Current portion of long-term debt', root: 'LIABILITY', leadsheet: '', sign: 'Credit', type: 'Balance sheet', ls: '', mapNo: 225, balance: 0 },
        { code: '2700', name: 'Future income taxes-current portion', root: 'LIABILITY', leadsheet: 'PP', sign: 'Credit', type: 'Balance sheet', ls: 'PP', mapNo: 228, balance: 0 },
        { code: '2710', name: 'Bank loan #1', root: 'LIABILITY', leadsheet: 'KK', sign: 'Credit', type: 'Balance sheet', ls: 'KK', mapNo: '231.3140.01', balance: 0 },
        { code: '2712', name: 'Bank loan #2', root: 'LIABILITY', leadsheet: 'KK', sign: 'Credit', type: 'Balance sheet', ls: 'KK', mapNo: '231.3140.02', balance: 0 },
        { code: '2714', name: 'Bank loan #3', root: 'LIABILITY', leadsheet: 'KK', sign: 'Credit', type: 'Balance sheet', ls: 'KK', mapNo: '231.3140.03', balance: 0 },
        { code: '2716', name: 'Bank loan #4', root: 'LIABILITY', leadsheet: 'KK', sign: 'Credit', type: 'Balance sheet', ls: 'KK', mapNo: '231.3140.04', balance: 0 },
        { code: '2718', name: 'Bank loan #5', root: 'LIABILITY', leadsheet: 'KK', sign: 'Credit', type: 'Balance sheet', ls: 'KK', mapNo: '231.3140.05', balance: 0 },
        { code: '2720', name: 'Bank loan #6', root: 'LIABILITY', leadsheet: 'KK', sign: 'Credit', type: 'Balance sheet', ls: 'KK', mapNo: '231.3140.06', balance: 0 },
        { code: '2722', name: 'Bank loan #7', root: 'LIABILITY', leadsheet: 'KK', sign: 'Credit', type: 'Balance sheet', ls: 'KK', mapNo: '231.3140.07', balance: 0 },
        { code: '2724', name: 'Bank loan #8', root: 'LIABILITY', leadsheet: 'KK', sign: 'Credit', type: 'Balance sheet', ls: 'KK', mapNo: '231.3140.08', balance: 0 },
        { code: '2800', name: 'Mortgage #1', root: 'LIABILITY', leadsheet: 'KK', sign: 'Credit', type: 'Balance sheet', ls: 'KK', mapNo: '231.3141.01', balance: 0 },
        { code: '2810', name: 'Mortgage #2', root: 'LIABILITY', leadsheet: 'KK', sign: 'Credit', type: 'Balance sheet', ls: 'KK', mapNo: '231.3141.02', balance: 0 },
        { code: '2820', name: 'Mortgage #3', root: 'LIABILITY', leadsheet: 'KK', sign: 'Credit', type: 'Balance sheet', ls: 'KK', mapNo: '231.3141.03', balance: 0 },
        { code: '2850', name: 'Finance contract #1', root: 'LIABILITY', leadsheet: 'KK', sign: 'Credit', type: 'Balance sheet', ls: 'KK', mapNo: '231.3140.51', balance: 0 },
        { code: '2860', name: 'Finance contract #2', root: 'LIABILITY', leadsheet: 'KK', sign: 'Credit', type: 'Balance sheet', ls: 'KK', mapNo: '231.3140.52', balance: 0 },
        { code: '2870', name: 'Finance contract #3', root: 'LIABILITY', leadsheet: 'KK', sign: 'Credit', type: 'Balance sheet', ls: 'KK', mapNo: '231.3140.53', balance: 0 },
        { code: '2880', name: 'Finance contract #4', root: 'LIABILITY', leadsheet: 'KK', sign: 'Credit', type: 'Balance sheet', ls: 'KK', mapNo: '231.3140.54', balance: 0 },
        { code: '2950', name: 'Shareholder loan #1 - Long term.', root: 'LIABILITY', leadsheet: 'MM', sign: 'Credit', type: 'Balance sheet', ls: 'MM', mapNo: '235.3261.01', balance: 0 },
        { code: '2952', name: 'Shareholder loan #2 - Long term', root: 'LIABILITY', leadsheet: 'MM', sign: 'Credit', type: 'Balance sheet', ls: 'MM', mapNo: '235.3261.02', balance: 0 },
        { code: '2954', name: 'Shareholder loan #3 - Long term', root: 'LIABILITY', leadsheet: 'MM', sign: 'Credit', type: 'Balance sheet', ls: 'MM', mapNo: '235.3261.03', balance: 0 },
        { code: '2956', name: 'Shareholder loan #4 - Long term', root: 'LIABILITY', leadsheet: 'MM', sign: 'Credit', type: 'Balance sheet', ls: 'MM', mapNo: '235.3261.04', balance: 0 },
        { code: '2958', name: 'Shareholder loan #5 - Long term', root: 'LIABILITY', leadsheet: 'MM', sign: 'Credit', type: 'Balance sheet', ls: 'MM', mapNo: '235.3261.05', balance: 0 },
        { code: '2960', name: 'Shareholder loan #6 - Long term', root: 'LIABILITY', leadsheet: 'MM', sign: 'Credit', type: 'Balance sheet', ls: 'MM', mapNo: '235.3261.06', balance: 0 },
        { code: '2962', name: 'Shareholder loan #7 - Long term', root: 'LIABILITY', leadsheet: 'MM', sign: 'Credit', type: 'Balance sheet', ls: 'MM', mapNo: '235.3261.07', balance: 0 },
        { code: '2964', name: 'Shareholder loan #8 - Long term', root: 'LIABILITY', leadsheet: 'MM', sign: 'Credit', type: 'Balance sheet', ls: 'MM', mapNo: '235.3261.08', balance: 0 },
        { code: '2970', name: 'Due from (to) related company #A.-long term', root: 'LIABILITY', leadsheet: 'MM', sign: 'Credit', type: 'Balance sheet', ls: 'MM', mapNo: '237.3300.01', balance: 0 },
        { code: '2972', name: 'Due from (to) related company #B.-long term', root: 'LIABILITY', leadsheet: 'MM', sign: 'Credit', type: 'Balance sheet', ls: 'MM', mapNo: '237.3300.02', balance: 0 },
        { code: '2974', name: 'Due from (to) related company #C-long term', root: 'LIABILITY', leadsheet: 'EE', sign: 'Credit', type: 'Balance sheet', ls: 'EE', mapNo: '223.2860.03', balance: 0 },
        { code: '2976', name: 'Due from (to) related company #D-long term', root: 'LIABILITY', leadsheet: 'MM', sign: 'Credit', type: 'Balance sheet', ls: 'MM', mapNo: '237.3300.04', balance: 0 },
        { code: '2978', name: 'Due from (to) related company #E-long term', root: 'LIABILITY', leadsheet: 'MM', sign: 'Credit', type: 'Balance sheet', ls: 'MM', mapNo: '237.3300.05', balance: 0 },
        { code: '2980', name: 'Due from (to) related company #F-long term', root: 'LIABILITY', leadsheet: 'MM', sign: 'Credit', type: 'Balance sheet', ls: 'MM', mapNo: '237.3300.06', balance: 0 },
        { code: '2982', name: 'Due from (to) related company #G-long term', root: 'LIABILITY', leadsheet: 'MM', sign: 'Credit', type: 'Balance sheet', ls: 'MM', mapNo: '237.3300.07', balance: 0 },
        { code: '2984', name: 'Due from (to) related company #H-long term', root: 'LIABILITY', leadsheet: 'MM', sign: 'Credit', type: 'Balance sheet', ls: 'MM', mapNo: '237.3300.08', balance: 0 },
        { code: '2995', name: 'Current portion of long term debt (OFFSET)', root: 'LIABILITY', leadsheet: 'HH', sign: 'Credit', type: 'Balance sheet', ls: 'HH', mapNo: 225, balance: 0 },

        // ── EQUITY (3000-3999) ──────────────────────────────────────────────────
        { code: '3000', name: 'Share capital - common', root: 'EQUITY', leadsheet: 'SS', sign: 'Credit', type: 'Balance sheet', ls: 'SS', mapNo: '271.3500.01', balance: 0 },
        { code: '3100', name: 'Share capital - preferred', root: 'EQUITY', leadsheet: 'SS', sign: 'Credit', type: 'Balance sheet', ls: 'SS', mapNo: '272.3520.01', balance: 0 },
        { code: '3200', name: 'Contributed surplus', root: 'EQUITY', leadsheet: 'TT. 1', sign: 'Credit', type: 'Balance sheet', ls: 'TT. 1', mapNo: 273, balance: 0 },
        { code: '3640', name: 'Dividends paid-taxable', root: 'EQUITY', leadsheet: 'TT', sign: 'Credit', type: 'Balance sheet', ls: 'TT', mapNo: 276, balance: 0 },
        { code: '3650', name: 'Dividends paid-capital', root: 'EQUITY', leadsheet: 'TT', sign: 'Credit', type: 'Balance sheet', ls: 'TT', mapNo: 276, balance: 0 },
        { code: '3999', name: 'Retained earnings', root: 'EQUITY', leadsheet: 'TT', sign: 'Credit', type: 'Balance sheet', ls: 'TT', mapNo: 274, balance: 0 },

        // ── REVENUE (4001-4973) ─────────────────────────────────────────────────
        { code: '4001', name: 'Sales', root: 'REVENUE', leadsheet: '20', sign: 'Credit', type: 'Income statement', ls: '20', mapNo: 311, balance: 0 },
        { code: '4002', name: 'Consulting fees', root: 'REVENUE', leadsheet: '20', sign: 'Credit', type: 'Income statement', ls: '20', mapNo: 381, balance: 0 },
        { code: '4003', name: 'Contracting fees', root: 'REVENUE', leadsheet: '20', sign: 'Credit', type: 'Income statement', ls: '20', mapNo: 381, balance: 0 },
        { code: '4004', name: 'Management fees', root: 'REVENUE', leadsheet: '20', sign: 'Credit', type: 'Income statement', ls: '20', mapNo: 381, balance: 0 },
        { code: '4010', name: 'GST Government assistance', root: 'REVENUE', leadsheet: '20', sign: 'Credit', type: 'Income statement', ls: '20', mapNo: 311, balance: 0 },
        { code: '4700', name: 'Commissions', root: 'REVENUE', leadsheet: '20', sign: 'Credit', type: 'Income statement', ls: '20', mapNo: 331, balance: 0 },
        { code: '4840', name: 'Expenses recovered', root: 'REVENUE', leadsheet: '70', sign: 'Credit', type: 'Income statement', ls: '70', mapNo: 381, balance: 0 },
        { code: '4860', name: 'Interest income', root: 'REVENUE', leadsheet: '70', sign: 'Credit', type: 'Income statement', ls: '70', mapNo: 321, balance: 0 },
        { code: '4880', name: 'Intercompany dividends', root: 'REVENUE', leadsheet: '70', sign: 'Credit', type: 'Income statement', ls: '70', mapNo: 341, balance: 0 },
        { code: '4900', name: 'Rental revenue', root: 'REVENUE', leadsheet: '20', sign: 'Credit', type: 'Income statement', ls: '20', mapNo: 351, balance: 0 },
        { code: '4950', name: 'Loss (gain) on sale of assets', root: 'REVENUE', leadsheet: '70', sign: 'Credit', type: 'Income statement', ls: '70', mapNo: 361, balance: 0 },
        { code: '4970', name: 'Other gains', root: 'REVENUE', leadsheet: '70', sign: 'Credit', type: 'Income statement', ls: '70', mapNo: 361, balance: 0 },
        { code: '4971', name: 'Portfolio investment dividends', root: 'REVENUE', leadsheet: '70', sign: 'Credit', type: 'Income statement', ls: '70', mapNo: 341, balance: 0 },
        { code: '4972', name: 'Portfolio capital gains dividends', root: 'REVENUE', leadsheet: '70', sign: 'Credit', type: 'Income statement', ls: '70', mapNo: 341, balance: 0 },
        { code: '4973', name: 'Gain (loss) on sale of investments', root: 'REVENUE', leadsheet: '70', sign: 'Credit', type: 'Income statement', ls: '70', mapNo: 361, balance: 0 },

        // ── COST OF SALES / COGS (5305-5700) ───────────────────────────────────
        { code: '5305', name: 'Consultants', root: 'EXPENSE', leadsheet: '30', sign: 'Debit', type: 'Income statement', ls: '30', mapNo: '428.8450.10', balance: 0 },
        { code: '5310', name: 'Equipment rental', root: 'EXPENSE', leadsheet: '30', sign: 'Debit', type: 'Income statement', ls: '30', mapNo: '428.8450.30', balance: 0 },
        { code: '5320', name: 'Equipment repairs', root: 'EXPENSE', leadsheet: '30', sign: 'Debit', type: 'Income statement', ls: '30', mapNo: '428.8450.35', balance: 0 },
        { code: '5330', name: 'Fuel and oil', root: 'EXPENSE', leadsheet: '30', sign: 'Debit', type: 'Income statement', ls: '30', mapNo: '428.8450.15', balance: 0 },
        { code: '5335', name: 'Materials and supplies', root: 'EXPENSE', leadsheet: '30', sign: 'Debit', type: 'Income statement', ls: '30', mapNo: '428.8450.40', balance: 0 },
        { code: '5340', name: 'Insurance', root: 'EXPENSE', leadsheet: '30', sign: 'Debit', type: 'Income statement', ls: '30', mapNo: '428.8450.20', balance: 0 },
        { code: '5345', name: 'Opening inventory', root: 'EXPENSE', leadsheet: '30', sign: 'Debit', type: 'Income statement', ls: '30', mapNo: 411, balance: 0 },
        { code: '5350', name: 'Purchases', root: 'EXPENSE', leadsheet: '30', sign: 'Debit', type: 'Income statement', ls: '30', mapNo: 421, balance: 0 },
        { code: '5351', name: 'Direct cost #1', root: 'EXPENSE', leadsheet: '30', sign: 'Debit', type: 'Income statement', ls: '30', mapNo: '428.8450.80', balance: 0 },
        { code: '5352', name: 'Direct cost #2', root: 'EXPENSE', leadsheet: '30', sign: 'Debit', type: 'Income statement', ls: '30', mapNo: '428.8450.81', balance: 0 },
        { code: '5353', name: 'Direct cost #3', root: 'EXPENSE', leadsheet: '30', sign: 'Debit', type: 'Income statement', ls: '30', mapNo: '428.8450.83', balance: 0 },
        { code: '5355', name: 'Closing inventory', root: 'EXPENSE', leadsheet: '30', sign: 'Debit', type: 'Income statement', ls: '30', mapNo: 431, balance: 0 },
        { code: '5360', name: 'Subcontractors', root: 'EXPENSE', leadsheet: '30', sign: 'Debit', type: 'Income statement', ls: '30', mapNo: 424, balance: 0 },
        { code: '5377', name: 'Direct wages', root: 'EXPENSE', leadsheet: '30', sign: 'Debit', type: 'Income statement', ls: '30', mapNo: 422, balance: 0 },
        { code: '5380', name: 'Vehicle', root: 'EXPENSE', leadsheet: '30', sign: 'Debit', type: 'Income statement', ls: '30', mapNo: '428.8450.60', balance: 0 },
        { code: '5700', name: 'Freight', root: 'EXPENSE', leadsheet: '30', sign: 'Debit', type: 'Income statement', ls: '30', mapNo: 428, balance: 0 },

        // ── GENERAL & ADMINISTRATIVE (6000-9800) ────────────────────────────────
        { code: '6000', name: 'Advertising', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 511, balance: 0 },
        { code: '6100', name: 'Amortization on tangible assets', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 521, balance: 0 },
        { code: '6300', name: 'Bad debts', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 515, balance: 0 },
        { code: '6400', name: 'Building repairs', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 535, balance: 0 },
        { code: '6410', name: 'Business taxes', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 527, balance: 0 },
        { code: '6415', name: 'Client meals and entertainment', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 511, balance: 0 },
        { code: '6420', name: 'Conferences', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 545, balance: 0 },
        { code: '6450', name: 'Consulting fees', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 531, balance: 0 },
        { code: '6500', name: 'Contract wages', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 537, balance: 0 },
        { code: '6550', name: 'Courier', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 581, balance: 0 },
        { code: '6600', name: 'Credit card charges', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 525, balance: 0 },
        { code: '6750', name: 'Donations', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 511, balance: 0 },
        { code: '6800', name: 'Dues, memberships and subscriptions', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 527, balance: 0 },
        { code: '6900', name: 'Employee benefits', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 517, balance: 0 },
        { code: '7000', name: 'Equipment rentals', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 533, balance: 0 },
        { code: '7100', name: 'Equipment repairs', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 535, balance: 0 },
        { code: '7400', name: 'Fuel and oil', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 581, balance: 0 },
        { code: '7600', name: 'Insurance', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 523, balance: 0 },
        { code: '7700', name: 'Interest and bank charges', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 525, balance: 0 },
        { code: '7750', name: 'Interest on income taxes', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 525, balance: 0 },
        { code: '7751', name: 'CRA penalties and interest', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 525, balance: 0 },
        { code: '7752', name: 'Loss (gain) on foreign exchange', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 525, balance: 0 },
        { code: '7800', name: 'Interest on long-term debt', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 525, balance: 0 },
        { code: '7890', name: 'Legal fees', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 531, balance: 0 },
        { code: '8400', name: 'Management remuneration', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 537, balance: 0 },
        { code: '8450', name: 'Materials and supplies', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 541, balance: 0 },
        // 8500 Miscellaneous REMOVED — nothing should auto-categorize to this account.
        // OFFICE_SVC → 8600, GENERAL_RETAIL → 9970 (flag for review)
        { code: '8600', name: 'Office supplies and postage', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 529, balance: 0 },
        { code: '8700', name: 'Professional fees', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 531, balance: 0 },
        { code: '8710', name: 'Property taxes', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 543, balance: 0 },
        { code: '8720', name: 'Rent', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 533, balance: 0 },
        { code: '8800', name: 'Repairs and maintenance', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 535, balance: 0 },
        { code: '8850', name: 'Security', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 535, balance: 0 },
        { code: '8900', name: 'Shop supplies', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 541, balance: 0 },
        { code: '8950', name: 'Subcontracting', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 539, balance: 0 },
        { code: '9100', name: 'Telephone', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 547, balance: 0 },
        { code: '9200', name: 'Travel and accomodations', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 545, balance: 0 },
        { code: '9250', name: 'Training - Courses', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 531, balance: 0 },
        { code: '9500', name: 'Utilities', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 547, balance: 0 },
        { code: '9550', name: 'Uniforms', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 541, balance: 0 },
        { code: '9700', name: 'Vehicle', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 581, balance: 0 },
        { code: '9750', name: 'Workers compensation', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 517, balance: 0 },
        { code: '9800', name: 'Wages and benefits', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 537, balance: 0 },

        // ── INCOME TAXES (9950-9970) ────────────────────────────────────────────
        { code: '9950', name: 'Income taxes - current', root: 'EXPENSE', leadsheet: '80', sign: 'Debit', type: 'Income statement', ls: '80', mapNo: '810.9990.01', balance: 0 },
        { code: '9955', name: 'Income taxes - recovery', root: 'EXPENSE', leadsheet: '80', sign: 'Debit', type: 'Income statement', ls: '80', mapNo: '810.9990.02', balance: 0 },
        { code: '9960', name: 'Income taxes - future', root: 'EXPENSE', leadsheet: '80', sign: 'Debit', type: 'Income statement', ls: '80', mapNo: 820, balance: 0 },
        { code: '9970', name: 'Unusual item', root: 'EXPENSE', leadsheet: '70', sign: 'Debit', type: 'Income statement', ls: '70', mapNo: 850, balance: 0 },

        // ── SUPPLEMENTAL CODES (used in real data, not in default CaseWare set) ─
        { code: '4000', name: 'Revenue - general', root: 'REVENUE', leadsheet: '20', sign: 'Credit', type: 'Income statement', ls: '20', mapNo: 8000, balance: 0 },
        { code: '5325', name: 'Cleaning and janitorial', root: 'EXPENSE', leadsheet: '30', sign: 'Debit', type: 'Income statement', ls: '30', mapNo: 8690, balance: 0 },
        { code: '5336', name: 'Supplies - building and property', root: 'EXPENSE', leadsheet: '30', sign: 'Debit', type: 'Income statement', ls: '30', mapNo: 8690, balance: 0 },
        { code: '5365', name: 'Property management fees', root: 'EXPENSE', leadsheet: '30', sign: 'Debit', type: 'Income statement', ls: '30', mapNo: 8690, balance: 0 },
        { code: '7300', name: 'Repairs and maintenance - property', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 8960, balance: 0 },
        { code: '8100', name: 'Meals and entertainment', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 8523, balance: 0 },
        { code: '8650', name: 'Software and subscriptions', root: 'EXPENSE', leadsheet: '40', sign: 'Debit', type: 'Income statement', ls: '40', mapNo: 8760, balance: 0 },
        { code: '9971', name: 'Credit card payment', root: 'LIABILITY', leadsheet: 'BB', sign: 'Credit', type: 'Balance sheet', ls: 'BB', mapNo: 2580, balance: 0 }
    ];

    // --- STORAGE ENGINE ---
    const LEDGER_VERSION = '2.0.0'; // Increment when schema/logic changes

    function load() {
        const _SS = window.StorageService;
        const parsed = _SS ? _SS.get(STORAGE_KEY) : (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } })();
        if (parsed) {
            try {
                // Version check - auto-clear incompatible cache
                const savedVersion = parsed.version || '1.0.0';
                if (savedVersion !== LEDGER_VERSION) {
                    console.warn(`[LEDGER] Version mismatch: saved=${savedVersion}, current=${LEDGER_VERSION}`);
                    console.warn('[LEDGER] Clearing incompatible cache and starting fresh');
                    if (_SS) _SS.remove(STORAGE_KEY); else localStorage.removeItem(STORAGE_KEY);
                    return;
                }

                state.transactions = parsed.transactions || {};
                state.sigIndex = parsed.sigIndex || {};
                state.accounts = parsed.accounts || [];
                state.coa = parsed.coa || {};
                state.lockedPeriods = parsed.lockedPeriods || [];
                state.journalEntries = parsed.journalEntries || {};

                console.log(`[LEDGER] Loaded ${Object.keys(state.transactions).length} transactions from storage`);

                if (window.RuleEngine?.updateTransactionContext) {
                    window.RuleEngine.updateTransactionContext(Object.values(state.transactions));
                    console.log('[LEDGER] Updated SignalFusionEngine transaction context');
                }
                console.log(`[LEDGER] State loaded (v${LEDGER_VERSION})`);
            } catch (e) {
                console.error('[LEDGER] Failed to load state', e);
                if (_SS) _SS.remove(STORAGE_KEY); else localStorage.removeItem(STORAGE_KEY);
            }
        }
    }

    function save() {
        // Client-aware save: write to per-client key when a client is active
        const clientId = window.UI_STATE?.activeClientId;
        const key = clientId ? ('roboledger_v5_data_' + clientId) : STORAGE_KEY;
        const data = {
            version: LEDGER_VERSION,
            transactions: state.transactions,
            sigIndex: state.sigIndex,
            accounts: state.accounts,
            coa: state.coa,
            lockedPeriods: state.lockedPeriods || [],
            journalEntries: state.journalEntries || {},
        };
        const _SS = window.StorageService;
        if (_SS) {
            _SS.set(key, data);
        } else {
            localStorage.setItem(key, JSON.stringify(data));
        }
    }

    // Client-aware load by arbitrary key (called by app.js switchClient / init restore)
    function loadFromKey(key) {
        const _SS = window.StorageService;
        const raw = _SS ? _SS.get(key) : localStorage.getItem(key);
        state.transactions = {};
        state.sigIndex = {};
        state.accounts = [];
        state.coa = {};
        state.lockedPeriods = [];
        state.journalEntries = {};
        if (!raw) {
            console.log(`[LEDGER] No data at key: ${key} — starting fresh`);
            // Re-seed COA defaults so dropdowns/lookups work even on a fresh client
            COA.init();
            return;
        }
        try {
            // StorageService.get() returns already-parsed objects; localStorage returns strings
            const parsed = (typeof raw === 'string') ? JSON.parse(raw) : raw;
            state.transactions   = parsed.transactions   || {};
            state.sigIndex       = parsed.sigIndex       || {};
            state.accounts       = parsed.accounts       || [];
            state.coa            = parsed.coa            || {};
            state.lockedPeriods  = parsed.lockedPeriods  || [];
            state.journalEntries = parsed.journalEntries || {};

            // MIGRATION: Backfill client_id on legacy transactions (lazy, idempotent)
            const _keyMatch = key.match(/^roboledger_v5_data_(.+)$/);
            const _clientIdFromKey = _keyMatch ? _keyMatch[1] : null;
            if (_clientIdFromKey) {
                let _migrated = 0;
                for (const _txId in state.transactions) {
                    if (!state.transactions[_txId].client_id) {
                        state.transactions[_txId].client_id = _clientIdFromKey;
                        _migrated++;
                    }
                }
                if (_migrated > 0) {
                    console.log(`[LEDGER] Migrated ${_migrated} txns → client_id=${_clientIdFromKey}`);
                    save();
                }
            }

            // Re-seed COA defaults (backfills any missing entries after client switch)
            COA.init();

            // MIGRATION: Rebuild stale account display names and sync COA entries.
            //
            // Two related issues fixed here:
            // 1. acc.name may be stale (e.g. "TD - Chequing") if the account was first
            //    imported with wrong bank data that was later corrected. Rebuild the name
            //    whenever bankName is available and disagrees with the name.
            // 2. COA entry names were never updated when acc.name changed. Sync them.
            //
            // This pass runs on every load — idempotent and cheap.
            let _coaNameSynced = 0;
            for (const acc of state.accounts) {
                // ── Step 1: Rebuild acc.name if bankName disagrees with current name ──
                if (acc.bankName && acc.name) {
                    const bankShortLookup = {
                        'Royal Bank of Canada': 'RBC', 'RBC Royal Bank': 'RBC', 'RBC': 'RBC',
                        'Toronto-Dominion Bank': 'TD', 'TD Canada Trust': 'TD', 'TD': 'TD',
                        'Canadian Imperial Bank of Commerce': 'CIBC', 'CIBC': 'CIBC',
                        'Bank of Montreal': 'BMO', 'BMO Bank of Montreal': 'BMO', 'BMO': 'BMO',
                        'Scotiabank': 'Scotia', 'The Bank of Nova Scotia': 'Scotia',
                        'ATB Financial': 'ATB', 'ATB': 'ATB', 'HSBC': 'HSBC'
                    };
                    const instCodeMap = { '003': 'RBC', '001': 'BMO', '004': 'TD', '002': 'Scotia', '010': 'CIBC', '016': 'HSBC' };
                    const expectedBank = bankShortLookup[acc.bankName] || acc.bankName || instCodeMap[acc.inst] || '';
                    // Check if the name starts with the right bank abbreviation
                    if (expectedBank && !acc.name.toLowerCase().startsWith(expectedBank.toLowerCase())) {
                        const rebuilt = Accounts._buildCleanAccountName(acc);
                        if (rebuilt && rebuilt !== acc.name && !rebuilt.startsWith('Bank -')) {
                            console.log(`[ACCOUNTS] Rebuilt stale name for ${acc.id}: "${acc.name}" → "${rebuilt}"`);
                            acc.name = rebuilt;
                        }
                    }
                }

                // ── Step 2: Sync COA entry name to acc.name ──
                if (acc.coaCode && acc.name && state.coa[acc.coaCode]) {
                    const coaEntry = state.coa[acc.coaCode];
                    if (coaEntry.name !== acc.name) {
                        console.log(`[COA] Migrate name: ${acc.coaCode} "${coaEntry.name}" → "${acc.name}"`);
                        coaEntry.name = acc.name;
                        _coaNameSynced++;
                    }
                }
            }
            if (_coaNameSynced > 0) {
                console.log(`[COA] Synced ${_coaNameSynced} COA entry names to match account names`);
                save();
            }

            if (window.RuleEngine?.updateTransactionContext) {
                window.RuleEngine.updateTransactionContext(Object.values(state.transactions));
            }
            console.log(`[LEDGER] Loaded ${Object.keys(state.transactions).length} txns from key: ${key}`);
        } catch (e) {
            console.error('[LEDGER] Failed to load from key:', key, e);
            if (_SS) _SS.remove(key); else localStorage.removeItem(key);
            // Re-seed COA defaults even after a failed load
            COA.init();
        }
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
        if (!str) return '';
        // Words to keep lowercase unless first word
        const LOWER_WORDS = new Set(['a','an','the','and','but','or','for','nor','on','at','to','by','in','of','up','as']);
        // Tokens to keep exact case (brands, abbreviations)
        const PRESERVE = { 'A&W': 'A&W', 'TD': 'TD', 'RBC': 'RBC', 'BMO': 'BMO', 'CIBC': 'CIBC', 'HSBC': 'HSBC' };
        return str.toLowerCase()
            .replace(/[^\s]+/g, (word, offset) => {
                const up = word.toUpperCase();
                if (PRESERVE[up]) return PRESERVE[up];           // preserve known brands
                if (offset > 0 && LOWER_WORDS.has(word)) return word; // keep articles lowercase mid-string
                return word.charAt(0).toUpperCase() + word.slice(1);
            });
    }

    // ─── Smart Description Splitter ───────────────────────────────────────────
    // Splits a raw bank description into:
    //   payee               → Line 1: clean merchant/person name (title case)
    //   transaction_type_label → Line 2: transaction context (lowercase, descriptive)
    //
    // Design rules (from actual statement data):
    //  • Strip known suffix tokens (Purchase, Refund, Payment, etc.) → type label
    //  • Strip noise (store numbers, branch codes, city/province, masked card #s)
    //  • E-transfers: name is the person/business, type = "e-transfer · received/sent"
    //  • CC payments: "Payment - Thank You" → payee = "Payment", type = "credit card payment"
    //  • Keep the merchant name recognizable — "Costco Wholesale" not "COSTCO 00412 AB"
    //  • Type label always lowercase, uses · as visual separator
    //
    function parseTransactionDescription(rawDesc) {
        if (!rawDesc) return { payee: null, transaction_type_label: null };

        // If already contains \n (parser pre-split, e.g. RBCMastercardParser), honour it
        if (rawDesc.includes('\n')) {
            const parts = rawDesc.split('\n');
            const name = toTitleCase(parts[0].trim());
            const type = parts.slice(1).join(' ').trim().toLowerCase() || null;
            return { payee: name, transaction_type_label: type };
        }

        // Strip phone/online order prefix "IN *" up front (e.g. "IN *18751508 LTD 403-6880197")
        const raw  = rawDesc.trim().replace(/^IN\s*\*\s*/i, '');
        const upper = raw.toUpperCase();

        // ── 1. Credit card payments ────────────────────────────────────────────
        if (/PAYMENT\s*[-–]?\s*THANK\s*YOU|THANK\s*YOU.*PAYMENT|PAIEMENT.*MERCI|MERCI.*PAIEMENT/i.test(raw)) {
            return { payee: 'Payment', transaction_type_label: 'credit card payment' };
        }
        if (/^PAYMENT\s*[-–]\s*THANK\s*YOU/i.test(raw)) {
            return { payee: 'Payment', transaction_type_label: 'credit card payment' };
        }

        // ── 2. Cash back / rewards ─────────────────────────────────────────────
        if (/CASH\s*BACK\s*REWARD|MY\s*REWARDS\s*CASH\s*REDEMPTION|CASHBACK/i.test(raw)) {
            return { payee: 'Cash Back', transaction_type_label: 'rewards · bank credit' };
        }

        // ── 3. Interest charges / fees ─────────────────────────────────────────
        if (/PURCHASE\s*INTEREST|RETAIL\s*INTEREST|INTEREST\s*CHARGE|INTEREST\s*PURCHASES|INTEREST\s*CHARGES/i.test(raw)) {
            return { payee: 'Interest Charge', transaction_type_label: 'bank fee · interest' };
        }
        if (/ANNUAL\s*FEE|ADDITIONAL\s*CARD\s*FEE|CASH\s*ADVANCE\s*FEE/i.test(raw)) {
            const feeType = /ANNUAL/i.test(raw) ? 'annual fee' : /ADDITIONAL/i.test(raw) ? 'additional card fee' : 'cash advance fee';
            return { payee: 'Card Fee', transaction_type_label: `bank fee · ${feeType}` };
        }
        if (/MONTHLY\s*FEE|REGULAR\s*TRANSACTION\s*FEE|SERVICE\s*CHARGE|BANKING\s*FEE|ACTIVITY\s*FEE/i.test(raw)) {
            return { payee: 'Bank Fee', transaction_type_label: 'bank fee · account charge' };
        }

        // ── 4. E-Transfers ─────────────────────────────────────────────────────
        if (/INTERAC|E-TRANSFER|E-TRF|E\s*TRANSFER/i.test(raw)) {
            const isSent     = /\bSENT\b/i.test(raw);
            const isReceived = /\bRECEIVED\b|AUTODEPOSIT/i.test(raw);
            const direction  = isSent ? 'sent' : isReceived ? 'received' : 'transfer';

            // Extract the person/business name — strip all banking noise
            let name = raw
                .replace(/INTERAC\s*(E-TRANSFER|E-TRF)?/gi, '')
                .replace(/E-TRANSFER/gi, '')
                .replace(/E-TRF/gi, '')
                .replace(/E\s+TRANSFER/gi, '')
                .replace(/AUTODEPOSIT/gi, '')
                .replace(/\bSENT\s+TO\b|\bRECEIVED\s+FROM\b|\bSENT\b|\bRECEIVED\b/gi, '')
                .replace(/[-–]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            // Sub-type from known patterns
            let subtype = '';
            if (/PAYROLL|SALARY|WAGES/i.test(raw))        subtype = ' · payroll';
            else if (/DIVIDEND/i.test(raw))               subtype = ' · dividend';
            else if (/RENT|LEASE/i.test(raw))             subtype = ' · rent';
            else if (/SUBCONTRACT|CONTRACTOR/i.test(raw)) subtype = ' · contractor';
            else if (/REFUND/i.test(raw))                 subtype = ' · refund';

            return {
                payee: toTitleCase(name) || 'E-Transfer',
                transaction_type_label: `e-transfer · ${direction}${subtype}`
            };
        }

        // ── 5. Direct deposit / Payroll ────────────────────────────────────────
        if (/DIRECT\s*DEP(?:OSIT)?|DD\s+|PAYROLL|PAY\s+STUB/i.test(raw)) {
            let name = raw
                .replace(/DIRECT\s*DEP(?:OSIT)?/gi, '')
                .replace(/PAYROLL/gi, '')
                .replace(/\s+/g, ' ').trim();
            return {
                payee: toTitleCase(name) || 'Direct Deposit',
                transaction_type_label: 'direct deposit · payroll'
            };
        }

        // ── 6. Mobile cheque deposit ───────────────────────────────────────────
        if (/MOBILE\s*CHEQUE\s*DEPOSIT|MOBILE\s*CHECK/i.test(raw)) {
            let name = raw.replace(/MOBILE\s*CHEQUE?\s*DEPOSIT/gi, '').replace(/[-–]/g, '').trim();
            return {
                payee: toTitleCase(name) || 'Cheque Deposit',
                transaction_type_label: 'cheque · mobile deposit'
            };
        }

        // ── 7. Bank transfers (online banking, inter-account) ──────────────────
        if (/ONLINE\s*(BANKING\s*)?TRANSFER|ONLINE\s*TRANSFER\s*TO|TRSF\s*(FROM|TO)/i.test(raw)) {
            const dir = /TO\b/i.test(raw) ? 'sent' : /FROM\b/i.test(raw) ? 'received' : 'transfer';
            let name = raw
                .replace(/ONLINE\s*(BANKING\s*)?TRANSFER\s*[-–]?/gi, '')
                .replace(/TRSF\s*(FROM|TO)\s*/gi, '')
                .replace(/DEPOSIT\s*ACCOUNT\s*/gi, '')
                .replace(/[-–]/g, ' ')
                .replace(/\d{4,}/g, '') // strip account numbers
                .replace(/\s+/g, ' ').trim();
            return {
                payee: toTitleCase(name) || 'Bank Transfer',
                transaction_type_label: `bank transfer · ${dir}`
            };
        }

        // ── 8. Loan / mortgage payments ────────────────────────────────────────
        if (/LOAN\s*PAYMENT|LOAN\s*CREDIT|MORTGAGE\s*PAYMENT/i.test(raw)) {
            return { payee: 'Loan Payment', transaction_type_label: 'loan · payment' };
        }
        if (/LOAN\s*INTEREST/i.test(raw)) {
            return { payee: 'Loan Interest', transaction_type_label: 'loan · interest charge' };
        }

        // ── 9. Preauthorized / PAD ─────────────────────────────────────────────
        if (/PREAUTHORIZED|PRE-AUTH(?:ORIZED)?|PAD\s+/i.test(raw)) {
            let name = raw
                .replace(/PREAUTHORIZED\s*(DEBIT|PAYMENT|CREDIT)?/gi, '')
                .replace(/PRE-AUTH(?:ORIZED)?\s*/gi, '')
                .replace(/PAD\s+/gi, '')
                .replace(/\s+/g, ' ').trim();
            return {
                payee: toTitleCase(name) || 'Pre-Auth',
                transaction_type_label: 'pre-authorized · automatic'
            };
        }

        // ── 10. CC suffix stripping — core purchase/refund logic ───────────────
        // Trailing tokens: Purchase, Refund, Credit, Debit, Cash Advance, etc.
        // These become the type label; what remains is the merchant name.
        const SUFFIX_MAP = [
            { re: /\bPURCHASE\b/gi,       label: 'purchase' },
            { re: /\bREFUND\b/gi,          label: 'refund' },
            { re: /\bCREDIT\b/gi,          label: 'credit' },
            { re: /\bCASH\s*ADVANCE\b/gi,  label: 'cash advance' },
            { re: /\bWITHDRAWAL\b/gi,      label: 'withdrawal' },
            { re: /\bDEPOSIT\b/gi,         label: 'deposit' },
            { re: /\bPAYMENT\b/gi,         label: 'payment' },
        ];

        let merchant = raw;
        let typeLabel = null;

        for (const { re, label } of SUFFIX_MAP) {
            if (re.test(merchant)) {
                merchant = merchant.replace(re, '').trim();
                typeLabel = label;
                break; // only peel one suffix token
            }
        }

        // ── 11. Strip common noise from merchant name ──────────────────────────
        merchant = merchant
            // Strip store numbers / branch codes: "#1234", "00469", "5726"
            .replace(/#\d+/g, '')
            .replace(/\b0{2,}\d+\b/g, '')       // leading-zero codes like 00469
            .replace(/\b\d{4,}\b/g, '')         // 4+ digit codes
            // Strip masked card numbers
            .replace(/\d{4}\s?\d{2}\*+\s?\*+\s?\d{4}/g, '')
            // Strip province + city noise: "CANMORE AB", "NICOSIA CYP"
            .replace(/\b(?:AB|BC|MB|NB|NL|NS|ON|PE|QC|SK|NT|NU|YT)\b/gi, '')
            // Strip known noise tokens
            .replace(/\bLTD\b|\bINC\b|\bCORP\b|\bCO\b\./gi, '')
            // Strip trailing junk punctuation and spaces
            .replace(/[-–*•|]+$/, '')
            .replace(/\s+/g, ' ')
            .trim();

        // ── 12. Recognisable brand shortcuts (from your data) ─────────────────
        // If after stripping the merchant matches a known brand, normalise it
        const BRAND_MAP = {
            'COSTCO WHOLESALE': 'Costco Wholesale',
            'COSTCO':           'Costco Wholesale',
            'WWW COSTCO':       'Costco Online',
            'WAL-MART':         'Walmart',
            'WAL MART':         'Walmart',
            'CDN TIRE STORE':   'Canadian Tire',
            'CDN TIRE':         'Canadian Tire',
            'CHARLESGLEN TOYOTA': 'Charlesglen Toyota',
            'SKIPTHEDISHES':    'SkipTheDishes',
            'SKIP THE DISHES':  'SkipTheDishes',
            'DAIRY QUEEN':      'Dairy Queen',
            'TIM HORTONS':      'Tim Hortons',
            'FIVERREU':         'Fiverr',
            'AMZN MKTP CA':     'Amazon.ca',
            'AMZN MKTP':        'Amazon',
            'AMAZON.CA':        'Amazon.ca',
            'PETRO-CANADA':     'Petro-Canada',
            'A&W':              'A&W',
            'CANMORE PIZZAHUT': 'Pizza Hut Canmore',
            'IN *':             '',   // strip IN * prefix (phone order prefixes)
        };

        const merchantUpper = merchant.toUpperCase().trim();
        for (const [key, val] of Object.entries(BRAND_MAP)) {
            if (merchantUpper === key || merchantUpper.startsWith(key)) {
                merchant = val || merchantUpper;
                break;
            }
        }

        // Final title-case if not already a known brand string
        const finalPayee = merchant ? toTitleCase(merchant) : toTitleCase(raw);

        return {
            payee: finalPayee,
            transaction_type_label: typeLabel
        };
    }

    // --- AUTO-CATEGORIZATION ENGINE ---
    // NOTE: These are first-pass rules that fire at import time.
    // The SignalFusionEngine (via _runAutoCatOnExisting) handles more complex matching.
    // COA codes must match the client's actual chart of accounts.
    // Only rules with HIGH confidence (>= 0.85) should set status 'auto_categorized'.
    // Rules below 0.60 are excluded — SignalFusion handles those better.
    // Helper: detect if a transaction is from a credit card / liability account
    // Used by AUTO_CATEGORIZE_RULES test functions to guard revenue rules.
    function _isLiabilityTx(tx) {
        // Detects if a transaction came from a credit-normal (liability) source account.
        // Credit cards are liability accounts (Sign = Credit in COA).
        // Chequing/Savings are asset accounts (Sign = Debit in COA).
        const acct = state.accounts.find(a => a.id === tx.account_id);
        if (!acct) return !!(tx.metadata?.brand || tx.metadata?.cardNetwork);
        // Primary: accountType set by every CC parser
        if ((acct.accountType || '').toLowerCase() === 'creditcard') return true;
        // Secondary: cardNetwork / brand set by CC parsers
        if (acct.cardNetwork || acct.brand) return true;
        return false;
    }

    const AUTO_CATEGORIZE_RULES = [
        // ── REVENUE ─────────────────────────────────────────────────────────────
        // IMPORTANT: Revenue rules must ONLY fire on CHQ/SAV accounts.
        // On CC accounts: CREDIT = payment (reduces balance owed), not income.
        // On CHQ/SAV: CREDIT = deposit/income (money received).
        {
            pattern: /airbnb|vrbo|booking\.com/i,
            test: (tx) => tx.polarity === 'CREDIT' && !_isLiabilityTx(tx),
            category: '4900', // Rental Revenue — CHQ/SAV only
            confidence: 0.90,
            status: 'auto_categorized'
        },
        {
            pattern: /e-transfer.*autodeposit|autodeposit.*e-transfer/i,
            test: (tx) => tx.polarity === 'CREDIT' && !_isLiabilityTx(tx),
            category: '4900', // Rental Revenue (Airbnb autodeposit) — CHQ/SAV only
            confidence: 0.85,
            status: 'auto_categorized'
        },
        {
            pattern: /e-transfer|interac.*e-trf|e-trf.*interac/i,
            test: (tx) => tx.polarity === 'CREDIT' && !_isLiabilityTx(tx),
            category: '4900', // Rental Revenue (e-transfer income) — CHQ/SAV only
            confidence: 0.70,
            status: 'needs_review'
        },

        // ── BALANCE SHEET / CLEARING ─────────────────────────────────────────
        // CC payment: DEBIT polarity on a CC account = payment received (reduces liability)
        // CHQ payment to CC: DEBIT polarity on CHQ = outflow → already routed to 9971 by description match
        {
            pattern: /payment\s*-?\s*thank\s*you|paiement\s*-?\s*merci|payment received|autopay/i,
            test: (tx) => tx.polarity === 'DEBIT' && _isLiabilityTx(tx),
            category: '9971', // CC Payment clearing — CC account only
            confidence: 0.92,
            status: 'auto_categorized'
        },
        {
            pattern: /gst\s*remit|hst\s*remit|receiver\s*gen|canada revenue|cra\s*payment/i,
            category: '2149', // GST payments to Revenue Canada
            confidence: 0.90,
            status: 'auto_categorized'
        },

        // ── FUEL (7400) ──────────────────────────────────────────────────────
        {
            // CHQ data: HUSKY DEADMANS FLATS, CALG CO-OP GAS BAR, COSTCO GAS all appear
            pattern: /petro-?can(ada)?|petrocan|fas\s*gas|shell|esso|husky|co-?op\s*gas|calg\s*co-?op|cardlock|costco\s*gas|ultramar|chevron|flying\s*j|gas\s*bar/i,
            test: (tx) => tx.polarity === 'DEBIT',
            category: '7400', // Fuel & Oil
            confidence: 0.88,
            status: 'auto_categorized'
        },

        // ── BANK CHARGES (7700) ─────────────────────────────────────────────
        {
            // CHQ data: "Account Fees, RBC Service Charge" was routing to 8800 — fix to 7700
            pattern: /bank\s*(fee|charge)|service\s*charge|account\s*fee|monthly\s*(fee|account\s*fee)|nsf\s*fee|overdraft\s*fee|wire\s*fee|atm\s*fee|interac\s*fee|purchase\s*interest|interest\s*charge|rbc\s*service/i,
            test: (tx) => tx.polarity === 'DEBIT',
            category: '7700', // Bank Charges & Interest
            confidence: 0.88,
            status: 'auto_categorized'
        },

        // ── TELECOM (9100) ───────────────────────────────────────────────────
        {
            // CHQ data: OPENPHONE SAN FRANCISCO was inconsistently hitting 9970
            pattern: /\btelus\b|\bshaw\b|\brogers\b|\bbell\b|\bfido\b|\bkoodo\b|\bfreedom\s*mobile\b|\bstarlink\b|\bxplornet\b|\bopenphone\b/i,
            test: (tx) => tx.polarity === 'DEBIT',
            category: '9100', // Telephone & Internet
            confidence: 0.88,
            status: 'auto_categorized'
        },

        // ── INSURANCE (7600) ─────────────────────────────────────────────────
        {
            // CHQ data: AMA INS CTR#85 (Alberta Motor Association), RBCINS-LIFE routing to 9970
            pattern: /\bwawanesa\b|\bintact\b|\baviva\b|\ballstate\b|\bdesjardins\s*ins|\bsecurity\s*national\s*insur|\bama\s*ins\b|\brbcins\b|\binsurance\s*rbc|\bsun\s*life\s*ins/i,
            test: (tx) => tx.polarity === 'DEBIT',
            category: '7600', // Insurance
            confidence: 0.88,
            status: 'auto_categorized'
        },

        // ── SUBCONTRACTING (8950) ────────────────────────────────────────────
        {
            // CHQ data: TRUE NORTH DISTRIBUTORS SARNIA (15 txns $340–$7k, all in 9970)
            // Large recurring supplier payments — subcontractor / supply vendor
            pattern: /true\s*north\s*distributors|fiverr|fiverrEU/i,
            test: (tx) => tx.polarity === 'DEBIT',
            category: '8950', // Subcontracting
            confidence: 0.80,
            status: 'needs_review'
        },

        // ── PROFESSIONAL FEES (8700) ─────────────────────────────────────────
        {
            pattern: /accounting|bookkeeping|quickbooks|freshbooks|allison\s*associates|cpa\s*firm/i,
            test: (tx) => tx.polarity === 'DEBIT',
            category: '8700', // Professional Fees
            confidence: 0.80,
            status: 'needs_review'
        },

        // ── SOFTWARE & SUBSCRIPTIONS (6800) ─────────────────────────────────
        {
            // CHQ data: RANKBREEZE, NETFLIX, APPLE.COM/BILL were in 9970
            pattern: /pricelabs|igms|rankbreeze|minut|monday\.com|adobe|github|dropbox|zoom|notion|slack|hostaway|guesty|loom|wordpress|netflix|apple\.com\/bill|disney\+|spotify/i,
            test: (tx) => tx.polarity === 'DEBIT',
            category: '6800', // Dues, memberships and subscriptions
            confidence: 0.80,
            status: 'needs_review'
        },

        // ── REPAIRS & MAINTENANCE (7300) ─────────────────────────────────────
        {
            // Home Depot, Rona, Home Hardware = building supplies → 7300
            // CDN TIRE non-abbreviated form → 7300 (abbreviated form handled below → 8450)
            pattern: /home\s*depot|rona|home\s*hardware|canadian\s*tire(?!\s*store)/i,
            test: (tx) => tx.polarity === 'DEBIT',
            category: '7300', // Repairs & Maintenance - property
            confidence: 0.72,
            status: 'needs_review'
        },
        {
            // "CDN TIRE STORE" = abbreviated Canadian Tire on bank/CC statements
            // All variants: "CDN TIRE STORE 00469", "CDN TIRE STORE #00469 CANMORE", "CDN TIRE STORE CANMORE"
            // Training data: CDN TIRE STORE → 8450 (911x primary)
            pattern: /cdn\s*tire\s*store/i,
            test: (tx) => tx.polarity === 'DEBIT',
            category: '8450', // Materials and supplies
            confidence: 0.72,
            status: 'needs_review'
        },

        // ── MATERIALS & SUPPLIES (8450) ───────────────────────────────────────
        {
            // Costco: all variants — "COSTCO WHOLESALE", "WWW COSTCO CA", "Costco Wholesale Refund"
            // CHQ data: 107 txns split across 8450/8500/9970 due to variant descriptions
            pattern: /costco|www\s*costco/i,
            test: (tx) => tx.polarity === 'DEBIT',
            category: '8450', // Materials and supplies
            confidence: 0.65,
            status: 'needs_review'
        },
        {
            // Amazon: all variants — AMZN MKTP CA, AMAZON.CA, AMZ*, WWW.AMAZON.CA, BUSINESS PRIME
            // CHQ data: 530 txns, split 394→8500 / 136→9970 due to prefix variants not matching
            pattern: /\bamzn\b|amazon\.ca|amz\*|www\.amazon|business\s*prime\s*amazon/i,
            test: (tx) => tx.polarity === 'DEBIT',
            category: '8450', // Materials and supplies (flagged — could be anything)
            confidence: 0.65,
            status: 'needs_review'
        },
        {
            pattern: /\bwal-?mart\b/i,
            test: (tx) => tx.polarity === 'DEBIT',
            category: '8450', // Materials and supplies
            confidence: 0.65,
            status: 'needs_review'
        },

        // ── MEALS & ENTERTAINMENT (6415) ─────────────────────────────────────
        {
            // CHQ data: SAFEWAY #8919 CANMORE (near STR property = grocery for guests)
            // ACE LIQUOR CANMORE (liquor for STR property)
            // Grocery/liquor near rental property = guest supplies → 6415
            pattern: /starbucks|tim\s*horton|mcdonald|restaurant|cafe|coffee|bistro|pizza|sushi|safeway|ace\s*liquor|grocery|liquor\s*store|skip\s*the\s*dishes|skipthedishes|doordash|uber\s*eats/i,
            test: (tx) => tx.polarity === 'DEBIT',
            category: '6415', // Client meals and entertainment
            confidence: 0.70,
            status: 'needs_review'
        },

        // ── OFFICE SUPPLIES (8600) ────────────────────────────────────────────
        {
            pattern: /staples|office\s*depot|uline/i,
            test: (tx) => tx.polarity === 'DEBIT',
            category: '8600', // Office Supplies
            confidence: 0.75,
            status: 'needs_review'
        },

        // ── TRAVEL (9200) ─────────────────────────────────────────────────────
        {
            pattern: /westjet|air\s*canada|air\s*transat|swoop|hotel|marriott|hilton|\buber\b|\blyft\b/i,
            test: (tx) => tx.polarity === 'DEBIT',
            category: '9200', // Travel & Accommodations
            confidence: 0.72,
            status: 'needs_review'
        },
    ];

    function autoCategorizTransaction(tx) {
        const desc = (tx.raw_description || tx.description || '').toUpperCase();

        for (const rule of AUTO_CATEGORIZE_RULES) {
            const matches = rule.pattern.test(desc);
            const testPasses = !rule.test || rule.test(tx);

            if (matches && testPasses) {
                const coaEntry = state.coa[rule.category];
                if (!coaEntry) {
                    // Rule references a COA code that doesn't exist — skip to prevent silent corruption
                    console.warn(`[LEDGER AUTO-CAT] Rule category '${rule.category}' not in COA — skipping rule for "${desc.slice(0, 45)}"`);
                    continue;
                }
                const result = {
                    gl_account_code: rule.category,
                    gl_account_name: coaEntry.name,
                    confidence: rule.confidence,
                    status: rule.status
                };
                console.log(`[LEDGER AUTO-CAT] "${desc.slice(0, 45)}" → ${result.gl_account_code} "${result.gl_account_name}" (conf: ${result.confidence})`);
                return result;
            }
        }

        console.log(`[LEDGER AUTO-CAT] "${desc.slice(0, 45)}" → no rule match (needs_review)`);
        return { status: 'needs_review', confidence: 0 };
    }


    // --- CLIENT SCOPE GUARD (defense-in-depth) ---
    function _clientScope(tx) {
        const active = window.UI_STATE?.activeClientId;
        if (!active) return true;        // legacy/demo mode — no filtering
        if (!tx.client_id) return true;  // pre-migration tx — allow through
        return tx.client_id === active;
    }

    // --- PERIOD LOCKING HELPER ---
    function _isInLockedPeriod(tx) {
        if (!tx?.date || !state.lockedPeriods?.length) return false;
        const period = tx.date.substring(0, 7); // "2024-01"
        return state.lockedPeriods.some(lp => lp.period === period);
    }

    // --- LEDGER SERVICE ---
    const Ledger = {
        post: function (tx) {
            // Defense: reject cross-client posts
            const activeClient = window.UI_STATE?.activeClientId;
            if (activeClient && tx.client_id && tx.client_id !== activeClient) {
                console.error(`[LEDGER] CROSS-CLIENT VIOLATION: tx.client_id=${tx.client_id} active=${activeClient}`);
                return false;
            }
            // Auto-stamp if missing
            if (!tx.client_id && activeClient) tx.client_id = activeClient;

            // Period locking enforcement
            if (_isInLockedPeriod(tx)) {
                console.error(`[LEDGER] PERIOD LOCKED: Cannot post to ${tx.date?.substring(0, 7)}`);
                return false;
            }

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
            const raw = Object.values(state.transactions).filter(tx => _clientScope(tx)).sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));

            // Map of starting balances per account
            const startingBalances = {};
            state.accounts.forEach(acc => {
                startingBalances[acc.id] = (acc.openingBalance || 0) * 100; // to cents
            });

            // If in "ALL" mode, we track balances per account while mapping
            const runBalances = { ...startingBalances };

            return raw.map((tx) => {
                // Use the actual account_id — never fall back to a fake placeholder.
                // Transactions without an account_id are orphans and will simply
                // get a standalone running balance bucket keyed by '' (harmless).
                const accId = tx.account_id || '';

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
            const tx = state.transactions[tx_id];
            if (tx && !_clientScope(tx)) return undefined;
            return tx;
        },

        getByParserRef: function (parser_ref) {
            return Object.values(state.transactions).find(tx => tx.parser_ref === parser_ref && _clientScope(tx));
        },

        // REPORTS: Query transactions by date range
        getTransactionsByDateRange: function (startDate, endDate, accountIds = null) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            return Object.values(state.transactions).filter(tx => {
                if (!_clientScope(tx)) return false;
                const txDate = new Date(tx.date);
                const inRange = txDate >= start && txDate <= end;
                const matchAccount = !accountIds || (Array.isArray(accountIds) ? accountIds.includes(tx.account_id) : tx.account_id === accountIds);
                return inRange && matchAccount;
            });
        },

        // REPORTS: Get all transactions (alias for compatibility)
        getAllTransactions: function () {
            return this.getAll();
        },

        // REPORTS: Get account by ID
        getAccount: function (accountId) {
            return state.accounts.find(acc => acc.id === accountId);
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
                // Period locking enforcement
                if (_isInLockedPeriod(state.transactions[tx_id])) {
                    console.error(`[LEDGER] PERIOD LOCKED: Cannot delete tx in ${state.transactions[tx_id].date?.substring(0, 7)}`);
                    return false;
                }
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

            // Period locking enforcement
            if (_isInLockedPeriod(tx)) {
                console.error(`[LEDGER] PERIOD LOCKED: Cannot update metadata for tx in ${tx.date?.substring(0, 7)}`);
                throw new Error("PERIOD_LOCKED");
            }

            const forbidden = ["amount_cents", "date", "account_id", "currency", "client_id"];
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

        updateCategory: function (tx_id, category_code, metadata = {}) {
            const tx = state.transactions[tx_id];
            if (tx) {
                // Period locking enforcement
                if (_isInLockedPeriod(tx)) {
                    console.error(`[LEDGER] PERIOD LOCKED: Cannot update category for tx in ${tx.date?.substring(0, 7)}`);
                    return false;
                }
                // Check if this is a correction (category changed)
                const isCorrection = tx.category && tx.category !== category_code;
                const previousCategory = tx.category;

                // Update category
                tx.category = category_code;
                tx.category_code = category_code; // Fallback field
                const account = COA.get(category_code);
                if (account) {
                    tx.category_name = account.name;
                }

                // Store signal-fusion metadata
                if (metadata.confidence !== undefined) tx.confidence = metadata.confidence;
                if (metadata.needsReview !== undefined) tx.needsReview = metadata.needsReview;
                if (metadata.explanation) tx.explanation = metadata.explanation;

                // If this is a user-driven pick (no metadata override), mark as confirmed:
                // - status → 'user_categorized' (exits Needs Review)
                // - confidence → 1.0 (100% — the user decided)
                // - category_source → 'user' (protects from recategorizeAll overwrite)
                if (metadata.confidence === undefined) {
                    tx.status = 'user_categorized';
                    tx.confidence = 1.0;
                    tx.category_confidence = 1.0;
                    tx.category_source = 'user';
                }

                save();

                // CONTINUOUS LEARNING: Capture user correction
                if (window.RoboLedger?.RuleEngine?.userCorrections) {
                    // Always capture - even if first categorization, it's a learning opportunity
                    window.RoboLedger.RuleEngine.userCorrections.addCorrection(
                        tx.description,
                        category_code
                    );

                    if (isCorrection) {
                        console.log(`[LEARNING] 🎓 Correction: ${tx.description} (${previousCategory} → ${category_code})`);
                    } else {
                        console.log(`[LEARNING] 📝 Trained: ${tx.description} → ${category_code}`);
                    }
                }

                console.log(`[LEDGER] Updated category for ${tx_id}: ${category_code}`);
                return true;
            }
            return false;
        },

        updateTransaction: function (tx_id, updates) {
            const tx = state.transactions[tx_id];
            if (tx) {
                // Period locking enforcement
                if (_isInLockedPeriod(tx)) {
                    console.error(`[LEDGER] PERIOD LOCKED: Cannot update tx in ${tx.date?.substring(0, 7)}`);
                    return false;
                }
                Object.assign(tx, updates);
                save();
                console.log(`[LEDGER] Updated transaction ${tx_id}:`, updates);
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
            // Never create transactions under a placeholder account
            if (!account_id || account_id === 'ACC-001') {
                const firstActive = Accounts.getActive()?.[0];
                account_id = firstActive?.id || (state.accounts[0]?.id) || account_id;
            }
            const tx_id = crypto.randomUUID();
            const tx = {
                tx_id,
                client_id: window.UI_STATE?.activeClientId || null,
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
        deleteTransaction: function (tx_id) {
            const tx = state.transactions[tx_id];
            if (!tx) return false;

            // Period locking enforcement
            if (_isInLockedPeriod(tx)) {
                console.error(`[LEDGER] PERIOD LOCKED: Cannot delete tx in ${tx.date?.substring(0, 7)}`);
                return false;
            }

            // Remove from sig index
            if (tx.txsig && state.sigIndex[tx.txsig]) {
                delete state.sigIndex[tx.txsig];
            }
            // Remove transaction
            delete state.transactions[tx_id];
            save();
            console.log(`[LEDGER] Deleted transaction ${tx_id}`);
            return true;
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
        },
        loadFromKey: function (key) {
            loadFromKey(key);
        },

        // --- PERIOD LOCKING API ---
        lockPeriod: function (period, lockedBy = 'admin') {
            if (!state.lockedPeriods) state.lockedPeriods = [];
            if (state.lockedPeriods.some(lp => lp.period === period)) {
                console.warn(`[LEDGER] Period ${period} already locked`);
                return false;
            }
            state.lockedPeriods.push({ period, lockedAt: new Date().toISOString(), lockedBy });
            save();
            console.log(`[LEDGER] 🔒 Period ${period} locked by ${lockedBy}`);
            return true;
        },
        unlockPeriod: function (period) {
            if (!state.lockedPeriods) return false;
            const idx = state.lockedPeriods.findIndex(lp => lp.period === period);
            if (idx === -1) return false;
            state.lockedPeriods.splice(idx, 1);
            save();
            console.log(`[LEDGER] 🔓 Period ${period} unlocked`);
            return true;
        },
        getLockedPeriods: function () {
            return state.lockedPeriods || [];
        },
        isPeriodLocked: function (period) {
            return (state.lockedPeriods || []).some(lp => lp.period === period);
        },

        // --- ADJUSTING JOURNAL ENTRIES API ---
        createJournalEntry: function (description, lines, date = null, type = 'AJE') {
            const entryId = 'JE-' + crypto.randomUUID().substring(0, 8);
            const entryDate = date || new Date().toISOString().split('T')[0];
            const activeClient = window.UI_STATE?.activeClientId || null;

            // Validate: debits must equal credits
            let totalDebit = 0, totalCredit = 0;
            lines.forEach(line => {
                totalDebit  += (line.debit  || 0);
                totalCredit += (line.credit || 0);
            });
            if (Math.abs(totalDebit - totalCredit) > 0.01) {
                console.error(`[LEDGER] AJE rejected: debits (${totalDebit}) ≠ credits (${totalCredit})`);
                return null;
            }

            // Period locking check
            if (_isInLockedPeriod({ date: entryDate })) {
                console.error(`[LEDGER] PERIOD LOCKED: Cannot create AJE in ${entryDate.substring(0, 7)}`);
                return null;
            }

            const txIds = [];
            lines.forEach((line, i) => {
                const tx_id = crypto.randomUUID();
                const amount = line.debit > 0 ? line.debit : line.credit;

                // Use the first real account with transactions, never a placeholder ID.
                const fallbackAccId = Accounts.getActive()?.[0]?.id || (state.accounts[0]?.id) || 'JOURNAL';
                const tx = {
                    tx_id,
                    client_id: activeClient,
                    account_id: line.account_id && line.account_id !== 'ACC-001' ? line.account_id : fallbackAccId,
                    ref: `${type}-${entryId}`,
                    date: entryDate,
                    raw_description: description,
                    description: description,
                    payee: description,
                    amount_cents: Math.round(amount * 100),
                    balance_cents: 0,
                    currency: 'CAD',
                    polarity: line.debit > 0 ? Polarity.DEBIT : Polarity.CREDIT,
                    status: TransactionStatus.CONFIRMED,
                    category: line.account_code || '9970',
                    category_name: line.account_name || 'Uncategorized',
                    category_source: 'journal_entry',
                    confidence: 1.0,
                    journal_entry_id: entryId,
                    journal_line: i + 1,
                    txsig: `je-${entryId}-${i}`,
                    created_at: new Date().toISOString()
                };
                state.transactions[tx_id] = tx;
                state.sigIndex[tx.txsig] = tx_id;
                txIds.push(tx_id);
            });

            if (!state.journalEntries) state.journalEntries = {};
            state.journalEntries[entryId] = {
                id: entryId,
                description,
                date: entryDate,
                type, // AJE, RJE, CJE
                lines: txIds,
                totalDebit,
                totalCredit,
                createdAt: new Date().toISOString(),
                createdBy: 'user'
            };

            save();
            console.log(`[LEDGER] 📝 Journal entry ${entryId} posted: ${lines.length} lines, $${totalDebit.toFixed(2)}`);
            return state.journalEntries[entryId];
        },
        getJournalEntries: function () {
            return Object.values(state.journalEntries || {});
        },
        deleteJournalEntry: function (entryId) {
            const entry = state.journalEntries?.[entryId];
            if (!entry) return false;
            // Delete all transaction lines
            entry.lines.forEach(txId => {
                const tx = state.transactions[txId];
                if (tx) {
                    if (_isInLockedPeriod(tx)) {
                        console.error(`[LEDGER] Cannot delete JE — period locked`);
                        return false;
                    }
                    delete state.sigIndex[tx.txsig];
                    delete state.transactions[txId];
                }
            });
            delete state.journalEntries[entryId];
            save();
            console.log(`[LEDGER] 🗑 Journal entry ${entryId} deleted`);
            return true;
        }
    };

    // --- ACCOUNT SERVICE ---
    const Accounts = {
        getAll: function () {
            return state.accounts;
        },
        /**
         * getActive — accounts that have ≥1 transaction AND are not GENERIC
         * PARSER ghosts. Use this everywhere the UI renders an account list.
         * "Ghost" accounts are created by updateMetadata() during a failed
         * or duplicate import — they have an id/name but zero transactions.
         */
        getActive: function () {
            const txnCounts = {};
            Object.values(state.transactions || {}).forEach(tx => {
                if (tx.account_id) txnCounts[tx.account_id] = (txnCounts[tx.account_id] || 0) + 1;
            });
            return state.accounts.filter(acc => {
                // Must have at least 1 transaction
                if (!txnCounts[acc.id]) return false;
                // Rename any account with a bad/generic name — don't hide them
                const needsRename = acc.name && (
                    acc.name.includes('GENERIC PARSER') ||
                    acc.name === 'Unknown Bank' ||
                    acc.name.startsWith('BANK - ') ||          // "BANK - RBC #8468" legacy malformed name
                    /^Unknown Bank\s*[-–]/i.test(acc.name)     // "Unknown Bank - Chequing"
                );
                if (needsRename) {
                    const newName = this._buildCleanAccountName(acc);
                    console.log(`[ACCOUNTS] Renamed malformed account ${acc.id}: "${acc.name}" → "${newName}"`);
                    acc.name = newName;
                    // Also sync COA entry name if linked
                    if (acc.coaCode && state.coa[acc.coaCode]) {
                        state.coa[acc.coaCode].name = newName;
                    }
                    save();
                }
                // Must have a real, non-empty name (not placeholder junk)
                if (!acc.name || acc.name.trim() === '' || acc.name === 'New Account') return false;
                // Must not have a placeholder account number suffix (#0000, #XXXX, #----)
                const suffixMatch = acc.name.match(/#([A-Z0-9\-]+)$/i);
                if (suffixMatch && /^[X\-0]+$/i.test(suffixMatch[1])) return false;
                return true;
            });
        },
        /**
         * pruneGhosts — remove account records with zero transactions.
         * Called automatically after every import. Safe to call from console.
         */
        pruneGhosts: function () {
            const txnCounts = {};
            Object.values(state.transactions || {}).forEach(tx => {
                if (tx.account_id) txnCounts[tx.account_id] = (txnCounts[tx.account_id] || 0) + 1;
            });
            const before = state.accounts.length;
            state.accounts = state.accounts.filter(acc => {
                const hasTransactions = !!txnCounts[acc.id];
                const hasValidName = acc.name && acc.name.trim() !== '' && acc.name !== 'New Account';
                const isMalformedName = acc.name && (
                    acc.name.includes('GENERIC PARSER') ||
                    acc.name === 'Unknown Bank' ||
                    acc.name.startsWith('BANK - ') ||         // "BANK - RBC #8468" legacy malformed
                    /^Unknown Bank\s*[-–]/i.test(acc.name)    // "Unknown Bank - Chequing"
                );
                if (!hasTransactions) {
                    console.log(`[ACCOUNTS] 🗑 Pruned ghost account (0 txns): ${acc.id} — ${acc.name}`);
                    return false;
                }
                if (!hasValidName) {
                    console.log(`[ACCOUNTS] 🗑 Pruned blank-name account: ${acc.id} — "${acc.name}"`);
                    return false;
                }
                // Malformed name with transactions: rename instead of prune
                if (isMalformedName && hasTransactions) {
                    const newName = this._buildCleanAccountName(acc);
                    console.log(`[ACCOUNTS] Renamed malformed account: ${acc.id} — "${acc.name}" → "${newName}"`);
                    acc.name = newName;
                    // Also update COA entry if linked
                    if (acc.coaCode && state.coa[acc.coaCode]) {
                        state.coa[acc.coaCode].name = newName;
                    }
                }
                return true;
            });
            const pruned = before - state.accounts.length;
            if (pruned > 0) save();
            console.log(`[ACCOUNTS] pruneGhosts: removed ${pruned} ghost(s), ${state.accounts.length} remain`);
            return pruned;
        },
        /**
         * Build a clean, human-readable account name from all available account fields.
         * Used for renaming GENERIC PARSER / Unknown Bank accounts.
         */
        _buildCleanAccountName: function (acc) {
            const instCodeMap = { '003': 'RBC', '001': 'BMO', '004': 'TD', '002': 'Scotia', '010': 'CIBC', '016': 'HSBC', 'ATB': 'ATB', 'AMEX': 'Amex' };
            const bankShortNames = {
                'Royal Bank of Canada': 'RBC', 'RBC Royal Bank': 'RBC', 'RBC': 'RBC',
                'Toronto-Dominion Bank': 'TD', 'TD Canada Trust': 'TD', 'TD': 'TD',
                'Canadian Imperial Bank of Commerce': 'CIBC', 'CIBC': 'CIBC',
                'Bank of Montreal': 'BMO', 'BMO Bank of Montreal': 'BMO', 'BMO': 'BMO',
                'Scotiabank': 'Scotia', 'The Bank of Nova Scotia': 'Scotia',
                'ATB Financial': 'ATB', 'ATB': 'ATB',
                'HSBC': 'HSBC', 'American Express': 'Amex',
                'Unknown Bank': ''
            };

            // Priority: bankName → inst code → account ID prefix → fallback "Bank"
            const rawBankName = acc.bankName || '';
            const isGeneric = rawBankName.includes('GENERIC PARSER') || rawBankName === 'GENERIC PARSER' || rawBankName === 'Unknown Bank';
            const safeBankName = isGeneric ? '' : rawBankName;
            const bankShort = bankShortNames[safeBankName] || safeBankName || instCodeMap[acc.inst] || '';

            const last4Raw = acc.accountNumber?.replace(/[-\s]/g, '').slice(-4);
            const last4 = (last4Raw && last4Raw.length === 4 && !/^[X\-0]+$/i.test(last4Raw)) ? last4Raw : null;

            if (acc.brand || acc.cardNetwork) {
                const brand = (acc.brand || acc.cardNetwork || '').toUpperCase();
                const brandShort = brand.includes('MASTERCARD') ? 'MC' : brand.includes('VISA') ? 'Visa' : brand.includes('AMEX') ? 'Amex' : brand;
                const bankLabel = bankShort || 'Bank';
                return last4 ? `${bankLabel} - ${brandShort} #${last4}` : `${bankLabel} - ${brandShort}`;
            }

            // Determine account type label for display
            const typeUpper = (acc.accountType || '').toUpperCase();
            let typeStr;
            if (typeUpper === 'SAVINGS') typeStr = 'Savings';
            else if (typeUpper === 'LOC' || typeUpper === 'LINE_OF_CREDIT' || typeUpper === 'LINEOFCREDIT') typeStr = 'Line of Credit';
            else if (typeUpper === 'MORTGAGE') typeStr = 'Mortgage';
            else if (typeUpper === 'LOAN' || typeUpper === 'BANK_LOAN' || typeUpper === 'BANKLOAN') typeStr = 'Loan';
            else if (typeUpper === 'FINANCE_CONTRACT' || typeUpper === 'FINANCECONTRACT') typeStr = 'Finance Contract';
            else typeStr = 'Chequing';

            const bankLabel = bankShort || 'Bank';
            return last4 ? `${bankLabel} - ${typeStr} #${last4}` : `${bankLabel} - ${typeStr}`;
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

            // Bank/network icons — persist these so UI can render logos without re-deriving
            if (metadata.bankIcon !== undefined) acc.bankIcon = metadata.bankIcon;
            if (metadata.networkIcon !== undefined) acc.networkIcon = metadata.networkIcon;

            if (metadata.statementClosingDay !== undefined) acc.statementClosingDay = metadata.statementClosingDay;
            if (metadata.currency !== undefined) acc.currency = metadata.currency;
            if (!acc.currency) acc.currency = 'CAD';

            // Auto-assign ref# ONLY for brand-new accounts (never re-assign existing refs)
            if (isNewAccount || acc.ref === 'TEMP') {
                const brand = (acc.brand || acc.cardNetwork || acc._tag || '').toUpperCase();
                const accountName = (acc.name || acc.bankName || '').toUpperCase();
                let refPrefix = 'CHQ'; // Default

                const _aType = (acc.accountType || '').toUpperCase();
                if (brand.includes('MASTERCARD') || brand.includes('MC')) refPrefix = 'MC';
                else if (brand.includes('VISA')) refPrefix = 'VISA';
                else if (brand.includes('AMEX')) refPrefix = 'AMEX';
                else if (_aType === 'SAVINGS' || accountName.includes('SAVINGS')) refPrefix = 'SAV';
                else if (_aType === 'LOC' || _aType === 'LINE_OF_CREDIT' || _aType === 'LINEOFCREDIT') refPrefix = 'LOC';
                else if (_aType === 'MORTGAGE') refPrefix = 'MTG';
                else if (_aType === 'LOAN' || _aType === 'BANK_LOAN' || _aType === 'BANKLOAN') refPrefix = 'LOAN';
                else if (_aType === 'FINANCE_CONTRACT' || _aType === 'FINANCECONTRACT') refPrefix = 'FIN';

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
                'RBC Royal Bank': 'RBC',
                'RBC': 'RBC',
                'Toronto-Dominion Bank': 'TD',
                'Toronto-Dominion': 'TD',
                'TD Canada Trust': 'TD',
                'Canadian Imperial Bank of Commerce': 'CIBC',
                'CIBC': 'CIBC',
                'Bank of Montreal': 'BMO',
                'BMO Bank of Montreal': 'BMO',
                'BMO': 'BMO',
                'Scotiabank': 'Scotia',
                'The Bank of Nova Scotia': 'Scotia',
                'ATB Financial': 'ATB',
                'ATB': 'ATB',
                'HSBC': 'HSBC'
            };
            // NEVER use "GENERIC PARSER" or "Unknown Bank" as display names — treat as if no name provided
            const rawBankName = acc.bankName || metadata.name || '';
            const isGenericName = rawBankName.includes('GENERIC PARSER') || rawBankName === 'GENERIC PARSER' || rawBankName === 'Unknown Bank';
            const safeBankName = isGenericName ? '' : rawBankName;
            // Try to extract a bank name from the account ID (e.g. "BANK-00052-1234" → look up inst code)
            const instCodeMap = { '003': 'RBC', '001': 'BMO', '004': 'TD', '002': 'Scotia', '010': 'CIBC', '016': 'HSBC', 'ATB': 'ATB', 'AMEX': 'Amex', 'CC': '' };
            const instFallback = acc.inst ? (instCodeMap[acc.inst] || '') : '';
            const bankShort = bankShortNames[safeBankName] || safeBankName || instFallback || 'Bank';
            const rawLast4 = acc.accountNumber?.replace(/[-\s]/g, '')?.slice(-4);
            // Only use last4 if it's a real account number (not placeholders like XXXX, ----, 0000)
            const last4 = (rawLast4 && rawLast4.length === 4 && !/^[X\-0]+$/i.test(rawLast4)) ? rawLast4 : null;

            if (acc.brand || acc.cardNetwork) {
                // Credit Card
                const brand = (acc.brand || acc.cardNetwork).split(' ')[0]; // "MASTERCARD" -> "MASTERCARD"
                const brandShort = brand === 'MASTERCARD' ? 'MC' : brand === 'Mastercard' ? 'MC' : brand;
                acc.name = last4 ? `${bankShort} - ${brandShort} #${last4}` : `${bankShort} - ${brandShort}`;
            } else {
                // Bank / Loan / LOC / Mortgage — use accountType for display label
                const _typeUpper = (acc.accountType || '').toUpperCase();
                let typeShort;
                if (_typeUpper === 'SAVINGS') typeShort = 'Savings';
                else if (_typeUpper === 'LOC' || _typeUpper === 'LINE_OF_CREDIT' || _typeUpper === 'LINEOFCREDIT') typeShort = 'Line of Credit';
                else if (_typeUpper === 'MORTGAGE') typeShort = 'Mortgage';
                else if (_typeUpper === 'LOAN' || _typeUpper === 'BANK_LOAN' || _typeUpper === 'BANKLOAN') typeShort = 'Loan';
                else if (_typeUpper === 'FINANCE_CONTRACT' || _typeUpper === 'FINANCECONTRACT') typeShort = 'Finance Contract';
                else typeShort = 'Chequing';
                acc.name = last4 ? `${bankShort} - ${typeShort} #${last4}` : `${bankShort} - ${typeShort}`;
            }

            // ── Auto-assign COA code for brand-new accounts ────────────────────
            if (isNewAccount) {
                this._assignCOACode(acc);
            }

            // ── Retroactively sync COA display name for existing linked accounts ──
            // When an account is re-imported, its acc.name may be updated (e.g. bank
            // name resolved, last4 digits added) but the linked COA entry still has
            // the old template name ("Bank - chequing", "Savings account #2", etc.).
            // Sync it here so the Trial Balance always shows the real account name.
            if (!isNewAccount && acc.coaCode && state.coa[acc.coaCode]) {
                const oldCoaName = state.coa[acc.coaCode].name;
                if (oldCoaName !== acc.name) {
                    state.coa[acc.coaCode].name = acc.name;
                    console.log(`[COA] Synced COA name: ${acc.coaCode} "${oldCoaName}" → "${acc.name}"`);
                }
            }

            save();
        },

        /**
         * Auto-assign a unique COA code to a new bank/CC/loan account.
         * Routes by accountType to the correct COA range, preserving the
         * template's leadsheet, GIFI (mapNo), and sign. Each range has
         * template slots in COA_DEFAULTS that get claimed with the real
         * account display name.
         *
         * Ranges (matching CaseWare / Profile COA structure):
         *   Chequing        → 1000-1034  (Asset, L/S=A,  GIFI 111)
         *   Savings          → 1035-1099  (Asset, L/S=A,  GIFI 111)
         *   Credit Card      → 2104-2119  (Liability, L/S=BB, GIFI 215)
         *   Line of Credit   → 2010-2039  (Liability, L/S=AA, GIFI 213)
         *   Bank Loan        → 2710-2724  (Liability, L/S=KK, GIFI 231.3140.xx)
         *   Mortgage         → 2800-2830  (Liability, L/S=KK, GIFI 231.3141.xx)
         *   Finance Contract → 2850-2880  (Liability, L/S=KK, GIFI 231.3140.5x)
         */
        _assignCOACode: function (acc) {
            const type = (acc.accountType || '').toUpperCase();
            const nameUpper = (acc.name || '').toUpperCase();
            const isCC = type === 'CREDITCARD' || acc.brand || acc.cardNetwork;
            const isSavings = type === 'SAVINGS' || nameUpper.includes('SAVINGS');
            const isLOC = type === 'LOC' || type === 'LINE_OF_CREDIT' || type === 'LINEOFCREDIT' ||
                          nameUpper.includes('LINE OF CREDIT') || nameUpper.includes('LOC');
            const isLoan = type === 'LOAN' || type === 'BANK_LOAN' || type === 'BANKLOAN' ||
                           nameUpper.includes('BANK LOAN');
            const isMortgage = type === 'MORTGAGE' || nameUpper.includes('MORTGAGE');
            const isFinanceContract = type === 'FINANCE_CONTRACT' || type === 'FINANCECONTRACT' ||
                                      nameUpper.includes('FINANCE CONTRACT') || nameUpper.includes('LEASE');

            // Route to the correct COA range with proper root/leadsheet/sign/GIFI
            let rangeStart, rangeEnd, root, leadsheet, sign, templateMapNo, bsType;
            bsType = 'Balance sheet';

            if (isCC) {
                rangeStart = 2104; rangeEnd = 2119;
                root = 'LIABILITY'; leadsheet = 'BB'; sign = 'Credit'; templateMapNo = 215;
            } else if (isLOC) {
                rangeStart = 2010; rangeEnd = 2039;
                root = 'LIABILITY'; leadsheet = 'AA'; sign = 'Credit'; templateMapNo = 213;
            } else if (isMortgage) {
                rangeStart = 2800; rangeEnd = 2830;
                root = 'LIABILITY'; leadsheet = 'KK'; sign = 'Credit'; templateMapNo = '231.3141.01';
            } else if (isLoan) {
                rangeStart = 2710; rangeEnd = 2724;
                root = 'LIABILITY'; leadsheet = 'KK'; sign = 'Credit'; templateMapNo = '231.3140.01';
            } else if (isFinanceContract) {
                rangeStart = 2850; rangeEnd = 2880;
                root = 'LIABILITY'; leadsheet = 'KK'; sign = 'Credit'; templateMapNo = '231.3140.51';
            } else if (isSavings) {
                rangeStart = 1035; rangeEnd = 1099;
                root = 'ASSET'; leadsheet = 'A'; sign = 'Debit'; templateMapNo = 111;
            } else {
                // Default: Chequing
                rangeStart = 1000; rangeEnd = 1034;
                root = 'ASSET'; leadsheet = 'A'; sign = 'Debit'; templateMapNo = 111;
            }

            // Find first unused code in range.
            // An entry is "unused" if it doesn't exist yet, or if it's an unclaimed
            // template (has no sourceAccountId). We never clobber entries that belong
            // to a different leadsheet or root — those are real accounting entries that
            // happen to sit in the same numeric range.
            let assignedCode = null;
            for (let code = rangeStart; code <= rangeEnd; code++) {
                const codeStr = String(code);
                const existing = state.coa[codeStr];
                if (!existing) {
                    // Slot doesn't exist yet — can create it
                    assignedCode = codeStr;
                    break;
                }
                if (existing.sourceAccountId) {
                    // Already claimed by a real imported account — skip
                    continue;
                }
                // Unclaimed existing entry: only claim if its leadsheet matches our target
                // (avoids clobbering "Bonus Payable" L/S=BB when routing CC to L/S=BB,
                //  but Bonus Payable won't be in 2104+ range anyway)
                if (existing.leadsheet === leadsheet) {
                    assignedCode = codeStr;
                    break;
                }
                // Different leadsheet → real entry, skip
            }

            if (!assignedCode) {
                console.warn(`[COA] No available COA codes in range ${rangeStart}-${rangeEnd} for account ${acc.id}`);
                return;
            }

            // Build COA display name from the account name
            const coaName = acc.name || 'New Account';

            // Register in COA (overwrites template entry if it was a default placeholder)
            COA.register(assignedCode, coaName, root, leadsheet, sign, {
                type: 'Balance sheet',
                mapNo: templateMapNo,
                sourceAccountId: acc.id
            });

            // Store COA code back on the account for cross-reference
            acc.coaCode = assignedCode;
            console.log(`[COA] Auto-assigned COA code ${assignedCode} to account ${acc.id} (${acc.name})`);
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
        },
        remove: function (id) {
            const idx = state.accounts.findIndex(a => a.id === id);
            if (idx !== -1) {
                state.accounts.splice(idx, 1);
                save();
                return true;
            }
            return false;
        }
    };

    // --- INGESTION SERVICE ---
    const Ingestion = {
        /**
         * Minimal CSV Parser for the demo/live system
         */
        parseCSV: function (text) {
            const lines = text.split('\n').filter(l => l.trim());
            if (!lines.length) return [];

            // RFC 4180-compliant quoted-field parser — handles "1,234.56" inside quotes
            const parseCSVLine = (line) => {
                const fields = [];
                let field = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const ch = line[i];
                    if (inQuotes) {
                        if (ch === '"' && line[i + 1] === '"') {
                            field += '"'; i++; // Escaped double-quote
                        } else if (ch === '"') {
                            inQuotes = false;
                        } else {
                            field += ch;
                        }
                    } else {
                        if (ch === '"') {
                            inQuotes = true;
                        } else if (ch === ',') {
                            fields.push(field.trim());
                            field = '';
                        } else {
                            field += ch;
                        }
                    }
                }
                fields.push(field.trim()); // push last field
                return fields;
            };

            const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());

            return lines.slice(1).map(line => {
                const values = parseCSVLine(line);
                const entry = {};
                headers.forEach((h, i) => entry[h] = values[i] ?? '');
                return entry;
            });
        },

        /**
         * PDF.js Text Extraction (Forensic Reconstruction)
         * Preserves line breaks by detecting Y-coordinate changes
         * NOW ALSO RETURNS LINE COORDINATES for highlighting
         */
        extractTextFromPDF: async function (arrayBuffer, timeoutMs = 15000) {
            console.log(`[PDF.js] Starting extraction with ${timeoutMs}ms timeout...`);

            // Create a timeout promise that rejects
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`PDF_EXTRACTION_TIMEOUT: PDF.js getDocument() timed out after ${timeoutMs}ms. This PDF may be corrupted or use unsupported compression.`));
                }, timeoutMs);
            });

            // Race between PDF loading and timeout
            const pdf = await Promise.race([
                pdfjsLib.getDocument({
                    data: arrayBuffer,
                    useSystemFonts: true,      // Skip custom font embedding
                    disableFontFace: true,      // Don't load custom fonts
                    verbosity: 0                 // Suppress PDF.js warnings
                }).promise,
                timeoutPromise
            ]);

            console.log(`[PDF.js] ✅ Document loaded successfully (${pdf.numPages} pages)`);

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
                upper.includes('TORONTO-DOMINION') || upper.includes('TORONTO DOMINION') ||
                (upper.includes('TD') && (upper.includes('VISA') || upper.includes('CHEQUING') || upper.includes('SAVINGS') || upper.includes('MASTERCARD')) &&
                    !upper.includes('RBC') && !upper.includes('ROYAL BANK') && !upper.includes('BMO') && !upper.includes('CIBC') && !upper.includes('SCOTIABANK'))) &&
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

                if (upper.includes('SAVINGS') &&
                    !upper.includes('MASTERCARD') && !upper.includes('MASTER CARD') &&
                    !upper.includes('VISA') && !upper.includes('AMEX') && !upper.includes('AMERICAN EXPRESS')) {
                    // Catches: "SAVINGS ACCOUNT", "ENHANCED SAVINGS", "HIGH INTEREST eSAVINGS",
                    //          "BUSINESS ESSENTIALS SAVINGS", "RBC SAVINGS", etc.
                    console.log('[PARSER] Routing to RBC Savings Parser');
                    if (window.rbcSavingsParser) {
                        result = await window.rbcSavingsParser.parse(text);
                        if (result) console.log('[PARSER] RBC Savings returned:', result);
                    }
                } else if (upper.includes('BUSINESS ACCOUNT STATEMENT') || upper.includes('CHEQU')) {
                    console.log('[PARSER] Routing to RBC Chequing Parser');
                    if (window.rbcChequingParser) {
                        result = await window.rbcChequingParser.parse(text);
                        if (result) console.log('[PARSER] RBC Chequing returned:', result);
                    }
                } else if (upper.includes('MASTERCARD') || upper.includes('MASTER CARD') || upper.includes('BUSINESS CASH BACK') || upper.includes('CASHBACK MASTERCARD') || (upper.includes('MC') && !upper.includes('VISA') && /5[1-5]\d{2}[\s\-\*]/.test(text))) {
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
                } else if (upper.includes('MASTERCARD') || upper.includes('MASTER CARD')) {
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

            // ==================== TD PARSERS (Secondary — catches TD BANK / TORONTO DOMINION) ====================
            // Note: The first TD block above handles most cases. This block catches any remaining patterns.
            else if (upper.includes('TD CANADA') || upper.includes('TD BANK') || upper.includes('TORONTO-DOMINION') || upper.includes('TORONTO DOMINION')) {
                console.log('[PARSER] Detected TD statement (secondary block)');

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

            // ==================== SCOTIA PARSERS ====================
            else if (upper.includes('SCOTIA') || upper.includes('SCOTIABANK')) {
                console.log('[PARSER] Detected Scotia statement');

                if (upper.includes('AMEX') || upper.includes('AMERICAN EXPRESS')) {
                    console.log('[PARSER] Routing to Scotia Amex Parser');
                    if (window.scotiaAmexParser) {
                        result = await window.scotiaAmexParser.parse(text);
                        if (result) console.log('[PARSER] Scotia Amex returned:', result);
                    }
                } else if (upper.includes('MASTERCARD') || upper.includes('MASTER CARD')) {
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

            // ==================== MASTERCARD CATCH-ALL ====================
            // Only fires if NO specialized parser matched at all (result is null/empty AND no metadata).
            // If a parser ran and returned metadata (even with 0 transactions), we trust it and skip this.
            if ((!result || !result.transactions || result.transactions.length === 0) &&
                !result?.metadata &&   // ← don't re-run if a parser already claimed it
                (upper.includes('MASTERCARD') || upper.includes('MASTER CARD') || /5[1-5]\d{2}[\s\-\*]/.test(text))) {
                console.log('[PARSER] Mastercard catch-all: trying RBC Mastercard parser as format handler');
                if (window.rbcMastercardParser) {
                    result = await window.rbcMastercardParser.parse(text);
                    if (result && result.transactions && result.transactions.length > 0) {
                        console.log('[PARSER] Mastercard catch-all succeeded:', result.transactions.length, 'txns');
                        // Fix the bank name — the MC parser always stamps 'RBC' but this may not be RBC
                        // Detect the actual bank from the text and override
                        if (result.metadata) {
                            if (upper.includes('SCOTIA') || upper.includes('SCOTIABANK')) {
                                result.metadata.bankName = 'Scotiabank';
                                result.metadata.bankIcon = 'SCOTIA';
                            } else if (upper.includes('BMO') || upper.includes('BANK OF MONTREAL')) {
                                result.metadata.bankName = 'BMO';
                                result.metadata.bankIcon = 'BMO';
                            } else if (upper.includes('TD CANADA') || upper.includes('TD BANK') || upper.includes('TORONTO-DOMINION')) {
                                result.metadata.bankName = 'TD';
                                result.metadata.bankIcon = 'TD';
                            } else if (upper.includes('CIBC')) {
                                result.metadata.bankName = 'CIBC';
                                result.metadata.bankIcon = 'CIBC';
                            } else if (upper.includes('ATB')) {
                                result.metadata.bankName = 'ATB Financial';
                                result.metadata.bankIcon = 'ATB';
                            } else if (upper.includes('HSBC')) {
                                result.metadata.bankName = 'HSBC';
                                result.metadata.bankIcon = 'HSBC';
                            }
                            // If still RBC (or no match found), keep as-is
                            console.log('[PARSER] Mastercard catch-all bank resolved to:', result.metadata.bankName);
                        }
                    } else {
                        result = null; // Reset so fallback runs
                    }
                }
            }

            // Fallback to legacy regex if no parser matched or returned nothing
            if (!result || !result.transactions || result.transactions.length === 0) {
                console.warn('[PARSER] No specialized parser matched or returned empty. Using legacy regex fallback.');
                const legacyTransactions = this.legacyRegexParser(text);
                const fallbackMeta = this.detectInstitution(text);
                // NEVER propagate "GENERIC PARSER" as a metadata name — it contaminates account display names
                if (fallbackMeta.name === 'GENERIC PARSER' || fallbackMeta.name === 'Unknown Bank') {
                    // Try one more time to identify bank from text keywords
                    const u = text.toUpperCase();
                    if (u.includes('SCOTIABANK') || u.includes('SCOTIABANK')) fallbackMeta.name = 'Scotiabank';
                    else if (u.includes('CIBC')) fallbackMeta.name = 'CIBC';
                    else if (u.includes('ATB')) fallbackMeta.name = 'ATB Financial';
                    else if (u.includes('HSBC')) fallbackMeta.name = 'HSBC';
                    else if (u.includes('NATIONAL BANK') || u.includes('BANQUE NATIONALE')) fallbackMeta.name = 'National Bank';
                    else if (u.includes('DESJARDINS')) fallbackMeta.name = 'Desjardins';
                    else if (u.includes('LAURENTIAN')) fallbackMeta.name = 'Laurentian Bank';
                    else fallbackMeta.name = 'Unknown Bank';
                    console.warn(`[PARSER] detectInstitution fallback resolved to: ${fallbackMeta.name}`);
                }
                // Normalize legacy transactions: add debit/credit fields and a parser_ref
                const fallbackStmtId = 'LEGACY-' + (new Date().getFullYear()) + String(new Date().getMonth() + 1).padStart(2, '0');
                const normalizedLegacy = legacyTransactions.map((tx, idx) => ({
                    ...tx,
                    debit: (tx.amount && tx.amount < 0) ? Math.abs(tx.amount) : (tx.debit || 0),
                    credit: (tx.amount && tx.amount > 0) ? tx.amount : (tx.credit || 0),
                    parser_ref: `${fallbackStmtId}-${String(idx + 1).padStart(3, '0')}`,
                    // No audit/pdfLocation — legacy parser has no spatial data
                }));
                result = {
                    transactions: normalizedLegacy,
                    metadata: fallbackMeta
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
                '001': { name: 'BMO Bank of Montreal', anchors: ['BMO', 'BANK OF MONTREAL'], transitRegex: /TRANSIT\s*(\d{5})/i },
                '004': { name: 'TD Canada Trust', anchors: ['TD CANADA', 'TD BANK', 'TORONTO-DOMINION', 'TORONTO DOMINION', 'TD AEROPLAN', 'AEROPLAN', 'TD TRUST'], transitRegex: /TRANSIT\s*(\d{5})/i },
                '002': { name: 'Scotiabank', anchors: ['SCOTIABANK', 'BANK OF NOVA SCOTIA', 'SCOTIA'], transitRegex: /TRANSIT\s*(\d{5})/i },
                '010': { name: 'CIBC', anchors: ['CIBC', 'CANADIAN IMPERIAL'], transitRegex: /TRANSIT\s*(\d{5})/i },
                '016': { name: 'HSBC', anchors: ['HSBC'], transitRegex: /TRANSIT\s*(\d{5})/i },
                'ATB': { name: 'ATB Financial', anchors: ['ATB FINANCIAL', 'ATB'], transitRegex: /TRANSIT\s*(\d{5})/i },
                'AMEX': { name: 'American Express', anchors: ['AMERICAN EXPRESS', 'AMEX BANK'], transitRegex: null }
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

            // Never return 'GENERIC PARSER' — use 'Unknown Bank' as the safe fallback
            return { id: '000', name: 'Unknown Bank', transit: 'UNKNOWN' };
        },

        // Generate unique account ID based on metadata
        generateAccountId: function (metadata) {
            // Credit Cards: Use brand + last 4 digits (handles masked numbers like 5526 12** **** 1999)
            const tag = (metadata._tag || metadata.tag || metadata.cardNetwork || metadata.brand || "").toUpperCase();
            if (tag.includes("MASTERCARD") || tag.includes("VISA") || tag.includes("MC")) {
                const cardNum = (metadata._acct || metadata.accountNumber || "").replace(/\D/g, "");
                if (cardNum.length >= 4) {
                    const last4 = cardNum.slice(-4);
                    // Reject placeholder digits (all zeros)
                    if (!/^0+$/.test(last4)) {
                        const brand = (tag.includes("MASTERCARD") || tag.includes("MC")) ? "MC" : "VISA";
                        return `CC-${brand}-${last4}`;
                    }
                }
                // Card number was all X's / masked — try to find an existing CC account to merge into
                const brand = (tag.includes("MASTERCARD") || tag.includes("MC")) ? "MC" : "VISA";
                const existingCC = state.accounts.find(a => a.id && a.id.startsWith(`CC-${brand}-`) && a.id !== `CC-${brand}-0000`);
                if (existingCC) {
                    console.log(`[INGEST] Merging masked CC into existing account: ${existingCC.id}`);
                    return existingCC.id;
                }
                // No existing CC — use bank+brand as ID (will be a unique but real account)
                const bankTag = (metadata.bankName || metadata._bank || 'CC').toUpperCase().substring(0, 4);
                return `CC-${brand}-${bankTag}-${Date.now()}`;
            }
            // Amex: Check both tag AND cardNetwork (tag may be "Platinum" not "Amex")
            if (tag.includes("AMEX") || tag.includes("AMERICAN EXPRESS") ||
                (metadata.cardNetwork && metadata.cardNetwork.toUpperCase().includes("AMEX"))) {
                const cardNum = (metadata._acct || metadata.accountNumber || "").replace(/\D/g, "");
                if (cardNum.length >= 4) {
                    const last4 = cardNum.slice(-4);
                    if (!/^0+$/.test(last4)) {
                        return `CC-AMEX-${last4}`;
                    }
                }
                // Masked Amex — try to merge into existing
                const existingAmex = state.accounts.find(a => a.id && a.id.startsWith('CC-AMEX-') && !/^CC-AMEX-0+$/.test(a.id));
                if (existingAmex) {
                    console.log(`[INGEST] Merging masked AMEX into existing account: ${existingAmex.id}`);
                    return existingAmex.id;
                }
            }









            // Bank Accounts: Use transit + account last 4
            if (metadata.transit && metadata.transit !== 'N/A' && metadata.transit !== '-----' && metadata.transit !== 'UNKNOWN') {
                const accountNum = (metadata.accountNumber || metadata.account_num || '').replace(/\D/g, '');
                const last4 = accountNum.slice(-4) || '0000';
                return `BANK-${metadata.transit}-${last4}`;
            }

            // Fallback: Use bank name + timestamp for traceability (never bare ACC-xxx)
            const bankTag = (metadata.bankName || metadata._bank || metadata.name || 'UNKNOWN').replace(/\s+/g, '').substring(0, 6).toUpperCase();
            return `${bankTag}-${Date.now()}`;
        },

        processUpload: async function (file, account_id) {
            // ── PRE-IMPORT GUARD: Require an active client ───────────────────────
            if (!window.UI_STATE?.activeClientId) {
                console.error('[INGEST] No active client — aborting import. Select a client first.');
                return 0;
            }

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

                let text = '';
                let lineCoordinates = [];
                let parseResult = null;

                try {
                    // Create blob URL that can be used by PDF viewer
                    pdfBlobUrl = URL.createObjectURL(file);
                    console.log('[INGEST] 🔗 Created blob URL:', pdfBlobUrl);

                    // Check if file is from OneDrive cloud storage (not fully downloaded)
                    if (file.size === 0) {
                        throw new Error('CLOUD_FILE_ERROR: This file appears to be a cloud placeholder (size = 0). Please ensure the file is fully downloaded from OneDrive/cloud storage before uploading. Right-click the file in Finder and select "Download" or "Always Keep on This Device".');
                    }

                    const buffer = await file.arrayBuffer();
                    console.log('[INGEST] 📦 Buffer size:', buffer.byteLength, 'bytes');

                    console.log('[INGEST] 🔄 Starting PDF text extraction...');
                    try {
                        const pdfData = await this.extractTextFromPDF(buffer);
                        console.log('[INGEST] ✅ PDF text extraction complete');
                        text = pdfData.text;
                        lineCoordinates = pdfData.lineCoordinates;
                    } catch (extractionError) {
                        if (extractionError.message && extractionError.message.startsWith('PDF_EXTRACTION_TIMEOUT')) {
                            console.error('[INGEST] ⚠️ PDF extraction timed out:', extractionError.message);
                            throw new Error(`PDF_TIMEOUT: This PDF cannot be processed due to incompatible formatting. Please export this statement as CSV from your bank and upload instead.`);
                        }
                        throw extractionError; // Re-throw other errors
                    }

                    console.log('[INGEST] 📝 Extracted text length:', text.length, 'characters');
                    console.log('[INGEST] 📍 Line coordinates captured:', lineCoordinates.length, 'lines');
                    console.log('[INGEST] 📝 First 500 chars:', text.substring(0, 500));

                    // Try specialized parser first, fallback to detection
                    console.log('[INGEST] 🔍 Calling parsePDFText...');
                    parseResult = await this.parsePDFText(text, lineCoordinates); // PASS LINE COORDS
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
                        // NEVER propagate "GENERIC PARSER" — it contaminates display names
                        if (metadata.name === 'GENERIC PARSER') {
                            metadata.name = 'Unknown Bank';
                            console.warn('[INGEST] detectInstitution returned GENERIC PARSER — replaced with "Unknown Bank"');
                        }
                        rows = parseResult || [];
                    }
                } catch (pdfError) {
                    console.error('[INGEST] ❌ PDF processing failed for', file.name, ':', pdfError);
                    console.error('[INGEST] Error stack:', pdfError.stack);
                    throw pdfError; // Re-throw to be caught by outer handler
                }


                // Attach source file id AND PDF blob URL to each parsed row
                // NOW with coordinate matching for highlights!
                rows = rows.map(r => {
                    // Try to find matching coordinate for this transaction
                    // Use first 25 chars of description for broader matching
                    const searchText = (r.description || '').substring(0, 25).trim();
                    // Amount: try debit, credit, then raw amount field
                    const rawAmt = r.debit || r.credit || r.amount || '';
                    const searchAmount = rawAmt ? String(rawAmt).replace(/[$,]/g, '').trim() : '';

                    let matchedCoord = null;
                    for (const coord of lineCoordinates) {
                        const coordText = coord.text || '';
                        // 1. Match by description substring (strongest signal)
                        if (searchText && searchText.length > 5 && coordText.includes(searchText)) {
                            matchedCoord = coord;
                            break;
                        }
                        // 2. Match by amount (only if we have a meaningful amount)
                        if (searchAmount && searchAmount.length > 3 && coordText.includes(searchAmount)) {
                            matchedCoord = coord;
                            break;
                        }
                    }
                    // 3. If still no match, try shorter description prefix (10 chars)
                    if (!matchedCoord && searchText.length > 10) {
                        const shortSearch = searchText.substring(0, 10);
                        for (const coord of lineCoordinates) {
                            if (coord.text && coord.text.includes(shortSearch)) {
                                matchedCoord = coord;
                                break;
                            }
                        }
                    }

                    return {
                        ...r,
                        source_file_id: sourceFileId,
                        source_pdf: {
                            url: pdfBlobUrl,
                            filename: file.name,
                            page: matchedCoord?.page || r.pdfLocation?.page || 1,
                            raw_line: r.rawText || r.raw_line || (matchedCoord?.text) || `${r.date} ${r.description} ${r.debit || r.credit || r.amount || ''}`.trim(),
                            line_position: matchedCoord ? {
                                top: matchedCoord.y,
                                left: 50,
                                width: 500,
                                height: matchedCoord.height
                            } : (r.pdfLocation ? {
                                top: r.pdfLocation.top,
                                left: r.pdfLocation.left || 50,
                                width: r.pdfLocation.width || 500,
                                height: r.pdfLocation.height || 12
                            } : null)
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
            const importedTxIds = []; // Track IDs of newly imported transactions for categorization

            for (const row of rows) {
                // Map common headers (CSV or PDF Regex)
                const date = row.date || row.transaction_date;
                const raw_description = row.description || row.memo || row.payee || ''; // FIX: Fallback to empty string to prevent undefined

                // ── SKIP OPENING BALANCE ROWS ────────────────────────────────────
                // Opening balance lines are statement reference points, not real transactions.
                // They must not be ingested — they corrupt balances, totals, and categorization.
                // Parsers should exclude these, but we enforce it here as a safety net.
                const descLower = raw_description.toLowerCase().trim();
                if (
                    descLower === 'opening balance' ||
                    descLower.startsWith('opening balance ') ||
                    descLower === 'solde d\'ouverture' ||
                    descLower.startsWith('balance forward')
                ) {
                    console.log(`[INGEST] ⏭ Skipped opening balance row: "${raw_description}" (${date})`);
                    continue;
                }

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
                // Skip transactions with no description (parser junk / empty lines)
                if (!raw_description || raw_description.trim() === '') continue;

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
                // Hoist isLiability/isLoanAsset so it's available for category correction below
                const isLiabilityAcct = !!(metadata.brand || /VISA|MC|AMEX|MASTERCARD|CREDIT/i.test(metadata.name || ''));
                // Loan accounts: ASSET accounts where receiving a payment = liability reduction (not revenue)
                const acctRootForCat = (() => {
                    const existingAcct = state.accounts.find(a => a.id === account_id);
                    return existingAcct?.root || COA.get(existingAcct?.category || '')?.root || null;
                })();
                const isLoanAsset = acctRootForCat === 'ASSET' && /LOAN|MORTGAGE|RECEIVABLE|LINE OF CREDIT|LOC/i.test(metadata.name || '');

                // If parser didn't provide polarity, detect it from the amount sign.
                //
                // RoboLedger CC polarity convention (matches 12/12 parsers after alignment):
                //   CC credit column = purchase/charge → polarity CREDIT
                //   CC debit column  = payment/refund → polarity DEBIT
                //
                // CSV amount-only fallback:
                //   CC CSV: positive = payment (DEBIT), negative = purchase (CREDIT)
                //   CHQ CSV: positive = deposit (CREDIT), negative = withdrawal (DEBIT)
                if (!polarity) {
                    if (isLiabilityAcct) {
                        // CC: positive amount = payment (DEBIT), negative = purchase (CREDIT)
                        polarity = amount >= 0 ? Polarity.DEBIT : Polarity.CREDIT;
                    } else {
                        // CHQ/SAV: positive = deposit (CREDIT), negative = withdrawal (DEBIT)
                        polarity = amount >= 0 ? Polarity.CREDIT : Polarity.DEBIT;
                    }
                }

                // Keyword Heuristic (Override for ambiguous markers)
                // NOTE: Credit card accounts use a SEPARATE keyword set.
                // The bare word 'CREDIT' must NOT flip polarity on CC accounts —
                // CC statements use "CREDIT" to mean a charge/purchase (e.g. "ONLINE CREDIT PURCHASE").
                // Only explicit payment language (PAYMENT - THANK YOU, PAIEMENT - MERCI) should flip CC polarity.
                if (raw_description) {
                    const upperDesc = raw_description.toUpperCase();

                    if (isLiabilityAcct) {
                        // Credit card keyword set — narrow: only unambiguous payment language
                        // MAJORITY CONVENTION: CC credit column = purchase (CREDIT), CC debit column = payment (DEBIT)
                        // So: purchase/charge keywords → CREDIT (increases liability)
                        //     payment language        → DEBIT  (decreases liability)
                        const ccCreditKeywords = ['PURCHASE', 'INTEREST CHARGE', 'ANNUAL FEE', 'FX RATE', 'FOREIGN TRANSACTION'];
                        const ccDebitKeywords  = ['PAYMENT - THANK YOU', 'PAIEMENT - MERCI', 'PAYMENT RECEIVED', 'AUTOPAY'];
                        if (ccCreditKeywords.some(k => upperDesc.includes(k))) {
                            polarity = Polarity.CREDIT;
                        } else if (ccDebitKeywords.some(k => upperDesc.includes(k))) {
                            polarity = Polarity.DEBIT;
                        }
                        // All other CC descriptions: keep polarity as derived from debit/credit columns above
                    } else {
                        // Bank / chequing / savings keyword set — broader
                        const debitKeywords  = ['PURCHASE', 'WITHDRAWAL', 'DEBIT', 'TRANSFER TO', 'PAYMENT TO', 'INTEREST CHARGE', 'FEE', 'FX RATE'];
                        const creditKeywords = ['DEPOSIT', 'TRANSFER FROM', 'PAYMENT RECEIVED', 'INTEREST EARNED', 'CREDIT', 'REFUND', 'PAYMENT - THANK YOU', 'PAIEMENT - MERCI', 'CASH BACK'];
                        if (debitKeywords.some(k => upperDesc.includes(k))) {
                            polarity = Polarity.DEBIT;
                        } else if (creditKeywords.some(k => upperDesc.includes(k))) {
                            polarity = Polarity.CREDIT;
                        }
                    }
                }

                // 3. Trigger Categorization Brain (Decision Layer)
                let predicted_code = Brain.predict(clean_description); // Predict based on clean name

                // === ACCOUNT-TYPE CATEGORY GUARD ===
                // The brain was trained mostly on chequing accounts where REVENUE codes are valid.
                // For liability accounts (credit cards, lines of credit) and loan receivables,
                // brain predictions must be validated against account type.
                //
                // CC / Bank CREDIT taxonomy:
                //   PAYMENT    → 9971 (Credit card payment clearing)
                //   REFUND     → contra-expense (same COA as the original purchase, NOT revenue)
                //   CASH BACK  → 7700 (contra bank charges — reduces card fee cost)
                //   REWARD     → 7700 (contra bank charges)
                //   REBATE     → 7700 (bank fee rebate / loyalty rebate → contra bank charges)
                //
                // We detect refunds via the raw_description / transaction_type_label from the parser.
                // RBCMastercardParser appends "\nRefund" as the type; other parsers include "Refund" in text.
                const upperDescForGuard = (raw_description || clean_description || '').toUpperCase();
                // MAJORITY CONVENTION: CC DEBIT = payment/refund (decreases liability)
                //                      CC CREDIT = purchase/charge (increases liability)
                const isCCRefund = isLiabilityAcct
                    && polarity === Polarity.DEBIT
                    && /\bREFUND\b/.test(upperDescForGuard);
                const isCashBack = isLiabilityAcct
                    && polarity === Polarity.DEBIT
                    && /CASH\s*BACK|CASHBACK|REWARD/i.test(upperDescForGuard);
                // Rebates apply on any account type (e.g. chequing bank fee rebate, CC annual fee rebate)
                // On CC accounts: rebates reduce liability → DEBIT; on CHQ accounts: rebates = credits
                const isBankRebate = isLiabilityAcct
                    ? (polarity === Polarity.DEBIT && /\bREBATE\b/i.test(upperDescForGuard))
                    : (polarity === Polarity.CREDIT && /\bREBATE\b/i.test(upperDescForGuard));
                const isCCPayment = isLiabilityAcct
                    && polarity === Polarity.DEBIT
                    && !isCCRefund
                    && !isCashBack
                    && !isBankRebate;

                if (predicted_code) {
                    const predictedRoot = COA.get(predicted_code)?.root;

                    if (isBankRebate) {
                        // Rebate on any account → contra bank charges, regardless of brain prediction
                        predicted_code = '7700';
                    } else if (isLiabilityAcct) {
                        if (isCCPayment) {
                            // DEBIT on a credit card = payment received (chequing → card)
                            // This is a clearing entry, not revenue. Force 9971.
                            predicted_code = '9971'; // Credit card payment
                        } else if (isCashBack) {
                            // Cash back / rewards → contra bank charges, not revenue
                            predicted_code = '7700';
                        } else if (isCCRefund) {
                            // Vendor refund — brain may have predicted the vendor's expense code (correct!)
                            // Only block if it predicted a REVENUE account; expense codes are correct here.
                            if (predictedRoot === 'REVENUE') {
                                predicted_code = null; // Will fall to needs_review; user must assign expense code
                            }
                            // EXPENSE prediction for a refund = correct contra-expense, keep it
                        } else if (predictedRoot === 'REVENUE') {
                            // CREDIT on a credit card = a charge/purchase — never revenue
                            // Clear the brain prediction; let it fall to needs_review/9970
                            predicted_code = null;
                        }
                        // EXPENSE and LIABILITY predictions on CC CREDIT (purchases) are valid — keep them
                    } else if (isLoanAsset) {
                        if (polarity === Polarity.CREDIT) {
                            // Credit to a loan receivable = repayment received — not revenue
                            predicted_code = '9971'; // Use clearing account
                        } else if (predictedRoot === 'REVENUE') {
                            predicted_code = null; // Loan drawdown is not revenue
                        }
                    }
                } else {
                    // No brain prediction path — use guard flags to assign special codes
                    if (isBankRebate) {
                        predicted_code = '7700'; // Rebate always → contra bank charges
                    } else if (isLiabilityAcct) {
                        if (isCCPayment) {
                            // CC DEBIT with payment language → clearing account
                            const upperDesc2 = (raw_description || '').toUpperCase();
                            if (/PAYMENT|THANK YOU|MERCI|PAIEMENT/i.test(upperDesc2)) {
                                predicted_code = '9971';
                            }
                        } else if (isCashBack) {
                            predicted_code = '7700'; // Cash back → contra bank charges
                        }
                        // isCCRefund with no brain prediction → null → needs_review (user picks expense code)
                        // SignalFusion _signalRefundMirror will handle it if a matching debit exists
                    }
                }

                const category = predicted_code ? COA.get(predicted_code) : null;

                // === PHASE 3: APPLY DESCRIPTION PARSER ===
                const parsedDesc = parseTransactionDescription(raw_description);

                // Build canonical transaction object
                const canonical = {
                    tx_id,
                    client_id: window.UI_STATE?.activeClientId || null,
                    account_id,
                    date,
                    ref: row.ref || null, // Capture Ref# from parser
                    amount_cents: Math.abs(amount_cents),
                    currency: 'CAD',
                    polarity: polarity, // NOW polarity is defined!

                    // Description chain: statement_text (original PDF) → raw_description (parser-cleaned) → description (brain-cleaned)
                    description: clean_description, // PRIMARY: Brain-cleaned for display
                    payee: parsedDesc.payee || clean_description, // Parsed name
                    transaction_type_label: parsedDesc.transaction_type_label, // Parsed type
                    raw_description: raw_description, // PARSER-CLEANED (intermediate)
                    statement_text: row.rawText || raw_description, // ORIGINAL: Exact text from PDF statement

                    sourceFileId: sourceFileId, // Link to workbench blob
                    source_pdf: row.source_pdf || (row.pdfLocation && pdfBlobUrl ? {
                        url: pdfBlobUrl,
                        filename: file.name,
                        page: row.pdfLocation.page || 1,
                        raw_line: row.rawText || `${row.date} ${row.description} ${row.debit || row.credit}`,
                        line_position: {
                            top: row.pdfLocation.top,
                            left: row.pdfLocation.left,
                            width: row.pdfLocation.width,
                            height: row.pdfLocation.height
                        }
                    } : null), // PDF metadata for audit viewer
                    txsig,

                    // TRANSACTION IDENTITY SYSTEM
                    parser_ref: row.parser_ref || null,  // Unique parser-generated ID (e.g., AMEX-2022NOV-001)
                    pdfLocation: row.pdfLocation || null, // Exact PDF coordinates for highlighting
                    audit: row.audit || null,  // Parser audit metadata

                    metadata: {
                        source: metadata.name,
                        transit: metadata.transit,
                        sub_detail: row.sub_detail || null
                    },
                    category: predicted_code || null,       // Grid reads .category for COA dropdown
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
                            canonical.category = autoCat.gl_account_code;       // Grid reads .category
                            canonical.category_code = autoCat.gl_account_code;  // Ensure category_code set
                            canonical.category_name = autoCat.gl_account_name;
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
                if (!canonical.gl_account_code && !canonical.category_code && !canonical.category) {
                    // No category assigned - use 9970 (Uncategorized) as fallback
                    const fallbackCOA = COA.get('9970');
                    canonical.gl_account_code = '9970';
                    canonical.gl_account_name = fallbackCOA ? fallbackCOA.name : 'Uncategorized';
                    canonical.category = '9970';          // Grid reads .category
                    canonical.category_code = '9970';
                    canonical.category_name = fallbackCOA ? fallbackCOA.name : 'Uncategorized';
                    canonical.category_confidence = 0;
                    canonical.category_source = 'fallback';
                    canonical.status = 'needs_review';
                }


                // === PHASE 5: SALES TAX (GST/HST) CALCULATION ===
                // Initialize gst_enabled if not set (default based on global setting)
                if (canonical.gst_enabled === undefined) {
                    canonical.gst_enabled = settings.gstEnabled || false;
                }

                // Only calculate tax if THIS transaction has GST enabled
                if (canonical.gst_enabled) {
                    const province = settings.province || 'ON';
                    const taxRates = {
                        'ON': 0.13,
                        'BC': 0.05, // Just GST for now, PST usually ignored in simple ledger
                        'AB': 0.05,
                        'QC': 0.05
                    };
                    const rate = taxRates[province] || 0.13;

                    // Tax = Total / (1 + rate) * rate
                    // Calculate tax for BOTH debits (expenses) AND credits (revenue)
                    const amount = canonical.amount_cents / 100;
                    const taxAmount = (amount / (1 + rate)) * rate;
                    canonical.tax_cents = Math.round(taxAmount * 100);
                    // console.log(`[TAX] Calculated ${province} tax: $${taxAmount.toFixed(2)} on $${amount.toFixed(2)}`);
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
                    importedTxIds.push(canonical.tx_id); // Track for auto-categorization
                }
            }

            // Auto-categorization is handled by app.js _runAutoCatOnExisting() after import completes.
            // NOT called here because RuleEngine is a deferred ES module:
            // fusionEngine may not be initialized yet at this point in the ingestion flow.
            // app.js awaits window.RuleEngine.ready before calling bulkCategorize().
            if (importedCount > 0) {
                console.log(`[LEDGER] ${importedCount} transactions imported — auto-categorization handled by app.js`);
            }

            // Prune any ghost accounts left behind by this import (zero-transaction metadata stubs)
            Accounts.pruneGhosts();

            return importedCount;
        }
    };

    // --- COA SERVICE ---
    const COA = {
        init: function () {
            COA_DEFAULTS.forEach(entry => {
                // Preserve existing data but fill in missing fields from defaults
                if (!state.coa[entry.code]) {
                    state.coa[entry.code] = { ...entry };
                } else {
                    // Backfill all fields if missing (sign, type, ls, mapNo added in master sheet update)
                    const existing = state.coa[entry.code];
                    if (!existing.leadsheet) existing.leadsheet = entry.leadsheet;
                    if (!existing.root) existing.root = entry.root;
                    if (!existing.sign) existing.sign = entry.sign;
                    if (!existing.type) existing.type = entry.type;
                    if (!existing.ls) existing.ls = entry.ls;
                    if (existing.mapNo === undefined) existing.mapNo = entry.mapNo;
                }
            });
        },
        // Register a dynamic COA account (e.g., auto-created for an imported bank/CC account)
        register: function (code, name, root, leadsheet, sign, opts = {}) {
            const sourceAccountId = opts.sourceAccountId || null;
            if (state.coa[code]) {
                // If existing entry is an unclaimed template (no sourceAccountId), claim it
                if (!state.coa[code].sourceAccountId && sourceAccountId) {
                    state.coa[code].name = name;
                    state.coa[code].sourceAccountId = sourceAccountId;
                    save();
                    console.log(`[COA] Claimed template account: ${code} - ${name} → linked to account ${sourceAccountId}`);
                }
                return state.coa[code];
            }
            const entry = {
                code,
                name,
                root,
                leadsheet,
                sign,
                type: opts.type || (root === 'ASSET' || root === 'LIABILITY' || root === 'EQUITY' ? 'Balance sheet' : 'Income statement'),
                ls: opts.ls || leadsheet,
                mapNo: opts.mapNo || '',
                balance: 0,
                sourceAccountId // Link to imported bank account
            };
            state.coa[code] = entry;
            save();
            console.log(`[COA] Registered dynamic account: ${code} - ${name} (${root}, L/S=${leadsheet})`);
            return entry;
        },
        getAll: function () {
            return Object.values(state.coa);
        },
        get: function (code) {
            return state.coa[code] || state.coa[String(code)];
        },
        getBySourceAccount: function (accountId) {
            return Object.values(state.coa).find(a => a.sourceAccountId === accountId) || null;
        },
        getLeadsheet: function (code) {
            const acct = this.get(code);
            if (acct?.leadsheet) return acct.leadsheet;
            // Infer leadsheet from code range for accounts not in COA
            const n = parseInt(code);
            if (n >= 1000 && n <= 1099) return 'A';
            if (n >= 1100 && n <= 1199) return 'B';
            if (n >= 1200 && n <= 1289) return 'C';
            if (n >= 1290 && n <= 1399) return 'L';
            if (n >= 1400 && n <= 1499) return 'N';
            if (n >= 1500 && n <= 1899) return 'U';
            if (n >= 1900 && n <= 1949) return 'L';
            if (n >= 1950 && n <= 1999) return 'W';
            if (n >= 2000 && n <= 2009) return 'PP';
            if (n >= 2010 && n <= 2099) return 'AA';
            if (n >= 2100 && n <= 2147) return 'BB';
            if (n >= 2148 && n <= 2179) return 'CC';
            if (n >= 2180 && n <= 2599) return 'BB';
            if (n >= 2600 && n <= 2649) return 'FF';
            if (n >= 2650 && n <= 2669) return 'DD';
            if (n >= 2670 && n <= 2699) return 'EE';
            if (n >= 2700 && n <= 2709) return 'PP';
            if (n >= 2710 && n <= 2899) return 'KK';
            if (n >= 2900 && n <= 2999) return 'MM';
            if (n >= 3000 && n <= 3199) return 'SS';
            if (n >= 3200 && n <= 3999) return 'TT';
            if (n >= 4000 && n <= 4799) return '20';
            if (n >= 4800 && n <= 4999) return '70';
            if (n >= 5000 && n <= 5999) return '30';
            if (n >= 6000 && n <= 9899) return '40';
            if (n >= 9900 && n <= 9969) return '80';
            if (n >= 9970) return '70';
            return '40'; // default fallback
        },
        getLeadsheetName: function (lsCode) {
            return LEADSHEET_NAMES[lsCode] || lsCode;
        },
        getLeadsheetOrder: function () {
            return LEADSHEET_ORDER;
        },
        setName: function (code, newName) {
            const entry = state.coa[code] || state.coa[String(code)];
            if (!entry) return false;
            entry.name = newName;
            save();
            return true;
        },
        save: function () { save(); },
        inferRoot: inferRoot
    };

    // --- CATEGORIZATION BRAIN ---
    const Brain = {
        rules: [
            // Software subscriptions → 6800 (Computer & internet expenses)
            { pattern: /adobe|google workspace|aws|github|dropbox|microsoft 365/i, code: '6800' },
            // Meals/coffee/food → 6415 (Meals and entertainment)
            { pattern: /starbucks|uber eats|tim hortons|mcdonald|subway|boston pizza/i, code: '6415' },
            // Rent/lease → 7500 (Rent)
            { pattern: /\brent\b|\blease\b/i, code: '7500' },
            // Wages/payroll → 9800 (Wages, salaries and benefits)
            { pattern: /salary|payroll|\bwage\b/i, code: '9800' },
            // Bank service charges → 7700 (Bank charges and interest)
            { pattern: /monthly fee|service charge|bank fee/i, code: '7700' }
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
            // LEGACY CLEANING — only PDF pagination artifacts
            // Parser-level cleaning (e.g. cleanRBCDescription) already handles
            // dates, postal codes, long numbers, addresses. Do NOT re-strip here.
            // ═══════════════════════════════════════════════════════════

            clean = clean
                .replace(/continued\s*Date\s*Desc/gi, '')
                .replace(/\bPage\s+\d+\b/gi, '');

            // Final cleanup
            clean = clean.trim().replace(/\s+/g, ' ');

            // If cleaning destroyed everything, preserve original parser output — no fake labels
            if (!clean || clean.length < 2) return text;

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
