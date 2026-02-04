/**
 * RoboLedgers: Unified Command Center
 * Single Page Application Controller
 */

const STATE = {
    currentView: 'home',
    netCash: '$42,500.00',
    runway: '8.4 Months',
    healthScore: '98',
    anomalies: [
        { id: 1, type: 'BRAIN', msg: 'High similarity match on HEB GROCERY', severity: 'low' },
        { id: 2, type: 'LEDGER', msg: 'Period P_2025_01 ready for LOCK', severity: 'medium' }
    ]
};

function init() {
    setupNavigation();
    renderView();
}

function setupNavigation() {
    const navItems = {
        'nav-home': 'home',
        'nav-bookkeeper': 'bookkeeper',
        'nav-accountant': 'accountant',
        'nav-cfo': 'cfo'
    };

    Object.entries(navItems).forEach(([id, view]) => {
        document.getElementById(id).addEventListener('click', () => {
            switchView(view);
        });
    });
}

function switchView(view) {
    STATE.currentView = view;

    // Update active nav state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.id === `nav-${view}`) item.classList.add('active');
    });

    renderView();
}

function renderView() {
    const root = document.getElementById('app-root');
    root.innerHTML = ''; // Clear stage

    switch (STATE.currentView) {
        case 'home':
            renderHome(root);
            break;
        case 'bookkeeper':
            renderBookkeeper(root);
            break;
        case 'accountant':
            renderAccountant(root);
            break;
        case 'cfo':
            renderCFO(root);
            break;
    }
}

/* --- VIEW MODULES --- */

