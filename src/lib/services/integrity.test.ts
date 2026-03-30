import { describe, it, expect } from 'vitest';
import { verifySha1, verifySha512 } from './integrity';

function textToBytes(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

describe('verifySha1', () => {
    it('returns true for a correct hash', async () => {
        // SHA-1 of "hello world" = 2aae6c35c94fcfb415dbe95f408b9ce91ee846ed
        const data = textToBytes('hello world');
        expect(await verifySha1(data, '2aae6c35c94fcfb415dbe95f408b9ce91ee846ed')).toBe(true);
    });

    it('returns true regardless of hash casing', async () => {
        const data = textToBytes('hello world');
        expect(await verifySha1(data, '2AAE6C35C94FCFB415DBE95F408B9CE91EE846ED')).toBe(true);
    });

    it('returns false for an incorrect hash', async () => {
        const data = textToBytes('hello world');
        expect(await verifySha1(data, '0000000000000000000000000000000000000000')).toBe(false);
    });

    it('handles empty input', async () => {
        // SHA-1 of empty string = da39a3ee5e6b4b0d3255bfef95601890afd80709
        const data = new Uint8Array(0);
        expect(await verifySha1(data, 'da39a3ee5e6b4b0d3255bfef95601890afd80709')).toBe(true);
    });
});

describe('verifySha512', () => {
    it('returns true for a correct hash', async () => {
        // SHA-512 of "hello world"
        const data = textToBytes('hello world');
        const expected =
            '309ecc489c12d6eb4cc40f50c902f2b4d0ed77ee511a7c7a9bcd3ca86d4cd86f' +
            '989dd35bc5ff499670da34255b45b0cfd830e81f605dcf7dc5542e93ae9cd76f';
        expect(await verifySha512(data, expected)).toBe(true);
    });

    it('returns false for an incorrect hash', async () => {
        const data = textToBytes('hello world');
        expect(await verifySha512(data, 'deadbeef')).toBe(false);
    });
});
