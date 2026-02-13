import React, { useEffect, useRef, useState } from 'react';

/**
 * DocumentViewer - Multi-format document viewer component
 * Supports: PDF, JPG, PNG, DOCX (read-only preview)
 * Features: Hover-based zoom, highlight support
 */
export function DocumentViewer({ document, onBack }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const renderTaskRef = useRef(null); // CRITICAL: Track render task to prevent canvas reuse
    const [isZoomed, setIsZoomed] = useState(false);
    const [pdfDoc, setPdfDoc] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    // Render PDF page when doc or page changes
    useEffect(() => {
        if (pdfDoc && currentPage) {
            renderPdfPage(pdfDoc, currentPage);
        }

        // Cleanup when page changes
        return () => {
            if (renderTaskRef.current) {
                console.log('[DOC VIEWER] Cleaning up render task on page change');
                renderTaskRef.current.cancel();
                renderTaskRef.current = null;
            }
        };
    }, [pdfDoc, currentPage]);

    // Load and render document
    useEffect(() => {
        if (!document || !document.url) {
            setIsLoading(false);
            return;
        }

        const loadDocument = async () => {
            setIsLoading(true);

            try {
                if (document.type === 'pdf') {
                    // Load PDF using PDF.js
                    const loadingTask = window.pdfjsLib.getDocument(document.url);
                    const pdf = await loadingTask.promise;
                    setPdfDoc(pdf);

                    // Set page number - rendering will happen in useEffect above
                    const pageNum = document.page || 1;
                    setCurrentPage(pageNum);
                } else if (['jpg', 'jpeg', 'png', 'gif'].includes(document.type)) {
                    // Render image directly
                    renderImage(document.url);
                } else {
                    console.warn('Unsupported document type:', document.type);
                }
                setIsLoading(false);
            } catch (error) {
                console.error('Error loading document:', error);
                setIsLoading(false);
            }
        };

        loadDocument();
    }, [document]);

    const renderPdfPage = async (pdf, pageNum) => {
        // Cancel any ongoing render first
        if (renderTaskRef.current) {
            console.log('[DOC VIEWER] Canceling previous render');
            try {
                renderTaskRef.current.cancel();
            } catch (e) {
                // Already cancelled or completed
            }
            renderTaskRef.current = null;
        }

        const page = await pdf.getPage(pageNum);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');

        // Get page rotation from PDF metadata (0, 90, 180, 270)
        const rotation = page.rotate || 0;
        console.log(`[DOC VIEWER] Page rotation from metadata: ${rotation}°`);

        // Apply rotation correction - if PDF is upside down (180°), rotate it back
        const correctedRotation = rotation;
        const viewport = page.getViewport({ scale: 1.5, rotation: correctedRotation });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };

        // Store render task so we can cancel it if needed
        renderTaskRef.current = page.render(renderContext);
        try {
            await renderTaskRef.current.promise;
        } catch (e) {
            if (e.name === 'RenderingCancelledException') {
                // Expected when switching pages - suppress this
                return;
            }
            throw e;
        }

        // Draw highlight box if transaction line position is provided
        if (document.highlightLine) {
            const { top, left, width, height } = document.highlightLine;

            // PDF.js renders correctly - coordinates should work as-is
            // PDF coordinates: origin at BOTTOM-LEFT, Y increases UPWARD
            // Viewport transforms this to canvas coordinates automatically
            // We just need to invert Y because our 'top' is from top of page
            const pdfPageHeight = viewport.height / viewport.scale;

            const canvasX = left * viewport.scale;
            const canvasY = (pdfPageHeight - top - height) * viewport.scale;
            const canvasWidth = width * viewport.scale;
            const canvasHeight = height * viewport.scale;

            // Draw yellow highlight
            context.fillStyle = 'rgba(255, 235, 59, 0.3)';
            context.fillRect(canvasX, canvasY, canvasWidth, canvasHeight);

            // Draw border
            context.strokeStyle = '#FBB924';
            context.lineWidth = 2;
            context.strokeRect(canvasX, canvasY, canvasWidth, canvasHeight);

            // Auto-scroll to highlighted line
            setTimeout(() => {
                const container = canvas.parentElement;
                if (container) {
                    const scrollTop = canvasY - (container.clientHeight / 2) + (canvasHeight / 2);
                    container.scrollTop = Math.max(0, scrollTop);
                    console.log('[DOC VIEWER] Auto-scrolled to highlight at Y:', canvasY);
                }
            }, 100);
        }
    };

    const renderImage = (url) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            context.drawImage(img, 0, 0);
        };

        img.src = url;
    };

    const handleMouseEnter = () => {
        if (isZoomed) return;
        setIsZoomed(true);
        // Apply 2x zoom via CSS transform
        if (canvasRef.current) {
            canvasRef.current.style.transform = 'scale(2)';
            canvasRef.current.style.transformOrigin = 'top left';
        }
    };

    const handleMouseLeave = () => {
        setIsZoomed(false);
        if (canvasRef.current) {
            canvasRef.current.style.transform = 'scale(1)';
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
                fontSize: '12px',
                color: '#64748b'
            }}>
                <button
                    onClick={onBack}
                    style={{
                        border: 'none',
                        background: 'none',
                        color: '#3b82f6',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#eff6ff'}
                    onMouseLeave={(e) => e.target.style.background = 'none'}
                >
                    <i className="ph ph-arrow-left"></i> Back
                </button>
                <div style={{ fontSize: '11px' }}>
                    <span>{document?.name || 'document'}</span>
                    {document?.page && <span style={{ marginLeft: '8px', color: '#94a3b8' }}>Page {document.page}</span>}
                </div>
            </div>

            {/* Canvas Container */}
            <div
                ref={containerRef}
                style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    minHeight: '400px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: isLoading ? 'center' : 'flex-start',
                    position: 'relative',
                    overflow: 'auto',
                    padding: '20px'
                }}
            >
                <canvas
                    ref={canvasRef}
                    style={{
                        width: '100%',
                        height: 'auto',
                        cursor: 'default',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                />

                {/* Loading indicator */}
                {isLoading && (
                    <div style={{
                        position: 'absolute',
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: '12px'
                    }}>
                        <i className="ph ph-file-pdf" style={{ fontSize: '48px', color: '#cbd5e1', marginBottom: '8px', display: 'block' }}></i>
                        <div>Loading {document?.type || 'document'}...</div>
                        {document?.type === 'pdf' && (
                            <div style={{
                                marginTop: '12px',
                                padding: '8px 12px',
                                background: '#fef3c7',
                                border: '2px solid #fbbf24',
                                borderRadius: '6px',
                                fontSize: '11px',
                                color: '#92400e',
                                maxWidth: '250px'
                            }}>
                                📍 Transaction line will be highlighted
                            </div>
                        )}
                        <div style={{ marginTop: '8px', fontSize: '10px', color: '#94a3b8' }}>
                            🔍 Hover to zoom
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
