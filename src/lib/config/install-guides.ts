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

export type GuideStep = PlainStep | PathStep;

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

export const LAUNCHER_GUIDES: LauncherGuide[] = [
    {
        id: 'vanilla',
        name: 'Vanilla',
        steps: [
            path('Open your .minecraft folder', {
                windows: '%appdata%\\.minecraft',
                macos: '~/Library/Application Support/minecraft',
                linux: '~/.minecraft'
            }),
            text('Extract the ZIP contents into the .minecraft folder'),
            text(
                'The /mods, /resourcepacks, and /shaderpacks folders will merge with any existing ones'
            ),
            text('Launch Minecraft with the correct mod loader profile')
        ]
    },
    {
        id: 'prism',
        name: 'Prism Launcher',
        steps: [
            text('Right-click your instance and select "Folder" (or click the folder icon)'),
            text('Navigate to the .minecraft folder inside the instance'),
            text('Extract the ZIP contents here'),
            text('The mod folders will merge with your existing instance files')
        ]
    },
    {
        id: 'curseforge',
        name: 'CurseForge',
        steps: [
            text('Open the CurseForge app and go to your modpack/instance'),
            text('Click the three dots menu and select "Open Folder"'),
            text('Extract the ZIP contents into the instance folder'),
            text('Restart the instance to load the new mods')
        ]
    },
    {
        id: 'modrinth-app',
        name: 'Modrinth App',
        steps: [
            text('Open the Modrinth app and go to your instance'),
            text('Click the folder icon to open the instance directory'),
            text('Extract the ZIP contents into the instance folder'),
            text('The mod folders will merge with your existing files')
        ]
    },
    {
        id: 'gdlauncher',
        name: 'GDLauncher',
        steps: [
            text('Right-click your instance and select "Open Folder"'),
            text('Extract the ZIP contents into the instance folder'),
            text('Restart the instance to pick up the new mods')
        ]
    }
];