function renderHome(container) {
    container.innerHTML = `
        <header style="margin-bottom: 40px;">
            <h1 style="font-size: 2.2rem; font-family: var(--font-heading); font-weight: 800; margin-bottom: 8px;">Command Pulse</h1>
            <p style="color: var(--text-secondary);">Real-time financial health and system integrity status.</p>
        </header>

        <div class="dashboard-grid">
            <div class="pulse-card">
                <div class="card-label">Net Liquidity</div>
                <div class="card-value">${STATE.netCash}</div>
                <div class="card-delta delta-up">↑ 12% vs last month</div>
            </div>
            <div class="pulse-card">
                <div class="card-label">Projected Runway</div>
                <div class="card-value">${STATE.runway}</div>
                <div class="card-delta" style="color: var(--text-dim);">Based on current burn</div>
            </div>
            <div class="pulse-card">
                <div class="card-label">Truth Health Score</div>
                <div class="card-value" style="color: var(--accent-emerald);">${STATE.healthScore}<span style="font-size: 1rem; color: var(--text-dim);">/100</span></div>
                <div class="card-delta delta-up">Fully Reconciled</div>
            </div>
        </div>

        <div class="stream-panel">
            <div class="panel-header">
                <h3 class="panel-title">System Activity & Anomalies</h3>
                <span class="p-badge certified">Live Sync Active</span>
            </div>
            
            <div id="anomaly-list">
                ${STATE.anomalies.map(a => `
                    <div class="stream-item">
                        <span class="status-dot" style="background: ${a.severity === 'medium' ? 'var(--accent-indigo)' : 'var(--accent-emerald)'};"></span>
                        <div style="flex: 1;">
                            <div style="font-size: 0.9rem; font-weight: 600;">${a.msg}</div>
                            <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 2px;">Source: ${a.type} | Detected 2h ago</div>
                        </div>
                        <button class="btn-primary" style="padding: 6px 12px; font-size: 0.75rem;">Inspect</button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderBookkeeper(container) {
    container.innerHTML = `
        <header style="margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <h1 style="font-size: 1.8rem; font-family: var(--font-heading); margin-bottom: 4px;">Bookkeeper Lens</h1>
                <p style="color: var(--text-secondary);">Verify incoming transactions through the Brain firewall.</p>
            </div>
            <div class="p-badge projection" style="margin-bottom: 8px;">3 Pending Verification</div>
        </header>

        <div class="stream-panel">
            <table style="width: 100%; border-collapse: collapse; color: var(--text-primary); font-size: 0.9rem;">
                <thead>
                    <tr style="text-align: left; color: var(--text-dim); text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em;">
                        <th style="padding: 12px 16px;">Date</th>
                        <th style="padding: 12px 16px;">Description</th>
                        <th style="padding: 12px 16px;">Brain Prediction</th>
                        <th style="padding: 12px 16px; text-align: right;">Amount</th>
                        <th style="padding: 12px 16px; text-align: center;">Confidence</th>
                        <th style="padding: 12px 16px; text-align: right;">Action</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 16px;">2025-01-28</td>
                        <td style="padding: 16px; font-weight: 600;">Cloud Hosting Inc</td>
                        <td style="padding: 16px;"><span class="p-badge projection">Technology</span></td>
                        <td style="padding: 16px; text-align: right; font-weight: 600;">$240.00</td>
                        <td style="padding: 16px;">
                            <div style="width: 100px; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; margin: 0 auto;">
                                <div style="width: 92%; height: 100%; background: var(--accent-emerald); border-radius: 3px;"></div>
                            </div>
                        </td>
                        <td style="padding: 16px; text-align: right;">
                            <button class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; background: var(--accent-emerald);">Verify</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
}

function renderAccountant(container) {
    container.innerHTML = `
        <header style="margin-bottom: 32px;">
            <h1 style="font-size: 1.8rem; font-family: var(--font-heading);">Accountant Governance</h1>
            <p style="color: var(--text-secondary);">Hardening the ledger truth through period locking and audit log review.</p>
        </header>

        <div class="dashboard-grid">
            <div class="pulse-card">
                <div class="card-label">Active Period</div>
                <div class="card-value">P_2025_01</div>
                <button class="btn-primary" style="margin-top: 16px; width: 100%; background: var(--accent-indigo);">Request Lock</button>
            </div>
            <div class="pulse-card">
                <div class="card-label">Truth State</div>
                <div class="card-value" style="color: var(--accent-emerald);">CERTIFIED</div>
                <div class="card-delta">CERT-8829-XQ Issued</div>
            </div>
            <div class="pulse-card">
                <div class="card-label">Audit Readiness</div>
                <div class="card-value">100%</div>
                <div class="card-delta">Proof Objects Validated</div>
            </div>
        </div>
    `;
}

function renderCFO(container) {
    container.innerHTML = `
        <header style="margin-bottom: 32px;">
            <h1 style="font-size: 1.8rem; font-family: var(--font-heading);">CFO Intelligence</h1>
            <p style="color: var(--text-secondary);">Hypothetical scenario modeling based on certified ledger data.</p>
        </header>

        <div style="display: grid; grid-template-columns: 1fr 350px; gap: 24px;">
            <div class="stream-panel" style="min-height: 400px; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at center, rgba(99, 102, 241, 0.05), transparent);">
                <div style="text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 16px;">📈</div>
                    <div style="font-weight: 600; color: var(--text-secondary);">Interactive Chart Module</div>
                    <div style="font-size: 0.8rem; color: var(--text-dim);">Rendering Projection: Growth v1</div>
                </div>
            </div>

            <div class="stream-panel">
                <h3 class="panel-title" style="margin-bottom: 20px;">What-If Sandbox</h3>
                
                <div style="margin-bottom: 24px;">
                    <label style="font-size: 0.8rem; color: var(--text-dim); display: block; margin-bottom: 8px;">Revenue Growth Rate</label>
                    <input type="range" style="width: 100%; accent-color: var(--accent-indigo);">
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-top: 4px;">
                        <span>0%</span>
                        <span>+20%</span>
                    </div>
                </div>

                <div style="background: rgba(255,255,255,0.03); border: 1px dashed var(--accent-indigo); border-radius: 12px; padding: 16px;">
                    <div class="p-badge projection" style="margin-bottom: 12px;">PROJECTION MODE</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Estimated Cash Position</div>
                    <div style="font-size: 1.5rem; font-weight: 800; font-family: var(--font-heading); margin: 4px 0;">$52,120.00</div>
                    <div style="font-size: 0.7rem; color: var(--accent-emerald);">Delta: +$10,200 vs Truth</div>
                </div>

                <button class="btn-primary" style="width: 100%; margin-top: 20px;">Apply Assumptions</button>
            </div>
        </div>
    `;
}

// Start app
init();
