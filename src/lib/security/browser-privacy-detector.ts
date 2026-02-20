'use client';

// ============================================
// BROWSER PRIVACY DETECTION (Client-Side)
// ============================================
// Detects Tor Browser, privacy-hardened browsers, and anti-fingerprinting measures.

export interface BrowserPrivacyResult {
    isTorBrowser: boolean;
    canvasBlocked: boolean;
    webglBlocked: boolean;
    webrtcDisabled: boolean;
    audioBlocked: boolean;
    entropyScore: number;       // 0-100, lower = more privacy-hardened
    privacyFlags: string[];
    riskContribution: number;   // 0-1 risk weight
}

/**
 * Comprehensive client-side browser privacy detection.
 * Runs multiple fingerprinting probes to detect privacy tools.
 */
export async function detectBrowserPrivacy(): Promise<BrowserPrivacyResult> {
    const flags: string[] = [];

    // 1. Tor Browser Detection
    const isTorBrowser = detectTorBrowser();
    if (isTorBrowser) flags.push('Tor Browser signature detected');

    // 2. Canvas Fingerprint Blocking
    const canvasBlocked = detectCanvasBlocking();
    if (canvasBlocked) flags.push('Canvas fingerprinting blocked');

    // 3. WebGL Renderer Blocking
    const webglBlocked = detectWebGLBlocking();
    if (webglBlocked) flags.push('WebGL renderer info blocked');

    // 4. WebRTC Disabled
    const webrtcDisabled = detectWebRTCDisabled();
    if (webrtcDisabled) flags.push('WebRTC disabled (IP leak prevention)');

    // 5. Audio Context Fingerprint Blocking
    const audioBlocked = await detectAudioBlocking();
    if (audioBlocked) flags.push('Audio context fingerprinting blocked');

    // 6. Entropy Score (how "unique" is this browser)
    const entropyScore = calculateEntropyScore();
    if (entropyScore < 30) flags.push(`Low browser entropy (${entropyScore}/100)`);

    // Calculate risk contribution
    let riskContribution = 0;
    if (isTorBrowser) riskContribution += 0.5;
    if (canvasBlocked) riskContribution += 0.15;
    if (webglBlocked) riskContribution += 0.1;
    if (webrtcDisabled) riskContribution += 0.1;
    if (audioBlocked) riskContribution += 0.05;
    if (entropyScore < 30) riskContribution += 0.1;
    riskContribution = Math.min(1, riskContribution);

    return {
        isTorBrowser,
        canvasBlocked,
        webglBlocked,
        webrtcDisabled,
        audioBlocked,
        entropyScore,
        privacyFlags: flags,
        riskContribution,
    };
}

/**
 * Detect Tor Browser by its unique signatures.
 */
function detectTorBrowser(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

    const checks: boolean[] = [];

    // Tor Browser always reports a fixed screen size (letterboxing)
    const screenMatch = window.screen.width === 1000 && window.screen.height === 1000;
    if (screenMatch) checks.push(true);

    // Tor Browser spoofs timezone to UTC
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === 'UTC' || tz === 'Etc/UTC') checks.push(true);

    // Tor Browser blocks navigator.plugins
    if (navigator.plugins && navigator.plugins.length === 0) checks.push(true);

    // Tor Browser sets hardwareConcurrency to 2
    if (navigator.hardwareConcurrency === 2) checks.push(true);

    // Tor Browser removes platform-specific info
    if (navigator.platform === '' || navigator.platform === 'Win32' && /Linux/.test(navigator.userAgent)) {
        checks.push(true);
    }

    // Tor Browser blocks window.devicePixelRatio spoofing
    if (window.devicePixelRatio === 1) checks.push(true);

    // Need at least 3 signals to flag as Tor
    return checks.length >= 3;
}

/**
 * Detect canvas fingerprinting being blocked.
 */
function detectCanvasBlocking(): boolean {
    if (typeof document === 'undefined') return false;

    try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        if (!ctx) return true; // Canvas context blocked

        // Draw something distinctive
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Browser Test 🎨', 2, 15);

        const dataUrl = canvas.toDataURL();

        // If canvas returns a blank/uniform data URL, it's being blocked
        if (dataUrl === 'data:,' || dataUrl.length < 100) return true;

        // Some privacy tools return the same hash every time
        // We check by drawing twice with different content
        ctx.clearRect(0, 0, 200, 50);
        ctx.fillStyle = '#ff0';
        ctx.fillText('Different Content 🔒', 2, 15);
        const dataUrl2 = canvas.toDataURL();

        // If both renders produce identical output, canvas is being spoofed
        return dataUrl === dataUrl2;
    } catch {
        return true;
    }
}

/**
 * Detect WebGL renderer info being blocked.
 */
function detectWebGLBlocking(): boolean {
    if (typeof document === 'undefined') return false;

    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
        if (!gl) return true;

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return true;

        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

        // Tor Browser and some privacy tools return generic values
        if (!vendor || !renderer) return true;
        if (vendor === 'Mozilla' && renderer === 'Mozilla') return true;
        if (renderer.includes('SwiftShader')) return true;

        return false;
    } catch {
        return true;
    }
}

/**
 * Detect if WebRTC is disabled (prevents IP leak).
 */
function detectWebRTCDisabled(): boolean {
    if (typeof window === 'undefined') return false;

    const RTCPeerConnection = (window as any).RTCPeerConnection ||
        (window as any).webkitRTCPeerConnection ||
        (window as any).mozRTCPeerConnection;

    if (!RTCPeerConnection) return true;

    try {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.close();
        return false;
    } catch {
        return true;
    }
}

/**
 * Detect audio context fingerprinting being blocked.
 */
async function detectAudioBlocking(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return true;

    try {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const analyser = context.createAnalyser();
        const gain = context.createGain();

        oscillator.connect(analyser);
        analyser.connect(gain);
        gain.connect(context.destination);
        gain.gain.value = 0; // Silent

        oscillator.start(0);

        // Check if audio processing returns uniform data
        const buffer = new Float32Array(analyser.frequencyBinCount);
        analyser.getFloatFrequencyData(buffer);

        oscillator.stop();
        await context.close();

        // If all values are -Infinity (default), audio fingerprinting might be blocked
        const allDefault = buffer.every(v => v === -Infinity);
        return allDefault;
    } catch {
        return true;
    }
}

/**
 * Calculate browser entropy score (0-100).
 * Lower score = more privacy-hardened (less unique).
 */
function calculateEntropyScore(): number {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return 0;

    let score = 0;
    const maxBits = 10; // Max entropy points

    // Each unique data point adds entropy
    if (navigator.plugins && navigator.plugins.length > 0) score += 1;
    if (navigator.languages && navigator.languages.length > 1) score += 1;
    if (navigator.hardwareConcurrency > 2) score += 1;
    if (window.screen.colorDepth > 24) score += 0.5;
    if (window.screen.width !== 1000) score += 1; // Non-Tor screen
    if (navigator.platform && navigator.platform !== '') score += 0.5;
    if ((navigator as any).deviceMemory && (navigator as any).deviceMemory > 2) score += 1;
    if (window.devicePixelRatio !== 1) score += 1;
    if (navigator.maxTouchPoints > 0) score += 1;

    // Timezone is not UTC (Tor sets UTC)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz !== 'UTC' && tz !== 'Etc/UTC') score += 1;

    // Connection info adds entropy
    if ((navigator as any).connection) score += 0.5;

    return Math.round((score / maxBits) * 100);
}
