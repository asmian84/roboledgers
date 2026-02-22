/**
 * utility-bar.js — RoboLedger v5 Dashboard Sidebar
 *
 * Every stat, number and row is drillable:
 *   Level 0 → top-level overview (all txns)
 *   Level 1 → filter type (uncategorized / in / out / revenue / expense / account / category)
 *   Level 2 → top payees within that filter
 *   Level 3 → individual payee transactions (description + date + amount list)
 *
 * Breadcrumb: All › [Level 1 Label] › [Payee name]
 *
 * Grid sync: every drill calls window.setTxGridFilter(predicate or null)
 * setTxGridFilter now accepts function predicates (updated in main.jsx)
 */

// ─── Shared helpers ──────────────────────────────────────────────────────────

const UB_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

function ubFmt(amount) {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(amount);
}
function ubFmt2(amount) {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
}

function resolveCOAName(code) {
    if (!code) return 'Uncategorized';
    const COA = window.RoboLedger?.COA;
    if (!COA) return String(code);
    const acct = COA.get(String(code)) || COA.get(parseInt(code));
    if (acct?.name) return acct.name;
    if (String(code) === '9970') return 'Uncategorized';
    return `Account ${code}`;
}

function resolveRootFromCode(code) {
    const COA = window.RoboLedger?.COA;
    const acct = COA?.get(String(code)) || COA?.get(parseInt(code));
    return acct?.root || null;
}

// ─── Drill state ─────────────────────────────────────────────────────────────
// window._ubDrill = { level: 0|1|2|3, label1, label2, label3, filterFn, payeeKey }

window._ubDrill = null;

// ─── Breadcrumb builder ───────────────────────────────────────────────────────
function ubBreadcrumb(drill) {
    if (!drill || drill.level === 0) return '';
    let parts = [
        `<span style="cursor:pointer;color:#6366f1;font-weight:600;" onclick="window.ubClearDrill()">All</span>`
    ];
    if (drill.level >= 1 && drill.label1) {
        if (drill.level > 1) {
            parts.push(`<span style="color:#cbd5e1;">›</span>`);
            parts.push(`<span style="cursor:pointer;color:#6366f1;" onclick="window.ubDrillLevel1('${drill.type1}','${drill.label1Escaped || drill.label1}',null)">${drill.label1}</span>`);
        } else {
            parts.push(`<span style="color:#cbd5e1;">›</span>`);
            parts.push(`<span style="color:#1e293b;font-weight:600;">${drill.label1}</span>`);
        }
    }
    if (drill.level >= 2 && drill.label2) {
        if (drill.level > 2) {
            parts.push(`<span style="color:#cbd5e1;">›</span>`);
            parts.push(`<span style="cursor:pointer;color:#6366f1;" onclick="window.ubDrillLevel2('${drill.type1}','${drill.payeeKey2Escaped || drill.payeeKey2}','${drill.label2}')">${drill.label2}</span>`);
        } else {
            parts.push(`<span style="color:#cbd5e1;">›</span>`);
            parts.push(`<span style="color:#1e293b;font-weight:600;">${drill.label2}</span>`);
        }
    }
    if (drill.level >= 3 && drill.label3) {
        parts.push(`<span style="color:#cbd5e1;">›</span>`);
        parts.push(`<span style="color:#1e293b;font-weight:600;">${drill.label3}</span>`);
    }
    return `<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:4px 8px 8px;font-size:10px;color:#64748b;border-bottom:1px solid #f1f5f9;margin-bottom:4px;">${parts.join('')}</div>`;
}

