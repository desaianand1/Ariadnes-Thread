<script lang="ts">
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { navigating } from '$app/stores';
    import { SvelteURLSearchParams } from 'svelte/reactivity';
    import { superForm, type SuperValidated, type Infer } from 'sveltekit-superforms';
    import { zod4Client } from 'sveltekit-superforms/adapters';
    import { downloadFormSchema, type DownloadFormSchema } from '$lib/schemas/collection';
    import * as Form from '$lib/components/ui/form';
    import * as Card from '$lib/components/ui/card';
    import { Switch } from '$lib/components/ui/switch';
    import { Label } from '$lib/components/ui/label';
    import { Spinner } from '$lib/components/ui/spinner';
    import { Button } from '$lib/components/ui/button';
    import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
    import SelectMinecraftVersion from './SelectMinecraftVersion.svelte';
    import SelectModLoader from './SelectModLoader.svelte';
    import CollectionInput from './CollectionInput.svelte';
    import {
        getValidCollections,
        getValidCollectionIds,
        isValidating,
        hasValidCollection
    } from '$lib/state/collections.svelte';
    import { useMinDuration } from '$lib/utils/min-duration.svelte';
    import { MIN_FORM_SUBMIT_TIME_MS } from '$lib/config/constants';

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
    const formLoadedAt = Date.now();

    let canSubmit = $derived(
        $formData.modLoader && $formData.minecraftVersion && hasValidCollection() && !isValidating()
    );

    let totalProjects = $derived(getValidCollections().reduce((sum, c) => sum + c.projectCount, 0));

    function handleSubmit(e: SubmitEvent) {
        e.preventDefault();

        // Silent anti-bot checks — no error messages to avoid revealing the mechanism
        if (honeypot) return;
        if (Date.now() - formLoadedAt < MIN_FORM_SUBMIT_TIME_MS) return;

        const collectionIds = getValidCollectionIds();
        if (collectionIds.length === 0) return;

        const params = new SvelteURLSearchParams();
        params.set('c', collectionIds.join(','));
        params.set('v', $formData.minecraftVersion);
        params.set('l', $formData.modLoader);

        // Build opts: d=deps, f=cross-loader fallback (both on by default)
        const opts: string[] = ['f'];
        if ($formData.includeDependencies) {
            opts.push('d');
        }
        params.set('opts', opts.join(','));

        goto(resolve(`/review?${params.toString()}`));
    }
</script>

<form onsubmit={handleSubmit}>
    <Card.Root>
        <Card.Header>
            <Card.Title>Download Modrinth Collections</Card.Title>
            <Card.Description>
                Enter collection URLs or IDs to download all mods as a single ZIP file.
            </Card.Description>
        </Card.Header>

        <Card.Content class="space-y-6">
            <div class="absolute -left-[9999px]" aria-hidden="true">
                <input name="website" tabindex={-1} autocomplete="off" bind:value={honeypot} />
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
                                />
                            </div>
                        {/snippet}
                    </Form.Control>
                    <Form.Description>Select the game version you're playing</Form.Description>
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
                                />
                            </div>
                        {/snippet}
                    </Form.Control>
                    <Form.Description>Choose your mod loader platform</Form.Description>
                    <Form.FieldErrors />
                </Form.Field>
            </div>

            <!-- Collection Inputs -->
            <div class="space-y-2">
                <Label>Collection URLs or IDs</Label>
                <p class="text-[0.8rem] text-muted-foreground">
                    Paste Modrinth collection URLs or 8-character IDs
                </p>
                <CollectionInput disabled={isNavigating} />
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
                                disabled={isNavigating}
                            />
                            <Label for="include-deps" class="font-normal"
                                >Include required dependencies</Label
                            >
                        </div>
                    {/snippet}
                </Form.Control>
                <Form.Description>Automatically resolves required library mods</Form.Description>
            </Form.Field>
        </Card.Content>

        <Card.Footer class="flex-col gap-3">
            {#if hasValidCollection()}
                <p class="w-full text-sm text-muted-foreground">
                    {getValidCollections().length} collection(s) with {totalProjects} total mods
                </p>
            {/if}

            <Button type="submit" size="lg" class="w-full" disabled={!canSubmit || isNavigating}>
                {#if isNavigating}
                    <Spinner class="mr-2 size-4" />
                    Loading...
                {:else}
                    Next
                    <ArrowRightIcon class="ml-2 size-4" />
                {/if}
            </Button>
        </Card.Footer>
    </Card.Root>
</form>
