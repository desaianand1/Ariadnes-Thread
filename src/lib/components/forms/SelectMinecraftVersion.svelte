<script lang="ts">
	import { onMount } from 'svelte';
	import * as Select from '$lib/components/ui/select';
	import { Spinner } from '$lib/components/ui/spinner';
	import {
		versionState,
		loadMinecraftVersions,
		getGroupedVersions
	} from '$lib/state/minecraft-versions.svelte';

	interface Props {
		value?: string;
		onValueChange?: (value: string) => void;
		disabled?: boolean;
		id?: string;
	}

	let { value = $bindable(), onValueChange, disabled = false, id }: Props = $props();

	let grouped = $derived(getGroupedVersions());

	onMount(() => {
		loadMinecraftVersions();
	});

	function handleValueChange(newValue: string | undefined) {
		if (newValue) {
			value = newValue;
			onValueChange?.(newValue);
		}
	}
</script>

<Select.Root type="single" {value} onValueChange={handleValueChange} {disabled}>
	<Select.Trigger {id} class="w-full min-w-[180px]">
		{#if versionState.isLoading}
			<span class="flex items-center gap-2">
				<Spinner class="size-4" />
				<span class="text-muted-foreground">Loading...</span>
			</span>
		{:else if value}
			{value}
		{:else}
			<span class="text-muted-foreground">Select version</span>
		{/if}
	</Select.Trigger>

	<Select.Content class="max-h-[300px]">
		{#if versionState.error}
			<div class="px-2 py-4 text-center text-sm text-destructive">
				{versionState.error}
			</div>
		{:else}
			{#if grouped.popular.length > 0}
				<Select.Group>
					<Select.GroupHeading>Popular Releases</Select.GroupHeading>
					{#each grouped.popular.slice(0, 10) as version (version.value)}
						<Select.Item value={version.value}>
							{version.label}
						</Select.Item>
					{/each}
				</Select.Group>

				<Select.Separator />
			{/if}

			<Select.Group>
				<Select.GroupHeading>All Versions</Select.GroupHeading>
				{#each grouped.other.slice(0, 50) as version (version.value)}
					<Select.Item value={version.value}>
						<span class="flex items-center gap-2">
							{version.label}
							{#if version.versionType !== 'release'}
								<span
									class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
								>
									{version.versionType}
								</span>
							{/if}
						</span>
					</Select.Item>
				{/each}
			</Select.Group>
		{/if}
	</Select.Content>
</Select.Root>
