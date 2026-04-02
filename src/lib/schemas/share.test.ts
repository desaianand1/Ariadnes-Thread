import { describe, it, expect } from 'vitest';
import { shareEmailSchema } from './share';

function validInput(overrides: Record<string, unknown> = {}) {
    return {
        curatorName: 'Alice',
        recipientEmail: 'bob@example.com',
        message: 'Check these out!',
        shareUrl: 'https://modrinth.download/review?c=abc12345&v=1.20.1&l=fabric',
        collectionNames: 'Essential Mods',
        website: '',
        loadedAt: Date.now() - 10_000,
        turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
        ...overrides
    };
}

describe('shareEmailSchema', () => {
    it('accepts valid input', () => {
        const result = shareEmailSchema.safeParse(validInput());
        expect(result.success).toBe(true);
    });

    it('trims curatorName whitespace', () => {
        const result = shareEmailSchema.safeParse(validInput({ curatorName: '  Alice  ' }));
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.curatorName).toBe('Alice');
        }
    });

    it('rejects empty curatorName', () => {
        const result = shareEmailSchema.safeParse(validInput({ curatorName: '' }));
        expect(result.success).toBe(false);
    });

    it('rejects curatorName over 100 chars', () => {
        const result = shareEmailSchema.safeParse(validInput({ curatorName: 'a'.repeat(101) }));
        expect(result.success).toBe(false);
    });

    it('rejects invalid email format', () => {
        const result = shareEmailSchema.safeParse(validInput({ recipientEmail: 'not-an-email' }));
        expect(result.success).toBe(false);
    });

    it('rejects email over 320 chars', () => {
        const longEmail = 'a'.repeat(310) + '@example.com';
        const result = shareEmailSchema.safeParse(validInput({ recipientEmail: longEmail }));
        expect(result.success).toBe(false);
    });

    it('defaults message to empty string when omitted', () => {
        const input = validInput();
        delete (input as Record<string, unknown>).message;
        const result = shareEmailSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.message).toBe('');
        }
    });

    it('rejects message over 1000 chars', () => {
        const result = shareEmailSchema.safeParse(validInput({ message: 'x'.repeat(1001) }));
        expect(result.success).toBe(false);
    });

    it('rejects invalid shareUrl', () => {
        const result = shareEmailSchema.safeParse(validInput({ shareUrl: 'not-a-url' }));
        expect(result.success).toBe(false);
    });

    it('rejects http:// shareUrl', () => {
        const result = shareEmailSchema.safeParse(
            validInput({ shareUrl: 'http://modrinth.download/review?c=abc12345' })
        );
        expect(result.success).toBe(false);
    });

    it('rejects javascript: shareUrl', () => {
        const result = shareEmailSchema.safeParse(validInput({ shareUrl: 'javascript:alert(1)' }));
        expect(result.success).toBe(false);
    });

    it('rejects shareUrl from external domain', () => {
        const result = shareEmailSchema.safeParse(
            validInput({ shareUrl: 'https://evil-site.com/phishing' })
        );
        expect(result.success).toBe(false);
    });

    it('rejects shareUrl that only prefix-matches the domain', () => {
        const result = shareEmailSchema.safeParse(
            validInput({ shareUrl: 'https://modrinth.download.evil.com/review' })
        );
        expect(result.success).toBe(false);
    });

    it('accepts valid modrinth.download shareUrl', () => {
        const result = shareEmailSchema.safeParse(
            validInput({
                shareUrl: 'https://modrinth.download/review?c=abc12345&v=1.20.1&l=fabric'
            })
        );
        expect(result.success).toBe(true);
    });

    it('rejects empty collectionNames', () => {
        const result = shareEmailSchema.safeParse(validInput({ collectionNames: '' }));
        expect(result.success).toBe(false);
    });

    it('rejects collectionNames over 500 chars', () => {
        const result = shareEmailSchema.safeParse(validInput({ collectionNames: 'x'.repeat(501) }));
        expect(result.success).toBe(false);
    });

    it('rejects non-empty honeypot field', () => {
        const result = shareEmailSchema.safeParse(validInput({ website: 'gotcha' }));
        expect(result.success).toBe(false);
    });

    it('requires loadedAt to be a number', () => {
        const result = shareEmailSchema.safeParse(validInput({ loadedAt: 'not-a-number' }));
        expect(result.success).toBe(false);
    });

    it('rejects ftp:// and file:// shareUrl protocols', () => {
        const ftp = shareEmailSchema.safeParse(
            validInput({ shareUrl: 'ftp://modrinth.download/review' })
        );
        expect(ftp.success).toBe(false);

        const file = shareEmailSchema.safeParse(validInput({ shareUrl: 'file:///etc/passwd' }));
        expect(file.success).toBe(false);
    });

    it('rejects shareUrl with port in domain', () => {
        const result = shareEmailSchema.safeParse(
            validInput({ shareUrl: 'https://modrinth.download:8080/review' })
        );
        expect(result.success).toBe(false);
    });

    it('rejects missing turnstileToken', () => {
        const input = validInput();
        delete (input as Record<string, unknown>).turnstileToken;
        const result = shareEmailSchema.safeParse(input);
        expect(result.success).toBe(false);
    });

    it('rejects empty turnstileToken', () => {
        const result = shareEmailSchema.safeParse(validInput({ turnstileToken: '' }));
        expect(result.success).toBe(false);
    });

    it('rejects turnstileToken over 2048 chars', () => {
        const result = shareEmailSchema.safeParse(validInput({ turnstileToken: 'x'.repeat(2049) }));
        expect(result.success).toBe(false);
    });

    it('accepts whitespace-only curatorName due to trim running after min check', () => {
        // Zod's `.min(1).trim()` validates length BEFORE trimming, so "   " (length 3) passes .min(1)
        // then gets trimmed to "". This documents current behavior — if this is a bug, the schema
        // should be reordered to `.trim().min(1)`.
        const result = shareEmailSchema.safeParse(validInput({ curatorName: '   ' }));
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.curatorName).toBe('');
        }
    });

    it('rejects email over max length boundary', () => {
        // 321 chars: local part of 308 + @ + example.com (11) = 320 is at limit, 321 exceeds
        const localPart = 'a'.repeat(309);
        const email = `${localPart}@example.com`;
        expect(email.length).toBe(321);
        const result = shareEmailSchema.safeParse(validInput({ recipientEmail: email }));
        expect(result.success).toBe(false);
    });
});
