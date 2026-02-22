import React from 'react';

/**
 * ReportControlsBar — Shared zoom, text size, and font family controls.
 * Reusable across all full-page reports (Trial Balance, Income Statement, GST).
 *
 * Props:
 *   zoom        — current zoom level (70–150)
 *   setZoom     — setter
 *   textSize    — current base text size in px (11 | 13 | 15)
 *   setTextSize — setter
 *   fontFamily  — current font key ('system' | 'serif' | 'mono' | 'caseware')
 *   setFontFamily — setter
 *   accentColor — Tailwind colour name for active states ('green' | 'blue' | 'emerald')
 *   children    — optional extra controls to render on the right side
 */

const FONTS = {
    system:   { label: 'System',   stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
    serif:    { label: 'Serif',    stack: 'Georgia, "Times New Roman", serif' },
    mono:     { label: 'Mono',     stack: '"SF Mono", "Fira Code", "Courier New", monospace' },
    caseware: { label: 'Caseware', stack: 'Arial, Helvetica, sans-serif' },
};

export { FONTS };

export function ReportControlsBar({
    zoom, setZoom,
    textSize, setTextSize,
    fontFamily, setFontFamily,
    accentColor = 'green',
    children
}) {
    // Map accent colour to Tailwind classes
    const accentClasses = {
        green:   { active: 'bg-green-100 text-green-700',   ring: 'focus:ring-green-400' },
        blue:    { active: 'bg-blue-100 text-blue-700',     ring: 'focus:ring-blue-400' },
        emerald: { active: 'bg-emerald-100 text-emerald-700', ring: 'focus:ring-emerald-400' },
    };
    const accent = accentClasses[accentColor] || accentClasses.green;

    return (
        <div className="flex items-center gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200">
            {/* Zoom */}
            <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-1 bg-white">
                <button
                    onClick={() => setZoom(z => Math.max(70, z - 10))}
                    className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded"
                    title="Zoom out"
                >
                    <i className="ph ph-minus text-[13px]"></i>
                </button>
                <span className="text-[12px] font-mono text-gray-500 w-10 text-center select-none">{zoom}%</span>
                <button
                    onClick={() => setZoom(z => Math.min(150, z + 10))}
                    className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded"
                    title="Zoom in"
                >
                    <i className="ph ph-plus text-[13px]"></i>
                </button>
                {zoom !== 100 && (
                    <button
                        onClick={() => setZoom(100)}
                        className="text-[11px] text-blue-500 hover:text-blue-700 font-semibold px-1"
                        title="Reset zoom"
                    >
                        Reset
                    </button>
                )}
            </div>

            {/* Text size */}
            <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-1 bg-white">
                <i className="ph ph-text-aa text-[13px] text-gray-400"></i>
                {[11, 13, 15].map(sz => (
                    <button
                        key={sz}
                        onClick={() => setTextSize(sz)}
                        className={`w-7 h-7 flex items-center justify-center rounded text-[12px] font-semibold transition-colors ${
                            textSize === sz ? accent.active : 'text-gray-400 hover:text-gray-700'
                        }`}
                        title={`${sz === 11 ? 'Small' : sz === 13 ? 'Medium' : 'Large'} text`}
                    >
                        {sz === 11 ? 'S' : sz === 13 ? 'M' : 'L'}
                    </button>
                ))}
            </div>

            {/* Font family */}
            <select
                value={fontFamily}
                onChange={e => setFontFamily(e.target.value)}
                className={`text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white cursor-pointer focus:outline-none focus:ring-1 ${accent.ring}`}
                title="Report font"
            >
                {Object.entries(FONTS).map(([key, f]) => (
                    <option key={key} value={key}>{f.label}</option>
                ))}
            </select>

            {/* Extra controls (right side) */}
            {children && (
                <div className="ml-auto flex items-center gap-3">
                    {children}
                </div>
            )}
        </div>
    );
}

export default ReportControlsBar;
