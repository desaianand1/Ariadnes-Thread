import { describe, it, expect } from 'vitest';
import { neutralizeLinks } from './email-sanitize';

describe('neutralizeLinks', () => {
    it('defangs an https URL', () => {
        // Arrange
        const input = 'visit https://evil.com/setup.exe';

        // Act
        const result = neutralizeLinks(input);

        // Assert
        expect(result).toBe('visit https[:]//evil.com/setup.exe');
    });

    it('defangs an http URL', () => {
        // Arrange
        const input = 'download http://evil.com';

        // Act
        const result = neutralizeLinks(input);

        // Assert
        expect(result).toBe('download http[:]//evil.com');
    });

    it('defangs a bare www. link', () => {
        // Arrange
        const input = 'go to www.example.com for details';

        // Act
        const result = neutralizeLinks(input);

        // Assert
        expect(result).toBe('go to www[.]example.com for details');
    });

    it('defangs uppercase HTTPS', () => {
        // Arrange
        const input = 'HTTPS://EVIL.COM';

        // Act
        const result = neutralizeLinks(input);

        // Assert
        expect(result).toBe('HTTPS[:]//EVIL.COM');
    });

    it('handles multiple URLs in one message', () => {
        // Arrange
        const input = 'first https://a.com and https://b.com also www.c.com';

        // Act
        const result = neutralizeLinks(input);

        // Assert
        expect(result).toBe('first https[:]//a.com and https[:]//b.com also www[.]c.com');
    });

    it('leaves plain text untouched', () => {
        // Arrange
        const input = 'Hey friend, check these out!';

        // Act
        const result = neutralizeLinks(input);

        // Assert
        expect(result).toBe('Hey friend, check these out!');
    });

    it('leaves text with colons not forming URLs untouched', () => {
        // Arrange
        const input = 'the ratio is 3:2 and time is 10:30';

        // Act
        const result = neutralizeLinks(input);

        // Assert
        expect(result).toBe('the ratio is 3:2 and time is 10:30');
    });

    it('returns empty string unchanged', () => {
        // Arrange
        const input = '';

        // Act
        const result = neutralizeLinks(input);

        // Assert
        expect(result).toBe('');
    });
});
