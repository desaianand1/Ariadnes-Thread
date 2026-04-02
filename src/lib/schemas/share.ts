import { z } from 'zod';
import { siteConfig } from '$lib/config/site';

export const shareEmailSchema = z.object({
    curatorName: z.string().min(1).max(100).trim(),
    recipientEmail: z.string().email().max(320),
    message: z.string().max(1000).trim().optional().default(''),
    shareUrl: z
        .string()
        .url()
        .refine((url) => url.startsWith(`${siteConfig.url}/`), {
            message: `Share URL must be from ${siteConfig.domain}`
        }),
    collectionNames: z.string().min(1).max(500),
    website: z.string().max(0).optional(),
    loadedAt: z.number()
});

export type ShareEmailData = z.infer<typeof shareEmailSchema>;
