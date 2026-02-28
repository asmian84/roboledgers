import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Expose globally for vanilla JS modules (app.js sign-out + user management)
window.__supabaseSignOut = () => supabase.auth.signOut();

/**
 * Fetch the user's profile row (role, full_name, etc.)
 * Returns { role, email, full_name } or null if table doesn't exist yet.
 */
export async function getUserProfile(userId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, role, full_name')
            .eq('id', userId)
            .single();

        if (error) {
            // Table may not exist yet — fail silently
            if (error.code === 'PGRST205' || error.code === '42P01') return null;
            console.warn('[supabaseClient] getUserProfile error:', error.message);
            return null;
        }
        return data;
    } catch (err) {
        console.warn('[supabaseClient] getUserProfile threw:', err?.message);
        return null;
    }
}

/**
 * Update a user's role (admin only — Supabase RLS enforces this).
 */
export async function setUserRole(userId, role) {
    const { error } = await supabase
        .from('profiles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', userId);
    return { error };
}

/**
 * Fetch all profiles (admin-only via RLS).
 */
export async function getAllProfiles() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, full_name, created_at')
        .order('created_at');
    return { data, error };
}

// Expose profile helpers globally so vanilla JS (app.js / modals) can call them
window.__getAllProfiles = getAllProfiles;
window.__setUserRole   = setUserRole;
