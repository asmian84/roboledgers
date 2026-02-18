import React, { useState, useRef } from 'react';
import ReportGenerator from '../services/ReportGenerator.js';
import ReportFilters from './components/ReportFilters.jsx';

/**
 * TrialBalanceReport - Multiple view modes inspired by Caseware Working Papers
 *
 * Views:
 *   1. Leadsheet   — Grouped by Caseware leadsheet (L/S) codes with subtotals
 *   2. Account      — Flat list sorted by account number (classic TB)
 *   3. Type         — Grouped by account type (Asset, Liability, Equity, Revenue, Expense)
 *
 * Features:
 *   - Opening balances import (QB / Caseware TB CSV) → comparative "Prior Year" column
 *   - Equity / Retained Earnings synthesised from opening balances + net income
 */

// ─── Opening Balances store (session-level, keyed by COA code string) ────────
// window.RoboLedger._tbOpeningBalances = { '3999': 125000, '3000': 50000, ... }
function getOpeningBalances() {
    return window.RoboLedger?._tbOpeningBalances || {};
}
function setOpeningBalances(map) {
    if (!window.RoboLedger) window.RoboLedger = {};
    window.RoboLedger._tbOpeningBalances = map;
}

// ─── QB / Caseware CSV parser ─────────────────────────────────────────────────
/**
 * Parses a Trial Balance CSV exported from QuickBooks or Caseware.
 *
 * QuickBooks format (comma-separated):
 *   Account, Debit, Credit, Balance
 *   1040 Savings account #2, 398094.65, 0.00, 398094.65
 *
 * Caseware format (tab or comma-separated):
 *   Ref No, Account Description, Debit, Credit, Balance
 *   1040, Savings account #2, 398094.65, , 398094.65
 *
 * Returns: { [coaCode]: { name, debit, credit, balance } }
 */
