/**
 * CategoryService - Manages transaction categories with hierarchical structure
 * 
 * Features:
 * - CRUD operations for categories
 * - Hierarchical parent/child relationships
 * - Path calculation (e.g., "Business Expenses > Software")
 * - Color and icon support
 * - localStorage persistence
 */

import { DEFAULT_CATEGORIES } from '../constants/defaultCategories.js';

class CategoryService {
    constructor() {
        this.STORAGE_KEY = 'roboledger_categories';
        this.categories = this.loadCategories();
    }

    /**
     * Load categories from storage or initialize with defaults
     */
    loadCategories() {
        try {
            const _SS = window.StorageService;
            const stored = _SS ? _SS.get(this.STORAGE_KEY) : localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                return (typeof stored === 'string') ? JSON.parse(stored) : stored;
            }
        } catch (e) {
            console.error('[CATEGORY] Failed to load categories:', e);
        }

        // Initialize with defaults
        return this.initializeDefaults();
    }

    /**
     * Initialize default category structure
     */
    initializeDefaults() {
        const categories = [];
        let idCounter = 1;

        DEFAULT_CATEGORIES.forEach(parent => {
            const parentId = `cat_${String(idCounter++).padStart(3, '0')}`;

            categories.push({
                id: parentId,
                name: parent.name,
                parent_id: null,
                color: parent.color || '#94a3b8',
                icon: parent.icon || 'folder',
                depth: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

            if (parent.children) {
                parent.children.forEach(child => {
                    categories.push({
                        id: `cat_${String(idCounter++).padStart(3, '0')}`,
                        name: child.name,
                        parent_id: parentId,
                        color: child.color || '#94a3b8',
                        icon: child.icon || 'tag',
                        depth: 1,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });
                });
            }
        });

        this.saveCategories(categories);
        console.log(`[CATEGORY] Initialized ${categories.length} default categories`);
        return categories;
    }

    /**
     * Save categories to localStorage
     */
    saveCategories(categories = this.categories) {
        try {
            const _SS = window.StorageService;
            if (_SS) { _SS.set(this.STORAGE_KEY, categories); }
            else { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(categories)); }
            this.categories = categories;
            return true;
        } catch (e) {
            console.error('[CATEGORY] Failed to save categories:', e);
            return false;
        }
    }

    /**
     * Get all categories
     */
    getAll() {
        return this.categories;
    }

    /**
     * Get categories as hierarchical tree
     */
    getTree() {
        const roots = this.categories.filter(c => c.parent_id === null);

        const buildTree = (parent) => {
            const children = this.categories.filter(c => c.parent_id === parent.id);
            return {
                ...parent,
                children: children.map(child => buildTree(child))
            };
        };

        return roots.map(root => buildTree(root));
    }

    /**
     * Get category by ID
     */
    getById(id) {
        return this.categories.find(c => c.id === id);
    }

    /**
     * Get category path (e.g., "Business Expenses > Software & SaaS")
     */
    getPath(id) {
        const category = this.getById(id);
        if (!category) return '';

        const parts = [category.name];
        let current = category;

        while (current.parent_id) {
            current = this.getById(current.parent_id);
            if (current) {
                parts.unshift(current.name);
            }
        }

        return parts.join(' > ');
    }

    /**
     * Create new category
     */
    create(name, parent_id = null, color = '#94a3b8', icon = 'tag') {
        const depth = parent_id ? (this.getById(parent_id)?.depth || 0) + 1 : 0;

        const newCategory = {
            id: `cat_${String(this.categories.length + 1).padStart(3, '0')}`,
            name,
            parent_id,
            color,
            icon,
            depth,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        this.categories.push(newCategory);
        this.saveCategories();

        console.log(`[CATEGORY] Created: ${this.getPath(newCategory.id)}`);
        return newCategory;
    }

    /**
     * Update category
     */
    update(id, changes) {
        const index = this.categories.findIndex(c => c.id === id);
        if (index === -1) return null;

        this.categories[index] = {
            ...this.categories[index],
            ...changes,
            updated_at: new Date().toISOString()
        };

        this.saveCategories();
        console.log(`[CATEGORY] Updated: ${this.getPath(id)}`);
        return this.categories[index];
    }

    /**
     * Delete category (and optionally reassign children)
     */
    delete(id, reassignChildrenTo = null) {
        const category = this.getById(id);
        if (!category) return false;

        // Reassign or delete children
        const children = this.categories.filter(c => c.parent_id === id);
        children.forEach(child => {
            if (reassignChildrenTo) {
                this.update(child.id, { parent_id: reassignChildrenTo });
            } else {
                this.delete(child.id); // Recursive delete
            }
        });

        // Remove category
        this.categories = this.categories.filter(c => c.id !== id);
        this.saveCategories();

        console.log(`[CATEGORY] Deleted: ${category.name}`);
        return true;
    }

    /**
     * Search categories by name
     */
    search(query) {
        const lowerQuery = query.toLowerCase();
        return this.categories.filter(c =>
            c.name.toLowerCase().includes(lowerQuery) ||
            this.getPath(c.id).toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Get root categories
     */
    getRoots() {
        return this.categories.filter(c => c.parent_id === null);
    }

    /**
     * Get children of a category
     */
    getChildren(parentId) {
        return this.categories.filter(c => c.parent_id === parentId);
    }

    /**
     * Reset to defaults
     */
    reset() {
        const _SS = window.StorageService;
        if (_SS) _SS.remove(this.STORAGE_KEY); else localStorage.removeItem(this.STORAGE_KEY);
        this.categories = this.initializeDefaults();
        console.log('[CATEGORY] Reset to defaults');
        return this.categories;
    }
}

// Singleton instance
const categoryService = new CategoryService();

// Make available globally
window.CategoryService = categoryService;

export default categoryService;
