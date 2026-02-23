/**
 * Column State Manager
 * Persists which columns are visible (IndexedDB via StorageService, localStorage fallback)
 */

const STORAGE_KEY = "rl_active_columns";

const DEFAULT_COLUMNS = [
  "ref",
  "date",
  "description",
  "debit",
  "credit",
  "balance"
];

export function getActiveColumns() {
  const _SS = window.StorageService;
  const saved = _SS ? _SS.get(STORAGE_KEY) : localStorage.getItem(STORAGE_KEY);
  if (!saved) return DEFAULT_COLUMNS;
  return (typeof saved === 'string') ? JSON.parse(saved) : saved;
}

export function setActiveColumns(cols) {
  const _SS = window.StorageService;
  if (_SS) { _SS.set(STORAGE_KEY, cols); }
  else { localStorage.setItem(STORAGE_KEY, JSON.stringify(cols)); }
}

export function resetColumns() {
  const _SS = window.StorageService;
  if (_SS) _SS.remove(STORAGE_KEY); else localStorage.removeItem(STORAGE_KEY);
  return DEFAULT_COLUMNS;
}
