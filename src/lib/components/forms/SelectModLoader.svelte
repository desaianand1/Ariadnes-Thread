<script lang="ts">
	import { onMount } from 'svelte';
	import * as Select from '$lib/components/ui/select';
	import { Spinner } from '$lib/components/ui/spinner';
	import { loaderState, loadModLoaders, getGroupedLoaders } from '$lib/state/mod-loaders.svelte';

	interface Props {
		value?: string;
		onValueChange?: (value: string) => void;
		disabled?: boolean;
		id?: string;
	}

	let { value = $bindable(), onValueChange, disabled = false, id }: Props = $props();

	let grouped = $derived(getGroupedLoaders());

	// Find the selected loader for display
	let selectedLoader = $derived(loaderState.loaders.find((l) => l.slug === value));

	onMount(() => {
		loadModLoaders();
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
		{#if loaderState.isLoading}
			<span class="flex items-center gap-2">
				<Spinner class="size-4" />
				<span class="text-muted-foreground">Loading...</span>
			</span>
		{:else if selectedLoader}
			<span class="flex items-center gap-2">
				<span class={selectedLoader.colorClass} aria-hidden="true">
					{@html selectedLoader.icon}
				</span>
				{selectedLoader.name}
			</span>
		{:else}
			<span class="text-muted-foreground">Select loader</span>
		{/if}
	</Select.Trigger>

	<Select.Content class="max-h-[300px]">
		{#if loaderState.error}
			<div class="px-2 py-4 text-center text-sm text-destructive">
				{loaderState.error}
			</div>
		{:else}
			{#if grouped.popular.length > 0}
				<Select.Group>
					<Select.GroupHeading>Popular</Select.GroupHeading>
					{#each grouped.popular as loader (loader.slug)}
						<Select.Item value={loader.slug}>
							<span class="flex items-center gap-2">
								<span class={loader.colorClass} aria-hidden="true">
									{@html loader.icon}
								</span>
								{loader.name}
							</span>
						</Select.Item>
					{/each}
				</Select.Group>

				<Select.Separator />
			{/if}

			{#if grouped.other.length > 0}
				<Select.Group>
					<Select.GroupHeading>Other</Select.GroupHeading>
					{#each grouped.other as loader (loader.slug)}
						<Select.Item value={loader.slug}>
							<span class="flex items-center gap-2">
								<span class={loader.colorClass} aria-hidden="true">
									{@html loader.icon}
								</span>
								{loader.name}
							</span>
						</Select.Item>
					{/each}
				</Select.Group>
			{/if}

			{#if grouped.plugins.length > 0}
				<Select.Separator />

				<Select.Group>
					<Select.GroupHeading>Server Plugins</Select.GroupHeading>
					{#each grouped.plugins as loader (loader.slug)}
						<Select.Item value={loader.slug}>
							<span class="flex items-center gap-2">
								<span class={loader.colorClass} aria-hidden="true">
									{@html loader.icon}
								</span>
								{loader.name}
							</span>
						</Select.Item>
					{/each}
				</Select.Group>
			{/if}
		{/if}
	</Select.Content>
</Select.Root>
