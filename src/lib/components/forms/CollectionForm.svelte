<script lang="ts">
	import { superForm, type SuperValidated, type Infer } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { downloadFormSchema, type DownloadFormSchema } from '$lib/schemas/collection';
	import * as Form from '$lib/components/ui/form';
	import * as Card from '$lib/components/ui/card';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Button } from '$lib/components/ui/button';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import SelectMinecraftVersion from './SelectMinecraftVersion.svelte';
	import SelectModLoader from './SelectModLoader.svelte';
	import CollectionInput from './CollectionInput.svelte';
	import {
		getValidCollections,
		getValidCollectionIds,
		isValidating,
		hasValidCollection
	} from '$lib/state/collections.svelte';

	interface Props {
		data: SuperValidated<Infer<DownloadFormSchema>>;
	}

	let { data }: Props = $props();

	const form = superForm(data, {
		validators: zod4Client(downloadFormSchema),
		onSubmit: ({ formData, cancel }) => {
			// Get valid collections
			const validCollections = getValidCollectionIds();

			if (validCollections.length === 0) {
				cancel();
				return;
			}

			// Add collection IDs to form data
			formData.set('collections', JSON.stringify(validCollections));
		}
	});

	const { form: formData, enhance, submitting } = form;

	// Check if form is ready to submit
	let canSubmit = $derived(
		$formData.modLoader && $formData.minecraftVersion && hasValidCollection() && !isValidating()
	);

	// Total project count for display
	let totalProjects = $derived(getValidCollections().reduce((sum, c) => sum + c.projectCount, 0));
</script>

<form method="POST" use:enhance>
	<Card.Root>
		<Card.Header>
			<Card.Title>Download Modrinth Collections</Card.Title>
			<Card.Description>
				Enter collection URLs or IDs to download all mods as a single ZIP file.
			</Card.Description>
		</Card.Header>

		<Card.Content class="space-y-6">
			<!-- Configuration Row -->
			<div class="flex flex-wrap gap-4">
				<Form.Field {form} name="minecraftVersion">
					<Form.Control>
						{#snippet children({ props })}
							<div class="space-y-2">
								<Form.Label>Minecraft Version</Form.Label>
								<SelectMinecraftVersion
									{...props}
									bind:value={$formData.minecraftVersion}
									disabled={$submitting}
								/>
							</div>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				<Form.Field {form} name="modLoader">
					<Form.Control>
						{#snippet children({ props })}
							<div class="space-y-2">
								<Form.Label>Mod Loader</Form.Label>
								<SelectModLoader
									{...props}
									bind:value={$formData.modLoader}
									disabled={$submitting}
								/>
							</div>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
			</div>

			<!-- Collection Inputs -->
			<div class="space-y-2">
				<Label>Collection URLs or IDs</Label>
				<CollectionInput disabled={$submitting} />
			</div>

			<!-- Options -->
			<Form.Field {form} name="includeDependencies">
				<Form.Control>
					{#snippet children({ props })}
						<div class="flex items-center gap-2">
							<Switch
								{...props}
								id="include-deps"
								bind:checked={$formData.includeDependencies}
								disabled={$submitting}
							/>
							<Label for="include-deps" class="font-normal">Include required dependencies</Label>
						</div>
					{/snippet}
				</Form.Control>
			</Form.Field>
		</Card.Content>

		<Card.Footer class="flex-col gap-3">
			{#if hasValidCollection()}
				<p class="w-full text-sm text-muted-foreground">
					{getValidCollections().length} collection(s) with {totalProjects} total mods
				</p>
			{/if}

			<Button type="submit" size="lg" class="w-full" disabled={!canSubmit || $submitting}>
				{#if $submitting}
					<Spinner class="mr-2 size-4" />
					Preparing...
				{:else}
					<DownloadIcon class="mr-2 size-4" />
					Download as ZIP
				{/if}
			</Button>
		</Card.Footer>
	</Card.Root>
</form>
