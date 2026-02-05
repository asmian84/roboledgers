/**
 * Column Builder
 * Dynamically builds Tabulator column config from registry + active state
 */

import { COLUMN_REGISTRY } from "./columnRegistry.js";
import { getActiveColumns } from "./columnState.js";

export function buildTabulatorColumns() {
  const active = getActiveColumns();

  const columns = active.map(key => {
    const meta = COLUMN_REGISTRY[key];
    
    if (!meta) {
      console.warn(`[Column Builder] Unknown column key: ${key}`);
      return null;
    }

    return {
      title: meta.label,
      field: meta.field,
      sorter: meta.sorter || "string",
      headerSort: true,
      hozAlign: meta.hozAlign || "left",
      widthGrow: meta.flex
    };
  }).filter(Boolean);

  normalizeWidths(columns);
  return columns;
}

function normalizeWidths(columns) {
  const total = columns.reduce((sum, col) => sum + col.widthGrow, 0);
  columns.forEach(col => {
    col.widthGrow = (col.widthGrow / total) * 100;
  });
}
