import React, { useState, useEffect, useRef } from 'react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtCAD = (n, alwaysCents = false) => {
  if (alwaysCents || Math.abs(n) < 1000) {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  }
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
};

const EXCLUDED_KINDS = new Set(['transfer', 'cc_payment', 'opening_balance']);

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const BAR_COLORS = ['#3b82f6','#8b5cf6','#f59e0b','#10b981','#f97316','#ec4899'];

function getLast6Months() {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTH_LABELS[d.getMonth()] });
  }
  return months;
}

// ─── Data computation ─────────────────────────────────────────────────────────

function computeDashboard() {
  const allTxns   = window.RoboLedger?.Ledger?.getAll?.()    || [];
  const accounts  = window.RoboLedger?.Accounts?.getAll?.()  || [];
  const coaList   = window.RoboLedger?.COA?.getAll?.()       || [];

  // Build COA lookup: code → name
  const coaMap = {};
  coaList.forEach(c => { coaMap[String(c.code)] = c.name; });

  // ── P&L-eligible transactions (exclude transfer/cc_payment/opening_balance)
  const plTxns = allTxns.filter(t => !EXCLUDED_KINDS.has(t.kind));

  // ── Revenue & Expenses
  let revenue = 0;
  let expenses = 0;
  const expenseByCat = {};

  plTxns.forEach(t => {
    const code = parseInt(t.category, 10) || 0;
    const amt  = Math.abs((t.amount_cents || 0) / 100);
    if (code >= 4000 && code < 5000) {
      revenue += amt;
    } else if (code >= 5000 && code < 9970) {
      expenses += amt;
      const catKey  = String(t.category || 'Uncategorized');
      const catName = t.category_name || coaMap[catKey] || `Code ${catKey}`;
      if (!expenseByCat[catKey]) expenseByCat[catKey] = { name: catName, total: 0 };
      expenseByCat[catKey].total += amt;
    }
  });

  // ── Top 6 expense categories
  const topExpenses = Object.entries(expenseByCat)
    .map(([code, v]) => ({ code, name: v.name, total: v.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // ── Gross flow (all kinds)
  let totalIn = 0;
  let totalOut = 0;
  allTxns.forEach(t => {
    const amt = Math.abs((t.amount_cents || 0) / 100);
    if (t.polarity === 'CREDIT') totalIn  += amt;
    else                          totalOut += amt;
  });

  // ── Cash position: last balance_cents per non-CC account
  const accountMap = {};
  accounts.forEach(a => { accountMap[a.id] = a; });

  // Last balance_cents per account_id from ledger
  const lastBalance = {};
  const lastDate    = {};
  const txCount     = {};
  allTxns.forEach(t => {
    if (t.balance_cents !== undefined && t.balance_cents !== null) {
      lastBalance[t.account_id] = t.balance_cents;
    }
    if (!lastDate[t.account_id] || t.date > lastDate[t.account_id]) {
      lastDate[t.account_id] = t.date;
    }
    txCount[t.account_id] = (txCount[t.account_id] || 0) + 1;
  });

  let cashPosition = 0;
  const accountSummaries = accounts.map(acc => {
    const isCC  = (acc.accountType || '').toUpperCase() === 'CREDITCARD';
    const bal   = (lastBalance[acc.id] !== undefined ? lastBalance[acc.id] : 0) / 100;
    if (!isCC) cashPosition += bal;
    return {
      id:       acc.id,
      name:     acc.name || acc.ref || 'Account',
      bankIcon: acc.bankIcon || null,
      bankName: acc.bankName || null,
      isCC,
      balance:  bal,
      lastDate: lastDate[acc.id] || null,
      count:    txCount[acc.id]  || 0,
      accountType: acc.accountType || 'Chequing',
    };
  });

  // ── GST
  let gstCollected = 0;
  let gstITC       = 0;
  let gstCount     = 0;
  allTxns.forEach(t => {
    if (!t.gst_enabled) return;
    const code = parseInt(t.category, 10) || 0;
    const tax  = Math.abs((t.tax_cents || 0) / 100);
    if (tax === 0) return;
    gstCount++;
    // Revenue categories → collected; Expense categories → ITC
    if (code >= 4000 && code < 5000) {
      gstCollected += tax;
    } else if (code >= 5000 && code < 9970) {
      gstITC += tax;
    } else {
      // Fallback: use polarity
      if (t.polarity === 'CREDIT') gstCollected += tax;
      else                          gstITC       += tax;
    }
  });

  // ── Action items
  const uncategorized  = allTxns.filter(t => !t.category || String(t.category) === '9970').length;
  const needsReview    = allTxns.filter(t => t.status === 'needs_review').length;
  const transfersCount = allTxns.filter(t => t.kind === 'transfer' || t.kind === 'cc_payment').length;

  // ── Monthly chart (last 6 months, P&L-only)
  const months6 = getLast6Months();
  const monthlyData = months6.map(m => {
    let rev = 0;
    let exp = 0;
    plTxns.forEach(t => {
      if (!t.date) return;
      const d    = new Date(t.date);
      const code = parseInt(t.category, 10) || 0;
      if (d.getFullYear() !== m.year || d.getMonth() !== m.month) return;
      const amt = Math.abs((t.amount_cents || 0) / 100);
      if (code >= 4000 && code < 5000) rev += amt;
      else if (code >= 5000 && code < 9970) exp += amt;
    });
    return { label: m.label, revenue: rev, expenses: exp };
  });

  // ── Recent 12 transactions (newest first)
  const recentTxns = [...allTxns]
    .sort((a, b) => {
      if (b.date > a.date) return 1;
      if (b.date < a.date) return -1;
      return 0;
    })
    .slice(0, 12)
    .map(t => ({
      tx_id:       t.tx_id,
      date:        t.date,
      payee:       t.payee || t.description || '—',
      description: t.description || '',
      accountName: accountMap[t.account_id]?.name || t.account_id || '—',
      category:    String(t.category || ''),
      categoryName:t.category_name || coaMap[String(t.category || '')] || (t.category ? `Code ${t.category}` : 'Uncategorized'),
      amount:      Math.abs((t.amount_cents || 0) / 100),
      polarity:    t.polarity,
      kind:        t.kind || 'standard',
    }));

  return {
    hasTxns: allTxns.length > 0,
    revenue,
    expenses,
    netIncome:     revenue - expenses,
    cashPosition,
    totalIn,
    totalOut,
    gstCollected,
    gstITC,
    gstNet:        gstCollected - gstITC,
    gstCount,
    topExpenses,
    accountSummaries,
    uncategorized,
    needsReview,
    transfersCount,
    monthlyData,
    recentTxns,
    clientName:    window.UI_STATE?.activeClientName || 'Client',
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ title, value, icon, color, onClick, sub }) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-2 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
      style={{ flex: 1, minWidth: 0 }}
    >
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
          {title}
        </span>
        <span className={`ph ${icon}`} style={{ fontSize: 22, color }} />
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1.15, marginTop: 2 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{sub}</div>
      )}
    </div>
  );
}

