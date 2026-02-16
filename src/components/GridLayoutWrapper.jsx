import React, { useState } from 'react';
import ResizablePanel from './ResizablePanel';
import UtilityBar from './UtilityBar';
import LiveReportPanel from './LiveReportPanel';

/**
 * 77/23 SPLIT LAYOUT WRAPPER
 * 
 * This replaces the complex ResizablePanel system with a clean percentage-based split:
 * - Grid Section: 77% when panel open, 100% when closed
 * - Side Panel: 23% with visual boundaries
 * - Proper overflow handling
 * - Clean toggle logic
 */
export function GridLayoutWrapper({
    children,  // Main grid content
    activePanel,  // 'utility' | 'report' | null
    onClosePanel,
    transactions,
    selectedAccount,
    onAccountClick,
    onClearFilter
}) {
    return (
        <div
            className="main-container"
            style={{
                display: 'flex',
                flexDirection: 'row',
                height: '100%',
                width: '100%',
                overflow: 'hidden',
                backgroundColor: '#f9fafb'
            }}
        >
            {/* 77% GRID SECTION */}
            <div
                className="grid-section"
                style={{
                    width: activePanel ? '77%' : '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: 'width 0.3s ease',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box'
                }}
            >
                {children}
            </div>

            {/* 23% SIDE PANEL */}
            {activePanel && (
                <div
                    className="side-panel"
                    style={{
                        width: '23%',
                        height: '100%',
                        borderLeft: '2px solid #e5e7eb',
                        backgroundColor: '#ffffff',
                        overflow: 'auto',
                        padding: '16px',
                        boxSizing: 'border-box',
                        boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.05)',
                        position: 'relative'
                    }}
                >
                    {/* Close Button */}
                    <button
                        onClick={onClosePanel}
                        className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Close panel"
                    >
                        <i className="ph ph-x text-xl"></i>
                    </button>

                    {/* Panel Content */}
                    {activePanel === 'utility' && <UtilityBar transactions={transactions} />}
                    {activePanel === 'report' && (
                        <LiveReportPanel
                            reportType="trial-balance"
                            transactions={transactions}
                            selectedAccount={selectedAccount}
                            onAccountClick={onAccountClick}
                            onClearFilter={onClearFilter}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

export default GridLayoutWrapper;
