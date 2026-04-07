import { CROSS_LOADER_FALLBACKS, LOADER_AGNOSTIC_PROJECT_TYPES } from '$lib/config/constants';
import type { ResolutionOptions } from './types';

/**
 * Builds the ordered list of loaders to try, including cross-loader fallbacks.
 * Shared between resolution and alternative-probe services.
 */
export function buildLoaderList(primary: string, enableFallback: boolean = true): string[] {
    const loaders = [primary];
    if (enableFallback) {
        const fallbacks = CROSS_LOADER_FALLBACKS[primary];
        if (fallbacks) loaders.push(...fallbacks);
    }
    return loaders;
}

/**
 * Builds a user-facing reason string for why a project couldn't be resolved.
 * Loader-agnostic projects omit the loader name since it's irrelevant.
 */
export function buildUnresolvedReason(projectType: string, options: ResolutionOptions): string {
    const isLoaderAgnostic = LOADER_AGNOSTIC_PROJECT_TYPES.has(projectType);
    return isLoaderAgnostic
        ? `No compatible version for ${options.gameVersion}`
        : `No compatible version for ${options.loader} on ${options.gameVersion}`;
}
