import React from 'react';

/**
 * ReportFooter - Professional metadata footer
 * Matches Caseware format with print timestamp and approval fields
 */
export function ReportFooter({
    showApproval = false,
    showPageNumber = false,
    pageNumber = 1
}) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    return (
        <div className="report-footer mt-8 pt-4 border-t border-gray-300" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="flex justify-between items-center text-[8pt] text-gray-700">
                {/* Left: Print timestamp */}
                <div>
                    Printed: {dateStr} {timeStr}
                </div>

                {/* Right: Approval checkboxes */}
                {showApproval && (
                    <div className="font-bold text-[10pt]">
                        Prep ________ &nbsp; Added ________ &nbsp; Approved _______
                    </div>
                )}
            </div>

            {/* Page number (center) */}
            {showPageNumber && (
                <div className="text-center text-[8pt] text-gray-700 mt-2">
                    {pageNumber}
                </div>
            )}
        </div>
    );
}

export default ReportFooter;
