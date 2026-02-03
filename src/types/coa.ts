/**
 * RoboLedgers: COA Intelligence Types
 * Reference: docs/canonical_specifications/02_coa_intelligence.md
 */

export const AccountRootClass = {
    ASSET: 'ASSET',
    LIABILITY: 'LIABILITY',
    EQUITY: 'EQUITY',
    REVENUE: 'REVENUE',
    EXPENSE: 'EXPENSE'
} as const;

export type AccountRootClass = (typeof AccountRootClass)[keyof typeof AccountRootClass];

export const CanonicalAccountClass = {
    CASH_LIQ: 'CASH_LIQ',
    INV_MKT: 'INV_MKT',
    AR_TRADE: 'AR_TRADE',
    AR_OTHER: 'AR_OTHER',
    INV_STOCK: 'INV_STOCK',
    PREPAID: 'PREPAID',
    FA_LAND: 'FA_LAND',
    FA_BLDG: 'FA_BLDG',
    FA_EQUIP: 'FA_EQUIP',
    FA_VEHIC: 'FA_VEHIC',
    FA_LEASE: 'FA_LEASE',
    FA_INTAN: 'FA_INTAN',
    FA_CONTRA: 'FA_CONTRA',
    AP_TRADE: 'AP_TRADE',
    TAX_SALES: 'TAX_SALES',
    TAX_CORP: 'TAX_CORP',
    ACCR_LIAB: 'ACCR_LIAB',
    DEBT_ST: 'DEBT_ST',
    DEBT_LT: 'DEBT_LT',
    SH_LOAN: 'SH_LOAN',
    EQUITY_CAP: 'EQUITY_CAP',
    EQUITY_RE: 'EQUITY_RE',
    REV_OP: 'REV_OP',
    REV_NON_OP: 'REV_NON_OP',
    COGS_DIRECT: 'COGS_DIRECT',
    EXP_OP_G_A: 'EXP_OP_G_A',
    EXP_OP_SAL: 'EXP_OP_SAL',
    EXP_OP_MRKT: 'EXP_OP_MRKT',
    EXP_OP_MNT: 'EXP_OP_MNT',
    EXP_OP_FIN: 'EXP_OP_FIN',
    EXP_NON_OP: 'EXP_NON_OP'
} as const;

export type CanonicalAccountClass = (typeof CanonicalAccountClass)[keyof typeof CanonicalAccountClass];

export const NormalBalance = {
    DEBIT: 'DEBIT',
    CREDIT: 'CREDIT'
} as const;

export type NormalBalance = (typeof NormalBalance)[keyof typeof NormalBalance];

export const FinancialStatement = {
    BS: 'BS', // Balance Sheet
    IS: 'IS'  // Income Statement
} as const;

export type FinancialStatement = (typeof FinancialStatement)[keyof typeof FinancialStatement];

export interface AccountMetadata {
    readonly canonical_class: CanonicalAccountClass;
    readonly root_class: AccountRootClass;
    readonly normal_balance: NormalBalance;
    readonly statement: FinancialStatement;
    readonly is_reconcilable: boolean;
    readonly allows_aje: boolean;
    readonly capitalization_threshold?: number;
    readonly requires_authority: boolean;
}

export interface ChartOfAccountEntry {
    readonly account_code: string; // "1000" - "9999"
    readonly name: string;
    readonly metadata: AccountMetadata;
}
