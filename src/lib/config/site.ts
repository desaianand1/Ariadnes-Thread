export const siteConfig = {
	name: "Ariadne's Thread",
	shortName: 'Ariadne',
	description: 'Download multiple Modrinth mod collections as organized ZIP bundles',
	url: 'https://modrinth.download',
	domain: 'modrinth.download',
	supportEmail: 'support@modrinth.download',
	legalEntity: 'Nirnshard LLP',
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
	themeColor: { light: '#ffffff', dark: '#262626' },
	ogImage: '/og-image.png',
	icons: {
		favicon: '/favicon.svg',
		appleTouchIcon: '/apple-touch-icon.png'
	},
	links: {
		help: 'mailto:support@modrinth.download',
		github: 'https://github.com/desaianand1/Ariadnes-Thread'
	}
} as const;

export function getCanonicalUrl(): string {
	return siteConfig.url;
}
