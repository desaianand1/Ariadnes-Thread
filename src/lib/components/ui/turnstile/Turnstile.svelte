<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';

    interface Props {
        siteKey: string;
        theme?: 'auto' | 'light' | 'dark';
        size?: 'normal' | 'flexible' | 'compact';
        onVerify: (token: string) => void;
        onError?: (errorCode: string) => void;
        onExpire?: () => void;
    }

    let {
        siteKey,
        theme = 'auto',
        size = 'flexible',
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
            renderWidget();
        }
    });
</script>

<div bind:this={container} class="flex items-center justify-center"></div>
