<script lang="ts">
    import type { ResolvedProject, ResolutionWarning } from '$lib/services/types';
    import * as Sheet from '$lib/components/ui/sheet';
    import * as Avatar from '$lib/components/ui/avatar';
    import * as Tabs from '$lib/components/ui/tabs';
    import * as ScrollArea from '$lib/components/ui/scroll-area';
    import * as AlertDialog from '$lib/components/ui/alert-dialog';
    import { Badge } from '$lib/components/ui/badge';
    import { Button } from '$lib/components/ui/button';
    import SideBadge from './SideBadge.svelte';
    import LoaderBadge from './LoaderBadge.svelte';
    import ModrinthWordmark from '$lib/components/icons/ModrinthWordmark.svelte';
    import { VERSION_TYPE_BADGE_CLASSES, decimalToHex } from '$lib/utils/colors';
    import {
        formatBytes,
        formatNumber,
        formatRelativeTime,
        getLoaderDisplayName
    } from '$lib/utils/format';
    import { cn } from '$lib/utils';
    import { marked } from 'marked';
    import DOMPurify from 'isomorphic-dompurify';
    import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
    import DownloadIcon from '@lucide/svelte/icons/download';
    import EyeOffIcon from '@lucide/svelte/icons/eye-off';
    import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
    import CopyIcon from '@lucide/svelte/icons/copy';
    import CheckIcon from '@lucide/svelte/icons/check';

    interface Props {
        open: boolean;
        project: ResolvedProject | null;
        warnings: ResolutionWarning[];
        isExcluded: boolean;
        loader: string;
        onExclude?: (id: string) => void;
        onClose: () => void;
    }

    let {
        open = $bindable(),
        project,
        warnings,
        isExcluded,
        loader,
        onExclude,
        onClose
    }: Props = $props();

    let copiedHash = $state(false);

    let projectUrl = $derived(
        project ? `https://modrinth.com/${project.projectType}/${project.projectSlug}` : '#'
    );
    let renderedChangelog = $derived(
        project?.changelog
            ? DOMPurify.sanitize(marked.parse(project.changelog, { async: false }) as string)
            : ''
    );
    let hasChangelog = $derived(!!project?.changelog?.trim());
    let hasGallery = $derived(!!project?.gallery?.length);

    let accentColor = $derived(project?.color ? decimalToHex(project.color) : undefined);

    function copyHash() {
        if (!project) return;
        navigator.clipboard.writeText(project.fileHashes.sha512);
        copiedHash = true;
        setTimeout(() => (copiedHash = false), 2000);
    }

    $effect(() => {
        if (project) {
            copiedHash = false;
        }
    });
</script>

