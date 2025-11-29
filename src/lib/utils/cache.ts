/**
 * Client-side localStorage caching utility with TTL support
 * Safe for SSR - checks for browser environment before accessing localStorage
 */

interface CachedData<T> {
	data: T;
	timestamp: number;
}

/**
 * Retrieves cached data from localStorage if it exists and hasn't expired
 * @param key - Storage key
 * @param maxAge - Maximum age in milliseconds
 * @returns Cached data or null if expired/not found
 */
export function getCachedData<T>(key: string, maxAge: number): T | null {
	if (typeof localStorage === 'undefined') return null;

	try {
		const cached = localStorage.getItem(key);
		if (!cached) return null;

		const parsed: CachedData<T> = JSON.parse(cached);
		const age = Date.now() - parsed.timestamp;

		if (age > maxAge) {
			localStorage.removeItem(key);
			return null;
		}

		return parsed.data;
	} catch {
		// Invalid JSON or other error - clear the corrupted data
		try {
			localStorage.removeItem(key);
		} catch {
			// Ignore removal errors
		}
		return null;
	}
}

/**
 * Stores data in localStorage with a timestamp for TTL checking
 * @param key - Storage key
 * @param data - Data to cache
 */
export function setCachedData<T>(key: string, data: T): void {
	if (typeof localStorage === 'undefined') return;

	try {
		const cached: CachedData<T> = {
			data,
			timestamp: Date.now()
		};
		localStorage.setItem(key, JSON.stringify(cached));
	} catch (error) {
		// Storage full or other error - log and continue
		console.warn(`Failed to cache data for key "${key}":`, error);
	}
}

/**
 * Removes cached data from localStorage
 * @param key - Storage key to remove
 */
export function clearCachedData(key: string): void {
	if (typeof localStorage === 'undefined') return;

	try {
		localStorage.removeItem(key);
	} catch {
		// Ignore removal errors
	}
}

/**
 * Clears all cached data matching a prefix
 * @param prefix - Key prefix to match
 */
export function clearCachedDataByPrefix(prefix: string): void {
	if (typeof localStorage === 'undefined') return;

	try {
		const keysToRemove: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith(prefix)) {
				keysToRemove.push(key);
			}
		}
		keysToRemove.forEach((key) => localStorage.removeItem(key));
	} catch {
		// Ignore errors
	}
}
