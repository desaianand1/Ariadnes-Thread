<script lang="ts">
    import type { ResolvedProject, ResolutionWarning } from '$lib/services/types';
    import * as Sheet from '$lib/components/ui/sheet';
    import * as Tabs from '$lib/components/ui/tabs';
    import ModAvatar from './ModAvatar.svelte';
    import * as ScrollArea from '$lib/components/ui/scroll-area';
    import ExcludeConfirmDialog from './ExcludeConfirmDialog.svelte';
    import * as Empty from '$lib/components/ui/empty';
    import { Badge } from '$lib/components/ui/badge';
    import { Button } from '$lib/components/ui/button';
    import ModBadgeRow from './ModBadgeRow.svelte';
    import ModrinthWordmark from '$lib/components/icons/ModrinthWordmark.svelte';
    import {
        SEMANTIC_BANNER_COLORS,
        ENVIRONMENT_DISPLAY_LABELS,
        decimalToHex
    } from '$lib/utils/colors';
    import {
        formatSlugToReadableText,
        formatBytes,
        formatNumber,
        formatRelativeTime,
        formatFullDate,
        getModrinthProjectUrl,
        getLoaderDisplayName
    } from '$lib/utils/format';
    import * as Tooltip from '$lib/components/ui/tooltip';
    import { renderMarkdown } from '$lib/utils/markdown';
    import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
    import DownloadIcon from '@lucide/svelte/icons/download';
    import EyeOffIcon from '@lucide/svelte/icons/eye-off';
    import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
    import CopyIcon from '@lucide/svelte/icons/copy';
    import FileTextIcon from '@lucide/svelte/icons/file-text';
    import CheckIcon from '@lucide/svelte/icons/check';
    import { SiModrinth } from '@icons-pack/svelte-simple-icons';
    import { copyToClipboard } from '$lib/utils/clipboard';
    import { toast } from 'svelte-sonner';
    import { TOAST_DURATION } from '$lib/config/constants';
    import { scale } from 'svelte/transition';
    import { safeTransition } from '$lib/utils/motion';

    interface Props {
        open: boolean;
        project: ResolvedProject | null;
        warnings: ResolutionWarning[];
        isExcluded: boolean;
        loader: string;
        resolvedDependencies?: { title: string; iconUrl?: string }[];
        onExclude?: (id: string) => void;
        onClose: () => void;
    }

    let {
        open = $bindable(),
        project,
        warnings,
        isExcluded,
        loader,
        resolvedDependencies = [],
        onExclude,
        onClose
    }: Props = $props();

    let copiedHash = $state(false);
    let activeTab = $state('overview');

    let projectUrl = $derived(
        project ? getModrinthProjectUrl(project.projectType, project.projectSlug) : '#'
    );
    let renderedChangelog = $state('');

    $effect(() => {
        const changelog = project?.changelog;
        if (!changelog) {
            renderedChangelog = '';
            return;
        }
        let stale = false;
        renderMarkdown(changelog).then((html) => {
            if (!stale) renderedChangelog = html;
        });
        return () => {
            stale = true;
        };
    });
    let hasChangelog = $derived(!!project?.changelog?.trim());
    let hasGallery = $derived(!!project?.gallery?.length);

    let accentColor = $derived(project?.color ? decimalToHex(project.color) : undefined);

    async function copyHash() {
        if (!project) return;
        await copyToClipboard(project.fileHashes.sha512);
        copiedHash = true;
        toast.success('Hash copied to clipboard', { duration: TOAST_DURATION.SUCCESS });
        setTimeout(() => (copiedHash = false), 2000);
    }

    $effect(() => {
        if (project) {
            copiedHash = false;
            activeTab = 'overview';
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
                        <ModAvatar
                            iconUrl={project.iconUrl}
                            title={project.projectTitle}
                            size="lg"
                            rounding="rounded-xl"
                        />
                    </div>
                    <div class="min-w-0 flex-1">
                        <Sheet.Title class="text-xl">{project.projectTitle}</Sheet.Title>
                        <Sheet.Description class="line-clamp-3">
                            {project.projectDescription || 'No description'}
                        </Sheet.Description>
                    </div>
                </div>

                <!-- Categories below description -->
                {#if project.categories && project.categories.length > 0}
                    <div class="mt-3 flex flex-wrap gap-1">
                        {#each project.categories as cat (cat)}
                            <Badge variant="outline" class="text-xs"
                                >{formatSlugToReadableText(cat)}</Badge
                            >
                        {/each}
                    </div>
                {/if}
            </Sheet.Header>

            <div class="space-y-5 px-6 pb-20">
                <!-- Badge row with Modrinth link -->
                <div class="flex flex-wrap items-center gap-2">
                    <ModBadgeRow {project} {loader} class="gap-2" />

                    <a
                        href={projectUrl}
                        target="_blank"
                        rel="noopener noreferrer external"
                        class="ml-auto inline-flex items-center gap-2 rounded-full border border-modrinth/30 bg-modrinth px-3 py-1.5 text-sm text-white transition-colors hover:contrast-85 dark:border-modrinth/20 dark:bg-modrinth/5 dark:text-modrinth dark:hover:contrast-150"
                    >
                        <SiModrinth class="size-3 text-white dark:text-modrinth/70" />

                        Visit
                        <ExternalLinkIcon class="size-3 text-white/70 dark:text-modrinth/70" />
                    </a>
                </div>

                <!-- Warnings -->
                {#if warnings.length > 0}
                    <div
                        class="rounded-md px-3 py-2 text-sm {SEMANTIC_BANNER_COLORS.warning
                            .bg} {SEMANTIC_BANNER_COLORS.warning.text}"
                    >
                        {#each warnings as w (w.type)}
                            <p>{w.message}</p>
                        {/each}
                    </div>
                {/if}

                <!-- Gallery (always visible, above tabs) -->
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

                <!-- Tab-based content -->
                <Tabs.Root bind:value={activeTab} class="mt-4">
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
                            <!-- Compatibility -->
                            <div class="col-span-2 rounded-lg bg-muted/50 p-3">
                                <span class="text-xs text-muted-foreground">Compatibility</span>
                                <div class="mt-1 flex flex-wrap items-center gap-1.5">
                                    <Badge
                                        variant="secondary"
                                        class="text-xs {project.versionType === 'release'
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                                            : project.versionType === 'beta'
                                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                                              : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300'}"
                                    >
                                        {project.versionType === 'release'
                                            ? 'Release'
                                            : project.versionType === 'beta'
                                              ? 'Beta'
                                              : 'Alpha'}
                                    </Badge>
                                    {#if project.usedFallbackLoader && project.resolvedLoader}
                                        <Badge variant="outline" class="text-xs">
                                            Via {getLoaderDisplayName(project.resolvedLoader)}
                                        </Badge>
                                    {/if}
                                    {#if project.environment && project.environment !== 'unknown'}
                                        <Badge variant="outline" class="text-xs">
                                            {ENVIRONMENT_DISPLAY_LABELS[project.environment]}
                                        </Badge>
                                    {/if}
                                    {#if warnings.length > 0}
                                        <span class="text-xs text-amber-600 dark:text-amber-400">
                                            {warnings[0].message}
                                        </span>
                                    {/if}
                                </div>
                            </div>
                            <!-- Dependencies: compact list or count -->
                            <div class="col-span-2 rounded-lg bg-muted/50 p-3">
                                <span class="text-xs text-muted-foreground">Dependencies</span>
                                {#if resolvedDependencies.length > 0}
                                    <div class="mt-1.5 space-y-1">
                                        {#each resolvedDependencies as dep (dep.title)}
                                            <div class="flex items-center gap-2">
                                                <ModAvatar
                                                    iconUrl={dep.iconUrl}
                                                    title={dep.title}
                                                    size="xs"
                                                    rounding="rounded-md"
                                                />
                                                <span class="text-sm">{dep.title}</span>
                                            </div>
                                        {/each}
                                    </div>
                                {:else}
                                    <p class="text-sm font-medium">
                                        {project.dependencyCount > 0
                                            ? `${project.dependencyCount} required`
                                            : 'None'}
                                    </p>
                                {/if}
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
                                {@const lastUpdated = project.lastUpdated}
                                <div class="rounded-lg bg-muted/50 p-3">
                                    <span class="text-xs text-muted-foreground">Updated</span>
                                    <Tooltip.Root>
                                        <Tooltip.Trigger>
                                            {#snippet child({ props })}
                                                <p
                                                    class="w-fit cursor-default text-sm font-medium"
                                                    {...props}
                                                >
                                                    {formatRelativeTime(lastUpdated)}
                                                </p>
                                            {/snippet}
                                        </Tooltip.Trigger>
                                        <Tooltip.Content
                                            >{formatFullDate(lastUpdated)}</Tooltip.Content
                                        >
                                    </Tooltip.Root>
                                </div>
                            {/if}
                        </div>
                    </Tabs.Content>

                    <!-- Changelog Tab -->
                    {#if hasChangelog}
                        <Tabs.Content value="changelog" class="pt-4">
                            {#if renderedChangelog}
                                <ScrollArea.Root class="max-h-[60vh]">
                                    <div
                                        class="prose prose-sm max-w-none dark:prose-invert prose-headings:text-base prose-headings:font-semibold prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-li:text-sm prose-img:rounded-md"
                                    >
                                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                        {@html renderedChangelog}
                                    </div>
                                </ScrollArea.Root>
                            {:else}
                                <Empty.Root>
                                    <Empty.Header>
                                        <Empty.Media variant="icon">
                                            <FileTextIcon />
                                        </Empty.Media>
                                        <Empty.Title>No changelog</Empty.Title>
                                        <Empty.Description>
                                            This version doesn't have changelog details.
                                        </Empty.Description>
                                    </Empty.Header>
                                </Empty.Root>
                            {/if}
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
                                    <Tooltip.Root>
                                        <Tooltip.Trigger>
                                            {#snippet child({ props })}
                                                <code
                                                    class="flex-1 cursor-default truncate rounded bg-muted px-2 py-1 font-mono text-xs"
                                                    {...props}
                                                >
                                                    {project.fileHashes.sha512.slice(0, 32)}...
                                                </code>
                                            {/snippet}
                                        </Tooltip.Trigger>
                                        <Tooltip.Content
                                            class="max-w-80 font-mono text-[10px] break-all"
                                        >
                                            {project.fileHashes.sha512}
                                        </Tooltip.Content>
                                    </Tooltip.Root>
                                    <Tooltip.Root>
                                        <Tooltip.Trigger>
                                            {#snippet child({ props })}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    class="size-7 shrink-0 p-0"
                                                    {...props}
                                                    onclick={copyHash}
                                                >
                                                    {#if copiedHash}
                                                        <span
                                                            in:scale={safeTransition({
                                                                duration: 200,
                                                                start: 0.5
                                                            })}
                                                        >
                                                            <CheckIcon
                                                                class="size-3.5 text-emerald-500"
                                                            />
                                                        </span>
                                                    {:else}
                                                        <CopyIcon class="size-3.5" />
                                                    {/if}
                                                </Button>
                                            {/snippet}
                                        </Tooltip.Trigger>
                                        <Tooltip.Content>
                                            {copiedHash ? 'Copied!' : 'Copy SHA-512 hash'}
                                        </Tooltip.Content>
                                    </Tooltip.Root>
                                </div>
                            </div>

                            <div class="space-y-1 pt-4">
                                <!-- Modrinth download button -->
                                <a
                                    href={project.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer external"
                                >
                                    <span
                                        class="flex items-center justify-center gap-2 rounded-full border border-modrinth/30 bg-modrinth px-2 py-2.5 font-medium text-white transition-colors
                            hover:contrast-85 dark:border-modrinth/20 dark:bg-modrinth/5 dark:text-modrinth dark:hover:contrast-150"
                                    >
                                        <DownloadIcon class="size-4" />
                                        Download from
                                        <ModrinthWordmark
                                            class="h-4 w-auto fill-white text-white dark:fill-modrinth dark:text-modrinth"
                                        />
                                    </span>
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
                        <ExcludeConfirmDialog
                            projectTitle={project.projectTitle}
                            onConfirm={() => onExclude(project.projectId)}
                        >
                            {#snippet trigger({ props })}
                                <Button
                                    variant="outline"
                                    class="w-full text-destructive hover:text-destructive"
                                    {...props}
                                >
                                    <EyeOffIcon class="mr-2 size-4" />
                                    Exclude from download
                                </Button>
                            {/snippet}
                        </ExcludeConfirmDialog>
                    {/if}
                {/if}
            </Sheet.Footer>
        {/if}
    </Sheet.Content>
</Sheet.Root>
