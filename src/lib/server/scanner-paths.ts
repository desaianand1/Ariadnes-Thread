// Opportunistic-scanner path patterns. We answer 404 (not 403) to deny recon
// value — scanners can't distinguish "blocked" from "doesn't exist" and move on
// faster when they can't tell whether the target is worth further probing.
// Add to these lists as new patterns appear in production logs.

const SCANNER_PREFIXES = [
    // WordPress / CMS
    '/wp-',
    '/wordpress',
    '/drupal',
    '/joomla',
    '/magento',
    '/wp1/',

    // Exposed dotfiles/dotdirs
    '/.git',
    '/.env',
    '/.aws',
    '/.ssh',
    '/.vscode',
    '/.config/',
    '/.docker/',
    '/.composer/',
    '/.kube/',
    '/.idea/',

    // PHP admin panels
    '/xmlrpc.php',
    '/phpmyadmin',
    '/adminer',
    '/phpinfo',
    '/administrator',
    '/cgi-bin',
    '/vendor/phpunit',

    // Year-based archive paths (WordPress blog scanners)
    '/2019/',
    '/2020/',
    '/2021/',
    '/2022/',
    '/2023/',
    '/2024/',
    '/2025/',
    '/2026/',

    // Generic CMS/shop/blog prefixes
    '/shop/',
    '/blog/',
    '/cms/',
    '/site/',
    '/test/',
    '/web/',

    // Directory-prefixed credential/config enumeration
    // (seen from 185.177.72.58 and 93.123.109.180 in production logs)
    '/app/',
    '/var/',
    '/src/',
    '/local/',
    '/conf/',
    '/backup/',
    '/old/',
    '/temp/',

    // Java / Spring Boot
    '/actuator',
    '/WEB-INF/',
    '/jolokia',

    // API docs scanners
    '/swagger',
    '/openapi',
    '/api-docs',

    // Symfony / PHP frameworks
    '/_profiler',

    // Server status endpoints
    '/server-status',
    '/server-info',
    '/nginx_status',

    // CMS config paths
    '/sites/default/',
    '/rest/',
    '/storage/logs/',
    '/logs/',
    '/sql/',

    // Panel/framework fingerprinting
    '/theme/',
    '/file-manager',
    '/prevlaravel/',
    '/django/',
    '/node/'
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
    '/wp-admin/',

    // Root-level sensitive files (.json not in SCANNER_EXTENSIONS
    // because SvelteKit uses __data.json for client-side navigation)
    '/sftp-config.json',
    '/sftp.json',
    '/docker.env',
    '/config.env',
    '/env',
    '/env.txt',
    '/env.json',
    '/credentials.json',
    '/auth.json',
    '/composer.json',
    '/composer.lock',
    '/secrets.json',
    '/config.json',
    '/settings.json',
    '/appsettings.json',
    '/web.config',
    '/swagger-ui.html',
    '/local.settings.json',
    '/.runtimeconfig.json',

    // Probes with no blocked extension
    '/ads.txt',
    '/llms.txt',
    '/staff',
    '/tos',
    '/auth/login',

    // Java/Spring endpoints
    '/heapdump',
    '/heapdump.hprof',
    '/threaddump',
    '/trace',
    '/configprops',
    '/mappings',

    // Dotfiles without a blocked prefix
    '/.htpasswd',
    '/.htaccess',
    '/.npmrc',
    '/.dockerenv',
    '/.netrc',

    // Archive/backup probes
    '/website-backup.zip',
    '/weird-backup.zip',
    '/backup.zip',

    // Misc framework files
    '/ecosystem.config.js',
    '/connectionstrings.config',
    '/global.asax',
    '/error.log',

    // Feed discovery
    '/feed/rss/',
    '/feed/rss2/',
    '/feed/atom/'
]);

// Extensions this SvelteKit app never serves. Blocking these in one rule
// covers hundreds of individual scanner probes (.php, .sql, .bak, etc.).
// NOTE: .json and .txt are intentionally excluded — SvelteKit uses __data.json
// for navigation, and robots.txt is a legitimate route. .map is excluded
// because SvelteKit may serve source maps from /_app/immutable/.
const SCANNER_EXTENSIONS = [
    '.php',
    '.sql',
    '.bak',
    '.old',
    '.save',
    '.tmp',
    '.log',
    '.yml',
    '.yaml',
    '.properties',
    '.xml',
    '.inc',
    '.cfg',
    '.ini',
    '.conf',
    '.tfstate',
    '.tfvars',
    '.py',
    '.rb',
    '.cgi',
    '.asp',
    '.aspx',
    '.jsp'
] as const;

const EXTENSION_ALLOWLIST = new Set(['/sitemap.xml']);

function checkPath(pathname: string): boolean {
    if (SCANNER_EXACT.has(pathname)) return true;
    if (SCANNER_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
    if (
        !EXTENSION_ALLOWLIST.has(pathname) &&
        SCANNER_EXTENSIONS.some((ext) => pathname.endsWith(ext))
    ) {
        return true;
    }
    return false;
}

export function isScannerPath(pathname: string): boolean {
    if (checkPath(pathname)) return true;

    // Catch double-encoded bypass attempts (e.g. /.%2565%256Ev → /.env)
    if (pathname.includes('%')) {
        try {
            const decoded = decodeURIComponent(pathname);
            if (decoded !== pathname && checkPath(decoded)) return true;
        } catch {
            // Malformed percent encoding — not a real browser request
        }
    }

    return false;
}
