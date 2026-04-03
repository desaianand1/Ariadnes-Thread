<script lang="ts">
    import { ResponsiveModal } from '$lib/components/ui/responsive-modal';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Textarea } from '$lib/components/ui/textarea';
    import { Label } from '$lib/components/ui/label';
    import { Turnstile } from '$lib/components/ui/turnstile';
    import { toast } from 'svelte-sonner';
    import { browser } from '$app/environment';
    import { siteConfig } from '$lib/config/site';
    import { getLoaderDisplayName } from '$lib/utils/format';
    import CopyIcon from '@lucide/svelte/icons/copy';
    import CheckIcon from '@lucide/svelte/icons/check';
    import SendIcon from '@lucide/svelte/icons/send';
    import ShareIcon from '@lucide/svelte/icons/share';
    import DownloadIcon from '@lucide/svelte/icons/download';
    import QrCodeIcon from '@lucide/svelte/icons/qr-code';
    import { SiDiscord } from '@icons-pack/svelte-simple-icons';

    interface Props {
        open: boolean;
        pageUrl: string;
        collectionNames: string;
        context: { gameVersion: string; loader: string; modCount: number };
        emailEnabled: boolean;
        turnstileSiteKey: string;
    }

    let {
        open = $bindable(),
        pageUrl,
        collectionNames,
        context,
        emailEnabled,
        turnstileSiteKey
    }: Props = $props();

    let copied = $state(false);
    let copiedDiscord = $state(false);
    let curatorName = $state('');
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
        `**${collectionNames}** — ${context.modCount} mods for Minecraft ${context.gameVersion} on ${getLoaderDisplayName(context.loader)}\n${pageUrl}`
    );

    $effect(() => {
        if (open && qrContainer && browser) {
            generateQr();
        }
    });

    async function generateQr() {
        if (qrGenerated || !qrContainer) return;
        try {
            const QRCode = (await import('qrcode')).default;
            const canvas = await QRCode.toCanvas(pageUrl, {
                width: 200,
                margin: 2,
                color: { dark: siteConfig.themeColor.light, light: '#ffffff' }
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
        try {
            await navigator.clipboard.writeText(pageUrl);
            copied = true;
            toast.success('Link copied to clipboard');
            setTimeout(() => (copied = false), 2000);
        } catch {
            toast.error('Failed to copy link');
        }
    }

    async function webShare() {
        try {
            await navigator.share({
                title: collectionNames,
                text: `Check out this mod collection: ${collectionNames}`,
                url: pageUrl
            });
        } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
                toast.error('Failed to share');
            }
        }
    }

    async function copyDiscord() {
        try {
            await navigator.clipboard.writeText(discordMessage);
            copiedDiscord = true;
            toast.success('Copied for Discord');
            setTimeout(() => (copiedDiscord = false), 2000);
        } catch {
            toast.error('Failed to copy');
        }
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
                    shareUrl: pageUrl,
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

<ResponsiveModal bind:open onClose={() => (open = false)}>
    {#snippet title()}Share Collection{/snippet}
    {#snippet description()}Share this mod collection with others{/snippet}

    <div class="space-y-6">
        <!-- Copy Link -->
        <div class="space-y-2">
            <Label>Share Link</Label>
            <div class="flex gap-2">
                <Input value={pageUrl} readonly class="flex-1 text-sm" />
                <Button variant="outline" size="icon" onclick={copyLink}>
                    {#if copied}
                        <CheckIcon class="size-4 text-green-500" />
                    {:else}
                        <CopyIcon class="size-4" />
                    {/if}
                </Button>
            </div>
        </div>

        <!-- Web Share API (mobile/supported browsers) -->
        {#if webShareSupported}
            <Button variant="outline" class="w-full" onclick={webShare}>
                <ShareIcon class="mr-1.5 size-4" />
                Share via...
            </Button>
        {/if}

        <!-- QR Code -->
        <div class="space-y-2">
            <Label class="flex items-center gap-1.5">
                <QrCodeIcon class="size-3.5" />
                QR Code
            </Label>
            <div class="flex flex-col items-center gap-3 rounded-md border p-4">
                <div bind:this={qrContainer} class="flex items-center justify-center"></div>
                {#if qrGenerated}
                    <Button variant="outline" size="sm" onclick={downloadQr}>
                        <DownloadIcon class="mr-1.5 size-3.5" />
                        Download QR
                    </Button>
                {/if}
            </div>
        </div>

        <!-- Copy for Discord -->
        <div class="space-y-2">
            <Label>Copy for Discord</Label>
            <div class="flex gap-2">
                <Input value={discordMessage} readonly class="flex-1 text-sm" />
                <Button variant="outline" size="icon" onclick={copyDiscord}>
                    {#if copiedDiscord}
                        <CheckIcon class="size-4 text-green-500" />
                    {:else}
                        <SiDiscord class="size-4" />
                    {/if}
                </Button>
            </div>
        </div>

        <!-- Email Form -->
        {#if emailEnabled}
            <hr class="border-border" />

            <form onsubmit={sendEmail} class="space-y-4">
                <div class="absolute -left-[9999px]" aria-hidden="true">
                    <input name="website" tabindex={-1} autocomplete="off" bind:value={honeypot} />
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
        {/if}
    </div>
</ResponsiveModal>
