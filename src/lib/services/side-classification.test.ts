import { describe, it, expect } from 'vitest';
import { classifySide, classifyEnvironment, classifyProject } from './side-classification';
import type { EnvironmentEnum, SideRequirement } from '$lib/api/types';

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

describe('environment-based ZIP routing', () => {
    describe('mods included only in the client download', () => {
        it('client-only mods go in client ZIP', () => {
            expect(classifyEnvironment('client_only')).toBe('client');
        });

        it('singleplayer-only mods go in client ZIP', () => {
            expect(classifyEnvironment('singleplayer_only')).toBe('client');
        });
    });

    describe('mods included only in the server download', () => {
        it('server-only mods go in server ZIP', () => {
            expect(classifyEnvironment('server_only')).toBe('server');
        });

        it('dedicated-server mods go in server ZIP', () => {
            expect(classifyEnvironment('dedicated_server_only')).toBe('server');
        });
    });

    describe('mods included in both downloads', () => {
        it('mods required on both sides', () => {
            expect(classifyEnvironment('client_and_server')).toBe('both');
        });

        it('server mods with optional client enhancement', () => {
            expect(classifyEnvironment('server_only_client_optional')).toBe('both');
        });

        it('client mods with optional server enhancement', () => {
            expect(classifyEnvironment('client_only_server_optional')).toBe('both');
        });

        it('mods that work on either side independently', () => {
            expect(classifyEnvironment('client_or_server')).toBe('both');
        });

        it('mods that prefer both sides', () => {
            expect(classifyEnvironment('client_or_server_prefers_both')).toBe('both');
        });

        it('mods with unknown environment', () => {
            expect(classifyEnvironment('unknown')).toBe('both');
        });
    });
});

describe('environment source precedence', () => {
    it('uses the resolved version environment when available', () => {
        expect(classifyProject('client_only', 'required', 'required')).toBe('client');
    });

    it('falls back to project legacy fields when version has no environment', () => {
        expect(classifyProject(undefined, 'required', 'unsupported')).toBe('client');
    });

    it('falls back to legacy fields when version environment is unknown', () => {
        expect(classifyProject('unknown', 'unsupported', 'required')).toBe('server');
    });

    it('defaults to both ZIPs when no environment info exists at all', () => {
        expect(classifyProject(undefined, undefined, undefined)).toBe('both');
    });

    it('version environment takes precedence over conflicting legacy fields', () => {
        expect(classifyProject('client_only', 'unsupported', 'required')).toBe('client');
    });
});

describe('backward compatibility with legacy fields', () => {
    it('projects without environment field classify identically to current behavior', () => {
        const sides: SideRequirement[] = ['required', 'optional', 'unsupported', 'unknown'];
        for (const clientSide of sides) {
            for (const serverSide of sides) {
                const legacy = classifySide(clientSide, serverSide);
                const migrated = classifyProject(undefined, clientSide, serverSide);
                expect(migrated).toBe(legacy);
            }
        }
    });
});

describe('resilience', () => {
    it('handles an unrecognized environment value by defaulting to both ZIPs', () => {
        expect(classifyEnvironment('some_future_value' as EnvironmentEnum)).toBe('both');
    });

    it('handles undefined environment with undefined legacy fields by defaulting to both', () => {
        expect(classifyProject(undefined, undefined, undefined)).toBe('both');
    });

    it('handles null-ish environment the same as undefined', () => {
        expect(classifyProject(null as unknown as undefined, 'required', 'unsupported')).toBe(
            'client'
        );
    });
});
