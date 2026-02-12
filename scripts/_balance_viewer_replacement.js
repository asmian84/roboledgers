// Minimal vanilla JS function to show balance source using DocumentViewer
window.showStatementSource = function (type) {
    const accountId = window.UI_STATE.selectedAccount;
    if (!accountId || accountId === 'ALL') {
        alert('Please select an account first');
        return;
    }

    const recon = window.RoboLedger.reconciliation[accountId];
    if (!recon || !recon.pdf_url) {
        alert('No statement PDF available for this account');
        return;
    }

    const accounts = window.RoboLedger.Accounts.getAll();
    const acc = accounts.find(a => a.id === accountId);

    // Determine page: first for opening, last for ending
    const page = type === 'opening' ? 1 : (recon.total_pages || 1);
    const balanceType = type === 'opening' ? 'Opening' : 'Ending';

    console.log(`[BALANCE VIEW] Opening ${balanceType} balance - Page ${page}`);

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'balance-viewer-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1001;';
    overlay.onclick = () => window.closeBalanceViewer();

    // Create panel
    const panel = document.createElement('div');
    panel.id = 'balance-viewer-panel';
    panel.style.cssText = 'position:fixed;top:0;left:0;width:70%;max-width:900px;height:100vh;background:white;box-shadow:4px 0 12px rgba(0,0,0,0.1);z-index:1002;display:flex;flex-direction:column;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding:16px 20px;background:#1e293b;color:white;display:flex;justify-content:space-between;align-items:center;';
    header.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <i class="ph ph-file-pdf" style="font-size:20px;"></i>
      <span style="font-size:14px;font-weight:600;">${acc?.ref || accountId} - ${balanceType} Balance</span>
    </div>
    <button onclick="window.closeBalanceViewer()" style="border:none;background:rgba(255,255,255,0.1);color:white;width:32px;height:32px;border-radius:6px;cursor:pointer;font-size:20px;">×</button>
  `;

    // PDF container
    const pdfContainer = document.createElement('div');
    pdfContainer.id = 'balance-pdf-container';
    pdfContainer.style.cssText = 'flex:1;overflow:auto;background:#f1f5f9;padding:20px;';

    panel.appendChild(header);
    panel.appendChild(pdfContainer);
    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    // Mount React DocumentViewer
    if (window.mountDocumentViewer) {
        window.mountDocumentViewer('balance-pdf-container', {
            type: 'pdf',
            url: recon.pdf_url,
            name: `${balanceType} Balance`,
            page: page
        });
    }
};

// Close balance viewer
window.closeBalanceViewer = function () {
    const overlay = document.getElementById('balance-viewer-overlay');
    const panel = document.getElementById('balance-viewer-panel');
    if (overlay) overlay.remove();
    if (panel) panel.remove();
    if (window.unmountDocumentViewer) {
        window.unmountDocumentViewer('balance-pdf-container');
    }
};
