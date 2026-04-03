import { Marked } from 'marked';
import { sanitizeHtmlContent } from './sanitize';

const markedInstance = new Marked({ gfm: true, breaks: true });

export function renderMarkdown(raw: string): string {
    const html = markedInstance.parse(raw, { async: false }) as string;
    return sanitizeHtmlContent(html);
}
