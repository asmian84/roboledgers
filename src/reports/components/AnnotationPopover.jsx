import React, { useState, useRef, useEffect } from 'react';

/**
 * AnnotationPopover — Per-line-item annotation for Trial Balance rows.
 * Supports: checkmark, free-text note, reference string, working paper link.
 *
 * Props:
 *   accountCode   - COA code this annotation belongs to
 *   annotation    - { checked, note, ref, wp } or null
 *   onUpdate      - (accountCode, updatedAnnotation) => void
 *   compact       - boolean, for slim rendering
 */
export function AnnotationPopover({ accountCode, annotation, onUpdate, compact = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [note, setNote] = useState(annotation?.note || '');
    const [ref, setRef] = useState(annotation?.ref || '');
    const popoverRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    // Sync with prop changes
    useEffect(() => {
        setNote(annotation?.note || '');
        setRef(annotation?.ref || '');
    }, [annotation?.note, annotation?.ref]);

    const checked = annotation?.checked || false;

    const toggleCheck = (e) => {
        e.stopPropagation();
        onUpdate?.(accountCode, { ...annotation, checked: !checked });
    };

    const saveAnnotation = () => {
        onUpdate?.(accountCode, { ...annotation, note, ref });
        setIsOpen(false);
    };

    const clearAll = () => {
        onUpdate?.(accountCode, null);
        setNote('');
        setRef('');
        setIsOpen(false);
    };

    const hasNote = annotation?.note && annotation.note.trim().length > 0;
    const hasRef = annotation?.ref && annotation.ref.trim().length > 0;

    return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, position: 'relative' }}>
            {/* Checkmark toggle */}
            <button
                onClick={toggleCheck}
                title={checked ? 'Mark as not reviewed' : 'Mark as reviewed'}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '1px 2px',
                    color: checked ? '#16a34a' : '#cbd5e1', fontSize: compact ? 13 : 15,
                    transition: 'color 0.15s',
                }}
            >
                <i className={checked ? 'ph-fill ph-check-circle' : 'ph ph-circle'}></i>
            </button>

            {/* Note indicator */}
            {hasNote && (
                <span
                    title={annotation.note}
                    style={{
                        fontSize: 10, color: '#d97706', cursor: 'pointer',
                    }}
                    onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
                >
                    <i className="ph-fill ph-note-pencil"></i>
                </span>
            )}

            {/* Ref badge */}
            {hasRef && (
                <span
                    title={`Ref: ${annotation.ref}`}
                    style={{
                        fontSize: 8, fontWeight: 700, fontFamily: 'monospace',
                        background: '#dbeafe', color: '#2563eb', padding: '1px 4px',
                        borderRadius: 3, cursor: 'pointer',
                    }}
                    onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
                >
                    {annotation.ref}
                </span>
            )}

            {/* Ellipsis menu to open popover */}
            <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '1px 2px',
                    color: '#94a3b8', fontSize: compact ? 12 : 14,
                    opacity: isOpen ? 1 : 0.4,
                    transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => { if (!isOpen) e.currentTarget.style.opacity = '0.4'; }}
            >
                <i className="ph ph-dots-three"></i>
            </button>

            {/* Popover */}
            {isOpen && (
                <div ref={popoverRef} style={{
                    position: 'absolute', top: '100%', right: 0, zIndex: 100,
                    background: 'white', border: '1px solid #e2e8f0', borderRadius: 8,
                    padding: 12, width: 240, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                }} onClick={e => e.stopPropagation()}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                        <i className="ph ph-note-pencil" style={{ marginRight: 4, color: '#7c3aed' }}></i>
                        Annotation — {accountCode}
                    </div>

                    {/* Status toggle */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0',
                        borderBottom: '1px solid #f1f5f9', marginBottom: 8,
                    }}>
                        <button onClick={toggleCheck} style={{
                            background: checked ? '#dcfce7' : '#f1f5f9',
                            border: `1px solid ${checked ? '#86efac' : '#e2e8f0'}`,
                            borderRadius: 5, padding: '3px 8px', fontSize: 10, fontWeight: 600,
                            color: checked ? '#16a34a' : '#64748b', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                            <i className={checked ? 'ph-fill ph-check-circle' : 'ph ph-circle'}></i>
                            {checked ? 'Reviewed' : 'Not reviewed'}
                        </button>
                    </div>

                    {/* Reference */}
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 3 }}>
                        Reference (e.g. WP-A1)
                    </label>
                    <input
                        type="text" value={ref} onChange={e => setRef(e.target.value)}
                        placeholder="WP-A1"
                        style={{
                            width: '100%', padding: '5px 7px', border: '1.5px solid #e2e8f0',
                            borderRadius: 5, fontSize: 11, boxSizing: 'border-box', marginBottom: 8,
                        }}
                    />

                    {/* Note */}
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 3 }}>
                        Note
                    </label>
                    <textarea
                        value={note} onChange={e => setNote(e.target.value)}
                        placeholder="Year-end notes..."
                        rows={3}
                        style={{
                            width: '100%', padding: '5px 7px', border: '1.5px solid #e2e8f0',
                            borderRadius: 5, fontSize: 11, boxSizing: 'border-box', resize: 'vertical',
                            fontFamily: 'inherit',
                        }}
                    />

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                        <button onClick={clearAll} style={{
                            background: 'none', border: 'none', color: '#dc2626', fontSize: 10,
                            fontWeight: 600, cursor: 'pointer', padding: '3px 0',
                        }}>
                            Clear all
                        </button>
                        <button onClick={saveAnnotation} style={{
                            padding: '4px 12px', background: '#7c3aed', color: 'white',
                            border: 'none', borderRadius: 5, fontSize: 10, fontWeight: 600,
                            cursor: 'pointer',
                        }}>
                            Save
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AnnotationPopover;
