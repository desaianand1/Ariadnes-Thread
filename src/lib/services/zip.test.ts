import { describe, it, expect } from 'vitest';
import { unzipSync } from 'fflate';
import { buildZip, buildSideZips, type ZipFileInfo } from './zip';

const SAMPLE_DATA = new TextEncoder().encode('mod file content');

function extractPaths(blob: Blob): Promise<string[]> {
    return blob.arrayBuffer().then((buf) => {
        const unzipped = unzipSync(new Uint8Array(buf));
        return Object.keys(unzipped).sort();
    });
}

describe('buildZip', () => {
    it('creates a valid ZIP with correct paths', async () => {
        const blob = buildZip([
            { path: 'mods/sodium.jar', data: SAMPLE_DATA },
            { path: 'mods/lithium.jar', data: SAMPLE_DATA },
            { path: 'resourcepacks/pack.zip', data: SAMPLE_DATA }
        ]);

        expect(blob.type).toBe('application/zip');
        const paths = await extractPaths(blob);
        expect(paths).toEqual(['mods/lithium.jar', 'mods/sodium.jar', 'resourcepacks/pack.zip']);
    });

    it('preserves file content', async () => {
        const content = new TextEncoder().encode('hello world');
        const blob = buildZip([{ path: 'mods/test.jar', data: content }]);

        const buf = await blob.arrayBuffer();
        const unzipped = unzipSync(new Uint8Array(buf));
        expect(new TextDecoder().decode(unzipped['mods/test.jar'])).toBe('hello world');
    });

    it('handles empty entries', () => {
        const blob = buildZip([]);
        expect(blob.size).toBeGreaterThan(0); // valid empty ZIP has a header
    });
});

describe('buildSideZips', () => {
    const files: ZipFileInfo[] = [
        { fileName: 'sodium.jar', fileUrl: 'https://cdn/sodium', folder: 'mods', side: 'client' },
        { fileName: 'lithium.jar', fileUrl: 'https://cdn/lithium', folder: 'mods', side: 'server' },
        {
            fileName: 'fabric-api.jar',
            fileUrl: 'https://cdn/fabric-api',
            folder: 'mods',
            side: 'both'
        },
        {
            fileName: 'pack.zip',
            fileUrl: 'https://cdn/pack',
            folder: 'resourcepacks',
            side: 'client'
        }
    ];

    const data = new Map<string, Uint8Array>([
        ['https://cdn/sodium', SAMPLE_DATA],
        ['https://cdn/lithium', SAMPLE_DATA],
        ['https://cdn/fabric-api', SAMPLE_DATA],
        ['https://cdn/pack', SAMPLE_DATA]
    ]);

    it('includes client and both mods in client ZIP', async () => {
        const { client } = buildSideZips(files, data);
        expect(client).not.toBeNull();
        const paths = await extractPaths(client!);
        expect(paths).toEqual(['mods/fabric-api.jar', 'mods/sodium.jar', 'resourcepacks/pack.zip']);
    });

    it('includes server and both mods in server ZIP', async () => {
        const { server } = buildSideZips(files, data);
        expect(server).not.toBeNull();
        const paths = await extractPaths(server!);
        expect(paths).toEqual(['mods/fabric-api.jar', 'mods/lithium.jar']);
    });

    it('"both" files appear in both ZIPs', async () => {
        const { client, server } = buildSideZips(files, data);
        const clientPaths = await extractPaths(client!);
        const serverPaths = await extractPaths(server!);
        expect(clientPaths).toContain('mods/fabric-api.jar');
        expect(serverPaths).toContain('mods/fabric-api.jar');
    });

    it('returns null for a side with no files', () => {
        const clientOnly: ZipFileInfo[] = [
            {
                fileName: 'sodium.jar',
                fileUrl: 'https://cdn/sodium',
                folder: 'mods',
                side: 'client'
            }
        ];
        const { client, server } = buildSideZips(clientOnly, data);
        expect(client).not.toBeNull();
        expect(server).toBeNull();
    });

    it('skips files with no downloaded data', () => {
        const emptyData = new Map<string, Uint8Array>();
        const { client, server } = buildSideZips(files, emptyData);
        expect(client).toBeNull();
        expect(server).toBeNull();
    });
});
