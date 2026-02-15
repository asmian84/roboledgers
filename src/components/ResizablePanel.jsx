import React, { useState, useRef, useEffect } from 'react';

/**
 * ResizablePanel - Draggable side panel with resize handle
 * Used for both Utility Bar and Live Report Panel
 */
export function ResizablePanel({
    isOpen,
    onClose,
    children,
    defaultWidth = 600,
    minWidth = 400,
    maxWidth = 900,
    title = "Panel"
}) {
    const [width, setWidth] = useState(() => {
        const saved = localStorage.getItem('roboledger-panel-width');
        return saved ? parseInt(saved) : defaultWidth;
    });
    const [isResizing, setIsResizing] = useState(false);
    const panelRef = useRef(null);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e) => {
            if (!panelRef.current) return;

            // Calculate width from right edge of screen
            const newWidth = window.innerWidth - e.clientX;
            const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
            setWidth(clampedWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            localStorage.setItem('roboledger-panel-width', width.toString());
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, width, minWidth, maxWidth]);

    if (!isOpen) return null;

    return (
        <>
            {/* Resize Handle */}
            <div
                className="resize-handle"
                onMouseDown={() => setIsResizing(true)}
                style={{
                    width: '4px',
                    cursor: 'col-resize',
                    background: isResizing ? '#3b82f6' : '#e5e7eb',
                    transition: isResizing ? 'none' : 'background 0.2s',
                    flexShrink: 0,
                    height: '100%',
                    position: 'relative',
                    zIndex: 100
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#3b82f6'}
                onMouseLeave={(e) => !isResizing && (e.currentTarget.style.background = '#e5e7eb')}
            >
                {/* Visual grip indicator */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '3px',
                    height: '40px',
                    background: 'rgba(255,255,255,0.7)',
                    borderRadius: '2px',
                    pointerEvents: 'none'
                }} />
            </div>

            {/* Panel Content */}
            <div
                ref={panelRef}
                className="resizable-panel"
                style={{
                    width: `${width}px`,
                    minWidth: `${minWidth}px`,
                    maxWidth: `${maxWidth}px`,
                    flexShrink: 0,
                    height: '100%',
                    background: 'white',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    borderLeft: '1px solid #e5e7eb'
                }}
            >
                {/* Panel Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-semibold text-sm text-gray-900">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="Close Panel"
                    >
                        <i className="ph ph-x text-gray-600"></i>
                    </button>
                </div>

                {/* Panel Body */}
                <div className="flex-1 overflow-auto">
                    {children}
                </div>
            </div>
        </>
    );
}

export default ResizablePanel;
