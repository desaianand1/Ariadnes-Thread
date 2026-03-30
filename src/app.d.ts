/// <reference types="@sveltejs/adapter-cloudflare" />

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}

		interface Platform {
			env: {
				// Modrinth API Configuration
				MODRINTH_API_URL?: string;
				MODRINTH_USER_AGENT?: string;

				// Rate Limiting
				MAX_REQUESTS_PER_MINUTE?: string;
				RESET_INTERVAL_SECONDS?: string;

				// Retry Configuration
				MAX_RETRIES?: string;
				RETRY_DELAY_MS?: string;
				RETRY_BACKOFF_STRATEGY?: string;

				// Download Configuration
				MAX_CONCURRENT_DOWNLOADS?: string;

				// Network
				FETCH_TIMEOUT_MS?: string;

				// Optional services
				RESEND_API_KEY?: string;
			};
			context: {
				waitUntil(promise: Promise<unknown>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
