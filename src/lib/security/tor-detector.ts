'use server';

// ============================================
// TOR EXIT NODE DETECTION SERVICE
// ============================================
// Fetches and caches Tor exit node IPs, then checks login IPs against the list.

import { supabase } from '@/lib/supabase';

const TOR_LIST_SOURCES = [
    'https://check.torproject.org/torbulkexitlist',
    'https://www.dan.me.uk/torlist/?exit',
];

/**
 * Fetch Tor exit node IPs from public sources and cache in database.
 * Only refreshes if the cache is older than 6 hours.
 */
export async function refreshTorExitNodes(): Promise<{ count: number; source: string }> {
    // Check if cache is fresh (less than 6 hours old)
    const { data: latest } = await supabase
        .from('tor_exit_nodes')
        .select('last_seen')
        .order('last_seen', { ascending: false })
        .limit(1)
        .single();

    if (latest) {
        const cacheAge = Date.now() - new Date(latest.last_seen).getTime();
        const sixHours = 6 * 60 * 60 * 1000;
        if (cacheAge < sixHours) {
            console.log('🧅 [TOR] Cache is fresh, skipping refresh');
            return { count: 0, source: 'cache_hit' };
        }
    }

    // Try each source until one works
    for (const source of TOR_LIST_SOURCES) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(source, { signal: controller.signal });
            clearTimeout(timeout);

            if (!response.ok) continue;

            const text = await response.text();
            const ips = text
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#') && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(line));

            if (ips.length === 0) continue;

            // Clear old cache and insert new
            await supabase.from('tor_exit_nodes').delete().neq('ip_address', '');

            // Insert in batches of 500
            const batchSize = 500;
            for (let i = 0; i < ips.length; i += batchSize) {
                const batch = ips.slice(i, i + batchSize).map(ip => ({
                    ip_address: ip,
                    last_seen: new Date().toISOString(),
                    source: source.includes('torproject') ? 'torproject' : 'dan.me.uk',
                }));
                await supabase.from('tor_exit_nodes').upsert(batch, { onConflict: 'ip_address' });
            }

            console.log(`🧅 [TOR] Cached ${ips.length} exit nodes from ${source}`);
            return { count: ips.length, source };
        } catch (err) {
            console.warn(`🧅 [TOR] Failed to fetch from ${source}:`, err);
            continue;
        }
    }

    console.warn('🧅 [TOR] All sources failed, using stale cache');
    return { count: 0, source: 'all_failed' };
}

/**
 * Check if an IP address is a known Tor exit node.
 * Auto-refreshes the cache if needed.
 */
export async function isTorExitNode(ip: string): Promise<{
    isTor: boolean;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    cacheAge?: number;
}> {
    if (!ip || ip === 'unknown') {
        return { isTor: false, confidence: 'LOW' };
    }

    // Ensure cache is populated
    await refreshTorExitNodes();

    // Direct lookup
    const { data, error } = await supabase
        .from('tor_exit_nodes')
        .select('ip_address, last_seen')
        .eq('ip_address', ip)
        .single();

    if (error || !data) {
        return { isTor: false, confidence: 'HIGH' };
    }

    const cacheAge = Date.now() - new Date(data.last_seen).getTime();
    return {
        isTor: true,
        confidence: cacheAge < 6 * 60 * 60 * 1000 ? 'HIGH' : 'MEDIUM',
        cacheAge,
    };
}

/**
 * Get stats about the Tor exit node cache.
 */
export async function getTorCacheStats(): Promise<{
    totalNodes: number;
    lastRefresh: string | null;
}> {
    const { count } = await supabase
        .from('tor_exit_nodes')
        .select('*', { count: 'exact', head: true });

    const { data: latest } = await supabase
        .from('tor_exit_nodes')
        .select('last_seen')
        .order('last_seen', { ascending: false })
        .limit(1)
        .single();

    return {
        totalNodes: count || 0,
        lastRefresh: latest?.last_seen || null,
    };
}
