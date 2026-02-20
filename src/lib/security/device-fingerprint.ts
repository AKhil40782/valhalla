'use client';

// ============================================
// DEVICE FINGERPRINT UTILITY
// ============================================
// Client-side device metadata collection and fingerprint generation.
// The fingerprint is hashed with a salt before being sent to the server.

export interface DeviceMetadata {
    userAgent: string;
    platform: string;
    screenResolution: string;
    timezone: string;
    appVersion: string;
    language: string;
    colorDepth: number;
    hardwareConcurrency: number;
    // Suspicious environment flags
    isHeadless: boolean;
    isWebDriver: boolean;
    isEmulator: boolean;
}

/**
 * Collect device metadata from the browser environment.
 */
export function collectDeviceMetadata(): DeviceMetadata {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const screen = typeof window !== 'undefined' ? window.screen : null;

    const userAgent = nav?.userAgent || 'unknown';
    const platform = nav?.platform || (nav as any)?.userAgentData?.platform || 'unknown';
    const screenResolution = screen ? `${screen.width}x${screen.height}` : 'unknown';
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
    const language = nav?.language || 'unknown';
    const colorDepth = screen?.colorDepth || 0;
    const hardwareConcurrency = nav?.hardwareConcurrency || 0;

    // Suspicious environment detection
    const isHeadless = detectHeadlessBrowser();
    const isWebDriver = detectWebDriver();
    const isEmulator = detectEmulator();

    return {
        userAgent,
        platform,
        screenResolution,
        timezone,
        appVersion: '2.4.0',
        language,
        colorDepth,
        hardwareConcurrency,
        isHeadless,
        isWebDriver,
        isEmulator,
    };
}

/**
 * Build the raw fingerprint string from metadata.
 * This is deterministic for the same device + browser combination.
 */
export function buildFingerprintRaw(metadata: DeviceMetadata): string {
    return [
        metadata.userAgent,
        metadata.platform,
        metadata.screenResolution,
        metadata.timezone,
        metadata.appVersion,
        metadata.language,
        String(metadata.colorDepth),
        String(metadata.hardwareConcurrency),
    ].join('|');
}

/**
 * Generate a salted SHA-256 hash of the device fingerprint.
 * Uses the Web Crypto API (available in all modern browsers).
 */
export async function generateDeviceHash(metadata: DeviceMetadata, salt: string): Promise<string> {
    const raw = buildFingerprintRaw(metadata);
    const salted = salt + raw;

    const encoder = new TextEncoder();
    const data = encoder.encode(salted);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a human-readable device label from the user agent.
 */
export function getDeviceLabel(userAgent: string): string {
    // Browser detection
    let browser = 'Unknown Browser';
    if (userAgent.includes('Edg/')) browser = 'Microsoft Edge';
    else if (userAgent.includes('Chrome/')) browser = 'Google Chrome';
    else if (userAgent.includes('Firefox/')) browser = 'Mozilla Firefox';
    else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) browser = 'Apple Safari';
    else if (userAgent.includes('Opera') || userAgent.includes('OPR/')) browser = 'Opera';

    // OS detection
    let os = 'Unknown OS';
    if (userAgent.includes('Windows NT 10')) os = 'Windows 10/11';
    else if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac OS X')) os = 'macOS';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
    else if (userAgent.includes('Linux')) os = 'Linux';

    return `${browser} on ${os}`;
}

/**
 * Detect headless browser environments.
 */
function detectHeadlessBrowser(): boolean {
    if (typeof window === 'undefined') return false;

    const checks: boolean[] = [
        // No plugins in headless mode
        navigator.plugins?.length === 0,
        // Missing languages
        !navigator.languages || navigator.languages.length === 0,
        // Headless Chrome user agent
        /HeadlessChrome/.test(navigator.userAgent),
        // Phantom.js
        !!(window as any).__phantom || !!(window as any)._phantom,
        // Nightmare.js
        !!(window as any).__nightmare,
        // Zero screen dimensions
        window.outerWidth === 0 && window.outerHeight === 0,
    ];

    return checks.filter(Boolean).length >= 2;
}

/**
 * Detect WebDriver automation.
 */
function detectWebDriver(): boolean {
    if (typeof navigator === 'undefined') return false;

    return !!(
        (navigator as any).webdriver ||
        (window as any).callPhantom ||
        (window as any)._selenium_ide_recorder ||
        (document as any).__webdriver_evaluate ||
        (document as any).__selenium_evaluate ||
        (document as any).__webdriver_script_function
    );
}

/**
 * Detect emulated environments.
 */
function detectEmulator(): boolean {
    if (typeof navigator === 'undefined') return false;

    const ua = navigator.userAgent.toLowerCase();
    return (
        ua.includes('emulator') ||
        ua.includes('simulator') ||
        ua.includes('sdk_gphone') ||
        ua.includes('generic_x86')
    );
}

/**
 * Check if the current device environment is suspicious.
 */
export function isSuspiciousEnvironment(metadata: DeviceMetadata): { suspicious: boolean; flags: string[] } {
    const flags: string[] = [];

    if (metadata.isHeadless) flags.push('Headless browser detected');
    if (metadata.isWebDriver) flags.push('WebDriver automation detected');
    if (metadata.isEmulator) flags.push('Emulator/Simulator detected');
    if (metadata.hardwareConcurrency === 0) flags.push('No hardware concurrency info');
    if (metadata.colorDepth === 0) flags.push('No color depth info');
    if (metadata.screenResolution === 'unknown') flags.push('Unknown screen resolution');

    return { suspicious: flags.length > 0, flags };
}
