import React from 'react';
import { TrialBalanceReport } from './TrialBalanceReport.jsx';
import { GSTReport } from './GSTReport.jsx';
import { IncomeStatementReport } from './IncomeStatementReport.jsx';
import { BalanceSheetReport } from './BalanceSheetReport.jsx';
import { GeneralLedgerReport } from './GeneralLedgerReport.jsx';
import { GeneralJournalReport } from './GeneralJournalReport.jsx';
import { COASummaryReport } from './COASummaryReport.jsx';
import { FinancialRatiosReport } from './FinancialRatiosReport.jsx';
import { CashFlowReport } from './CashFlowReport.jsx';
import { BankReconciliationReport } from './BankReconciliationReport.jsx';
import { AJEReport } from './AJEReport.jsx';
import { ComparativeReport } from './ComparativeReport.jsx';
import { CaseWareExport } from './CaseWareExport.jsx';

// ─── Opening Balances helpers (shared with TrialBalanceReport) ─────────────────
function getOpeningBalances() {
    return window.RoboLedger?._tbOpeningBalances || {};
}
function setOpeningBalances(map) {
    if (!window.RoboLedger) window.RoboLedger = {};
    window.RoboLedger._tbOpeningBalances = map;
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Normalize an account name to alphanumeric-only lowercase for fuzzy matching.
 * Strips QB dot separators (·), dashes, slashes, punctuation — everything that
 * differs between "1200 · Accounts Receivable" and "Accounts receivable".
 */
function normName(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Strip QB-style dot separator and leading/trailing whitespace from a name.
 * QB exports: "1200 · Accounts Receivable" or "6010 · Supplies"
 * The · (U+00B7 middle dot) or • (U+2022 bullet) separates code from name.
 */
function stripQBDot(s) {
    // Remove leading middle-dot / bullet / em-dash artifacts after code extraction
    return s.replace(/^[\s·•\-–—]+/, '').trim();
}

/**
 * Extract numeric code from a QB-style "NNNN · Account Name" string.
 * Returns { code, name } or null if no code found.
 * Handles:
 *   "1200 · Accounts Receivable"      → { code: '1200', name: 'Accounts Receivable' }
 *   "6010 Supplies"                    → { code: '6010', name: 'Supplies' }
 *   "  1040   Bank - chequing"         → { code: '1040', name: 'Bank - chequing' }
 *   "Accounts Receivable"              → null (no leading code)
 */
function extractCodeAndName(raw) {
    if (!raw) return null;
    // Match: optional leading spaces, 3-5 digits, then optional dot-separator, then name
    const m = raw.match(/^\s*(\d{3,5})\s*[·•\-–—]?\s*(.+)$/);
    if (m) return { code: m[1], name: stripQBDot(m[2]) };
    return null;
}

/**
 * Match an account against the COA using a multi-tier strategy:
 *  1. Exact code match
 *  2. Normalized full-name exact match
 *  3. Prefix match (longer name starts with shorter, min 5 chars)
 *  4. Token overlap (≥2 meaningful words in common, min 4 chars each)
 *
 * Returns the matched COA code string, or '' if no match.
 */
function matchToCOA(code, name, allCOA) {
    // Tier 1: exact code
    if (code && allCOA.find(a => String(a.code) === code)) return code;

    const nl = normName(name);
    if (!nl || nl.length < 2) {
        // No useful name — keep unmatched code as-is (user's custom COA)
        return code || '';
    }

    // Tier 2: normalized exact match
    const exactMatch = allCOA.find(a => normName(a.name) === nl);
    if (exactMatch) return String(exactMatch.code);

    // Tier 3: prefix match (both directions, min 5 meaningful chars)
    if (nl.length >= 5) {
        const prefix8 = nl.slice(0, 8);
        const prefixMatch = allCOA.find(a => {
            const an = normName(a.name);
            return an.length >= 5 && (an.startsWith(prefix8) || nl.startsWith(normName(a.name).slice(0, 8)));
        });
        if (prefixMatch) return String(prefixMatch.code);
    }

    // Tier 4: token overlap — split both into words ≥4 chars, require ≥2 in common
    const tokens = (s) => s.match(/[a-z0-9]{4,}/g) || [];
    const nlTokens = new Set(tokens(nl));
    if (nlTokens.size >= 2) {
        let bestScore = 0, bestMatch = null;
        for (const a of allCOA) {
            const an = normName(a.name);
            const aTokens = tokens(an);
            const overlap = aTokens.filter(t => nlTokens.has(t)).length;
            if (overlap >= 2 && overlap > bestScore) {
                bestScore = overlap;
                bestMatch = a;
            }
        }
        if (bestMatch) return String(bestMatch.code);
    }

    // No match — keep the extracted code anyway (user's custom COA entry)
    return code || '';
}

/**
 * Amount parser: handles $, commas, spaces, parentheses (negative), trailing minus.
 * Returns null if the string is empty/blank/dash (not a real zero).
 */
function parseAmt(v) {
    if (v == null) return null;
    let s = String(v).replace(/[$\s,]/g, '').trim();
    if (!s || s === '-' || s === '—' || s === '') return null;
    const isNeg = s.startsWith('(') && s.endsWith(')');
    const trailingMinus = s.endsWith('-');
    s = s.replace(/[()]/g, '').replace(/-$/, '');
    const n = parseFloat(s);
    if (isNaN(n)) return null;
    return (isNeg || trailingMinus) ? -n : n;
}

/**
 * Returns true for lines that should be skipped entirely:
 * section headers, subtotal/total rows, page noise, QB "As of" date lines,
 * QB parent account rows (have code but no numeric columns — these are grouping
 * headers only; children carry the actual balances).
 */
function isHeaderOrTotalLine(text) {
    if (!text.trim()) return true;
    // Skip "Total ..." / "TOTAL ..." subtotal rows (QB and Caseware both emit these)
    if (/^\s*total\b/i.test(text)) return true;
    // Skip grand total / net income / retained earnings synthesis rows
    if (/^\s*(grand\s*total|net\s*income|net\s*loss|retained\s*earn)/i.test(text)) return true;
    // Skip pure section headers (no numbers on the line): ASSETS, LIABILITIES etc
    if (/^\s*(assets?|liabilit|equity|revenue|income|expense|cost\s+of|operating|non.?operating)\s*$/i.test(text)) return true;
    // Skip QB report header lines
    if (/^\s*(as\s+of\s+|accrual\s+basis|cash\s+basis|prepared\s+by|page\s+\d|trial\s+balance|balance\s+sheet|income\s+statement|profit\s+.+loss)/i.test(text)) return true;
    // Skip column header row
    if (/\b(debit|dr)\b.+\b(credit|cr)\b/i.test(text)) return true;
    return false;
}

// ─── CSV parser ────────────────────────────────────────────────────────────────
/**
 * Parses a Trial Balance CSV from QuickBooks (comma or tab) or Caseware.
 *
 * QB Online export format (typical):
 *   "","Trial Balance","",""
 *   "","As of December 31, 2022","",""
 *   "","","",""
 *   "","DEBIT","CREDIT",""
 *   "1001 · Bank - Chequing","398094.65","",""
 *   "Total Bank - Chequing","398094.65","",""
 *
 * Caseware format:
 *   Code,Account Description,Debit,Credit,Balance
 *   1040,Savings account #2,398094.65,,398094.65
 */
function parseTBCsv(csvText) {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return null;
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';

    const splitLine = (line) => {
        if (delimiter !== ',') return line.split(delimiter);
        const res = []; let inQ = false, cur = '';
        for (const c of line) {
            if (c === '"') { inQ = !inQ; }
            else if (c === ',' && !inQ) { res.push(cur); cur = ''; }
            else { cur += c; }
        }
        res.push(cur);
        return res;
    };

    const clean = (v) => (v || '').replace(/"/g, '').trim();

    // ── Detect header row ─────────────────────────────────────────────────────
    // Scan up to first 10 lines for the column-header row (contains DEBIT or CREDIT)
    let headerIdx = -1;
    let codeIdx = -1, nameIdx = -1, debitIdx = -1, creditIdx = -1, balanceIdx = -1;

    for (let i = 0; i < Math.min(10, lines.length); i++) {
        const parts = splitLine(lines[i]).map(clean).map(h => h.toLowerCase());
        const joined = parts.join(' ');
        if (/\bdebit\b/.test(joined) || /\bcredit\b/.test(joined)) {
            headerIdx = i;
            codeIdx    = parts.findIndex(h => /^(code|account\s*code|ref|ref\s*no|number|acct|#)$/.test(h));
            nameIdx    = parts.findIndex(h => /^(account|account\s*name|description|name|account\s*description)$/.test(h));
            debitIdx   = parts.findIndex(h => /^(debit|dr)$/.test(h));
            creditIdx  = parts.findIndex(h => /^(credit|cr)$/.test(h));
            balanceIdx = parts.findIndex(h => /^(balance|net|closing|total|amount)$/.test(h));
            break;
        }
    }

    // QB Online uses a different layout: name in col 0, debit in col 1, credit in col 2
    // If no explicit header found, default to that layout
    const hasHeader    = headerIdx >= 0;
    const hasExplicitCode = codeIdx >= 0;
    const startIdx = hasHeader ? headerIdx + 1 : 1;

    const allCOA = window.RoboLedger?.COA?.getAll?.() || [];
    const result = {};

    for (let i = startIdx; i < lines.length; i++) {
        const parts = splitLine(lines[i]);
        if (parts.length < 2) continue;

        // Determine raw name field
        const rawName = nameIdx >= 0
            ? clean(parts[nameIdx])
            : clean(parts[0]);
        if (!rawName) continue;

        // Skip header/total/section lines
        if (isHeaderOrTotalLine(rawName)) continue;

        // Extract code and clean name
        let code = '', name = rawName;
        if (hasExplicitCode && parts[codeIdx]) {
            code = clean(parts[codeIdx]);
            name = stripQBDot(rawName);
        } else {
            // Try extracting leading code from the name (QB: "1200 · Accounts Receivable")
            const extracted = extractCodeAndName(rawName);
            if (extracted) { code = extracted.code; name = extracted.name; }
        }

        // Match to COA
        const matchedCode = matchToCOA(code, name, allCOA);
        if (!matchedCode) continue;

        const parseField = (idx) => idx >= 0 ? (parseAmt(clean(parts[idx])) ?? 0) : 0;
        const debit   = parseField(debitIdx   >= 0 ? debitIdx   : 1);
        const credit  = parseField(creditIdx  >= 0 ? creditIdx  : 2);
        const balance = balanceIdx >= 0 ? (parseAmt(clean(parts[balanceIdx])) ?? (debit - credit)) : (debit - credit);

        // Deduplicate: accumulate if same code appears multiple times (multi-page CSV)
        if (result[matchedCode]) {
            result[matchedCode].debit  += debit;
            result[matchedCode].credit += credit;
            result[matchedCode].balance = result[matchedCode].debit - result[matchedCode].credit;
        } else {
            result[matchedCode] = { name, debit, credit, balance };
        }
    }

    return Object.keys(result).length > 0 ? result : null;
}

// ─── PDF parser ────────────────────────────────────────────────────────────────
/**
 * Extracts a Trial Balance from a QB Online / QB Desktop / Caseware PDF.
 *
 * QB Online PDF layout (real-world):
 *   - Page header: company name, "Trial Balance", "As of December 31, 2022", "Accrual Basis"
 *   - Column headers: right-aligned "DEBIT" and "CREDIT" (sometimes just "TOTAL")
 *   - Account rows: "1001 · Bank - Chequing    398,094.65"
 *     where the code·name is left-justified and amount is right-justified
 *   - Parent rows: "ASSETS" / "Current Assets" — no numbers
 *   - Subtotal rows: "Total Current Assets   398,094.65" — skip these
 *
 * QB Desktop PDF: similar but uses "Balance Sheet" section headers more aggressively.
 *
 * Caseware PDF: "Ref No  Account Description  Debit  Credit  Balance"
 *   — three numeric columns instead of QB's one or two.
 *
 * Strategy:
 *   1. Extract text items with (x, y) coordinates from all pages
 *   2. Group into lines by y-bucket (3pt tolerance)
 *   3. Find column header line → determine x-anchors for numeric columns
 *   4. For each data row: extract left-side name/code, bucket into numeric columns
 *   5. Skip parent/total lines (no numeric columns, or "Total" prefix)
 *   6. Match each row to COA via matchToCOA()
 *   7. De-duplicate parent vs child: if parent code already has a value and
 *      children with sub-codes are found later, prefer children (last-write wins
 *      for same code; different codes accumulate independently)
 *   8. Fallback: reconstruct plain text → feed to parseTBCsv
 */
async function parseTBPdf(arrayBuffer) {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error('PDF.js not available');
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // ── Step 1: Extract all text items with coordinates ───────────────────────
    const allLines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
        const page    = await pdf.getPage(p);
        const content = await page.getTextContent();
        const lineMap = {};
        content.items.forEach(item => {
            if (!item.str?.trim()) return;
            const rawY = item.transform[5];
            const x    = item.transform[4];
            const yKey = Math.round(rawY / 3) * 3;
            if (!lineMap[yKey]) lineMap[yKey] = [];
            lineMap[yKey].push({ x, y: rawY, text: item.str, w: item.width || 0 });
        });
        // Sort top-to-bottom (PDF y=0 at bottom, so descending y = top-first)
        Object.keys(lineMap).map(Number).sort((a, b) => b - a).forEach(yKey => {
            allLines.push(lineMap[yKey].sort((a, b) => a.x - b.x));
        });
    }

    // ── Step 2: Find the column header line ───────────────────────────────────
    // QB Online:   [blank]  DEBIT  CREDIT
    // QB Desktop:  [blank]  DEBIT  CREDIT  (sometimes BALANCE too)
    // QB Online v2: [blank]  TOTAL           (single-column TB)
    // Caseware:    Ref No   Account Description   Debit   Credit   Balance
    let debitX = null, creditX = null, balanceX = null;
    let totalX  = null;  // QB Online single-column mode
    let headerLineIdx = -1;
    let isSingleColumn = false;

    for (let i = 0; i < allLines.length; i++) {
        const line   = allLines[i];
        const joined = line.map(item => item.text.trim().toUpperCase()).join(' ');

        if (/\bDEBIT\b/.test(joined) && /\bCREDIT\b/.test(joined)) {
            const debitItem  = line.find(item => /^DEBIT$/i.test(item.text.trim()));
            const creditItem = line.find(item => /^CREDIT$/i.test(item.text.trim()));
            const balItem    = line.find(item => /^BALANCE$/i.test(item.text.trim()));
            if (debitItem && creditItem) {
                debitX   = debitItem.x  + (debitItem.w  || 0);
                creditX  = creditItem.x + (creditItem.w || 0);
                balanceX = balItem ? (balItem.x + (balItem.w || 0)) : creditX + 90;
                headerLineIdx = i;
                break;
            }
        }

        // QB Online single-column: header says "TOTAL" only
        if (!debitX && /\bTOTAL\b/.test(joined) && !/\bDEBIT\b/.test(joined)) {
            const totalItem = line.find(item => /^TOTAL$/i.test(item.text.trim()));
            if (totalItem) {
                totalX = totalItem.x + (totalItem.w || 0);
                isSingleColumn = true;
                headerLineIdx = i;
                break;
            }
        }
    }

    // ── Step 3: Fallback to plain-text CSV reconstruction ─────────────────────
    if (debitX === null && !isSingleColumn) {
        const textLines = allLines
            .map(line => line.map(i => i.text).filter(t => t.trim()).join('  '))
            .filter(l => l.trim());
        return parseTBCsv(textLines.join('\n'));
    }

    // ── Step 4: Define column slot predicates ─────────────────────────────────
    const SLOT_W   = 110; // points — generous to catch all digit widths
    const NAME_MAX = isSingleColumn
        ? (totalX - SLOT_W - 10)
        : (debitX - SLOT_W - 10);

    const inDebitSlot   = (x) => !isSingleColumn && x > (debitX  - SLOT_W) && x <= (debitX  + 25);
    const inCreditSlot  = (x) => !isSingleColumn && x > (creditX - SLOT_W) && x <= (creditX + 25);
    const inBalanceSlot = (x) => !isSingleColumn && x > (balanceX - SLOT_W) && x <= (balanceX + 25);
    const inTotalSlot   = (x) => isSingleColumn  && x > (totalX  - SLOT_W) && x <= (totalX  + 25);
    const inNameRegion  = (x) => x < NAME_MAX;

    // ── Step 5: Parse data rows ───────────────────────────────────────────────
    const allCOA = window.RoboLedger?.COA?.getAll?.() || [];
    const result = {};

    for (let i = 0; i < allLines.length; i++) {
        if (i <= headerLineIdx) continue;

        const line   = allLines[i];
        const joined = line.map(item => item.text).join(' ').trim();

        // Skip header/total/section lines
        if (isHeaderOrTotalLine(joined)) continue;

        // Bucket items
        const nameItems   = line.filter(item => inNameRegion(item.x));
        const debitItems  = line.filter(item => inDebitSlot(item.x));
        const creditItems = line.filter(item => inCreditSlot(item.x));
        const balItems    = line.filter(item => inBalanceSlot(item.x));
        const totalItems  = line.filter(item => inTotalSlot(item.x));

        // Reconstruct the left-side text (code + name region)
        const leftText = nameItems.map(i => i.text).join(' ').trim();
        if (!leftText) continue;

        // Must have at least one numeric column to be a data row
        const numericItems = isSingleColumn ? totalItems : [...debitItems, ...creditItems, ...balItems];
        if (numericItems.length === 0) continue;

        // ── Extract code and name ─────────────────────────────────────────────
        // Strategy A: leftText joined has leading digits with QB dot: "1200 · Name"
        // Strategy B: first PDF item is pure digits (Caseware separate code cell)
        // Strategy C: leftText starts with digits+spaces+name (no dot)
        let code = '', name = leftText;

        const extracted = extractCodeAndName(leftText);
        if (extracted) {
            code = extracted.code;
            name = extracted.name;
        } else if (nameItems.length >= 2) {
            // Caseware: code is a separate left-most PDF item
            const firstItem = nameItems[0].text.trim();
            if (/^\d{3,5}$/.test(firstItem)) {
                code = firstItem;
                name = nameItems.slice(1).map(i => i.text).join(' ').trim();
            }
        }

        // Also strip any QB dot artifact from name that survived extraction
        name = stripQBDot(name);

        // ── Parse amounts ─────────────────────────────────────────────────────
        const joinAmt = (items) => items.map(i => i.text).join('').trim();

        let debit = 0, credit = 0, balance = 0;
        if (isSingleColumn) {
            // QB single-column: TOTAL = net balance (positive = debit-normal)
            const tot = parseAmt(joinAmt(totalItems)) ?? 0;
            debit  = tot > 0 ? tot : 0;
            credit = tot < 0 ? Math.abs(tot) : 0;
            balance = tot;
        } else {
            debit   = parseAmt(joinAmt(debitItems))  ?? 0;
            credit  = parseAmt(joinAmt(creditItems)) ?? 0;
            const bal = parseAmt(joinAmt(balItems));
            balance = bal !== null ? bal : (debit - credit);
        }

        // Skip if truly empty (happens with zero-balance accounts in some QB versions)
        if (debit === 0 && credit === 0 && balance === 0 && !code) continue;

        // ── Match to COA ──────────────────────────────────────────────────────
        const matchedCode = matchToCOA(code, name, allCOA);
        if (!matchedCode) continue;

        // Deduplicate: accumulate debits/credits if same code appears across pages
        if (result[matchedCode]) {
            result[matchedCode].debit  += debit;
            result[matchedCode].credit += credit;
            result[matchedCode].balance = result[matchedCode].debit - result[matchedCode].credit;
        } else {
            result[matchedCode] = { name, debit, credit, balance };
        }
    }

    // ── Step 6: Fallback if nothing was parsed ────────────────────────────────
    if (Object.keys(result).length > 0) return result;

    const textLines = allLines
        .map(line => line.map(i => i.text).filter(t => t.trim()).join('  '))
        .filter(l => l.trim());
    return parseTBCsv(textLines.join('\n'));
}

/**
 * ReportsPage - Financial Reports Hub
 * Routes to actual report components for production-ready reports
 * Includes inline Prior Year import + imported TB viewer
 */
export function ReportsPage() {
    const [selectedReport, setSelectedReport] = React.useState(null);
    const [showImport, setShowImport] = React.useState(false);
    const [importParsing, setImportParsing] = React.useState(false);
    const [importError, setImportError] = React.useState('');
    const [importPreview, setImportPreview] = React.useState(null);
    const [openingBalances, setOBState] = React.useState(() => getOpeningBalances());
    const [obFilter, setObFilter] = React.useState('');
    const fileRef = React.useRef(null);

    const fmt = (n) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);

    const reports = [
        { id: 'trial-balance',       icon: 'ph-scales',                 title: 'Trial Balance',       description: 'Verify debits equal credits',       color: 'blue',   ready: true,  component: TrialBalanceReport },
        { id: 'income-statement',    icon: 'ph-chart-line-up',          title: 'Income Statement',    description: 'Revenue, expenses, profit',          color: 'green',  ready: true,  component: IncomeStatementReport },
        { id: 'balance-sheet',       icon: 'ph-stack',                  title: 'Balance Sheet',       description: 'Assets, liabilities, equity',        color: 'cyan',   ready: true,  component: BalanceSheetReport },
        { id: 'cash-flow',           icon: 'ph-currency-circle-dollar', title: 'Cash Flow',           description: 'Operating, investing, financing',    color: 'teal',   ready: true,  component: CashFlowReport },
        { id: 'comparative',         icon: 'ph-arrows-left-right',      title: 'Comparative',         description: 'Current vs prior year',              color: 'amber',  ready: true,  component: ComparativeReport },
        { id: 'bank-reconciliation', icon: 'ph-bank',                   title: 'Bank Reconciliation', description: 'Reconcile bank to books',            color: 'sky',    ready: true,  component: BankReconciliationReport },
        { id: 'aje',                 icon: 'ph-notebook',               title: 'Journal Entries',     description: 'AJE, RJE, closing entries',          color: 'rose',   ready: true,  component: AJEReport },
        { id: 'gst-report',          icon: 'ph-percent',                title: 'GST/HST Report',      description: 'Tax collected vs paid',              color: 'red',    ready: true,  component: GSTReport },
        { id: 'general-ledger',      icon: 'ph-list-bullets',           title: 'General Ledger',      description: 'Account-specific history',           color: 'indigo', ready: true,  component: GeneralLedgerReport },
        { id: 'general-journal',     icon: 'ph-book',                   title: 'General Journal',     description: 'Transaction log',                    color: 'purple', ready: true,  component: GeneralJournalReport },
        { id: 'coa-summary',         icon: 'ph-chart-bar',              title: 'COA Summary',         description: 'Category breakdown',                 color: 'orange', ready: true,  component: COASummaryReport },
        { id: 'financial-ratios',    icon: 'ph-chart-line',             title: 'Financial Ratios',    description: 'Key metrics',                        color: 'violet', ready: true,  component: FinancialRatiosReport },
        { id: 'casaware-export',     icon: 'ph-export',                 title: 'CaseWare Export',     description: 'Full working paper package',          color: 'slate',  ready: true,  component: CaseWareExport },
    ];

    const colorMap = {
        blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   icon: 'text-blue-600',   hover: 'hover:bg-blue-100'   },
        green:  { bg: 'bg-green-50',  border: 'border-green-200',  icon: 'text-green-600',  hover: 'hover:bg-green-100'  },
        red:    { bg: 'bg-red-50',    border: 'border-red-200',    icon: 'text-red-600',    hover: 'hover:bg-red-100'    },
        cyan:   { bg: 'bg-cyan-50',   border: 'border-cyan-200',   icon: 'text-cyan-600',   hover: 'hover:bg-cyan-100'   },
        teal:   { bg: 'bg-teal-50',   border: 'border-teal-200',   icon: 'text-teal-600',   hover: 'hover:bg-teal-100'   },
        indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'text-indigo-600', hover: 'hover:bg-indigo-100' },
        purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', hover: 'hover:bg-purple-100' },
        orange: { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-600', hover: 'hover:bg-orange-100' },
        violet: { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'text-violet-600', hover: 'hover:bg-violet-100' },
        amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  icon: 'text-amber-600',  hover: 'hover:bg-amber-100'  },
        sky:    { bg: 'bg-sky-50',    border: 'border-sky-200',    icon: 'text-sky-600',    hover: 'hover:bg-sky-100'    },
        rose:   { bg: 'bg-rose-50',   border: 'border-rose-200',   icon: 'text-rose-600',   hover: 'hover:bg-rose-100'   },
        slate:  { bg: 'bg-slate-50',  border: 'border-slate-200',  icon: 'text-slate-600',  hover: 'hover:bg-slate-100'  },
    };

    // Expose global back-to-hub function for sub-reports
    React.useEffect(() => {
        window.__reportsGoBack = () => setSelectedReport(null);
        return () => { delete window.__reportsGoBack; };
    }, []);

    // ─── File import handlers ─────────────────────────────────────────────────
    const handleImportFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportError('');
        setImportPreview(null);
        const isPDF = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
        if (isPDF) {
            setImportParsing(true);
            try {
                const buf = await file.arrayBuffer();
                const parsed = await parseTBPdf(buf);
                if (!parsed) setImportError('Could not extract account data from the PDF. Please use a QuickBooks or Caseware Trial Balance printout with visible columns.');
                else setImportPreview(parsed);
            } catch (err) {
                setImportError(`PDF extraction failed: ${err.message}`);
            } finally {
                setImportParsing(false);
            }
        } else {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const parsed = parseTBCsv(ev.target.result);
                if (!parsed) setImportError('Could not parse the file. Expected CSV with Account/Code, Debit, Credit, Balance columns.');
                else setImportPreview(parsed);
            };
            reader.readAsText(file);
        }
    };

    const handleConfirm = () => {
        if (!importPreview) return;
        const map = {};
        Object.entries(importPreview).forEach(([code, row]) => { map[code] = row.balance; });
        setOpeningBalances(map);
        setOBState(map);
        setImportPreview(null);
        setShowImport(false);
        if (fileRef.current) fileRef.current.value = '';
    };

    const handleClear = () => {
        setOpeningBalances({});
        setOBState({});
    };

    // ─── Render selected sub-report ───────────────────────────────────────────
    const selectedReportData = reports.find(r => r.id === selectedReport);
    if (selectedReportData?.ready && selectedReportData.component) {
        const ReportComponent = selectedReportData.component;
        return <ReportComponent />;
    }

    const obEntries = Object.entries(openingBalances);
    const hasOB = obEntries.length > 0;
    const filteredOB = obFilter
        ? obEntries.filter(([code, bal]) => {
            const allCOA = window.RoboLedger?.COA?.getAll?.() || [];
            const acct = allCOA.find(a => String(a.code) === code);
            const name = acct?.name || '';
            return code.includes(obFilter) || name.toLowerCase().includes(obFilter.toLowerCase());
          })
        : obEntries;

    // Totals for imported TB summary
    const obTotalDebit  = obEntries.reduce((s, [, bal]) => s + (bal > 0 ? bal : 0), 0);
    const obTotalCredit = obEntries.reduce((s, [, bal]) => s + (bal < 0 ? Math.abs(bal) : 0), 0);

    return (
        <div className="h-full flex flex-col bg-gray-50 overflow-hidden">

            {/* ── Page header — consistent with sub-report headers ────────────── */}
            <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0">
                <i className="ph ph-chart-pie-slice text-lg text-blue-600"></i>
                <div>
                    <h1 className="text-sm font-bold text-gray-800 leading-tight">Financial Reports</h1>
                    <p className="text-[10px] text-gray-400 leading-tight">Professional accounting reports — Caseware standard</p>
                </div>
                <div className="ml-auto">
                    <button
                        onClick={() => { setShowImport(true); setImportPreview(null); setImportError(''); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                            hasOB
                                ? 'bg-purple-600 border-purple-700 text-white hover:bg-purple-700'
                                : 'bg-white border-purple-300 text-purple-700 hover:bg-purple-50'
                        }`}
                    >
                        <i className="ph ph-arrow-square-in text-sm"></i>
                        {hasOB ? `Prior Year · ${obEntries.length} accounts` : 'Import Prior Year'}
                    </button>
                </div>
            </div>

            {/* ── Scrollable body ─────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-6 py-6">

            {/* ── Report cards grid ──────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {reports.map(report => {
                    const colors = colorMap[report.color];
                    return (
                        <button
                            key={report.id}
                            onClick={() => report.ready ? setSelectedReport(report.id) : null}
                            className={`${colors.bg} ${colors.border} ${report.ready ? colors.hover + ' cursor-pointer' : 'cursor-not-allowed opacity-50'} border-2 rounded-xl p-5 text-left transition-all duration-200 ${report.ready ? 'hover:shadow-md hover:scale-[1.02]' : ''} relative`}
                        >
                            {!report.ready && (
                                <div className="absolute top-3 right-3 bg-gray-400 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                                    SOON
                                </div>
                            )}
                            <div className="flex flex-col gap-3">
                                <div className={`${colors.icon} text-3xl`}>
                                    <i className={`ph ${report.icon}`}></i>
                                </div>
                                <div>
                                    <h3 className="text-[14px] font-bold text-gray-900 mb-0.5">{report.title}</h3>
                                    <p className="text-[11px] text-gray-500">{report.description}</p>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ── Prior Year · Imported Trial Balance section ────────────────── */}
            {hasOB && (
                <div>
                    <div className="bg-white border border-purple-200 rounded-xl shadow-sm overflow-hidden">
                        {/* Section header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-purple-100 bg-purple-50">
                            <div className="flex items-center gap-3">
                                <i className="ph ph-clock-counter-clockwise text-purple-600 text-xl"></i>
                                <div>
                                    <h2 className="text-[14px] font-bold text-purple-900">Prior Year · Imported Trial Balance</h2>
                                    <p className="text-[11px] text-purple-500">{obEntries.length} accounts imported — used as comparative column in Trial Balance &amp; Income Statement</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => { setShowImport(true); setImportPreview(null); setImportError(''); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-purple-700 bg-white border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors"
                                >
                                    <i className="ph ph-arrow-square-in text-[12px]"></i>
                                    Replace
                                </button>
                                <button
                                    onClick={handleClear}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                    <i className="ph ph-trash text-[12px]"></i>
                                    Clear
                                </button>
                            </div>
                        </div>

                        {/* Summary KPIs */}
                        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
                            <div className="px-6 py-3 text-center">
                                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Accounts</p>
                                <p className="text-[18px] font-bold text-gray-800">{obEntries.length}</p>
                            </div>
                            <div className="px-6 py-3 text-center">
                                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Total Debits</p>
                                <p className="text-[18px] font-bold text-blue-700">{fmt(obTotalDebit)}</p>
                            </div>
                            <div className="px-6 py-3 text-center">
                                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Total Credits</p>
                                <p className="text-[18px] font-bold text-indigo-700">{fmt(obTotalCredit)}</p>
                            </div>
                        </div>

                        {/* Search + table */}
                        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3">
                            <i className="ph ph-magnifying-glass text-gray-400 text-[13px]"></i>
                            <input
                                type="text"
                                placeholder="Filter by code or account name…"
                                value={obFilter}
                                onChange={e => setObFilter(e.target.value)}
                                className="text-[12px] flex-1 outline-none text-gray-700 placeholder-gray-300"
                            />
                            {obFilter && (
                                <button onClick={() => setObFilter('')} className="text-gray-300 hover:text-gray-500">
                                    <i className="ph ph-x text-[11px]"></i>
                                </button>
                            )}
                        </div>

                        <div className="overflow-auto max-h-[400px]">
                            <table className="w-full text-[12px]">
                                <thead className="bg-gray-50 sticky top-0 z-10">
                                    <tr>
                                        <th className="text-left px-5 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide w-[90px]">Code</th>
                                        <th className="text-left px-5 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Account Name</th>
                                        <th className="text-right px-5 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide w-[140px]">Balance (Prior Yr)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredOB.map(([code, bal]) => {
                                        const allCOA = window.RoboLedger?.COA?.getAll?.() || [];
                                        const acct = allCOA.find(a => String(a.code) === code);
                                        return (
                                            <tr key={code} className="border-t border-gray-50 hover:bg-gray-50/70">
                                                <td className="px-5 py-2 font-mono text-gray-500">{code}</td>
                                                <td className="px-5 py-2 text-gray-800">{acct?.name || <span className="text-gray-400 italic">Unknown account</span>}</td>
                                                <td className={`px-5 py-2 text-right font-mono font-semibold tabular-nums ${bal > 0 ? 'text-blue-700' : bal < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                    {fmt(bal)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredOB.length === 0 && (
                                        <tr><td colSpan={3} className="px-5 py-6 text-center text-[11px] text-gray-400">No accounts match "{obFilter}"</td></tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-gray-50 border-t-2 border-gray-200 sticky bottom-0">
                                    <tr>
                                        <td colSpan={2} className="px-5 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                                            {obFilter ? `${filteredOB.length} of ${obEntries.length} accounts` : `Total — ${obEntries.length} accounts`}
                                        </td>
                                        <td className="px-5 py-2.5 text-right font-mono font-bold text-[12px] text-gray-700">
                                            {fmt(filteredOB.reduce((s, [, b]) => s + b, 0))}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

                </div>{/* /max-w-5xl */}
            </div>{/* /scroll body */}

            {/* ── Import modal ───────────────────────────────────────────────── */}
            {showImport && (
                <div
                    className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-6"
                    onClick={(e) => { if (e.target === e.currentTarget) { setShowImport(false); setImportPreview(null); setImportError(''); } }}
                >
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <div>
                                <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                                    <i className="ph ph-arrow-square-in text-purple-600"></i>
                                    Import Prior Year Trial Balance
                                </h2>
                                <p className="text-[11px] text-gray-400 mt-0.5">CSV or PDF from QuickBooks or Caseware</p>
                            </div>
                            <button onClick={() => { setShowImport(false); setImportPreview(null); setImportError(''); if (fileRef.current) fileRef.current.value = ''; }} className="text-gray-400 hover:text-gray-700">
                                <i className="ph ph-x text-xl"></i>
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            {/* File drop zone — only shown before preview */}
                            {!importPreview && (
                                <div
                                    className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 transition-all"
                                    onClick={() => !importParsing && fileRef.current?.click()}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const file = e.dataTransfer.files?.[0];
                                        if (file && fileRef.current) {
                                            const dt = new DataTransfer();
                                            dt.items.add(file);
                                            fileRef.current.files = dt.files;
                                            handleImportFile({ target: fileRef.current });
                                        }
                                    }}
                                >
                                    {importParsing ? (
                                        <div className="flex flex-col items-center gap-3">
                                            <i className="ph ph-spinner-gap animate-spin text-4xl text-purple-500"></i>
                                            <p className="text-[13px] text-purple-600 font-semibold">Extracting data from PDF…</p>
                                            <p className="text-[11px] text-gray-400">This may take a few seconds</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="flex items-center gap-4">
                                                <i className="ph ph-file-csv text-5xl text-green-500"></i>
                                                <span className="text-2xl text-gray-200 font-light">|</span>
                                                <i className="ph ph-file-pdf text-5xl text-red-400"></i>
                                            </div>
                                            <p className="text-[14px] font-semibold text-gray-700">Drop file here or click to upload</p>
                                            <p className="text-[11px] text-gray-400">QuickBooks or Caseware Trial Balance export (.csv, .pdf)</p>
                                        </div>
                                    )}
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept=".csv,.txt,.tsv,.pdf"
                                        className="hidden"
                                        onChange={handleImportFile}
                                    />
                                </div>
                            )}

                            {importError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700 flex items-start gap-2">
                                    <i className="ph ph-warning-circle mt-0.5 shrink-0"></i>
                                    <span>{importError}</span>
                                </div>
                            )}

                            {/* Preview table */}
                            {importPreview && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[12px] font-semibold text-gray-700 flex items-center gap-1.5">
                                            <i className="ph ph-check-circle text-green-500"></i>
                                            {Object.keys(importPreview).length} accounts matched
                                        </p>
                                        <button
                                            onClick={() => { setImportPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                                            className="text-[11px] text-gray-400 hover:text-gray-700 flex items-center gap-1"
                                        >
                                            <i className="ph ph-arrow-u-up-left text-[11px]"></i>
                                            Choose different file
                                        </button>
                                    </div>
                                    <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[260px] overflow-y-auto">
                                        <table className="w-full text-[11px]">
                                            <thead className="bg-gray-50 sticky top-0">
                                                <tr>
                                                    <th className="text-left px-3 py-2 font-semibold text-gray-500 w-[70px]">Code</th>
                                                    <th className="text-left px-3 py-2 font-semibold text-gray-500">Account</th>
                                                    <th className="text-right px-3 py-2 font-semibold text-gray-500 w-[110px]">Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(importPreview).map(([code, row]) => (
                                                    <tr key={code} className="border-t border-gray-100 hover:bg-gray-50">
                                                        <td className="px-3 py-1.5 font-mono text-gray-500">{code}</td>
                                                        <td className="px-3 py-1.5 text-gray-800">{row.name}</td>
                                                        <td className={`px-3 py-1.5 text-right font-mono font-semibold ${row.balance > 0 ? 'text-blue-700' : row.balance < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                            {fmt(row.balance)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
                            <button
                                onClick={() => { setShowImport(false); setImportPreview(null); setImportError(''); if (fileRef.current) fileRef.current.value = ''; }}
                                className="px-4 py-2 text-[12px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                            >
                                Cancel
                            </button>
                            {importPreview && (
                                <button
                                    onClick={handleConfirm}
                                    className="px-4 py-2 text-[12px] font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-1.5"
                                >
                                    <i className="ph ph-check-circle"></i>
                                    Import {Object.keys(importPreview).length} Accounts
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReportsPage;
