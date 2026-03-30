<script lang="ts">
	import { siteConfig } from '$lib/config/site';
	import { APP_VERSION, MODRINTH_ATTRIBUTION_URL } from '$lib/config/constants';
</script>

<footer class="border-t py-6 text-sm text-muted-foreground">
	<div
		class="container mx-auto flex max-w-4xl flex-col items-center gap-3 px-4 sm:flex-row sm:justify-between"
	>
		<p>
			Not affiliated with <a
				href={MODRINTH_ATTRIBUTION_URL}
				target="_blank"
				rel="noopener noreferrer external"
				class="underline underline-offset-4 hover:text-foreground">Modrinth</a
			>.
		</p>

		<div class="flex items-center gap-4">
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
		</div>

		<p>&copy; {new Date().getFullYear()} {siteConfig.legalEntity} &middot; v{APP_VERSION}</p>
	</div>
</footer>
