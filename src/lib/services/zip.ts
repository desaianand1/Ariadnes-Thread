/**
 * ZIP generation using fflate.
 * Builds client and server ZIPs with correct directory structure
 * based on project type (mods/, resourcepacks/, shaderpacks/, datapacks/).
 */

import { zipSync } from 'fflate';
import type { SideClassification } from './types';

export interface ZipEntry {
    path: string;
    data: Uint8Array;
}

export interface ZipFileInfo {
    fileName: string;
    fileUrl: string;
    folder: string;
    side: SideClassification;
}

/**
 * Build a ZIP blob from path/data entries.
 * Uses store mode (level 0) since JARs and ZIPs are already compressed.
 */
export function buildZip(entries: ZipEntry[]): Blob {
    const tree: Record<string, Uint8Array> = {};

    for (const entry of entries) {
        tree[entry.path] = entry.data;
    }

    const zipped = zipSync(tree, { level: 0 });
    return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
}

/**
 * Build separate client and server ZIPs from resolved files.
 * "both" side files are included in each ZIP.
 * Returns null for a side that has no files.
 */
export function buildSideZips(
    files: ZipFileInfo[],
    downloadedData: Map<string, Uint8Array>
): { client: Blob | null; server: Blob | null } {
    const clientEntries: ZipEntry[] = [];
    const serverEntries: ZipEntry[] = [];

    for (const file of files) {
        const data = downloadedData.get(file.fileUrl);
        if (!data) continue;

        const entry: ZipEntry = {
            path: `${file.folder}/${file.fileName}`,
            data
        };

        if (file.side === 'client' || file.side === 'both') {
            clientEntries.push(entry);
        }
        if (file.side === 'server' || file.side === 'both') {
            serverEntries.push(entry);
        }
    }

    return {
        client: clientEntries.length > 0 ? buildZip(clientEntries) : null,
        server: serverEntries.length > 0 ? buildZip(serverEntries) : null
    };
}
