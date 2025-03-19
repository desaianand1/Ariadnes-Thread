export interface CachedData<T> {
  data: T;
  timestamp: number;
}

export function getCachedData<T>(key: string, expirationTime: number): T | null {
  try {
    const cachedString = localStorage.getItem(key);
    if (!cachedString) return null;

    const cached: CachedData<T> = JSON.parse(cachedString);
    const now = Date.now();

    if (now - cached.timestamp > expirationTime) {
      localStorage.removeItem(key);
      return null;
    }

    return cached.data;
  } catch (error) {
    console.error(`Error retrieving cached data for key ${key}:`, error);
    localStorage.removeItem(key);
    return null;
  }
}

export function setCachedData<T>(key: string, data: T): void {
  try {
    const cachedData: CachedData<T> = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cachedData));
  } catch (error) {
    console.error(`Error caching data for key ${key}:`, error);
  }
}
