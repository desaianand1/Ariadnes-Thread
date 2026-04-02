export interface LauncherGuide {
    id: string;
    name: string;
    steps: string[];
}

export const LAUNCHER_GUIDES: LauncherGuide[] = [
    {
        id: 'vanilla',
        name: 'Vanilla',
        steps: [
            'Open your .minecraft folder (press Win+R, type %appdata%\\.minecraft, hit Enter)',
            'Extract the ZIP contents into the .minecraft folder',
            'The /mods, /resourcepacks, and /shaderpacks folders will merge with any existing ones',
            'Launch Minecraft with the correct mod loader profile'
        ]
    },
    {
        id: 'prism',
        name: 'Prism Launcher',
        steps: [
            'Right-click your instance and select "Folder" (or click the folder icon)',
            'Navigate to the .minecraft folder inside the instance',
            'Extract the ZIP contents here',
            'The mod folders will merge with your existing instance files'
        ]
    },
    {
        id: 'curseforge',
        name: 'CurseForge',
        steps: [
            'Open the CurseForge app and go to your modpack/instance',
            'Click the three dots menu and select "Open Folder"',
            'Extract the ZIP contents into the instance folder',
            'Restart the instance to load the new mods'
        ]
    },
    {
        id: 'modrinth-app',
        name: 'Modrinth App',
        steps: [
            'Open the Modrinth app and go to your instance',
            'Click the folder icon to open the instance directory',
            'Extract the ZIP contents into the instance folder',
            'The mod folders will merge with your existing files'
        ]
    },
    {
        id: 'gdlauncher',
        name: 'GDLauncher',
        steps: [
            'Right-click your instance and select "Open Folder"',
            'Extract the ZIP contents into the instance folder',
            'Restart the instance to pick up the new mods'
        ]
    }
];
