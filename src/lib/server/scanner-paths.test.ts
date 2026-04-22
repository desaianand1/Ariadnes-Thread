import { describe, it, expect } from 'vitest';
import { isScannerPath } from './scanner-paths';

describe('isScannerPath', () => {
    it('matches exact WordPress login path', () => {
        // Arrange
        const path = '/wp-login.php';

        // Act
        const result = isScannerPath(path);

        // Assert
        expect(result).toBe(true);
    });

    it('matches WordPress wlwmanifest under wp- prefix', () => {
        // Arrange
        const path = '/wp-includes/wlwmanifest.xml';

        // Act
        const result = isScannerPath(path);

        // Assert
        expect(result).toBe(true);
    });

    it('matches .git exposure probe', () => {
        // Arrange
        const path = '/.git/config';

        // Act
        const result = isScannerPath(path);

        // Assert
        expect(result).toBe(true);
    });

    it('matches .env probe via prefix', () => {
        // Arrange
        const path = '/.env.production';

        // Act
        const result = isScannerPath(path);

        // Assert
        expect(result).toBe(true);
    });

    it('matches phpMyAdmin probe with nested path', () => {
        // Arrange
        const path = '/phpmyadmin/index.php';

        // Act
        const result = isScannerPath(path);

        // Assert
        expect(result).toBe(true);
    });

    it('matches xmlrpc probe', () => {
        // Arrange
        const path = '/xmlrpc.php';

        // Act
        const result = isScannerPath(path);

        // Assert
        expect(result).toBe(true);
    });

    it('matches year archive fan-out used by WordPress scanners', () => {
        // Arrange
        const path = '/2024/01/hello-world';

        // Act
        const result = isScannerPath(path);

        // Assert
        expect(result).toBe(true);
    });

    it('matches /login exact', () => {
        // Arrange
        const path = '/login';

        // Act
        const result = isScannerPath(path);

        // Assert
        expect(result).toBe(true);
    });

    it('does not match the home path', () => {
        // Arrange
        const path = '/';

        // Act
        const result = isScannerPath(path);

        // Assert
        expect(result).toBe(false);
    });

    it('does not match the review path', () => {
        // Arrange
        const path = '/review/abc123';

        // Act
        const result = isScannerPath(path);

        // Assert
        expect(result).toBe(false);
    });

    it('does not match legitimate API paths', () => {
        // Arrange
        const path = '/api/resolve';

        // Act
        const result = isScannerPath(path);

        // Assert
        expect(result).toBe(false);
    });

    it('does not match /api/health', () => {
        // Arrange
        const path = '/api/health';

        // Act
        const result = isScannerPath(path);

        // Assert
        expect(result).toBe(false);
    });

    it('is case-sensitive — uppercase scanner paths are not blocked', () => {
        // Scanners predominantly use lowercase; we document the current behavior.
        // If mixed-case probes appear, extend the lists or normalize.

        // Arrange
        const path = '/WP-LOGIN.PHP';

        // Act
        const result = isScannerPath(path);

        // Assert
        expect(result).toBe(false);
    });

    it('exact match requires the full path — /loginhelp does not match /login', () => {
        // Arrange
        const path = '/loginhelp';

        // Act
        const result = isScannerPath(path);

        // Assert
        expect(result).toBe(false);
    });

    it('trailing slash on /admin/ is matched as exact', () => {
        // Arrange
        const path = '/admin/';

        // Act
        const result = isScannerPath(path);

        // Assert
        expect(result).toBe(true);
    });

    it('matches wordpress prefix path', () => {
        // Arrange
        const path = '/wordpress/wp-login.php';

        // Act
        const result = isScannerPath(path);

        // Assert
        expect(result).toBe(true);
    });

    it('matches /.aws credentials probe', () => {
        // Arrange
        const path = '/.aws/credentials';

        // Act
        const result = isScannerPath(path);

        // Assert
        expect(result).toBe(true);
    });

    it('matches /vendor/phpunit RCE probe', () => {
        // Arrange
        const path = '/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php';

        // Act
        const result = isScannerPath(path);

        // Assert
        expect(result).toBe(true);
    });

    it('does not match URL-encoded scanner paths', () => {
        // No URL decoding is performed — %77 is 'w' but stays encoded
        const result = isScannerPath('/%77p-login.php');

        expect(result).toBe(false);
    });

    it('matches scanner path prefix even with appended query string', () => {
        // Prefix match on /wp- catches the path regardless of trailing content
        const result = isScannerPath('/wp-login.php?redirect_to=X');

        expect(result).toBe(true);
    });
});
