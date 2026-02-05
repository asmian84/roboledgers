import { Capability } from './capabilities.ts';

/**
 * RoboLedgers: Role Definitions
 * Bundles of capabilities representing standardized personas.
 */

export const Role = {
    ZEN: 'ZEN',
    BOOKKEEPER: 'BOOKKEEPER',
    ACCOUNTANT: 'ACCOUNTANT',
    CFO: 'CFO',
    AUDITOR: 'AUDITOR'
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const RoleCapabilities: Record<Role, Set<Capability>> = {
    [Role.ZEN]: new Set([
        Capability.CAP_CONFIRM_CATEGORY,
        Capability.CAP_VIEW_AUDIT_LOG
    ]),

    [Role.BOOKKEEPER]: new Set([
        Capability.CAP_CONFIRM_CATEGORY,
        Capability.CAP_RECONCILE_ACCOUNT,
        Capability.CAP_VIEW_AUDIT_LOG
    ]),

    [Role.ACCOUNTANT]: new Set([
        Capability.CAP_CONFIRM_CATEGORY,
        Capability.CAP_RECONCILE_ACCOUNT,
        Capability.CAP_LOCK_PERIOD,
        Capability.CAP_POST_AJE,
        Capability.CAP_CERTIFY_REPORTS,
        Capability.CAP_VIEW_AUDIT_LOG
    ]),

    [Role.CFO]: new Set([
        Capability.CAP_CONFIRM_CATEGORY,
        Capability.CAP_RECONCILE_ACCOUNT,
        Capability.CAP_LOCK_PERIOD,
        Capability.CAP_POST_AJE,
        Capability.CAP_CERTIFY_REPORTS,
        Capability.CAP_VIEW_AUDIT_LOG,
        Capability.CAP_MULTI_ENTITY
    ]),

    [Role.AUDITOR]: new Set([
        Capability.CAP_VIEW_AUDIT_LOG
    ])
};
