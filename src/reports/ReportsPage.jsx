import React from 'react';
import { TrialBalanceReport } from './TrialBalanceReport.jsx';
import { GSTReport } from './GSTReport.jsx';
import { IncomeStatementReport } from './IncomeStatementReport.jsx';
import { BalanceSheetReport } from './BalanceSheetReport.jsx';
import { GeneralLedgerReport } from './GeneralLedgerReport.jsx';
import { GeneralJournalReport } from './GeneralJournalReport.jsx';
import { COASummaryReport } from './COASummaryReport.jsx';
import { FinancialRatiosReport } from './FinancialRatiosReport.jsx';

// ─── Opening Balances helpers (shared with TrialBalanceReport) ─────────────────
function getOpeningBalances() {
    return window.RoboLedger?._tbOpeningBalances || {};
}
function setOpeningBalances(map) {
    if (!window.RoboLedger) window.RoboLedger = {};
    window.RoboLedger._tbOpeningBalances = map;
}

// ─── CSV parser ────────────────────────────────────────────────────────────────
function parseTBCsv(csvText) {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return null;
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    const headers = firstLine.split(delimiter).map(h => h.replace(/"/g, '').trim().toLowerCase());
    const codeIdx    = headers.findIndex(h => /^(code|account\s*code|ref|ref\s*no|number|acct)$/i.test(h));
    const nameIdx    = headers.findIndex(h => /^(account|account\s*name|description|name|account\s*description)$/i.test(h));
    const debitIdx   = headers.findIndex(h => /^(debit|dr)$/i.test(h));
    const creditIdx  = headers.findIndex(h => /^(credit|cr)$/i.test(h));
    const balanceIdx = headers.findIndex(h => /^(balance|net|closing)$/i.test(h));
    const hasExplicitCode = codeIdx >= 0;
    const result = {};
    const allCOA = window.RoboLedger?.COA?.getAll?.() || [];
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
    for (let i = 1; i < lines.length; i++) {
        const parts = splitLine(lines[i]);
        if (parts.length < 2) continue;
        const rawName = nameIdx >= 0 ? parts[nameIdx]?.replace(/"/g, '').trim() : parts[0]?.replace(/"/g, '').trim();
        if (!rawName) continue;
        if (/^(total|grand\s*total|subtotal|net\s*income|retained|opening)/i.test(rawName)) continue;
        let code = '', name = rawName;
        if (hasExplicitCode && parts[codeIdx]) {
            code = parts[codeIdx].replace(/"/g, '').trim();
        } else {
            const m = rawName.match(/^(\d{3,5})\s+(.+)$/);
            if (m) { code = m[1]; name = m[2]; }
        }
        let matchedCode = code;
        if (!matchedCode || !allCOA.find(a => String(a.code) === matchedCode)) {
            const nl = name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const byName = allCOA.find(a => {
                const an = a.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                return an === nl || an.startsWith(nl) || nl.startsWith(an);
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

// ─── PDF parser ────────────────────────────────────────────────────────────────
async function parseTBPdf(arrayBuffer) {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error('PDF.js not available');
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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
        const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
        sortedYs.forEach(yKey => {
            allLines.push(lineMap[yKey].sort((a, b) => a.x - b.x));
        });
    }
    let debitX = null, creditX = null, balanceX = null, headerLineIdx = -1;
    for (let i = 0; i < allLines.length; i++) {
        const line  = allLines[i];
        const joined = line.map(item => item.text.trim().toUpperCase()).join(' ');
        if (/\bDEBIT\b/.test(joined) && /\bCREDIT\b/.test(joined)) {
            const debitItem  = line.find(item => /^DEBIT$/i.test(item.text.trim()));
            const creditItem = line.find(item => /^CREDIT$/i.test(item.text.trim()));
            const balItem    = line.find(item => /^BALANCE$/i.test(item.text.trim()));
            if (debitItem && creditItem) {
                debitX  = debitItem.x  + (debitItem.w  || 0);
                creditX = creditItem.x + (creditItem.w || 0);
                balanceX = balItem ? (balItem.x + (balItem.w || 0)) : creditX + 90;
                headerLineIdx = i;
                break;
            }
        }
    }
    if (debitX === null) {
        const textLines = allLines.map(line => line.map(i => i.text).filter(t => t.trim()).join('  ')).filter(l => l.trim());
        return parseTBCsv(textLines.join('\n'));
    }
    const SLOT_W  = 100;
    const NAME_MAX = debitX - SLOT_W - 10;
    const inDebitSlot   = (x) => x > (debitX  - SLOT_W) && x <= (debitX  + 20);
    const inCreditSlot  = (x) => x > (creditX - SLOT_W) && x <= (creditX + 20);
    const inBalanceSlot = (x) => x > (balanceX - SLOT_W) && x <= (balanceX + 20);
    const inNameRegion  = (x) => x < NAME_MAX;
    const parseAmt = (v) => {
        if (!v) return null;
        let s = String(v).replace(/[$\s,]/g, '').trim();
        if (!s || s === '-' || s === '—') return null;
        const isNeg = s.startsWith('(') && s.endsWith(')');
        const hasTrailingMinus = s.endsWith('-');
        s = s.replace(/[()]/g, '').replace(/-$/, '');
        const n = parseFloat(s);
        if (isNaN(n)) return null;
        return isNeg || hasTrailingMinus ? -n : n;
    };
    const isSkipLine = (joined) => {
        if (!joined.trim()) return true;
        if (/^(assets?|liabilit|equity|revenue|income|expense|cost\s+of|total\s+|subtotal|grand\s*total|net\s*income|net\s*loss|retained earn|opening|closing|prepared\s*by|partner|working\s*paper|trial\s*balance|balance\s*sheet|income\s*statement|period\s*end|as\s*of\s*|page\s*\d)/i.test(joined.trim())) return true;
        if (/\bDEBIT\b.*\bCREDIT\b/i.test(joined)) return true;
        return false;
    };
    const result = {};
    const allCOA = window.RoboLedger?.COA?.getAll?.() || [];
    for (let i = 0; i < allLines.length; i++) {
        if (i <= headerLineIdx) continue;
        const line   = allLines[i];
        const joined = line.map(item => item.text).join(' ').trim();
        if (isSkipLine(joined)) continue;
        const nameItems   = line.filter(item => inNameRegion(item.x));
        const debitItems  = line.filter(item => inDebitSlot(item.x));
        const creditItems = line.filter(item => inCreditSlot(item.x));
        const balItems    = line.filter(item => inBalanceSlot(item.x));
        const leftText = nameItems.map(i => i.text).join(' ').trim();
        if (!leftText) continue;
        const hasAnyNumber = debitItems.length > 0 || creditItems.length > 0 || balItems.length > 0;
        if (!hasAnyNumber) continue;
        let code = '', name = leftText;
        const codePrefixMatch = leftText.match(/^(\d{3,5})\s{2,}(.+)$/);
        if (codePrefixMatch) { code = codePrefixMatch[1]; name = codePrefixMatch[2].trim(); }
        else if (nameItems.length >= 2) {
            const firstItem = nameItems[0].text.trim();
            if (/^\d{3,5}$/.test(firstItem)) { code = firstItem; name = nameItems.slice(1).map(i => i.text).join(' ').trim(); }
        }
        const debit   = parseAmt(debitItems.map(i => i.text).join('').trim())  ?? 0;
        const credit  = parseAmt(creditItems.map(i => i.text).join('').trim()) ?? 0;
        const balance = parseAmt(balItems.map(i => i.text).join('').trim());
        const finalBalance = balance !== null ? balance : (debit - credit);
        if (debit === 0 && credit === 0 && finalBalance === 0 && !code) continue;
        let matchedCode = '';
        if (code && allCOA.find(a => String(a.code) === code)) matchedCode = code;
        if (!matchedCode) {
            const nl = name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const byName = allCOA.find(a => {
                const an = a.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                return an === nl || (nl.length > 5 && an.startsWith(nl.slice(0, 8))) || (nl.length > 5 && nl.startsWith(an.slice(0, 8)));
            });
            if (byName) matchedCode = String(byName.code);
        }
        if (!matchedCode && code) matchedCode = code;
        if (!matchedCode) continue;
        if (result[matchedCode]) {
            result[matchedCode].debit  += debit;
            result[matchedCode].credit += credit;
            result[matchedCode].balance = result[matchedCode].debit - result[matchedCode].credit;
        } else {
            result[matchedCode] = { name, debit, credit, balance: finalBalance };
        }
    }
    if (Object.keys(result).length > 0) return result;
    const textLines = allLines.map(line => line.map(i => i.text).filter(t => t.trim()).join('  ')).filter(l => l.trim());
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
        { id: 'trial-balance',     icon: 'ph-scales',               title: 'Trial Balance',     description: 'Verify debits equal credits',     color: 'blue',   ready: true,  component: TrialBalanceReport },
        { id: 'income-statement',  icon: 'ph-chart-line-up',        title: 'Income Statement',  description: 'Revenue, expenses, profit',        color: 'green',  ready: true,  component: IncomeStatementReport },
        { id: 'gst-report',        icon: 'ph-percent',              title: 'GST/HST Report',    description: 'Tax collected vs paid',            color: 'red',    ready: true,  component: GSTReport },
        { id: 'balance-sheet',     icon: 'ph-stack',                title: 'Balance Sheet',     description: 'Assets, liabilities, equity',      color: 'cyan',   ready: true,  component: BalanceSheetReport },
        { id: 'cash-flow',         icon: 'ph-currency-circle-dollar', title: 'Cash Flow',       description: 'Operating, investing, financing',  color: 'teal',   ready: false },
        { id: 'general-ledger',    icon: 'ph-list-bullets',         title: 'General Ledger',    description: 'Account-specific history',         color: 'indigo', ready: true,  component: GeneralLedgerReport },
        { id: 'general-journal',   icon: 'ph-book',                 title: 'General Journal',   description: 'Transaction log',                  color: 'purple', ready: true,  component: GeneralJournalReport },
        { id: 'coa-summary',       icon: 'ph-chart-bar',            title: 'COA Summary',       description: 'Category breakdown',               color: 'orange', ready: true,  component: COASummaryReport },
        { id: 'financial-ratios',  icon: 'ph-chart-line',           title: 'Financial Ratios',  description: 'Key metrics',                      color: 'violet', ready: true,  component: FinancialRatiosReport },
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
        <div className="min-h-screen bg-gray-50 p-8">

            {/* ── Page header ────────────────────────────────────────────────── */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <i className="ph ph-chart-pie-slice text-3xl text-blue-600"></i>
                        <h1 className="text-3xl font-bold text-gray-900">Financial Reports</h1>
                    </div>
                    <button
                        onClick={() => { setShowImport(true); setImportPreview(null); setImportError(''); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-[12px] font-semibold transition-colors ${
                            hasOB
                                ? 'bg-purple-600 border-purple-700 text-white hover:bg-purple-700'
                                : 'bg-white border-purple-300 text-purple-700 hover:bg-purple-50'
                        }`}
                    >
                        <i className="ph ph-arrow-square-in text-[15px]"></i>
                        {hasOB ? `Prior Year Loaded · ${obEntries.length} accounts` : 'Import Prior Year'}
                    </button>
                </div>
                <p className="text-gray-500 text-sm">Professional accounting reports — Caseware standard</p>
            </div>

            {/* ── Report cards grid ──────────────────────────────────────────── */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                {reports.map(report => {
                    const colors = colorMap[report.color];
                    return (
                        <button
                            key={report.id}
                            onClick={() => report.ready ? setSelectedReport(report.id) : null}
                            className={`${colors.bg} ${colors.border} ${report.ready ? colors.hover + ' cursor-pointer' : 'cursor-not-allowed opacity-50'} border-2 rounded-xl p-6 text-left transition-all duration-200 ${report.ready ? 'hover:shadow-lg hover:scale-[1.02]' : ''} relative`}
                        >
                            {!report.ready && (
                                <div className="absolute top-3 right-3 bg-gray-400 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                                    SOON
                                </div>
                            )}
                            <div className="flex flex-col gap-4">
                                <div className={`${colors.icon} text-4xl`}>
                                    <i className={`ph ${report.icon}`}></i>
                                </div>
                                <div>
                                    <h3 className="text-[15px] font-bold text-gray-900 mb-1">{report.title}</h3>
                                    <p className="text-[12px] text-gray-500">{report.description}</p>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ── Prior Year · Imported Trial Balance section ────────────────── */}
            {hasOB && (
                <div className="max-w-7xl mx-auto">
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
