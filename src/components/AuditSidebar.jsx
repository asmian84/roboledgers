import React, { useState, useEffect } from 'react';

/**
 * AuditSidebar - Right-hand sidebar for transaction auditing
 * 
 * EXPERIMENTAL FEATURE - Can be easily removed if not needed
 * 
 * Features:
 * - Shows transaction audit trail
 * - Displays raw PDF snippet
 * - Inline PDF viewer with highlighting
 * - Receipt upload and management
 * - Edit history
 * - Categorization info
 */

export function AuditSidebar({ isOpen, onClose, transaction }) {
    const [showPdfViewer, setShowPdfViewer] = useState(false);
    const [receipts, setReceipts] = useState([]);
    const sidebarRef = React.useRef(null);

    // Auto-scroll to sidebar when opened
    useEffect(() => {
        if (isOpen && sidebarRef.current) {
            // Scroll window to align sidebar top with viewport
            const sidebarTop = sidebarRef.current.getBoundingClientRect().top + window.scrollY;
            window.scrollTo({ top: sidebarTop, behavior: 'smooth' });
        }
    }, [isOpen]);

    // Close sidebar when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (isOpen && e.target.classList.contains('audit-sidebar-overlay')) {
                onClose();
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [isOpen, onClose]);

    // Handle ESC key to close
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen || !transaction) return null;

    const handleViewSourcePdf = () => {
        setShowPdfViewer(true);
    };

    const handleBackToAudit = () => {
        setShowPdfViewer(false);
    };

    const handleUploadReceipt = (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            // TODO: Handle file upload
            console.log('Upload receipt:', files[0]);
        }
    };

    return (
        <>
            {/* Overlay - dims the main content */}
            <div
                className={`audit-sidebar-overlay ${isOpen ? 'open' : ''}`}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.3)',
                    zIndex: 999,
                    opacity: isOpen ? 1 : 0,
                    pointerEvents: isOpen ? 'all' : 'none',
                    transition: 'opacity 0.3s ease'
                }}
            />

            {/* Sidebar */}
            <div
                ref={sidebarRef}
                className={`audit-sidebar ${isOpen ? 'open' : ''}`}
                style={{
                    position: 'fixed',
                    top: 0,
                    right: isOpen ? 0 : '-400px',
                    width: '350px',
                    height: '100vh',
                    background: 'white',
                    boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.1)',
                    zIndex: 1000,
                    transition: 'right 0.3s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto'
                }}
            >
                {/* Header */}
                <div style={{
                    background: '#3b82f6',
                    color: 'white',
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <i className="ph ph-file-text" style={{ fontSize: '20px' }}></i>
                        <div>
                            <div style={{ fontSize: '12px', opacity: 0.9, fontWeight: 600 }}>AUDIT TRAIL</div>
                            <div style={{ fontSize: '16px', fontWeight: 700 }}>{transaction.ref || transaction.tx_id}</div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            border: 'none',
                            background: 'rgba(255, 255, 255, 0.2)',
                            color: 'white',
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                        onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                    >
                        ×
                    </button>
                </div>

                {/* Body */}
                <div style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    background: '#f8fafc',
                    textAlign: 'center',
                    marginBottom: '10px'
                }}>
                    <i className="ph ph-file-pdf" style={{ fontSize: '48px', color: '#cbd5e1', marginBottom: '8px' }}></i>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                        PDF Viewer<br />
                        <span style={{ fontSize: '11px' }}>(Implementation in progress)</span>
                    </div>
                    <div style={{
                        marginTop: '12px',
                        padding: '8px',
                        background: '#fef3c7',
                        border: '2px solid #fbbf24',
                        borderRadius: '6px',
                        fontSize: '11px',
                        color: '#92400e'
                    }}>
                        Transaction line would be highlighted here
                    </div>
                </div>

                {/* PDF Controls */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <button style={{
                        padding: '6px 12px',
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px'
                    }}>
                        <i className="ph ph-caret-left"></i>
                    </button>
                    <button style={{
                        padding: '6px 12px',
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px'
                    }}>
                        <i className="ph ph-caret-right"></i>
                    </button>
                    <button style={{
                        padding: '6px 12px',
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}>
                        <i className="ph ph-magnifying-glass"></i> Zoom
                    </button>
                </div>
            </div>
                        )}
        </div >

            {/* Attached Receipts - HORIZONTAL DRAG/DROP AREA */ }
            < div style = {{ marginBottom: '20px' }
}>
    <div style={{
        fontSize: '11px',
        fontWeight: 700,
        color: '#64748b',
        letterSpacing: '0.5px',
        marginBottom: '10px'
    }}>
        ATTACHED RECEIPTS
    </div>

