/**
 * RoboLedgers: Capability Registry
 * Defines atomic powers within the system.
 */

export const Capability = {
    CAP_CONFIRM_CATEGORY: 'CAP_CONFIRM_CATEGORY',
    CAP_RECONCILE_ACCOUNT: 'CAP_RECONCILE_ACCOUNT',
    CAP_LOCK_PERIOD: 'CAP_LOCK_PERIOD',
    CAP_POST_AJE: 'CAP_POST_AJE',
    CAP_CERTIFY_REPORTS: 'CAP_CERTIFY_REPORTS',
    CAP_VIEW_AUDIT_LOG: 'CAP_VIEW_AUDIT_LOG',
    CAP_MULTI_ENTITY: 'CAP_MULTI_ENTITY'
} as const;

export type Capability = (typeof Capability)[keyof typeof Capability];