function parseTBCsv(csvText) {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return null;

    // Detect delimiter
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';

    // Parse header to find column indices
    const headers = firstLine.split(delimiter).map(h => h.replace(/"/g, '').trim().toLowerCase());

    const codeIdx    = headers.findIndex(h => /^(code|account\s*code|ref|ref\s*no|number|acct)$/i.test(h));
    const nameIdx    = headers.findIndex(h => /^(account|account\s*name|description|name|account\s*description)$/i.test(h));
    const debitIdx   = headers.findIndex(h => /^(debit|dr)$/i.test(h));
    const creditIdx  = headers.findIndex(h => /^(credit|cr)$/i.test(h));
    const balanceIdx = headers.findIndex(h => /^(balance|net|closing)$/i.test(h));

    // Fall back: QB sometimes merges code into account name like "1040 Savings account #2"
    const hasExplicitCode = codeIdx >= 0;

    const result = {};
    const allCOA = window.RoboLedger?.COA?.getAll?.() || [];

    for (let i = 1; i < lines.length; i++) {
        const parts = splitCsvLine(lines[i], delimiter);
        if (parts.length < 2) continue;

        const rawName = nameIdx >= 0 ? parts[nameIdx]?.replace(/"/g, '').trim() : parts[0]?.replace(/"/g, '').trim();
        if (!rawName) continue;

        // Skip header-like rows
        if (/^(total|grand\s*total|subtotal|net\s*income|retained|opening)/i.test(rawName)) continue;

        let code = '';
        let name = rawName;

        if (hasExplicitCode && parts[codeIdx]) {
            code = parts[codeIdx].replace(/"/g, '').trim();
        } else {
            // QB format: "1040 Savings account #2" — extract leading numeric code
            const m = rawName.match(/^(\d{3,5})\s+(.+)$/);
            if (m) { code = m[1]; name = m[2]; }
        }

        // Try to match to COA by code first, then by name fuzzy
        let matchedCode = code;
        if (!matchedCode || !allCOA.find(a => String(a.code) === matchedCode)) {
            const nameLower = name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const byName = allCOA.find(a => {
                const aName = a.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                return aName === nameLower || aName.startsWith(nameLower) || nameLower.startsWith(aName);
            });
            if (byName) matchedCode = String(byName.code);
        }

        if (!matchedCode) continue;

        const parseAmt = (v) => {
            if (!v) return 0;
            const s = String(v).replace(/"/g, '').replace(/[$, ]/g, '').trim();
            if (!s || s === '-' || s === '—') return 0;
            return parseFloat(s) || 0;
        };

        const debit   = debitIdx   >= 0 ? parseAmt(parts[debitIdx])   : 0;
        const credit  = creditIdx  >= 0 ? parseAmt(parts[creditIdx])  : 0;
        const balance = balanceIdx >= 0 ? parseAmt(parts[balanceIdx]) : (debit - credit);

        result[matchedCode] = { name, debit, credit, balance };
    }

    return Object.keys(result).length > 0 ? result : null;
}

function splitCsvLine(line, delimiter) {
    if (delimiter !== ',') return line.split(delimiter);
    // Handle quoted commas in CSV
    const result = [];
    let inQuote = false, cur = '';
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { inQuote = !inQuote; }
        else if (c === ',' && !inQuote) { result.push(cur); cur = ''; }
        else { cur += c; }
    }
    result.push(cur);
    return result;
}

// ─── PDF Trial Balance parser ─────────────────────────────────────────────────
/**
 * Extracts text from a Caseware Working Papers or QuickBooks TB PDF printout.
 *
 * CASEWARE WORKING PAPERS TB FORMAT (from real printouts):
 * ──────────────────────────────────────────────────────────
 * Page header: company name, "Trial Balance", period, "Prepared by / Date"
 *
 * Column header row (right-aligned labels over numeric columns):
 *   [blank]                         Debit        Credit       Balance
 *
 * Data rows — two common layouts:
 *   A) Code LEFT + Name RIGHT of code + numbers right-aligned in columns
 *      "  1040   Bank - chequing                  398,094.65               398,094.65"
 *
 *   B) Name only (no code) + single net balance column (simpler CW exports)
 *      "  Bank - chequing                                                  398,094.65"
 *
 * Section headers (group rows, no numbers):
 *   "  ASSETS"  or  "  Current Assets"  (bold, no numbers on that line)
 *
 * Subtotal rows:
 *   "  Total Current Assets                    xxx,xxx.xx               xxx,xxx.xx"
 *   "  Total Assets                            xxx,xxx.xx               xxx,xxx.xx"
 *
 * Sign convention:
 *   - Caseware uses PARENTHESES for negative amounts: (125,000.00)
 *   - Some versions use a trailing minus:  125,000.00-
 *   - Credits on liability/equity/revenue accounts are shown as positive Balance
 *
 * QUICKBOOKS ONLINE TB PDF:
 *   Company name, "Trial Balance", "As of DATE"
 *   Column headers: DEBIT  CREDIT  (no Balance column — balance is implied)
 *   OR: single TOTAL column
 *
 * Strategy:
 *   1. Extract all text items with (x, y) coordinates from every page
 *   2. Group by y-position into "lines" (3pt bucket tolerance for sub-pixels)
 *   3. Find the column header line → record exact x-positions of Debit/Credit/Balance
 *   4. For each data row: bucket items into left-side (code+name) vs numeric columns
 *   5. Parse amounts — handle parentheses, trailing minus, commas, dollar signs
 *   6. Match to COA by code (exact) then by name (fuzzy)
 *   7. Fallback: reconstruct as plain text → feed to parseTBCsv
 */
async function parseTBPdf(arrayBuffer) {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error('PDF.js not available');

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // ── Step 1: Extract all text items with coordinates, all pages ────────────
    const allLines = []; // Each entry: Array<{ x, y, text, width }>

    for (let p = 1; p <= pdf.numPages; p++) {
        const page    = await pdf.getPage(p);
        const content = await page.getTextContent();
        const vp      = page.getViewport({ scale: 1.0 });

        // Bucket items into lines by y-position (3pt tolerance handles sub-pixel variations)
        const lineMap = {};
        content.items.forEach(item => {
            if (!item.str?.trim()) return;
            const rawY = item.transform[5];
            const x    = item.transform[4];
            // Round to nearest 3pt bucket
            const yKey = Math.round(rawY / 3) * 3;
            if (!lineMap[yKey]) lineMap[yKey] = [];
            lineMap[yKey].push({
                x,
                y:    rawY,
                text: item.str,
                w:    item.width || 0,
            });
        });

        // Sort lines top-to-bottom (PDF y=0 is bottom, so descending = top-first)
        const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
        sortedYs.forEach(yKey => {
            const items = lineMap[yKey].sort((a, b) => a.x - b.x);
            allLines.push(items);
        });
    }

    // ── Step 2: Find the column header line ───────────────────────────────────
    // Caseware:   [blank]            Debit        Credit       Balance
    // QB Online:  [blank]            Debit        Credit
    // QB Desktop: [blank]            Debit        Credit       Balance
    // Some CW:    Ref No  Account Description    Debit  Credit  Balance

    let debitX = null, creditX = null, balanceX = null;
    let headerLineIdx = -1;

    for (let i = 0; i < allLines.length; i++) {
        const line  = allLines[i];
        const texts = line.map(item => item.text.trim().toUpperCase());
        const joined = texts.join(' ');

        // Look for a line that contains at least DEBIT and CREDIT (case-insensitive)
        if (/\bDEBIT\b/.test(joined) && /\bCREDIT\b/.test(joined)) {
            const debitItem  = line.find(item => /^DEBIT$/i.test(item.text.trim()));
            const creditItem = line.find(item => /^CREDIT$/i.test(item.text.trim()));
            const balItem    = line.find(item => /^BALANCE$/i.test(item.text.trim()));

            if (debitItem && creditItem) {
                // For right-aligned column headers the x is the left edge of the text —
                // the actual column right edge = x + width. Use the right edge as anchor.
                debitX  = debitItem.x  + (debitItem.w  || 0);
                creditX = creditItem.x + (creditItem.w || 0);
                balanceX = balItem ? (balItem.x + (balItem.w || 0)) : creditX + 90;
                headerLineIdx = i;
                break;
            }
        }
    }

    // ── Step 3: If no explicit header found, try plain-text reconstruction ────
    if (debitX === null) {
        const textLines = allLines
            .map(line => line.map(i => i.text).filter(t => t.trim()).join('  '))
            .filter(l => l.trim());
        return parseTBCsv(textLines.join('\n'));
    }

    // ── Step 4: Define column x-boundaries ───────────────────────────────────
    // Each numeric column spans roughly 80–100 pts wide, right-aligned.
    // We define a "slot" as [rightEdge - slotWidth, rightEdge].
    const SLOT_W  = 100; // pts — wide enough to catch all digits
    const NAME_MAX = debitX - SLOT_W - 10; // everything left of here = code/name region

    const inDebitSlot   = (x) => x > (debitX  - SLOT_W) && x <= (debitX  + 20);
    const inCreditSlot  = (x) => x > (creditX - SLOT_W) && x <= (creditX + 20);
    const inBalanceSlot = (x) => x > (balanceX - SLOT_W) && x <= (balanceX + 20);
    const inNameRegion  = (x) => x < NAME_MAX;

    // ── Step 5: Amount parser — handles parentheses, trailing minus, commas ──
    const parseAmt = (v) => {
        if (!v) return null;
        let s = String(v).replace(/[$\s,]/g, '').trim();
        if (!s || s === '-' || s === '—' || s === '') return null;
        // Parentheses = negative: (125000.00) → -125000.00
        const isNeg = s.startsWith('(') && s.endsWith(')');
        const hasTrailingMinus = s.endsWith('-');
        s = s.replace(/[()]/g, '').replace(/-$/, '');
        const n = parseFloat(s);
        if (isNaN(n)) return null;
        return isNeg || hasTrailingMinus ? -n : n;
    };

    // ── Step 6: Lines to skip (headers, totals, section labels, page noise) ──
    const isSkipLine = (joined) => {
        if (!joined.trim()) return true;
        // Pure section headers (ASSETS, LIABILITIES, etc.) — no numbers on the line
        if (/^(assets?|liabilit|equity|revenue|income|expense|cost\s+of|total\s+|subtotal|grand\s*total|net\s*income|net\s*loss|retained earn|opening|closing|prepared\s*by|partner|working\s*paper|trial\s*balance|balance\s*sheet|income\s*statement|period\s*end|as\s*of\s*|page\s*\d)/i.test(joined.trim())) return true;
        // Column header row
        if (/\bDEBIT\b.*\bCREDIT\b/i.test(joined)) return true;
        return false;
    };

    // ── Step 7: Parse data rows ───────────────────────────────────────────────
    const result = {};
    const allCOA = window.RoboLedger?.COA?.getAll?.() || [];

    for (let i = 0; i < allLines.length; i++) {
        if (i <= headerLineIdx) continue; // skip everything above/including header

        const line  = allLines[i];
        const joined = line.map(item => item.text).join(' ').trim();
        if (isSkipLine(joined)) continue;

        // Collect items by column region
        const nameItems   = line.filter(item => inNameRegion(item.x));
        const debitItems  = line.filter(item => inDebitSlot(item.x));
        const creditItems = line.filter(item => inCreditSlot(item.x));
        const balItems    = line.filter(item => inBalanceSlot(item.x));

        const leftText = nameItems.map(i => i.text).join(' ').trim();
        if (!leftText) continue;

        // Skip pure section/group headers (lines with no numeric content at all)
        const hasAnyNumber = debitItems.length > 0 || creditItems.length > 0 || balItems.length > 0;
        if (!hasAnyNumber) continue;

        // Extract code + name from left region
        // Caseware: code is a separate left-most item, name is next items
        // Sometimes code is embedded: "1040  Bank - chequing"
        let code = '', name = leftText;

        // If leftText starts with a 4-digit code
        const codePrefixMatch = leftText.match(/^(\d{3,5})\s{2,}(.+)$/);
        if (codePrefixMatch) {
            code = codePrefixMatch[1];
            name = codePrefixMatch[2].trim();
        } else if (nameItems.length >= 2) {
            // First item might be the code (pure numeric)
            const firstItem = nameItems[0].text.trim();
            if (/^\d{3,5}$/.test(firstItem)) {
                code = firstItem;
                name = nameItems.slice(1).map(i => i.text).join(' ').trim();
            }
        }

        // Parse amounts — join multi-item cells (e.g. "$" and "398,094.65" as separate PDF items)
        const debitStr  = debitItems.map(i => i.text).join('').trim();
        const creditStr = creditItems.map(i => i.text).join('').trim();
        const balStr    = balItems.map(i => i.text).join('').trim();

        const debit   = parseAmt(debitStr)  ?? 0;
        const credit  = parseAmt(creditStr) ?? 0;
        const balance = parseAmt(balStr);

        // Derived balance if not present
        const finalBalance = balance !== null ? balance : (debit - credit);

        // Skip rows that appear to be zero-everything (likely blank or noise)
        if (debit === 0 && credit === 0 && finalBalance === 0 && !code) continue;

        // COA matching: code exact → code fuzzy → name fuzzy
        let matchedCode = '';

        if (code) {
            // Exact code match
            if (allCOA.find(a => String(a.code) === code)) {
                matchedCode = code;
            }
        }

        if (!matchedCode) {
            // Name fuzzy match
            const nameLower = name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const byName = allCOA.find(a => {
                const aName = a.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                return aName === nameLower
                    || (nameLower.length > 5 && aName.startsWith(nameLower.slice(0, 8)))
                    || (nameLower.length > 5 && nameLower.startsWith(aName.slice(0, 8)));
            });
            if (byName) matchedCode = String(byName.code);
        }

        if (!matchedCode && code) {
            // Keep unmatched codes anyway — user may have custom COA
            matchedCode = code;
        }

        if (!matchedCode) continue;

        // Deduplicate: if we already have this code, accumulate (handles multi-page runs)
        if (result[matchedCode]) {
            result[matchedCode].debit  += debit;
            result[matchedCode].credit += credit;
            result[matchedCode].balance = result[matchedCode].debit - result[matchedCode].credit;
        } else {
            result[matchedCode] = { name, debit, credit, balance: finalBalance };
        }
    }

    if (Object.keys(result).length > 0) return result;

    // ── Fallback: plain-text reconstruction → CSV parser ─────────────────────
    const textLines = allLines
        .map(line => line.map(i => i.text).filter(t => t.trim()).join('  '))
        .filter(l => l.trim());
    return parseTBCsv(textLines.join('\n'));
}

// ─── Main component ───────────────────────────────────────────────────────────
export function TrialBalanceReport() {
    const [reportData, setReportData]           = useState(null);
    const [dateRange, setDateRange]             = useState(null);
    const [loading, setLoading]                 = useState(false);
    const [viewMode, setViewMode]               = useState('leadsheet'); // 'leadsheet' | 'account' | 'type'
    const [collapsedGroups, setCollapsedGroups] = useState(new Set());
    // Opening balances (comparative prior-year column)
    const [openingBalances, setOpeningBalancesState] = useState(getOpeningBalances());
    const [showImport, setShowImport]           = useState(false);
    const [importError, setImportError]         = useState('');
    const [importPreview, setImportPreview]     = useState(null); // parsed result before committing
    const [importParsing, setImportParsing]     = useState(false); // PDF extraction in progress
    const fileRef = useRef(null);

    const generateReport = (range) => {
        if (!range?.start || !range?.end) return;
        setLoading(true);
        try {
            const generator = new ReportGenerator(
                window.RoboLedger.Ledger,
                window.RoboLedger.COA
            );
            const data = generator.generateTrialBalance(range.start, range.end);
            setReportData(data);
            setDateRange(range);
            setCollapsedGroups(new Set());
        } catch (error) {
            console.error('[TRIAL_BALANCE] Generation failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const fmt = (amount) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
    const fmtAbs = (amount) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(amount));

    // ─── Synthesise equity rows from opening balances ────────────────────────
    // Equity accounts (3xxx) don't appear in the transaction stream — they are
    // seeded by the opening balances import.  We inject them as synthetic rows
    // so they show up in the TB alongside operating accounts.
    const getAccountsWithEquity = (baseAccounts) => {
        const ob = openingBalances;
        const allCOA = window.RoboLedger?.COA?.getAll?.() || [];
        const existingCodes = new Set(baseAccounts.map(a => String(a.code)));
        const extra = [];

        // 1. Inject any opening-balance COA account not already present
        allCOA.forEach(coaAcct => {
            const key = String(coaAcct.code);
            if (existingCodes.has(key)) return; // already has transactions
            if (ob[key] === undefined) return;   // no opening balance set
            const bal = ob[key]; // dollar amount
            extra.push({
                code: coaAcct.code,
                name: coaAcct.name,
                root: coaAcct.root || inferRoot(coaAcct.code),
                leadsheet: coaAcct.leadsheet || '',
                debit:  bal > 0 ? bal : 0,
                credit: bal < 0 ? Math.abs(bal) : 0,
                balance: bal,
                _fromOpening: true,
            });
        });

        // 2. Retained Earnings (3999) = opening RE + current-year net income
        //    Net income = sum of revenue credits - sum of expense debits
        const revTotal  = baseAccounts.filter(a => a.root === 'REVENUE')
                            .reduce((s, a) => s + (a.credit - a.debit), 0);
        const expTotal  = baseAccounts.filter(a => a.root === 'EXPENSE' || a.root === 'COGS')
                            .reduce((s, a) => s + (a.debit - a.credit), 0);
        const netIncome = revTotal - expTotal;

        const openingRE    = ob['3999'] || 0;
        const closingRE    = openingRE + netIncome;
        const reCode       = '3999';
        const reCoaAcct    = allCOA.find(a => String(a.code) === reCode);
        const reName       = reCoaAcct?.name || 'Retained earnings';

        if (!existingCodes.has(reCode)) {
            // Not in transactions — add synthetic RE row
            if (closingRE !== 0 || openingRE !== 0) {
                extra.push({
                    code: reCode,
                    name: reName,
                    root: 'EQUITY',
                    leadsheet: reCoaAcct?.leadsheet || 'TT',
                    debit:  closingRE < 0 ? Math.abs(closingRE) : 0,
                    credit: closingRE > 0 ? closingRE : 0,
                    balance: -closingRE, // Equity is credit-normal → negative balance = equity
                    _fromOpening: true,
                    _isRetainedEarnings: true,
                    _netIncome: netIncome,
                    _openingRE: openingRE,
                });
            }
        } else {
            // Already has transactions — annotate for tooltip display
            const reRow = baseAccounts.find(a => String(a.code) === reCode);
            if (reRow) {
                reRow._isRetainedEarnings = true;
                reRow._netIncome = netIncome;
                reRow._openingRE = openingRE;
            }
        }

        return [...baseAccounts, ...extra];
    };

    // ─── Grouping Logic ───────────────────────────────────────────────────────
    const getGroupedAccounts = () => {
        if (!reportData?.accounts) return [];
        const COA = window.RoboLedger?.COA;

        const allAccounts = getAccountsWithEquity(reportData.accounts);

        if (viewMode === 'account') {
            const sorted = [...allAccounts].sort((a, b) => String(a.code).localeCompare(String(b.code)));
            const td = sorted.reduce((s, a) => s + a.debit, 0);
            const tc = sorted.reduce((s, a) => s + a.credit, 0);
            return [{ code: 'ALL', name: 'All Accounts', accounts: sorted, totalDebit: td, totalCredit: tc }];
        }

        if (viewMode === 'type') {
            const typeOrder = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
            const typeNames = { ASSET: 'Assets', LIABILITY: 'Liabilities', EQUITY: 'Equity', REVENUE: 'Revenue', EXPENSE: 'Expenses' };
            const groups = {};
            allAccounts.forEach(acc => {
                const root = acc.root || COA?.inferRoot?.(acc.code) || 'EXPENSE';
                if (!groups[root]) groups[root] = { code: root, name: typeNames[root] || root, accounts: [], totalDebit: 0, totalCredit: 0 };
                groups[root].accounts.push(acc);
                groups[root].totalDebit  += acc.debit;
                groups[root].totalCredit += acc.credit;
            });
            return typeOrder.filter(t => groups[t]).map(t => {
                groups[t].accounts.sort((a, b) => String(a.code).localeCompare(String(b.code)));
                return groups[t];
            });
        }

        // Default: leadsheet
        const lsOrder = COA?.getLeadsheetOrder?.() || [];
        const groups = {};
        allAccounts.forEach(acc => {
            const ls = acc.leadsheet || COA?.getLeadsheet?.(acc.code) || '40';
            if (!groups[ls]) groups[ls] = { code: ls, name: COA?.getLeadsheetName?.(ls) || ls, accounts: [], totalDebit: 0, totalCredit: 0 };
            groups[ls].accounts.push(acc);
            groups[ls].totalDebit  += acc.debit;
            groups[ls].totalCredit += acc.credit;
        });
        const ordered = [];
        lsOrder.forEach(ls => { if (groups[ls]) { groups[ls].accounts.sort((a, b) => String(a.code).localeCompare(String(b.code))); ordered.push(groups[ls]); } });
        Object.keys(groups).forEach(ls => { if (!lsOrder.includes(ls)) { groups[ls].accounts.sort((a, b) => String(a.code).localeCompare(String(b.code))); ordered.push(groups[ls]); } });
        return ordered;
    };

    const isBalanceSheet = (lsCode) => !['20', '30', '40', '70', '80'].includes(lsCode);

    const toggleGroup = (code) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            next.has(code) ? next.delete(code) : next.add(code);
            return next;
        });
    };

    const collapseAll = () => {
        const groups = getGroupedAccounts();
        setCollapsedGroups(new Set(groups.map(g => g.code)));
    };

    const expandAll = () => setCollapsedGroups(new Set());

    // ─── Group Color Logic ────────────────────────────────────────────────────
    const getGroupColors = (code) => {
        if (viewMode === 'type') {
            const map = {
                ASSET: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-600', sub: 'bg-blue-50/50 border-blue-100' },
                LIABILITY: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-600', sub: 'bg-red-50/50 border-red-100' },
                EQUITY: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-600', sub: 'bg-purple-50/50 border-purple-100' },
                REVENUE: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-600', sub: 'bg-emerald-50/50 border-emerald-100' },
                EXPENSE: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-600', sub: 'bg-amber-50/50 border-amber-100' },
            };
            return map[code] || map.EXPENSE;
        }
        if (viewMode === 'account') {
            return { bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-600', sub: 'bg-gray-50/50 border-gray-100' };
        }
        return isBalanceSheet(code)
            ? { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-600', sub: 'bg-blue-50/50 border-blue-100' }
            : { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-600', sub: 'bg-emerald-50/50 border-emerald-100' };
    };

    // ─── CSV Export ───────────────────────────────────────────────────────────
    const exportCSV = () => {
        if (!reportData) return;
        const groups = getGroupedAccounts();
        const hasOB = Object.keys(openingBalances).length > 0;
        const rows = [['Group', 'Account Code', 'Account Name', ...(hasOB ? ['Prior Year'] : []), 'Debit', 'Credit', 'Balance']];
        groups.forEach(group => {
            if (viewMode !== 'account') rows.push([`[${group.code}] ${group.name}`, '', '', ...(hasOB ? [''] : []), '', '', '']);
            group.accounts.forEach(acc => {
                const ob = hasOB ? (openingBalances[String(acc.code)] ?? '') : undefined;
                rows.push([
                    viewMode === 'account' ? '' : '',
                    acc.code, acc.name,
                    ...(hasOB ? [ob !== '' ? ob.toFixed(2) : ''] : []),
                    acc.debit.toFixed(2), acc.credit.toFixed(2), acc.balance.toFixed(2)
                ]);
            });
            if (viewMode !== 'account') rows.push(['', '', `Subtotal: ${group.name}`, ...(hasOB ? [''] : []), group.totalDebit.toFixed(2), group.totalCredit.toFixed(2), (group.totalDebit - group.totalCredit).toFixed(2)]);
        });
        rows.push(['', '', 'GRAND TOTAL', ...(hasOB ? [''] : []), reportData.totals.debit.toFixed(2), reportData.totals.credit.toFixed(2), reportData.totals.balance.toFixed(2)]);
        const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trial-balance-${viewMode}-${dateRange.start}-to-${dateRange.end}.csv`;
        a.click();
    };

    // ─── Opening Balances Import handlers ────────────────────────────────────
    const handleImportFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportError('');
        setImportPreview(null);

        const isPDF = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

        if (isPDF) {
            // PDF path — async extraction via PDF.js
            setImportParsing(true);
            try {
                const arrayBuffer = await file.arrayBuffer();
                const parsed = await parseTBPdf(arrayBuffer);
                if (!parsed) {
                    setImportError('Could not extract account data from the PDF. Please ensure it is a QuickBooks or Caseware Trial Balance printout with clearly visible columns.');
                } else {
                    setImportPreview(parsed);
                }
            } catch (err) {
                setImportError(`PDF extraction failed: ${err.message}`);
            } finally {
                setImportParsing(false);
            }
        } else {
            // CSV / text path — synchronous
            const reader = new FileReader();
            reader.onload = (ev) => {
                const text = ev.target.result;
                const parsed = parseTBCsv(text);
                if (!parsed) {
                    setImportError('Could not parse the file. Please check the format — expected CSV with Account/Code, Debit, Credit, Balance columns.');
                    setImportPreview(null);
                } else {
                    setImportPreview(parsed);
                }
            };
            reader.readAsText(file);
        }
    };

    const handleImportConfirm = () => {
        if (!importPreview) return;
        // Convert to code→balance map
        const balanceMap = {};
        Object.entries(importPreview).forEach(([code, row]) => {
            balanceMap[code] = row.balance;
        });
        setOpeningBalances(balanceMap);
        setOpeningBalancesState(balanceMap);
        setImportPreview(null);
        setShowImport(false);
        // Re-generate report if we have a range
        if (dateRange) generateReport(dateRange);
    };

    const handleClearOpeningBalances = () => {
        setOpeningBalances({});
        setOpeningBalancesState({});
        if (dateRange) generateReport(dateRange);
    };

    const groups = reportData ? getGroupedAccounts() : [];
    const hasOB  = Object.keys(openingBalances).length > 0;

    // Column count depends on view mode + comparative column
    const baseColCount = viewMode === 'leadsheet' ? 4 : viewMode === 'type' ? 4 : 3;
    const numericCols  = hasOB ? 4 : 3; // Prior Year + Debit + Credit + Balance, or just 3
    const colCount     = baseColCount + numericCols;

    // ─── View Mode Labels ─────────────────────────────────────────────────────
    const viewModes = [
        { id: 'leadsheet', label: 'L/S',  title: 'Grouped by Leadsheet',    icon: 'ph-folders' },
        { id: 'account',   label: 'Acct', title: 'Flat by Account #',       icon: 'ph-list-numbers' },
        { id: 'type',      label: 'Type', title: 'Grouped by Account Type', icon: 'ph-stack' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <button onClick={() => window.__reportsGoBack?.()} className="text-gray-600 hover:text-gray-900 mr-2">
                        <i className="ph ph-arrow-left text-2xl"></i>
                    </button>
                    <i className="ph ph-scales text-3xl text-blue-600"></i>
                    <h1 className="text-3xl font-bold text-gray-900">Trial Balance</h1>
                </div>
                <p className="text-gray-600">Verify debits equal credits — multiple view modes</p>
            </div>

            {/* Filters */}
            <div className="max-w-7xl mx-auto">
                <ReportFilters onFilterChange={generateReport} />
            </div>

            {/* Loading */}
            {loading && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow p-12 text-center">
                    <i className="ph ph-spinner-gap animate-spin text-4xl text-blue-600 mb-4"></i>
                    <p className="text-gray-600">Generating report...</p>
                </div>
            )}

            {/* Empty state */}
            {!loading && !reportData && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow p-16 text-center">
                    <i className="ph ph-upload-simple text-6xl text-gray-200 mb-5 block"></i>
                    <p className="text-lg font-semibold text-gray-500 mb-1">Upload statements to get started</p>
                    <p className="text-sm text-gray-400 mb-6">Import your bank statements to generate this report</p>
                    <button
                        onClick={() => window.__reportsGoBack?.()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                        <i className="ph ph-arrow-left text-base"></i>
                        Back to Reports
                    </button>
                </div>
            )}

            {/* Report */}
            {!loading && reportData && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow">
                    {/* Report Header + View Tabs */}
                    <div className="border-b border-gray-200 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Trial Balance Report</h2>
                                <p className="text-[12px] text-gray-500 mt-0.5">
                                    Period: {dateRange.start} to {dateRange.end} — {reportData.accounts.length} accounts
                                    {viewMode !== 'account' && ` across ${groups.length} groups`}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Opening Balances indicator */}
                                {hasOB && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg text-[11px]">
                                        <i className="ph ph-arrow-square-in text-purple-600 text-[13px]"></i>
                                        <span className="text-purple-700 font-semibold">
                                            Prior Year: {Object.keys(openingBalances).length} accounts
                                        </span>
                                        <button
                                            onClick={handleClearOpeningBalances}
                                            className="ml-1 text-purple-400 hover:text-purple-700"
                                            title="Clear opening balances"
                                        >
                                            <i className="ph ph-x text-[10px]"></i>
                                        </button>
                                    </div>
                                )}
                                {/* Balance badge */}
                                <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-[13px] ${reportData.isBalanced ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                    <i className={`ph ${reportData.isBalanced ? 'ph-check-circle text-green-600' : 'ph-warning-circle text-red-600'} text-lg`}></i>
                                    <span className={`font-bold ${reportData.isBalanced ? 'text-green-800' : 'text-red-800'}`}>
                                        {reportData.isBalanced ? 'Balanced' : `Out of Balance: ${fmt(reportData.difference)}`}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* View mode tabs + collapse controls + import button */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                                {viewModes.map(v => (
                                    <button
                                        key={v.id}
                                        onClick={() => { setViewMode(v.id); setCollapsedGroups(new Set()); }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all ${viewMode === v.id
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                        title={v.title}
                                    >
                                        <i className={`ph ${v.icon} text-[13px]`}></i>
                                        <span>{v.label}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Import Prior Year / Opening Balances */}
                                <button
                                    onClick={() => setShowImport(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                                    title="Import opening balances from QuickBooks or Caseware CSV"
                                >
                                    <i className="ph ph-arrow-square-in text-[13px]"></i>
                                    Import Prior Year
                                </button>
                                {viewMode !== 'account' && (
                                    <div className="flex items-center gap-2">
                                        <button onClick={expandAll} className="text-[11px] text-gray-500 hover:text-blue-600 font-medium">Expand All</button>
                                        <span className="text-gray-300">|</span>
                                        <button onClick={collapseAll} className="text-[11px] text-gray-500 hover:text-blue-600 font-medium">Collapse All</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    {viewMode === 'leadsheet' && (
                                        <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[54px]">L/S</th>
                                    )}
                                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[80px]">Code</th>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Account Name</th>
                                    {viewMode === 'type' && (
                                        <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[80px]">Type</th>
                                    )}
                                    {/* Prior Year (comparative) column — only shown when opening balances imported */}
                                    {hasOB && (
                                        <th className="px-8 py-3 text-right text-[10px] font-bold text-purple-500 uppercase tracking-wider w-[150px]">
                                            Prior Year
                                        </th>
                                    )}
                                    <th className="px-8 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[160px]">Debit</th>
                                    <th className="px-8 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[160px]">Credit</th>
                                    <th className="px-8 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[160px]">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groups.map(group => {
                                    const colors = getGroupColors(group.code);
                                    const isCollapsed = collapsedGroups.has(group.code);

                                    return (
                                        <React.Fragment key={group.code}>
                                            {/* Group Header */}
                                            {viewMode !== 'account' && (
                                                <tr
                                                    className={`${colors.bg} border-t-2 ${colors.border} cursor-pointer select-none`}
                                                    onClick={() => toggleGroup(group.code)}
                                                >
                                                    <td className="px-4 py-2" colSpan={colCount}>
                                                        <div className="flex items-center gap-2.5">
                                                            <i className={`ph ${isCollapsed ? 'ph-caret-right' : 'ph-caret-down'} text-[11px] text-gray-500`}></i>
                                                            <span className={`inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide text-white ${colors.badge}`}>
                                                                {group.code}
                                                            </span>
                                                            <span className="text-[12px] font-semibold text-gray-800">{group.name}</span>
                                                            <span className="text-[10px] text-gray-400 ml-1">({group.accounts.length})</span>
                                                            {isCollapsed && (
                                                                <span className="ml-auto flex items-center gap-4 text-[11px] font-mono tabular-nums text-gray-600">
                                                                    <span>Dr {fmt(group.totalDebit)}</span>
                                                                    <span>Cr {fmt(group.totalCredit)}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}

                                            {/* Account Rows */}
                                            {!isCollapsed && group.accounts.map(acc => {
                                                const priorBal = hasOB ? (openingBalances[String(acc.code)] ?? null) : null;
                                                const movement = priorBal !== null ? (acc.balance - priorBal) : null;
                                                return (
                                                    <tr key={`${group.code}-${acc.code}`}
                                                        className={`hover:bg-gray-50/80 border-b border-gray-100 ${acc._fromOpening ? 'opacity-70 italic' : ''}`}
                                                        title={acc._isRetainedEarnings
                                                            ? `Retained Earnings: Opening ${fmt(acc._openingRE)} + Net Income ${fmt(acc._netIncome)} = ${fmt((acc._openingRE || 0) + (acc._netIncome || 0))}`
                                                            : acc._fromOpening ? 'From opening balances (no current-year transactions)' : ''}
                                                    >
                                                        {viewMode === 'leadsheet' && (
                                                            <td className="px-4 py-2 text-[10px] text-gray-300 font-mono"></td>
                                                        )}
                                                        <td className="px-4 py-2.5 text-[12px] font-mono text-gray-600 font-medium">
                                                            {acc.code}
                                                            {acc._isRetainedEarnings && <span className="ml-1 text-[9px] text-purple-400 font-sans not-italic">RE</span>}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-[12px] text-gray-800">
                                                            {acc.name}
                                                            {acc._isRetainedEarnings && (
                                                                <span className="ml-2 text-[10px] text-purple-500 not-italic font-normal">
                                                                    (Opening {fmt(acc._openingRE || 0)} + NI {fmt(acc._netIncome || 0)})
                                                                </span>
                                                            )}
                                                        </td>
                                                        {viewMode === 'type' && (
                                                            <td className="px-4 py-2.5 text-[10px] text-gray-400 uppercase font-medium">{(acc.root || '').slice(0, 5)}</td>
                                                        )}
                                                        {/* Prior Year column */}
                                                        {hasOB && (
                                                            <td className="px-8 py-2.5 text-[12px] text-right tabular-nums font-mono text-purple-600">
                                                                {priorBal !== null
                                                                    ? <span title={movement !== null ? `Movement: ${movement >= 0 ? '+' : ''}${fmt(movement)}` : ''}>
                                                                        {fmt(priorBal)}
                                                                      </span>
                                                                    : <span className="text-gray-300">—</span>
                                                                }
                                                            </td>
                                                        )}
                                                        <td className="px-8 py-2.5 text-[12px] text-right tabular-nums font-mono text-gray-700">
                                                            {acc.debit > 0 ? fmt(acc.debit) : ''}
                                                        </td>
                                                        <td className="px-8 py-2.5 text-[12px] text-right tabular-nums font-mono text-gray-700">
                                                            {acc.credit > 0 ? fmt(acc.credit) : ''}
                                                        </td>
                                                        <td className={`px-8 py-2.5 text-[12px] text-right tabular-nums font-mono font-semibold ${acc.balance > 0 ? 'text-blue-700' : acc.balance < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                            {acc.balance !== 0 ? fmt(acc.balance) : '—'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                            {/* Subtotal Row */}
                                            {viewMode !== 'account' && !isCollapsed && (
                                                <tr className={`${colors.sub} border-b-2`}>
                                                    <td className="px-4 py-2" colSpan={viewMode === 'leadsheet' ? 4 : viewMode === 'type' ? 4 : 3}>
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                                                            Subtotal — {group.code}
                                                        </span>
                                                    </td>
                                                    {hasOB && <td className="px-8 py-2"></td>}
                                                    <td className="px-8 py-2 text-[12px] text-right tabular-nums font-mono font-bold text-gray-800">
                                                        {group.totalDebit > 0 ? fmt(group.totalDebit) : ''}
                                                    </td>
                                                    <td className="px-8 py-2 text-[12px] text-right tabular-nums font-mono font-bold text-gray-800">
                                                        {group.totalCredit > 0 ? fmt(group.totalCredit) : ''}
                                                    </td>
                                                    <td className={`px-8 py-2 text-[12px] text-right tabular-nums font-mono font-bold ${(group.totalDebit - group.totalCredit) > 0 ? 'text-blue-700' : (group.totalDebit - group.totalCredit) < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                        {fmt(group.totalDebit - group.totalCredit)}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-gray-800 text-white">
                                <tr>
                                    <td colSpan={baseColCount} className="px-4 py-3.5 text-[12px] font-bold uppercase tracking-wide">
                                        Grand Total
                                    </td>
                                    {hasOB && <td className="px-8 py-3.5"></td>}
                                    <td className="px-8 py-3.5 text-[12px] text-right tabular-nums font-mono font-bold">{fmt(reportData.totals.debit)}</td>
                                    <td className="px-8 py-3.5 text-[12px] text-right tabular-nums font-mono font-bold">{fmt(reportData.totals.credit)}</td>
                                    <td className={`px-8 py-3.5 text-[12px] text-right tabular-nums font-mono font-bold ${reportData.isBalanced ? 'text-green-400' : 'text-red-400'}`}>
                                        {fmt(reportData.totals.balance)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Export Actions */}
                    <div className="border-t border-gray-200 p-5 flex items-center justify-between">
                        <div className="text-[11px] text-gray-400">
                            View: {viewModes.find(v => v.id === viewMode)?.title} — {reportData.accounts.length} accounts
                            {hasOB && ` · Prior Year: ${Object.keys(openingBalances).length} accounts`}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={exportCSV} className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-1.5 text-[12px]">
                                <i className="ph ph-download-simple text-[13px]"></i>Export CSV
                            </button>
                            <button onClick={() => window.print()} className="px-3.5 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold flex items-center gap-1.5 text-[12px]">
                                <i className="ph ph-printer text-[13px]"></i>Print
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Import Opening Balances Modal ─────────────────────────────── */}
            {showImport && (
                <div
                    className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-6"
                    onClick={(e) => { if (e.target === e.currentTarget) { setShowImport(false); setImportPreview(null); setImportError(''); } }}
                >
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <div>
                                <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                                    <i className="ph ph-arrow-square-in text-purple-600"></i>
                                    Import Opening Balances / Prior Year
                                </h2>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                    Import a Trial Balance <strong>CSV export</strong> or <strong>PDF printout</strong> from QuickBooks or Caseware to add a comparative prior-year column and seed equity accounts.
                                </p>
                            </div>
                            <button onClick={() => { setShowImport(false); setImportPreview(null); setImportError(''); }} className="text-gray-400 hover:text-gray-700">
                                <i className="ph ph-x text-xl"></i>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                            {/* Format guidance */}
                            <div className="bg-gray-50 rounded-lg p-4 text-[11px] text-gray-600 space-y-2">
                                <p className="font-semibold text-gray-700">Supported formats:</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="font-semibold text-blue-700 mb-1">QuickBooks</p>
                                        <code className="block bg-white border border-gray-200 rounded p-2 text-[10px] whitespace-pre">
Account,Debit,Credit,Balance{'\n'}1040 Savings account #2,398094.65,0.00,398094.65{'\n'}3999 Retained Earnings,0.00,125000.00,-125000.00
                                        </code>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-indigo-700 mb-1">Caseware</p>
                                        <code className="block bg-white border border-gray-200 rounded p-2 text-[10px] whitespace-pre">
Code,Account Description,Debit,Credit,Balance{'\n'}1040,Savings account #2,398094.65,,398094.65{'\n'}3999,Retained earnings,,125000.00,-125000.00
                                        </code>
                                    </div>
                                </div>
                                <p className="text-gray-500 mt-1">
                                    Accounts are matched by code number first, then by name. Equity accounts (3xxx) will automatically appear in the Trial Balance and seed Retained Earnings.
                                    For PDFs: use <em>File → Print → Save as PDF</em> (or Export to PDF) from QuickBooks or Caseware — the columnar layout must be preserved.
                                </p>
                            </div>

                            {/* File picker */}
                            {!importPreview && (
                                <div>
                                    <label className="block text-[12px] font-semibold text-gray-700 mb-2">Select file</label>
                                    <div
                                        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
                                        onClick={() => !importParsing && fileRef.current?.click()}
                                    >
                                        {importParsing ? (
                                            <>
                                                <i className="ph ph-spinner-gap animate-spin text-4xl text-purple-400 mb-2 block"></i>
                                                <p className="text-[13px] text-purple-600 font-medium">Extracting data from PDF…</p>
                                                <p className="text-[11px] text-gray-400 mt-1">This may take a few seconds</p>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-center justify-center gap-3 mb-3">
                                                    <i className="ph ph-file-csv text-3xl text-green-500"></i>
                                                    <span className="text-gray-300 text-lg">or</span>
                                                    <i className="ph ph-file-pdf text-3xl text-red-400"></i>
                                                </div>
                                                <p className="text-[13px] text-gray-600 font-medium">Click to select a CSV or PDF file</p>
                                                <p className="text-[11px] text-gray-400 mt-1">QuickBooks or Caseware Trial Balance export or printout</p>
                                            </>
                                        )}
                                        <input
                                            ref={fileRef}
                                            type="file"
                                            accept=".csv,.txt,.tsv,.pdf"
                                            className="hidden"
                                            onChange={handleImportFile}
                                        />
                                    </div>
                                    {importError && (
                                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700 flex items-start gap-2">
                                            <i className="ph ph-warning-circle mt-0.5 shrink-0"></i>
                                            <span>{importError}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Preview */}
                            {importPreview && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[12px] font-semibold text-gray-700">
                                            Preview — {Object.keys(importPreview).length} accounts matched
                                        </p>
                                        <button
                                            onClick={() => { setImportPreview(null); fileRef.current && (fileRef.current.value = ''); }}
                                            className="text-[11px] text-gray-500 hover:text-red-600"
                                        >
                                            ← Choose different file
                                        </button>
                                    </div>
                                    <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                                        <table className="w-full text-[11px]">
                                            <thead className="bg-gray-50 sticky top-0">
                                                <tr>
                                                    <th className="text-left px-3 py-2 font-semibold text-gray-500">Code</th>
                                                    <th className="text-left px-3 py-2 font-semibold text-gray-500">Account Name</th>
                                                    <th className="text-right px-3 py-2 font-semibold text-gray-500">Debit</th>
                                                    <th className="text-right px-3 py-2 font-semibold text-gray-500">Credit</th>
                                                    <th className="text-right px-3 py-2 font-semibold text-gray-500">Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(importPreview).map(([code, row]) => (
                                                    <tr key={code} className="border-t border-gray-100 hover:bg-gray-50">
                                                        <td className="px-3 py-1.5 font-mono text-gray-600">{code}</td>
                                                        <td className="px-3 py-1.5 text-gray-800">{row.name}</td>
                                                        <td className="px-3 py-1.5 text-right font-mono text-gray-700">{row.debit > 0 ? fmt(row.debit) : ''}</td>
                                                        <td className="px-3 py-1.5 text-right font-mono text-gray-700">{row.credit > 0 ? fmt(row.credit) : ''}</td>
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
                        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
                            <button
                                onClick={() => { setShowImport(false); setImportPreview(null); setImportError(''); }}
                                className="px-4 py-2 text-[12px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            {importPreview && (
                                <button
                                    onClick={handleImportConfirm}
                                    className="px-4 py-2 text-[12px] font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center gap-1.5"
                                >
                                    <i className="ph ph-check-circle"></i>
                                    Apply {Object.keys(importPreview).length} Opening Balances
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/** Infer account root type from code range when COA entry is missing */
function inferRoot(code) {
    const num = parseInt(code);
    if (isNaN(num))                        return 'EXPENSE';
    if (num >= 1000 && num < 2000)         return 'ASSET';
    if (num >= 2000 && num < 3000)         return 'LIABILITY';
    if (num >= 3000 && num < 4000)         return 'EQUITY';
    if (num >= 4000 && num < 5000)         return 'REVENUE';
    return 'EXPENSE'; // 5000-9999
}

export default TrialBalanceReport;
