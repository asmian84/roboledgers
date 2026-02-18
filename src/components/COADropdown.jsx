import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * COA Dropdown - Searchable, categorized Chart of Accounts selector
 * Groups accounts by: Assets, Liabilities, Equity, Revenue, Expenses
 */
export function COADropdown({ value, onChange, txId }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [buttonRect, setButtonRect] = useState(null);
    // Find which category the current value belongs to, expand it by default
    const currentRoot = allAccounts.find(a => a.code === value)?.root || 'EXPENSE';
    const [collapsedCategories, setCollapsedCategories] = useState({
        ASSET:     currentRoot !== 'ASSET',
        LIABILITY: currentRoot !== 'LIABILITY',
        EQUITY:    currentRoot !== 'EQUITY',
        REVENUE:   currentRoot !== 'REVENUE',
        EXPENSE:   currentRoot !== 'EXPENSE',  // EXPENSE open by default (most common)
    });
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const dropdownRef = useRef(null);
    const buttonRef = useRef(null);
    const portalRef = useRef(null);
    const searchInputRef = useRef(null);

    // Get all COA accounts from ledger
    const allAccounts = window.RoboLedger?.COA?.getAll() || [];

    // Find current selection
    const currentAccount = allAccounts.find(acc => acc.code === value);
    const displayValue = currentAccount
        ? currentAccount.name  // Show only name (e.g., "Bank - chequing")
        : 'Uncategorized';

    // Category labels and order
    const CATEGORIES = [
        { key: 'ASSET', label: 'ASSETS', icon: '💼' },
        { key: 'LIABILITY', label: 'LIABILITIES', icon: '💳' },
        { key: 'EQUITY', label: 'EQUITY', icon: '📊' },
        { key: 'REVENUE', label: 'REVENUE', icon: '💰' },
        { key: 'EXPENSE', label: 'EXPENSES', icon: '📤' }
    ];

    // Filter accounts by search query
    const filteredAccounts = searchQuery.trim()
        ? allAccounts.filter(acc => {
            const search = searchQuery.toLowerCase();
            return acc.name.toLowerCase().includes(search) ||
                acc.code.includes(search);
        })
        : allAccounts;

    // Group filtered accounts by category
    const groupedAccounts = CATEGORIES.reduce((acc, cat) => {
        acc[cat.key] = filteredAccounts.filter(account => account.root === cat.key);
        return acc;
    }, {});

    // Auto-expand categories that have matching accounts when searching
    useEffect(() => {
        if (searchQuery.trim()) {
            const newCollapsed = { ...collapsedCategories };
            CATEGORIES.forEach(cat => {
                if (groupedAccounts[cat.key]?.length > 0) {
                    newCollapsed[cat.key] = false; // Expand if has matches
                }
            });
            setCollapsedCategories(newCollapsed);
        }
    }, [searchQuery]);

    // Build flat list for keyboard navigation
    const flatList = CATEGORIES.flatMap(cat => {
        const accounts = groupedAccounts[cat.key];
        if (accounts.length === 0) return [];
        if (collapsedCategories[cat.key]) return [];
        return accounts;
    });

    // Toggle category collapse
    const toggleCategory = (catKey) => {
        setCollapsedCategories(prev => ({ ...prev, [catKey]: !prev[catKey] }));
    };

    // Handle account selection
    const selectAccount = (code) => {
        onChange(code);
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
    };

    // Click outside to close
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e) => {
            // Check if click is outside both the trigger button AND the portaled dropdown
            const clickedOutsideButton = dropdownRef.current && !dropdownRef.current.contains(e.target);
            const clickedOutsidePortal = portalRef.current && !portalRef.current.contains(e.target);

            if (clickedOutsideButton && clickedOutsidePortal) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Auto-focus search when opened + scroll selected item into view
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
        if (isOpen && value) {
            // Small delay to let portal render
            setTimeout(() => {
                const selectedEl = portalRef.current?.querySelector('[data-selected="true"]');
                if (selectedEl) selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }, 50);
        }
    }, [isOpen]);

    // Keyboard navigation
    const handleKeyDown = (e) => {
        if (!isOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev =>
                    prev < flatList.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0 && flatList[highlightedIndex]) {
                    selectAccount(flatList[highlightedIndex].code);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                setSearchQuery('');
                break;
        }
    };

    // Update button position when opening dropdown
    const handleToggle = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setButtonRect(rect);
        }
        setIsOpen(!isOpen);
    };

    const isUncategorized = !currentAccount;

    return (
        <div ref={dropdownRef} className="relative w-full" onKeyDown={handleKeyDown}>
            {/* Trigger Button */}
            <button
                ref={buttonRef}
                onClick={handleToggle}
                className="w-full text-left rounded transition-colors group"
                style={{
                    padding: '3px 6px',
                    fontSize: '12px',
                    fontWeight: isUncategorized ? 400 : 500,
                    color: isUncategorized ? '#94a3b8' : '#1e293b',
                    background: isOpen ? '#eff6ff' : 'transparent',
                    border: `1px solid ${isOpen ? '#93c5fd' : 'transparent'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    width: '100%',
                    cursor: 'pointer',
                }}
                onMouseEnter={e => { if (!isOpen) { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}}
                onMouseLeave={e => { if (!isOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}}
            >
                {currentAccount && (
                    <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#94a3b8', flexShrink: 0 }}>
                        {currentAccount.code}
                    </span>
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {displayValue}
                </span>
                <i className="ph ph-caret-down" style={{ fontSize: '10px', color: '#94a3b8', flexShrink: 0, opacity: 0.6 }}></i>
            </button>

            {/* Dropdown Menu - Portal to body */}
            {isOpen && buttonRect && createPortal(
                <div
                    ref={portalRef}
                    className="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
                    style={{
                        position: 'fixed',
                        left: `${buttonRect.left}px`,
                        top: `${buttonRect.bottom + 4}px`,
                        minWidth: '320px',
                        width: 'auto',
                        maxWidth: '520px',
                        maxHeight: '420px',
                        zIndex: 9999
                    }}
                >
                    {/* Search Bar */}
                    <div className="sticky top-0 bg-white border-b border-gray-200 p-3 z-10">
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search accounts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            style={{ fontSize: '13px' }}
                        />
                    </div>

                    {/* Account Categories */}
                    <div className="overflow-y-auto" style={{ maxHeight: '340px' }}>
                        {CATEGORIES.map(cat => {
                            const accounts = groupedAccounts[cat.key];
                            if (accounts.length === 0 && searchQuery) return null;

                            const isCollapsed = collapsedCategories[cat.key];

                            return (
                                <div key={cat.key}>
                                    {/* Category Header */}
                                    <button
                                        onClick={() => toggleCategory(cat.key)}
                                        className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200"
                                        style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em' }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span>{isCollapsed ? '▶' : '▼'}</span>
                                            <span className="text-gray-700">{cat.label}</span>
                                        </div>
                                        <span className="text-gray-500 font-semibold">{accounts.length}</span>
                                    </button>

                                    {/* Account List */}
                                    {!isCollapsed && accounts.length > 0 && (
                                        <div className="bg-white">
                                            {accounts.map((account, idx) => {
                                                const globalIdx = flatList.indexOf(account);
                                                const isHighlighted = globalIdx === highlightedIndex;
                                                const isSelected = account.code === value;

                                                return (
                                                    <button
                                                        key={account.code}
                                                        data-selected={isSelected ? 'true' : undefined}
                                                        onClick={() => selectAccount(account.code)}
                                                        className={`w-full flex items-center justify-between px-6 py-2 text-left transition-colors ${isHighlighted ? 'bg-blue-50' : isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                                                            }`}
                                                        style={{
                                                            fontSize: '12.5px',
                                                            fontWeight: isSelected ? 600 : 400,
                                                            color: isSelected ? '#1e40af' : '#374151',
                                                            borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
                                                        }}
                                                    >
                                                        <span className="truncate">
                                                            <span className="font-mono text-gray-500 mr-2">{account.code}</span>
                                                            {account.name}
                                                        </span>
                                                        {isSelected && (
                                                            <span className="text-blue-600 ml-2">✓</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Empty State */}
                        {filteredAccounts.length === 0 && (
                            <div className="px-6 py-8 text-center text-gray-500">
                                <i className="ph ph-magnifying-glass text-3xl mb-2 block opacity-30"></i>
                                <div className="text-sm">No accounts found</div>
                                <div className="text-xs text-gray-400 mt-1">Try a different search term</div>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
