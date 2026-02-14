import React from 'react';

/**
 * ReportHeader - Professional Caseware-style report header
 * Matches Jazzit template formatting with proper typography and borders
 */
export function ReportHeader({
    companyName = 'RoboLedger Company',
    reportTitle,
    period,
    subtitle
}) {
    return (
        <div className="report-header">
            {/* Company Name - 11pt Bold */}
            <div className="text-center mb-1">
                <h1 className="text-[11pt] font-bold text-gray-900" style={{ fontFamily: 'Arial, sans-serif' }}>
                    {companyName}
                </h1>
            </div>

            {/* Report Title - 11pt Bold */}
            <div className="text-center mb-1">
                <h2 className="text-[11pt] font-bold text-gray-900" style={{ fontFamily: 'Arial, sans-serif' }}>
                    {reportTitle}
                </h2>
            </div>

            {/* Period/Subtitle - 11pt Bold */}
            {(period || subtitle) && (
                <div className="text-center mb-3">
                    <p className="text-[11pt] font-bold text-gray-900" style={{ fontFamily: 'Arial, sans-serif' }}>
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
