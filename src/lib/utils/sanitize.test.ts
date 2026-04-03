import { describe, it, expect, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));

import { sanitizeSvg, sanitizeHtmlContent } from './sanitize';

describe('sanitizeSvg', () => {
    describe('preserves legitimate SVG content', () => {
        it('preserves a basic SVG icon with path', () => {
            const input =
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2L2 7v10l10 5 10-5V7z" fill="currentColor"/></svg>';

            const result = sanitizeSvg(input);

            expect(result).toContain('<svg');
            expect(result).toContain('<path');
            expect(result).toContain('d="M12 2L2 7v10l10 5 10-5V7z"');
            expect(result).toContain('fill="currentColor"');
        });

        it('preserves SVG with defs, symbol, and use', () => {
            const input =
                '<svg><defs><symbol id="icon"><path d="M0 0h24v24H0z"/></symbol></defs><use href="#icon"/></svg>';

            const result = sanitizeSvg(input);

            expect(result).toContain('<symbol');
            expect(result).toContain('<use');
            expect(result).toContain('href="#icon"');
        });

        it('preserves gradients with stops', () => {
            const input =
                '<svg><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient></defs></svg>';

            const result = sanitizeSvg(input);

            expect(result).toContain('lineargradient');
            expect(result).toContain('stop-color="red"');
            expect(result).toContain('stop-color="blue"');
        });

        it('preserves common presentation attributes', () => {
            const input =
                '<svg><rect fill="#fff" stroke="#000" stroke-width="2" opacity="0.5" transform="rotate(45)"/></svg>';

            const result = sanitizeSvg(input);

            expect(result).toContain('fill="#fff"');
            expect(result).toContain('stroke="#000"');
            expect(result).toContain('stroke-width="2"');
            expect(result).toContain('opacity="0.5"');
            expect(result).toContain('transform="rotate(45)"');
        });

        it('preserves circle, ellipse, rect, and line elements', () => {
            const input =
                '<svg><circle cx="10" cy="10" r="5"/><ellipse cx="10" cy="10" rx="5" ry="3"/><rect x="0" y="0" width="10" height="10" rx="2"/><line x1="0" y1="0" x2="10" y2="10"/></svg>';

            const result = sanitizeSvg(input);

            expect(result).toContain('<circle');
            expect(result).toContain('<ellipse');
            expect(result).toContain('<rect');
            expect(result).toContain('<line');
        });

        it('preserves accessibility attributes on svg root', () => {
            const input =
                '<svg aria-hidden="true" role="img" focusable="false"><path d="M0 0"/></svg>';

            const result = sanitizeSvg(input);

            expect(result).toContain('aria-hidden="true"');
            expect(result).toContain('role="img"');
            expect(result).toContain('focusable="false"');
        });
    });

    describe('strips dangerous content', () => {
        it('removes script elements', () => {
            const input = '<svg><script>alert(1)</script><path d="M0 0"/></svg>';

            const result = sanitizeSvg(input);

            expect(result).not.toContain('script');
            expect(result).not.toContain('alert');
            expect(result).toContain('<path');
        });

        it('removes event handler attributes', () => {
            const input = '<svg onload="alert(1)"><path d="M0 0" onclick="steal()"/></svg>';

            const result = sanitizeSvg(input);

            expect(result).not.toContain('onload');
            expect(result).not.toContain('onclick');
            expect(result).not.toContain('alert');
            expect(result).not.toContain('steal');
        });

        it('removes foreignObject (XSS vector)', () => {
            const input =
                '<svg><foreignObject><body><script>alert(1)</script></body></foreignObject></svg>';

            const result = sanitizeSvg(input);

            expect(result).not.toContain('foreignObject');
            expect(result).not.toContain('foreignobject');
            expect(result).not.toContain('body');
            expect(result).not.toContain('script');
        });

        it('removes iframe, embed, and object elements', () => {
            const input =
                '<svg><iframe src="evil.com"/><embed src="evil.swf"/><object data="evil"/></svg>';

            const result = sanitizeSvg(input);

            expect(result).not.toContain('iframe');
            expect(result).not.toContain('embed');
            expect(result).not.toContain('object');
        });

        it('removes style elements', () => {
            const input = '<svg><style>body{display:none}</style><path d="M0 0"/></svg>';

            const result = sanitizeSvg(input);

            expect(result).not.toContain('<style');
            expect(result).not.toContain('display:none');
        });

        it('blocks all URI schemes in SVG attributes', () => {
            const input = '<svg><use href="javascript:alert(1)"/></svg>';

            const result = sanitizeSvg(input);

            expect(result).not.toContain('javascript');
        });

        it('removes SVG anchor elements with javascript: href', () => {
            const input =
                '<svg><a xlink:href="javascript&#x3A;alert(\'XSS\')"><rect width="1000" height="1000" fill="white"/></a></svg>';

            const result = sanitizeSvg(input);

            expect(result).not.toContain('javascript');
            expect(result).not.toContain('alert');
            // <a> is not in SVG allowlist so the entire element is stripped
            expect(result).not.toContain('<a');
        });

        it('removes CDATA-based script injection', () => {
            const input = "<svg><desc><![CDATA[</desc><script>alert('XSS')</script>]]></svg>";

            const result = sanitizeSvg(input);

            expect(result).not.toContain('script');
            expect(result).not.toContain('alert');
        });

        it('removes nested data URI image with embedded XSS payload', () => {
            const input =
                '<svg><defs><g id="pwn"><image xlink:href="data:image/svg+xml;base64,PHN2Zz48aW1hZ2UgaHJlZj0iMSIgb25lcnJvcj0iYWxlcnQoMSkiIC8+PC9zdmc+"/></g></defs><use xlink:href="#pwn"/></svg>';

            const result = sanitizeSvg(input);

            expect(result).not.toContain('image');
            expect(result).not.toContain('data:');
            expect(result).not.toContain('onerror');
        });

        it('removes rect onclick event handler', () => {
            const input =
                '<svg><rect width="300" height="100" fill="blue" onclick="alert(\'XSS\')" /></svg>';

            const result = sanitizeSvg(input);

            expect(result).not.toContain('onclick');
            expect(result).not.toContain('alert');
            expect(result).toContain('<rect');
            expect(result).toContain('fill="blue"');
        });

        it('removes external image references via xlink:href', () => {
            const input = '<svg><image xlink:href="http://attacker.com/track.png" /></svg>';

            const result = sanitizeSvg(input);

            expect(result).not.toContain('image');
            expect(result).not.toContain('attacker.com');
        });
    }); // end: strips dangerous content

    describe('inline style handling', () => {
        it('preserves safe SVG presentation styles (fill, stroke, etc.)', () => {
            const input =
                '<svg><g style="fill:none;stroke:currentColor;stroke-width:2px;"><path d="M0 0"/></g></svg>';

            const result = sanitizeSvg(input);

            expect(result).toContain('style=');
            expect(result).toContain('fill:none');
            expect(result).toContain('stroke:currentColor');
        });

        it('preserves fill-rule and clip-rule styles', () => {
            const input =
                '<svg><g style="fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;"><path d="M0 0"/></g></svg>';

            const result = sanitizeSvg(input);

            expect(result).toContain('fill-rule:evenodd');
            expect(result).toContain('clip-rule:evenodd');
        });

        it('preserves url(#fragment) for gradient/filter references', () => {
            const input = '<svg><rect style="fill:url(#gradient)" /></svg>';

            const result = sanitizeSvg(input);

            expect(result).toContain('url(#gradient)');
        });

        it('strips CSS expression() injection (IE XSS vector)', () => {
            const input = '<svg><rect style="fill:expression(alert(1))" /></svg>';

            const result = sanitizeSvg(input);

            expect(result).not.toContain('expression');
            expect(result).not.toContain('alert');
        });

        it('strips url(javascript:) in CSS values', () => {
            const input = '<svg><rect style="fill:url(javascript:alert(1))" /></svg>';

            const result = sanitizeSvg(input);

            expect(result).not.toContain('javascript');
        });

        it('strips url(data:) in CSS values', () => {
            const input = '<svg><rect style="fill:url(data:text/html,evil)" /></svg>';

            const result = sanitizeSvg(input);

            expect(result).not.toContain('data:');
        });

        it('strips non-SVG CSS properties (e.g. background)', () => {
            const input = '<svg><rect style="background:url(evil.com)" /></svg>';

            const result = sanitizeSvg(input);

            expect(result).not.toContain('style=');
            expect(result).not.toContain('background');
        });

        it('keeps safe properties and strips dangerous ones in mixed styles', () => {
            const input =
                '<svg><g style="fill:red;-moz-binding:url(evil)"><path d="M0 0"/></g></svg>';

            const result = sanitizeSvg(input);

            expect(result).toContain('fill:red');
            expect(result).not.toContain('-moz-binding');
        });
    });

    describe('real-world Modrinth icon patterns', () => {
        it('preserves a typical loader icon with styled group and paths', () => {
            const input =
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g style="fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;stroke-linejoin:round;"><g style="fill:none;fill-rule:nonzero;stroke-width:24px;"><path d="M12 2L2 7v10l10 5 10-5V7z" stroke="currentColor"/></g></g></svg>';

            const result = sanitizeSvg(input);

            expect(result).toContain('<svg');
            expect(result).toContain('<path');
            expect(result).toContain('fill-rule:evenodd');
            expect(result).toContain('stroke="currentColor"');
        });

        it('preserves svg with version and xml:space attributes', () => {
            const input =
                '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xml:space="preserve" viewBox="0 0 24 24"><path d="M0 0"/></svg>';

            const result = sanitizeSvg(input);

            expect(result).toContain('version="1.1"');
            expect(result).toContain('xml:space="preserve"');
        });
    });

    describe('edge cases', () => {
        it('handles empty string', () => {
            expect(sanitizeSvg('')).toBe('');
        });

        it('handles plain text (no SVG)', () => {
            expect(sanitizeSvg('just text')).toBe('just text');
        });

        it('strips non-SVG HTML elements', () => {
            const input = '<svg><div>not allowed</div><path d="M0 0"/></svg>';

            const result = sanitizeSvg(input);

            expect(result).not.toContain('<div');
            expect(result).toContain('<path');
        });
    });
});

