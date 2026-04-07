/**
 * Splits an array into chunks of the specified size.
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
    if (size <= 0) return [];
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}
