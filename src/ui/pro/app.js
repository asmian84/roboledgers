/**
 * RoboLedgers: Professional Workspace Frontend
 * Lenses: Bookkeeper, Accountant
 */

const mockTransactions = [
    {
        tx_id: 'tx_p_01',
        date: '2025-01-15',
        merchant: 'Cloud Hosting Services',
        account_name: 'Operating Bank',
        amount_display: '$450.00 CAD',
        amount_cents: 45000,
        state: 'PREDICTED',
        predicted_category: 'Technology',
        category_code: '6100',
        confidence: 0.92,
        is_matched: false,
        allowed_categories: ['6100: Technology', '6200: Software', '6300: Legal']
    },
    {
        tx_id: 'tx_p_02',
        date: '2025-01-16',
        merchant: 'Acme Corp Deposit',
        account_name: 'Operating Bank',
        amount_display: '$5,000.00 CAD',
        amount_cents: 500000,
        state: 'RECONCILED',
        predicted_category: 'Revenue',
        category_code: '4000',
        confidence: 1.0,
        is_matched: true,
        allowed_categories: ['4000: Revenue', '4100: Interest']
    }
];

const mockTrialBalance = [
    { code: '1010', name: 'Chequing Account', debit: '$15,000.00', credit: '$0.00', balance: '$15,000.00' },
    { code: '2100', name: 'Accounts Payable', debit: '$0.00', credit: '$5,000.00', balance: '($5,000.00)' },
    { code: '4000', name: 'Sales Revenue', debit: '$0.00', credit: '$10,000.00', balance: '($10,000.00)' }
];

let currentLens = 'BOOKKEEPER';

function renderLens() {
    const root = document.getElementById('lens-root');
    const title = document.getElementById('view-title');
    const modeIndicator = document.getElementById('current-mode');

    modeIndicator.innerText = currentLens;

    if (currentLens === 'BOOKKEEPER') {
        title.innerText = 'Transaction Verification';
        renderBookkeeperView(root);
    } else if (currentLens === 'ACCOUNTANT') {
        title.innerText = 'Governance & Trial Balance';
        renderAccountantView(root);
    } else if (currentLens === 'CFO') {
        title.innerText = 'CFO Intelligence Center';
        renderCFOView(root);
    }
}

function renderCFOView(container) {
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
            <!-- Certified Metrics Panel -->
            <div>
                <h3 style="font-size: 0.9rem; text-transform: uppercase; color: var(--text-dim); margin-bottom: 20px;">Certified Financial Health</h3>
                <div style="background: white; padding: 24px; border-radius: 8px; border: 1px solid var(--border);">
                    <div style="margin-bottom: 24px;">
                        <span class="p-badge locked">Truth State: CERTIFIED</span>
                        <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 4px;">Derived from P_2025_01 (Locked)</div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Current Ratio</span>
                            <strong style="color: var(--status-reconciled);">1.52</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Monthly Burn (Observed)</span>
                            <strong>$12,400.00</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Projected Runway</span>
                            <strong>5.2 Months</strong>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Forecast Sandbox Panel -->
            <div>
                <h3 style="font-size: 0.9rem; text-transform: uppercase; color: var(--text-dim); margin-bottom: 20px;">Forecast Sandbox (What-If)</h3>
                <div style="background: hsla(280, 20%, 98%, 1); padding: 24px; border-radius: 8px; border: 1px dashed var(--status-projection);">
                    <div style="margin-bottom: 24px;">
                        <span class="p-badge projection">Truth State: PROJECTION</span>
                        <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 4px;">Hypothetical assumptions applied to truth.</div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <div>
                            <label style="font-size: 0.75rem; display: block; margin-bottom: 4px;">Assumed Growth Rate</label>
                            <input type="range" min="0.8" max="2.0" step="0.1" value="1.2" style="width: 100%; accent-color: var(--status-projection);">
                        </div>
                        <div style="background: white; padding: 12px; border-radius: 4px; border: 1px solid hsla(280, 20%, 90%, 1);">
                            <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
                                <span>Projected Cash Balance</span>
                                <strong style="color: var(--status-projection);">$18,450.00</strong>
                            </div>
                            <div style="font-size: 0.65rem; color: var(--text-dim); margin-top: 4px;">(Hypothetical Net Delta: +$6,050.00)</div>
                        </div>
                        <button class="btn-pro" style="background: var(--status-projection); width: 100%;">Run Scenario</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Intent Handlers
window.confirmCategory = (txId) => {
    const tx = mockTransactions.find(t => t.tx_id === txId);
    if (tx) tx.state = 'CONFIRMED';
    renderLens();
};

window.lockPeriod = () => {
    const confirmed = confirm("Are you sure you want to LOCK period P_2025_01?\n\nThis action is IMMUTABLE and will generate a Proof Certificate.");
    if (confirmed) {
        alert("GOVERNANCE: Period P_2025_01 is now LOCKED.\nCertificate: CERT-8829-XQ\nAll existing transactions are now read-only.");
    }
};

window.showAJEModal = () => {
    alert("INTERVENTIONAL UI: Enter balancing debits/credits to reclassify interpretation.");
};

// Navigation
document.getElementById('nav-bookkeeper').addEventListener('click', () => {
    switchLens('BOOKKEEPER');
});

document.getElementById('nav-accountant').addEventListener('click', () => {
    switchLens('ACCOUNTANT');
});

document.getElementById('nav-cfo').addEventListener('click', () => {
    switchLens('CFO');
});

function switchLens(lens) {
    currentLens = lens;
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
    });
    document.getElementById(`nav-${lens.toLowerCase()}`).classList.add('active');
    renderLens();
}

// Initial Render
renderLens();
