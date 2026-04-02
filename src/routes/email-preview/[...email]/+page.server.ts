import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { Renderer } from 'better-svelte-email';
import { emailList, createEmail, sendEmail } from '@better-svelte-email/preview';
import { CUSTOM_CSS } from '$lib/emails/shared/css';
import { FROM_NOREPLY } from '$lib/server/email/registry';

function guardDev() {
    if (!dev) throw error(404);
}

export function load() {
    guardDev();
    return { emails: emailList({ path: '/src/lib/emails' }) };
}

// @better-svelte-email/preview re-exports Renderer from @better-svelte-email/server
// which has the same API but different private field declarations — cast through unknown
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderer = new Renderer({ customCSS: CUSTOM_CSS }) as any;

const baseActions = {
    ...createEmail({ renderer }),
    ...sendEmail({
        renderer,
        resendApiKey: env.RESEND_API_KEY,
        from: FROM_NOREPLY
    })
};

// Wrap each action with a dev guard
export const actions = Object.fromEntries(
    Object.entries(baseActions).map(([key, handler]) => [
        key,
        async (event: Parameters<typeof handler>[0]) => {
            guardDev();
            return handler(event);
        }
    ])
);