describe('sanitizeHtmlContent', () => {
    describe('preserves standard markdown output', () => {
        it('preserves headings', () => {
            const input = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';

            const result = sanitizeHtmlContent(input);

            expect(result).toContain('<h1>Title</h1>');
            expect(result).toContain('<h2>Subtitle</h2>');
            expect(result).toContain('<h3>Section</h3>');
        });

        it('preserves inline formatting', () => {
            const input = '<p><strong>bold</strong>, <em>italic</em>, <code>code</code></p>';

            const result = sanitizeHtmlContent(input);

            expect(result).toContain('<strong>bold</strong>');
            expect(result).toContain('<em>italic</em>');
            expect(result).toContain('<code>code</code>');
        });

        it('preserves code blocks', () => {
            const input = '<pre><code class="language-js">const x = 1;</code></pre>';

            const result = sanitizeHtmlContent(input);

            expect(result).toContain('<pre><code class="language-js">');
            expect(result).toContain('const x = 1;');
        });

        it('preserves images with safe attributes', () => {
            const input =
                '<img src="https://example.com/img.png" alt="screenshot" title="preview">';

            const result = sanitizeHtmlContent(input);

            expect(result).toContain('src="https://example.com/img.png"');
            expect(result).toContain('alt="screenshot"');
            expect(result).toContain('title="preview"');
        });

        it('preserves tables', () => {
            const input =
                '<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>A</td><td>1</td></tr></tbody></table>';

            const result = sanitizeHtmlContent(input);

            expect(result).toContain('<table>');
            expect(result).toContain('<th>Name</th>');
            expect(result).toContain('<td>A</td>');
        });

        it('preserves lists', () => {
            const input = '<ul><li>One</li><li>Two</li></ul><ol><li>First</li></ol>';

            const result = sanitizeHtmlContent(input);

            expect(result).toContain('<ul><li>One</li>');
            expect(result).toContain('<ol><li>First</li></ol>');
        });

        it('preserves details/summary (collapsible sections)', () => {
            const input = '<details><summary>Spoiler</summary><p>Hidden content</p></details>';

            const result = sanitizeHtmlContent(input);

            expect(result).toContain('<details>');
            expect(result).toContain('<summary>Spoiler</summary>');
        });

        it('preserves del/ins (strikethrough/insertion)', () => {
            const input = '<del>removed</del> <ins>added</ins>';

            const result = sanitizeHtmlContent(input);

            expect(result).toContain('<del>removed</del>');
            expect(result).toContain('<ins>added</ins>');
        });

        it('preserves kbd (keyboard shortcut) elements', () => {
            const input = 'Press <kbd>Ctrl</kbd>+<kbd>C</kbd>';

            const result = sanitizeHtmlContent(input);

            expect(result).toContain('<kbd>Ctrl</kbd>');
        });
    });

    describe('link handling', () => {
        it('adds target="_blank" and rel="noopener noreferrer" to links', () => {
            const input = '<a href="https://modrinth.com">Modrinth</a>';

            const result = sanitizeHtmlContent(input);

            expect(result).toContain('href="https://modrinth.com"');
            expect(result).toContain('target="_blank"');
            expect(result).toContain('rel="noopener noreferrer"');
        });

        it('overrides existing target attribute for safety', () => {
            const input = '<a href="https://example.com" target="_self">Link</a>';

            const result = sanitizeHtmlContent(input);

            expect(result).toContain('target="_blank"');
            expect(result).not.toContain('target="_self"');
        });

        it('preserves mailto links', () => {
            const input = '<a href="mailto:user@example.com">Email</a>';

            const result = sanitizeHtmlContent(input);

            expect(result).toContain('href="mailto:user@example.com"');
        });

        it('strips javascript: URIs from links', () => {
            const input = '<a href="javascript:alert(document.cookie)">Click me</a>';

            const result = sanitizeHtmlContent(input);

            expect(result).not.toContain('javascript');
            expect(result).not.toContain('alert');
        });

        it('strips data: URIs from links', () => {
            const input = '<a href="data:text/html,<script>alert(1)</script>">Click</a>';

            const result = sanitizeHtmlContent(input);

            expect(result).not.toContain('data:text/html');
        });
    });

    describe('GFM task list handling', () => {
        it('preserves checkbox inputs from task lists', () => {
            const input = '<ul><li><input type="checkbox" checked disabled> Done</li></ul>';

            const result = sanitizeHtmlContent(input);

            expect(result).toContain('<input type="checkbox"');
            expect(result).toContain('checked');
            expect(result).toContain('disabled');
        });

        it('strips non-checkbox input elements', () => {
            const input = '<input type="text" value="injected"><input type="password">';

            const result = sanitizeHtmlContent(input);

            expect(result).not.toContain('type="text"');
            expect(result).not.toContain('type="password"');
            expect(result).not.toContain('injected');
        });
    });

    describe('XSS prevention', () => {
        it('removes script tags', () => {
            const input = '<p>Safe</p><script>document.cookie</script>';

            const result = sanitizeHtmlContent(input);

            expect(result).toContain('<p>Safe</p>');
            expect(result).not.toContain('script');
            expect(result).not.toContain('document.cookie');
        });

        it('removes event handler attributes', () => {
            const input = '<img src="x" onerror="alert(1)"><div onmouseover="steal()">';

            const result = sanitizeHtmlContent(input);

            expect(result).not.toContain('onerror');
            expect(result).not.toContain('onmouseover');
            expect(result).not.toContain('alert');
        });

        it('removes iframe, embed, object, and form elements', () => {
            const input =
                '<iframe src="evil.com"></iframe><embed src="evil.swf"><object data="evil"><form action="phish">';

            const result = sanitizeHtmlContent(input);

            expect(result).not.toContain('iframe');
            expect(result).not.toContain('embed');
            expect(result).not.toContain('object');
            expect(result).not.toContain('form');
        });

        it('removes style tags', () => {
            const input = '<style>body{display:none}</style><p>visible</p>';

            const result = sanitizeHtmlContent(input);

            expect(result).not.toContain('<style');
            expect(result).toContain('<p>visible</p>');
        });

        it('strips images with non-http schemes', () => {
            const input = '<img src="javascript:alert(1)" alt="xss">';

            const result = sanitizeHtmlContent(input);

            expect(result).not.toContain('javascript');
        });

        it('handles encoded XSS attempts in attributes', () => {
            const input = '<a href="&#x6A;avascript:alert(1)">xss</a>';

            const result = sanitizeHtmlContent(input);

            expect(result).not.toContain('alert');
        });

        it('strips fully HTML-entity-encoded javascript: URI', () => {
            const input =
                '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;&#97;&#108;&#101;&#114;&#116;&#40;&#39;&#88;&#83;&#83;&#39;&#41;">Click me</a>';

            const result = sanitizeHtmlContent(input);

            expect(result).not.toContain('javascript');
            expect(result).not.toContain('alert');
        });

        it('strips base64 data: URI in links', () => {
            const input =
                '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgnWFNTJyk8L3NjcmlwdD4K">XSS</a>';

            const result = sanitizeHtmlContent(input);

            expect(result).not.toContain('data:text/html');
            expect(result).not.toContain('base64');
        });

        it('strips details element ontoggle event handler', () => {
            const input = "<details open ontoggle=alert('XSS')>";

            const result = sanitizeHtmlContent(input);

            expect(result).not.toContain('ontoggle');
            expect(result).not.toContain('alert');
            expect(result).toContain('<details');
        });

        it('strips svg onload event handler', () => {
            const input = "<svg onload=alert('XSS')>";

            const result = sanitizeHtmlContent(input);

            expect(result).not.toContain('onload');
            expect(result).not.toContain('alert');
        });

        it('strips double-open-bracket script injection', () => {
            const input = "<<script>alert('XSS');//<</script>";

            const result = sanitizeHtmlContent(input);

            expect(result).not.toContain('script');
            expect(result).not.toContain('alert');
        });

        it('strips form-based XSS with formaction javascript: URI', () => {
            const input =
                '<form id="test" onforminput="alert(1)"></form><button form="test" formaction="javascript:alert(1)">Click</button>';

            const result = sanitizeHtmlContent(input);

            expect(result).not.toContain('form');
            expect(result).not.toContain('button');
            expect(result).not.toContain('alert');
            expect(result).not.toContain('javascript');
        });

        it('strips math/mtext mutation XSS', () => {
            const input = '<math><mtext><option><style><img src=x onerror=alert(1)>';

            const result = sanitizeHtmlContent(input);

            expect(result).not.toContain('onerror');
            expect(result).not.toContain('alert');
            expect(result).not.toContain('<style');
        });

        it('strips newline-separated attribute injection', () => {
            const input = '<a name="n" \nhref="javascript:alert(\'XSS\')">you</a>';

            const result = sanitizeHtmlContent(input);

            expect(result).not.toContain('javascript');
            expect(result).not.toContain('alert');
        });
    });

    describe('edge cases', () => {
        it('handles empty string', () => {
            expect(sanitizeHtmlContent('')).toBe('');
        });

        it('passes through plain text', () => {
            expect(sanitizeHtmlContent('Hello world')).toBe('Hello world');
        });

        it('handles deeply nested valid HTML', () => {
            const input = '<blockquote><p><strong><em>deep</em></strong></p></blockquote>';

            const result = sanitizeHtmlContent(input);

            expect(result).toContain('<blockquote>');
            expect(result).toContain('<strong><em>deep</em></strong>');
        });
    });
});

