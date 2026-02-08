/**
 * Column Manager Modal
 * UI for toggling optional columns on/off
 * Works directly with Tabulator's column show/hide methods
 */

// --- Column Manager System ---

function openColumnManager() {
  if (!window.txnTable) {
    console.error("[Column Manager] Grid not initialized");
    return;
  }

  // Get all columns from the grid
  const allColumns = window.txnTable.getColumns();
  const requiredFields = new Set(["ref", "date", "description", "debit_col", "credit_col", "balance"]);

  // Build checkbox list
  const html = allColumns
    .filter(col => col.getField() && !requiredFields.has(col.getField()))
    .map(col => {
      const field = col.getField();
      const title = col.getDefinition().title;
      const checked = col.isVisible() ? "checked" : "";
      return `
        <label style="display: block; padding: 8px 0; cursor: pointer;">
          <input type="checkbox" data-field="${field}" ${checked} style="margin-right: 8px;"/>
          <span style="font-weight: 500;">${title}</span>
        </label>
      `;
    })
    .join("");

  const modal = document.createElement("div");
  modal.className = "column-manager-modal";
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  modal.innerHTML = `
    <div class="modal-content" style="
      background: white;
      padding: 32px;
      border-radius: 12px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    ">
      <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #1e293b;">
        Customize Columns
      </h2>
      <p style="margin: 0 0 24px 0; font-size: 13px; color: #64748b;">
        Toggle optional columns on or off. Core columns (Ref, Date, Description, Debit, Credit, Balance) are always visible.
      </p>
      <div style="max-height: 300px; overflow-y: auto; margin-bottom: 24px;">
        ${html || '<p style="color: #94a3b8; font-style: italic;">No optional columns available</p>'}
      </div>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="cancelCols" style="
          padding: 8px 16px;
          border: 1px solid #cbd5e1;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        ">Cancel</button>
        <button id="saveCols" style="
          padding: 8px 16px;
          border: none;
          background: #3b82f6;
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        ">Apply</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Cancel button
  document.getElementById("cancelCols").onclick = () => {
    modal.remove();
  };

  // Save button
  document.getElementById("saveCols").onclick = () => {
    const checkboxes = modal.querySelectorAll("input[type=checkbox]");
    const visibleFields = Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.dataset.field);

    // Show/hide columns based on checkboxes
    allColumns.forEach(col => {
      const field = col.getField();
      if (!field || requiredFields.has(field)) return; // Skip required columns

      if (visibleFields.includes(field)) {
        col.show();
      } else {
        col.hide();
      }
    });

    // Persist to localStorage
    try {
      const hiddenFields = Array.from(checkboxes)
        .filter(cb => !cb.checked)
        .map(cb => cb.dataset.field);
      localStorage.setItem("rl_hidden_columns", JSON.stringify(hiddenFields));
    } catch (e) {
      console.error("[Column Manager] Failed to save preferences", e);
    }

    modal.remove();
    console.log("[Column Manager] Applied column visibility");
  };

  // Close on backdrop click
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
}

// Export functions
function exportCSV() {
  if (!window.txnTable) return;
  window.txnTable.download("csv", "roboledger-transactions.csv");
}

function exportXLSX() {
  if (!window.txnTable) return;
  window.txnTable.download("xlsx", "roboledger-transactions.xlsx", {
    sheetName: "RoboLedger"
  });
}

function exportPDF() {
  if (!window.txnTable) return;
  window.txnTable.download("pdf", "roboledger-transactions.pdf", {
    orientation: "landscape"
  });
}
