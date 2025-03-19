import { loadModLoaders } from '$state/mod-loader.svelte';
import type { PageLoad } from './$types';
import { loadMinecraftVersions } from '$state/minecraft-version.svelte';
import { browser } from '$app/environment';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { downloadCollectionsSchema } from '$schema';

export const load: PageLoad = async () => {
  loadModLoaders(browser);
  loadMinecraftVersions(browser);
  const form = await superValidate(zod(downloadCollectionsSchema));
  return { form };
};
