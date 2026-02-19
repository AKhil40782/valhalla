import { Transaction } from "./generator";

// Simple in-memory store for the live demo
// This resets when the server restarts
export const LIVE_ATTACK_POOL: Transaction[] = [];

export function addLiveTransaction(tx: Transaction) {
    LIVE_ATTACK_POOL.push(tx);
    // Keep only last 50 for demo memory management
    if (LIVE_ATTACK_POOL.length > 50) {
        LIVE_ATTACK_POOL.shift();
    }
}

export function getLiveTransactions() {
    return LIVE_ATTACK_POOL;
}
