// ============================================
// BEHAVIORAL BIOMETRICS — Human Interaction Signature
// Category 1: Typing, Mouse, Click, Scroll patterns
// ============================================

export interface BiometricSignature {
    // Typing Biometrics
    typingSpeed: number;              // Chars per second (avg)
    keystrokeIntervals: number[];     // Time between keystrokes (ms) — last 20
    keystrokeRhythmVariance: number;  // Variance in intervals (low = bot-like)
    avgKeystrokeInterval: number;     // Average ms between keys

    // Mouse Biometrics
    mouseSpeed: number;               // Avg pixels/sec
    mouseCurvature: number;           // Avg deviation from straight-line (0=straight, 1=curved)
    mousePathSamples: number;         // How many samples collected

    // Click Biometrics
    clickHesitation: number;          // Avg time from hover/focus to click (ms)
    clickCount: number;               // Total clicks during session

    // Scroll Biometrics
    scrollSpeed: number;              // Avg pixels/sec
    scrollPatternVariance: number;    // Variance in scroll deltas (low = programmatic)
    scrollEventCount: number;

    // Interaction Consistency
    interactionDuration: number;      // Total time monitoring (ms)
    actionSequence: string[];         // Ordered list of action types ['type','click','scroll',...]
    consistency: number;              // 0-1: how consistent patterns are within session
}

export interface BiometricProfile {
    userId: string;
    avgTypingSpeed: number;
    avgMouseSpeed: number;
    avgClickHesitation: number;
    avgKeystrokeInterval: number;
    sessionCount: number;
}

// ============================================
// CLIENT-SIDE COLLECTOR (runs in browser)
// ============================================

export class BiometricCollector {
    private keystrokeTimes: number[] = [];
    private keystrokeIntervals: number[] = [];
    private mousePositions: { x: number; y: number; t: number }[] = [];
    private mouseSpeeds: number[] = [];
    private clickHesitations: number[] = [];
    private clickCount = 0;
    private scrollDeltas: number[] = [];
    private scrollSpeeds: number[] = [];
    private actionSequence: string[] = [];
    private startTime: number;
    private lastMousePos: { x: number; y: number; t: number } | null = null;
    private lastHoverTime: number | null = null;
    private active = false;
    private listeners: { target: EventTarget; event: string; handler: EventListener }[] = [];

    constructor() {
        this.startTime = Date.now();
    }

    start(): void {
        if (this.active) return;
        this.active = true;
        this.startTime = Date.now();

        const addListener = (target: EventTarget, event: string, handler: EventListener) => {
            target.addEventListener(event, handler, { passive: true });
            this.listeners.push({ target, event, handler });
        };

        // Typing — keydown events
        addListener(document, 'keydown', ((e: KeyboardEvent) => {
            const now = Date.now();
            if (this.keystrokeTimes.length > 0) {
                const interval = now - this.keystrokeTimes[this.keystrokeTimes.length - 1];
                if (interval < 5000) { // Ignore > 5s gaps (user paused)
                    this.keystrokeIntervals.push(interval);
                }
            }
            this.keystrokeTimes.push(now);
            this.actionSequence.push('type');
        }) as EventListener);

        // Mouse movement — sampled every 100ms
        let lastMouseSample = 0;
        addListener(document, 'mousemove', ((e: MouseEvent) => {
            const now = Date.now();
            if (now - lastMouseSample < 100) return; // Throttle
            lastMouseSample = now;

            const pos = { x: e.clientX, y: e.clientY, t: now };

            if (this.lastMousePos) {
                const dx = pos.x - this.lastMousePos.x;
                const dy = pos.y - this.lastMousePos.y;
                const dt = (pos.t - this.lastMousePos.t) / 1000; // seconds
                if (dt > 0) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    this.mouseSpeeds.push(dist / dt);
                }
            }

            this.mousePositions.push(pos);
            // Keep only last 50 samples
            if (this.mousePositions.length > 50) this.mousePositions.shift();
            this.lastMousePos = pos;
        }) as EventListener);

