import type { SideRequirement } from '$lib/api/types';
import type { SideClassification } from './types';

/**
 * Normalizes `unknown` to `optional` so the classification matrix
 * only needs to handle three values: required, optional, unsupported.
 */
function normalize(side: SideRequirement): Exclude<SideRequirement, 'unknown'> {
    return side === 'unknown' ? 'optional' : side;
}

/**
 * Classifies a project's side affinity based on Modrinth's client_side
 * and server_side fields. Implements the full 3×3 matrix from the PRD
 * (after normalizing `unknown` → `optional`).
 *
 * | client_side   | server_side   | result  |
 * |---------------|---------------|---------|
 * | required      | required      | both    |
 * | required      | optional      | both    |
 * | required      | unsupported   | client  |
 * | optional      | required      | both    |
 * | optional      | optional      | both    |
 * | optional      | unsupported   | client  |
 *
 * Intentionally more inclusive than the PRD's original spec for
 * required+optional and optional+required: if either side supports
 * the mod at all, we include it in both ZIPs.
 * | unsupported   | required      | server  |
 * | unsupported   | optional      | server  |
 * | unsupported   | unsupported   | both    |
 */
export function classifySide(
    clientSide: SideRequirement,
    serverSide: SideRequirement
): SideClassification {
    const client = normalize(clientSide);
    const server = normalize(serverSide);

    if (client === 'unsupported' && server === 'unsupported') {
        return 'both';
    }

    if (client === 'unsupported') {
        return 'server';
    }

    if (server === 'unsupported') {
        return 'client';
    }

    return 'both';
}
