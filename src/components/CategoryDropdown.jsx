import React, { useState, useRef, useEffect } from 'react';

/**
 * CategoryDropdown - Hierarchical category selector with search
 * 
 * Props:
 * - value: current category_id
 * - onChange: callback(category_id, category_path)
 * - categories: array from CategoryService.getTree()
 */
export function CategoryDropdown({ value, onChange, categories }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef(null);

    // Get current category display
    const getCurrentCategory = () => {
        if (!value) return { name: 'Uncategorized', color: '#94a3b8' };

        // Flatten tree to find category
        const findCategory = (cats) => {
            for (const cat of cats) {
                if (cat.id === value) return cat;
                if (cat.children) {
                    const found = findCategory(cat.children);
                    if (found) return found;
                }
            }
            return null;
        };

        return findCategory(categories) || { name: 'Uncategorized', color: '#94a3b8' };
    };

    // Filter categories by search
    const filterCategories = (cats, query) => {
        if (!query) return cats;

        const lowerQuery = query.toLowerCase();
        return cats.filter(cat => {
            const matches = cat.name.toLowerCase().includes(lowerQuery);
            const childMatches = cat.children ? filterCategories(cat.children, query).length > 0 : false;
            return matches || childMatches;
        }).map(cat => ({
            ...cat,
            children: cat.children ? filterCategories(cat.children, query) : []
        }));
    };

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const currentCategory = getCurrentCategory();
    const filteredCategories = filterCategories(categories, searchQuery);

    // Recursive render
    const renderCategory = (cat, depth = 0) => {
        const hasChildren = cat.children && cat.children.length > 0;

        return (
            <div key={cat.id} style={{ marginLeft: depth * 16 + 'px' }}>
                <div
                    onClick={() => {
                        onChange(cat.id, window.CategoryService.getPath(cat.id));
                        setIsOpen(false);
                        setSearchQuery('');
                    }}
                    style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        color: '#1e293b',
                        backgroundColor: cat.id === value ? '#fef3c7' : 'transparent',
                        transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                        if (cat.id !== value) e.target.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                        if (cat.id !== value) e.target.style.backgroundColor = 'transparent';
                    }}
                >
                    <div
                        style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: cat.color,
                            flexShrink: 0
                        }}
                    />
                    <span style={{ flex: 1, fontWeight: hasChildren ? 600 : 400 }}>
                        {cat.name}
                    </span>
                    {cat.id === value && (
                        <i className="ph ph-check" style={{ fontSize: '14px', color: '#f59e0b' }} />
                    )}
                </div>
                {hasChildren && (
                    <div>
                        {cat.children.map(child => renderCategory(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '6px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: '#1e293b',
                    backgroundColor: isOpen ? '#f8fafc' : 'transparent',
                    borderRadius: '4px',
                    transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => {
                    if (!isOpen) e.target.style.backgroundColor = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                    if (!isOpen) e.target.style.backgroundColor = 'transparent';
                }}
            >
                <div
                    style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: currentCategory.color,
                        flexShrink: 0
                    }}
                />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentCategory.name}
                </span>
                <i
                    className={`ph ph-caret-${isOpen ? 'up' : 'down'}`}
                    style={{ fontSize: '12px', color: '#64748b', flexShrink: 0 }}
                />
            </div>

            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        boxShadow: '0 10px 40px rgba(15, 23, 42, 0.1), 0 2px 8px rgba(15, 23, 42, 0.08)',
                        border: '1px solid #e2e8f0',
                        maxHeight: '400px',
                        overflow: 'hidden',
                        zIndex: 1000,
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    {/* Search box */}
                    <div style={{ padding: '12px', borderBottom: '1px solid #e2e8f0' }}>
                        <input
                            type="text"
                            placeholder="Search categories..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                fontSize: '13px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                outline: 'none',
                                fontFamily: 'inherit'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#f59e0b'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                    </div>

                    {/* Categories list */}
                    <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
                        {filteredCategories.length > 0 ? (
                            filteredCategories.map(cat => renderCategory(cat))
                        ) : (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                                No categories found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
