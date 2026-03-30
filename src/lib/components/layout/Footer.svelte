<script lang="ts">
	import { siteConfig } from '$lib/config/site';
	import { APP_VERSION, MODRINTH_ATTRIBUTION_URL } from '$lib/config/constants';
</script>

<footer class="border-t py-6 text-sm text-muted-foreground">
	<div
		class="container mx-auto flex max-w-4xl flex-col items-center gap-3 px-4 sm:flex-row sm:justify-between"
	>
		<div class="text-center sm:text-left">
			<p class="text-xs">Resolve, review, and download Modrinth mod collections.</p>
			<p class="mt-1">
				Not affiliated with <a
					href={MODRINTH_ATTRIBUTION_URL}
					target="_blank"
					rel="noopener noreferrer external"
					class="underline underline-offset-4 hover:text-foreground">Modrinth</a
				>.
			</p>
		</div>

		<nav class="flex items-center gap-4" aria-label="Footer">
			<a
				href={siteConfig.links.github}
				target="_blank"
				rel="noopener noreferrer external"
				class="underline underline-offset-4 hover:text-foreground">GitHub</a
			>
			<a
				href={siteConfig.links.help}
				rel="external"
				class="underline underline-offset-4 hover:text-foreground">Support</a
			>
		</nav>

		<p>&copy; {new Date().getFullYear()} {siteConfig.legalEntity} &middot; v{APP_VERSION}</p>
	</div>
</footer>
