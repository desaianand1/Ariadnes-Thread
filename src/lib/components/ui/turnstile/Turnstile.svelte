<script lang="ts">
    import { onMount, untrack } from 'svelte';
    import { browser } from '$app/environment';

    interface Props {
        siteKey: string;
        theme?: 'auto' | 'light' | 'dark';
        /**
         * `invisible` renders no visible widget; pair with `appearance="execute"`
         * or `interaction-only` and call `execute()` imperatively to trigger a
         * challenge. `flexible` is the default managed-mode widget.
         */
        size?: 'normal' | 'flexible' | 'compact' | 'invisible';
        /**
         * Controls when the challenge UI surfaces:
         *  - `always`: visible widget at render
         *  - `execute`: no UI until `execute()` is called, then prompt if needed
         *  - `interaction-only`: no UI unless the challenge requires interaction
         */
        appearance?: 'always' | 'execute' | 'interaction-only';
        /**
         * Action label, verified server-side. Use a distinct action per form so
         * a token for one form can't be replayed against another.
         */
        action?: string;
        onVerify: (token: string) => void;
        onError?: (errorCode: string) => void;
        onExpire?: () => void;
    }

    let {
        siteKey,
        theme = 'auto',
        size = 'flexible',
        appearance = 'always',
        action,
        onVerify,
        onError,
        onExpire
    }: Props = $props();

    let container: HTMLDivElement;
    let widgetId: string | undefined = $state(undefined);
    let scriptLoaded = $state(false);

    function renderWidget() {
        if (!browser || !container || !window.turnstile) return;

        // Clean up existing widget before re-rendering
        if (widgetId !== undefined) {
            window.turnstile.remove(widgetId);
            widgetId = undefined;
        }

        widgetId = window.turnstile.render(container, {
            sitekey: siteKey,
            theme,
            size,
            appearance,
            action,
            callback: (token: string) => onVerify(token),
            'error-callback': (errorCode: string) => onError?.(errorCode),
            'expired-callback': () => {
                onExpire?.();
            }
        });
    }

    function loadScript() {
        if (document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
            scriptLoaded = true;
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.defer = true;
        script.onload = () => {
            scriptLoaded = true;
        };
        document.head.appendChild(script);
    }

    export function reset() {
        if (widgetId !== undefined && window.turnstile) {
            window.turnstile.reset(widgetId);
        }
    }

    /**
     * Trigger an invisible/execute-mode challenge on demand. No-op if the widget
     * isn't rendered yet (caller should await script load or read scriptLoaded).
     */
    export function execute() {
        if (widgetId !== undefined && window.turnstile?.execute) {
            window.turnstile.execute(widgetId);
        }
    }

    onMount(() => {
        loadScript();

        return () => {
            if (widgetId !== undefined && window.turnstile) {
                window.turnstile.remove(widgetId);
            }
        };
    });

    $effect(() => {
        if (scriptLoaded && container) {
            untrack(() => renderWidget());
        }
    });
</script>

<div bind:this={container} class="flex items-center justify-center"></div>
