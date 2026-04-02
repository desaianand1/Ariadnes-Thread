/// <reference types="@sveltejs/adapter-cloudflare" />

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
interface TurnstileRenderOptions {
    sitekey: string;
    theme?: 'auto' | 'light' | 'dark';
    size?: 'normal' | 'flexible' | 'compact';
    callback?: (token: string) => void;
    'error-callback'?: (errorCode: string) => void;
    'expired-callback'?: () => void;
    action?: string;
    appearance?: 'always' | 'execute' | 'interaction-only';
    execution?: 'render' | 'execute';
}

interface TurnstileInstance {
    render(container: string | HTMLElement, options: TurnstileRenderOptions): string;
    reset(widgetId: string): void;
    remove(widgetId: string): void;
    getResponse(widgetId: string): string | undefined;
    isExpired(widgetId: string): boolean;
    execute(container: string | HTMLElement): void;
}

declare global {
    interface Window {
        turnstile: TurnstileInstance;
    }

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

                // Cloudflare Turnstile
                TURNSTILE_SECRET_KEY?: string;
            };
            context: {
                waitUntil(promise: Promise<unknown>): void;
            };
            caches: CacheStorage & { default: Cache };
        }
    }
}

export {};