        // Mouse enter (for hover-to-click hesitation)
        addListener(document, 'mouseenter', (() => {
            this.lastHoverTime = Date.now();
        }) as EventListener);

        // Click events
        addListener(document, 'click', (() => {
            this.clickCount++;
            this.actionSequence.push('click');
            if (this.lastHoverTime) {
                const hesitation = Date.now() - this.lastHoverTime;
                if (hesitation < 10000) { // Ignore > 10s
                    this.clickHesitations.push(hesitation);
                }
            }
            this.lastHoverTime = Date.now();
        }) as EventListener);

        // Scroll events
        addListener(document, 'scroll', (() => {
            const now = Date.now();
            this.scrollDeltas.push(now);
            this.actionSequence.push('scroll');

            if (this.scrollDeltas.length > 1) {
                const prev = this.scrollDeltas[this.scrollDeltas.length - 2];
                const speed = 1000 / (now - prev); // Events per second
                this.scrollSpeeds.push(speed);
            }
        }) as EventListener);
    }

    stop(): void {
        this.active = false;
        for (const { target, event, handler } of this.listeners) {
            target.removeEventListener(event, handler);
        }
        this.listeners = [];
    }

    getSignature(): BiometricSignature {
        const duration = Date.now() - this.startTime;

        // Typing metrics
        const avgKeystrokeInterval = this.keystrokeIntervals.length > 0
            ? this.keystrokeIntervals.reduce((a, b) => a + b, 0) / this.keystrokeIntervals.length
            : 0;
        const typingSpeed = avgKeystrokeInterval > 0 ? 1000 / avgKeystrokeInterval : 0;
        const rhythmVariance = calculateVariance(this.keystrokeIntervals);

        // Mouse metrics
        const mouseSpeed = this.mouseSpeeds.length > 0
            ? this.mouseSpeeds.reduce((a, b) => a + b, 0) / this.mouseSpeeds.length
            : 0;
        const mouseCurvature = this.calculateMouseCurvature();

        // Click metrics
        const clickHesitation = this.clickHesitations.length > 0
            ? this.clickHesitations.reduce((a, b) => a + b, 0) / this.clickHesitations.length
            : 0;

        // Scroll metrics
        const scrollSpeed = this.scrollSpeeds.length > 0
            ? this.scrollSpeeds.reduce((a, b) => a + b, 0) / this.scrollSpeeds.length
            : 0;
        const scrollPatternVariance = calculateVariance(this.scrollSpeeds);

        // Consistency — how varied are action types?
        const actionCounts = new Map<string, number>();
        this.actionSequence.forEach(a => actionCounts.set(a, (actionCounts.get(a) || 0) + 1));
        const totalActions = this.actionSequence.length;
        const actionEntropy = totalActions > 0
            ? Array.from(actionCounts.values()).reduce((sum, count) => {
                const p = count / totalActions;
                return sum - (p > 0 ? p * Math.log2(p) : 0);
            }, 0)
            : 0;
        // Normalize entropy (max possible with 3 action types = log2(3) ≈ 1.585)
        const consistency = Math.min(1, actionEntropy / 1.585);

        return {
            typingSpeed,
            keystrokeIntervals: this.keystrokeIntervals.slice(-20),
            keystrokeRhythmVariance: rhythmVariance,
            avgKeystrokeInterval,
            mouseSpeed,
            mouseCurvature,
            mousePathSamples: this.mousePositions.length,
            clickHesitation,
            clickCount: this.clickCount,
            scrollSpeed,
            scrollPatternVariance,
            scrollEventCount: this.scrollDeltas.length,
            interactionDuration: duration,
            actionSequence: this.actionSequence.slice(-30),
            consistency,
        };
    }

    private calculateMouseCurvature(): number {
        if (this.mousePositions.length < 3) return 0;

        let totalDeviation = 0;
        let segments = 0;

        for (let i = 2; i < this.mousePositions.length; i++) {
            const a = this.mousePositions[i - 2];
            const b = this.mousePositions[i - 1];
            const c = this.mousePositions[i];

            // Calculate deviation of midpoint from straight line a→c
            const midX = (a.x + c.x) / 2;
            const midY = (a.y + c.y) / 2;
            const deviation = Math.sqrt(Math.pow(b.x - midX, 2) + Math.pow(b.y - midY, 2));
            const lineLength = Math.sqrt(Math.pow(c.x - a.x, 2) + Math.pow(c.y - a.y, 2));

            if (lineLength > 5) { // Ignore tiny movements
                totalDeviation += deviation / lineLength;
                segments++;
            }
        }

        return segments > 0 ? Math.min(1, totalDeviation / segments) : 0;
    }
}