{/* Horizontal Drag/Drop Area */ }
<label style={{
    width: '100%',
    minHeight: '100px',
    border: '2px dashed #cbd5e1',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    background: '#f8fafc',
    transition: 'all 0.2s',
    padding: '20px'
}}
    onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#3b82f6';
        e.currentTarget.style.background = '#eff6ff';
    }}
    onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#cbd5e1';
        e.currentTarget.style.background = '#f8fafc';
    }}>
    <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleUploadReceipt}
        style={{ display: 'none' }}
    />
    <i className="ph ph-upload-simple" style={{ fontSize: '32px', color: '#94a3b8', marginBottom: '8px' }}></i>
    <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600, marginBottom: '4px' }}>
        Drag & drop receipts here
    </span>
    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
        or click to browse
    </span>
    <div style={{ marginTop: '8px', fontSize: '11px', color: '#cbd5e1' }}>
        PDF, JPG, PNG supported
    </div>
</label>

{/* Show uploaded receipts as thumbnails */ }
{
    receipts.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
            {receipts.map((receipt, idx) => (
                <div key={idx} style={{
                    width: '80px',
                    height: '80px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    position: 'relative'
                }}>
                    <img src={receipt.thumbnail} alt={receipt.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
            ))}
        </div>
    )
}
          </div >              </div >
                    </div >

    {/* Edit History */ }
    < div style = {{ marginBottom: '20px' }}>
                        <div style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#64748b',
                            letterSpacing: '0.5px',
                            marginBottom: '10px'
                        }}>
                            EDIT HISTORY
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.6' }}>
                            {transaction.edit_history?.length > 0 ? (
                                transaction.edit_history.map((edit, idx) => (
                                    <div key={idx} style={{ marginBottom: '6px' }}>
                                        • {new Date(edit.timestamp).toLocaleString()} - {edit.description}
                                    </div>
                                ))
                            ) : (
                                <div style={{ fontStyle: 'italic', color: '#94a3b8' }}>No edits made</div>
                            )}
                        </div>
                    </div >

    {/* Categorization */ }
    < div style = {{ marginBottom: '20px' }}>
                        <div style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#64748b',
                            letterSpacing: '0.5px',
                            marginBottom: '10px'
                        }}>
                            CATEGORIZATION
                        </div>
                        <div style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>
                            <div style={{ marginBottom: '6px' }}>
                                <strong>Method:</strong> {transaction.categorization?.method || 'Manual'}
                                {transaction.categorization?.confidence && ` (${transaction.categorization.confidence}% confidence)`}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <strong>Matched:</strong>
                                <span>{transaction.description}</span>
                                <span>→</span>
                                <span style={{
                                    background: '#3b82f6',
                                    color: 'white',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: 600
                                }}>
                                    {transaction.account || '5970'}
                                </span>
                            </div>
                        </div>
                    </div >

    {/* Action Buttons */ }
    < div style = {{ display: 'flex', gap: '8px', marginTop: '24px' }}>
                        <button style={{
                            flex: 1,
                            padding: '10px 16px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600,
                            transition: 'background 0.2s'
                        }}
                            onMouseEnter={(e) => e.target.style.background = '#2563eb'}
                            onMouseLeave={(e) => e.target.style.background = '#3b82f6'}>
                            Edit
                        </button>
                        <button style={{
                            padding: '10px 16px',
                            background: 'white',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600,
                            transition: 'all 0.2s'
                        }}
                            onMouseEnter={(e) => {
                                e.target.style.background = '#fef2f2';
                                e.target.style.borderColor = '#fca5a5';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = 'white';
                                e.target.style.borderColor = '#fecaca';
                            }}>
                            Delete
                        </button>
                    </div >

                </div >
            </div >
        </>
    );
}
