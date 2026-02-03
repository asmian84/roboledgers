import type { Entity, EntityHierarchy } from '../types/entity.ts';
import { InvariantViolationError } from './errors.ts';

/**
 * RoboLedgers: Entity Service
 * Registry for all legal entities and their hierarchies.
 */
export class EntityService {
    private static entities: Map<string, Entity> = new Map();

    static register(entity: Entity): void {
        if (this.entities.has(entity.id)) {
            throw new InvariantViolationError('ENTITY_ALREADY_EXISTS', `Entity ${entity.id} is already registered.`);
        }
        this.entities.set(entity.id, entity);
        console.log(`[ENTITY] REGISTERED: ${entity.legal_name} (${entity.id})`);
    }

    static get(entityId: string): Entity {
        const e = this.entities.get(entityId);
        if (!e) {
            throw new InvariantViolationError('ENTITY_NOT_FOUND', `Entity ${entityId} not found.`);
        }
        return e;
    }

    static getAll(): Entity[] {
        return Array.from(this.entities.values());
    }

    static clear(): void {
        this.entities.clear();
    }
}