// ─── Level-2: payee breakdown chart ──────────────────────────────────────────
function ubRenderPayeeChart(txns, drillState) {
    const chartContainer = document.getElementById('util-category-chart');
    if (!chartContainer) return;

    if (!txns.length) {
        chartContainer.innerHTML = ubBreadcrumb(drillState) +
            `<div style="padding:12px;text-align:center;color:#94a3b8;font-size:11px;">No transactions</div>`;
        return;
    }

    const payeeTotals = {};
    txns.forEach(t => {
        const key = (t.description || t.payee || 'Unknown').substring(0, 35);
        payeeTotals[key] = (payeeTotals[key] || 0) + Math.abs((t.amount_cents || 0) / 100);
    });

    const topPayees = Object.entries(payeeTotals).sort((a, b) => b[1] - a[1]).slice(0, 7);
    const total = topPayees.reduce((s, [, a]) => s + a, 0);

    chartContainer.innerHTML = ubBreadcrumb(drillState) + topPayees.map(([payee, amount], idx) => {
        const pct = total > 0 ? ((amount / total) * 100).toFixed(1) : '0.0';
        const bar = total > 0 ? Math.round((amount / total) * 100) : 0;
        const escapedPayee = payee.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return `
        <div style="padding:5px 8px;border-radius:6px;margin-bottom:2px;cursor:pointer;border:1px solid transparent;transition:all 0.12s;"
             onmouseover="this.style.backgroundColor='#f8fafc'"
             onmouseout="this.style.backgroundColor='transparent'"
             onclick="window.ubDrillLevel2('${drillState.type1}','${escapedPayee}','${escapedPayee}')">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
            <div style="display:flex;align-items:center;gap:7px;flex:1;min-width:0;">
              <div style="width:7px;height:7px;border-radius:50%;background:${UB_COLORS[idx]};flex-shrink:0;"></div>
              <span style="font-size:10px;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${payee}">${payee}</span>
            </div>
            <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
              <span style="font-size:9px;color:#94a3b8;font-family:monospace;">${pct}%</span>
              <span style="font-size:10px;font-weight:600;color:#1e293b;font-family:monospace;">${ubFmt(amount)}</span>
            </div>
          </div>
          <div style="height:2px;border-radius:1px;background:#f1f5f9;overflow:hidden;">
            <div style="height:100%;width:${bar}%;background:${UB_COLORS[idx]};border-radius:1px;"></div>
          </div>
        </div>`;
    }).join('') + `<div style="padding:4px 8px 0;font-size:9px;color:#94a3b8;text-align:right;">${txns.length} transactions · click payee to drill deeper</div>`;
}

