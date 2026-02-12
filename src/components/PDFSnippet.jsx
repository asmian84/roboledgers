import React, { useEffect, useRef, useState } from 'react';

/**
 * PDFSnippet - Renders a small cropped section of a PDF page
 * Used to show the transaction line under audit metadata
 */
export function PDFSnippet({ pdfUrl, page, linePosition }) {
    const canvasRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!pdfUrl || !linePosition) {
            setIsLoading(false);
            return;
        }

        const renderSnippet = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const loadingTask = window.pdfjsLib.getDocument(pdfUrl);
                const pdf = await loadingTask.promise;
                const pdfPage = await pdf.getPage(page);

                const canvas = canvasRef.current;
                if (!canvas) return;

                const context = canvas.getContext('2d');
                const viewport = pdfPage.getViewport({ scale: 1.5 });

                // Render full page to temporary canvas first
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = viewport.width;
                tempCanvas.height = viewport.height;
                const tempContext = tempCanvas.getContext('2d');

                await pdfPage.render({
                    canvasContext: tempContext,
                    viewport: viewport
                }).promise;

                // Calculate crop area with padding
                const { top, left, width, height } = linePosition;
                const padding = 30;

                // Convert from PDF coordinates (measuredfrom top) to canvas coordinates
                const pdfPageHeight = viewport.height / viewport.scale;
                const canvasTop = (pdfPageHeight - top - height) * viewport.scale;

                const cropY = Math.max(0, canvasTop - (padding * viewport.scale));
                const cropHeight = (height + (padding * 2)) * viewport.scale;

                // Set canvas size to cropped area
                canvas.width = viewport.width;
                canvas.height = Math.min(cropHeight, viewport.height - cropY);

                // Copy cropped section from temp canvas
                context.drawImage(
                    tempCanvas,
                    0, cropY,  // source x, y
                    viewport.width, canvas.height,  // source width, height
                    0, 0,  // dest x, y
                    canvas.width, canvas.height  // dest width, height
                );

                // Draw highlight box on the snippet
                const highlightY = Math.max(0, (canvasTop - cropY));
                context.fillStyle = 'rgba(255, 235, 59, 0.3)';
                context.fillRect(
                    left * viewport.scale,
                    highlightY,
                    width * viewport.scale,
                    height * viewport.scale
                );
                context.strokeStyle = '#FBB924';
                context.lineWidth = 2;
                context.strokeRect(
                    left * viewport.scale,
                    highlightY,
                    width * viewport.scale,
                    height * viewport.scale
                );

                setIsLoading(false);
            } catch (err) {
                console.error('Error rendering PDF snippet:', err);
                setError(err.message);
                setIsLoading(false);
            }
        };

        renderSnippet();
    }, [pdfUrl, page, linePosition]);

    if (!pdfUrl || !linePosition) {
        return (
            <div style={{
                padding: '12px',
                background: '#f1f5f9',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#64748b',
                textAlign: 'center'
            }}>
                No PDF snippet available
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                padding: '12px',
                background: '#fef2f2',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#dc2626',
                textAlign: 'center'
            }}>
                Error loading snippet: {error}
            </div>
        );
    }

    return (
        <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            overflow: 'hidden',
            background: '#f8fafc',
            position: 'relative'
        }}>
            {isLoading && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255,255,255,0.9)',
                    fontSize: '11px',
                    color: '#64748b',
                    zIndex: 10
                }}>
                    <i className="ph ph-circle-notch ph-spin" style={{ marginRight: '6px' }}></i>
                    Loading snippet...
                </div>
            )}
            <canvas
                ref={canvasRef}
                style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block'
                }}
            />
        </div>
    );
}
