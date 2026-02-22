import React, { useState } from 'react';
import { AccountDrillDown } from './AccountDrillDown.jsx';

/**
 * ReportTable - Professional table matching Caseware/Jazzit format
 * Uses em-based sizing so zoom/text-size controls from parent properly scale content
 *
 * NEW: Supports drill-down on account rows. If a row has a `coaCode` field,
 * clicking it expands an inline transaction list. Pass `dateRange` to enable.
 */
export function ReportTable({
    columns = [],  // Array of column configs: { label, width, bold }
    rows = [],     // Array of row data — add `coaCode` to enable drill-down
    className = '',
    dateRange = null, // { start, end } — enables drill-down when set
    accentColor = 'green'
}) {
    const [expandedCode, setExpandedCode] = useState(null);

    const formatCurrency = (amount) => {
        if (amount === 0 || amount === null || amount === undefined) {
            return '—';
        }
        return new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: 'CAD'
        }).format(amount);
    };

    return (
        <div className={`report-table ${className}`}>
            <table className="w-full border-collapse" style={{ fontSize: 'inherit', fontFamily: 'inherit' }}>
                {/* Column Headers */}
                <thead>
                    <tr className="border-b border-gray-400" style={{ borderBottomWidth: '1.3px' }}>
                        {columns.map((col, idx) => (
                            <th
                                key={idx}
                                className={`pb-1.5 ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.bold ? 'font-bold' : 'font-semibold'}`}
                                style={{
                                    width: col.width || 'auto',
                                    fontSize: '0.85em',
                                    fontWeight: col.bold ? 700 : 600,
                                    color: col.color || 'inherit'
                                }}
                            >
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>

                {/* Table Body */}
                <tbody>
                    {rows.map((row, rowIdx) => {
                        const isSection = row.type === 'section';
                        const isSubtotal = row.type === 'subtotal';
                        const isTotal = row.type === 'total';
                        const indent = row.indent || 0;
                        const hasDrillDown = row.coaCode && dateRange;
                        const isExpanded = expandedCode === row.coaCode;

                        return (
                            <React.Fragment key={rowIdx}>
                            <tr
                                className={`
                                    ${isSubtotal ? 'border-t border-gray-300' : ''}
                                    ${isTotal ? 'border-t-2 border-gray-900' : ''}
                                    ${hasDrillDown ? 'cursor-pointer hover:bg-gray-50' : ''}
                                    ${isExpanded ? 'bg-indigo-50' : ''}
                                `}
                                style={{
                                    borderTopWidth: isSubtotal ? '0.9px' : isTotal ? '2.6px' : '0',
                                    transition: hasDrillDown ? 'background 0.1s' : 'none'
                                }}
                                onClick={hasDrillDown ? () => setExpandedCode(isExpanded ? null : row.coaCode) : undefined}
                                title={hasDrillDown ? `Click to view transactions for ${row.coaCode}` : ''}
                            >
                                {/* Description column */}
                                <td
                                    className={`py-0.5 ${isSection || isTotal ? 'font-bold uppercase' : ''} ${isSubtotal ? 'font-semibold' : ''}`}
                                    style={{
                                        paddingLeft: `${indent * 1.1}em`,
                                        fontSize: '1em',
                                        fontWeight: isSection || isTotal ? 700 : isSubtotal ? 600 : 400
                                    }}
                                >
                                    {hasDrillDown && (
                                        <i className={`ph ${isExpanded ? 'ph-caret-down' : 'ph-caret-right'} text-[0.75em] mr-1 text-gray-400`}></i>
                                    )}
                                    {row.description}
                                </td>

                                {/* Value columns */}
                                {row.values && row.values.map((value, valIdx) => {
                                    const formattedValue = typeof value === 'number' ? formatCurrency(value) : value;
                                    const col = columns[valIdx + 1];

                                    return (
                                        <td
                                            key={valIdx}
                                            className={`py-0.5 text-right tabular-nums ${col?.bold ? 'font-bold' : ''}`}
                                            style={{
                                                fontSize: '1em',
                                                fontFamily: '"Courier New", Courier, monospace',
                                                fontWeight: col?.bold ? 700 : 400,
                                                color: col?.color || 'inherit'
                                            }}
                                        >
                                            {formattedValue}
                                        </td>
                                    );
                                })}
                            </tr>
                            {/* Drill-down expansion */}
                            {isExpanded && dateRange && (
                                <AccountDrillDown
                                    coaCode={row.coaCode}
                                    accountName={row.description}
                                    startDate={dateRange.start}
                                    endDate={dateRange.end}
                                    onClose={() => setExpandedCode(null)}
                                    accentColor={accentColor}
                                />
                            )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default ReportTable;
