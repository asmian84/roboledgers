import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

/* ── Network graphic ── */
const NODES = [
    { cx: 112, cy: 86,  r: 14, label: '🧠' },
    { cx: 202, cy: 42,  r: 14, label: '🏦' },
    { cx: 258, cy: 109, r: 12, label: '📊' },
    { cx: 210, cy: 178, r: 12, label: '⚖️' },
    { cx: 114, cy: 186, r: 12, label: '📁' },
    { cx: 38,  cy: 142, r: 12, label: '🔗' },
];
const CX = 150, CY = 120;

function NetworkGraphic() {
    return (
        <svg width="220" height="176" viewBox="0 0 300 240" fill="none"
             style={{ display: 'block', margin: '0 auto' }}>
            <circle cx={CX} cy={CY} r="88"  fill="rgba(124,58,237,0.04)" />
            <circle cx={CX} cy={CY} r="62"  fill="rgba(124,58,237,0.07)" />
            <circle cx={CX} cy={CY} r="40"  fill="rgba(124,58,237,0.10)" />

            {NODES.map((n, i) => (
                <line key={i} x1={CX} y1={CY} x2={n.cx} y2={n.cy}
                    stroke="rgba(124,58,237,0.30)" strokeWidth="1.5"
                    strokeDasharray="4 3" />
            ))}
            {NODES.map((n, i) => {
                const mx = (CX + n.cx) / 2, my = (CY + n.cy) / 2;
                return <circle key={i} cx={mx} cy={my} r="2.5"
                    fill="rgba(124,58,237,0.50)" />;
            })}
            {NODES.map((n, i) => (
                <g key={i}>
                    <circle cx={n.cx} cy={n.cy} r={n.r + 6}
                        fill="rgba(124,58,237,0.06)" />
                    <circle cx={n.cx} cy={n.cy} r={n.r}
                        fill="rgba(10,7,22,0.95)"
                        stroke="rgba(124,58,237,0.45)" strokeWidth="1.5" />
                    <text x={n.cx} y={n.cy + 5} textAnchor="middle"
                        fontSize="12" style={{ userSelect: 'none' }}>{n.label}</text>
                </g>
            ))}

            {/* Center node */}
            <circle cx={CX} cy={CY} r="46" fill="rgba(124,58,237,0.10)"
                stroke="rgba(124,58,237,0.22)" strokeWidth="1" />
            <circle cx={CX} cy={CY} r="32" fill="rgba(8,6,20,0.97)"
                stroke="rgba(124,58,237,0.60)" strokeWidth="1.8" />
            <path d={`M${CX-9} ${CY-14}h7a5 5 0 0 1 0 10h-7V${CY-14}Z`}
                fill="white" opacity="0.85" />
            <path d={`M${CX-9} ${CY-4}h8a5 5 0 0 1 0 10h-8V${CY-4}Z`}
                fill="white" opacity="0.52" />
        </svg>
    );
}

