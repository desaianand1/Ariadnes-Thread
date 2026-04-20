<script lang="ts">
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { navigating } from '$app/stores';
    import { env } from '$env/dynamic/public';
    import { SvelteURLSearchParams } from 'svelte/reactivity';
    import { superForm, type SuperValidated, type Infer } from 'sveltekit-superforms';
    import { zod4Client } from 'sveltekit-superforms/adapters';
    import { downloadFormSchema, type DownloadFormSchema } from '$lib/schemas/collection';
    import * as Form from '$lib/components/ui/form';
    import { Spinner } from '$lib/components/ui/spinner';
    import { Label } from '$lib/components/ui/label';
    import { Button } from '$lib/components/ui/button';
    import { Turnstile } from '$lib/components/ui/turnstile';
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
    let verifying = $state(false);
    let verifyError = $state('');
    const formLoadedAt = Date.now();

    let canSubmit = $derived(
        $formData.modLoader && $formData.minecraftVersion && hasValidCollection() && !isValidating()
    );

    let totalProjects = $derived(getValidCollections().reduce((sum, c) => sum + c.projectCount, 0));

    // Client-only download preferences (sessionStorage)
    let concurrentDownloads = $state(MAX_CONCURRENT_DOWNLOADS);
    let retryCount = $state(MAX_RETRIES);

    // Turnstile is invisible in managed challenge mode. Cloudflare decides per
    // request whether to surface a UI challenge based on fingerprint/IP.
    const turnstileSiteKey = env.PUBLIC_TURNSTILE_SITE_KEY ?? '';
    let turnstileRef: ReturnType<typeof Turnstile> | undefined = $state(undefined);
    let turnstileToken = $state('');
    // Longer than the Turnstile challenge render time so slow challenges still
    // succeed. Users with reduced motion and congested networks have been seen
    // to take ~7s in production, so 15s is safely above that 99th-percentile.
    const TURNSTILE_WAIT_TIMEOUT_MS = 15_000;

    async function waitForToken(): Promise<string> {
        if (turnstileToken) return turnstileToken;
        return new Promise<string>((resolveToken, rejectToken) => {
            const deadline = Date.now() + TURNSTILE_WAIT_TIMEOUT_MS;
            const tick = () => {
                if (turnstileToken) {
                    resolveToken(turnstileToken);
                    return;
                }
                if (Date.now() >= deadline) {
                    rejectToken(new Error('turnstile_timeout'));
                    return;
                }
                requestAnimationFrame(tick);
            };
            tick();
        });
    }

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        attempted = true;
        verifyError = '';

        if (honeypot) return;
        if (Date.now() - formLoadedAt < MIN_FORM_SUBMIT_TIME_MS) return;

        const collectionIds = getValidCollectionIds();
        if (collectionIds.length === 0) return;

        // Turnstile is an extra layer on top of the honeypot + timing guard.
        // Skipped in dev or when no key is configured so pnpm dev keeps working.
        if (turnstileSiteKey) {
            verifying = true;
            try {
                if (!turnstileToken) turnstileRef?.execute();
                let token: string;
                try {
                    token = await waitForToken();
                } catch {
                    verifyError = 'Verification timed out. Please try again.';
                    turnstileRef?.reset();
                    turnstileToken = '';
                    return;
                }
                const res = await fetch(resolve('/api/challenge/hero'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ turnstileToken: token })
                });
                // Token is single-use regardless of server outcome; always reset.
                turnstileRef?.reset();
                turnstileToken = '';
                if (!res.ok) {
                    verifyError = 'Verification failed. Please try again.';
                    return;
                }
            } finally {
                verifying = false;
            }
        }

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

    {#if turnstileSiteKey}
        <Turnstile
            bind:this={turnstileRef}
            siteKey={turnstileSiteKey}
            size="invisible"
            appearance="interaction-only"
            action="hero-submit"
            onVerify={(t) => (turnstileToken = t)}
            onExpire={() => (turnstileToken = '')}
            onError={() => (turnstileToken = '')}
        />
    {/if}

    <!-- Submit -->
    <div class="space-y-3">
        {#if hasValidCollection()}
            <p class="text-sm text-muted-foreground" aria-live="polite">
                {getValidCollections().length} collection(s) with {totalProjects} total mods
            </p>
        {/if}

        {#if verifyError}
            <p class="text-sm text-destructive" role="alert">{verifyError}</p>
        {/if}

        <Button
            type="submit"
            size="lg"
            class="w-full"
            disabled={!canSubmit || isNavigating || verifying}
        >
            {#if verifying}
                <Spinner class="mr-2 size-4" />
                Verifying...
            {:else if isNavigating}
                <Spinner class="mr-2 size-4" />
                Loading...
            {:else}
                Review & Download
            {/if}
        </Button>
    </div>
</form>
