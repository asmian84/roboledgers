import React from 'react';

/**
 * ReportTable - Professional 3-column table matching Caseware/Jazzit format
 * Supports year-over-year comparison with proper typography and borders
 */
export function ReportTable({
    columns = [],  // Array of column configs: { label, width, bold }
    rows = [],     // Array of row data
    className = ''
}) {
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
        <div className={`report-table ${className}`} style={{ fontFamily: 'Arial, sans-serif' }}>
            <table className="w-full border-collapse">
                {/* Column Headers */}
                <thead>
                    <tr className="border-b border-gray-400" style={{ borderBottomWidth: '1.3px' }}>
                        {columns.map((col, idx) => (
                            <th
                                key={idx}
                                className={`pb-2 ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.bold ? 'font-bold' : 'font-semibold'}`}
                                style={{
                                    width: col.width || 'auto',
                                    fontSize: '10pt',
                                    fontWeight: col.bold ? 700 : 600
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

                        return (
                            <tr
                                key={rowIdx}
                                className={`
                                    ${isSubtotal ? 'border-t border-gray-300' : ''}
                                    ${isTotal ? 'border-t-2 border-gray-900' : ''}
                                `}
                                style={{
                                    borderTopWidth: isSubtotal ? '0.9px' : isTotal ? '2.6px' : '0'
                                }}
                            >
                                {/* Description column */}
                                <td
                                    className={`py-1 ${isSection || isTotal ? 'font-bold uppercase' : ''} ${isSubtotal ? 'font-semibold' : ''}`}
                                    style={{
                                        paddingLeft: `${indent * 14.4}px`,
                                        fontSize: '10pt',
                                        fontWeight: isSection || isTotal ? 700 : isSubtotal ? 600 : 400
                                    }}
                                >
                                    {row.description}
                                </td>

                                {/* Value columns */}
                                {row.values && row.values.map((value, valIdx) => {
                                    const showDollar = (rowIdx === 0 && valIdx === 0) || isTotal || isSubtotal;
                                    const formattedValue = typeof value === 'number' ? formatCurrency(value) : value;

                                    return (
                                        <td
                                            key={valIdx}
                                            className={`py-1 text-right tabular-nums ${columns[valIdx + 1]?.bold ? 'font-bold' : ''}`}
                                            style={{
                                                fontSize: '10pt',
                                                fontFamily: '"Courier New", Courier, monospace',
                                                fontWeight: columns[valIdx + 1]?.bold ? 700 : 400
                                            }}
                                        >
                                            {formattedValue}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default ReportTable;
