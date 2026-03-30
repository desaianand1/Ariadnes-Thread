<script lang="ts">
	import { siteConfig } from '$lib/config/site';
	import CollectionForm from '$lib/components/forms/CollectionForm.svelte';
	import MetaTags from '$lib/components/MetaTags.svelte';
	import logo from '$lib/assets/logo.svg';
	import type { PageData } from './$types';
	import { fade } from 'svelte/transition';

	let { data }: { data: PageData } = $props();
</script>

<MetaTags />

<div class="container mx-auto max-w-2xl p-6" in:fade={{ duration: 200 }}>
	<!-- Hero -->
	<div class="mb-8 flex flex-col items-center text-center">
		<img src={logo} alt="{siteConfig.name} logo" class="mb-4 size-20" />
		<h1 class="text-3xl font-bold tracking-tight">{siteConfig.name}</h1>
		<p class="mt-2 max-w-md text-muted-foreground">{siteConfig.description}</p>

		<ol class="mt-6 flex gap-6 text-sm text-muted-foreground">
			<li class="flex flex-col items-center gap-1">
				<span
					class="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
					>1</span
				>
				Paste URLs
			</li>
			<li class="flex flex-col items-center gap-1">
				<span
					class="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
					>2</span
				>
				Configure
			</li>
			<li class="flex flex-col items-center gap-1">
				<span
					class="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
					>3</span
				>
				Download
			</li>
		</ol>
	</div>

	<CollectionForm data={data.form} />
</div>
