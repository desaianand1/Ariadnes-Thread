<script lang="ts">
    import { Skeleton } from '$lib/components/ui/skeleton';

    interface Props {
        count?: number;
    }

    let { count = 1 }: Props = $props();
</script>

{#each { length: count } as _, i (i)}
    <div class="flex items-center gap-3 rounded-md border px-3 py-2.5">
        <Skeleton class="size-2 shrink-0 rounded-full" />
        <Skeleton class="size-8 shrink-0 rounded-lg" />
        <div class="min-w-0 flex-1 space-y-1.5">
            <Skeleton class="h-4 w-1/2" />
            <Skeleton class="h-3 w-3/4" />
        </div>
        <Skeleton class="hidden h-5 w-16 rounded-full md:block" />
        <Skeleton class="hidden h-4 w-12 md:block" />
    </div>
{/each}