// ============================================
// SERVER-SIDE ANALYSIS
// ============================================

export function calculateBiometricAnomalyScore(
    current: BiometricSignature,
    historicalAvg?: BiometricProfile | null
): { score: number; flags: string[] } {
    const flags: string[] = [];
    let score = 0;

    // 1. Zero interaction check (bot/automation)
    if (current.interactionDuration > 5000 && current.clickCount === 0 && current.keystrokeIntervals.length === 0) {
        score += 0.4;
        flags.push('No human interaction detected during session');
    }

    // 2. Typing rhythm — extremely low variance = robotic
    if (current.keystrokeIntervals.length >= 5) {
        if (current.keystrokeRhythmVariance < 50) {
            score += 0.25;
            flags.push('Machine-like typing rhythm (variance < 50ms)');
        }
        // Extremely fast typing (> 15 chars/sec)
        if (current.typingSpeed > 15) {
            score += 0.2;
            flags.push(`Superhuman typing speed: ${current.typingSpeed.toFixed(1)} chars/sec`);
        }
    }

    // 3. Mouse — perfectly straight movements (no curvature) = scripted
    if (current.mousePathSamples >= 5 && current.mouseCurvature < 0.02) {
        score += 0.2;
        flags.push('Perfectly linear mouse movements (scripted)');
    }

    // 4. No mouse movement at all during a long session
    if (current.interactionDuration > 10000 && current.mousePathSamples < 3) {
        score += 0.15;
        flags.push('No significant mouse movement in session');
    }

    // 5. Click hesitation — instant clicks (< 50ms) are suspicious
    if (current.clickHesitation > 0 && current.clickHesitation < 50) {
        score += 0.15;
        flags.push('Near-instant click reactions (< 50ms hesitation)');
    }

    // 6. Scroll pattern — perfectly regular scrolling = programmatic
    if (current.scrollEventCount >= 5 && current.scrollPatternVariance < 0.1) {
        score += 0.1;
        flags.push('Programmatic scroll pattern detected');
    }

    // 7. Low action diversity (only 1 type of action)
    if (current.actionSequence.length > 10 && current.consistency < 0.3) {
        score += 0.1;
        flags.push('Low interaction diversity');
    }

    // 8. Historical comparison (if available)
    if (historicalAvg && historicalAvg.sessionCount >= 3) {
        const typingDrift = Math.abs(current.typingSpeed - historicalAvg.avgTypingSpeed) / Math.max(historicalAvg.avgTypingSpeed, 1);
        const mouseDrift = Math.abs(current.mouseSpeed - historicalAvg.avgMouseSpeed) / Math.max(historicalAvg.avgMouseSpeed, 1);

        if (typingDrift > 0.5) {
            score += 0.15;
            flags.push(`Typing speed deviates ${(typingDrift * 100).toFixed(0)}% from user's history`);
        }
        if (mouseDrift > 0.5) {
            score += 0.1;
            flags.push(`Mouse speed deviates ${(mouseDrift * 100).toFixed(0)}% from user's history`);
        }
    }

    return { score: Math.min(1, score), flags };
}

// ============================================
// HELPERS
// ============================================

function calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
}
