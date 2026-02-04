/**
 * RoboLedgers Financial OS Controller
 * Manages view switching, theming, and institutional rituals.
 */

const STATE = {
    role: 'ACCOUNTANT',
    currentView: 'zen',
    entity: 'RoboCorp Holdings',
    activeAudit: null
};

const MOCK_TRANSACTIONS = [
    {
        id: 'tx_8829_xq',
        date: '2025-01-15',
        desc: 'CLOUD HOSTING SERVICES INC',
        brain_prediction: 'Technology (6100)',
        amount: '$450.00',
        polarity: 'DEBIT',
        status: 'PREDICTED',
        confidence: 0.92,
        txsig: '76e7601889544d6c0bee0772973b94e5a38c5587589601729b1918526a73f6c5d',
        source: { doc: 'statement_jan.pdf', page: 4, coords: 'x:120, y:450' }
    },
    {
        id: 'tx_9912_zb',
        date: '2025-01-20',
        desc: 'STARBUCKS COFFEE #4482',
        brain_prediction: 'Dining (6210)',
        amount: '$12.50',
        polarity: 'DEBIT',
        status: 'RAW',
        confidence: 0.45,
        txsig: 'b6585ee4cc1d4d... (Forensic Hash)',
        source: { doc: 'visa_export.csv', page: 1, coords: 'row:24' }
    }
];

function init() {
    setupListeners();
    render();
}

function setupListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            STATE.currentView = btn.dataset.view;
            render();
        });
    });
}

function render() {
    const root = document.getElementById('view-root');
    const roleDisplay = document.getElementById('role-display');

    // 1. Update Constitutional Theme
    const themeMap = {
        'zen': 'zen',
        'bookkeeper': 'pro',
        'accountant': 'pro',
        'cfo': 'cfo',
        'auditor': 'auditor'
    };
    document.body.setAttribute('data-theme', themeMap[STATE.currentView]);
    roleDisplay.innerText = STATE.currentView.toUpperCase();

    // 2. Active Nav State
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === STATE.currentView);
    });

    // 3. Render Module
    switch (STATE.currentView) {
        case 'zen': renderZen(root); break;
        case 'bookkeeper': renderBookkeeper(root); break;
        case 'accountant': renderAccountant(root); break;
        case 'cfo': renderCFO(root); break;
        case 'auditor': renderAuditor(root); break;
    }
}

/** --- ZEN MODE: MONEY FLOW --- */
function renderZen(container) {
    container.innerHTML = `
        <div class="os-fade-in">
            <header style="margin-bottom: var(--space-8);">
                <h1 style="font-family: var(--font-heading); font-size: 2rem; font-weight: 800; margin-bottom: var(--space-2);">Your Money Flow</h1>
                <p style="color: var(--text-secondary);">RoboLedger is maintaining your truth level at 100%.</p>
            </header>

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-5); margin-bottom: var(--space-8);">
                <div style="background: white; padding: var(--space-6); border-radius: var(--radius-soft); box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: var(--space-2);">Money In</div>
                    <div style="font-size: 2.5rem; font-weight: 800; color: var(--accent-emerald);">$14,250.00</div>
                    <div class="truth-badge locked" style="margin-top: var(--space-3);">CERTIFIED TRUTH</div>
                </div>
                <div style="background: white; padding: var(--space-6); border-radius: var(--radius-soft); box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: var(--space-2);">Money Out</div>
                    <div style="font-size: 2.5rem; font-weight: 800;">$8,412.00</div>
                    <div class="truth-badge predicted" style="margin-top: var(--space-3);">3 PREDICTED</div>
                </div>
            </div>

            <section>
                <h3 style="font-size: 1rem; margin-bottom: var(--space-4);">Timeline</h3>
                <div style="display: flex; flex-direction: column; gap: var(--space-3);">
                    <div class="zen-card">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: 700;">Starbucks</div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">Today • Dining</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: 700;">-$12.50</div>
                                <div class="truth-badge raw">RAW SENSING</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>

        <style>
            .zen-card {
                background: white;
                padding: var(--space-4);
                border-radius: var(--radius-soft);
                border: 1px solid var(--border-color);
                transition: transform 0.2s ease;
                cursor: pointer;
            }
            .zen-card:hover { transform: scale(1.01); border-color: var(--accent-indigo); }
        </style>
    `;
}

