import { describe, it, expect, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));

import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
    describe('standard markdown rendering', () => {
        it('renders headings', () => {
            const result = renderMarkdown('# Title\n## Subtitle');

            expect(result).toContain('<h1>Title</h1>');
            expect(result).toContain('<h2>Subtitle</h2>');
        });

        it('renders bold and italic text', () => {
            const result = renderMarkdown('**bold** and *italic*');

            expect(result).toContain('<strong>bold</strong>');
            expect(result).toContain('<em>italic</em>');
        });

        it('renders inline code and code blocks', () => {
            const result = renderMarkdown('Use `npm install`\n\n```js\nconst x = 1;\n```');

            expect(result).toContain('<code>npm install</code>');
            expect(result).toContain('<pre><code');
            expect(result).toContain('const x = 1;');
        });

        it('renders unordered and ordered lists', () => {
            const result = renderMarkdown('- A\n- B\n\n1. First\n2. Second');

            expect(result).toContain('<ul>');
            expect(result).toContain('<li>A</li>');
            expect(result).toContain('<ol>');
            expect(result).toContain('<li>First</li>');
        });

        it('renders blockquotes', () => {
            const result = renderMarkdown('> Important note');

            expect(result).toContain('<blockquote>');
            expect(result).toContain('Important note');
        });

        it('renders images', () => {
            const result = renderMarkdown('![alt text](https://example.com/img.png)');

            expect(result).toContain('<img src="https://example.com/img.png"');
            expect(result).toContain('alt="alt text"');
        });
    });

    describe('link safety', () => {
        it('renders links with target="_blank" and rel="noopener noreferrer"', () => {
            const result = renderMarkdown('[Modrinth](https://modrinth.com)');

            expect(result).toContain('href="https://modrinth.com"');
            expect(result).toContain('target="_blank"');
            expect(result).toContain('rel="noopener noreferrer"');
        });

        it('strips javascript: URIs from markdown links', () => {
            const result = renderMarkdown('[xss](javascript:alert(1))');

            expect(result).not.toContain('javascript');
            expect(result).not.toContain('alert');
        });
    });

    describe('GFM features', () => {
        it('renders tables', () => {
            const result = renderMarkdown('| Name | Value |\n|------|-------|\n| A    | 1     |');

            expect(result).toContain('<table>');
            expect(result).toContain('<th>Name</th>');
            expect(result).toContain('<td>A</td>');
        });

        it('renders strikethrough', () => {
            const result = renderMarkdown('~~removed~~');

            expect(result).toContain('<del>removed</del>');
        });
    });

    describe('XSS prevention', () => {
        it('strips inline script tags from raw HTML in markdown', () => {
            const result = renderMarkdown('Safe text\n\n<script>alert(1)</script>');

            expect(result).toContain('Safe text');
            expect(result).not.toContain('script');
            expect(result).not.toContain('alert');
        });

        it('strips event handlers from raw HTML in markdown', () => {
            const result = renderMarkdown('<img src="x" onerror="alert(1)">');

            expect(result).not.toContain('onerror');
            expect(result).not.toContain('alert');
        });
    });

    describe('edge cases', () => {
        it('handles empty string', () => {
            expect(renderMarkdown('')).toBe('');
        });

        it('handles plain text without markdown syntax', () => {
            const result = renderMarkdown('Just some plain text.');

            expect(result).toContain('Just some plain text.');
        });
    });
});
