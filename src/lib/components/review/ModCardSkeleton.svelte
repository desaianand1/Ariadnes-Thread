<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<Card.Root class="overflow-hidden">
    <Card.Content class="flex gap-3 p-3">
        <!-- Avatar -->
        <Skeleton class="size-10 shrink-0 rounded-lg" />

        <!-- Content -->
        <div class="min-w-0 flex-1 space-y-2">
            <Skeleton class="h-4 w-2/3" />
            <Skeleton class="h-3 w-full" />
            <div class="flex gap-1">
                <Skeleton class="h-4 w-12 rounded-full" />
                <Skeleton class="h-4 w-10 rounded-full" />
                <Skeleton class="h-4 w-14 rounded-full" />
            </div>
        </div>
    </Card.Content>
</Card.Root>
