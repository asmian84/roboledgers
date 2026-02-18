import React, { useState } from 'react';

/**
 * FilterToolbar - Sticky toolbar with search, filters, and controls
 * Replaces the vanilla JS getFilterToolbarHTML() from app.js
 *
 * Supports two panel modes:
 * - Single panel toggle (onTogglePanel) — used by TransactionsTable.jsx
 * - Separate TB/UB toggles (onToggleReportPanel, onToggleUtilityBar) — used by TransactionsTable2.jsx
 */
export function FilterToolbar({
    refPrefix = 'CHQ1',
    searchQuery = '',
    selectedAccount = 'ALL',
    accounts = [],
    onRefPrefixChange,
    onSearchChange,
    onAccountChange,
    onToggleFilters,
    onToggleSettings,
    onTogglePanel,
    onToggleReportPanel,
    onToggleUtilityBar,
    onExport,
    isDetailMode = false,
    isPanelOpen = false,
    activePanel = null,      // 'utility' | 'report' | null — for TransactionsTable2
    activeFilter = null,     // string label of current filter (e.g. "Office Supplies") or null
    onClearFilter,           // () => void — called to clear the active filter
}) {
    const [showExportMenu, setShowExportMenu] = useState(false);

    const handleExport = (format) => {
        if (onExport) onExport(format);
        setShowExportMenu(false);
    };

    const btnClass = "h-[30px] px-2 border border-[#e5e7eb] bg-white rounded-md cursor-pointer flex items-center gap-1 transition-all hover:bg-[#f9fafb] hover:border-[#d1d5db] active:bg-[#f3f4f6]";
    const activeBtnClass = "!bg-[#eef2ff] !border-[#c7d2fe]";

    // Determine which panel mode we're in
    const hasSeparatePanels = !!(onToggleReportPanel || onToggleUtilityBar);

    return (
        <div
            className="sticky top-0 z-50 flex items-center justify-between px-4 bg-white border-b border-[#e5e7eb] gap-3"
            style={{
                height: '42px',
                minHeight: '42px',
            }}
        >
            {/* LEFT: Ref Prefix + Search + Account Filter */}
            <div className="flex items-center gap-2">
                {/* Ref# Prefix Input */}
                <div className="flex items-center gap-1.5">
                    <label className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wide">Ref#</label>
                    <input
                        type="text"
                        placeholder="CHQ1"
                        value={refPrefix}
                        onChange={(e) => onRefPrefixChange?.(e.target.value)}
                        maxLength={8}
                        className="px-2 py-1 border border-[#e5e7eb] rounded-md text-[11px] w-[56px] bg-[#fafbfc] font-mono font-semibold uppercase text-center focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]/20 transition-colors"
                    />
                </div>

                {/* Separator */}
                <div className="w-px h-5 bg-[#e5e7eb]"></div>

                {/* Search */}
                <div className="relative">
                    <i className="ph ph-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] text-[13px]"></i>
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange?.(e.target.value)}
                        className="pl-7 pr-3 py-1 border border-[#e5e7eb] rounded-md text-[12px] w-[200px] bg-[#fafbfc] placeholder-[#c0c4cc] focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]/20 focus:bg-white transition-colors"
                    />
                </div>

                {/* Account Filter */}
                <select
                    value={selectedAccount}
                    onChange={(e) => onAccountChange?.(e.target.value)}
                    className="px-2.5 py-1 border border-[#e5e7eb] rounded-md text-[12px] text-[#6b7280] bg-[#fafbfc] cursor-pointer hover:border-[#d1d5db] focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]/20 transition-colors"
                    style={{ appearance: 'none', paddingRight: '24px' }}
                >
                    <option value="ALL">All Accounts</option>
                    {accounts.map(a => (
                        <option key={a.id} value={a.id}>
                            {a.ref || a.name || a.id}
                        </option>
                    ))}
                </select>

                {/* Active Filter Pill — visible when a predicate filter is active */}
                {activeFilter && (
                    <>
                        <div className="w-px h-5 bg-[#e5e7eb]"></div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-300 rounded-full text-[11px] font-semibold text-amber-800 max-w-[180px]">
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="shrink-0 text-amber-500">
                                <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                            <span className="truncate">{activeFilter}</span>
                            <button
                                onClick={() => onClearFilter?.()}
                                className="ml-0.5 shrink-0 w-4 h-4 flex items-center justify-center rounded-full hover:bg-amber-200 text-amber-600 transition-colors"
                                title="Clear filter — show all transactions"
                            >
                                <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                                    <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                                </svg>
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* RIGHT: Export + Panel Toggles + Grid Settings */}
            <div className="flex items-center gap-1.5">
                {/* Export Button with Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        className={btnClass}
                        title="Export Transactions"
                    >
                        <i className="ph ph-download-simple text-[14px] text-[#6b7280]"></i>
                    </button>

                    {/* Export Dropdown Menu */}
                    {showExportMenu && (
                        <div className="absolute top-[calc(100%+4px)] right-0 bg-white border border-[#e5e7eb] rounded-lg min-w-[170px] z-[1000] py-1"
                            style={{ boxShadow: '0 4px 12px -2px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.06)' }}
                        >
                            <button
                                onClick={() => handleExport('csv')}
                                className="w-full px-3 py-2 text-left text-[13px] text-[#374151] flex items-center gap-2.5 hover:bg-[#f9fafb] transition-colors"
                            >
                                <i className="ph ph-file-csv text-[15px] text-[#059669]"></i>
                                <span>Export CSV</span>
                            </button>
                            <button
                                onClick={() => handleExport('xlsx')}
                                className="w-full px-3 py-2 text-left text-[13px] text-[#374151] flex items-center gap-2.5 hover:bg-[#f9fafb] transition-colors"
                            >
                                <i className="ph ph-file-xls text-[15px] text-[#059669]"></i>
                                <span>Export XLSX</span>
                            </button>
                            <button
                                onClick={() => handleExport('xlsx-all')}
                                className="w-full px-3 py-2 text-left text-[13px] text-[#374151] flex items-center gap-2.5 hover:bg-[#f9fafb] transition-colors"
                            >
                                <i className="ph ph-stack text-[15px] text-[#059669]"></i>
                                <span>Export All Accounts (XLSX)</span>
                            </button>
                            <button
                                onClick={() => handleExport('xlsx-caseware')}
                                className="w-full px-3 py-2 text-left text-[13px] text-[#374151] flex items-center gap-2.5 hover:bg-[#f9fafb] transition-colors"
                            >
                                <i className="ph ph-archive text-[15px] text-[#7c3aed]"></i>
                                <span>Export Caseware ZIP <span className="text-[11px] text-[#9ca3af]">(1 file / account)</span></span>
                            </button>
                            <button
                                onClick={() => handleExport('json')}
                                className="w-full px-3 py-2 text-left text-[13px] text-[#374151] flex items-center gap-2.5 hover:bg-[#f9fafb] transition-colors"
                            >
                                <i className="ph ph-file-code text-[15px] text-[#6366f1]"></i>
                                <span>Export JSON</span>
                            </button>
                            <div className="border-t border-[#f3f4f6] my-0.5"></div>
                            <button
                                onClick={() => handleExport('uncategorized')}
                                className="w-full px-3 py-2 text-left text-[13px] text-[#374151] flex items-center gap-2.5 hover:bg-[#f9fafb] transition-colors"
                            >
                                <i className="ph ph-funnel-simple text-[15px] text-[#d97706]"></i>
                                <span>Uncategorized Only</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Filter Toggle Button */}
                <button
                    onClick={onToggleFilters}
                    className={btnClass}
                    title="Toggle Column Filters"
                >
                    <i className="ph ph-funnel text-[14px] text-[#6b7280]"></i>
                </button>

                {/* DETAIL MODE PANEL TOGGLES */}
                {isDetailMode && hasSeparatePanels && (
                    <>
                        {/* Separator */}
                        <div className="w-px h-5 bg-[#e5e7eb]"></div>

                        {/* UB: Utility Bar / Dashboard Toggle */}
                        <button
                            onClick={onToggleUtilityBar}
                            className={`${btnClass} ${activePanel === 'utility' ? activeBtnClass : ''}`}
                            title={activePanel === 'utility' ? 'Close Dashboard' : 'Open Dashboard & Stats'}
                        >
                            <i className={`ph ph-squares-four text-[14px] ${activePanel === 'utility' ? 'text-[#4f46e5]' : 'text-[#6b7280]'}`}></i>
                        </button>

                        {/* TB: Trial Balance Toggle */}
                        <button
                            onClick={onToggleReportPanel}
                            className={`${btnClass} ${activePanel === 'report' ? activeBtnClass : ''}`}
                            title={activePanel === 'report' ? 'Close Trial Balance' : 'Open Trial Balance'}
                        >
                            <i className={`ph ph-scales text-[14px] ${activePanel === 'report' ? 'text-[#4f46e5]' : 'text-[#6b7280]'}`}></i>
                        </button>
                    </>
                )}

                {/* Legacy single panel toggle (TransactionsTable.jsx) */}
                {isDetailMode && !hasSeparatePanels && onTogglePanel && (
                    <button
                        onClick={onTogglePanel}
                        className={`${btnClass} ${isPanelOpen ? activeBtnClass : ''}`}
                        title={isPanelOpen ? 'Close Side Panel' : 'Open Side Panel'}
                    >
                        <i className={`ph ph-layout text-[14px] ${isPanelOpen ? 'text-[#4f46e5]' : 'text-[#6b7280]'}`}></i>
                    </button>
                )}

                {/* Settings Gear */}
                <button
                    onClick={onToggleSettings}
                    className={btnClass}
                    title="Grid Settings (Appearance & Columns)"
                >
                    <i className="ph ph-gear-six text-[14px] text-[#6b7280]"></i>
                </button>
            </div>
        </div>
    );
}
