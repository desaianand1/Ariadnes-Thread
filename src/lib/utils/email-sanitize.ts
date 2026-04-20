/**
 * Break plaintext URLs and bare domains so email clients don't auto-linkify them.
 *
 * Svelte escapes HTML but Gmail/Apple Mail/Outlook turn "https://example.com"
 * into a clickable link at render time. Because share emails are sent from
 * noreply@modrinth.download, that clickable link would appear to come from
 * our domain — a phishing vector despite the rate-limit (3/24h/recipient).
 *
 * Replacing ":" and "." with bracketed variants ("[:]", "[.]") is the standard
 * SOC convention for rendering defanged URLs: still readable by humans, no
 * longer a valid URL for the mail client's auto-linker.
 */
export function neutralizeLinks(text: string): string {
    return text
        .replace(/\bhttps?:\/\//gi, (match) => match.replace(':', '[:]'))
        .replace(/\bwww\./gi, 'www[.]');
}
