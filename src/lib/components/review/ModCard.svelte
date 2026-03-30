<script lang="ts">
    import type { ResolvedProject, ResolutionWarning } from '$lib/services/types';
    import { Badge } from '$lib/components/ui/badge';
    import * as Card from '$lib/components/ui/card';
    import * as Avatar from '$lib/components/ui/avatar';
    import * as Tooltip from '$lib/components/ui/tooltip';
    import * as HoverCard from '$lib/components/ui/hover-card';
    import { getBadgeClassesByModLoader } from '$lib/utils/colors';
    import { formatBytes, formatNumber, getLoaderDisplayName } from '$lib/utils/format';
    import { fade, fly } from 'svelte/transition';
    import CheckIcon from '@lucide/svelte/icons/check';
    import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert';
    import XCircleIcon from '@lucide/svelte/icons/circle-x';
    import PackageIcon from '@lucide/svelte/icons/package';
    import ImageIcon from '@lucide/svelte/icons/image';
    import SparklesIcon from '@lucide/svelte/icons/sparkles';
    import DatabaseIcon from '@lucide/svelte/icons/database';
    import DownloadIcon from '@lucide/svelte/icons/download';
    import ScaleIcon from '@lucide/svelte/icons/scale';
    import CalendarIcon from '@lucide/svelte/icons/calendar';
    import FileIcon from '@lucide/svelte/icons/file';

    interface Props {
        project: ResolvedProject;
        warnings: ResolutionWarning[];
        isConflict: boolean;
        alsoIn?: string[];
        loader: string;
        index?: number;
    }

    let { project, warnings, isConflict, alsoIn, loader, index = 0 }: Props = $props();

    const PROJECT_TYPE_ICONS = {
        mod: PackageIcon,
        plugin: PackageIcon,
        resourcepack: ImageIcon,
        shader: SparklesIcon,
        datapack: DatabaseIcon,
        modpack: PackageIcon
    } as const;

    const SIDE_BADGE_CLASSES = {
        client: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        server: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        both: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    } as const;

    const VERSION_TYPE_BADGE_CLASSES = {
        beta: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        alpha: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    } as const;

    let TypeIcon = $derived(PROJECT_TYPE_ICONS[project.projectType] ?? PackageIcon);
    let sideLabel = $derived(project.side.charAt(0).toUpperCase() + project.side.slice(1));
    let hasWarnings = $derived(warnings.length > 0);
    let projectUrl = $derived(`https://modrinth.com/${project.projectType}/${project.projectSlug}`);
    let hasTier2 = $derived(
        !!(
            project.categories?.length ||
            project.downloads ||
            project.license ||
            project.datePublished
        )
    );

    function formatRelativeDate(dateStr: string): string {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'today';
        if (diffDays === 1) return 'yesterday';
        if (diffDays < 30) return `${diffDays}d ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
        return `${Math.floor(diffDays / 365)}y ago`;
    }
</script>

<div
    in:fly={{ y: 10, duration: 200, delay: Math.min(index * 50, 500) }}
    out:fade={{ duration: 150 }}
>
    <Card.Root class="relative overflow-hidden transition-shadow hover:shadow-md">
        <Card.Content class="flex gap-3 p-3">
            <!-- Project Icon -->
            <div class="shrink-0">
                <Avatar.Root class="size-10 rounded-lg">
                    {#if project.iconUrl}
                        <Avatar.Image src={project.iconUrl} alt={project.projectTitle} />
                    {/if}
                    <Avatar.Fallback class="rounded-lg text-sm">
                        {project.projectTitle.charAt(0)}
                    </Avatar.Fallback>
                </Avatar.Root>
            </div>

            <!-- Content -->
            <div class="min-w-0 flex-1">
                <!-- Title Row -->
                <div class="flex items-start justify-between gap-2">
                    {#if hasTier2}
                        <HoverCard.Root>
                            <HoverCard.Trigger
                                href={projectUrl}
                                target="_blank"
                                rel="noopener noreferrer external"
                                class="truncate font-semibold hover:underline"
                            >
                                {project.projectTitle}
                            </HoverCard.Trigger>
                            <HoverCard.Content class="w-72">
                                <div class="space-y-2">
                                    <p class="text-sm font-semibold">{project.projectTitle}</p>
                                    {#if project.categories && project.categories.length > 0}
                                        <div class="flex flex-wrap gap-1">
                                            {#each project.categories as cat (cat)}
                                                <Badge variant="secondary" class="text-[10px]"
                                                    >{cat}</Badge
                                                >
                                            {/each}
                                        </div>
                                    {/if}
                                    <div
                                        class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
                                    >
                                        {#if project.downloads != null}
                                            <span class="flex items-center gap-1">
                                                <DownloadIcon class="size-3" />
                                                {formatNumber(project.downloads)}
                                            </span>
                                        {/if}
                                        {#if project.license}
                                            <span class="flex items-center gap-1">
                                                <ScaleIcon class="size-3" />
                                                {project.license.name}
                                            </span>
                                        {/if}
                                        {#if project.datePublished}
                                            <span class="flex items-center gap-1">
                                                <CalendarIcon class="size-3" />
                                                {formatRelativeDate(project.datePublished)}
                                            </span>
                                        {/if}
                                        <span class="flex items-center gap-1">
                                            <FileIcon class="size-3" />
                                            {project.fileName}
                                        </span>
                                    </div>
                                </div>
                            </HoverCard.Content>
                        </HoverCard.Root>
                    {:else}
                        <a
                            href={projectUrl}
                            target="_blank"
                            rel="noopener noreferrer external"
                            class="truncate font-semibold hover:underline"
                        >
                            {project.projectTitle}
                        </a>
                    {/if}

                    <!-- Status indicator -->
                    <div class="shrink-0">
                        {#if isConflict}
                            <Tooltip.Root>
                                <Tooltip.Trigger>
                                    <XCircleIcon class="size-4 text-red-500" />
                                </Tooltip.Trigger>
                                <Tooltip.Content>Incompatible</Tooltip.Content>
                            </Tooltip.Root>
                        {:else if hasWarnings}
                            <Tooltip.Root>
                                <Tooltip.Trigger>
                                    <AlertTriangleIcon class="size-4 text-yellow-500" />
                                </Tooltip.Trigger>
                                <Tooltip.Content>{warnings[0].message}</Tooltip.Content>
                            </Tooltip.Root>
                        {:else}
                            <CheckIcon class="size-4 text-green-500" />
                        {/if}
                    </div>
                </div>

                <!-- Description -->
                {#if project.projectDescription}
                    <p class="line-clamp-1 text-sm text-muted-foreground">
                        {project.projectDescription}
                    </p>
                {:else}
                    <p class="line-clamp-1 text-sm text-muted-foreground italic">No description</p>
                {/if}

                <!-- Badges Row -->
                <div class="mt-1.5 flex flex-wrap items-center gap-1">
                    {#each project.loaders.filter((l) => l === loader || project.usedFallbackLoader) as loaderName (loaderName)}
                        <Badge
                            variant="secondary"
                            class="text-[10px] leading-tight {getBadgeClassesByModLoader(
                                loaderName
                            )}"
                        >
                            {getLoaderDisplayName(loaderName)}
                        </Badge>
                    {/each}

                    <Badge
                        variant="secondary"
                        class="text-[10px] leading-tight {SIDE_BADGE_CLASSES[project.side]}"
                    >
                        {sideLabel}
                    </Badge>

                    {#if project.versionType !== 'release'}
                        <Badge
                            variant="secondary"
                            class="text-[10px] leading-tight {VERSION_TYPE_BADGE_CLASSES[
                                project.versionType
                            ] ?? ''}"
                        >
                            {project.versionType}
                        </Badge>
                    {/if}

                    {#if project.usedFallbackLoader && project.resolvedLoader}
                        <Badge variant="outline" class="text-[10px] leading-tight">
                            via {getLoaderDisplayName(project.resolvedLoader)}
                        </Badge>
                    {/if}

                    <Tooltip.Root>
                        <Tooltip.Trigger class="ml-auto">
                            <TypeIcon class="size-3.5 text-muted-foreground" />
                        </Tooltip.Trigger>
                        <Tooltip.Content>{project.projectType}</Tooltip.Content>
                    </Tooltip.Root>
                </div>

                <!-- Metadata Row -->
                <div class="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{project.versionNumber || 'Unknown'}</span>
                    <span>&middot;</span>
                    <span>{project.fileSize ? formatBytes(project.fileSize) : 'Unknown size'}</span>
                    {#if project.dependencyCount > 0}
                        <span>&middot;</span>
                        <span>{project.dependencyCount} deps</span>
                    {/if}
                </div>

                <!-- Inline warning -->
                {#if hasWarnings}
                    <div
                        class="mt-1.5 rounded bg-yellow-50 px-2 py-1 text-xs text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                    >
                        {warnings[0].message}
                    </div>
                {/if}

                <!-- Dependency annotation -->
                {#if project.dependencyOf}
                    <div class="mt-1 text-xs text-muted-foreground italic">
                        dependency of: {project.dependencyOf}
                    </div>
                {/if}

                <!-- Also in -->
                {#if alsoIn && alsoIn.length > 0}
                    <div class="mt-1 text-xs text-muted-foreground">
                        Also in: {alsoIn.join(', ')}
                    </div>
                {/if}
            </div>
        </Card.Content>
    </Card.Root>
</div>
