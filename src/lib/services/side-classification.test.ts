import { describe, it, expect } from 'vitest';
import { classifySide } from './side-classification';

describe('classifySide', () => {
	// Full 3×3 matrix (after unknown→optional normalization)
	it('required/required → both', () => {
		expect(classifySide('required', 'required')).toBe('both');
	});

	it('required/optional → both', () => {
		expect(classifySide('required', 'optional')).toBe('both');
	});

	it('required/unsupported → client', () => {
		expect(classifySide('required', 'unsupported')).toBe('client');
	});

	it('optional/required → both', () => {
		expect(classifySide('optional', 'required')).toBe('both');
	});

	it('optional/optional → both', () => {
		expect(classifySide('optional', 'optional')).toBe('both');
	});

	it('optional/unsupported → client', () => {
		expect(classifySide('optional', 'unsupported')).toBe('client');
	});

	it('unsupported/required → server', () => {
		expect(classifySide('unsupported', 'required')).toBe('server');
	});

	it('unsupported/optional → server', () => {
		expect(classifySide('unsupported', 'optional')).toBe('server');
	});

	it('unsupported/unsupported → both (safe default)', () => {
		expect(classifySide('unsupported', 'unsupported')).toBe('both');
	});

	// unknown normalization
	it('unknown/required → both (unknown normalized to optional)', () => {
		expect(classifySide('unknown', 'required')).toBe('both');
	});

	it('required/unknown → both (unknown normalized to optional)', () => {
		expect(classifySide('required', 'unknown')).toBe('both');
	});

	it('unknown/unknown → both', () => {
		expect(classifySide('unknown', 'unknown')).toBe('both');
	});

	it('unknown/unsupported → client', () => {
		expect(classifySide('unknown', 'unsupported')).toBe('client');
	});

	it('unsupported/unknown → server', () => {
		expect(classifySide('unsupported', 'unknown')).toBe('server');
	});
});
