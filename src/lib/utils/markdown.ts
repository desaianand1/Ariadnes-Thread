import { Marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

const markedInstance = new Marked({ gfm: true, breaks: true });

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
    }
});

export function renderMarkdown(raw: string): string {
    const html = markedInstance.parse(raw, { async: false }) as string;
    return DOMPurify.sanitize(html, {
        ADD_ATTR: ['target', 'rel']
    });
}
