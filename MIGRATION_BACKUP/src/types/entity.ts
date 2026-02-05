/**
 * RoboLedgers: Entity System Types
 */

export const EntityType = {
    INDIVIDUAL: 'INDIVIDUAL',
    CORPORATION: 'CORPORATION',
    TRUST: 'TRUST',
    HOLDCO: 'HOLDCO',
    OPCO: 'OPCO'
} as const;

export type EntityType = (typeof EntityType)[keyof typeof EntityType];

export interface Entity {
    readonly id: string;           // UUID
    readonly legal_name: string;
    readonly type: EntityType;
    readonly registration_number?: string;
    readonly tax_id?: string;
    readonly currency: string;     // Default functional currency
    readonly parent_id?: string;   // For consolidation hierarchy
}

export interface EntityHierarchy {
    readonly entity_id: string;
    readonly children: EntityHierarchy[];
}
