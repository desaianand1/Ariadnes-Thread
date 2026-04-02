import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const API_DELAY_MS = 600;
const MAX_RETRIES = 3;

async function main() {
    if (!RESEND_API_KEY) {
        console.error('RESEND_API_KEY env var is required');
        process.exit(1);
    }

    const server = await createServer({
        plugins: [svelte(), tailwindcss()],
        server: { middlewareMode: true },
        appType: 'custom'
    });

    try {
        const { Renderer } = await server.ssrLoadModule('better-svelte-email');
        const { CUSTOM_CSS } = await server.ssrLoadModule('$lib/emails/shared/css');
        const { TEMPLATES } = await server.ssrLoadModule('$lib/server/email/registry');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const renderer = new Renderer({ customCSS: CUSTOM_CSS }) as any;
        const resend = new Resend(RESEND_API_KEY);

        const { data: existing } = await resend.templates.list();
        const existingByAlias = new Map(
            (existing?.data ?? []).map((t: { name: string; id: string }) => [t.name, t])
        );

        let created = 0,
            updated = 0,
            failed = 0;

        for (const tmpl of TEMPLATES) {
            try {
                const html: string = await renderer.render(tmpl.component, {
                    props: tmpl.placeholders
                });
                const existingTmpl = existingByAlias.get(tmpl.alias) as
                    | { id: string; name: string }
                    | undefined;

                if (existingTmpl) {
                    await withRetry(() =>
                        resend.templates.update(existingTmpl.id, {
                            name: tmpl.alias,
                            subject: tmpl.subject,
                            from: tmpl.from,
                            html
                        })
                    );
                    await delay(API_DELAY_MS);
                    await withRetry(() => resend.templates.publish(existingTmpl.id));
                    console.log(`Updated: ${tmpl.alias} (${existingTmpl.id})`);
                    updated++;
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const result: any = await withRetry(
                        () =>
                            resend.templates.create({
                                name: tmpl.alias,
                                subject: tmpl.subject,
                                from: tmpl.from,
                                html
                            }) as unknown as Promise<unknown>
                    );
                    await delay(API_DELAY_MS);
                    if (result.data?.id) {
                        await withRetry(() => resend.templates.publish(result.data!.id));
                    }
                    console.log(`Created: ${tmpl.alias} (${result.data?.id})`);
                    created++;
                }

                await delay(API_DELAY_MS);
            } catch (err) {
                console.error(`Failed: ${tmpl.alias}:`, err);
                failed++;
            }
        }

        console.log(
            `\nSynced ${TEMPLATES.length} templates (${created} created, ${updated} updated, ${failed} failed)`
        );
        if (failed > 0) process.exit(1);
    } finally {
        await server.close();
    }
}

async function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (err: unknown) {
            const statusCode = (err as { statusCode?: number })?.statusCode;
            if (statusCode === 429 && i < retries - 1) {
                const backoff = 1000 * Math.pow(2, i);
                console.warn(`Rate limited, retrying in ${backoff}ms...`);
                await delay(backoff);
                continue;
            }
            throw err;
        }
    }
    throw new Error('Max retries exceeded');
}

main();