/**
 * DOMPurify integration — behavioral test using the real library.
 * isomorphic-dompurify works in Node.js (vitest) via jsdom,
 * so we can verify the combined pipeline produces correct output.
 */
describe('sanitization with DOMPurify available (browser path)', async () => {
    const DOMPurify = await import('isomorphic-dompurify').then((m) => m.default);

    it('SVG sanitization produces output that DOMPurify also considers safe', () => {
        const malicious = '<svg><script>alert(1)</script><path d="M0 0"/></svg>';

        const ourResult = sanitizeSvg(malicious);
        const purifyResult = DOMPurify.sanitize(ourResult, {
            USE_PROFILES: { svg: true, svgFilters: true },
            ADD_TAGS: ['use']
        });

        expect(purifyResult).not.toContain('script');
        expect(purifyResult).not.toContain('alert');
        expect(purifyResult).toContain('<path');
    });

    it('HTML sanitization produces output that DOMPurify also considers safe', () => {
        const malicious = '<p>Safe</p><script>evil()</script><img src=x onerror=alert(1)>';

        const ourResult = sanitizeHtmlContent(malicious);
        const purifyResult = DOMPurify.sanitize(ourResult, {
            ADD_ATTR: ['target', 'rel']
        });

        expect(purifyResult).toContain('Safe');
        expect(purifyResult).not.toContain('script');
        expect(purifyResult).not.toContain('onerror');
    });

    it('DOMPurify does not strip content that sanitize-html already cleaned', () => {
        const safe =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2L2 7" fill="currentColor"/></svg>';

        const ourResult = sanitizeSvg(safe);
        const purifyResult = DOMPurify.sanitize(ourResult, {
            USE_PROFILES: { svg: true, svgFilters: true },
            ADD_TAGS: ['use']
        });

        expect(purifyResult).toContain('<path');
        expect(purifyResult).toContain('fill="currentColor"');
    });

    it('link target/rel attributes survive both sanitization passes', () => {
        const input = '<a href="https://modrinth.com">Link</a>';

        const ourResult = sanitizeHtmlContent(input);
        const purifyResult = DOMPurify.sanitize(ourResult, {
            ADD_ATTR: ['target', 'rel']
        });

        expect(purifyResult).toContain('href="https://modrinth.com"');
        expect(purifyResult).toContain('target="_blank"');
        expect(purifyResult).toContain('rel="noopener noreferrer"');
    });
});
