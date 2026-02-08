/**
 * Receipt Upload System
 * Handles file upload, base64 encoding, and receipt storage
 * Integrates with transaction metadata
 */

const ReceiptManager = (() => {
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  function notify(type, message) {
    if (window.Toast && typeof window.Toast[type] === 'function') {
      window.Toast[type](message);
    } else {
      const prefix = type ? type.toUpperCase() : 'INFO';
      console.log(`[${prefix}] ${message}`);
    }
  }

  function validateFile(file) {
    if (!file) return { valid: false, error: 'No file selected' };
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` };
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: 'Only JPG, PNG, WebP, and PDF accepted' };
    }
    return { valid: true };
  }

  function encodeToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadReceipt(txId, file) {
    const validation = validateFile(file);
    if (!validation.valid) {
      notify('error', validation.error);
      return null;
    }

    try {
      notify('info', 'Uploading receipt...');
      const base64 = await encodeToBase64(file);

      // Store with transaction
      const tx = window.RoboLedger?.Ledger?.get?.(txId);
      if (tx) {
        if (!tx.attachments) tx.attachments = {};
        tx.attachments.receipt = {
          data: base64,
          type: file.type,
          name: file.name,
          uploadedAt: new Date().toISOString(),
          size: file.size
        };
        
        // Save to ledger
        window.RoboLedger.Ledger.save();
        notify('success', 'Receipt uploaded');
        return tx.attachments.receipt;
      }
    } catch (error) {
      notify('error', `Upload failed: ${error.message}`);
      return null;
    }
  }

  function getReceiptData(txId) {
    const tx = window.RoboLedger?.Ledger?.get?.(txId);
    return tx?.attachments?.receipt || null;
  }

  function deleteReceipt(txId) {
    const tx = window.RoboLedger?.Ledger?.get?.(txId);
    if (tx && tx.attachments) {
      delete tx.attachments.receipt;
      window.RoboLedger.Ledger.save();
      notify('info', 'Receipt removed');
      return true;
    }
    return false;
  }

  function createDropzone(onFile) {
    const dropzone = document.createElement('div');
    dropzone.className = 'v5-receipt-dropzone';
    dropzone.style.cssText = `
      border: 2px dashed #94a3b8;
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      background: rgba(148, 163, 184, 0.05);
      user-select: none;
    `;

    dropzone.innerHTML = `
      <i class="ph ph-file-image" style="font-size: 32px; color: #94a3b8; display: block; margin-bottom: 12px;"></i>
      <div style="color: #64748b; font-size: 13px; font-weight: 600;">
        Drop receipt here or click to upload
      </div>
      <div style="color: #94a3b8; font-size: 11px; margin-top: 6px;">
        JPG, PNG, WebP, or PDF (max 5MB)
      </div>
      <input type="file" style="display: none;" accept="image/*,.pdf" />
    `;

    // Hover effects
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#3b82f6';
      dropzone.style.background = 'rgba(59, 130, 246, 0.1)';
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = '#94a3b8';
      dropzone.style.background = 'rgba(148, 163, 184, 0.05)';
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#94a3b8';
      dropzone.style.background = 'rgba(148, 163, 184, 0.05)';
      
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file, onFile);
    });

    // Click to upload
    dropzone.addEventListener('click', () => {
      dropzone.querySelector('input').click();
    });

    dropzone.querySelector('input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleFileSelect(file, onFile);
    });

    return dropzone;
  }

  function handleFileSelect(file, onFile) {
    const validation = validateFile(file);
    if (!validation.valid) {
      notify('error', validation.error);
      return;
    }
    if (typeof onFile === 'function') {
      onFile(file);
    }
  }

  function displayReceipt(base64Data, type) {
    const container = document.createElement('div');
    container.style.cssText = `
      background: #f8fafc;
      border-radius: 8px;
      overflow: hidden;
      max-height: 300px;
    `;

    if (type.includes('pdf')) {
      container.innerHTML = `
        <div style="padding: 12px; background: #e2e8f0; text-align: center; font-size: 12px; color: #64748b;">
          <i class="ph ph-file-pdf" style="margin-right: 6px;"></i>
          PDF Attached
        </div>
      `;
    } else {
      container.innerHTML = `
        <img src="${base64Data}" style="width: 100%; height: auto; display: block;" />
      `;
    }

    return container;
  }

  return {
    uploadReceipt,
    getReceiptData,
    deleteReceipt,
    createDropzone,
    validateFile,
    encodeToBase64,
    displayReceipt
  };
})();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReceiptManager;
}
window.ReceiptManager = ReceiptManager;
