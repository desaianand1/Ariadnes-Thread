<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import HomeIcon from '@lucide/svelte/icons/house';
	import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';
	import SearchXIcon from '@lucide/svelte/icons/search-x';

	let status = $derived(page.status);
	let message = $derived(page.error?.message ?? 'Something went wrong');

	let is404 = $derived(status === 404);
</script>

<svelte:head>
	<title>{status} — Ariadne's Thread</title>
</svelte:head>

<div class="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
	{#if is404}
		<SearchXIcon class="mb-4 size-16 text-muted-foreground" />
	{:else}
		<AlertCircleIcon class="mb-4 size-16 text-muted-foreground" />
	{/if}

	<h1 class="text-4xl font-bold tracking-tight">{status}</h1>

	<p class="mt-2 max-w-md text-lg text-muted-foreground">
		{#if is404}
			The page you're looking for doesn't exist or has been moved.
		{:else if status >= 500}
			Something went wrong on our end. Please try again later.
		{:else}
			{message}
		{/if}
	</p>

	<Button href="/" class="mt-6">
		<HomeIcon class="mr-2 size-4" />
		Back to home
	</Button>
</div>
