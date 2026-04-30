import { describe, it, expect } from 'vitest';
import { isScannerPath } from './scanner-paths';

describe('isScannerPath', () => {
    // --- Existing prefix / exact tests ---

    it('matches exact WordPress login path', () => {
        expect(isScannerPath('/wp-login.php')).toBe(true);
    });

    it('matches WordPress wlwmanifest under wp- prefix', () => {
        expect(isScannerPath('/wp-includes/wlwmanifest.xml')).toBe(true);
    });

    it('matches .git exposure probe', () => {
        expect(isScannerPath('/.git/config')).toBe(true);
    });

    it('matches .env probe via prefix', () => {
        expect(isScannerPath('/.env.production')).toBe(true);
    });

    it('matches phpMyAdmin probe with nested path', () => {
        expect(isScannerPath('/phpmyadmin/index.php')).toBe(true);
    });

    it('matches xmlrpc probe', () => {
        expect(isScannerPath('/xmlrpc.php')).toBe(true);
    });

    it('matches year archive fan-out used by WordPress scanners', () => {
        expect(isScannerPath('/2024/01/hello-world')).toBe(true);
    });

    it('matches /login exact', () => {
        expect(isScannerPath('/login')).toBe(true);
    });

    it('trailing slash on /admin/ is matched as exact', () => {
        expect(isScannerPath('/admin/')).toBe(true);
    });

    it('matches wordpress prefix path', () => {
        expect(isScannerPath('/wordpress/wp-login.php')).toBe(true);
    });

    it('matches /.aws credentials probe', () => {
        expect(isScannerPath('/.aws/credentials')).toBe(true);
    });

    it('matches /vendor/phpunit RCE probe', () => {
        expect(isScannerPath('/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php')).toBe(true);
    });

    it('matches scanner path prefix even with appended query string', () => {
        expect(isScannerPath('/wp-login.php?redirect_to=X')).toBe(true);
    });

    // --- New prefix tests (directory-prefixed credential enumeration) ---

    it('matches /app/ prefix for credential probes', () => {
        expect(isScannerPath('/app/.aws/credentials')).toBe(true);
    });

    it('matches /var/task/ paths from Lambda/Docker scanners', () => {
        expect(isScannerPath('/var/task/config/master.key')).toBe(true);
    });

    it('matches /backup/ prefix', () => {
        expect(isScannerPath('/backup/docker-compose.yml')).toBe(true);
    });

    it('matches /conf/ prefix', () => {
        expect(isScannerPath('/conf/.aws/credentials')).toBe(true);
    });

    it('matches /old/ prefix', () => {
        expect(isScannerPath('/old/docker-compose.yml')).toBe(true);
    });

    it('matches /temp/ prefix', () => {
        expect(isScannerPath('/temp/.boto')).toBe(true);
    });

    it('matches /.config/ prefix', () => {
        expect(isScannerPath('/.config/.aws/credentials')).toBe(true);
    });

    it('matches /.docker/ prefix', () => {
        expect(isScannerPath('/.docker/config.json')).toBe(true);
    });

    it('matches /.composer/ prefix', () => {
        expect(isScannerPath('/.composer/auth.json')).toBe(true);
    });

    it('matches /.kube/ prefix', () => {
        expect(isScannerPath('/.kube/config')).toBe(true);
    });

    it('matches /.idea/ prefix', () => {
        expect(isScannerPath('/.idea/dataSources.xml')).toBe(true);
    });

    // --- Framework-specific prefix tests ---

    it('matches /actuator prefix (Spring Boot)', () => {
        expect(isScannerPath('/actuator/env')).toBe(true);
        expect(isScannerPath('/actuator/heapdump')).toBe(true);
    });

    it('matches /WEB-INF/ prefix (Java servlet)', () => {
        expect(isScannerPath('/WEB-INF/web.xml')).toBe(true);
    });

    it('matches /swagger prefix', () => {
        expect(isScannerPath('/swagger.json')).toBe(true);
        expect(isScannerPath('/swagger.yaml')).toBe(true);
    });

    it('matches /openapi prefix', () => {
        expect(isScannerPath('/openapi.json')).toBe(true);
    });

    it('matches /_profiler prefix (Symfony)', () => {
        expect(isScannerPath('/_profiler/phpinfo')).toBe(true);
    });

    it('matches /jolokia prefix (Java JMX)', () => {
        expect(isScannerPath('/jolokia/list')).toBe(true);
    });

    it('matches /storage/logs/ prefix (Laravel)', () => {
        expect(isScannerPath('/storage/logs/laravel.log')).toBe(true);
    });

    it('matches /theme/ prefix (panel fingerprinting)', () => {
        expect(isScannerPath('/theme/metron/js/metron.js')).toBe(true);
    });

    it('matches /prevlaravel/ prefix', () => {
        expect(isScannerPath('/prevlaravel/sftp-config.json')).toBe(true);
    });

    // --- New exact path tests ---

    it('matches root-level sensitive JSON files', () => {
        expect(isScannerPath('/sftp-config.json')).toBe(true);
        expect(isScannerPath('/credentials.json')).toBe(true);
        expect(isScannerPath('/secrets.json')).toBe(true);
        expect(isScannerPath('/appsettings.json')).toBe(true);
    });

    it('matches dotfiles without a blocked prefix', () => {
        expect(isScannerPath('/.htpasswd')).toBe(true);
        expect(isScannerPath('/.npmrc')).toBe(true);
        expect(isScannerPath('/.dockerenv')).toBe(true);
        expect(isScannerPath('/.netrc')).toBe(true);
    });

    it('matches probe endpoints', () => {
        expect(isScannerPath('/env')).toBe(true);
        expect(isScannerPath('/heapdump')).toBe(true);
        expect(isScannerPath('/configprops')).toBe(true);
    });

    it('matches backup zip probes', () => {
        expect(isScannerPath('/backup.zip')).toBe(true);
        expect(isScannerPath('/website-backup.zip')).toBe(true);
    });

    it('matches ads.txt and llms.txt', () => {
        expect(isScannerPath('/ads.txt')).toBe(true);
        expect(isScannerPath('/llms.txt')).toBe(true);
    });

    it('matches feed discovery paths', () => {
        expect(isScannerPath('/feed/rss/')).toBe(true);
        expect(isScannerPath('/feed/atom/')).toBe(true);
    });

    // --- Extension matching tests ---

    it('blocks .php extension probes', () => {
        expect(isScannerPath('/info.php')).toBe(true);
        expect(isScannerPath('/phptest.php')).toBe(true);
        expect(isScannerPath('/admin/config.php')).toBe(true);
        expect(isScannerPath('/test.php')).toBe(true);
    });

    it('blocks .sql dump probes', () => {
        expect(isScannerPath('/backup.sql')).toBe(true);
        expect(isScannerPath('/dump.sql')).toBe(true);
        expect(isScannerPath('/database.sql')).toBe(true);
    });

    it('blocks .yml/.yaml config probes', () => {
        expect(isScannerPath('/docker-compose.yml')).toBe(true);
        expect(isScannerPath('/application.yml')).toBe(true);
        expect(isScannerPath('/application.yaml')).toBe(true);
        expect(isScannerPath('/serverless.yml')).toBe(true);
    });

    it('blocks .bak/.old/.save/.tmp backup probes', () => {
        expect(isScannerPath('/config.php.bak')).toBe(true);
        expect(isScannerPath('/config.php.old')).toBe(true);
        expect(isScannerPath('/.s3cfg.save')).toBe(true);
        expect(isScannerPath('/package.json.tmp')).toBe(true);
    });

    it('blocks .log file probes', () => {
        expect(isScannerPath('/laravel.log')).toBe(true);
        expect(isScannerPath('/npm-debug.log')).toBe(true);
    });

    it('blocks .properties/.xml framework config probes', () => {
        expect(isScannerPath('/application.properties')).toBe(true);
        expect(isScannerPath('/bootstrap.properties')).toBe(true);
    });

    it('blocks .tfstate/.tfvars terraform probes', () => {
        expect(isScannerPath('/terraform.tfstate')).toBe(true);
        expect(isScannerPath('/terraform.tfvars')).toBe(true);
    });

    it('blocks .py/.rb script probes', () => {
        expect(isScannerPath('/settings.py')).toBe(true);
        expect(isScannerPath('/manage.py')).toBe(true);
    });

    it('blocks .asp/.aspx/.jsp server page probes', () => {
        expect(isScannerPath('/default.asp')).toBe(true);
        expect(isScannerPath('/default.aspx')).toBe(true);
        expect(isScannerPath('/index.jsp')).toBe(true);
    });

    it('allows /sitemap.xml via extension allowlist', () => {
        expect(isScannerPath('/sitemap.xml')).toBe(false);
    });

    // --- Double-encoding detection tests ---

    it('catches double-encoded /.env bypass', () => {
        // Raw HTTP path: /.%2565%256Ev
        // URL constructor decodes once → pathname = /.%65%6Ev
        // Our second decode → /.env (caught by prefix)
        expect(isScannerPath('/.%65%6Ev')).toBe(true);
    });

    it('catches double-encoded /.git/config bypass', () => {
        // Raw HTTP path: /.%2567%2569%2574/%2563%256F%256E%2566%2569%2567
        // URL constructor decodes once → pathname = /.%67%69%74/%63%6F%6E%66%69%67
        // Our second decode → /.git/config (caught by prefix)
        expect(isScannerPath('/.%67%69%74/%63%6F%6E%66%69%67')).toBe(true);
    });

    it('does not false-positive on paths with legitimate percent-encoding', () => {
        // A percent-encoded path that decodes to something non-scanner
        expect(isScannerPath('/review%3Fpage%3D1')).toBe(false);
    });

    // --- Legitimate paths must NOT be blocked ---

    it('does not match the home path', () => {
        expect(isScannerPath('/')).toBe(false);
    });

    it('does not match the review path', () => {
        expect(isScannerPath('/review/abc123')).toBe(false);
    });

    it('does not match legitimate API paths', () => {
        expect(isScannerPath('/api/resolve')).toBe(false);
    });

    it('does not match /api/health', () => {
        expect(isScannerPath('/api/health')).toBe(false);
    });

    it('does not match /api/csp-report', () => {
        expect(isScannerPath('/api/csp-report')).toBe(false);
    });

    it('does not match /share', () => {
        expect(isScannerPath('/share')).toBe(false);
    });

    it('does not match /robots.txt', () => {
        expect(isScannerPath('/robots.txt')).toBe(false);
    });

    it('does not match /site.webmanifest', () => {
        expect(isScannerPath('/site.webmanifest')).toBe(false);
    });

    it('does not match SvelteKit __data.json paths', () => {
        expect(isScannerPath('/review/__data.json')).toBe(false);
    });

    it('is case-sensitive — uppercase scanner paths are not blocked', () => {
        expect(isScannerPath('/WP-LOGIN.PHP')).toBe(false);
    });

    it('exact match requires the full path — /loginhelp does not match /login', () => {
        expect(isScannerPath('/loginhelp')).toBe(false);
    });
});
