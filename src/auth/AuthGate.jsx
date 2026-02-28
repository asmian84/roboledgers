import React, { useState, useEffect } from 'react';
import { supabase, getUserProfile } from '../lib/supabaseClient.js';
import LoginPage from './LoginPage.jsx';

const ROLE_LABELS = {
    admin:        'Admin',
    power_user:   'Power User',
    normal_user:  'Normal User',
};

/**
 * AuthGate — mounts over the entire app.
 * - Loading:         shows dark overlay
 * - Authenticated:   renders null (gate disappears, app accessible)
 * - Unauthenticated: renders <LoginPage />
 *
 * On successful auth, exposes:
 *   window.__userRole    — 'admin' | 'power_user' | 'normal_user'
 *   window.__userProfile — { id, email, role, full_name }
 */
export default function AuthGate() {
    const [session, setSession] = useState(undefined); // undefined = loading

    // Show/hide the #auth-gate container div based on auth state
    useEffect(() => {
        const el = document.getElementById('auth-gate');
        if (!el) return;
        if (session) {
            el.style.display = 'none';
        } else {
            el.style.display = '';
        }
    }, [session]);

    useEffect(() => {
        let initialised = false;

        const timeout = setTimeout(() => {
            if (!initialised) { initialised = true; setSession(null); }
        }, 4000);

        supabase.auth.getSession()
            .then(({ data: { session }, error }) => {
                clearTimeout(timeout);
                if (error) console.warn('[AuthGate] getSession error:', error.message);
                if (!initialised) {
                    initialised = true;
                    setSession(session ?? null);
                    if (session) _populateProfile(session);
                }
            })
            .catch((err) => {
                clearTimeout(timeout);
                console.warn('[AuthGate] getSession threw:', err?.message);
                if (!initialised) { initialised = true; setSession(null); }
            });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            initialised = true;
            setSession(session ?? null);
            if (session) _populateProfile(session);
            if (event === 'SIGNED_OUT') {
                window.__userRole    = null;
                window.__userProfile = null;
                window.location.reload();
            }
        });

        return () => { clearTimeout(timeout); subscription.unsubscribe(); };
    }, []);

    if (session === undefined) {
        return (
            <div style={loadingStyle}>
                <div style={spinnerStyle} />
            </div>
        );
    }

    if (session) return null;
    return <LoginPage />;
}

/** Fetch profile + populate sidebar + expose globals */
async function _populateProfile(session) {
    const email   = session.user?.email || '';
    const initials = email.slice(0, 2).toUpperCase();

    // Sidebar: name + avatar (instant, from session)
    const nameEl   = document.getElementById('auth-user-name');
    const avatarEl = document.getElementById('auth-user-avatar');
    const roleEl   = document.getElementById('auth-user-role');
    if (nameEl)   nameEl.textContent   = email;
    if (avatarEl) avatarEl.textContent = initials;
    if (roleEl)   roleEl.textContent   = 'Loading…';

    // Fetch role from profiles table
    const profile = await getUserProfile(session.user.id);

    if (profile) {
        window.__userProfile = profile;
        window.__userRole    = profile.role;

        const label = ROLE_LABELS[profile.role] || profile.role;
        if (roleEl)   roleEl.textContent = label;

        // Style the role badge by level
        if (roleEl) {
            if (profile.role === 'admin') {
                roleEl.style.color = '#7C3AED';
                roleEl.style.fontWeight = '600';
            } else if (profile.role === 'power_user') {
                roleEl.style.color = '#0891b2';
                roleEl.style.fontWeight = '600';
            } else {
                roleEl.style.color = '';
                roleEl.style.fontWeight = '';
            }
        }

        // Show "Manage Users" button for admins only
        const manageBtn = document.getElementById('manage-users-btn');
        if (manageBtn) {
            manageBtn.style.display = profile.role === 'admin' ? 'flex' : 'none';
        }
    } else {
        // profiles table not set up yet — show neutral fallback (treat as admin)
        window.__userProfile = { id: session.user.id, email, role: 'admin' };
        window.__userRole    = 'admin';
        if (roleEl) roleEl.textContent = 'Admin';

        // Show manage button (fallback admin)
        const manageBtn = document.getElementById('manage-users-btn');
        if (manageBtn) manageBtn.style.display = 'flex';
    }
}

const loadingStyle = {
    position: 'fixed',
    inset: 0,
    background: '#0a0a0f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
};

const spinnerStyle = {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(124,58,237,0.2)',
    borderTop: '3px solid #7C3AED',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
};

if (typeof document !== 'undefined' && !document.getElementById('authgate-spin')) {
    const style = document.createElement('style');
    style.id = 'authgate-spin';
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
}
