import React from 'react';

/**
 * ReportFooter - Professional metadata footer
 * Inherits font from parent zoom/font controls
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
        <div className="report-footer mt-8 pt-4 border-t border-gray-300">
            <div className="flex justify-between items-center text-gray-700" style={{ fontSize: '0.7em' }}>
                {/* Left: Print timestamp */}
                <div>
                    Printed: {dateStr} {timeStr}
                </div>

                {/* Right: Approval checkboxes */}
                {showApproval && (
                    <div className="font-bold" style={{ fontSize: '1.2em' }}>
                        Prep ________ &nbsp; Added ________ &nbsp; Approved _______
                    </div>
                )}
            </div>

            {/* Page number (center) */}
            {showPageNumber && (
                <div className="text-center text-gray-700 mt-2" style={{ fontSize: '0.7em' }}>
                    {pageNumber}
                </div>
            )}
        </div>
    );
}

export default ReportFooter;
