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

    it('returns false for truncated hash', async () => {
        const data = textToBytes('hello world');
        // Only first 20 chars of the correct hash — should not match full digest
        expect(await verifySha1(data, '2aae6c35c94fcfb415db')).toBe(false);
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

    it('returns true regardless of hash casing', async () => {
        const data = textToBytes('hello world');
        const expected =
            '309ECC489C12D6EB4CC40F50C902F2B4D0ED77EE511A7C7A9BCD3CA86D4CD86F' +
            '989DD35BC5FF499670DA34255B45B0CFD830E81F605DCF7DC5542E93AE9CD76F';
        expect(await verifySha512(data, expected)).toBe(true);
    });

    it('handles empty input', async () => {
        const data = new Uint8Array(0);
        // SHA-512 of empty string
        const expected =
            'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce' +
            '47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';
        expect(await verifySha512(data, expected)).toBe(true);
    });
});
