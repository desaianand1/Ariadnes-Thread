/**
 * File integrity verification using the Web Crypto API.
 * Used to verify downloaded mod files against Modrinth-provided hashes.
 */

function toHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
}

export async function verifySha1(data: Uint8Array, expectedHash: string): Promise<boolean> {
    const digest = await crypto.subtle.digest('SHA-1', data.buffer as ArrayBuffer);
    return toHex(digest) === expectedHash.toLowerCase();
}

export async function verifySha512(data: Uint8Array, expectedHash: string): Promise<boolean> {
    const digest = await crypto.subtle.digest('SHA-512', data.buffer as ArrayBuffer);
    return toHex(digest) === expectedHash.toLowerCase();
}
