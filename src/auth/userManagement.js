/**
 * User Management Modal
 * Opened by window.openUserManagementModal() — only called for admin users.
 * Lists all profiles from Supabase and lets admins change roles via dropdown.
 */

const ROLES = [
    { value: 'admin',       label: 'Admin',       color: '#7C3AED', desc: 'Full access · manage users'   },
    { value: 'power_user',  label: 'Power User',  color: '#0891b2', desc: 'All features · no user mgmt'  },
    { value: 'normal_user', label: 'Normal User', color: '#64748b', desc: 'Standard access'               },
];

const ROLE_COLOR = { admin: '#7C3AED', power_user: '#0891b2', normal_user: '#64748b' };

window.openUserManagementModal = async function () {
    // Toggle — clicking again closes
    const existing = document.getElementById('user-mgmt-overlay');
    if (existing) { existing.remove(); return; }

    // Build shell
    const overlay = document.createElement('div');
    overlay.id = 'user-mgmt-overlay';
    overlay.style.cssText = [
        'position:fixed;inset:0;',
        'background:rgba(15,23,42,0.6);',
        'backdrop-filter:blur(4px);',
        '-webkit-backdrop-filter:blur(4px);',
        'z-index:99999;',
        'display:flex;align-items:center;justify-content:center;',
        'padding:20px;',
    ].join('');

    overlay.innerHTML = `
      <div style="
        background:#fff; border-radius:16px;
        width:500px; max-width:95vw; max-height:86vh;
        display:flex; flex-direction:column;
        box-shadow:0 24px 60px rgba(0,0,0,0.28);
        overflow:hidden;
      ">
        <!-- Header -->
        <div style="padding:18px 22px 16px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:12px;flex-shrink:0;">
          <div style="
            width:38px;height:38px;border-radius:10px;flex-shrink:0;
            background:linear-gradient(135deg,#7C3AED,#6025c0);
            display:flex;align-items:center;justify-content:center;color:#fff;font-size:17px;
          "><i class="ph ph-users-three"></i></div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#0f172a;letter-spacing:-0.2px;">User Management</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:1px;">Assign roles to team members</div>
          </div>
          <button onclick="document.getElementById('user-mgmt-overlay').remove()"
            style="margin-left:auto;background:none;border:none;cursor:pointer;
                   font-size:18px;color:#94a3b8;padding:4px;line-height:1;border-radius:6px;"
            onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">
            <i class="ph ph-x"></i>
          </button>
        </div>

        <!-- Role legend -->
        <div style="padding:10px 22px;border-bottom:1px solid #f8fafc;display:flex;gap:16px;flex-shrink:0;background:#fafafa;">
          ${ROLES.map(r => `
            <div style="display:flex;align-items:center;gap:5px;">
              <span style="width:8px;height:8px;border-radius:50%;background:${r.color};flex-shrink:0;"></span>
              <span style="font-size:10.5px;font-weight:600;color:#475569;">${r.label}</span>
              <span style="font-size:10px;color:#94a3b8;">— ${r.desc}</span>
            </div>`).join('')}
        </div>

        <!-- User list -->
        <div id="user-mgmt-body" style="flex:1;overflow-y:auto;padding:8px 0;">
          <div style="text-align:center;padding:40px 0;color:#94a3b8;font-size:13px;">
            <i class="ph ph-spinner" style="font-size:22px;display:block;margin-bottom:8px;"></i>
            Loading users…
          </div>
        </div>

        <!-- Footer -->
        <div style="padding:12px 22px;border-top:1px solid #f1f5f9;flex-shrink:0;background:#fafafa;">
          <div style="font-size:11px;color:#94a3b8;">
            <i class="ph ph-info" style="margin-right:4px;"></i>
            Role changes take effect on the user's next login.
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.addEventListener('keydown', function _escUm(e) {
        if (e.key === 'Escape') {
            document.getElementById('user-mgmt-overlay')?.remove();
            document.removeEventListener('keydown', _escUm);
        }
    });

    // Load users
    await _renderUserList();
};

async function _renderUserList() {
    const body = document.getElementById('user-mgmt-body');
    if (!body) return;

    if (!window.__getAllProfiles) {
        body.innerHTML = _errorHtml('Profile helpers not loaded yet. Please refresh.');
        return;
    }

    const { data: profiles, error } = await window.__getAllProfiles();

    if (error || !profiles) {
        body.innerHTML = _errorHtml(
            'Could not load users. ' +
            'Run <strong>supabase-profiles-migration.sql</strong> in your Supabase SQL editor first.'
        );
        return;
    }

    if (profiles.length === 0) {
        body.innerHTML = `<div style="text-align:center;padding:40px 0;color:#94a3b8;font-size:13px;">No users found.</div>`;
        return;
    }

    const currentUserId = window.__userProfile?.id;

    body.innerHTML = profiles.map(p => {
        const isSelf   = p.id === currentUserId;
        const initials = (p.email || '?').slice(0, 2).toUpperCase();
        const roleColor = ROLE_COLOR[p.role] || '#64748b';

        return `
          <div style="
            display:flex;align-items:center;gap:12px;
            padding:11px 22px;border-bottom:1px solid #f8fafc;
            transition:background 0.1s;
          " onmouseover="this.style.background='#fafafa'" onmouseout="this.style.background='transparent'">

            <!-- Avatar -->
            <div style="
              width:34px;height:34px;border-radius:50%;flex-shrink:0;
              background:${roleColor}18;
              display:flex;align-items:center;justify-content:center;
              font-size:11px;font-weight:700;color:${roleColor};
            ">${initials}</div>

            <!-- Info -->
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${p.email}${isSelf ? ' <span style="font-size:10px;font-weight:500;color:#94a3b8;">(you)</span>' : ''}
              </div>
              ${p.full_name ? `<div style="font-size:11px;color:#94a3b8;margin-top:1px;">${p.full_name}</div>` : ''}
            </div>

            <!-- Role badge (current) -->
            <span style="
              font-size:10px;font-weight:700;
              color:${roleColor};background:${roleColor}14;
              border:1px solid ${roleColor}30;
              border-radius:20px;padding:2px 9px;white-space:nowrap;
              flex-shrink:0;
            " id="role-badge-${p.id}">${ROLES.find(r => r.value === p.role)?.label || p.role}</span>

            <!-- Role selector -->
            <select
              data-uid="${p.id}"
              data-current="${p.role}"
              onchange="window._applyRoleChange(this)"
              style="
                padding:6px 10px;border:1px solid #e2e8f0;border-radius:8px;
                font-size:12px;font-weight:600;color:#0f172a;background:#fff;
                cursor:pointer;outline:none;flex-shrink:0;min-width:116px;
              ">
              ${ROLES.map(r => `<option value="${r.value}" ${p.role === r.value ? 'selected' : ''}>${r.label}</option>`).join('')}
            </select>
          </div>`;
    }).join('');
}

window._applyRoleChange = async function (select) {
    const userId  = select.getAttribute('data-uid');
    const newRole = select.value;
    const prevRole = select.getAttribute('data-current');

    if (newRole === prevRole) return;

    // Optimistic UI
    select.disabled = true;
    const badge = document.getElementById(`role-badge-${userId}`);
    if (badge) {
        const r = ROLES.find(r => r.value === newRole);
        if (r) {
            badge.textContent = r.label;
            badge.style.color = r.color;
            badge.style.background = r.color + '14';
            badge.style.borderColor = r.color + '30';
        }
    }

    const { error } = await window.__setUserRole(userId, newRole);
    select.disabled = false;

    if (error) {
        // Revert
        select.value = prevRole;
        if (badge) {
            const r = ROLES.find(r => r.value === prevRole);
            if (r) {
                badge.textContent = r.label;
                badge.style.color = r.color;
                badge.style.background = r.color + '14';
                badge.style.borderColor = r.color + '30';
            }
        }
        _showToast('Failed: ' + (error.message || 'Unknown error'), 'error');
    } else {
        select.setAttribute('data-current', newRole);
        _showToast(`Role updated to ${ROLES.find(r => r.value === newRole)?.label}`, 'success');
    }
};

function _errorHtml(msg) {
    return `
      <div style="text-align:center;padding:40px 22px;">
        <i class="ph ph-warning-circle" style="font-size:32px;color:#f59e0b;display:block;margin-bottom:10px;"></i>
        <div style="font-size:13px;color:#475569;line-height:1.5;">${msg}</div>
      </div>`;
}

function _showToast(msg, type) {
    const t = document.createElement('div');
    t.style.cssText = `
        position:fixed;bottom:24px;right:24px;z-index:999999;
        padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;
        box-shadow:0 8px 24px rgba(0,0,0,0.18);pointer-events:none;
        background:${type === 'success' ? '#dcfce7' : '#fee2e2'};
        color:${type === 'success' ? '#16a34a' : '#dc2626'};
        border:1px solid ${type === 'success' ? '#bbf7d0' : '#fecaca'};
    `;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2800);
}
