<script lang="ts">
    import type { ResolvedProject } from '$lib/services/types';
    import * as Collapsible from '$lib/components/ui/collapsible';
    import { Badge } from '$lib/components/ui/badge';
    import { Button } from '$lib/components/ui/button';
    import * as ScrollArea from '$lib/components/ui/scroll-area';
    import { marked } from 'marked';
    import DOMPurify from 'isomorphic-dompurify';
    import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
    import FileTextIcon from '@lucide/svelte/icons/file-text';
    import FileIcon from '@lucide/svelte/icons/file';
    import ImageIcon from '@lucide/svelte/icons/image';
    import CopyIcon from '@lucide/svelte/icons/copy';
    import CheckIcon from '@lucide/svelte/icons/check';
    import { formatBytes } from '$lib/utils/format';
    import { cn } from '$lib/utils';

    interface Props {
        project: ResolvedProject;
    }

    let { project }: Props = $props();

    let changelogOpen = $state(false);
    let fileInfoOpen = $state(false);
    let galleryOpen = $state(false);
    let copiedHash = $state(false);

    let renderedChangelog = $derived(
        project.changelog
            ? DOMPurify.sanitize(marked.parse(project.changelog, { async: false }) as string)
            : ''
    );

    function copyHash() {
        navigator.clipboard.writeText(project.fileHashes.sha512);
        copiedHash = true;
        setTimeout(() => (copiedHash = false), 2000);
    }

    let hasChangelog = $derived(!!project.changelog?.trim());
    let hasGallery = $derived(!!project.gallery?.length);
</script>

<div class="space-y-1 border-t pt-2">
    <!-- Changelog Section -->
    {#if hasChangelog}
        <Collapsible.Root bind:open={changelogOpen}>
            <Collapsible.Trigger
                class="flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted/50"
            >
                <ChevronRightIcon
                    class="size-3.5 text-muted-foreground transition-transform duration-200 {changelogOpen
                        ? 'rotate-90'
                        : ''}"
                />
                <FileTextIcon class="size-3.5 text-muted-foreground" />
                <span>Changelog</span>
            </Collapsible.Trigger>
            <Collapsible.Content>
                <ScrollArea.Root class="max-h-64 px-2">
                    <div class="prose prose-sm dark:prose-invert max-w-none py-2">
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html renderedChangelog}
                    </div>
                </ScrollArea.Root>
            </Collapsible.Content>
        </Collapsible.Root>
    {/if}

    <!-- File Info Section -->
    <Collapsible.Root bind:open={fileInfoOpen}>
        <Collapsible.Trigger
            class="flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted/50"
        >
            <ChevronRightIcon
                class={cn(
                    'size-3.5 text-muted-foreground transition-transform duration-200',
                    fileInfoOpen && 'rotate-90'
                )}
            />
            <FileIcon class="size-3.5 text-muted-foreground" />
            <span>File info</span>
        </Collapsible.Trigger>
        <Collapsible.Content>
            <div class="space-y-1.5 px-2 py-2 text-xs text-muted-foreground">
                <div class="flex items-center gap-2">
                    <span class="font-medium text-foreground">File:</span>
                    <span class="truncate">{project.fileName}</span>
                    <Badge variant="outline" class="text-[10px]"
                        >{formatBytes(project.fileSize)}</Badge
                    >
                </div>
                <div class="flex items-center gap-2">
                    <span class="font-medium text-foreground">SHA-512:</span>
                    <code class="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                        {project.fileHashes.sha512.slice(0, 16)}…
                    </code>
                    <Button variant="ghost" size="sm" class="h-5 w-5 p-0" onclick={copyHash}>
                        {#if copiedHash}
                            <CheckIcon class="size-3 text-green-500" />
                        {:else}
                            <CopyIcon class="size-3" />
                        {/if}
                    </Button>
                </div>
                <div class="flex items-center gap-2">
                    <span class="font-medium text-foreground">Download:</span>
                    <a
                        href={project.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer external"
                        class="truncate text-primary hover:underline"
                    >
                        {project.fileUrl}
                    </a>
                </div>
            </div>
        </Collapsible.Content>
    </Collapsible.Root>

    <!-- Gallery Section -->
    {#if hasGallery}
        <Collapsible.Root bind:open={galleryOpen}>
            <Collapsible.Trigger
                class="flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted/50"
            >
                <ChevronRightIcon
                    class="size-3.5 text-muted-foreground transition-transform duration-200 {galleryOpen
                        ? 'rotate-90'
                        : ''}"
                />
                <ImageIcon class="size-3.5 text-muted-foreground" />
                <span>Gallery ({project.gallery!.length})</span>
            </Collapsible.Trigger>
            <Collapsible.Content>
                <ScrollArea.Root class="w-full py-2" orientation="horizontal">
                    <div class="flex gap-2 px-2">
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
                                    <p class="mt-1 max-w-40 truncate text-xs text-muted-foreground">
                                        {image.title}
                                    </p>
                                {/if}
                            </a>
                        {/each}
                    </div>
                </ScrollArea.Root>
            </Collapsible.Content>
        </Collapsible.Root>
    {/if}
</div>
