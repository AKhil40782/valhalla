// ============================================
// SESSION BEHAVIOUR TRACKER — Category 2
// Tracks how a user behaves during a banking session
// ============================================

export interface SessionBehaviourSignature {
    // Timing
    sessionStart: number;             // Epoch ms
    loginToFirstActionDelay: number;  // ms from session start to first meaningful action
    decisionTimeBeforeTransfer: number; // ms from opening send modal to clicking confirm
    sessionDuration: number;          // Total ms from start to transaction

    // Navigation
    pagesVisited: string[];           // Ordered list of page paths
    pageVisitCount: number;           // Total page navigations
    navigationSpeed: number;          // Avg ms per page

    // Action Speed
    actionTimestamps: number[];       // Timestamps of all meaningful actions
    actionSpeedVariation: number;     // Variance in time between actions (low = bot)
    avgActionInterval: number;        // Avg ms between actions

    // Behaviour Change
    speedAcceleration: number;        // Is user speeding up or slowing down? (+ve = accelerating)
    patternBreak: boolean;            // Did behaviour pattern change mid-session?
}

// ============================================
// CLIENT-SIDE SESSION TRACKER
// ============================================

export class SessionTracker {
    private sessionStart: number;
    private firstActionTime: number | null = null;
    private sendModalOpenTime: number | null = null;
    private confirmTime: number | null = null;
    private pagesVisited: string[] = [];
    private actionTimestamps: number[] = [];
    private active = false;

    constructor() {
        this.sessionStart = Date.now();
    }

    start(): void {
        if (this.active) return;
        this.active = true;
        this.sessionStart = Date.now();

        // Track the initial page
        if (typeof window !== 'undefined') {
            this.pagesVisited.push(window.location.pathname);
        }
    }

    // Call when user performs any meaningful action (click button, open modal, etc.)
    recordAction(actionType?: string): void {
        const now = Date.now();
        this.actionTimestamps.push(now);

        if (!this.firstActionTime) {
            this.firstActionTime = now;
        }
    }

    // Call when user opens the Send Money modal
    recordSendModalOpen(): void {
        this.sendModalOpenTime = Date.now();
        this.recordAction('open_send_modal');
    }

    // Call when user clicks Confirm Transfer
    recordTransferConfirm(): void {
        this.confirmTime = Date.now();
        this.recordAction('confirm_transfer');
    }

    // Call on page navigation
    recordPageVisit(path: string): void {
        this.pagesVisited.push(path);
        this.recordAction('navigate');
    }

    getSignature(): SessionBehaviourSignature {
        const now = Date.now();
        const duration = now - this.sessionStart;

        // Login to first action delay
        const loginToFirstAction = this.firstActionTime
            ? this.firstActionTime - this.sessionStart
            : duration;

        // Decision time (modal open → confirm click)
        const decisionTime = (this.sendModalOpenTime && this.confirmTime)
            ? this.confirmTime - this.sendModalOpenTime
            : 0;

        // Action intervals
        const intervals: number[] = [];
        for (let i = 1; i < this.actionTimestamps.length; i++) {
            intervals.push(this.actionTimestamps[i] - this.actionTimestamps[i - 1]);
        }

        const avgInterval = intervals.length > 0
            ? intervals.reduce((a, b) => a + b, 0) / intervals.length
            : 0;

        const speedVariation = calculateVariance(intervals);

        // Speed acceleration — compare first half vs second half of action intervals
        let acceleration = 0;
        if (intervals.length >= 4) {
            const mid = Math.floor(intervals.length / 2);
            const firstHalfAvg = intervals.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
            const secondHalfAvg = intervals.slice(mid).reduce((a, b) => a + b, 0) / (intervals.length - mid);
            // Positive acceleration = getting faster (intervals shrinking)
            acceleration = firstHalfAvg > 0 ? (firstHalfAvg - secondHalfAvg) / firstHalfAvg : 0;
        }

        // Pattern break — detect sudden change in action speed
        let patternBreak = false;
        if (intervals.length >= 6) {
            for (let i = 3; i < intervals.length; i++) {
                const prevAvg = intervals.slice(Math.max(0, i - 3), i).reduce((a, b) => a + b, 0) / 3;
                if (prevAvg > 0 && Math.abs(intervals[i] - prevAvg) / prevAvg > 2.0) {
                    patternBreak = true;
                    break;
                }
            }
        }

        // Navigation speed
        const navSpeed = this.pagesVisited.length > 1
            ? duration / this.pagesVisited.length
            : duration;

        return {
            sessionStart: this.sessionStart,
            loginToFirstActionDelay: loginToFirstAction,
            decisionTimeBeforeTransfer: decisionTime,
            sessionDuration: duration,
            pagesVisited: this.pagesVisited,
            pageVisitCount: this.pagesVisited.length,
            navigationSpeed: navSpeed,
            actionTimestamps: this.actionTimestamps.slice(-20),
            actionSpeedVariation: speedVariation,
            avgActionInterval: avgInterval,
            speedAcceleration: acceleration,
            patternBreak,
        };
    }

    stop(): void {
        this.active = false;
    }
}

// ============================================
// SERVER-SIDE SESSION ANALYSIS
// ============================================

export function analyzeSessionBehaviour(
    session: SessionBehaviourSignature
): { score: number; flags: string[] } {
    const flags: string[] = [];
    let score = 0;

    // 1. Instant transaction — login → transfer in < 3 seconds
    if (session.loginToFirstActionDelay < 1000 && session.sessionDuration > 0) {
        score += 0.25;
        flags.push(`Suspiciously fast first action: ${session.loginToFirstActionDelay}ms from login`);
    }

    // 2. Zero decision time — opened send modal and confirmed instantly (< 1s)
    if (session.decisionTimeBeforeTransfer > 0 && session.decisionTimeBeforeTransfer < 1000) {
        score += 0.3;
        flags.push(`Near-instant transfer decision: ${session.decisionTimeBeforeTransfer}ms`);
    }

    // 3. Very short total session (< 5s for a full transaction)
    if (session.sessionDuration < 5000 && session.decisionTimeBeforeTransfer > 0) {
        score += 0.2;
        flags.push(`Extremely short session: ${(session.sessionDuration / 1000).toFixed(1)}s`);
    }

    // 4. Perfectly regular action intervals (< 100ms variance = scripted)
    if (session.actionTimestamps.length >= 5 && session.actionSpeedVariation < 100) {
        score += 0.2;
        flags.push('Machine-like action timing (near-zero speed variance)');
    }

    // 5. No navigation — went straight to transaction without exploring
    if (session.pageVisitCount <= 1 && session.decisionTimeBeforeTransfer > 0) {
        score += 0.1;
        flags.push('Direct transaction without session navigation');
    }

    // 6. Sudden speed change mid-session (possible account takeover)
    if (session.patternBreak) {
        score += 0.15;
        flags.push('Abrupt behaviour change detected mid-session');
    }

    // 7. Extreme acceleration (user dramatically speeding up — urgency/scripting)
    if (session.speedAcceleration > 0.7) {
        score += 0.1;
        flags.push('Abnormal session speed acceleration');
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
