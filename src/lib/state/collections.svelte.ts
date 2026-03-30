/**
 * Collection state management using Svelte 5 runes
 * Handles validation of collection URLs/IDs against the API
 */

import { parseCollectionId } from '$lib/schemas/collection';
import { decimalToHex } from '$lib/utils/colors';
import { MAX_COLLECTIONS } from '$lib/config/constants';
import type { ModrinthCollection, ModrinthProject } from '$lib/api/types';
import { SvelteMap } from 'svelte/reactivity';

/**
 * Parsed collection with project details
 */
export interface ParsedCollection {
    id: string;
    name: string;
    description?: string;
    iconUrl?: string;
    color?: string;
    projectCount: number;
    projects: Array<{
        id: string;
        title: string;
        iconUrl?: string;
        projectType: string;
    }>;
}

export type ValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid';

export interface CollectionEntry {
    inputValue: string;
    status: ValidationStatus;
    error?: string;
    collection?: ParsedCollection;
}

export interface CollectionsState {
    entries: CollectionEntry[];
    maxCollections: number;
}

/**
 * State using Svelte 5 runes
 */
const state = $state<CollectionsState>({
    entries: [{ inputValue: '', status: 'idle' }],
    maxCollections: MAX_COLLECTIONS
});

/**
 * Adds a new empty collection input field
 */
export function addCollectionEntry(): void {
    if (state.entries.length >= MAX_COLLECTIONS) return;
    state.entries.push({ inputValue: '', status: 'idle' });
}

/**
 * Removes a collection entry by index
 */
export function removeCollectionEntry(index: number): void {
    if (state.entries.length <= 1) return;
    state.entries.splice(index, 1);
}

/**
 * Updates the input value for an entry (without validation)
 */
export function setCollectionInput(index: number, value: string): void {
    if (index < 0 || index >= state.entries.length) return;

    state.entries[index].inputValue = value;
    state.entries[index].status = 'idle';
    state.entries[index].error = undefined;
    state.entries[index].collection = undefined;
}

/**
 * Validates a collection entry against the API
 */
export async function validateCollectionEntry(index: number): Promise<void> {
    if (index < 0 || index >= state.entries.length) return;

    const entry = state.entries[index];
    const value = entry.inputValue.trim();

    // Empty input is idle, not invalid
    if (!value) {
        state.entries[index].status = 'idle';
        state.entries[index].error = undefined;
        state.entries[index].collection = undefined;
        return;
    }

    // Parse collection ID from URL or use as-is
    const collectionId = parseCollectionId(value);

    if (!collectionId) {
        state.entries[index].status = 'invalid';
        state.entries[index].error = 'Invalid collection URL or ID format';
        return;
    }

    // Check for duplicates across other entries
    const isDuplicate = state.entries.some(
        (e, i) => i !== index && e.collection?.id === collectionId
    );
    if (isDuplicate) {
        state.entries[index].status = 'invalid';
        state.entries[index].error = 'Collection already added';
        return;
    }

    // Start validation
    state.entries[index].status = 'validating';
    state.entries[index].error = undefined;

    try {
        const response = await fetch(`/api/modrinth/collection/${collectionId}`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                response.status === 404
                    ? 'Collection not found'
                    : (errorData as { message?: string }).message || 'Failed to fetch collection'
            );
        }

        const { collection, projects } = (await response.json()) as {
            collection: ModrinthCollection;
            projects: ModrinthProject[];
        };

        state.entries[index].status = 'valid';
        state.entries[index].collection = {
            id: collection.id,
            name: collection.name,
            description: collection.description,
            iconUrl: collection.icon_url,
            color: decimalToHex(collection.color),
            projectCount: projects.length,
            projects: projects.map((p) => ({
                id: p.id,
                title: p.title,
                iconUrl: p.icon_url,
                projectType: p.project_type
            }))
        };
    } catch (err) {
        state.entries[index].status = 'invalid';
        state.entries[index].error = err instanceof Error ? err.message : 'Validation failed';
        state.entries[index].collection = undefined;
    }
}

/**
 * Updates input and triggers debounced validation
 */
const debounceTimers = new SvelteMap<number, ReturnType<typeof setTimeout>>();

export function updateCollectionInput(
    index: number,
    value: string,
    debounceMs: number = 500
): void {
    setCollectionInput(index, value);

    // Clear existing timer
    const existingTimer = debounceTimers.get(index);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }

    // Don't validate empty inputs
    if (!value.trim()) {
        debounceTimers.delete(index);
        return;
    }

    // Set new timer for debounced validation
    const timer = setTimeout(() => {
        validateCollectionEntry(index);
        debounceTimers.delete(index);
    }, debounceMs);

    debounceTimers.set(index, timer);
}

/**
 * Returns all valid collections
 */
export function getValidCollections(): ParsedCollection[] {
    return state.entries
        .filter((e) => e.status === 'valid' && e.collection)
        .map((e) => e.collection!);
}

/**
 * Returns all valid collection IDs
 */
export function getValidCollectionIds(): string[] {
    return getValidCollections().map((c) => c.id);
}

/**
 * Checks if any entries are currently validating
 */
export function isValidating(): boolean {
    return state.entries.some((e) => e.status === 'validating');
}

/**
 * Checks if the form has at least one valid collection
 */
export function hasValidCollection(): boolean {
    return state.entries.some((e) => e.status === 'valid');
}

/**
 * Resets all collection entries
 */
export function resetCollections(): void {
    // Clear any pending debounce timers
    debounceTimers.forEach((timer) => clearTimeout(timer));
    debounceTimers.clear();

    state.entries = [{ inputValue: '', status: 'idle' }];
}

/**
 * Gets total project count across all valid collections
 */
export function getTotalProjectCount(): number {
    return getValidCollections().reduce((sum, c) => sum + c.projectCount, 0);
}

/**
 * Exported state getter for reactive access
 */
export function getCollectionsState(): CollectionsState {
    return state;
}

export { state as collectionsState };
