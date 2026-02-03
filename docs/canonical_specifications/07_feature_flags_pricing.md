# RoboLedgers: Feature Flags & Pricing Enforcement Specification

**Version:** 1.0.0  
**Status:** LOCKED  
**Authority:** Principal Platform Architect

This specification defines the deterministic enforcement of tier-based capabilities and feature availability within the RoboLedgers platform. Enforcement SHALL be applied at the capability level to ensure structural integrity across all layers.

---

## SECTION 1 — Capability Registry

The following Canonical Capabilities SHALL be the atomic units of permission and access control.

| Capability ID | Description |
| :--- | :--- |
| **CAN_IMPORT_DATA** | Ability to ingest raw statement data via API or file. |
| **CAN_AUTO_CATEGORIZE** | Permission for the Brain to apply PREDICTED states. |
| **CAN_VIEW_RECON** | Access to reconciliation proof math and summary views. |
| **CAN_MATCH_TRANSFERS** | Ability to manually or automatically link internal transfers. |
| **CAN_LOCK_PERIOD** | Authority to perform formal monthly period closure. |
| **CAN_POST_AJE** | Access to create and post Adjusting Journal Entries. |
| **CAN_VIEW_RATIOS** | Access to liquidity, leverage, and CFO-level metrics. |
| **CAN_VIEW_FORECAST** | Access to deterministic cash flow forecasting models. |
| **CAN_CERTIFY_REPORTS** | Ability to generate Tier 1 Certified financial packages. |
| **CAN_MANAGE_COA** | Authority to modify COA Intelligence Layer metadata. |
| **CAN_ACCESS_AUDIT** | Permission to view nanosecond audit logs and history versions. |

---

## SECTION 2 — Tier Mapping

Tiers define the collection of capabilities assigned to a specific subscription level.

| Tier | Included Capabilities |
| :--- | :--- |
| **Free (Zen)** | CAN_IMPORT_DATA, CAN_AUTO_CATEGORIZE, CAN_VIEW_RECON. |
| **Plus** | *Free* + CAN_MATCH_TRANSFERS, CAN_VIEW_RATIOS. |
| **Pro** | *Plus* + CAN_VIEW_FORECAST, CAN_CERTIFY_REPORTS. |
| **Accountant** | *All Pro* + CAN_LOCK_PERIOD, CAN_POST_AJE, CAN_MANAGE_COA. |
| **Enterprise** | *All Accountant* + CAN_ACCESS_AUDIT, Multisig Sign-off. |

---

## SECTION 3 — Enforcement Points

Capability enforcement SHALL be applied at every layer of the architecture to prevent "Authority Leakage."

1.  **API Layer**: Every request MUST be checked against the user's Tier ↔ Capability map. Unauthorized requests SHALL return `403 FORBIDDEN`.
2.  **Brain Layer**: If `CAN_AUTO_CATEGORIZE` is absent, the logic SHALL remain in a manual-only state regardless of prediction confidence.
3.  **Reconciliation Layer**: The proof engine SHALL calculate but NOT display or store persistent Proof Objects if `CAN_VIEW_RECON` is absent.
4.  **Authority Layer**: Transitioning a period to `LOCKED` MUST be blocked if the active user lacks `CAN_LOCK_PERIOD`.
5.  **UI Layer**: Forbidden features SHALL be visually removed or presented as "Upgrade Required" triggers. The UI SHALL NEVER expose raw data for forbidden capabilities.

---

## SECTION 4 — Abuse & Escalation Rules

### 4.1 Forbidden Action Handling
When a user attempts a forbidden action (e.g., an API call to post an AJE without the capability):
-   The request SHALL be REJECTED immediately.
-   The event SHALL be logged to the `Governance_Alerts` table.
-   The user SHALL receive an `ENFORCEMENT_ACTION_REQUIRED` UI prompt.

### 4.2 Logging & Audit
Every capability check failure SHALL register:
-   `User_ID` / `Actor_ID`
-   `Capability_Attempted`
-   `Timestamp`
-   `Request_Fingerprint`

---

## VERIFICATION SECTION

-   **Capability-Based**: Enforcement is mapped to system capabilities, not UI flags (Confirmed).
-   **No Authority Leaks**: API and Logic layers enforce checks independently of the UI (Confirmed).
-   **Open Questions**: NONE.

**END OF SPECIFICATION**
