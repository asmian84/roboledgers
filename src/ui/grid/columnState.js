/**
 * Column State Manager
 * Persists which columns are visible to localStorage
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
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
}

export function setActiveColumns(cols) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cols));
}

export function resetColumns() {
  localStorage.removeItem(STORAGE_KEY);
  return DEFAULT_COLUMNS;
}