export default function LoginPage() {
    const [mode, setMode]         = useState('signin');
    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState('');
    const [message, setMessage]   = useState('');

    const reset = () => { setError(''); setMessage(''); };

    const handleSubmit = async (e) => {
        e.preventDefault(); reset(); setLoading(true);
        try {
            if (mode === 'signin') {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else if (mode === 'signup') {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                setMessage('Check your email for a confirmation link.');
            } else {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset`,
                });
                if (error) throw error;
                setMessage('Reset link sent — check your email.');
            }
        } catch (err) {
            setError(err.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={s.root}>
            <div style={s.bgGlow} />

            <div style={s.page}>
                {/* Brand */}
                <div style={s.brand}>
                    <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
                        <rect width="32" height="32" rx="8" fill="#7C3AED"/>
                        <path d="M8 10h10a4 4 0 0 1 0 8H8V10Z" fill="white" opacity="0.9"/>
                        <path d="M8 18h12a4 4 0 0 1 0 8H8V18Z" fill="white" opacity="0.6"/>
                    </svg>
                    <span style={s.brandName}>RoboLedger</span>
                </div>

                {/* Network graphic */}
                <NetworkGraphic />

                {/* Login card — directly below graphic */}
                <div style={s.card}>
                    <h2 style={s.cardHeading}>
                        {mode === 'signin' && 'Sign in'}
                        {mode === 'signup' && 'Create account'}
                        {mode === 'reset'  && 'Reset password'}
                    </h2>

                    <form onSubmit={handleSubmit} style={s.form}>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="Email address"
                            required
                            style={s.input}
                        />

                        {mode !== 'reset' && (
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Password"
                                required
                                minLength={6}
                                style={s.input}
                            />
                        )}

                        {error   && <div style={s.errorBox}>{error}</div>}
                        {message && <div style={s.successBox}>{message}</div>}

                        <button type="submit" disabled={loading}
                            style={{ ...s.btn, opacity: loading ? 0.65 : 1 }}>
                            {loading ? 'Please wait…'
                                : mode === 'signin' ? 'Sign In →'
                                : mode === 'signup' ? 'Create Account →'
                                : 'Send Reset Link'}
                        </button>
                    </form>

                    <div style={s.cardFooter}>
                        {mode === 'signin' && <>
                            <button style={s.link} onClick={() => { setMode('reset'); reset(); }}>Forgot password?</button>
                            <span style={s.dot}>·</span>
                            <button style={s.link} onClick={() => { setMode('signup'); reset(); }}>Create account</button>
                        </>}
                        {mode === 'signup' && <>
                            <span style={s.footerText}>Already have an account?</span>
                            <button style={s.link} onClick={() => { setMode('signin'); reset(); }}>Sign in</button>
                        </>}
                        {mode === 'reset' && (
                            <button style={s.link} onClick={() => { setMode('signin'); reset(); }}>← Back to sign in</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const s = {
    root: {
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(160deg, #0a0814 0%, #0d0d1a 45%, #080810 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        overflow: 'hidden',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bgGlow: {
        position: 'fixed',
        top: '35%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '560px',
        height: '560px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 68%)',
        pointerEvents: 'none',
    },
    page: {
        position: 'relative',
        zIndex: 1,
        width: '360px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
    },

    /* Brand */
    brand: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '9px',
        marginBottom: '8px',
    },
    brandName: {
        fontSize: '16px',
        fontWeight: '700',
        color: '#fff',
        letterSpacing: '-0.2px',
    },

    /* Login card */
    card: {
        width: '100%',
        marginTop: '4px',
        padding: '14px 0 0',
    },
    eyebrow: {
        fontSize: '11px',
        fontWeight: '600',
        color: '#7C3AED',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        margin: '0 0 6px',
        textAlign: 'center',
    },
    cardHeading: {
        fontSize: '20px',
        fontWeight: '700',
        color: '#eeeef6',
        letterSpacing: '-0.4px',
        margin: '0 0 14px',
        textAlign: 'center',
        lineHeight: '1.2',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
    },
    input: {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '10px',
        padding: '12px 14px',
        fontSize: '14px',
        color: '#eeeef6',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s',
    },
    btn: {
        background: 'linear-gradient(135deg, #7C3AED 0%, #6025c0 100%)',
        color: '#fff',
        border: 'none',
        borderRadius: '10px',
        padding: '12px 16px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        width: '100%',
        marginTop: '2px',
        letterSpacing: '0.01em',
        transition: 'opacity 0.15s',
    },
    errorBox: {
        background: 'rgba(239,68,68,0.07)',
        border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: '8px',
        padding: '9px 12px',
        fontSize: '13px',
        color: '#fca5a5',
    },
    successBox: {
        background: 'rgba(34,197,94,0.07)',
        border: '1px solid rgba(34,197,94,0.2)',
        borderRadius: '8px',
        padding: '9px 12px',
        fontSize: '13px',
        color: '#86efac',
    },
    cardFooter: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        marginTop: '16px',
    },
    footerText: {
        fontSize: '13px',
        color: '#374151',
    },
    link: {
        background: 'none',
        border: 'none',
        color: '#7C3AED',
        fontSize: '13px',
        cursor: 'pointer',
        padding: 0,
        fontWeight: '500',
    },
    dot: {
        color: '#1f2937',
        fontSize: '13px',
    },
};
