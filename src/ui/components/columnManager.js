/**
 * Column Manager Modal
 * UI for toggling optional columns on/off
 */

import { COLUMN_REGISTRY } from "../grid/columnRegistry.js";
import { getActiveColumns, setActiveColumns } from "../grid/columnState.js";
import { buildTabulatorColumns } from "../grid/buildColumns.js";

export function openColumnManager() {
  const active = new Set(getActiveColumns());

  const html = Object.entries(COLUMN_REGISTRY)
    .map(([key, col]) => {
      if (col.required) return ""; // Skip required columns
      const checked = active.has(key) ? "checked" : "";
      return `
        <label style="display: block; padding: 8px 0; cursor: pointer;">
          <input type="checkbox" data-col="${key}" ${checked} style="margin-right: 8px;"/>
          <span style="font-weight: 500;">${col.label}</span>
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
      <h2 style="margin: 0 0 24px 0; font-size: 20px; font-weight: 700; color: #1e293b;">
        Customize Columns
      </h2>
      <div style="max-height: 300px; overflow-y: auto; margin-bottom: 24px;">
        ${html}
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
    const selected = [
      ...Object.keys(COLUMN_REGISTRY).filter(k => COLUMN_REGISTRY[k].required),
      ...Array.from(modal.querySelectorAll("input:checked")).map(i => i.dataset.col)
    ];

    setActiveColumns(selected);
    window.txnTable.setColumns(buildTabulatorColumns());
    modal.remove();
    console.log("[Column Manager] Applied columns:", selected);
  };

  // Close on backdrop click
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
}

// Export functions
export function exportCSV() {
  if (!window.txnTable) return;
  window.txnTable.download("csv", "roboledger-transactions.csv");
}

export function exportXLSX() {
  if (!window.txnTable) return;
  window.txnTable.download("xlsx", "roboledger-transactions.xlsx", {
    sheetName: "RoboLedger"
  });
}

export function exportPDF() {
  if (!window.txnTable) return;
  window.txnTable.download("pdf", "roboledger-transactions.pdf", {
    orientation: "landscape"
  });
}
