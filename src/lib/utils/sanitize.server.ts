/**
 * Server-only HTML/SVG sanitization using sanitize-html.
 *
 * Parser-based — no DOM dependency, works in Cloudflare Workers, Node.js,
 * and any edge runtime. For client-side sanitization, use sanitize.ts which
 * delegates to DOMPurify (browser-native DOM parser).
 */

import sanitizeHtml from 'sanitize-html';

// ------------------------------------------------------------------
// SVG allowlist configuration
// ------------------------------------------------------------------

const SVG_ALLOWED_TAGS = [
    'svg',
    'g',
    'defs',
    'symbol',
    'use',
    'clippath',
    'path',
    'circle',
    'ellipse',
    'rect',
    'line',
    'polyline',
    'polygon',
    'text',
    'tspan',
    'lineargradient',
    'radialgradient',
    'stop',
    'mask',
    'title',
    'desc'
];

const SVG_SELF_CLOSING = [
    'path',
    'circle',
    'ellipse',
    'rect',
    'line',
    'polyline',
    'polygon',
    'stop',
    'use'
];

const SVG_GLOBAL_ATTRS = [
    'id',
    'class',
    'style',
    'fill',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-dasharray',
    'stroke-dashoffset',
    'stroke-miterlimit',
    'stroke-opacity',
    'fill-opacity',
    'fill-rule',
    'clip-rule',
    'opacity',
    'transform',
    'clip-path',
    'mask',
    'color',
    'display',
    'visibility',
    'enable-background'
];

const SVG_PER_TAG_ATTRS: Record<string, string[]> = {
    svg: [
        'viewbox',
        'xmlns',
        'xmlns:xlink',
        'xml:space',
        'version',
        'width',
        'height',
        'preserveaspectratio',
        'aria-hidden',
        'role',
        'focusable'
    ],
    path: ['d'],
    circle: ['cx', 'cy', 'r'],
    ellipse: ['cx', 'cy', 'rx', 'ry'],
    rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
    line: ['x1', 'y1', 'x2', 'y2'],
    polyline: ['points'],
    polygon: ['points'],
    use: ['href', 'xlink:href', 'x', 'y', 'width', 'height'],
    text: ['x', 'y', 'dx', 'dy', 'text-anchor', 'font-size', 'font-family', 'font-weight'],
    tspan: ['x', 'y', 'dx', 'dy'],
    lineargradient: ['x1', 'y1', 'x2', 'y2', 'gradientunits', 'gradienttransform'],
    radialgradient: ['cx', 'cy', 'r', 'fx', 'fy', 'gradientunits', 'gradienttransform'],
    stop: ['offset', 'stop-color', 'stop-opacity'],
    clippath: ['clippathunits'],
    mask: ['maskunits', 'maskcontentunits', 'x', 'y', 'width', 'height'],
    symbol: ['viewbox', 'preserveaspectratio']
};

const svgAllowedAttributes: Record<string, string[]> = {};
for (const tag of SVG_ALLOWED_TAGS) {
    svgAllowedAttributes[tag] = [...SVG_GLOBAL_ATTRS, ...(SVG_PER_TAG_ATTRS[tag] ?? [])];
}

// Block expression(), javascript:, vbscript:, data: URIs in CSS values
// while allowing url(#fragment) for SVG gradient/filter references
const SVG_SAFE_CSS = [/^(?!.*expression\s*\()(?!.*(?:javascript|vbscript|data)\s*:).*$/i];
const SVG_CSS_ALLOWLIST: Record<string, RegExp[]> = {};
const safeCssProps = [
    'fill',
    'fill-rule',
    'fill-opacity',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-miterlimit',
    'stroke-dasharray',
    'stroke-dashoffset',
    'stroke-opacity',
    'clip-rule',
    'clip-path',
    'opacity',
    'display',
    'visibility',
    'color',
    'transform',
    'enable-background'
];
for (const prop of safeCssProps) {
    SVG_CSS_ALLOWLIST[prop] = SVG_SAFE_CSS;
}

const SVG_CONFIG: sanitizeHtml.IOptions = {
    allowedTags: SVG_ALLOWED_TAGS,
    allowedAttributes: svgAllowedAttributes,
    allowedStyles: { '*': SVG_CSS_ALLOWLIST },
    selfClosing: SVG_SELF_CLOSING,
    allowedSchemes: [],
    parser: { lowerCaseTags: true, lowerCaseAttributeNames: true }
};

// ------------------------------------------------------------------
// Rich HTML allowlist configuration (markdown output)
// ------------------------------------------------------------------

const HTML_CONFIG: sanitizeHtml.IOptions = {
    allowedTags: [
        ...sanitizeHtml.defaults.allowedTags,
        'img',
        'h1',
        'h2',
        'details',
        'summary',
        'del',
        'ins',
        'sup',
        'sub',
        'abbr',
        'kbd',
        'mark',
        'dl',
        'dt',
        'dd',
        'figure',
        'figcaption',
        'input'
    ],
    allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        a: ['href', 'name', 'target', 'rel', 'title'],
        img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading'],
        input: ['type', 'checked', 'disabled'],
        td: ['align', 'valign', 'colspan', 'rowspan'],
        th: ['align', 'valign', 'colspan', 'rowspan'],
        '*': ['id', 'class']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    // Only allow checkbox inputs (GFM task lists), strip all others
    exclusiveFilter: (frame) => frame.tag === 'input' && frame.attribs.type !== 'checkbox',
    transformTags: {
        a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }, true)
    }
};

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

/** Sanitize SVG content via parser-based allowlist. */
export function sanitizeSvg(raw: string): string {
    return sanitizeHtml(raw, SVG_CONFIG);
}

/**
 * Sanitize rich HTML (markdown output, user-generated content) via
 * parser-based allowlist.
 */
export function sanitizeHtmlContent(raw: string): string {
    return sanitizeHtml(raw, HTML_CONFIG);
}
