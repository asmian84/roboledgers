import React, { useState } from 'react';

/**
 * FilterToolbar - Sticky toolbar with search, filters, and controls
 * Replaces the vanilla JS getFilterToolbarHTML() from app.js
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
    onExport
}) {
    const [showExportMenu, setShowExportMenu] = useState(false);

    const handleExport = (format) => {
        if (onExport) onExport(format);
        setShowExportMenu(false);
    };

    return (
        <div
            className="sticky top-0 z-50 flex items-center justify-between px-6 py-2.5 bg-[#f8fafc] border-b border-[#e2e8f0] gap-3"
            style={{
                height: '44px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
            }}
        >
            {/* LEFT: Ref Prefix + Search + Account Filter */}
            <div className="flex items-center gap-2">
                {/* Ref# Prefix Input */}
                <div className="flex items-center gap-1">
                    <label className="text-[11px] font-semibold text-[#64748b] uppercase">Ref#</label>
                    <input
                        type="text"
                        placeholder="CHQ1"
                        value={refPrefix}
                        onChange={(e) => onRefPrefixChange?.(e.target.value)}
                        maxLength={8}
                        className="px-2 py-1.5 border border-[#e2e8f0] rounded-md text-[11px] w-[60px] bg-white font-mono font-semibold uppercase text-center"
                    />
                </div>

                {/* Search */}
                <div className="relative">
                    <i className="ph ph-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm"></i>
                    <input
                        type="text"
                        placeholder="Search transactions..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange?.(e.target.value)}
                        className="pl-8 pr-3 py-1.5 border border-[#e2e8f0] rounded-md text-xs w-[220px] bg-white"
                    />
                </div>

                {/* Account Filter */}
                <select
                    value={selectedAccount}
                    onChange={(e) => onAccountChange?.(e.target.value)}
                    className="px-2.5 pr-7 py-1.5 border border-[#e2e8f0] rounded-md text-xs text-[#64748b] bg-white cursor-pointer"
                    style={{ appearance: 'none' }}
                >
                    <option value="ALL">All Accounts</option>
                    {accounts.map(a => (
                        <option key={a.id} value={a.id}>
                            {a.ref || a.name || a.id}
                        </option>
                    ))}
                </select>
            </div>

            {/* RIGHT: Export + Grid Settings Icons */}
            <div className="flex items-center gap-2">
                {/* Export Button with Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        className="px-2.5 py-2 border border-[#e2e8f0] bg-white rounded-md cursor-pointer flex items-center gap-1 transition-colors hover:bg-[#f1f5f9]"
                        title="Export Transactions"
                    >
                        <i className="ph ph-download-simple text-base text-[#64748b]"></i>
                    </button>

                    {/* Export Dropdown Menu */}
                    {showExportMenu && (
                        <div className="absolute top-[calc(100%+4px)] right-0 bg-white border border-[#e2e8f0] rounded-lg shadow-lg min-w-[180px] z-[1000]">
                            <button
                                onClick={() => handleExport('csv')}
                                className="w-full px-4 py-2.5 text-left text-sm text-[#1e293b] flex items-center gap-2 border-b border-[#f1f5f9] hover:bg-[#f8fafc]"
                            >
                                <i className="ph ph-file-csv text-base text-[#10b981]"></i>
                                <span>Export CSV</span>
                            </button>
                            <button
                                onClick={() => handleExport('excel')}
                                className="w-full px-4 py-2.5 text-left text-sm text-[#1e293b] flex items-center gap-2 border-b border-[#f1f5f9] hover:bg-[#f8fafc]"
                            >
                                <i className="ph ph-file-xls text-base text-[#10b981]"></i>
                                <span>Export Excel CSV</span>
                            </button>
                            <button
                                onClick={() => handleExport('json')}
                                className="w-full px-4 py-2.5 text-left text-sm text-[#1e293b] flex items-center gap-2 border-b border-[#f1f5f9] hover:bg-[#f8fafc]"
                            >
                                <i className="ph ph-file-code text-base text-[#3b82f6]"></i>
                                <span>Export JSON</span>
                            </button>
                            <button
                                onClick={() => handleExport('uncategorized')}
                                className="w-full px-4 py-2.5 text-left text-sm text-[#1e293b] flex items-center gap-2 hover:bg-[#f8fafc]"
                            >
                                <i className="ph ph-funnel-simple text-base text-[#f59e0b]"></i>
                                <span>Uncategorized Only</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Filter Toggle Button */}
                <button
                    onClick={onToggleFilters}
                    className="relative px-2.5 py-2 border border-[#e2e8f0] bg-white rounded-md cursor-pointer flex items-center gap-1.5 transition-colors hover:bg-[#f1f5f9]"
                    title="Toggle Column Filters"
                >
                    <i className="ph ph-funnel text-base text-[#64748b]"></i>
                </button>

                {/* Settings Gear */}
                <button
                    onClick={onToggleSettings}
                    className="px-2.5 py-2 border border-[#e2e8f0] bg-white rounded-md cursor-pointer flex items-center gap-1 transition-colors hover:bg-[#f1f5f9]"
                    title="Grid Settings (Appearance & Columns)"
                >
                    <i className="ph ph-gear-six text-base text-[#64748b]"></i>
                </button>
            </div>
        </div>
    );
}