/** --- BOOKKEEPER: PREPARATION --- */
function renderBookkeeper(container) {
    container.innerHTML = `
        <div class="os-fade-in">
            <header style="margin-bottom: var(--space-6); display: flex; justify-content: space-between; align-items: flex-end;">
                <div>
                    <h1 style="font-size: 1.5rem; font-weight: 700;">Preparation Desk</h1>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">Hardening raw sensor data into immutable ledger state.</p>
                </div>
                <div class="truth-badge predicted">92% Preparation Certainty</div>
            </header>

            <table class="data-grid">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Source Descriptor</th>
                        <th>Brain Prediction</th>
                        <th class="amount">Amount</th>
                        <th style="text-align: center;">Certainty</th>
                        <th style="text-align: right;">Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${MOCK_TRANSACTIONS.map(tx => `
                        <tr class="tx-row" onclick="openAuditDrawer('${tx.id}')">
                            <td style="font-family: var(--font-mono); color: var(--text-muted);">${tx.date}</td>
                            <td style="font-weight: 600;">${tx.desc}</td>
                            <td><span class="truth-badge ${tx.status.toLowerCase()}">${tx.brain_prediction}</span></td>
                            <td class="amount">${tx.amount}</td>
                            <td>
                                <div style="width: 80px; height: 4px; background: rgba(0,0,0,0.05); border-radius: 2px; margin: 0 auto;">
                                    <div style="width: ${tx.confidence * 100}%; height: 100%; background: var(--accent-emerald);"></div>
                                </div>
                            </td>
                            <td style="text-align: right;"><button class="os-btn" onclick="event.stopPropagation();">Confirm</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <style>
            .tx-row { cursor: pointer; transition: background 0.1s; }
            .tx-row:hover { background: rgba(0,0,0,0.015); }
            .os-btn {
                background: var(--text-primary);
                color: var(--bg-base);
                border: none;
                padding: 4px 12px;
                border-radius: var(--radius-sharp);
                font-size: 0.75rem;
                font-weight: 600;
                cursor: pointer;
            }
        </style>
    `;
}

/** --- ACCOUNTANT: GOVERNANCE --- */
function renderAccountant(container) {
    container.innerHTML = `
        <div class="os-fade-in">
            <header style="margin-bottom: var(--space-8);">
                <h1 style="font-size: 1.5rem; font-weight: 700;">Governance Console</h1>
                <p style="color: var(--text-secondary);">Operational finality and period lockdown仪式.</p>
            </header>

            <div style="display: grid; grid-template-columns: 1fr 300px; gap: var(--space-6);">
                <div class="ledger-box">
                    <h3 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: var(--space-4);">Live Trial Balance (LOCKED VERSION 1)</h3>
                    <table class="data-grid">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Account Name</th>
                                <th class="amount">Debit</th>
                                <th class="amount">Credit</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="font-family: var(--font-mono);">1010</td>
                                <td>Operating Account</td>
                                <td class="amount">$12,450.00</td>
                                <td class="amount">$0.00</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="action-sidebar">
                    <div style="background: white; border: 1px solid var(--border-color); padding: var(--space-5); border-radius: var(--radius-sharp);">
                        <div style="text-align: center; margin-bottom: var(--space-6);">
                            <div style="font-size: 2rem; margin-bottom: var(--space-2);">🛡️</div>
                            <h4 style="font-weight: 800;">Period Lockdown</h4>
                            <p style="font-size: 0.75rem; color: var(--text-muted);">Establish immutable certification for Jan 2025.</p>
                        </div>
                        <button class="os-btn-large" onclick="triggerCeremony()">Perform Certification</button>
                    </div>
                </div>
            </div>
        </div>

        <style>
            .ledger-box { background: white; border: 1px solid var(--border-color); border-radius: var(--radius-sharp); padding: var(--space-4); }
            .os-btn-large {
                width: 100%;
                background: var(--accent-rose);
                color: white;
                border: none;
                padding: 12px;
                border-radius: var(--radius-sharp);
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(244, 63, 94, 0.2);
            }
        </style>
    `;
}

/** --- CFO: INTELLIGENCE --- */
function renderCFO(container) {
    container.innerHTML = `
        <div class="os-fade-in">
            <header style="margin-bottom: var(--space-8);">
                <h1 style="font-size: 2rem; font-weight: 800;">Certified Intelligence</h1>
                <p style="color: var(--text-secondary);">Board-ready metrics derived from certified truth.</p>
            </header>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-5); margin-bottom: var(--space-8);">
                <div class="metric-card">
                    <div class="card-label">Runway</div>
                    <div class="card-value">5.2 Mo</div>
                    <div class="truth-badge certified">CERTIFIED</div>
                </div>
                <div class="metric-card projection">
                    <div class="card-label">Hypothetical runway</div>
                    <div class="card-value">8.4 Mo</div>
                    <div class="truth-badge predicted">PROJECTION v1</div>
                </div>
            </div>

            <div style="background: rgba(255,255,255,0.03); border: 1px dashed var(--accent-indigo); padding: var(--space-6); border-radius: var(--radius-sharp);">
                <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--accent-indigo); margin-bottom: var(--space-4);">Simulation Sandbox</h4>
                <!-- Charts/Sliders here -->
                <p style="color: var(--text-muted); font-size: 0.85rem;">Adjusting baseline revenue assumptions by +15%.</p>
            </div>
        </div>

        <style>
            .metric-card {
                background: white;
                border: 1px solid var(--border-color);
                padding: var(--space-6);
                border-radius: var(--radius-sharp);
            }
            [data-theme="cfo"] .metric-card { background: rgba(255,255,255,0.03); }
            .metric-card.projection {
                border-style: dashed;
                border-color: var(--accent-indigo);
            }
            .card-label { font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: var(--space-2); }
            .card-value { font-size: 2.2rem; font-weight: 700; font-family: var(--font-heading); }
        </style>
    `;
}

/** --- AUDITOR: RAW NEUTRALITY --- */
function renderAuditor(container) {
    container.innerHTML = `
        <div class="os-fade-in" style="font-family: var(--font-mono);">
            <header style="margin-bottom: var(--space-8); border-bottom: 2px solid #000; padding-bottom: var(--space-4);">
                <h1 style="font-size: 1.2rem; font-weight: 800; letter-spacing: -0.05em;">AUDIT_LOG::ROBOLEDGER::SYSTEM_STATE</h1>
                <div style="font-size: 0.7rem; margin-top: 4px;">TIMESTAMP: ${new Date().toISOString()} | INTEGRITY_CHECK: PASS</div>
            </header>

            <section style="margin-bottom: var(--space-8);">
                <h2 style="font-size: 0.8rem; text-transform: uppercase; margin-bottom: var(--space-4);">Immutable Transaction Chain</h2>
                <table class="data-grid" style="font-size: 0.75rem;">
                    <thead>
                        <tr>
                            <th>UUID</th>
                            <th>TXSIG_HASH</th>
                            <th>VAL_CENTS</th>
                            <th>STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${MOCK_TRANSACTIONS.map(tx => `
                            <tr>
                                <td>${tx.id}</td>
                                <td style="opacity: 0.5;">${tx.txsig.substring(0, 32)}...</td>
                                <td class="amount" style="font-weight: 800;">${tx.amount}</td>
                                <td><span class="truth-badge">${tx.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </section>
        </div>
    `;
}

window.openAuditDrawer = (txId) => {
    const tx = MOCK_TRANSACTIONS.find(t => t.id === txId);
    if (!tx) return;

    const drawer = document.getElementById('audit-drawer');
    const content = document.getElementById('audit-content');

    drawer.style.display = 'flex';
    content.innerHTML = `
        <div class="os-fade-in" style="height: 100%; display: flex; flex-direction: column;">
            <header style="margin-bottom: var(--space-6);">
                <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: var(--space-1);">Forensic Evidence</div>
                <h2 style="font-family: var(--font-heading);">${tx.desc}</h2>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: var(--space-1);">Transaction ID: ${tx.id}</div>
            </header>

            <div style="flex: 1; overflow-y: auto; background: var(--bg-base); border: 1px solid var(--border-color); padding: var(--space-5); font-family: var(--font-mono); font-size: 0.75rem;">
                <div style="margin-bottom: var(--space-4);">
                    <div style="color: var(--text-muted); margin-bottom: var(--space-1);">Source Document</div>
                    <div style="color: var(--accent-indigo); font-weight: 700;">${tx.source.doc}</div>
                    <div style="font-size: 0.65rem;">Locator: Page ${tx.source.page}, ${tx.source.coords}</div>
                </div>

                <div style="margin-bottom: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--border-color);">
                    <div style="color: var(--text-muted); margin-bottom: var(--space-1);">Brain Reasoning (Certainty: ${tx.confidence * 100}%)</div>
                    <div style="color: var(--text-primary);">${tx.brain_prediction}</div>
                    <div style="margin-top: var(--space-2); color: var(--text-muted);">Matches merchant history signatures on 4 previous instances.</div>
                </div>

                <div style="margin-top: auto; padding-top: var(--space-6);">
                    <div style="font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: var(--space-2);">Cryptographic Fingerprint (txsig)</div>
                    <div style="word-break: break-all; opacity: 0.6; line-height: 1.4;">${tx.txsig}</div>
                </div>
            </div>

            <footer style="margin-top: var(--space-6); display: flex; gap: var(--space-3);">
                <button class="os-btn" style="flex: 1;" onclick="closeAuditDrawer()">Close</button>
                <button class="os-btn" style="flex: 1; border: 1px solid var(--border-color); background: transparent; color: var(--text-primary);">View Raw PDF</button>
            </footer>
        </div>
    `;
};

window.closeAuditDrawer = () => {
    document.getElementById('audit-drawer').style.display = 'none';
};

window.triggerCeremony = () => {
    const overlay = document.getElementById('audit-drawer');
    overlay.style.display = 'flex';
    document.body.classList.add('seal-animating');

    overlay.innerHTML = `
        <div class="ceremony-card os-fade-in">
            <div class="seal-imprint">⚖️</div>
            <h2 style="font-family: var(--font-heading); font-size: 1.8rem; font-weight: 800; margin-bottom: var(--space-2);">Commit Architectural Truth</h2>
            <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: var(--space-8); line-height: 1.6;">
                You are about to certify period **P_2024_Q4**. This generates an immutable ledger state and a matching Proof Certificate. **This action cannot be undone by any authority.**
            </p>
            <div style="display: flex; gap: var(--space-4);">
                <button class="os-btn" style="flex: 1; padding: 14px; border: 1px solid var(--border-color); background: transparent; color: var(--text-primary);" onclick="closeCeremony()">Abort</button>
                <button class="os-btn-large" style="flex: 2;" onclick="finalizeCertification()">Sign & Lockdown</button>
            </div>
        </div>
    `;
};

window.closeCeremony = () => {
    document.getElementById('audit-drawer').style.display = 'none';
    document.body.classList.remove('seal-animating');
};

window.finalizeCertification = () => {
    const card = document.querySelector('.ceremony-card');
    card.innerHTML = `
        <div class="seal-imprint" style="opacity: 1; transform: scale(1); animation: none;">📜</div>
        <h2 style="font-family: var(--font-heading); font-size: 1.8rem; font-weight: 800; margin-bottom: var(--space-2);">Truth Certified</h2>
        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: var(--space-4);">
            Certificate **CERT-772-ALPH** has been anchored to the ledger.
        </p>
        <div style="font-family: var(--font-mono); font-size: 0.65rem; background: var(--bg-base); border: 1px solid var(--border-color); padding: var(--space-3); border-radius: var(--radius-sharp); margin-bottom: var(--space-6);">
            HASH: 8f2a...f91b (Signature Valid)
        </div>
        <button class="os-btn" style="width: 100%; padding: 12px;" onclick="closeCeremony()">Return to Console</button>
    `;
};

// Start OS
init();
