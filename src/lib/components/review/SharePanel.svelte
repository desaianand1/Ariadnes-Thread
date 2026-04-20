<script lang="ts">
    import { ResponsiveModal } from '$lib/components/ui/responsive-modal';
    import * as ScrollArea from '$lib/components/ui/scroll-area';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Textarea } from '$lib/components/ui/textarea';
    import { Label } from '$lib/components/ui/label';
    import { Turnstile } from '$lib/components/ui/turnstile';
    import { toast } from 'svelte-sonner';
    import { browser } from '$app/environment';
    import { mode } from 'mode-watcher';
    import { TOAST_DURATION, CURATOR_NAME_MAX_LENGTH } from '$lib/config/constants';
    import { getLoaderDisplayName } from '$lib/utils/format';
    import { copyToClipboard } from '$lib/utils/clipboard';
    import { buildShareUrl } from '$lib/utils/url-state';
    import UserIcon from '@lucide/svelte/icons/user';
    import { scale } from 'svelte/transition';
    import { safeTransition } from '$lib/utils/motion';
    import CopyIcon from '@lucide/svelte/icons/copy';
    import CheckIcon from '@lucide/svelte/icons/check';
    import SendIcon from '@lucide/svelte/icons/send';
    import ShareIcon from '@lucide/svelte/icons/share';
    import DownloadIcon from '@lucide/svelte/icons/download';
    import QrCodeIcon from '@lucide/svelte/icons/qr-code';
    import LinkIcon from '@lucide/svelte/icons/link';
    import MailIcon from '@lucide/svelte/icons/mail';
    import ServerIcon from '@lucide/svelte/icons/server';
    import { SiDiscord } from '@icons-pack/svelte-simple-icons';
    import { SEMANTIC_BANNER_COLORS } from '$lib/utils/colors';

    interface Props {
        open: boolean;
        pageUrl: string;
        collectionNames: string;
        context: { gameVersion: string; loader: string; modCount: number };
        emailEnabled: boolean;
        turnstileSiteKey: string;
        serverOnlyWarning?: boolean;
    }

    let {
        open = $bindable(),
        pageUrl,
        collectionNames,
        context,
        emailEnabled,
        turnstileSiteKey,
        serverOnlyWarning = false
    }: Props = $props();

    let copied = $state(false);
    let copiedDiscord = $state(false);
    let curatorName = $state('');

    let shareUrl = $derived.by(() => {
        try {
            const base = new URL(pageUrl, 'http://placeholder');
            return buildShareUrl(base, curatorName || undefined);
        } catch {
            return pageUrl;
        }
    });

    // Resolve to absolute URL for sharing
    let absoluteShareUrl = $derived.by(() => {
        try {
            const origin = new URL(pageUrl).origin;
            return `${origin}${shareUrl}`;
        } catch {
            return shareUrl;
        }
    });
    let recipientEmail = $state('');
    let message = $state('');
    let honeypot = $state('');
    let sending = $state(false);
    let turnstileToken = $state('');
    let turnstileRef: ReturnType<typeof Turnstile> | undefined = $state(undefined);
    const loadedAt = Date.now();

    let qrContainer = $state<HTMLDivElement | undefined>(undefined);
    let qrGenerated = $state(false);

    const turnstileReady = $derived(turnstileToken.length > 0);
    const webShareSupported = $derived(browser && 'share' in navigator);

    const discordMessage = $derived(
        `**${collectionNames}** — ${context.modCount} mods for Minecraft ${context.gameVersion} on ${getLoaderDisplayName(context.loader)}\n${absoluteShareUrl}`
    );

    // Reset QR state when modal closes or share URL changes so it regenerates
    $effect(() => {
        if (!open) {
            qrGenerated = false;
        }
    });

    // Regenerate QR when curator name changes the URL
    $effect(() => {
        void absoluteShareUrl;
        qrGenerated = false;
    });

    $effect(() => {
        if (open && qrContainer && browser) {
            generateQr();
        }
    });

    /**
     * Resolve a CSS variable from :root to a hex string the QR library can use.
     * oklch/hsl values aren't valid canvas colors, so we render a temporary
     * 1x1 element, read its computed color, and convert the rgb() result.
     */
    function resolveCssColor(varName: string, fallback: string): string {
        if (!browser) return fallback;
        const probe = document.createElement('div');
        probe.style.color = `var(${varName})`;
        probe.style.position = 'fixed';
        probe.style.opacity = '0';
        document.body.appendChild(probe);
        const rgb = getComputedStyle(probe).color;
        document.body.removeChild(probe);
        const match = rgb.match(/(\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return fallback;
        const hex =
            '#' +
            [match[1], match[2], match[3]]
                .map((c) => parseInt(c, 10).toString(16).padStart(2, '0'))
                .join('');
        return hex;
    }

    function getQrColors(): { dark: string; light: string } {
        const isDark = mode.current === 'dark';
        return {
            dark: resolveCssColor('--primary', isDark ? '#e9e5f5' : '#3b1d8e'),
            light: resolveCssColor('--background', isDark ? '#18181b' : '#ffffff')
        };
    }

    async function generateQr() {
        if (qrGenerated || !qrContainer) return;
        try {
            const mod = await import('qrcode');
            // CJS interop: Vite may expose .default or the module directly
            const QRCode = mod.default ?? mod;
            const colors = getQrColors();
            const canvas = await QRCode.toCanvas(absoluteShareUrl, {
                width: 200,
                margin: 2,
                color: colors
            });
            // eslint-disable-next-line svelte/no-dom-manipulating -- QR canvas is generated outside Svelte's reactivity
            qrContainer.innerHTML = '';
            // eslint-disable-next-line svelte/no-dom-manipulating
            qrContainer.appendChild(canvas);
            qrGenerated = true;
        } catch (err) {
            console.error('QR generation failed:', err);
        }
    }

    function downloadQr() {
        const canvas = qrContainer?.querySelector('canvas');
        if (!canvas) return;
        try {
            const url = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ariadnes-thread-share.png';
            a.click();
        } catch {
            toast.error('Failed to download QR code');
        }
    }

    async function copyLink() {
        await copyToClipboard(absoluteShareUrl);
        copied = true;
        toast.success('Link copied to clipboard', { duration: TOAST_DURATION.SUCCESS });
        setTimeout(() => (copied = false), 2000);
    }

    async function webShare() {
        try {
            await navigator.share({
                title: collectionNames,
                text: `Check out this mod collection: ${collectionNames}`,
                url: absoluteShareUrl
            });
        } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
                toast.error('Failed to share');
            }
        }
    }

    async function copyDiscord() {
        await copyToClipboard(discordMessage);
        copiedDiscord = true;
        toast.success('Copied for Discord', { duration: TOAST_DURATION.SUCCESS });
        setTimeout(() => (copiedDiscord = false), 2000);
    }

    async function sendEmail(e: SubmitEvent) {
        e.preventDefault();
        if (sending || !turnstileReady) return;

        sending = true;
        try {
            const res = await fetch('/api/share/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    curatorName,
                    recipientEmail,
                    message,
                    shareUrl: absoluteShareUrl,
                    collectionNames,
                    website: honeypot,
                    loadedAt,
                    turnstileToken
                })
            });

            if (res.ok) {
                toast.success('Email sent successfully!');
                curatorName = '';
                recipientEmail = '';
                message = '';
                turnstileToken = '';
                turnstileRef?.reset();
            } else if (res.status === 429) {
                toast.error('Too many emails sent. Please try again later.');
            } else if (res.status === 403) {
                toast.error('Verification failed. Please try again.');
                turnstileToken = '';
                turnstileRef?.reset();
            } else if (res.status === 503) {
                toast.error('Email service is currently unavailable.');
            } else {
                toast.error('Failed to send email. Please check your input.');
            }
        } catch {
            toast.error('Network error. Please try again.');
        } finally {
            sending = false;
        }
    }