<Sheet.Root bind:open onOpenChange={(v) => !v && onClose()}>
    <Sheet.Content side="right" class="w-105 overflow-y-auto sm:max-w-105">
        {#if project}
            <Sheet.Header>
                <div class="flex items-start gap-3">
                    <div
                        class="shrink-0 rounded-xl ring-2"
                        style="--tw-ring-color: {accentColor ?? 'transparent'}"
                    >
                        <Avatar.Root class="size-16 rounded-xl">
                            {#if project.iconUrl}
                                <Avatar.Image src={project.iconUrl} alt={project.projectTitle} />
                            {/if}
                            <Avatar.Fallback class="rounded-xl text-lg">
                                {project.projectTitle.charAt(0)}
                            </Avatar.Fallback>
                        </Avatar.Root>
                    </div>
                    <div class="min-w-0 flex-1">
                        <Sheet.Title class="text-xl">{project.projectTitle}</Sheet.Title>
                        <Sheet.Description class="line-clamp-3">
                            {project.projectDescription || 'No description'}
                        </Sheet.Description>
                    </div>
                </div>
            </Sheet.Header>

            <div class="space-y-5 px-6 pb-20">
                <!-- Modrinth branded pill -->
                <a
                    href={projectUrl}
                    target="_blank"
                    rel="noopener noreferrer external"
                    class="inline-flex items-center gap-2 rounded-full border border-[#1bd96a]/30 bg-[#1bd96a]/5 px-3 py-1 text-sm transition-colors hover:bg-[#1bd96a]/10 dark:border-[#1bd96a]/20 dark:bg-[#1bd96a]/5"
                >
                    <ModrinthWordmark class="h-3.5 w-auto text-[#1bd96a]" />
                    <ExternalLinkIcon class="size-3 text-[#1bd96a]/70" />
                </a>

                <!-- Badge row -->
                <div class="flex flex-wrap items-center gap-2">
                    <SideBadge side={project.side} />
                    {#each project.loaders.filter((l) => l === loader || project.usedFallbackLoader) as loaderName (loaderName)}
                        <LoaderBadge loaderSlug={loaderName} />
                    {/each}
                    {#if project.versionType !== 'release'}
                        <Badge
                            variant="secondary"
                            class={cn(
                                'text-[10px]',
                                VERSION_TYPE_BADGE_CLASSES[project.versionType]
                            )}
                        >
                            {project.versionType}
                        </Badge>
                    {/if}
                    {#if project.usedFallbackLoader && project.resolvedLoader}
                        <Badge variant="outline" class="text-[10px]">
                            via {getLoaderDisplayName(project.resolvedLoader)}
                        </Badge>
                    {/if}
                </div>

                <!-- Warnings -->
                {#if warnings.length > 0}
                    <div
                        class="rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                    >
                        {#each warnings as w (w.type)}
                            <p>{w.message}</p>
                        {/each}
                    </div>
                {/if}

                <!-- Tab-based content -->
                <Tabs.Root value="overview" class="mt-4">
                    <Tabs.List class="w-full">
                        <Tabs.Trigger value="overview" class="flex-1">Overview</Tabs.Trigger>
                        {#if hasChangelog}
                            <Tabs.Trigger value="changelog" class="flex-1">Changelog</Tabs.Trigger>
                        {/if}
                        <Tabs.Trigger value="files" class="flex-1">Files</Tabs.Trigger>
                    </Tabs.List>

                    <!-- Overview Tab -->
                    <Tabs.Content value="overview" class="space-y-4 pt-4">
                        <!-- Stats grid -->
                        <div class="grid grid-cols-2 gap-2">
                            <div class="rounded-lg bg-muted/50 p-3">
                                <span class="text-xs text-muted-foreground">Version</span>
                                <p class="font-mono text-sm font-medium">{project.versionNumber}</p>
                            </div>
                            <div class="rounded-lg bg-muted/50 p-3">
                                <span class="text-xs text-muted-foreground">File Size</span>
                                <p class="text-sm font-medium">{formatBytes(project.fileSize)}</p>
                            </div>
                            <div class="rounded-lg bg-muted/50 p-3">
                                <span class="text-xs text-muted-foreground">Dependencies</span>
                                <p class="text-sm font-medium">
                                    {project.dependencyCount > 0
                                        ? `${project.dependencyCount} required`
                                        : 'None'}
                                </p>
                            </div>
                            {#if project.downloadCount != null}
                                <div class="rounded-lg bg-muted/50 p-3">
                                    <span class="text-xs text-muted-foreground">Downloads</span>
                                    <p class="text-sm font-medium">
                                        {formatNumber(project.downloadCount)}
                                    </p>
                                </div>
                            {/if}
                            {#if project.licenseName}
                                <div class="rounded-lg bg-muted/50 p-3">
                                    <span class="text-xs text-muted-foreground">License</span>
                                    <p class="text-sm font-medium">
                                        {#if project.licenseUrl}
                                            <a
                                                href={project.licenseUrl}
                                                target="_blank"
                                                rel="noopener noreferrer external"
                                                class="text-primary hover:underline"
                                            >
                                                {project.licenseName}
                                            </a>
                                        {:else}
                                            {project.licenseName}
                                        {/if}
                                    </p>
                                </div>
                            {/if}
                            {#if project.lastUpdated}
                                <div class="rounded-lg bg-muted/50 p-3">
                                    <span class="text-xs text-muted-foreground">Updated</span>
                                    <p class="text-sm font-medium">
                                        {formatRelativeTime(project.lastUpdated)}
                                    </p>
                                </div>
                            {/if}
                        </div>

                        <!-- Categories -->
                        {#if project.categories && project.categories.length > 0}
                            <div class="flex flex-wrap gap-1">
                                {#each project.categories as cat (cat)}
                                    <Badge variant="outline" class="text-xs">{cat}</Badge>
                                {/each}
                            </div>
                        {/if}

                        <!-- Gallery -->
                        {#if hasGallery}
                            <div class="space-y-2">
                                <h4 class="text-sm font-medium">Gallery</h4>
                                <ScrollArea.Root class="w-full" orientation="horizontal">
                                    <div class="flex gap-2">
                                        {#each project.gallery! as image (image.url)}
                                            <a
                                                href={image.url}
                                                target="_blank"
                                                rel="noopener noreferrer external"
                                                class="shrink-0"
                                            >
                                                <img
                                                    src={image.url}
                                                    alt={image.title ?? 'Gallery image'}
                                                    class="h-32 w-auto rounded-md border object-cover transition-opacity hover:opacity-80"
                                                />
                                                {#if image.title}
                                                    <p
                                                        class="mt-1 max-w-40 truncate text-xs text-muted-foreground"
                                                    >
                                                        {image.title}
                                                    </p>
                                                {/if}
                                            </a>
                                        {/each}
                                    </div>
                                </ScrollArea.Root>
                            </div>
                        {/if}
                    </Tabs.Content>

                    <!-- Changelog Tab -->
                    {#if hasChangelog}
                        <Tabs.Content value="changelog" class="pt-4">
                            <ScrollArea.Root class="max-h-[60vh]">
                                <div class="prose prose-sm dark:prose-invert max-w-none">
                                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                    {@html renderedChangelog}
                                </div>
                            </ScrollArea.Root>
                        </Tabs.Content>
                    {/if}

                    <!-- Files Tab -->
                    <Tabs.Content value="files" class="space-y-3 pt-4">
                        <div class="space-y-2 text-sm">
                            <div class="flex items-center justify-between">
                                <span class="font-medium">Filename</span>
                                <span class="truncate text-muted-foreground"
                                    >{project.fileName}</span
                                >
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="font-medium">Size</span>
                                <span class="text-muted-foreground"
                                    >{formatBytes(project.fileSize)}</span
                                >
                            </div>
                            <div class="space-y-1">
                                <span class="font-medium">SHA-512</span>
                                <div class="flex items-center gap-2">
                                    <code
                                        class="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs"
                                    >
                                        {project.fileHashes.sha512.slice(0, 32)}...
                                    </code>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        class="size-7 shrink-0 p-0"
                                        onclick={copyHash}
                                    >
                                        {#if copiedHash}
                                            <CheckIcon class="size-3.5 text-emerald-500" />
                                        {:else}
                                            <CopyIcon class="size-3.5" />
                                        {/if}
                                    </Button>
                                </div>
                            </div>
                            <div class="pt-2">
                                <a
                                    href={project.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer external"
                                    class="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                                >
                                    <DownloadIcon class="size-3.5" />
                                    Direct download link
                                </a>
                            </div>
                        </div>
                    </Tabs.Content>
                </Tabs.Root>
            </div>

            <!-- Sticky action bar -->
            <Sheet.Footer
                class="sticky bottom-0 border-t bg-background/95 px-6 py-3 backdrop-blur-sm"
            >
                {#if onExclude && project}
                    {#if isExcluded}
                        <Button
                            variant="default"
                            class="w-full"
                            onclick={() => onExclude(project.projectId)}
                        >
                            <RotateCcwIcon class="mr-2 size-4" />
                            Restore to download
                        </Button>
                    {:else}
                        <AlertDialog.Root>
                            <AlertDialog.Trigger>
                                {#snippet child({ props })}
                                    <Button
                                        variant="outline"
                                        class="w-full text-destructive hover:text-destructive"
                                        {...props}
                                    >
                                        <EyeOffIcon class="mr-2 size-4" />
                                        Exclude from download
                                    </Button>
                                {/snippet}
                            </AlertDialog.Trigger>
                            <AlertDialog.Content>
                                <AlertDialog.Header>
                                    <AlertDialog.Title
                                        >Exclude {project.projectTitle}?</AlertDialog.Title
                                    >
                                    <AlertDialog.Description>
                                        This mod won't be included in the ZIP download. You can
                                        restore it anytime.
                                    </AlertDialog.Description>
                                </AlertDialog.Header>
                                <AlertDialog.Footer>
                                    <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                                    <AlertDialog.Action
                                        onclick={() => onExclude(project.projectId)}
                                    >
                                        Exclude
                                    </AlertDialog.Action>
                                </AlertDialog.Footer>
                            </AlertDialog.Content>
                        </AlertDialog.Root>
                    {/if}
                {/if}
            </Sheet.Footer>
        {/if}
    </Sheet.Content>
</Sheet.Root>
