<script lang="ts">
	import type { CollectionGroup, ResolutionWarning } from '$lib/services/types';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import * as Avatar from '$lib/components/ui/avatar';
	import ModCard from './ModCard.svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	interface Props {
		group: CollectionGroup;
		warningsByProject: Map<string, ResolutionWarning[]>;
		conflictProjectIds: Set<string>;
		loader: string;
		defaultOpen?: boolean;
	}

	let {
		group,
		warningsByProject,
		conflictProjectIds,
		loader,
		defaultOpen = true
	}: Props = $props();

	let open = $state(defaultOpen);

	const SIDE_ORDER = ['client', 'server', 'both'] as const;
	const SIDE_LABELS: Record<string, string> = {
		client: 'Client',
		server: 'Server',
		both: 'Both'
	};

	let sideGroups = $derived(
		SIDE_ORDER.map((side) => ({
			side,
			label: SIDE_LABELS[side],
			projects: group.resolved.filter((p) => p.side === side)
		})).filter((g) => g.projects.length > 0)
	);
</script>

<Collapsible.Root bind:open>
	<div
		class="rounded-lg border"
		style={group.color ? `border-left-color: ${group.color}` : undefined}
		class:border-l-4={!!group.color}
	>
		<!-- Header -->
		<Collapsible.Trigger
			class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
		>
			{#if group.iconUrl}
				<Avatar.Root class="size-8 rounded-lg">
					<Avatar.Image src={group.iconUrl} alt={group.name} />
					<Avatar.Fallback class="rounded-lg text-xs">{group.name.charAt(0)}</Avatar.Fallback>
				</Avatar.Root>
			{:else}
				<Avatar.Root class="size-8 rounded-lg">
					<Avatar.Fallback class="rounded-lg text-xs">{group.name.charAt(0)}</Avatar.Fallback>
				</Avatar.Root>
			{/if}

			<div class="flex-1">
				<span class="font-semibold">{group.name}</span>
				<span class="ml-2 text-sm text-muted-foreground">
					{group.resolved.length} of {group.totalProjectCount} mods
				</span>
			</div>

			<ChevronDownIcon
				class="size-4 text-muted-foreground transition-transform duration-200 {open
					? 'rotate-180'
					: ''}"
			/>
		</Collapsible.Trigger>

		<!-- Content -->
		<Collapsible.Content>
			<div class="space-y-4 px-4 pb-4">
				{#if group.resolved.length === 0}
					<p class="py-4 text-center text-sm text-muted-foreground">
						No resolvable mods in this collection.
					</p>
				{:else}
					{#each sideGroups as { side, label, projects } (side)}
						<div>
							<h4 class="mb-2 text-sm font-medium text-muted-foreground">
								{label} ({projects.length})
							</h4>
							<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
								{#each projects as project (project.projectId)}
									<ModCard
										{project}
										warnings={warningsByProject.get(project.projectId) ?? []}
										isConflict={conflictProjectIds.has(project.projectId)}
										alsoIn={group.alsoInMap[project.projectId]}
										{loader}
									/>
								{/each}
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</Collapsible.Content>
	</div>
</Collapsible.Root>
