<script lang="ts">
    import * as Collapsible from '$lib/components/ui/collapsible';
    import { Switch } from '$lib/components/ui/switch';
    import { Input } from '$lib/components/ui/input';
    import { Button } from '$lib/components/ui/button';
    import { Label } from '$lib/components/ui/label';
    import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
    import MinusIcon from '@lucide/svelte/icons/minus';
    import PlusIcon from '@lucide/svelte/icons/plus';
    import {
        MIN_CONCURRENT_DOWNLOADS,
        MAX_CONCURRENT_DOWNLOADS_LIMIT,
        MIN_RETRY_COUNT,
        MAX_RETRY_COUNT_LIMIT
    } from '$lib/config/constants';

    interface Props {
        includeDependencies: boolean;
        includeOptionalDeps: boolean;
        allowAlphaBeta: boolean;
        enableCrossLoaderFallback: boolean;
        concurrentDownloads: number;
        retryCount: number;
        disabled?: boolean;
    }

    let {
        includeDependencies = $bindable(),
        includeOptionalDeps = $bindable(),
        allowAlphaBeta = $bindable(),
        enableCrossLoaderFallback = $bindable(),
        concurrentDownloads = $bindable(),
        retryCount = $bindable(),
        disabled = false
    }: Props = $props();

    let open = $state(false);

    function clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    function handleConcurrencyBlur() {
        concurrentDownloads = clamp(
            Math.round(concurrentDownloads),
            MIN_CONCURRENT_DOWNLOADS,
            MAX_CONCURRENT_DOWNLOADS_LIMIT
        );
    }

    function handleRetryBlur() {
        retryCount = clamp(Math.round(retryCount), MIN_RETRY_COUNT, MAX_RETRY_COUNT_LIMIT);
    }
</script>

<Collapsible.Root bind:open>
    <Collapsible.Trigger
        class="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        {disabled}
    >
        <ChevronDownIcon
            class="size-4 transition-transform duration-200 {open ? 'rotate-0' : '-rotate-90'}"
        />
        Advanced Settings
    </Collapsible.Trigger>

    <Collapsible.Content class="bg-background">
        <div class="mt-3 space-y-4 rounded-md border p-4">
            <!-- Boolean toggles -->
            <div class="space-y-4">
                <div class="flex items-start justify-between gap-4">
                    <div class="space-y-0.5">
                        <Label for="deps-toggle" class="text-sm font-normal">
                            Include required dependencies
                        </Label>
                        <p class="text-xs text-muted-foreground">
                            Automatically add libraries that your mods need to run
                        </p>
                    </div>
                    <Switch id="deps-toggle" bind:checked={includeDependencies} {disabled} />
                </div>

                <div class="flex items-start justify-between gap-4">
                    <div class="space-y-0.5">
                        <Label for="optional-deps-toggle" class="text-sm font-normal">
                            Include optional dependencies
                        </Label>
                        <p class="text-xs text-muted-foreground">
                            Add recommended extras like integration mods and soft dependencies
                        </p>
                    </div>
                    <Switch
                        id="optional-deps-toggle"
                        bind:checked={includeOptionalDeps}
                        {disabled}
                    />
                </div>

                <div class="flex items-start justify-between gap-4">
                    <div class="space-y-0.5">
                        <Label for="alpha-toggle" class="text-sm font-normal">
                            Allow alpha/beta releases
                        </Label>
                        <p class="text-xs text-muted-foreground">
                            Use pre-release versions when no stable version matches your Minecraft
                            version
                        </p>
                    </div>
                    <Switch id="alpha-toggle" bind:checked={allowAlphaBeta} {disabled} />
                </div>

                <div class="flex items-start justify-between gap-4">
                    <div class="space-y-0.5">
                        <Label for="fallback-toggle" class="text-sm font-normal">
                            Cross-loader fallback
                        </Label>
                        <p class="text-xs text-muted-foreground">
                            Try compatible loaders (e.g. Fabric mods on Quilt) when an exact match
                            isn't available
                        </p>
                    </div>
                    <Switch
                        id="fallback-toggle"
                        bind:checked={enableCrossLoaderFallback}
                        {disabled}
                    />
                </div>
            </div>

            <hr class="border-border" />

            <!-- Numeric inputs -->
            <div class="space-y-4">
                <div class="flex items-start justify-between gap-4">
                    <div class="space-y-0.5">
                        <Label for="concurrency-input" class="text-sm font-normal">
                            Concurrent downloads
                        </Label>
                        <p class="text-xs text-muted-foreground">
                            How many mod files to download at once — higher is faster but uses more
                            bandwidth
                        </p>
                    </div>
                    <div class="flex shrink-0 items-center">
                        <Button
                            variant="outline"
                            size="icon"
                            class="h-8 w-8 rounded-r-none"
                            {disabled}
                            onclick={() => {
                                concurrentDownloads = clamp(
                                    concurrentDownloads - 1,
                                    MIN_CONCURRENT_DOWNLOADS,
                                    MAX_CONCURRENT_DOWNLOADS_LIMIT
                                );
                            }}
                        >
                            <MinusIcon class="size-3" />
                        </Button>
                        <Input
                            id="concurrency-input"
                            type="number"
                            min={MIN_CONCURRENT_DOWNLOADS}
                            max={MAX_CONCURRENT_DOWNLOADS_LIMIT}
                            step={1}
                            bind:value={concurrentDownloads}
                            onblur={handleConcurrencyBlur}
                            class="h-8 w-14 [appearance:textfield] rounded-none border-x-0 text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            {disabled}
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            class="h-8 w-8 rounded-l-none"
                            {disabled}
                            onclick={() => {
                                concurrentDownloads = clamp(
                                    concurrentDownloads + 1,
                                    MIN_CONCURRENT_DOWNLOADS,
                                    MAX_CONCURRENT_DOWNLOADS_LIMIT
                                );
                            }}
                        >
                            <PlusIcon class="size-3" />
                        </Button>
                    </div>
                </div>

                <div class="flex items-start justify-between gap-4">
                    <div class="space-y-0.5">
                        <Label for="retry-input" class="text-sm font-normal">Retry count</Label>
                        <p class="text-xs text-muted-foreground">
                            Times to retry a failed download before giving up
                        </p>
                    </div>
                    <div class="flex shrink-0 items-center">
                        <Button
                            variant="outline"
                            size="icon"
                            class="h-8 w-8 rounded-r-none"
                            {disabled}
                            onclick={() => {
                                retryCount = clamp(
                                    retryCount - 1,
                                    MIN_RETRY_COUNT,
                                    MAX_RETRY_COUNT_LIMIT
                                );
                            }}
                        >
                            <MinusIcon class="size-3" />
                        </Button>
                        <Input
                            id="retry-input"
                            type="number"
                            min={MIN_RETRY_COUNT}
                            max={MAX_RETRY_COUNT_LIMIT}
                            step={1}
                            bind:value={retryCount}
                            onblur={handleRetryBlur}
                            class="h-8 w-14 [appearance:textfield] rounded-none border-x-0 text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            {disabled}
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            class="h-8 w-8 rounded-l-none"
                            {disabled}
                            onclick={() => {
                                retryCount = clamp(
                                    retryCount + 1,
                                    MIN_RETRY_COUNT,
                                    MAX_RETRY_COUNT_LIMIT
                                );
                            }}
                        >
                            <PlusIcon class="size-3" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    </Collapsible.Content>
</Collapsible.Root>