function GstTrackerCard({ collected, itc, net, count }) {
  const owing = net >= 0;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3" style={{ flex: '0 0 auto', minWidth: 0 }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
        <span className="ph ph-receipt" style={{ fontSize: 18, color: '#2563eb' }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>GST / HST Tracker</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>Collected (output)</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#16a34a' }}>{fmtCAD(collected)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>ITC / Paid (input)</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#dc2626' }}>−{fmtCAD(itc)}</span>
        </div>
        <div style={{ height: 1, background: '#f1f5f9', margin: '2px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
            {owing ? 'GST Owing' : 'GST Refund'}
          </span>
          <span style={{
            fontSize: 15, fontWeight: 800,
            color: owing ? '#dc2626' : '#16a34a',
            background: owing ? '#fef2f2' : '#f0fdf4',
            borderRadius: 6, padding: '2px 10px',
          }}>
            {fmtCAD(Math.abs(net))}
          </span>
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span className="ph ph-clock" style={{ fontSize: 13 }} />
        {count} GST-enabled txns &nbsp;·&nbsp; Remit quarterly to CRA
      </div>
    </div>
  );
}

function RevenueTrendChart({ monthlyData }) {
  const maxVal = Math.max(1, ...monthlyData.map(m => Math.max(m.revenue, m.expenses)));
  const CHART_H = 140; // Taller bars now that the chart is full-width

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="ph ph-chart-bar" style={{ fontSize: 18, color: '#2563eb' }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Revenue vs Expenses — Last 6 Months</span>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#64748b' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#16a34a', display: 'inline-block' }} />
            Revenue
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#dc2626', display: 'inline-block' }} />
            Expenses
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: CHART_H + 24, paddingTop: 4 }}>
        {monthlyData.map((m, i) => {
          const revH = maxVal > 0 ? Math.round((m.revenue / maxVal) * CHART_H) : 0;
          const expH = maxVal > 0 ? Math.round((m.expenses / maxVal) * CHART_H) : 0;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: CHART_H, width: '100%', justifyContent: 'center' }}>
                <div
                  title={`Revenue: ${fmtCAD(m.revenue)}`}
                  style={{
                    width: '42%', height: revH || 2,
                    background: '#16a34a', borderRadius: '3px 3px 0 0',
                    opacity: m.revenue === 0 ? 0.2 : 1,
                    transition: 'height 0.4s ease',
                    cursor: 'default',
                  }}
                />
                <div
                  title={`Expenses: ${fmtCAD(m.expenses)}`}
                  style={{
                    width: '42%', height: expH || 2,
                    background: '#dc2626', borderRadius: '3px 3px 0 0',
                    opacity: m.expenses === 0 ? 0.2 : 1,
                    transition: 'height 0.4s ease',
                    cursor: 'default',
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5, textAlign: 'center' }}>{m.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionItemsCard({ uncategorized, needsReview, transfersCount }) {
  const allGood = uncategorized === 0 && needsReview === 0;

  const navImport = () => window.navigateTo?.('import');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3" style={{ flex: 1, minWidth: 0 }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
        <span className="ph ph-bell-ringing" style={{ fontSize: 18, color: '#f59e0b' }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Action Items</span>
      </div>

      {allGood ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '12px 0', gap: 8 }}>
          <span className="ph ph-check-circle" style={{ fontSize: 32, color: '#16a34a' }} />
          <span style={{ fontSize: 13, color: '#64748b', textAlign: 'center' }}>All caught up — books are clean</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {uncategorized > 0 && (
            <div
              onClick={navImport}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', borderRadius: 8,
                background: '#fef2f2', border: '1px solid #fecaca',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="ph ph-warning-circle" style={{ fontSize: 16, color: '#dc2626' }} />
                <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>Uncategorized transactions</span>
              </div>
              <span style={{
                background: '#dc2626', color: 'white',
                borderRadius: 999, fontSize: 11, fontWeight: 700,
                padding: '1px 8px', minWidth: 22, textAlign: 'center',
              }}>{uncategorized}</span>
            </div>
          )}

          {needsReview > 0 && (
            <div
              onClick={navImport}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', borderRadius: 8,
                background: '#fffbeb', border: '1px solid #fde68a',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="ph ph-eye" style={{ fontSize: 16, color: '#d97706' }} />
                <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>Needs review</span>
              </div>
              <span style={{
                background: '#f59e0b', color: 'white',
                borderRadius: 999, fontSize: 11, fontWeight: 700,
                padding: '1px 8px', minWidth: 22, textAlign: 'center',
              }}>{needsReview}</span>
            </div>
          )}

          {transfersCount > 0 && (
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', borderRadius: 8,
                background: '#f0f9ff', border: '1px solid #bae6fd',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="ph ph-arrows-left-right" style={{ fontSize: 16, color: '#0284c7' }} />
                <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>Transfers / CC payments</span>
              </div>
              <span style={{
                background: '#0ea5e9', color: 'white',
                borderRadius: 999, fontSize: 11, fontWeight: 700,
                padding: '1px 8px', minWidth: 22, textAlign: 'center',
              }}>{transfersCount}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TopExpensesCard({ topExpenses, totalExpenses }) {
  if (topExpenses.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3" style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center gap-2">
          <span className="ph ph-chart-pie-slice" style={{ fontSize: 18, color: '#dc2626' }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Top Expenses</span>
        </div>
        <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No expense data yet</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3" style={{ flex: 1, minWidth: 0 }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
        <span className="ph ph-chart-pie-slice" style={{ fontSize: 18, color: '#dc2626' }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Top Expenses</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {topExpenses.map((cat, i) => {
          const pct = totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0;
          const color = BAR_COLORS[i % BAR_COLORS.length];
          return (
            <div key={cat.code} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#1e293b', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                  {cat.name}
                </span>
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {fmtCAD(cat.total)} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({pct.toFixed(1)}%)</span>
                </span>
              </div>
              <div style={{ height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AccountBalancesCard({ accounts }) {
  if (accounts.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3" style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center gap-2">
          <span className="ph ph-bank" style={{ fontSize: 18, color: '#2563eb' }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Account Balances</span>
        </div>
        <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No accounts yet</div>
      </div>
    );
  }

  const fmtDate = (d) => {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
    } catch { return d; }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col" style={{ flex: 1, minWidth: 0, gap: 0 }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 12, flexShrink: 0 }}>
        <span className="ph ph-bank" style={{ fontSize: 18, color: '#2563eb' }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Account Balances</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{accounts.length} accounts</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: 2 }}>
        {accounts.map(acc => {
          const balColor = acc.isCC
            ? (acc.balance < 0 ? '#dc2626' : '#16a34a')
            : (acc.balance >= 0 ? '#16a34a' : '#dc2626');

          // Resolve logo from bankIcon (set by parsers) or bankName (fallback for older accounts)
          const _b = (acc.bankIcon || acc.bankName || acc.name || '').toLowerCase();
          const _brand = (acc.brand || acc.cardNetwork || '').toLowerCase();
          const logoSrc = _b.includes('scotia')                          ? '/logos/scotia.png'
                        : (_b.includes('rbc') || _b.includes('royal'))  ? '/logos/rbc.png'
                        : (_b.includes('td') || _b.includes('dominion'))? '/logos/td.png'
                        : (_b.includes('bmo') || _b.includes('montreal'))? '/logos/bmo.png'
                        : _b.includes('cibc')                            ? '/logos/cibc.png'
                        : _brand.includes('visa')                        ? '/logos/visa.png'
                        : (_brand.includes('mc') || _brand.includes('mastercard')) ? '/logos/mastercard.png'
                        : (_brand.includes('amex') || _brand.includes('american')) ? '/logos/amex.png'
                        : null;

          return (
            <div key={acc.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8,
              background: '#f8fafc', border: '1px solid #f1f5f9',
            }}>
              {logoSrc
                ? <img src={logoSrc} alt="" style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0, borderRadius: 3 }} />
                : <span className={`ph ${acc.isCC ? 'ph-credit-card' : 'ph-bank'}`} style={{ fontSize: 20, color: '#64748b', flexShrink: 0 }} />
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {acc.name}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                  {acc.count} txns &nbsp;·&nbsp; Last: {fmtDate(acc.lastDate)}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: balColor, whiteSpace: 'nowrap' }}>
                {fmtCAD(acc.balance)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KindBadge({ kind }) {
  if (!kind || kind === 'standard') return null;
  const styles = {
    transfer:        { bg: '#eff6ff', color: '#2563eb', label: 'Transfer' },
    cc_payment:      { bg: '#fff7ed', color: '#ea580c', label: 'CC Payment' },
    loan_payment:    { bg: '#f9fafb', color: '#6b7280', label: 'Loan' },
    opening_balance: { bg: '#f5f3ff', color: '#7c3aed', label: 'Opening' },
  };
  const s = styles[kind] || { bg: '#f1f5f9', color: '#64748b', label: kind };
  return (
    <span style={{
      background: s.bg, color: s.color,
      borderRadius: 4, fontSize: 10, fontWeight: 700,
      padding: '1px 6px', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {s.label}
    </span>
  );
}

function RecentTransactionsCard({ txns }) {
  const fmtDate = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: '2-digit' }); }
    catch { return d; }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5" style={{ width: '100%' }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
        <span className="ph ph-list-bullets" style={{ fontSize: 18, color: '#2563eb' }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Recent Transactions</span>
        <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>Last {txns.length}</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              {['Date','Payee / Description','Account','Category','Amount',''].map((h, i) => (
                <th key={i} style={{
                  textAlign: i === 4 ? 'right' : 'left',
                  padding: '0 10px 8px',
                  fontWeight: 600, fontSize: 11,
                  color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {txns.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>
                  No transactions yet
                </td>
              </tr>
            ) : txns.map((t, i) => (
              <tr key={t.tx_id || i} style={{
                borderBottom: '1px solid #f8fafc',
                background: i % 2 === 0 ? 'transparent' : '#fafafa',
              }}>
                <td style={{ padding: '7px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(t.date)}</td>
                <td style={{ padding: '7px 10px', maxWidth: 220 }}>
                  <div style={{ fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.payee}
                  </div>
                  {t.description && t.description !== t.payee && (
                    <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.description}
                    </div>
                  )}
                </td>
                <td style={{ padding: '7px 10px', color: '#64748b', whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.accountName}</td>
                <td style={{ padding: '7px 10px', color: '#64748b', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.categoryName}</td>
                <td style={{
                  padding: '7px 10px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap',
                  color: t.polarity === 'CREDIT' ? '#16a34a' : '#dc2626',
                }}>
                  {t.polarity === 'CREDIT' ? '+' : '−'}{fmtCAD(t.amount)}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                  <KindBadge kind={t.kind} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuickActionsBar() {
  const actions = [
    { label: 'Import Statement',    icon: 'ph-upload-simple',  route: 'import',   color: '#2563eb' },
    { label: 'View Reports',        icon: 'ph-chart-line',     route: 'reports',  color: '#16a34a' },
    { label: 'Open COA',            icon: 'ph-tree-structure', route: 'coa',      color: '#7c3aed' },
    { label: 'Add Journal Entry',   icon: 'ph-pencil-simple',  route: 'journal',  color: '#ea580c' },
  ];

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {actions.map(a => (
        <button
          key={a.route}
          onClick={() => window.navigateTo?.(a.route)}
          style={{
            flex: '1 1 160px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '11px 18px',
            background: 'white', border: `1.5px solid ${a.color}20`,
            borderRadius: 10, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, color: a.color,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            transition: 'box-shadow 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${a.color}08`; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.09)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
        >
          <span className={`ph ${a.icon}`} style={{ fontSize: 17 }} />
          {a.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 380, gap: 16, padding: 40, textAlign: 'center',
    }}>
      <span className="ph ph-cloud-slash" style={{ fontSize: 56, color: '#cbd5e1' }} />
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
          No transactions imported yet
        </div>
        <div style={{ fontSize: 14, color: '#64748b', maxWidth: 340, margin: '0 auto' }}>
          Import a bank or credit card statement to see your financial dashboard come to life.
        </div>
      </div>
      <button
        onClick={() => window.navigateTo?.('import')}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '11px 24px',
          background: '#2563eb', color: 'white',
          border: 'none', borderRadius: 9, cursor: 'pointer',
          fontSize: 14, fontWeight: 600,
          boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
        }}
      >
        <span className="ph ph-upload-simple" style={{ fontSize: 18 }} />
        Import Statement
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const HomePage = () => {
  const [data, setData] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const compute = () => {
      try {
        setData(computeDashboard());
      } catch (err) {
        console.error('[HomePage] compute error:', err);
      }
    };

    compute();
    intervalRef.current = setInterval(compute, 3000);
    return () => clearInterval(intervalRef.current);
  }, []);

  if (!data) {
    return (
      <div style={{ background: '#f4f6f8', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="ph ph-spinner" style={{ fontSize: 32, color: '#94a3b8', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const {
    hasTxns, revenue, expenses, netIncome, cashPosition, totalIn, totalOut,
    gstCollected, gstITC, gstNet, gstCount,
    topExpenses, accountSummaries, uncategorized, needsReview, transfersCount,
    monthlyData, recentTxns, clientName,
  } = data;

  const netColor      = netIncome >= 0 ? '#16a34a' : '#dc2626';
  const netIcon       = netIncome >= 0 ? 'ph-trend-up' : 'ph-trend-down';
  const cashColor     = cashPosition >= 0 ? '#2563eb' : '#dc2626';

  return (
    <div style={{ background: '#f4f6f8', minHeight: '100vh', padding: '24px 28px 40px', boxSizing: 'border-box' }}>

      {/* Page Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0, letterSpacing: '-0.01em' }}>
          {clientName} — Dashboard
        </h1>
        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 3 }}>
          Fiscal overview &nbsp;·&nbsp; Auto-refreshes every 3 seconds
        </div>
      </div>

      {!hasTxns ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <EmptyState />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Row 1: KPI Cards */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'nowrap' }}>
            <KpiCard
              title="Net Income"
              value={fmtCAD(Math.abs(netIncome))}
              icon={netIcon}
              color={netColor}
              sub={netIncome >= 0 ? 'Profit YTD' : 'Loss YTD'}
            />
            <KpiCard
              title="Revenue"
              value={fmtCAD(revenue)}
              icon="ph-arrow-down-left"
              color="#16a34a"
              sub={`${totalIn > 0 ? fmtCAD(totalIn) : '—'} gross in`}
              onClick={() => window.navigateTo?.('reports')}
            />
            <KpiCard
              title="Expenses"
              value={fmtCAD(expenses)}
              icon="ph-arrow-up-right"
              color="#dc2626"
              sub={`${totalOut > 0 ? fmtCAD(totalOut) : '—'} gross out`}
            />
            <KpiCard
              title="Cash Position"
              value={fmtCAD(cashPosition)}
              icon="ph-bank"
              color={cashColor}
              sub={`${accountSummaries.filter(a => !a.isCC).length} bank account${accountSummaries.filter(a => !a.isCC).length !== 1 ? 's' : ''}`}
            />
          </div>

          {/* Row 2: Revenue Chart — full width now that GST moved into the grid below */}
          <RevenueTrendChart monthlyData={monthlyData} />

          {/* Row 3: CSS Grid — left col stacks 3 naturally-sized cards (no stretch/void),
               right col = Account Balances spanning all 3 rows, fills height and scrolls.
               minHeight:0 on the Account Balances wrapper tells the grid NOT to inflate
               row heights to accommodate it — rows size to left-col content only. */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
          }}>

            {/* Left col · row 1 — GST Tracker (moved here from standalone row) */}
            <div style={{ alignSelf: 'start' }}>
              <GstTrackerCard
                collected={gstCollected}
                itc={gstITC}
                net={gstNet}
                count={gstCount}
              />
            </div>

            {/* Right col · rows 1–3 — Account Balances fills the combined left-stack height */}
            <div style={{
              gridRow: 'span 3',
              minHeight: 0,           // Prevents this item from inflating grid row heights
              display: 'flex',
              flexDirection: 'column',
            }}>
              <AccountBalancesCard accounts={accountSummaries} />
            </div>

            {/* Left col · row 2 — Action Items */}
            <div style={{ alignSelf: 'start' }}>
              <ActionItemsCard
                uncategorized={uncategorized}
                needsReview={needsReview}
                transfersCount={transfersCount}
              />
            </div>

            {/* Left col · row 3 — Top Expenses */}
            <div style={{ alignSelf: 'start' }}>
              <TopExpensesCard topExpenses={topExpenses} totalExpenses={expenses} />
            </div>

          </div>

          {/* Row 4: Recent Transactions */}
          <RecentTransactionsCard txns={recentTxns} />

          {/* Quick Actions */}
          <QuickActionsBar />

        </div>
      )}
    </div>
  );
};

export default HomePage;
