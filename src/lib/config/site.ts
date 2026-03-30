export const siteConfig = {
	name: "Ariadne's Thread",
	description: 'Modrinth modpack and collections downloader',
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
	links: {
		help: 'mailto:support@modrinth.download'
	}
} as const;

export function getCanonicalUrl(env?: { PUBLIC_SITE_URL?: string }): string {
	return env?.PUBLIC_SITE_URL || siteConfig.url;
}
