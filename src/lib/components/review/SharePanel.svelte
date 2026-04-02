<script lang="ts">
    import { ResponsiveModal } from '$lib/components/ui/responsive-modal';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Textarea } from '$lib/components/ui/textarea';
    import { Label } from '$lib/components/ui/label';
    import { Turnstile } from '$lib/components/ui/turnstile';
    import { toast } from 'svelte-sonner';
    import CopyIcon from '@lucide/svelte/icons/copy';
    import CheckIcon from '@lucide/svelte/icons/check';
    import SendIcon from '@lucide/svelte/icons/send';
    interface Props {
        open: boolean;
        pageUrl: string;
        collectionNames: string;
        emailEnabled: boolean;
        turnstileSiteKey: string;
    }

    let {
        open = $bindable(),
        pageUrl,
        collectionNames,
        emailEnabled,
        turnstileSiteKey
    }: Props = $props();

    let copied = $state(false);
    let curatorName = $state('');
    let recipientEmail = $state('');
    let message = $state('');
    let honeypot = $state('');
    let sending = $state(false);
    let turnstileToken = $state('');
    let turnstileRef: ReturnType<typeof Turnstile> | undefined = $state(undefined);
    const loadedAt = Date.now();

    const turnstileReady = $derived(turnstileToken.length > 0);

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