// ─── Level-3: individual transactions for a payee ─────────────────────────────
function ubRenderTxnList(txns, drillState) {
    const chartContainer = document.getElementById('util-category-chart');
    if (!chartContainer) return;

    const sorted = [...txns].sort((a, b) => new Date(b.date) - new Date(a.date));
    const rows = sorted.slice(0, 12).map(t => {
        const amt = Math.abs((t.amount_cents || 0) / 100);
        const color = t.polarity === 'CREDIT' ? '#10b981' : '#ef4444';
        const sign = t.polarity === 'CREDIT' ? '+' : '−';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 8px;font-size:10px;border-bottom:1px solid #f9fafb;">
          <span style="color:#6b7280;font-family:monospace;flex-shrink:0;margin-right:6px;">${t.date?.substring(0, 10) || ''}</span>
          <span style="color:#374151;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${t.description || ''}">${(t.description || '').substring(0, 28)}</span>
          <span style="font-weight:600;font-family:monospace;color:${color};flex-shrink:0;margin-left:6px;">${sign}${ubFmt(amt)}</span>
        </div>`;
    }).join('');

    chartContainer.innerHTML = ubBreadcrumb(drillState) + rows +
        (sorted.length > 12 ? `<div style="padding:4px 8px;font-size:9px;color:#94a3b8;text-align:center;">+ ${sorted.length - 12} more in grid</div>` : '');
}

// ─── Category-level chart (top-level or after L1 drill) ──────────────────────
function ubRenderCategoryChart(txns, drillState) {
    const chartContainer = document.getElementById('util-category-chart');
    if (!chartContainer) return;

    const categoryTotals = {};
    txns.forEach(t => {
        const code = String(t.category || '9970');
        categoryTotals[code] = (categoryTotals[code] || 0) + Math.abs((t.amount_cents || 0) / 100);
    });

    const topCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const total = topCategories.reduce((s, [, a]) => s + a, 0);
    const activeCode = drillState?.level === 1 && drillState?.type1 === 'category' ? drillState?.codeKey : null;

    chartContainer.innerHTML = (drillState ? ubBreadcrumb(drillState) : '') + topCategories.map(([code, amount], idx) => {
        const name = resolveCOAName(code);
        const pct = total > 0 ? ((amount / total) * 100).toFixed(1) : '0.0';
        const bar = total > 0 ? Math.round((amount / total) * 100) : 0;
        const isActive = code === String(activeCode);
        return `
        <div style="padding:5px 8px;border-radius:6px;cursor:pointer;margin-bottom:2px;transition:all 0.12s;${isActive ? 'background:#eef2ff;border:1px solid #c7d2fe;' : 'border:1px solid transparent;'}"
             onmouseover="if(!${isActive}) this.style.backgroundColor='#f8fafc'"
             onmouseout="if(!${isActive}) this.style.backgroundColor='${isActive ? '#eef2ff' : 'transparent'}'"
             onclick="window.ubDrillCategory('${code}')">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
            <div style="display:flex;align-items:center;gap:7px;flex:1;min-width:0;">
              <div style="width:8px;height:8px;border-radius:50%;background:${UB_COLORS[idx]};flex-shrink:0;"></div>
              <span style="font-size:11px;color:#1e293b;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${name}">${name}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
              <span style="font-size:10px;color:#94a3b8;font-family:monospace;">${pct}%</span>
              <span style="font-size:11px;font-weight:600;color:#1e293b;font-family:monospace;">${ubFmt(amount)}</span>
            </div>
          </div>
          <div style="height:3px;border-radius:2px;background:#f1f5f9;overflow:hidden;">
            <div style="height:100%;width:${bar}%;background:${UB_COLORS[idx]};border-radius:2px;transition:width 0.3s;"></div>
          </div>
        </div>`;
    }).join('');
}

// ─── DRILL ENTRY POINTS ───────────────────────────────────────────────────────

/**
 * ubDrillType — called by stat row clicks (uncategorized, in, out, revenue, expenses)
 */
window.ubDrillType = function(type) {
    console.log(`[UB DRILL] ubDrillType("${type}") called`);
    const allTxns = window.RoboLedger?.Ledger?.getAll() || [];
    console.log(`[UB DRILL] Total transactions available: ${allTxns.length}`);
    let filterFn, label;

    switch(type) {
        case 'all':
            window.ubClearDrill();
            return;
        case 'uncategorized':
            filterFn = t => !t.category || String(t.category) === '9970';
            label = 'Uncategorized';
            break;
        case 'needs-review':
            filterFn = t => t.status === 'needs_review' || (t.confidence && t.confidence < 0.7);
            label = 'Needs Review';
            break;
        case 'in':
            filterFn = t => t.polarity === 'CREDIT';
            label = 'Money In';
            break;
        case 'out':
            filterFn = t => t.polarity === 'DEBIT';
            label = 'Money Out';
            break;
        case 'revenue':
            filterFn = t => resolveRootFromCode(t.category) === 'REVENUE';
            label = 'Revenue';
            break;
        case 'expenses':
            filterFn = t => {
                const root = resolveRootFromCode(t.category);
                return root === 'EXPENSE' || root === null;
            };
            label = 'Expenses';
            break;
        case 'gst-collected':
            filterFn = t => t.gst_enabled && t.tax_cents > 0 &&
                (t.gst_type === 'collected' || t.gst_account === '2160');
            label = 'GST Collected (2160)';
            break;
        case 'gst-itc':
            filterFn = t => t.gst_enabled && t.tax_cents > 0 &&
                (t.gst_type === 'itc' || t.gst_account === '2150');
            label = 'ITC / GST Paid (2150)';
            break;
        case 'gst-all':
            filterFn = t => t.gst_enabled && t.tax_cents > 0;
            label = 'All GST/HST Transactions';
            break;
        default:
            return;
    }

    const filtered = allTxns.filter(filterFn);
    console.log(`[UB DRILL] ubDrillType("${type}") → "${label}" → ${filtered.length} transactions match`);
    window._ubDrill = { level: 1, type1: type, label1: label, label1Escaped: label.replace(/'/g, "\\'"), filterFn };
    if (window.setTxGridFilter) {
        console.log(`[UB DRILL] Calling setTxGridFilter with predicate for "${label}"`);
        window.setTxGridFilter(filterFn);
        console.log(`[UB DRILL] setTxGridFilter done. Grid data now has ${window._txGridProps?.data?.length ?? '?'} rows`);
    } else {
        console.error('[UB DRILL] ❌ window.setTxGridFilter is NOT defined — grid filter cannot be applied');
    }
    ubRenderPayeeChart(filtered, window._ubDrill);
};

/**
 * ubDrillCategory — category chart row click → L1 category drill
 */
window.ubDrillCategory = function(code) {
    console.log(`[UB DRILL] ubDrillCategory("${code}") called`);
    const allTxns = window.RoboLedger?.Ledger?.getAll() || [];
    const name = resolveCOAName(code);
    const filterFn = t => String(t.category || '9970') === String(code);
    const filtered = allTxns.filter(filterFn);
    console.log(`[UB DRILL] ubDrillCategory("${code}") → "${name}" → ${filtered.length} transactions match`);
    window._ubDrill = { level: 1, type1: 'category', codeKey: code, label1: name, label1Escaped: name.replace(/'/g, "\\'"), filterFn };
    if (window.setTxGridFilter) {
        console.log(`[UB DRILL] Calling setTxGridFilter with predicate for category "${name}" (${code})`);
        window.setTxGridFilter(filterFn);
        console.log(`[UB DRILL] setTxGridFilter done. Grid data now has ${window._txGridProps?.data?.length ?? '?'} rows`);
    } else {
        console.error('[UB DRILL] ❌ window.setTxGridFilter is NOT defined');
    }
    ubRenderPayeeChart(filtered, window._ubDrill);
};

// Backward compat
window.drillUtilBarCategory = window.ubDrillCategory;
window.filterByCategory = window.ubDrillCategory;

/**
 * ubDrillLevel1 — re-enter L1 from breadcrumb
 */
window.ubDrillLevel1 = function(type1, label1) {
    if (type1 === 'category') {
        // Find code from name — not ideal but handles breadcrumb re-entry
        const allTxns = window.RoboLedger?.Ledger?.getAll() || [];
        const filterFn = window._ubDrill?.filterFn;
        const filtered = filterFn ? allTxns.filter(filterFn) : allTxns;
        window._ubDrill = { ...window._ubDrill, level: 1 };
        window.setTxGridFilter && window.setTxGridFilter(filterFn || null);
        ubRenderPayeeChart(filtered, window._ubDrill);
    } else {
        window.ubDrillType(type1);
    }
};

/**
 * ubDrillLevel2 — payee row click → L2 individual transactions
 */
window.ubDrillLevel2 = function(type1, payeeKey, payeeLabel) {
    const allTxns = window.RoboLedger?.Ledger?.getAll() || [];
    const parentFn = window._ubDrill?.filterFn;
    const parentFiltered = parentFn ? allTxns.filter(parentFn) : allTxns;

    // Match transactions where description starts with the payee key (trimmed match)
    const payeeFilterFn = t => {
        const desc = (t.description || t.payee || '').substring(0, 35);
        return desc === payeeKey || desc.startsWith(payeeKey.substring(0, 20));
    };
    const txns = parentFiltered.filter(payeeFilterFn);

    window._ubDrill = {
        ...window._ubDrill,
        level: 2,
        label2: payeeLabel.substring(0, 30),
        payeeKey2: payeeKey,
        payeeKey2Escaped: payeeKey.replace(/'/g, "\\'"),
        payeeFilterFn
    };

    // Narrow the grid further to this payee
    const combinedFn = t => (parentFn ? parentFn(t) : true) && payeeFilterFn(t);
    window.setTxGridFilter && window.setTxGridFilter(combinedFn);
    ubRenderTxnList(txns, window._ubDrill);
};

/**
 * ubClearDrill — go back to top-level overview
 */
window.ubClearDrill = function() {
    window._ubDrill = null;
    window._utilBarDrillCode = null;
    window.setTxGridFilter && window.setTxGridFilter(null);
    window.updateUtilityBar();
};

// Legacy compat
window.clearUtilBarDrill = window.ubClearDrill;

// ─── Account badge drill ──────────────────────────────────────────────────────
window.ubDrillAccount = function(accountId, accountRef) {
    const allTxns = window.RoboLedger?.Ledger?.getAll() || [];
    const filterFn = t => t.account_id === accountId;
    const filtered = allTxns.filter(filterFn);
    window._ubDrill = { level: 1, type1: 'account', label1: accountRef, filterFn };
    window.setTxGridFilter && window.setTxGridFilter(filterFn);
    ubRenderCategoryChart(filtered, window._ubDrill);
};

// ─── MAIN RENDER ─────────────────────────────────────────────────────────────

window.updateUtilityBar = function () {
    const allTxns = window.RoboLedger?.Ledger?.getAll() || [];
    // Sort accounts by type group (CHQ, SAV, VISA, MC, AMEX) then by number within each group
    const _ubTypeOrder = { 'CHQ': 1, 'SAV': 2, 'TD': 3, 'VISA': 4, 'MC': 5, 'AMEX': 6 };
    const _ubParseRef = (ref) => {
        const match = (ref || '').match(/^([A-Za-z]+)(\d*)$/);
        if (!match) return { type: ref || '', num: 0 };
        return { type: match[1].toUpperCase(), num: parseInt(match[2] || '0', 10) };
    };
    const accounts = (window.RoboLedger?.Accounts?.getActive?.() || window.RoboLedger?.Accounts?.getAll() || [])
        .slice().sort((a, b) => {
            const ra = _ubParseRef(a.ref || a.name);
            const rb = _ubParseRef(b.ref || b.name);
            const orderA = _ubTypeOrder[ra.type] || 99;
            const orderB = _ubTypeOrder[rb.type] || 99;
            if (orderA !== orderB) return orderA - orderB;
            return ra.num - rb.num;
        });

    console.log(`[UB] updateUtilityBar() called — ${allTxns.length} txns, ${accounts.length} accounts`);
    if (allTxns.length === 0) { console.log('[UB] No transactions — skipping render'); return; }

    // ── Transaction Stats ─────────────────────────────────────────────────────
    const txnEl = document.getElementById('util-total-txns');
    if (txnEl) {
        txnEl.textContent = allTxns.length.toLocaleString();
        txnEl.style.cursor = 'pointer';
        txnEl.title = 'Click to show all transactions';
        txnEl.onclick = () => window.ubClearDrill();
    }

    const dates = allTxns.map(t => new Date(t.date)).filter(d => !isNaN(d));
    if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        const rangeEl = document.getElementById('util-date-range');
        if (rangeEl) rangeEl.textContent =
            `${minDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – ${maxDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    }

    // ── Pending Work ──────────────────────────────────────────────────────────
    const uncategorized = allTxns.filter(t => !t.category || String(t.category) === '9970').length;
    const needsReview = allTxns.filter(t => t.status === 'needs_review' || (t.confidence && t.confidence < 0.7)).length;

    const uncatEl = document.getElementById('util-uncategorized');
    if (uncatEl) {
        uncatEl.textContent = uncategorized;
        uncatEl.style.cursor = 'pointer';
        uncatEl.title = 'Click to drill into uncategorized transactions';
        uncatEl.onclick = () => window.ubDrillType('uncategorized');
        console.log(`[UB] ✓ Wired onclick on #util-uncategorized (${uncategorized} txns)`);
    } else { console.warn('[UB] ⚠ #util-uncategorized not found in DOM'); }

    const reviewEl = document.getElementById('util-needs-review');
    if (reviewEl) {
        reviewEl.textContent = needsReview;
        reviewEl.style.cursor = 'pointer';
        reviewEl.title = 'Click to drill into needs-review transactions';
        reviewEl.onclick = () => window.ubDrillType('needs-review');
        console.log(`[UB] ✓ Wired onclick on #util-needs-review (${needsReview} txns)`);
    } else { console.warn('[UB] ⚠ #util-needs-review not found in DOM'); }

    // ── Net Position ──────────────────────────────────────────────────────────
    let totalIn = 0, totalOut = 0;
    allTxns.forEach(t => {
        const amt = Math.abs((t.amount_cents || 0) / 100);
        if (t.polarity === 'CREDIT') totalIn += amt;
        else totalOut += amt;
    });
    const netPosition = totalIn - totalOut;

    const balEl = document.getElementById('util-total-balance');
    if (balEl) balEl.textContent = ubFmt2(netPosition);

    const inEl = document.getElementById('util-total-in');
    if (inEl) {
        inEl.textContent = ubFmt(totalIn);
        inEl.style.cursor = 'pointer';
        inEl.title = 'Click to drill into money in (credits)';
        inEl.onclick = () => window.ubDrillType('in');
        console.log(`[UB] ✓ Wired onclick on #util-total-in (${ubFmt(totalIn)})`);
    } else { console.warn('[UB] ⚠ #util-total-in not found in DOM'); }

    const outEl = document.getElementById('util-total-out');
    if (outEl) {
        outEl.textContent = ubFmt(totalOut);
        outEl.style.cursor = 'pointer';
        outEl.title = 'Click to drill into money out (debits)';
        outEl.onclick = () => window.ubDrillType('out');
        console.log(`[UB] ✓ Wired onclick on #util-total-out (${ubFmt(totalOut)})`);
    } else { console.warn('[UB] ⚠ #util-total-out not found in DOM'); }

    // ── Quick P&L (COA root-based, accurate) ─────────────────────────────────
    let revenue = 0, expenses = 0;
    allTxns.forEach(t => {
        const root = resolveRootFromCode(t.category);
        const amt = Math.abs((t.amount_cents || 0) / 100);
        if (root === 'REVENUE') revenue += amt;
        else if (root === 'EXPENSE') expenses += amt;
    });
    const netIncome = revenue - expenses;

    const revEl = document.getElementById('util-revenue');
    if (revEl) {
        revEl.textContent = ubFmt(revenue);
        revEl.style.cursor = 'pointer';
        revEl.title = 'Click to drill into revenue transactions';
        revEl.onclick = () => window.ubDrillType('revenue');
        console.log(`[UB] ✓ Wired onclick on #util-revenue (${ubFmt(revenue)})`);
    } else { console.warn('[UB] ⚠ #util-revenue not found in DOM'); }

    const expEl = document.getElementById('util-expenses');
    if (expEl) {
        expEl.textContent = ubFmt(expenses);
        expEl.style.cursor = 'pointer';
        expEl.title = 'Click to drill into expense transactions';
        expEl.onclick = () => window.ubDrillType('expenses');
        console.log(`[UB] ✓ Wired onclick on #util-expenses (${ubFmt(expenses)})`);
    } else { console.warn('[UB] ⚠ #util-expenses not found in DOM'); }

    const netEl = document.getElementById('util-net-income');
    if (netEl) {
        netEl.textContent = ubFmt2(netIncome);
        netEl.style.color = netIncome >= 0 ? '#10b981' : '#ef4444';
    }

    // ── GST / ITC Summary ─────────────────────────────────────────────────────
    const gstCard = document.getElementById('util-gst-card');
    const gstWithTax = allTxns.filter(t => t.gst_enabled && t.tax_cents > 0);

    if (gstCard) {
        if (gstWithTax.length > 0) {
            gstCard.style.display = '';    // show card

            // Province badge
            const province = window.UI_STATE?.province || 'AB';
            const TAX_RATE_LABELS = {
                'ON':'13% HST','BC':'12% GST+PST','AB':'5% GST','QC':'14.975% GST+QST',
                'NS':'15% HST','NB':'15% HST','MB':'12% GST+PST','SK':'11% GST+PST',
                'PE':'15% HST','NL':'15% HST','YT':'5% GST','NT':'5% GST','NU':'5% GST',
            };
            const provinceBadge = document.getElementById('util-gst-province-badge');
            if (provinceBadge) provinceBadge.textContent = TAX_RATE_LABELS[province] || province;

            // GST Collected = tax_cents on CREDIT / revenue transactions (account 2160)
            let gstCollected = 0, gstITC = 0;
            gstWithTax.forEach(t => {
                const taxAmt = Math.abs(t.tax_cents || 0) / 100;
                if (t.gst_type === 'collected' || t.gst_account === '2160') {
                    gstCollected += taxAmt;
                } else {
                    gstITC += taxAmt;
                }
            });
            const gstNet = gstCollected - gstITC;

            const collectedEl = document.getElementById('util-gst-collected');
            const itcEl       = document.getElementById('util-gst-itc');
            const netEl2      = document.getElementById('util-gst-net');

            if (collectedEl) collectedEl.textContent = ubFmt(gstCollected);
            if (itcEl)       itcEl.textContent       = ubFmt(gstITC);
            if (netEl2) {
                netEl2.textContent = ubFmt2(Math.abs(gstNet));
                netEl2.style.color = gstNet <= 0 ? '#10b981' : '#ef4444';
                netEl2.title       = gstNet <= 0
                    ? `GST Refund: CRA owes you ${ubFmt2(Math.abs(gstNet))}`
                    : `GST Payable to CRA: ${ubFmt2(gstNet)}`;
            }

            // Update card label with refund/payable indicator
            const gstLabel = document.getElementById('util-gst-label');
            if (gstLabel) {
                gstLabel.textContent = gstNet <= 0 ? 'GST/HST — Refund' : 'GST/HST';
                gstLabel.style.color = gstNet <= 0 ? '#10b981' : '';
            }

            console.log(`[UB] GST: Collected=${ubFmt(gstCollected)}, ITC=${ubFmt(gstITC)}, Net=${ubFmt2(gstNet)} (${gstWithTax.length} taxable txns)`);
        } else {
            gstCard.style.display = 'none';  // hide if no GST data yet
        }
    }

    // ── Category Chart — top-level (if no drill active) ───────────────────────
    if (!window._ubDrill) {
        ubRenderCategoryChart(allTxns, null);
    }
    // (If drill is active, chart was already rendered by the drill handler — don't overwrite)

    // ── Active Accounts ───────────────────────────────────────────────────────
    const badgesContainer = document.getElementById('util-account-badges');
    if (!badgesContainer) return;

    // accounts is already getActive() + sorted; filter is belt-and-suspenders
    const activeAccounts = accounts.filter(acc =>
        allTxns.some(t => t.account_id === acc.id)
    );

    if (activeAccounts.length > 0) {
        const accountColors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16', '#f97316'];

        // Resolve bank logo image for account
        function _accLogoHtml(acc, size = 14) {
            const brand = (acc.brand || acc.cardNetwork || '').toUpperCase();
            const bankName = (acc.bankName || acc.bankIcon || '').toLowerCase();
            const ref = (acc.ref || '').toUpperCase();
            const imgStyle = `width:${size}px;height:${size}px;border-radius:2px;object-fit:contain;flex-shrink:0;`;
            const basePath = '/logos/';

            // Card network logos
            if (brand.includes('VISA') || ref.includes('VISA'))
                return `<img src="${basePath}visa.png" alt="Visa" style="${imgStyle}" />`;
            if (brand.includes('MC') || brand.includes('MASTERCARD') || ref.includes('MC'))
                return `<img src="${basePath}mastercard.png" alt="MC" style="${imgStyle}" />`;
            if (brand.includes('AMEX') || ref.includes('AMEX'))
                return `<img src="${basePath}amex.png" alt="Amex" style="${imgStyle}" />`;

            // Bank logos
            if (bankName.includes('rbc') || bankName.includes('royal'))
                return `<img src="${basePath}rbc.png" alt="RBC" style="${imgStyle}" />`;
            if (bankName.includes('td') || bankName.includes('dominion'))
                return `<img src="${basePath}td.png" alt="TD" style="${imgStyle}" />`;
            if (bankName.includes('bmo') || bankName.includes('montreal'))
                return `<img src="${basePath}bmo.png" alt="BMO" style="${imgStyle}" />`;
            if (bankName.includes('scotia'))
                return `<img src="${basePath}scotia.png" alt="Scotia" style="${imgStyle}" />`;
            if (bankName.includes('cibc'))
                return `<img src="${basePath}cibc.png" alt="CIBC" style="${imgStyle}" />`;

            // Fallback: try to match from account ref prefix
            if (ref.startsWith('CHQ') || ref.startsWith('SAV') || ref.startsWith('TD'))
                return `<i class="ph ph-bank" style="font-size:${size}px;flex-shrink:0;"></i>`;

            return `<i class="ph ph-bank" style="font-size:${size}px;flex-shrink:0;"></i>`;
        }

        badgesContainer.innerHTML = activeAccounts.slice(0, 8).map((acc, idx) => {
            const txCount = allTxns.filter(t => t.account_id === acc.id).length;
            const label = acc.ref || acc.name || acc.id;
            const logo = _accLogoHtml(acc, 14);
            const color = accountColors[idx % accountColors.length];
            return `<div
              class="utility-badge"
              style="background:${color};cursor:pointer;display:flex;align-items:center;gap:5px;"
              title="${acc.name || label} · ${txCount} txns — click to drill"
              onclick="window.ubDrillAccount('${acc.id}','${label.replace(/'/g, "\\'")}')"
            >${logo}${label}</div>`;
        }).join('');
    } else {
        badgesContainer.innerHTML = '<div style="text-align:center;padding:12px;color:#94a3b8;font-size:11px;">No active accounts</div>';
    }
};
