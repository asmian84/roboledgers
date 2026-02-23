import React from 'react';

/**
 * ReportHeader - Professional Caseware-style report header
 * Inherits font-family and font-size from parent zoom/font controls
 */
export function ReportHeader({
    companyName = window.UI_STATE?.activeClientName || 'Your Company',
    reportTitle,
    period,
    subtitle
}) {
    return (
        <div className="report-header">
            {/* Company Name */}
            <div className="text-center mb-1">
                <h1 className="font-bold text-gray-900" style={{ fontSize: '1.15em' }}>
                    {companyName}
                </h1>
            </div>

            {/* Report Title */}
            <div className="text-center mb-1">
                <h2 className="font-bold text-gray-900" style={{ fontSize: '1.15em' }}>
                    {reportTitle}
                </h2>
            </div>

            {/* Period/Subtitle */}
            {(period || subtitle) && (
                <div className="text-center mb-3">
                    <p className="font-bold text-gray-900" style={{ fontSize: '1.15em' }}>
                        {period || subtitle}
                    </p>
                </div>
            )}

            {/* Double border (0.70mm) - Caseware standard */}
            <div className="border-b-[2.6px] border-gray-900 mb-4"></div>
        </div>
    );
}

export default ReportHeader;
