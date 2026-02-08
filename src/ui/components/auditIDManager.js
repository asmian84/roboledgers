/**
 * Audit ID Generation System
 * Blockchain-style transaction signatures for verification tracking
 * Format: {Type}-{Account}-{Inst}-{Transit}-{DateYYYYMMDD}-{Seq}-{Hash}
 */

const AuditIDManager = (() => {
  function notify(type, message) {
    if (window.Toast && typeof window.Toast[type] === 'function') {
      window.Toast[type](message);
    } else {
      const prefix = type ? type.toUpperCase() : 'INFO';
      console.log(`[${prefix}] ${message}`);
    }
  }
  /**
   * Generate a deterministic hash from transaction data
   * Uses simple checksum for lightweight verification
   */
  function generateHash(txData) {
    let hash = 0;
    const str = JSON.stringify({
      ref: txData.ref,
      date: txData.date,
      amount: txData.amount_cents,
      desc: txData.description
    });

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase().slice(-6);
  }

  /**
   * Generate Audit ID for transaction
   * Reuses existing ID if already present
   */
  function generateAuditID(tx, account) {
    // If already has audit ID, return it
    if (tx.auditId) return tx.auditId;

    const accountType = account?.type?.substring(0, 2) || 'XX';
    const accountNum = account?.id?.substring(0, 2)?.toUpperCase() || 'XX';
    const inst = (account?.inst || '000').padStart(3, '0');
    const transit = (account?.transit || '00000').padStart(5, '0');

    // Date in YYYYMMDD format
    const txDate = new Date(tx.date || new Date());
    const dateStr = txDate.toISOString().slice(0, 10).replace(/-/g, '');

    // Sequence number (use ref# if available, otherwise transaction index)
    const seq = (tx.ref || tx.$index || 0).toString().padStart(4, '0');

    // Generate hash
    const hash = generateHash(tx);

    // Construct audit ID
    const auditId = `${accountType}-${accountNum}-${inst}-${transit}-${dateStr}-${seq}-${hash}`;

    // Store in transaction
    tx.auditId = auditId;

    return auditId;
  }

  /**
   * Generate audit IDs for all transactions in account
   */
  function generateBatchAuditIDs(account) {
    if (!window.RoboLedger?.Ledger) {
      notify('error', 'Ledger not initialized');
      return 0;
    }

    const allTx = window.RoboLedger.Ledger.getAll();
    const accountTx = account ? 
      allTx.filter(t => t.account_id === account.id) : 
      allTx;

    let generated = 0;
    accountTx.forEach(tx => {
      if (!tx.auditId) {
        generateAuditID(tx, account);
        generated++;
      }
    });

    if (generated > 0) {
      window.RoboLedger.Ledger.save();
      notify('success', `Generated ${generated} audit IDs`);
    }

    return generated;
  }

  /**
   * Verify audit ID integrity (simple check)
   */
  function verifyAuditID(tx, auditId) {
    const expected = generateAuditID(tx);
    return auditId === expected;
  }

  /**
   * Get or create audit ID
   */
  function getOrCreateAuditID(tx, account) {
    if (tx.auditId) return tx.auditId;
    return generateAuditID(tx, account);
  }

  /**
   * Create a verification badge for display
   */
  function createVerificationBadge(tx, verified = false) {
    const badge = document.createElement('div');
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      ${verified ? `
        background: #d1fae5;
        color: #065f46;
        border: 1px solid #6ee7b7;
      ` : `
        background: #fef3c7;
        color: #92400e;
        border: 1px solid #fcd34d;
      `}
    `;

    const icon = verified ? 'ph-check-circle' : 'ph-warning-circle';
    const text = verified ? 'VERIFIED' : 'PENDING';

    badge.innerHTML = `
      <i class="ph ${icon}" style="font-size: 12px;"></i>
      <span>${text}</span>
    `;

    return badge;
  }

  /**
   * Format audit ID for display (with proper spacing)
   */
  function formatAuditIDForDisplay(auditId) {
    // Format: XX-XX-000-00000-YYYYMMDD-0000-XXXXXX -> more readable
    if (!auditId) return 'N/A';
    const parts = auditId.split('-');
    if (parts.length >= 7) {
      return `${parts.slice(0, 3).join('-')}-${parts[3]}-${parts[4]}-${parts[5]}-${parts[6]}`;
    }
    return auditId;
  }

  return {
    generateAuditID,
    generateBatchAuditIDs,
    verifyAuditID,
    getOrCreateAuditID,
    createVerificationBadge,
    formatAuditIDForDisplay,
    generateHash
  };
})();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuditIDManager;
}
window.AuditIDManager = AuditIDManager;
