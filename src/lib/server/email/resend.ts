import { Resend } from 'resend';
import { getEnvConfig } from '$lib/config/env.server';
import { siteConfig } from '$lib/config/site';
import { TEMPLATE_ALIAS, FROM_NOREPLY } from './registry';

interface GlobalVars {
    year: string;
    supportEmail: string;
}

function getClient(): Resend {
    const config = getEnvConfig();
    if (!config.RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');
    return new Resend(config.RESEND_API_KEY);
}

function globalVars(): GlobalVars {
    return {
        year: new Date().getFullYear().toString(),
        supportEmail: siteConfig.supportEmail
    };
}

/** Strip CR/LF to prevent email header injection */
function sanitizeHeaderValue(value: string): string {
    return value.replace(/[\r\n]/g, '');
}

// Cached template name → Resend UUID lookup (one API call per cold start)
let templateIdCache: Map<string, string> | null = null;

async function resolveTemplateId(resend: Resend, alias: string): Promise<string> {
    if (!templateIdCache) {
        const { data } = await resend.templates.list();
        templateIdCache = new Map(
            (data?.data ?? []).map((t: { name: string; id: string }) => [t.name, t.id])
        );
    }
    const id = templateIdCache.get(alias);
    if (!id) throw new Error(`Template "${alias}" not found in Resend — run sync-templates first`);
    return id;
}

/** Clear cached template IDs (for testing) */
export function clearTemplateCache(): void {
    templateIdCache = null;
}

export async function sendShareEmail(
    to: string,
    params: { curatorName: string; message: string; collectionNames: string; shareUrl: string }
): Promise<{ success: boolean; error?: string }> {
    try {
        const resend = getClient();
        const templateId = await resolveTemplateId(resend, TEMPLATE_ALIAS.SHARE_COLLECTION);

        await resend.emails.send({
            from: FROM_NOREPLY,
            to,
            subject: `${sanitizeHeaderValue(params.curatorName)} shared a mod collection — ${siteConfig.name}`,
            // @ts-expect-error -- Resend SDK types don't expose template_id but the API supports it
            template_id: templateId,
            data: {
                curatorName: params.curatorName,
                message: params.message,
                collectionNames: params.collectionNames,
                shareUrl: params.shareUrl,
                ...globalVars()
            }
        });
        return { success: true };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
            `Failed to send share email to ${to.replace(/(.{2}).*(@.*)/, '$1***$2')}: ${msg}`
        );
        return { success: false, error: msg };
    }
}
