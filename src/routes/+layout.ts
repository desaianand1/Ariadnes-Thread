import { setFetchFunction } from '$state/fetch.svelte';
import type { LayoutLoad } from '$routes/$types';

export const load = (async ({fetch}) => {
    setFetchFunction(fetch);
    return {};
  }) satisfies LayoutLoad;