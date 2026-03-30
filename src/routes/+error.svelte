<script lang="ts">
    import { page } from '$app/state';
    import { Button } from '$lib/components/ui/button';
    import * as Empty from '$lib/components/ui/empty';
    import HomeIcon from '@lucide/svelte/icons/house';
    import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
    import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';
    import SearchXIcon from '@lucide/svelte/icons/search-x';

    let status = $derived(page.status);
    let message = $derived(page.error?.message ?? 'Something went wrong');

    let is404 = $derived(status === 404);
    let isServerError = $derived(status >= 500);
</script>

<svelte:head>
    <title>{status} — Ariadne's Thread</title>
</svelte:head>

<div class="flex min-h-[60vh] items-center justify-center px-4">
    <Empty.Root class="border-none">
        <Empty.Header>
            <Empty.Media>
                {#if is404}
                    <SearchXIcon class="size-16 text-muted-foreground" />
                {:else}
                    <AlertCircleIcon class="size-16 text-muted-foreground" />
                {/if}
            </Empty.Media>
            <Empty.Title class="text-4xl font-bold tracking-tight">{status}</Empty.Title>
            <Empty.Description class="text-lg">
                {#if is404}
                    The page you're looking for doesn't exist or has been moved.
                {:else if isServerError}
                    Something went wrong on our end. Please try again later.
                {:else}
                    {message}
                {/if}
            </Empty.Description>
        </Empty.Header>
        <Empty.Content>
            <div class="flex gap-3">
                {#if isServerError}
                    <Button variant="outline" onclick={() => location.reload()}>
                        <RefreshCwIcon class="mr-2 size-4" />
                        Try again
                    </Button>
                {/if}
                <Button href="/">
                    <HomeIcon class="mr-2 size-4" />
                    Back to home
                </Button>
            </div>
        </Empty.Content>
    </Empty.Root>
</div>
