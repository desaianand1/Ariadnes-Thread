<script lang="ts">
	import CollectionForm from '$lib/components/forms/CollectionForm.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<main class="container mx-auto max-w-2xl p-6">
	<CollectionForm data={data.form} />
</main>
