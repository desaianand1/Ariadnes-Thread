<script lang="ts">
    import { page } from '$app/state';
    import { Button } from '$lib/components/ui/button';
    import * as Empty from '$lib/components/ui/empty';
    import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';
    import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';

    let status = $derived(page.status);
    let message = $derived(page.error?.message ?? 'Something went wrong');
</script>

<svelte:head>
    <title>{status} — Ariadne's Thread</title>
</svelte:head>

<div class="flex min-h-[60vh] items-center justify-center px-4">
    <Empty.Root class="border-none">
        <Empty.Header>
            <Empty.Media>
                <AlertCircleIcon class="size-16 text-muted-foreground" />
            </Empty.Media>
            <Empty.Title class="text-4xl font-bold tracking-tight">{status}</Empty.Title>
            <Empty.Description class="max-w-md text-lg">
                {message}
            </Empty.Description>
        </Empty.Header>
        <Empty.Content>
            <Button href="/">
                <ArrowLeftIcon class="mr-2 size-4" />
                Back to home
            </Button>
        </Empty.Content>
    </Empty.Root>
</div>
