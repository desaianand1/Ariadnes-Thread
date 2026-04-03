/**
 * Client-side HTML/SVG sanitization using DOMPurify.
 *
 * DOMPurify uses the browser's native DOM parser, which catches mutation XSS
 * and encoding bypasses that parser-based sanitizers can miss. All functions
 * are async — they await DOMPurify initialization before returning, so no
 * unsanitized content can reach {@html} rendering.
 *
 * For server-side sanitization (Cloudflare Workers, Node.js), use
 * sanitize.server.ts which uses sanitize-html (parser-based, no DOM needed).
 */

type DOMPurifyInstance = {
    sanitize(dirty: string, config?: Record<string, unknown>): string;
    addHook(entryPoint: string, hookFunction: (node: Element) => void): void;
};

const _purifyReady: Promise<DOMPurifyInstance> = import('isomorphic-dompurify').then((mod) => {
    const purify = mod.default as unknown as DOMPurifyInstance;
    purify.addHook('afterSanitizeAttributes', (node: Element) => {
        if (node.tagName === 'A') {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer');
        }
    });
    return purify;
});

/**
 * Sanitize SVG content via DOMPurify's SVG profile.
 * Awaits DOMPurify initialization — never returns unsanitized content.
 */
export async function sanitizeSvg(raw: string): Promise<string> {
    const purify = await _purifyReady;
    return purify.sanitize(raw, {
        USE_PROFILES: { svg: true, svgFilters: true },
        ADD_TAGS: ['use']
    });
}

/**
 * Sanitize rich HTML (markdown output, user-generated content) via DOMPurify.
 * Awaits DOMPurify initialization — never returns unsanitized content.
 */
export async function sanitizeHtmlContent(raw: string): Promise<string> {
    const purify = await _purifyReady;
    return purify.sanitize(raw, {
        ADD_ATTR: ['target', 'rel']
    });
}