</script>

<ResponsiveModal bind:open onClose={() => (open = false)} dialogClass="sm:max-w-lg">
    {#snippet title()}Share Collection{/snippet}
    {#snippet description()}Share this mod collection with others{/snippet}

    <ScrollArea.Root class="max-h-[60vh]">
        <div class="space-y-5 pr-1">
            <!-- Quick Share section -->
            <div class="space-y-3">
                <h3
                    class="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                >
                    <LinkIcon class="size-3" />
                    Quick Share
                </h3>

                {#if serverOnlyWarning}
                    <div
                        class="rounded-md border px-3 py-2.5 text-sm {SEMANTIC_BANNER_COLORS.warning
                            .bg} {SEMANTIC_BANNER_COLORS.warning.border} {SEMANTIC_BANNER_COLORS
                            .warning.text}"
                    >
                        <div class="flex items-start gap-2">
                            <ServerIcon class="mt-0.5 size-4 shrink-0" />
                            <div>
                                <p class="font-medium">Heads up — server-only mods</p>
                                <p class="mt-0.5 text-xs opacity-80">
                                    All the mods in this collection run on the server. Your friend
                                    won't need to download anything — they can just join and play.
                                    The share link will let them know.
                                </p>
                            </div>
                        </div>
                    </div>
                {/if}

                <!-- Curator name — personalizes the share URL -->
                <div class="space-y-1.5">
                    <Label
                        for="share-curator-name"
                        class="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                        <UserIcon class="size-3" />
                        Your name (optional)
                    </Label>
                    <Input
                        id="share-curator-name"
                        bind:value={curatorName}
                        placeholder="e.g. Alex"
                        maxlength={CURATOR_NAME_MAX_LENGTH}
                        class="h-8 text-sm"
                    />
                </div>

                <!-- Copy Link -->
                <div class="flex min-w-0 gap-2">
                    <div
                        class="min-w-0 flex-1 overflow-hidden rounded-md border bg-muted/30 px-3 py-2"
                    >
                        <code class="block truncate text-sm text-muted-foreground"
                            >{absoluteShareUrl}</code
                        >
                    </div>
                    <Button variant="outline" size="icon" class="shrink-0" onclick={copyLink}>
                        {#if copied}
                            <span in:scale={safeTransition({ duration: 200, start: 0.5 })}>
                                <CheckIcon class="size-4 text-emerald-500" />
                            </span>
                        {:else}
                            <CopyIcon class="size-4" />
                        {/if}
                    </Button>
                </div>

                <!-- Web Share API (mobile/supported browsers) -->
                {#if webShareSupported}
                    <Button variant="outline" class="w-full" onclick={webShare}>
                        <ShareIcon class="mr-1.5 size-4" />
                        Share via...
                    </Button>
                {/if}
            </div>

            <hr class="border-border" />

            <!-- Social section -->
            <div class="space-y-3">
                <h3
                    class="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                >
                    <SiDiscord class="size-3 text-discord" />
                    Discord
                </h3>
                <div class="flex min-w-0 gap-2">
                    <Textarea
                        value={discordMessage}
                        readonly
                        rows={2}
                        class="min-w-0 flex-1 resize-none text-sm"
                    />
                    <Button
                        variant="outline"
                        size="icon"
                        class="shrink-0 self-start"
                        onclick={copyDiscord}
                    >
                        {#if copiedDiscord}
                            <span in:scale={safeTransition({ duration: 200, start: 0.5 })}>
                                <CheckIcon class="size-4 text-emerald-500" />
                            </span>
                        {:else}
                            <CopyIcon class="size-4" />
                        {/if}
                    </Button>
                </div>
            </div>

            <hr class="border-border" />

            <!-- QR Code -->
            <div class="space-y-3">
                <h3
                    class="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                >
                    <QrCodeIcon class="size-3" />
                    QR Code
                </h3>
                <div class="flex flex-col items-center gap-3 rounded-md border p-4">
                    <div bind:this={qrContainer} class="flex items-center justify-center">
                        {#if !qrGenerated}
                            <div class="flex size-[200px] items-center justify-center">
                                <QrCodeIcon class="size-8 animate-pulse text-muted-foreground/30" />
                            </div>
                        {/if}
                    </div>
                    {#if qrGenerated}
                        <Button variant="outline" size="sm" onclick={downloadQr}>
                            <DownloadIcon class="mr-1.5 size-3.5" />
                            Download QR
                        </Button>
                    {/if}
                </div>
            </div>

            <!-- Email Form -->
            {#if emailEnabled}
                <hr class="border-border" />

                <div class="space-y-3">
                    <h3
                        class="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                    >
                        <MailIcon class="size-3" />
                        Send via Email
                    </h3>

                    <form onsubmit={sendEmail} class="space-y-4">
                        <div class="absolute -left-[9999px]" aria-hidden="true">
                            <input
                                name="website"
                                tabindex={-1}
                                autocomplete="off"
                                bind:value={honeypot}
                            />
                        </div>

                        <div class="space-y-2">
                            <Label for="curator-name">Your Name</Label>
                            <Input
                                id="curator-name"
                                bind:value={curatorName}
                                placeholder="Your name"
                                required
                                maxlength={100}
                            />
                        </div>

                        <div class="space-y-2">
                            <Label for="recipient-email">Recipient Email</Label>
                            <Input
                                id="recipient-email"
                                type="email"
                                bind:value={recipientEmail}
                                placeholder="friend@example.com"
                                required
                                maxlength={320}
                            />
                        </div>

                        <div class="space-y-2">
                            <Label for="share-message">Personal Message (optional)</Label>
                            <Textarea
                                id="share-message"
                                bind:value={message}
                                placeholder="Check out these mods!"
                                maxlength={1000}
                                rows={3}
                            />
                            <p class="text-right text-xs text-muted-foreground">
                                {message.length}/1000
                            </p>
                        </div>

                        {#if turnstileSiteKey}
                            <Turnstile
                                bind:this={turnstileRef}
                                siteKey={turnstileSiteKey}
                                action="share-email"
                                onVerify={(token) => (turnstileToken = token)}
                                onExpire={() => (turnstileToken = '')}
                                onError={() => (turnstileToken = '')}
                            />
                        {/if}

                        <Button type="submit" class="w-full" disabled={sending || !turnstileReady}>
                            <SendIcon class="mr-1.5 size-3.5" />
                            {sending ? 'Sending...' : 'Send Email'}
                        </Button>
                    </form>
                </div>
            {/if}
        </div>
    </ScrollArea.Root>
</ResponsiveModal>
