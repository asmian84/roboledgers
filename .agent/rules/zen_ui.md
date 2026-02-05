# Zen Mode Non-Negotiable Laws (UI Contract Enforcement)

## 1. Zen Mode is Read-Mostly
- **Allowed**: View transactions, View aggregates, Rename merchants (cosmetic), Confirm categories (only if suggested).
- **Forbidden**: Account codes, Debits/Credits, Balances by account, Period locks, AJEs, Reconciliation actions.
- **Rule**: If Zen can cause accounting truth to change directly -> **VIOLATION**.

## 2. Mandatory Truth Badges
- Every monetary value displayed MUST carry a truth badge: `RAW`, `PREDICTED`, `RECONCILED`, `LOCKED`, `ADJUSTED`, `CERTIFIED`.
- If a number has no badge -> **UI BUG**.

## 3. Projection Only
- Zen UI must only consume the `projection_service.ts`.
- **Forbidden**: Querying ledger directly, Calling categorization logic, Inferring balances, Recomputing totals.

## 4. Psychological Safety (Aesthetics)
- **Palette**: Low saturation, high lightness (Sage, Slate, Ocean).
- **Typography**: Sentence case only, no jargon, no ALL CAPS.
- **Motion**: Slow easing, no urgency.
- **Goal**: Informed, not responsible.
