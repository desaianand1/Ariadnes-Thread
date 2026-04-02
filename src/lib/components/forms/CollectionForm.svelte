<script lang="ts">
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { navigating } from '$app/stores';
    import { SvelteURLSearchParams } from 'svelte/reactivity';
    import { superForm, type SuperValidated, type Infer } from 'sveltekit-superforms';
    import { zod4Client } from 'sveltekit-superforms/adapters';
    import { downloadFormSchema, type DownloadFormSchema } from '$lib/schemas/collection';
    import * as Form from '$lib/components/ui/form';
    import { Spinner } from '$lib/components/ui/spinner';
    import { Label } from '$lib/components/ui/label';
    import { Button } from '$lib/components/ui/button';
    import SelectMinecraftVersion from './SelectMinecraftVersion.svelte';
    import SelectModLoader from './SelectModLoader.svelte';
    import CollectionInput from './CollectionInput.svelte';
    import {
        getValidCollections,
        getValidCollectionIds,
        isValidating,
        hasValidCollection
    } from '$lib/state/collections.svelte';
    import AdvancedSettings from './AdvancedSettings.svelte';
    import { useMinDuration } from '$lib/utils/min-duration.svelte';
    import {
        MIN_FORM_SUBMIT_TIME_MS,
        MAX_CONCURRENT_DOWNLOADS,
        MAX_RETRIES
    } from '$lib/config/constants';

    interface Props {
        data: SuperValidated<Infer<DownloadFormSchema>>;
    }

    let { data }: Props = $props();

    // superForm only reads the initial snapshot — re-initialization isn't needed since
    // the form owns its own state after mount.
    // svelte-ignore state_referenced_locally
    const form = superForm(data, {
        validators: zod4Client(downloadFormSchema)
    });

    const { form: formData } = form;

    const isNavigatingHeld = useMinDuration(() => !!$navigating);
    let isNavigating = $derived(isNavigatingHeld());

    let honeypot = $state('');
    let attempted = $state(false);
    const formLoadedAt = Date.now();

    let canSubmit = $derived(
        $formData.modLoader && $formData.minecraftVersion && hasValidCollection() && !isValidating()
    );

    let totalProjects = $derived(getValidCollections().reduce((sum, c) => sum + c.projectCount, 0));

    // Client-only download preferences (sessionStorage)
    let concurrentDownloads = $state(MAX_CONCURRENT_DOWNLOADS);
    let retryCount = $state(MAX_RETRIES);

    function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        attempted = true;

        if (honeypot) return;
        if (Date.now() - formLoadedAt < MIN_FORM_SUBMIT_TIME_MS) return;

        const collectionIds = getValidCollectionIds();
        if (collectionIds.length === 0) return;

        const params = new SvelteURLSearchParams();
        params.set('c', collectionIds.join(','));
        params.set('v', $formData.minecraftVersion);
        params.set('l', $formData.modLoader);

        const opts: string[] = [];
        if ($formData.includeDependencies) opts.push('d');
        if ($formData.includeOptionalDeps) opts.push('o');
        if ($formData.allowAlphaBeta) opts.push('a');
        if ($formData.enableCrossLoaderFallback) opts.push('f');
        params.set('opts', opts.join(','));

        if (concurrentDownloads !== MAX_CONCURRENT_DOWNLOADS) {
            params.set('cd', String(concurrentDownloads));
        }
        if (retryCount !== MAX_RETRIES) {
            params.set('rc', String(retryCount));
        }

        goto(resolve(`/review?${params.toString()}`));
    }
</script>

<form onsubmit={handleSubmit} class="space-y-6">
    <div class="absolute -left-2499.75" aria-hidden="true">
        <input name="website" tabindex={-1} autocomplete="off" bind:value={honeypot} />
    </div>

    <!-- Collection Inputs (primary action) -->
    <div class="space-y-2">
        <Label>Collections</Label>
        <p class="text-xs text-muted-foreground">
            e.g., modrinth.com/collection/xxxxx or 8-character ID
        </p>
        <CollectionInput disabled={isNavigating} />
    </div>

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
                            disabled={isNavigating}
                            error={attempted && !$formData.minecraftVersion}
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
                            disabled={isNavigating}
                            error={attempted && !$formData.modLoader}
                        />
                    </div>
                {/snippet}
            </Form.Control>
            <Form.FieldErrors />
        </Form.Field>
    </div>

    <!-- Advanced Settings -->
    <AdvancedSettings
        bind:includeDependencies={$formData.includeDependencies}
        bind:includeOptionalDeps={$formData.includeOptionalDeps}
        bind:allowAlphaBeta={$formData.allowAlphaBeta}
        bind:enableCrossLoaderFallback={$formData.enableCrossLoaderFallback}
        bind:concurrentDownloads
        bind:retryCount
        disabled={isNavigating}
    />

    <!-- Submit -->
    <div class="space-y-3">
        {#if hasValidCollection()}
            <p class="text-sm text-muted-foreground" aria-live="polite">
                {getValidCollections().length} collection(s) with {totalProjects} total mods
            </p>
        {/if}

        <Button type="submit" size="lg" class="w-full" disabled={!canSubmit || isNavigating}>
            {#if isNavigating}
                <Spinner class="mr-2 size-4" />
                Loading...
            {:else}
                Review & Download
            {/if}
        </Button>
    </div>
</form>
