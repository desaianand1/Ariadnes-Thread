<script lang="ts">
    import type { SideClassification } from '$lib/services/types';
    import { Badge } from '$lib/components/ui/badge';
    import { SIDE_BADGE_CLASSES, SIDE_LABELS } from '$lib/utils/colors';
    import { cn } from '$lib/utils';
    import MonitorIcon from '@lucide/svelte/icons/monitor';
    import ServerIcon from '@lucide/svelte/icons/server';
    import LayersIcon from '@lucide/svelte/icons/layers';

    interface Props {
        side: SideClassification;
        size?: 'sm' | 'default';
    }

    let { side, size = 'default' }: Props = $props();

    const SIDE_ICONS = {
        client: MonitorIcon,
        server: ServerIcon,
        both: LayersIcon
    } as const;

    let Icon = $derived(SIDE_ICONS[side]);
    let iconSize = $derived(size === 'sm' ? 'size-2.5' : 'size-3');
    let textSize = $derived(
        size === 'sm' ? 'text-[9px] leading-tight' : 'text-[10px] leading-tight'
    );
</script>

<Badge variant="secondary" class={cn('gap-1', textSize, SIDE_BADGE_CLASSES[side])}>
    <Icon class={iconSize} />
    {SIDE_LABELS[side]}
</Badge>
