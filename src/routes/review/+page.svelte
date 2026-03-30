<script lang="ts">
	import type { PageData } from './$types';
	import type { ResolvedProject } from '$lib/services/types';
	import MetaTags from '$lib/components/MetaTags.svelte';
	import SummaryBar from '$lib/components/review/SummaryBar.svelte';
	import FilterBar from '$lib/components/review/FilterBar.svelte';
	import CollectionSection from '$lib/components/review/CollectionSection.svelte';
	import DependenciesSection from '$lib/components/review/DependenciesSection.svelte';
	import { Button } from '$lib/components/ui/button';
	import { fade } from 'svelte/transition';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import PackageXIcon from '@lucide/svelte/icons/package-x';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let sideFilter = $state<'all' | 'client' | 'server' | 'both'>('all');
	let statusFilter = $state<'all' | 'compatible' | 'warnings' | 'conflicts'>('all');

	let warningsByProject = $derived(
		data.warnings.reduce((map, w) => {
			const existing = map.get(w.projectId);
			if (existing) {
				existing.push(w);
			} else {
				map.set(w.projectId, [w]);
			}
			return map;
		}, new Map<string, typeof data.warnings>())
	);

	let conflictProjectIds = $derived(
		new Set(data.conflicts.flatMap((c) => [c.projectId, c.conflictsWith]))
	);

	function matchesFilters(project: ResolvedProject): boolean {
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			if (!project.projectTitle.toLowerCase().includes(query)) {
				return false;
			}
		}

		if (sideFilter !== 'all' && project.side !== sideFilter) {
			return false;
		}

		if (statusFilter !== 'all') {
			const hasWarning = warningsByProject.has(project.projectId);
			const hasConflict = conflictProjectIds.has(project.projectId);

			switch (statusFilter) {
				case 'compatible':
					if (hasWarning || hasConflict) return false;
					break;
				case 'warnings':
					if (!hasWarning) return false;
					break;
				case 'conflicts':
					if (!hasConflict) return false;
					break;
			}
		}

		return true;
	}

	let filteredCollections = $derived(
		data.collections
			.map((group) => ({
				...group,
				resolved: group.resolved.filter(matchesFilters)
			}))
			.filter((group) => group.resolved.length > 0)
	);

	let filteredDependencies = $derived(data.dependencies.filter(matchesFilters));

	let collectionNames = $derived(data.collections.map((g) => g.name).join(', '));
	let totalModCount = $derived(
		data.collections.reduce((sum, g) => sum + g.resolved.length, 0) + data.dependencies.length
	);

	let pageTitle = $derived(
		`Review: ${collectionNames} — ${totalModCount} mods for MC ${data.context.gameVersion} ${data.context.loader}`
	);

	let hasNoResolvedMods = $derived(totalModCount === 0);
	let isFilterEmpty = $derived(
		!hasNoResolvedMods && filteredCollections.length === 0 && filteredDependencies.length === 0
	);
</script>

<MetaTags
	title={pageTitle}
	description="Review and download {totalModCount} mods from {collectionNames} for Minecraft {data
		.context.gameVersion} on {data.context.loader}"
	path="/review"
/>

<div class="min-h-screen">
	<SummaryBar stats={data.stats} context={data.context} />
	<FilterBar bind:searchQuery bind:sideFilter bind:statusFilter />

	<div class="mx-auto max-w-7xl space-y-4 px-4 py-4">
		<!-- Back link -->
		<Button variant="ghost" size="sm" href="/">
			<ArrowLeftIcon class="mr-1.5 size-3.5" />
			Back to form
		</Button>

		<!-- Collection sections -->
		{#each filteredCollections as group (group.id)}
			<CollectionSection
				{group}
				{warningsByProject}
				{conflictProjectIds}
				loader={data.context.loader}
			/>
		{/each}

		<!-- Dependencies section -->
		{#if filteredDependencies.length > 0}
			<DependenciesSection
				dependencies={filteredDependencies}
				projectTitleMap={data.projectTitleMap}
				{warningsByProject}
				{conflictProjectIds}
				loader={data.context.loader}
			/>
		{/if}

		<!-- No mods resolved at all -->
		{#if hasNoResolvedMods}
			<div class="py-16 text-center" transition:fade={{ duration: 150 }}>
				<PackageXIcon class="mx-auto mb-4 size-12 text-muted-foreground" />
				<p class="text-lg font-medium">No compatible mods found</p>
				<p class="mx-auto mt-1 max-w-md text-muted-foreground">
					None of the mods in these collections have versions compatible with Minecraft {data
						.context.gameVersion} on {data.context.loader}.
				</p>
				<Button variant="outline" class="mt-4" href="/">
					<ArrowLeftIcon class="mr-1.5 size-3.5" />
					Try different settings
				</Button>
			</div>
		{/if}

		<!-- Filter empty state -->
		{#if isFilterEmpty}
			<div class="py-16 text-center" transition:fade={{ duration: 150 }}>
				<p class="text-lg text-muted-foreground">No mods match your filters</p>
				<Button
					variant="outline"
					class="mt-4"
					onclick={() => {
						searchQuery = '';
						sideFilter = 'all';
						statusFilter = 'all';
					}}
				>
					Clear filters
				</Button>
			</div>
		{/if}
	</div>
</div>
