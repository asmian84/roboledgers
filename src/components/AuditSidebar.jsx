import React, { useState, useEffect } from 'react';
import { DocumentViewer } from './DocumentViewer';
import { PDFSnippet } from './PDFSnippet';

/**
 * AuditSidebar - Right-hand sidebar for transaction auditing
 * 
 * EXPERIMENTAL FEATURE - Can be easily removed if not needed
 * 
 * Features:
 * - Shows transaction audit trail
 * - Displays audit metadata
 * - Multi-format document viewer (PDF, JPG, PNG, DOCX) with zoom
 * - Receipt upload and management
 * - Edit history
 * - Categorization info
 */

export function AuditSidebar({ isOpen, onClose, transaction }) {
    const [showDocViewer, setShowDocViewer] = useState(false);
    const [showLeftPanel, setShowLeftPanel] = useState(false);
    const [viewerDocument, setViewerDocument] = useState(null);
    const [receipts, setReceipts] = useState([]);
    const [gstDrill, setGstDrill] = useState(null); // null = summary, 'collected'|'paid' = drilled
    const sidebarRef = React.useRef(null);

    // Reset GST drill when transaction changes
    useEffect(() => { setGstDrill(null); }, [transaction?.tx_id]);

    // Load receipts from localStorage when transaction changes
    useEffect(() => {
        if (!transaction?.tx_id) { setReceipts([]); return; }
        try {
            const stored = localStorage.getItem(`rl_receipts_${transaction.tx_id}`);
            setReceipts(stored ? JSON.parse(stored) : []);
        } catch { setReceipts([]); }
    }, [transaction?.tx_id]);

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

    const handleViewSourceDocument = () => {
        // NO FALLBACK - show error if no PDF
        if (!transaction.source_pdf?.url) {
            alert('No source PDF available for this transaction. This may be from an older import or CSV data.');
            return;
        }

        setViewerDocument({
            type: 'pdf',
            url: transaction.source_pdf.url,
            name: transaction.source_pdf.filename || 'statement.pdf',
            page: transaction.source_pdf.page || 1,
            highlightLine: transaction.source_pdf.line_position || null
        });
        setShowLeftPanel(true); // Open left panel instead of inline viewer
    };

    const handleViewReceipt = (receipt) => {
        setViewerDocument({
            type: receipt.type || 'pdf',
            url: receipt.url,
            name: receipt.filename,
            highlightLine: null
        });
        setShowDocViewer(true);
    };

    const handleBackToAudit = () => {
        setShowDocViewer(false);
        setViewerDocument(null);
    };

    const handleUploadReceipt = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length || !transaction?.tx_id) return;

        const readers = files.map(file => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target.result;
                const ext = file.name.split('.').pop().toLowerCase();
                const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
                resolve({
                    filename: file.name,
                    type: ext === 'pdf' ? 'pdf' : (isImage ? ext : 'file'),
                    url: dataUrl,
                    // Thumbnail: use dataUrl for images, placeholder icon for PDF/other
                    thumbnail: isImage ? dataUrl : null,
                    size: file.size,
                    uploadedAt: new Date().toISOString(),
                });
            };
            reader.readAsDataURL(file);
        }));

        Promise.all(readers).then(newReceipts => {
            setReceipts(prev => {
                const updated = [...prev, ...newReceipts];
                try {
                    localStorage.setItem(`rl_receipts_${transaction.tx_id}`, JSON.stringify(updated));
                } catch (err) {
                    console.warn('[AuditSidebar] Could not persist receipts to localStorage:', err);
                }
                return updated;
            });
        });

        // Reset input so same file can be re-uploaded if needed
        e.target.value = '';
    };

    const handleDeleteReceipt = (idx) => {
        setReceipts(prev => {
            const updated = prev.filter((_, i) => i !== idx);
            try {
                localStorage.setItem(`rl_receipts_${transaction.tx_id}`, JSON.stringify(updated));
            } catch { /* ignore */ }
            return updated;
        });
    };

    const handleViewReceiptInViewer = (receipt) => {
        setViewerDocument({
            url: receipt.url,
            type: receipt.type,
            name: receipt.filename,
            page: 1,
        });
        setShowLeftPanel(true);
    };

    return (
        <>
            {/* Left Slide-Out Panel for Full PDF View */}
            {showLeftPanel && (
                <>
                    {/* Left Panel - Full PDF Viewer (NO OVERLAY) */}
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: '60px', // Start after navbar
                        width: 'calc(100% - 410px)', // Full width minus navbar (60px) and audit drawer (350px)
                        height: '100vh',
                        background: 'white',
                        boxShadow: '4px 0 12px rgba(0, 0, 0, 0.1)',
                        zIndex: 1002,
                        transform: showLeftPanel ? 'translateX(0)' : 'translateX(-100%)',
                        transition: 'transform 0.3s ease',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {/* Left Panel Header */}
                        <div style={{
                            padding: '16px 20px',
                            background: '#1e293b',
                            color: 'white',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <i className="ph ph-file-pdf" style={{ fontSize: '20px' }}></i>
                                <span style={{ fontSize: '14px', fontWeight: 600 }}>
                                    {viewerDocument?.name || 'Source Document'}
                                </span>
                            </div>
                            <button
                                onClick={() => setShowLeftPanel(false)}
                                style={{
                                    border: 'none',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    color: 'white',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* PDF Viewer Content */}
                        <div style={{ flex: 1, overflow: 'auto', background: '#f1f5f9' }}>
                            <DocumentViewer
                                document={viewerDocument}
                                onClose={() => setShowLeftPanel(false)}
                            />
                        </div>
                    </div>
                </>
            )}

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
                <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>

                    {/* Transaction Identity */}
                    {(transaction.parser_ref || transaction.pdfLocation) && (
                        <div style={{
                            backgroundColor: '#1a1f2e',
                            padding: '16px',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            border: '1px solid #2a3f5f'
                        }}>
                            <div style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                letterSpacing: '0.5px',
                                color: '#64b5f6',
                                marginBottom: '12px',
                                textTransform: 'uppercase'
                            }}>
                                Transaction Identity
                            </div>

                            {transaction.parser_ref && (
                                <div style={{ marginBottom: '12px' }}>
                                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Parser Ref:</div>
                                    <code style={{
                                        backgroundColor: '#0f1419',
                                        padding: '6px 10px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        color: '#7dd3fc',
                                        fontFamily: 'Monaco, monospace',
                                        display: 'block'
                                    }}>
                                        {transaction.parser_ref}
                                    </code>
                                </div>
                            )}

                            {!!(transaction.pdfLocation || transaction.source_pdf) && (
                                    <>
                                        <div style={{ marginBottom: '12px' }}>
                                            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>PDF Location:</div>
                                            <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                                                Page {transaction.pdfLocation?.page || transaction.source_pdf?.page}, Line {transaction.audit?.lineNumber || 'N/A'}
                                            </div>
                                        </div>

                                        {(transaction.audit?.rawText || transaction.pdfLocation?.lineText || transaction.source_pdf?.raw_line) && (
                                            <div style={{ marginBottom: '12px' }}>
                                                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Raw PDF Text:</div>
                                                <pre style={{
                                                    backgroundColor: '#0f1419',
                                                    padding: '8px',
                                                    borderRadius: '4px',
                                                    fontSize: '10px',
                                                    color: '#94a3b8',
                                                    fontFamily: 'Monaco, monospace',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-all',
                                                    maxHeight: '120px',  // Increased to show FX lines
                                                    overflow: 'auto',
                                                    margin: 0
                                                }}>
                                                    {transaction.audit?.rawText || transaction.pdfLocation?.lineText || transaction.source_pdf?.raw_line}
                                                </pre>
                                            </div>
                                        )}

                                        <button
                                            onClick={() => {
                                                // Use source_pdf if available (from parser), otherwise try account.pdfUrl
                                                if (transaction.source_pdf?.url) {
                                                    setViewerDocument({
                                                        type: 'pdf',
                                                        url: transaction.source_pdf.url,
                                                        name: transaction.source_pdf.filename || 'statement.pdf',
                                                        page: transaction.source_pdf.page || transaction.pdfLocation.page,
                                                        highlightLine: transaction.source_pdf.line_position || {
                                                            top: transaction.pdfLocation.top,
                                                            left: transaction.pdfLocation.left,
                                                            width: transaction.pdfLocation.width,
                                                            height: transaction.pdfLocation.height
                                                        }
                                                    });
                                                    setShowLeftPanel(true);
                                                } else {
                                                    // Fallback to account.pdfUrl (legacy)
                                                    const account = window.RoboLedger.Accounts.get(transaction.account_id);
                                                    if (!account?.pdfUrl) {
                                                        alert('PDF not available for this transaction');
                                                        return;
                                                    }
                                                    setViewerDocument({
                                                        type: 'pdf',
                                                        url: account.pdfUrl,
                                                        name: account.pdfFilename || 'statement.pdf',
                                                        page: transaction.pdfLocation.page,
                                                        highlightLine: {
                                                            top: transaction.pdfLocation.top,
                                                            left: transaction.pdfLocation.left,
                                                            width: transaction.pdfLocation.width,
                                                            height: transaction.pdfLocation.height
                                                        }
                                                    });
                                                    setShowLeftPanel(true);
                                                }
                                            }}
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                backgroundColor: '#3b82f6',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontSize: '13px',
                                                fontWeight: '500',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <span>📄</span>
                                            View in PDF
                                        </button>
                                    </>
                                )}
                        </div>
                    )}

                    {/* ── Account Metadata ─────────────────────────────────────────── */}
                    {(() => {
                        const acct = window.RoboLedger?.Accounts?.get?.(transaction.account_id);
                        if (!acct) return null;
                        const maskNum = (n) => n ? '••••' + String(n).slice(-4) : '—';
                        const rows = [
                            { label: 'Account', value: acct.ref || acct.id },
                            { label: 'Bank', value: acct.bank || acct.name || '—' },
                            { label: 'Type', value: acct.type || acct.accountType || '—' },
                            { label: 'Number', value: maskNum(acct.accountNumber) },
                            acct.statementPeriod ? { label: 'Period', value: acct.statementPeriod } : null,
                            acct.openingBalance != null ? { label: 'Opening Bal', value: `$${Number(acct.openingBalance).toFixed(2)}` } : null,
                        ].filter(Boolean);
                        return (
                            <div style={{ marginBottom: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                <div style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontSize: '10px', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                    Account
                                </div>
                                <div style={{ padding: '8px 12px' }}>
                                    {rows.map(({ label, value }) => (
                                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: '11px' }}>
                                            <span style={{ color: '#94a3b8', minWidth: '70px' }}>{label}</span>
                                            <span style={{ color: '#1e293b', fontWeight: 500, textAlign: 'right' }}>{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* ── GST Summary (drillable) ───────────────────────────────────── */}
                    {(() => {
                        const allTxns = window.RoboLedger?.Ledger?.getAll() || [];
                        const COA = window.RoboLedger?.COA;
                        const acctId = transaction.account_id;

                        // Aggregate GST for this account
                        const gstTxns = allTxns.filter(t => t.account_id === acctId && t.gst_enabled && t.tax_cents);
                        if (!gstTxns.length && !transaction.gst_enabled) return null;

                        const fmt = (n) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);
                        const collected = gstTxns.filter(t => {
                            const root = COA?.get(String(t.category))?.root;
                            return root === 'REVENUE';
                        });
                        const paid = gstTxns.filter(t => {
                            const root = COA?.get(String(t.category))?.root;
                            return root === 'EXPENSE' || !root;
                        });
                        const totalCollected = collected.reduce((s, t) => s + (t.tax_cents || 0), 0) / 100;
                        const totalPaid      = paid.reduce((s, t) => s + (t.tax_cents || 0), 0) / 100;
                        const netGST         = totalCollected - totalPaid;

                        const drillTxns = gstDrill === 'collected' ? collected : gstDrill === 'paid' ? paid : [];

                        return (
                            <div style={{ marginBottom: '16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', overflow: 'hidden' }}>
                                {/* GST Header with breadcrumb */}
                                <div style={{ padding: '8px 12px', borderBottom: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, color: '#15803d', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                    {gstDrill ? (
                                        <>
                                            <span style={{ cursor: 'pointer', color: '#059669' }} onClick={() => setGstDrill(null)}>GST Summary</span>
                                            <span style={{ color: '#86efac' }}>›</span>
                                            <span>{gstDrill === 'collected' ? 'GST Collected' : 'GST ITC Paid'}</span>
                                        </>
                                    ) : 'GST Summary'}
                                </div>

                                {gstDrill ? (
                                    /* Drill view: list transactions */
                                    <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                        {drillTxns.length === 0 && (
                                            <div style={{ padding: '12px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>No transactions</div>
                                        )}
                                        {drillTxns.map((t, i) => {
                                            const gst = (t.tax_cents || 0) / 100;
                                            return (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px', fontSize: '10px', borderBottom: '1px solid #f0fdf4', cursor: 'pointer' }}
                                                     onClick={() => window.openAuditSidebar?.(t)}
                                                     onMouseEnter={e => e.currentTarget.style.background = '#dcfce7'}
                                                     onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                    <span style={{ color: '#6b7280', marginRight: '6px', flexShrink: 0 }}>{t.date?.substring(0, 10)}</span>
                                                    <span style={{ color: '#374151', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(t.description || '').substring(0, 26)}</span>
                                                    <span style={{ color: '#059669', fontWeight: 600, fontFamily: 'monospace', flexShrink: 0, marginLeft: '6px' }}>{fmt(gst)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    /* Summary view */
                                    <div style={{ padding: '8px 12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '11px', cursor: 'pointer', borderRadius: '4px' }}
                                             onClick={() => { setGstDrill('collected'); window.setTxGridFilter && window.setTxGridFilter(t => t.account_id === acctId && t.gst_enabled && window.RoboLedger?.COA?.get(String(t.category))?.root === 'REVENUE'); }}
                                             onMouseEnter={e => e.currentTarget.style.background = '#dcfce7'}
                                             onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <span style={{ color: '#15803d' }}>GST Collected <span style={{ fontSize: '10px', color: '#86efac' }}>({collected.length})</span></span>
                                            <span style={{ color: '#15803d', fontWeight: 700, fontFamily: 'monospace' }}>{fmt(totalCollected)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '11px', cursor: 'pointer', borderRadius: '4px' }}
                                             onClick={() => { setGstDrill('paid'); window.setTxGridFilter && window.setTxGridFilter(t => t.account_id === acctId && t.gst_enabled && window.RoboLedger?.COA?.get(String(t.category))?.root !== 'REVENUE'); }}
                                             onMouseEnter={e => e.currentTarget.style.background = '#dcfce7'}
                                             onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <span style={{ color: '#0369a1' }}>GST ITC Paid <span style={{ fontSize: '10px', color: '#7dd3fc' }}>({paid.length})</span></span>
                                            <span style={{ color: '#0369a1', fontWeight: 700, fontFamily: 'monospace' }}>{fmt(totalPaid)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0 2px', fontSize: '11px', borderTop: '1px solid #bbf7d0', marginTop: '4px' }}>
                                            <span style={{ color: '#374151', fontWeight: 700 }}>Net GST {netGST >= 0 ? 'Payable' : 'Refund'}</span>
                                            <span style={{ color: netGST >= 0 ? '#dc2626' : '#059669', fontWeight: 700, fontFamily: 'monospace' }}>{fmt(Math.abs(netGST))}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* PDF Visual Snippet - Shows actual transaction line from PDF */}
                    {transaction.source_pdf?.url && (
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#64748b',
                                letterSpacing: '0.5px',
                                marginBottom: '10px'
                            }}>
                                PDF SNIPPET
                            </div>
                            <PDFSnippet
                                pdfUrl={transaction.source_pdf.url}
                                page={transaction.source_pdf.page || 1}
                                linePosition={transaction.source_pdf.line_position}
                            />
                        </div>
                    )}

                    {/* Attached Receipts - HORIZONTAL DRAG/DROP AREA */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#64748b',
                            letterSpacing: '0.5px',
                            marginBottom: '10px'
                        }}>
                            ATTACHED RECEIPTS
                        </div>

                        {/* Horizontal Drag/Drop Area */}
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

                        {/* Show uploaded receipts as thumbnails */}
                        {receipts.length > 0 && (
                            <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                                {receipts.map((receipt, idx) => (
                                    <div key={idx} style={{
                                        width: '80px',
                                        height: '80px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '6px',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        background: '#f8fafc',
                                        flexShrink: 0,
                                    }}
                                        onClick={() => handleViewReceiptInViewer(receipt)}
                                        title={receipt.filename}
                                    >
                                        {receipt.thumbnail ? (
                                            <img src={receipt.thumbnail} alt={receipt.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#94a3b8', gap: '4px', padding: '4px', textAlign: 'center' }}>
                                                <i className={`ph ph-file-${receipt.type === 'pdf' ? 'pdf' : 'text'}`} style={{ fontSize: '28px', color: receipt.type === 'pdf' ? '#ef4444' : '#6b7280' }}></i>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', padding: '0 4px' }}>{receipt.filename}</span>
                                            </div>
                                        )}
                                        {/* Delete button */}
                                        <button
                                            onClick={(ev) => { ev.stopPropagation(); handleDeleteReceipt(idx); }}
                                            style={{ position: 'absolute', top: '2px', right: '2px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(239,68,68,0.85)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px', lineHeight: 1 }}
                                            title="Remove receipt"
                                        >×</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>



                    {/* Categorization */}
                    <div style={{ marginBottom: '20px' }}>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
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
                    </div>

                </div>
            </div >
        </>
    );
}
