// Opportunistic-scanner path patterns. We answer 404 (not 403) to deny recon
// value — scanners can't distinguish "blocked" from "doesn't exist" and move on
// faster when they can't tell whether the target is worth further probing.
// Add to these lists as new patterns appear in production logs.

const SCANNER_PREFIXES = [
    '/wp-',
    '/wordpress',
    '/.git',
    '/.env',
    '/.aws',
    '/.ssh',
    '/.vscode',
    '/xmlrpc.php',
    '/phpmyadmin',
    '/adminer',
    '/phpinfo',
    '/administrator',
    '/cgi-bin',
    '/vendor/phpunit',
    '/drupal',
    '/joomla',
    '/magento',
    '/2019/',
    '/2020/',
    '/2021/',
    '/2022/',
    '/2023/',
    '/2024/',
    '/2025/',
    '/2026/',
    '/shop/',
    '/blog/',
    '/cms/',
    '/site/',
    '/test/',
    '/web/',
    '/wp1/'
] as const;

const SCANNER_EXACT = new Set([
    '/login',
    '/register',
    '/admin',
    '/admin.php',
    '/admin/',
    '/user/login',
    '/signin',
    '/signup',
    '/administrator/',
    '/feed/',
    '/wp-login.php',
    '/wp-admin/'
]);

// Scanners use lowercase by convention; we don't normalize here because it'd
// cost an allocation per request for every legitimate hit. If mixed-case probes
// start showing up in logs, add them explicitly or add .toLowerCase().
export function isScannerPath(pathname: string): boolean {
    if (SCANNER_EXACT.has(pathname)) return true;
    return SCANNER_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
