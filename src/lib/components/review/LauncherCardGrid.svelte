<script lang="ts">
    import { SpotlightCard } from '$lib/components/ui/spotlight-card';
    import * as Card from '$lib/components/ui/card';
    import { Button } from '$lib/components/ui/button';
    import { SiCurseforge, SiModrinth } from '@icons-pack/svelte-simple-icons';
    import VanillaIcon from '$lib/components/icons/VanillaIcon.svelte';
    import PrismLauncherIcon from '$lib/components/icons/PrismLauncherIcon.svelte';
    import GdLauncherIcon from '$lib/components/icons/GdLauncherIcon.svelte';
    import DownloadIcon from '@lucide/svelte/icons/download';
    import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';

    interface Props {
        onDownload: (launcherId: string) => void;
        disabled?: boolean;
    }

    let { onDownload, disabled = false }: Props = $props();

    const launchers = [
        {
            id: 'vanilla',
            name: 'Vanilla Minecraft',
            description: 'Standard Minecraft launcher',
            spotlightClass: 'text-vanilla dark:text-vanilla',
            borderClass: 'border-l-vanilla',
            buttonClass: 'border-vanilla/30 text-vanilla hover:bg-vanilla/10',
            featured: true
        },
        {
            id: 'prism',
            name: 'Prism Launcher',
            description: 'Open-source, multi-instance',
            spotlightClass: 'text-muted-foreground dark:text-white',
            borderClass: 'border-l-prism',
            buttonClass: 'border-muted-foreground/30 text-muted-foreground hover:bg-muted/20',
            featured: false
        },
        {
            id: 'curseforge',
            name: 'CurseForge',
            description: 'CurseForge app launcher',
            spotlightClass: 'text-curseforge dark:text-curseforge',
            borderClass: 'border-l-curseforge',
            buttonClass: 'border-curseforge/30 text-curseforge hover:bg-curseforge/10',
            featured: false
        },
        {
            id: 'modrinth-app',
            name: 'Modrinth App',
            description: "Modrinth's native launcher",
            spotlightClass: 'text-modrinth dark:text-modrinth',
            borderClass: 'border-l-modrinth',
            buttonClass: 'border-modrinth/30 text-modrinth hover:bg-modrinth/10',
            featured: false
        },
        {
            id: 'gdlauncher',
            name: 'GDLauncher',
            description: 'Feature-rich launcher',
            spotlightClass: 'text-gdlauncher dark:text-gdlauncher',
            borderClass: 'border-l-gdlauncher',
            buttonClass: 'border-gdlauncher/30 text-gdlauncher hover:bg-gdlauncher/10',
            featured: false
        }
    ] as const;

    function handleClick(launcherId: string) {
        if (!disabled) onDownload(launcherId);
    }

    function handleKeydown(e: KeyboardEvent, launcherId: string) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick(launcherId);
        }
    }
</script>

<div class="space-y-3">
    <h2 class="text-sm font-semibold text-muted-foreground">Download for your launcher:</h2>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {#each launchers as launcher (launcher.id)}
            <SpotlightCard
                spotlightClass={launcher.spotlightClass}
                spotlightOpacity={30}
                class="cursor-pointer border-l-4 {launcher.borderClass} transition-transform active:scale-[0.98] {launcher.featured
                    ? 'sm:col-span-2 lg:col-span-3 xl:col-span-4'
                    : ''} {disabled ? 'pointer-events-none opacity-50' : ''}"
                role="button"
                tabindex={disabled ? -1 : 0}
                aria-label={`Download mods for ${launcher.name}`}
                aria-disabled={disabled || undefined}
                onclick={() => handleClick(launcher.id)}
                onkeydown={(e) => handleKeydown(e, launcher.id)}
            >
                <Card.Header>
                    <Card.Title class="flex items-center gap-3">
                        {#if launcher.id === 'vanilla'}
                            <VanillaIcon class="size-8 shrink-0" />
                        {:else if launcher.id === 'prism'}
                            <PrismLauncherIcon class="size-8 shrink-0" />
                        {:else if launcher.id === 'curseforge'}
                            <SiCurseforge class="size-8 shrink-0 text-curseforge" />
                        {:else if launcher.id === 'modrinth-app'}
                            <SiModrinth class="size-8 shrink-0 text-modrinth" />
                        {:else if launcher.id === 'gdlauncher'}
                            <GdLauncherIcon class="size-8 shrink-0" />
                        {/if}
                        {launcher.name}
                    </Card.Title>
                    <Card.Description>{launcher.description}</Card.Description>
                </Card.Header>
                <Card.Footer>
                    <Button
                        variant="outline"
                        class="w-full {launcher.buttonClass}"
                        tabindex={-1}
                        {disabled}
                    >
                        <DownloadIcon class="size-3.5" />
                        Download & Install
                        <ArrowRightIcon class="size-3.5" />
                    </Button>
                </Card.Footer>
            </SpotlightCard>
        {/each}
    </div>
</div>
