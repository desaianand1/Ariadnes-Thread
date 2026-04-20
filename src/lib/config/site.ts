export const siteConfig = {
    name: "Ariadne's Thread",
    shortName: 'Ariadne',
    tagline: 'Your guide through the mod maze',
    description: 'Turn Modrinth collections into ready-to-play mod packs',
    url: 'https://modrinth.download',
    domain: 'modrinth.download',
    supportEmail: 'support@modrinth.download',
    legalEntity: 'Nirnshard',
    author: { name: 'Nirnshard', url: 'https://nirnshard.com' },
    keywords: [
        'modrinth',
        'Minecraft',
        'modpack',
        'mod collection',
        'modpack downloader',
        'curseforge'
    ] as string[],
    locale: 'en_US',
    themeColor: { light: '#fdfdfd', dark: '#0b0811' },
    ogImage: '/og-image.png',
    icons: {
        favicon: '/favicon.svg',
        faviconIco: '/favicon.ico',
        favicon32: '/favicon-32x32.png',
        favicon16: '/favicon-16x16.png',
        appleTouchIcon: '/apple-touch-icon.png',
        icon192: '/icon-192.png',
        icon512: '/icon-512.png'
    },
    links: {
        help: 'mailto:support@modrinth.download',
        github: 'https://github.com/desaianand1/Ariadnes-Thread',
        kofi: 'https://ko-fi.com/ananddesai',
        buymeacoffee: 'https://buymeacoffee.com/ananddesai'
    }
} as const;

export function getCanonicalUrl(): string {
    return siteConfig.url;
}
