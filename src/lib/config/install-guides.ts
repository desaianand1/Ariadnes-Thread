import type { OSPlatform } from '$lib/utils/platform';

/** A step that is the same on all platforms */
interface PlainStep {
    type: 'text';
    text: string;
}

/** A step that includes a copyable, OS-specific path */
interface PathStep {
    type: 'path';
    /** Text shown before the path */
    prefix: string;
    /** One path per OS — the component picks the right one at render time */
    paths: Record<OSPlatform, string>;
}

/** A helpful hint rendered in a subtle style */
interface TipStep {
    type: 'tip';
    text: string;
}

export type GuideStep = PlainStep | PathStep | TipStep;

export interface LauncherGuide {
    id: string;
    name: string;
    steps: GuideStep[];
}

function text(t: string): PlainStep {
    return { type: 'text', text: t };
}

function path(prefix: string, paths: Record<OSPlatform, string>): PathStep {
    return { type: 'path', prefix, paths };
}

function tip(t: string): TipStep {
    return { type: 'tip', text: t };
}

export const LAUNCHER_GUIDES: LauncherGuide[] = [
    {
        id: 'vanilla',
        name: 'Vanilla',
        steps: [
            path('Open your `.minecraft` folder', {
                windows: '%appdata%\\.minecraft',
                macos: '~/Library/Application Support/minecraft',
                linux: '~/.minecraft'
            }),
            text(
                'Extract (unzip) the ZIP into this folder — right-click → Extract All on Windows, or double-click the ZIP on macOS'
            ),
            text(
                'The `/mods`, `/resourcepacks`, and `/shaderpacks` folders merge with existing ones — your current files are safe'
            ),
            text(
                'Open the Minecraft Launcher, select the profile matching your mod loader (e.g. "Fabric 1.21.1"), and click Play'
            ),
            tip(
                'If Minecraft crashes, check that every mod in `/mods` matches your game version and mod loader'
            )
        ]
    },
    {
        id: 'prism',
        name: 'Prism Launcher',
        steps: [
            text(
                'Open Prism Launcher, right-click your instance → "Folder" (or click the folder icon)'
            ),
            path("Or navigate directly to your instance's `.minecraft` folder", {
                windows: '%appdata%/PrismLauncher/instances/<instance>/.minecraft',
                macos: '~/Library/Application Support/PrismLauncher/instances/<instance>/.minecraft',
                linux: '~/.local/share/PrismLauncher/instances/<instance>/.minecraft'
            }),
            text(
                'Extract the ZIP into this folder — mod folders merge with existing instance files'
            ),
            text('Back in Prism Launcher, click "Launch" to start with your new mods'),
            tip('Replace `<instance>` with your actual instance folder name')
        ]
    },
    {
        id: 'curseforge',
        name: 'CurseForge',
        steps: [
            text('Open CurseForge, go to your modpack/instance, click ⋯ menu → "Open Folder"'),
            path('Or navigate directly', {
                windows: '%userprofile%/curseforge/minecraft/Instances/<instance>',
                macos: '~/Documents/curseforge/minecraft/Instances/<instance>',
                linux: '~/.curseforge/minecraft/Instances/<instance>'
            }),
            text('Extract the ZIP contents here — existing mod folders are preserved'),
            text('Go back to CurseForge and click "Play" to launch with new mods'),
            tip('Replace `<instance>` with your actual instance/modpack folder name')
        ]
    },
    {
        id: 'modrinth-app',
        name: 'Modrinth App',
        steps: [
            text(
                'Open Modrinth app, go to your instance, click the folder icon to open its directory'
            ),
            path('Or navigate directly', {
                windows: '%appdata%/com.modrinth.theseus/profiles/<instance>',
                macos: '~/Library/Application Support/com.modrinth.theseus/profiles/<instance>',
                linux: '~/.config/com.modrinth.theseus/profiles/<instance>'
            }),
            text('Extract the ZIP contents here — your existing mods and configs are preserved'),
            text('Return to the Modrinth app and click "Play"')
        ]
    },
    {
        id: 'gdlauncher',
        name: 'GDLauncher',
        steps: [
            text('Open GDLauncher, right-click your instance → "Open Folder"'),
            path('Or navigate directly', {
                windows: '%appdata%/gdlauncher_next/instances/<instance>',
                macos: '~/Library/Application Support/gdlauncher_next/instances/<instance>',
                linux: '~/.config/gdlauncher_next/instances/<instance>'
            }),
            text('Extract the ZIP contents into this folder'),
            text('Back in GDLauncher, launch the instance to load new mods')
        ]
    }
];
