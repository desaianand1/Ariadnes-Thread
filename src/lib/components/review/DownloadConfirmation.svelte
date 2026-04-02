<script lang="ts">
    import type { ResolvedProject } from '$lib/services/types';
    import { ResponsiveModal } from '$lib/components/ui/responsive-modal';
    import { Button } from '$lib/components/ui/button';
    import { formatBytes } from '$lib/utils/format';
    import DownloadIcon from '@lucide/svelte/icons/download';
    import MonitorIcon from '@lucide/svelte/icons/monitor';
    import ServerIcon from '@lucide/svelte/icons/server';

    interface Props {
        open: boolean;
        side: 'client' | 'server';
        projects: ResolvedProject[];
        onConfirm: () => void;
        onClose: () => void;
    }

    let { open = $bindable(), side, projects, onConfirm, onClose }: Props = $props();

    interface FolderEntry {
        path: string;
        fileCount: number;
        totalSize: number;
    }

    let sideProjects = $derived(projects.filter((p) => p.side === side || p.side === 'both'));

    let folderTree = $derived.by(() => {
        // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local computation, not reactive state
        const folders = new Map<string, FolderEntry>();
        for (const p of sideProjects) {
            const folder = `/${p.folder}`;
            const existing = folders.get(folder);
            if (existing) {
                existing.fileCount++;
                existing.totalSize += p.fileSize;
            } else {
                folders.set(folder, { path: folder, fileCount: 1, totalSize: p.fileSize });
            }
        }
        return [...folders.values()].sort((a, b) => b.fileCount - a.fileCount);
    });

    let totalFiles = $derived(folderTree.reduce((sum, f) => sum + f.fileCount, 0));
    let totalSize = $derived(folderTree.reduce((sum, f) => sum + f.totalSize, 0));
</script>

<ResponsiveModal bind:open {onClose}>
    {#snippet title()}
        <span class="flex items-center gap-2">
            {#if side === 'client'}
                <MonitorIcon class="size-5" />
                Download Mods
            {:else}
                <ServerIcon class="size-5" />
                Download Server Mods
            {/if}
        </span>
    {/snippet}

    {#snippet description()}
        {side === 'client' ? 'For your .minecraft folder' : 'For dedicated servers'}
    {/snippet}

    <div class="space-y-4 py-4">
        <!-- Folder tree -->
        <div class="rounded-lg border bg-muted/30 p-4">
            <p class="mb-2 text-sm font-medium">Your ZIP will contain:</p>
            <div class="space-y-1.5 font-mono text-sm">
                {#each folderTree as folder, i (folder.path)}
                    <div class="flex items-center gap-2">
                        <span class="text-muted-foreground">
                            {i === folderTree.length - 1 ? '└─' : '├─'}
                        </span>
                        <span class="font-medium">{folder.path}</span>
                        <span class="ml-auto text-xs text-muted-foreground">
                            {folder.fileCount} file{folder.fileCount !== 1 ? 's' : ''}
                            · {formatBytes(folder.totalSize)}
                        </span>
                    </div>
                {/each}
            </div>
            <div class="mt-3 border-t pt-2 text-sm">
                <span class="font-medium">{totalFiles} files</span>
                <span class="text-muted-foreground"> · {formatBytes(totalSize)} total</span>
            </div>
        </div>

        <p class="text-sm text-muted-foreground">
            After downloading, extract the ZIP contents into your game folder. Detailed instructions
            will be shown after the download completes.
        </p>
    </div>

    {#snippet footer()}
        <Button variant="outline" onclick={onClose}>Cancel</Button>
        <Button class="bg-emerald-600 text-white hover:bg-emerald-700" onclick={onConfirm}>
            <DownloadIcon class="mr-1.5 size-4" />
            Start Download
        </Button>
    {/snippet}
</ResponsiveModal>
