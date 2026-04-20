import { z } from 'zod';
import { siteConfig } from '$lib/config/site';

export const shareEmailSchema = z.object({
    // .trim() must precede .min()/.max() so whitespace-only input is rejected
    // before length checks apply ("   " would otherwise pass min(1)).
    curatorName: z.string().trim().min(1).max(100),
    recipientEmail: z.string().email().max(320),
    message: z.string().trim().max(1000).optional().default(''),
    shareUrl: z
        .string()
        .url()
        .refine(
            (url) => {
                // Parse to compare the URL's protocol, hostname, and port against
                // our canonical https://modrinth.download. Stronger than startsWith
                // and resistant to userinfo (https://x@modrinth.download),
                // port-suffix (https://modrinth.download:8080), wrong-scheme
                // (http://, ftp://, file://), and prefix-match
                // (https://modrinth.download.evil.com) tricks.
                try {
                    const parsed = new URL(url);
                    return (
                        parsed.protocol === 'https:' &&
                        parsed.hostname === siteConfig.domain &&
                        parsed.port === ''
                    );
                } catch {
                    return false;
                }
            },
            { message: `Share URL must be from ${siteConfig.domain}` }
        ),
    collectionNames: z.string().min(1).max(500),
    website: z.string().max(0).optional(),
    loadedAt: z.number(),
    turnstileToken: z.string().min(1).max(2048)
});

export type ShareEmailData = z.infer<typeof shareEmailSchema>;
