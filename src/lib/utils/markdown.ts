import { Marked } from 'marked';
import { sanitizeHtmlContent } from './sanitize';

const markedInstance = new Marked({ gfm: true, breaks: true });

export async function renderMarkdown(raw: string): Promise<string> {
    const html = markedInstance.parse(raw, { async: false }) as string;
    return sanitizeHtmlContent(html);
}
